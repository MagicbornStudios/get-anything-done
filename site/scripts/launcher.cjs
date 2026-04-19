#!/usr/bin/env node
/**
 * GAD planning site launcher (task 44-33c)
 *
 * Two runtime modes, picked automatically:
 *
 *   1. Node mode (default): spawn `node server.js` as a child process,
 *      probe for the listening port, then open the system browser.
 *
 *   2. Bun-compiled mode: when this file is invoked from a Bun --compile'd
 *      launcher.exe (detected via `typeof Bun !== "undefined"`), there is
 *      no sibling Node to spawn — `process.execPath` is the launcher.exe
 *      itself. Instead we set PORT/HOSTNAME env and `require('./server.js')`
 *      in-process so the standalone Next server runs under Bun's Node-compat.
 *
 * In both modes the launcher waits for the port to bind, opens the default
 * browser, and stays running until either Ctrl+C or the server exits.
 *
 * Layout the launcher expects (produced by site/scripts/pack-site-release.cjs):
 *
 *   <release>/
 *     server.js          ← Next standalone entry
 *     .next/             ← Next standalone build output
 *     public/            ← static assets
 *     launcher.cjs       ← this file
 *     launcher.exe       ← optional, Bun --compile'd version
 *     README.txt         ← consumer-facing notes
 *
 * Env knobs (all optional):
 *   GAD_SITE_PORT        pin a port (default: pick a free one in 5560–5599)
 *   GAD_SITE_HOST        bind host (default: 127.0.0.1)
 *   GAD_SITE_NO_BROWSER  don't auto-open the browser
 *   GAD_PLANNING_DIR     override which .planning/ the site reads from at request time
 *   GAD_LAUNCHER_FORCE_SPAWN  force the Node-mode subprocess path even under Bun
 */

"use strict";

const { spawn } = require("node:child_process");
const net = require("node:net");
const path = require("node:path");
const fs = require("node:fs");

const RELEASE_DIR = __dirname;
const SERVER_JS = path.join(RELEASE_DIR, "server.js");

if (!fs.existsSync(SERVER_JS)) {
  console.error(`[gad-launcher] missing server.js at ${SERVER_JS}`);
  console.error("[gad-launcher] re-pack the release with `pnpm pack:site` from the framework root");
  process.exit(2);
}

const HOST = process.env.GAD_SITE_HOST || "127.0.0.1";
const FORCED_PORT = process.env.GAD_SITE_PORT ? Number(process.env.GAD_SITE_PORT) : null;
const DISABLE_BROWSER = process.env.GAD_SITE_NO_BROWSER === "1" || process.env.GAD_SITE_NO_BROWSER === "true";

function pickFreePort() {
  return new Promise((resolve, reject) => {
    if (FORCED_PORT && Number.isFinite(FORCED_PORT)) {
      resolve(FORCED_PORT);
      return;
    }
    const tried = [];
    let cursor = 5560;
    const tryNext = () => {
      if (cursor > 5599) {
        reject(new Error(`no free port in 5560–5599 (tried ${tried.join(",")})`));
        return;
      }
      const port = cursor++;
      tried.push(port);
      const probe = net.createServer();
      probe.unref();
      probe.on("error", () => tryNext());
      probe.listen(port, HOST, () => {
        probe.close(() => resolve(port));
      });
    };
    tryNext();
  });
}

function openBrowser(url) {
  if (DISABLE_BROWSER) {
    console.log(`[gad-launcher] GAD_SITE_NO_BROWSER set — open ${url} manually`);
    return;
  }
  const platform = process.platform;
  let cmd;
  let args;
  if (platform === "win32") {
    cmd = "cmd.exe";
    args = ["/c", "start", "", url];
  } else if (platform === "darwin") {
    cmd = "open";
    args = [url];
  } else {
    cmd = "xdg-open";
    args = [url];
  }
  try {
    spawn(cmd, args, { stdio: "ignore", detached: true }).unref();
  } catch (err) {
    console.warn(`[gad-launcher] could not auto-open browser (${err.message}); visit ${url} manually`);
  }
}

function startProbeAndOpenBrowser(port) {
  const url = `http://${HOST}:${port}/`;
  let opened = false;
  const openOnce = () => {
    if (opened) return;
    opened = true;
    openBrowser(url);
  };
  const start = Date.now();
  const probeInterval = setInterval(() => {
    if (Date.now() - start > 30_000) {
      clearInterval(probeInterval);
      console.warn(`[gad-launcher] server did not bind within 30s — opening ${url} anyway`);
      openOnce();
      return;
    }
    const probe = net.connect({ host: HOST, port }, () => {
      probe.end();
      clearInterval(probeInterval);
      openOnce();
    });
    probe.on("error", () => probe.destroy());
  }, 250);
  return probeInterval;
}

// Bun-compiled mode: when launcher.exe is a Bun --compile'd binary,
// `process.execPath` is the launcher itself, not a Node binary. Spawning it
// to run server.js wouldn't work (the binary doesn't dispatch by argv).
// Instead, set PORT/HOSTNAME env and require server.js in-process. Bun's
// Node-compat layer runs Next standalone server.js without modification.
function bootInProcess() {
  return (async () => {
    const port = await pickFreePort();
    const url = `http://${HOST}:${port}/`;
    console.log(`[gad-launcher] (bun-compiled) booting GAD planning site on ${url}`);
    process.env.PORT = String(port);
    process.env.HOSTNAME = HOST;
    process.chdir(RELEASE_DIR);
    startProbeAndOpenBrowser(port);
    // Loading server.js in-process — Next standalone calls
    // `createServer(...).listen(port)` at module load. Errors propagate
    // up the require() chain.
    require(SERVER_JS);
  })().catch((err) => {
    console.error(`[gad-launcher] in-process boot failed: ${err.message}`);
    console.error("[gad-launcher] set GAD_LAUNCHER_FORCE_SPAWN=1 to fall back to subprocess mode (requires sibling node)");
    process.exit(1);
  });
}

// Node mode: spawn `node server.js` as a child process. This is the
// portable default that works whenever `node` is on PATH.
function bootSubprocess() {
  return (async () => {
    const port = await pickFreePort();
    const url = `http://${HOST}:${port}/`;
    console.log(`[gad-launcher] booting GAD planning site on ${url}`);

    const child = spawn(process.execPath, [SERVER_JS], {
      cwd: RELEASE_DIR,
      env: {
        ...process.env,
        PORT: String(port),
        HOSTNAME: HOST,
      },
      stdio: "inherit",
    });

    const probeInterval = startProbeAndOpenBrowser(port);

    child.on("exit", (code, signal) => {
      clearInterval(probeInterval);
      if (signal) {
        console.log(`[gad-launcher] server exited via ${signal}`);
        process.exit(0);
      }
      process.exit(code ?? 0);
    });

    for (const sig of ["SIGINT", "SIGTERM", "SIGHUP"]) {
      process.on(sig, () => {
        try { child.kill(sig); } catch { /* already dead */ }
      });
    }
  })();
}

const isBunCompiled = typeof globalThis.Bun !== "undefined" && process.env.GAD_LAUNCHER_FORCE_SPAWN !== "1";
if (isBunCompiled) {
  bootInProcess();
} else {
  bootSubprocess();
}
