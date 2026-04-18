'use strict';

/**
 * static-http-serve.cjs — tiny static file HTTP server.
 *
 * Used by `gad site serve` (planning/landing static extract) and by
 * `gad generation open` / `gad play` (preserved **build artifact** roots).
 * This module is intentionally NOT named "site-*" so artifact previews do not
 * load the site compile pipeline (decision gad-225 follow-up).
 */

const fs = require('fs');
const path = require('path');

/**
 * @param {object} opts
 * @param {string} opts.rootDir - Absolute path to directory containing index.html + assets.
 * @param {number} [opts.port] - TCP port (default 3456).
 * @param {string} [opts.host] - Bind address (default 127.0.0.1).
 * @param {string} [opts.logPrefix] - Prefix for console lines (default `[gad static]`).
 * @param {boolean} [opts.autoPort] - If true, when the requested port is in use,
 *   increment until an open port is found (bounded by maxPortAttempts).
 * @param {number} [opts.maxPortAttempts] - Max additional port attempts when autoPort is true (default 25).
 * @param {(server: object) => void} [opts.onListening] - Fires once when listen succeeds.
 */
function serveStatic({
  rootDir,
  port,
  host,
  logPrefix = '[gad static]',
  autoPort = false,
  maxPortAttempts = 25,
  onListening,
} = {}) {
  const http = require('http');
  const requestedPort = Number.isFinite(Number(port)) ? Number(port) : 3456;
  const host_ = host || '127.0.0.1';
  let boundPort = requestedPort;

  const MIME = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.mjs': 'application/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.rsc': 'text/x-component; charset=utf-8',
    '.meta': 'application/json; charset=utf-8',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.svg': 'image/svg+xml',
    '.woff': 'font/woff',
    '.woff2': 'font/woff2',
    '.map': 'application/json',
  };

  const server = http.createServer((req, res) => {
    let urlPath = decodeURIComponent(req.url.split('?')[0]);
    if (urlPath === '/' || urlPath === '') urlPath = '/index.html';
    const safePath = path.normalize(urlPath).replace(/^(\.\.[\\/])+/, '');
    const basePath = path.join(rootDir, safePath);

    let filePath = null;
    const hasExt = Boolean(path.extname(basePath));
    if (hasExt && fs.existsSync(basePath) && !fs.statSync(basePath).isDirectory()) {
      filePath = basePath;
    } else if (!hasExt && fs.existsSync(basePath + '.html')) {
      filePath = basePath + '.html';
    } else if (fs.existsSync(basePath)) {
      try {
        if (fs.statSync(basePath).isDirectory()) {
          const idx = path.join(basePath, 'index.html');
          if (fs.existsSync(idx)) filePath = idx;
        } else {
          filePath = basePath;
        }
      } catch {}
    }

    if (!filePath) {
      const notFound = path.join(rootDir, '404.html');
      if (fs.existsSync(notFound)) {
        res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
        fs.createReadStream(notFound).pipe(res);
        return;
      }
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end(`Not found: ${urlPath}`);
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const type = MIME[ext] || 'application/octet-stream';
    res.writeHead(200, {
      'Content-Type': type,
      'Cache-Control': 'no-store',
    });
    fs.createReadStream(filePath).pipe(res);
  });

  const onReady = () => {
    console.log(`${logPrefix} serving directory ${rootDir}`);
    console.log(`${logPrefix} preview URL http://${host_}:${boundPort}/`);
    console.log(`${logPrefix} press ctrl+c to stop`);
    if (typeof onListening === 'function') {
      try {
        onListening(server);
      } catch (e) {
        console.error(`${logPrefix} onListening callback error:`, e && e.message ? e.message : e);
      }
    }
  };

  function listenWithRetry(portToTry, attemptsUsed) {
    const onListening = () => {
      server.removeListener('error', onError);
      const addr = server.address();
      boundPort =
        addr && typeof addr === 'object' && Number.isFinite(addr.port)
          ? addr.port
          : portToTry;
      onReady();
    };

    const onError = (err) => {
      server.removeListener('listening', onListening);
      const inUse = err && err.code === 'EADDRINUSE';
      if (autoPort && inUse && attemptsUsed < maxPortAttempts) {
        const nextPort = portToTry + 1;
        console.log(`${logPrefix} port ${portToTry} in use, trying ${nextPort}`);
        listenWithRetry(nextPort, attemptsUsed + 1);
        return;
      }
      // Preserve existing crash semantics when we cannot recover.
      throw err;
    };

    server.once('error', onError);
    server.once('listening', onListening);
    server.listen(portToTry, host_);
  }

  listenWithRetry(requestedPort, 0);

  return server;
}

module.exports = { serveStatic };
