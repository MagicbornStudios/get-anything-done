#!/usr/bin/env node
// gad-hook-version: {{GAD_VERSION}}
// @source-of-truth: tools/gad-cli/hooks/gad-session-state.js
// @deployed-to: ~/.claude/hooks/gad-session-state.js, vendor/get-anything-done/hooks/gad-session-state.js
// @sync-via: gad install hooks
// @do-not-edit-copies: edit this file then run sync
// SessionStart hook — soul banner + unclaimed handoff pointer + security scan
// + ecosystem auto-up + XP tracking + notification dump.
// Node port of gad-session-state.sh (ported 2026-04-20 to avoid
// Windows bash.exe invocation failures where Claude Code wrapped the
// quoted bash path such that bash tried to interpret bash.exe as its
// script argument). Exits 0 on any error so session always starts.

const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawnSync } = require('child_process');

// Resolve the canonical gad binary path.
function resolveGadBin() {
  if (process.platform === 'win32') {
    const local = path.join(
      process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local'),
      'Programs', 'gad', 'bin', 'gad.exe',
    );
    if (fs.existsSync(local)) return local;
    return 'gad.exe';
  }
  return 'gad';
}

const GAD_BIN = resolveGadBin();

try {
  const cwd = process.env.PWD || process.cwd();

  const soulFile = path.join(cwd, 'SOUL.md');
  if (fs.existsSync(soulFile)) {
    const firstLine = (fs.readFileSync(soulFile, 'utf8').split(/\r?\n/)[0] || '').trim();
    const soul = firstLine.replace(/^# Active Soul — /, '').replace(/^# /, '');
    if (soul) {
      process.stdout.write(`Active soul: ${soul} (SOUL.md)\n`);
    }
  }

  const probe = spawnSync(GAD_BIN, ['handoffs', 'list', '--json'], {
    encoding: 'utf8',
    shell: false,
    timeout: 4000,
  });
  if (probe.status === 0 && probe.stdout) {
    try {
      const arr = JSON.parse(probe.stdout);
      if (Array.isArray(arr) && arr.length > 0) {
        process.stdout.write(
          `Unclaimed handoffs: ${arr.length} — run \`gad handoffs list\` to pick one up.\n`
        );
      }
    } catch {}
  }

  // ── Auto security scan (W25-L16) ────────────────────────────────────────
  // Runs async in background if last scan was >24h ago (or never run).
  // Uses a stamp file at .planning/.security-scan-last to track cadence.
  // Never blocks session start — errors are silently swallowed.
  try {
    const stampFile = path.join(cwd, '.planning', '.security-scan-last');
    let shouldScan = true;
    try {
      const stat = fs.statSync(stampFile);
      const ageMs = Date.now() - stat.mtimeMs;
      if (ageMs < 24 * 60 * 60 * 1000) shouldScan = false;
    } catch {}

    if (shouldScan) {
      // Touch the stamp first so concurrent sessions don't double-scan.
      try {
        fs.mkdirSync(path.dirname(stampFile), { recursive: true });
        fs.writeFileSync(stampFile, new Date().toISOString(), 'utf8');
      } catch {}

      // Launch scan detached — main session proceeds immediately.
      const { spawn } = require('child_process');
      const scanProc = spawn(
        GAD_BIN,
        ['security', 'scan', '--projectid', 'global'],
        {
          cwd,
          detached: true,
          stdio: 'ignore',
          shell: false,
          windowsHide: true,
        }
      );
      scanProc.unref();
      process.stdout.write(
        '[security] auto-scan launched in background (last scan >24h). ' +
        'Run `gad security status` to check for rotation tickets.\n'
      );
    }
  } catch {}
} catch {}

// ---------------------------------------------------------------------------
// Ecosystem auto-up (operator standing rule 2026-05-09: "I always want my
// ecosystem shit coming up so let it come up").
// Reads ecosystem.auto_up_on_session_start setting; if true, fires
// `gad ecosystem up --detach` in background so Kael + daemons come up
// alongside the claude-code session.
// ---------------------------------------------------------------------------
function detectProjectContext() {
  try {
    const cwd = process.env.PWD || process.cwd();
    // Walk up to find gad-config.toml and extract first root id
    let dir = cwd;
    for (let i = 0; i < 10; i++) {
      const cfgPath = path.join(dir, 'gad-config.toml');
      if (fs.existsSync(cfgPath)) {
        const raw = fs.readFileSync(cfgPath, 'utf8');
        const m = raw.match(/^\s*id\s*=\s*"([^"]+)"/m);
        return { rootPath: dir, projectId: m ? m[1] : 'global' };
      }
      const parent = path.dirname(dir);
      if (parent === dir) break;
      dir = parent;
    }
    return { rootPath: cwd, projectId: 'global' };
  } catch { return null; }
}

function maybeAutoUpEcosystem(projectContext) {
  if (!projectContext || !projectContext.rootPath) return;
  // Check setting via gad CLI (small subprocess; parse JSON; bail on error)
  try {
    const result = spawnSync(GAD_BIN, [
      'settings', 'get', 'ecosystem.auto_up_on_session_start',
      '--projectid', projectContext.projectId, '--json',
    ], { timeout: 3000, cwd: projectContext.rootPath, encoding: 'utf8' });
    if (result.status !== 0 || !result.stdout) return;
    // Output may have a [gad-config] preamble line; find the JSON part
    const raw = result.stdout.toString();
    const jsonStart = raw.indexOf('{');
    if (jsonStart === -1) return;
    const parsed = JSON.parse(raw.slice(jsonStart));
    if (parsed.value !== true) return;
  } catch { return; }
  // Spawn detached — operator opted in
  const { spawn } = require('child_process');
  const child = spawn(GAD_BIN, ['ecosystem', 'up', '--detach',
    '--projectid', projectContext.projectId], {
    detached: true, stdio: 'ignore', cwd: projectContext.rootPath,
  });
  child.unref();
  process.stderr.write(`[gad-ecosystem] auto-up triggered (pid ${child.pid})\n`);
}

function maybeWriteSessionStartXp(projectContext) {
  try {
    if (!projectContext || !projectContext.rootPath) return;
    const statePath = path.join(projectContext.rootPath, '.planning', 'STATE.xml');
    if (!fs.existsSync(statePath)) return;
    const stateRaw = fs.readFileSync(statePath, 'utf8');
    const m = stateRaw.match(/<level\s+[^>]*\bxp="([\d.]+)"/);
    if (!m) return;
    const currentXp = parseFloat(m[1]);
    if (!Number.isFinite(currentXp)) return;
    const outPath = path.join(projectContext.rootPath, '.planning', '.session-start-xp.json');
    if (fs.existsSync(outPath)) {
      try {
        const existing = JSON.parse(fs.readFileSync(outPath, 'utf8'));
        const existingTs = Date.parse(existing.ts);
        if (Number.isFinite(existingTs) && (Date.now() - existingTs) < 60 * 60 * 1000) return;
      } catch {}
    }
    fs.writeFileSync(outPath, JSON.stringify({
      xp: Math.round(currentXp),
      ts: new Date().toISOString(),
    }));
  } catch {}
}

try {
  const ctx = detectProjectContext();
  maybeAutoUpEcosystem(ctx);
  maybeWriteSessionStartXp(ctx);
} catch {}

// ─── Notification dump (phase 111 consumer #2) ──────────────────────────────
// Reads .planning/notifications/active.jsonl from the project root (no
// subprocess). Prints all warn|error|critical entries. info entries are
// summarized as a count only.
try {
  const ctx = detectProjectContext();
  if (ctx && ctx.rootPath) {
    const notifFile = path.join(ctx.rootPath, '.planning', 'notifications', 'active.jsonl');
    if (fs.existsSync(notifFile)) {
      const lines = fs.readFileSync(notifFile, 'utf8').split('\n');
      const now = Date.now();
      const surfaced = [];
      let infoCount = 0;
      for (const line of lines) {
        const t = line.trim();
        if (!t) continue;
        let e;
        try { e = JSON.parse(t); } catch { continue; }
        if (e.dismissed) continue;
        if (e.expires_at) {
          const exp = Date.parse(e.expires_at);
          if (Number.isFinite(exp) && exp <= now) continue;
        }
        if (e.severity === 'info') { infoCount++; continue; }
        if (['warn', 'error', 'critical'].includes(e.severity)) {
          surfaced.push(e);
        }
      }
      if (surfaced.length > 0) {
        process.stdout.write(`\nActive notifications (${surfaced.length}):\n`);
        // Sort by severity rank then most-recent first.
        const rank = { critical: 0, error: 1, warn: 2 };
        surfaced.sort((a, b) => {
          const ra = rank[a.severity] ?? 9;
          const rb = rank[b.severity] ?? 9;
          if (ra !== rb) return ra - rb;
          return (b.ts || '').localeCompare(a.ts || '');
        });
        for (const e of surfaced.slice(0, 8)) {
          const sev = (e.severity || '').toUpperCase().padEnd(8);
          const src = (e.source || '').padEnd(12);
          process.stdout.write(`  [${sev}] ${src} ${e.title}\n`);
        }
        if (surfaced.length > 8) {
          process.stdout.write(`  ... and ${surfaced.length - 8} more. Run: gad notify list\n`);
        } else {
          process.stdout.write(`  Dismiss with: gad notify dismiss <id>\n`);
        }
      }
      if (infoCount > 0 && surfaced.length === 0) {
        process.stdout.write(`Notifications: ${infoCount} info — run gad notify list to view.\n`);
      }
    }
  }
} catch {}

process.exit(0);
