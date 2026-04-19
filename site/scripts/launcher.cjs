#!/usr/bin/env node
/**
 * GAD planning site launcher (task 44-33c — Node first cut)
 *
 * Spawns the standalone Next.js server bundled at ./server.js, waits for it
 * to bind a port, opens the system browser at http://127.0.0.1:<port>/, and
 * stays running until either:
 *   - the user presses Ctrl+C in the terminal, or
 *   - the spawned server.js exits (in which case we propagate its code).
 *
 * Layout the launcher expects (produced by site/scripts/pack-site-release.cjs):
 *
 *   <release>/
 *     server.js          ← Next standalone entry
 *     .next/             ← Next standalone build output
 *     public/            ← static assets
 *     launcher.cjs       ← this file
 *     README.txt         ← consumer-facing notes
 *
 * Env knobs (all optional):
 *   GAD_SITE_PORT     pin a port (default: pick a free one in 5560–5599)
 *   GAD_SITE_HOST     bind host (default: 127.0.0.1)
 *   GAD_SITE_NO_BROWSER  don't auto-open the browser
 *   GAD_PLANNING_DIR  override which .planning/ the site reads from at request time
 *
 * Bun --compile to a real launcher.exe is the next-cut follow-up; see
 * references/installer-feature-flags.md.
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

(async function main() {
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

  let opened = false;
  const openOnce = () => {
    if (opened) return;
    opened = true;
    openBrowser(url);
  };

  // Probe the port until the standalone server actually accepts connections,
  // then open the browser. 30s budget — covers cold-start on a slow disk.
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

  child.on("exit", (code, signal) => {
    clearInterval(probeInterval);
    if (signal) {
      console.log(`[gad-launcher] server exited via ${signal}`);
      process.exit(0);
    }
    process.exit(code ?? 0);
  });

  // Forward Ctrl+C to the child so the standalone server can shut down cleanly.
  for (const sig of ["SIGINT", "SIGTERM", "SIGHUP"]) {
    process.on(sig, () => {
      try { child.kill(sig); } catch { /* already dead */ }
    });
  }
})();
