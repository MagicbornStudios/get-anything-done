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
 * @param {(server: object) => void} [opts.onListening] - Fires once when listen succeeds.
 */
function serveStatic({ rootDir, port, host, logPrefix = '[gad static]', onListening } = {}) {
  const http = require('http');
  const port_ = port || 3456;
  const host_ = host || '127.0.0.1';

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

  server.listen(port_, host_, () => {
    console.log(`${logPrefix} serving directory ${rootDir}`);
    console.log(`${logPrefix} preview URL http://${host_}:${port_}/`);
    console.log(`${logPrefix} press ctrl+c to stop`);
    if (typeof onListening === 'function') {
      try {
        onListening(server);
      } catch (e) {
        console.error(`${logPrefix} onListening callback error:`, e && e.message ? e.message : e);
      }
    }
  });

  return server;
}

module.exports = { serveStatic };
