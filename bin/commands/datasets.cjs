'use strict';
/**
 * gad datasets — dataset curation daemon (Phase 170).
 *
 * Subcommands:
 *   curate [--once] [--tick-minutes N] [--detach] [--dry-run]
 *   stop
 *   status [--lines N]
 *   timeline [--since YYYY-MM-DD] [--label name] [--json]
 *   report [--json]
 *   push-remote [--label name] [--bucket name]
 *
 * Hardened per phase 159 overnight daemon pattern:
 *   - Module-scoped _runtime = { ticking, lastSourceMtime }
 *   - In-flight guard at tick entry
 *   - lowerOwnPriority() at daemon start (PRIORITY_BELOW_NORMAL)
 *   - Skip-if-no-changes via mtime cache in curator lib
 *   - 30 min default tick
 *   - .planning/datasets-curator.log (append, timestamped)
 *   - .planning/datasets-curator.pid pidfile
 *   - SIGINT/SIGTERM cleanup
 *   - --detach re-spawn with GAD_DATASETS_CURATOR_CHILD=1 env
 *
 * Auto-discovered by bin/commands/_loader.cjs — no gad.cjs edits needed.
 */

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { defineCommand } = require('citty');

const { runCuration } = require('../../lib/datasets/curator.cjs');
const { pushToSupabase } = require('../../lib/datasets/remote-supabase.cjs');
const { extractDesignReasoning } = require('../../lib/datasets-curator-design-decisions.cjs');

const DEFAULT_TICK_MINUTES = 30;
const PIDFILE_NAME  = 'datasets-curator.pid';
const LOGFILE_NAME  = 'datasets-curator.log';
const DEFAULT_BUCKET = 'gad-datasets';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function ts() { return new Date().toISOString(); }

function gadCli() {
  return path.resolve(__dirname, '..', 'gad.cjs');
}

function logToFile(planningDir, message) {
  try {
    const logPath = path.join(planningDir, LOGFILE_NAME);
    fs.appendFileSync(logPath, `[${ts()}] ${message}\n`);
  } catch (_) {}
}

// Drop our own process to BELOW_NORMAL priority on supported platforms.
// Best-effort — silently no-ops if the platform/runtime can't honor it.
function lowerOwnPriority(log) {
  try {
    const target = (os.constants && os.constants.priority && os.constants.priority.PRIORITY_BELOW_NORMAL);
    if (typeof target !== 'number') return;
    os.setPriority(target);
    log(`priority: lowered own process to BELOW_NORMAL (${target})`);
  } catch (e) {
    log(`priority: setPriority failed (${e.message}) — continuing at default`);
  }
}

/**
 * Resolve the .planning directory for the current repo.
 * Falls back to process.cwd()/.planning when findRepoRoot is unavailable.
 */
function resolvePlanningDir(deps) {
  try {
    const root = deps.findRepoRoot();
    return path.join(root, '.planning');
  } catch (_) {
    return path.join(process.cwd(), '.planning');
  }
}

/**
 * Build the projects array (with planningDir absolute paths) from deps.
 */
function resolveProjects(deps) {
  try {
    const root = deps.findRepoRoot();
    const config = deps.gadConfig.load(root);
    return (config.roots || []).map((r) => ({
      projectId: r.id,
      rootPath: path.resolve(root, r.path || '.'),
      planningDir: path.resolve(root, r.path || '.', r.planningDir || '.planning'),
    }));
  } catch (_) {
    const fallback = path.join(process.cwd(), '.planning');
    return [{ projectId: 'unknown', rootPath: process.cwd(), planningDir: fallback }];
  }
}

// ─── Tick ─────────────────────────────────────────────────────────────────────

async function runTick(deps, log, dryRun) {
  log('--- tick start ---');
  const t0 = Date.now();
  try {
    const projects = resolveProjects(deps);
    await runCuration({ projects, log, dryRun });

    // design-reasoning extraction — runs if .planning/design-decisions/ exists
    for (const p of projects) {
      if (p && p.planningDir) {
        try {
          extractDesignReasoning({ planningDir: p.planningDir, log, dryRun });
        } catch (e) {
          log(`design-reasoning extraction error (${p.projectId}): ${e.message}`);
        }
      }
    }
  } catch (e) {
    log(`tick error: ${e.message}`);
  } finally {
    log(`--- tick end (${((Date.now() - t0) / 1000).toFixed(1)}s) ---`);
  }
}

// ─── Commands ─────────────────────────────────────────────────────────────────

function createDatasetsCommand(deps) {

  // ── curate ──────────────────────────────────────────────────────────────────
  const curateCmd = defineCommand({
    meta: {
      name: 'curate',
      description: 'Run the dataset curation daemon. Classifies events from transcripts, traces, and gad-logs into labeled JSONL tuples. Hardened: 30min tick, in-flight guard, BELOW_NORMAL priority, skip-if-no-changes. Use --once for a single pass.',
    },
    args: {
      once:           { type: 'boolean', description: 'Exit after one curation pass', default: false },
      'tick-minutes': { type: 'string',  description: 'Tick interval in minutes (default: 30)', default: String(DEFAULT_TICK_MINUTES) },
      detach:         { type: 'boolean', description: 'Fork into background and write pidfile', default: false },
      'dry-run':      { type: 'boolean', description: 'Classify events but do not write output files', default: false },
      'auto-push':    { type: 'string',  description: 'After each tick, push curated files to remote target. Values: "" (off, default) | "auto" (detect creds, prefer hf-hub, fall back to supabase, silent-skip if neither) | "supabase" | "hf-hub". Reads target env vars (SUPABASE_*, HF_TOKEN+HF_DATASETS_REPO).', default: '' },
      'auto-push-delete': { type: 'boolean', description: 'When --auto-push is set, delete local JSONL files after successful upload (laptop-storage relief).', default: false },
    },
    async run({ args }) {
      const planningDir = resolvePlanningDir(deps);
      fs.mkdirSync(planningDir, { recursive: true });

      const dryRun  = Boolean(args['dry-run']);
      const once    = Boolean(args.once);
      const tickMs  = (parseFloat(args['tick-minutes']) || DEFAULT_TICK_MINUTES) * 60_000;
      const autoPushTarget = String(args['auto-push'] || '').toLowerCase();
      const autoPushDelete = Boolean(args['auto-push-delete']);
      const validTargets = ['', 'auto', 'supabase', 'hf-hub'];
      if (!validTargets.includes(autoPushTarget)) {
        console.error(`curate: unknown --auto-push "${autoPushTarget}". Use "auto", "supabase", or "hf-hub".`);
        process.exit(1);
        return;
      }

      // ── detach path ─────────────────────────────────────────────────────────
      if (args.detach) {
        const spawnArgs = [gadCli(), 'datasets', 'curate', '--tick-minutes', args['tick-minutes']];
        if (dryRun) spawnArgs.push('--dry-run');
        if (autoPushTarget) spawnArgs.push('--auto-push', autoPushTarget);
        if (autoPushDelete) spawnArgs.push('--auto-push-delete');
        // Note: do NOT pass --detach to the child (infinite loop guard)

        const child = spawn('node', spawnArgs, {
          detached: true,
          stdio: 'ignore',
          env: { ...process.env, GAD_DATASETS_CURATOR_CHILD: '1' },
        });
        child.unref();

        fs.writeFileSync(path.join(planningDir, PIDFILE_NAME), String(child.pid));
        console.log(`datasets curator detached (pid ${child.pid}). log: .planning/${LOGFILE_NAME}`);
        return;
      }

      // ── foreground / detached-child path ────────────────────────────────────
      const isChild = Boolean(process.env.GAD_DATASETS_CURATOR_CHILD);
      const log = (m) => {
        logToFile(planningDir, m);
        if (!isChild) console.log(`[datasets] ${m}`);
      };

      log(`datasets curator starting. once=${once} tick=${tickMs / 1000}s dry-run=${dryRun} auto-push=${autoPushTarget || 'off'} delete-after=${autoPushDelete} pid=${process.pid}`);
      lowerOwnPriority(log);

      // Always write pidfile (covers both foreground and detached-child paths)
      fs.writeFileSync(path.join(planningDir, PIDFILE_NAME), String(process.pid));

      // ── auto-push helper ─────────────────────────────────────────────────────
      // Tracks whether we already logged the "no creds" skip — so it doesn't
      // spam the log every 30min for the lifetime of a daemon with no creds.
      let autoPushSkipLoggedOnce = false;

      const resolveAutoPushTarget = () => {
        if (!autoPushTarget) return null;
        if (autoPushTarget !== 'auto') return autoPushTarget;
        // 'auto' mode: detect creds, prefer hf-hub (training-corpus tier),
        // fall back to supabase (queryable tier), silent-skip if neither.
        const { hasCredentials: hasHf }       = require('../../lib/datasets/remote-hf.cjs');
        const { hasCredentials: hasSupabase } = require('../../lib/datasets/remote-supabase.cjs');
        if (hasHf())       return 'hf-hub';
        if (hasSupabase()) return 'supabase';
        return null;
      };

      const maybeAutoPush = async () => {
        if (!autoPushTarget) return;
        const target = resolveAutoPushTarget();
        if (!target) {
          if (!autoPushSkipLoggedOnce) {
            log(`auto-push: skipped (no remote credentials configured; set HF_TOKEN+HF_DATASETS_REPO or SUPABASE_URL+SUPABASE_SERVICE_ROLE_KEY to enable)`);
            autoPushSkipLoggedOnce = true;
          }
          return;
        }
        // Reset the once-only skip flag if creds came back so a transient
        // creds-missing window logs again later if it recurs.
        autoPushSkipLoggedOnce = false;

        try {
          const datasetsRoot = path.join(planningDir, 'datasets');
          if (!fs.existsSync(datasetsRoot)) return;
          const labelDirs = fs.readdirSync(datasetsRoot);
          const files = [];
          for (const label of labelDirs) {
            const labelDir = path.join(datasetsRoot, label);
            let stat; try { stat = fs.statSync(labelDir); } catch (_) { continue; }
            if (!stat.isDirectory()) continue;
            let labelFiles; try { labelFiles = fs.readdirSync(labelDir).filter((f) => f.endsWith('.jsonl')); } catch (_) { continue; }
            for (const file of labelFiles) files.push({ filePath: path.join(labelDir, file), label });
          }
          if (files.length === 0) { log(`auto-push: no files to push`); return; }
          let result;
          if (target === 'hf-hub') {
            const { pushToHfHub } = require('../../lib/datasets/remote-hf.cjs');
            result = await pushToHfHub({ files, log });
          } else {
            result = await pushToSupabase({ files, bucket: DEFAULT_BUCKET, log });
          }
          log(`auto-push: ${result.uploaded.length} uploaded, ${result.errors.length} errors (target=${target})`);
          if (autoPushDelete && result.uploaded.length > 0) {
            let deleted = 0;
            for (const item of result.uploaded) {
              try { fs.unlinkSync(item.filePath); deleted++; } catch (e) {
                log(`auto-push delete: failed for ${item.filePath}: ${e.message}`);
              }
            }
            log(`auto-push delete: removed ${deleted} local file(s)`);
          }
        } catch (e) {
          log(`auto-push fatal: ${e.message}`);
        }
      };

      // ── once mode ───────────────────────────────────────────────────────────
      if (once) {
        await runTick(deps, log, dryRun);
        await maybeAutoPush();
        try { fs.unlinkSync(path.join(planningDir, PIDFILE_NAME)); } catch (_) {}
        return;
      }

      // ── standing daemon mode ─────────────────────────────────────────────────
      const tick = async () => {
        try { await runTick(deps, log, dryRun); }
        catch (e) { log(`tick fatal: ${e.message}`); }
        await maybeAutoPush();
      };

      // Initial tick immediately, then schedule
      await tick();
      const interval = setInterval(tick, tickMs);

      const cleanup = () => {
        log(`datasets curator stopping (signal). pid=${process.pid}`);
        clearInterval(interval);
        try { fs.unlinkSync(path.join(planningDir, PIDFILE_NAME)); } catch (_) {}
        process.exit(0);
      };
      process.on('SIGINT',  cleanup);
      process.on('SIGTERM', cleanup);

      // Keep the event loop alive
      setInterval(() => {}, 1 << 30);
    },
  });

  // ── stop ────────────────────────────────────────────────────────────────────
  const stopCmd = defineCommand({
    meta: { name: 'stop', description: 'Stop the running datasets curator (reads pid from .planning/datasets-curator.pid)' },
    args: {},
    run() {
      const planningDir = resolvePlanningDir(deps);
      const pidfile = path.join(planningDir, PIDFILE_NAME);
      if (!fs.existsSync(pidfile)) { console.log('No datasets curator pidfile — not running.'); return; }
      const pid = parseInt(fs.readFileSync(pidfile, 'utf8'), 10);
      try {
        process.kill(pid, 'SIGTERM');
        console.log(`Sent SIGTERM to datasets curator pid ${pid}`);
      } catch (_) {
        console.log(`Process ${pid} not running (stale pidfile removed).`);
        try { fs.unlinkSync(pidfile); } catch (_2) {}
      }
    },
  });

  // ── status ──────────────────────────────────────────────────────────────────
  const statusCmd = defineCommand({
    meta: { name: 'status', description: 'Show datasets curator status + recent log lines' },
    args: {
      lines: { type: 'string', description: 'Number of log lines to show', default: '20' },
    },
    run({ args }) {
      const planningDir = resolvePlanningDir(deps);
      const pidfile = path.join(planningDir, PIDFILE_NAME);
      const logfile = path.join(planningDir, LOGFILE_NAME);

      if (fs.existsSync(pidfile)) {
        const pid = parseInt(fs.readFileSync(pidfile, 'utf8'), 10);
        let alive = false;
        try { process.kill(pid, 0); alive = true; } catch (_) {}
        console.log(`pid ${pid} ${alive ? 'RUNNING' : 'STALE (pidfile not cleaned?)'}`);
      } else {
        console.log('not running (no pidfile)');
      }

      if (fs.existsSync(logfile)) {
        const all = fs.readFileSync(logfile, 'utf8').trim().split('\n');
        const n   = Math.max(1, parseInt(args.lines, 10) || 20);
        const tail = all.slice(-n);
        console.log(`\nrecent log (last ${n} lines of .planning/${LOGFILE_NAME}):`);
        for (const line of tail) console.log('  ' + line);
      } else {
        console.log('\nno log file yet');
      }
    },
  });

  // ── timeline ────────────────────────────────────────────────────────────────
  const timelineCmd = defineCommand({
    meta: { name: 'timeline', description: 'Count tuples per day per label; print timeline grid (default: last 14 days)' },
    args: {
      since: { type: 'string', description: 'Start date YYYY-MM-DD (default: 14 days ago)', default: '' },
      label: { type: 'string', description: 'Filter to a specific label', default: '' },
      json:  { type: 'boolean', description: 'Emit JSON instead of table', default: false },
    },
    run({ args }) {
      const planningDir = resolvePlanningDir(deps);
      const datasetsRoot = path.join(planningDir, 'datasets');

      // Default since: 14 days ago
      let since = args.since || '';
      if (!since) {
        const d = new Date();
        d.setDate(d.getDate() - 14);
        since = d.toISOString().slice(0, 10);
      }

      const labelFilter = args.label || '';

      if (!fs.existsSync(datasetsRoot)) {
        if (args.json) { console.log(JSON.stringify({})); }
        else { console.log('No datasets found. Run `gad datasets curate --once` first.'); }
        return;
      }

      // timeline[label][date] = count
      const timeline = Object.create(null);

      let labelDirs;
      try { labelDirs = fs.readdirSync(datasetsRoot); } catch (_) { labelDirs = []; }

      for (const label of labelDirs) {
        if (labelFilter && label !== labelFilter) continue;
        const labelDir = path.join(datasetsRoot, label);
        let stat;
        try { stat = fs.statSync(labelDir); } catch (_) { continue; }
        if (!stat.isDirectory()) continue;

        let files;
        try { files = fs.readdirSync(labelDir).filter((f) => f.endsWith('.jsonl')); } catch (_) { continue; }

        for (const file of files) {
          const date = file.replace(/\.jsonl$/, '');
          if (date < since) continue;

          const filePath = path.join(labelDir, file);
          let lineCount = 0;
          try {
            const content = fs.readFileSync(filePath, 'utf8');
            lineCount = content.split('\n').filter((l) => l.trim()).length;
          } catch (_) {}

          if (!timeline[label]) timeline[label] = Object.create(null);
          timeline[label][date] = (timeline[label][date] || 0) + lineCount;
        }
      }

      if (args.json) {
        console.log(JSON.stringify(timeline, null, 2));
        return;
      }

      const labels = Object.keys(timeline).sort();
      if (labels.length === 0) {
        console.log(`No dataset tuples since ${since}. Run \`gad datasets curate --once\` first.`);
        return;
      }

      // Collect all dates
      const allDates = new Set();
      for (const lbl of labels) {
        for (const d of Object.keys(timeline[lbl])) allDates.add(d);
      }
      const dates = Array.from(allDates).sort();

      // Print grid
      const COL = 12;
      const header = 'label'.padEnd(20) + dates.map((d) => d.slice(5).padStart(COL)).join('');
      console.log(header);
      console.log('─'.repeat(header.length));
      for (const lbl of labels) {
        const row = lbl.padEnd(20) + dates.map((d) => {
          const count = (timeline[lbl] && timeline[lbl][d]) || 0;
          return (count > 0 ? String(count) : '-').padStart(COL);
        }).join('');
        console.log(row);
      }
    },
  });

  // ── report ──────────────────────────────────────────────────────────────────
  const reportCmd = defineCommand({
    meta: { name: 'report', description: 'Aggregate report: total tuples per label, bytes, training-ready count, last-curated timestamp' },
    args: {
      json: { type: 'boolean', description: 'Emit JSON', default: false },
    },
    run({ args }) {
      const planningDir = resolvePlanningDir(deps);
      const datasetsRoot = path.join(planningDir, 'datasets');
      const logfile = path.join(planningDir, LOGFILE_NAME);

      const report = {
        labels: {},
        total_tuples: 0,
        total_bytes: 0,
        training_ready: 0,
        raw_count: 0,
        last_curated: null,
      };

      if (!fs.existsSync(datasetsRoot)) {
        if (args.json) { console.log(JSON.stringify(report, null, 2)); }
        else { console.log('No datasets found. Run `gad datasets curate --once` first.'); }
        return;
      }

      let labelDirs;
      try { labelDirs = fs.readdirSync(datasetsRoot); } catch (_) { labelDirs = []; }

      for (const label of labelDirs) {
        const labelDir = path.join(datasetsRoot, label);
        let stat;
        try { stat = fs.statSync(labelDir); } catch (_) { continue; }
        if (!stat.isDirectory()) continue;

        let files;
        try { files = fs.readdirSync(labelDir).filter((f) => f.endsWith('.jsonl')).sort(); } catch (_) { continue; }

        let labelTuples = 0;
        let labelBytes  = 0;
        let labelReady  = 0;
        let labelRaw    = 0;

        for (const file of files) {
          const filePath = path.join(labelDir, file);
          let content = '';
          let fileStat;
          try {
            content  = fs.readFileSync(filePath, 'utf8');
            fileStat = fs.statSync(filePath);
          } catch (_) { continue; }

          const lines = content.split('\n').filter((l) => l.trim());
          labelBytes += fileStat.size;
          for (const line of lines) {
            let tuple;
            try { tuple = JSON.parse(line); } catch (_) { continue; }
            labelTuples++;
            if (tuple.training_ready) labelReady++;
            else labelRaw++;
          }
        }

        report.labels[label] = {
          tuples: labelTuples,
          bytes: labelBytes,
          training_ready: labelReady,
          raw: labelRaw,
        };
        report.total_tuples   += labelTuples;
        report.total_bytes    += labelBytes;
        report.training_ready += labelReady;
        report.raw_count      += labelRaw;
      }

      // Last-curated from log file
      if (fs.existsSync(logfile)) {
        try {
          const lines = fs.readFileSync(logfile, 'utf8').trim().split('\n');
          // Find last "tick end" line
          const lastEnd = [...lines].reverse().find((l) => l.includes('tick end'));
          if (lastEnd) {
            const m = lastEnd.match(/^\[([^\]]+)\]/);
            if (m) report.last_curated = m[1];
          }
        } catch (_) {}
      }

      if (args.json) {
        console.log(JSON.stringify(report, null, 2));
        return;
      }

      console.log('\nDataset curation report');
      console.log('═'.repeat(50));
      console.log(`Total tuples  : ${report.total_tuples}`);
      console.log(`Training-ready: ${report.training_ready}`);
      console.log(`Raw           : ${report.raw_count}`);
      console.log(`Total bytes   : ${report.total_bytes}`);
      console.log(`Last curated  : ${report.last_curated || '(never)'}`);
      console.log('\nPer label:');
      for (const [label, data] of Object.entries(report.labels)) {
        console.log(`  ${label.padEnd(16)} tuples=${data.tuples} ready=${data.training_ready} bytes=${data.bytes}`);
      }
    },
  });

  // ── push-remote ──────────────────────────────────────────────────────────────
  const pushRemoteCmd = defineCommand({
    meta: {
      name: 'push-remote',
      description: 'Upload .planning/datasets/<label>/*.jsonl to remote storage. Targets: supabase (default) | hf-hub. Requires target-specific env vars.',
    },
    args: {
      label:  { type: 'string', description: 'Only upload this label (default: all labels)', default: '' },
      target: { type: 'string', description: 'Upload target: supabase (default) | hf-hub', default: 'supabase' },
      bucket: { type: 'string', description: `Supabase bucket name (target=supabase only, default: ${DEFAULT_BUCKET})`, default: DEFAULT_BUCKET },
      repo:   { type: 'string', description: 'HuggingFace Datasets repo (target=hf-hub only, e.g. "org/dataset"). Falls back to HF_DATASETS_REPO env var.', default: '' },
      'delete-after-push': { type: 'boolean', description: 'Delete local JSONL files after successful upload (operator opt-in for laptop-storage relief)', default: false },
      json:   { type: 'boolean', description: 'Emit result as JSON', default: false },
    },
    async run({ args }) {
      const planningDir = resolvePlanningDir(deps);
      const datasetsRoot = path.join(planningDir, 'datasets');
      const target = String(args.target || 'supabase').toLowerCase();
      const bucket = args.bucket || DEFAULT_BUCKET;
      const labelFilter = args.label || '';

      if (target !== 'supabase' && target !== 'hf-hub') {
        console.error(`push-remote: unknown --target "${target}". Use "supabase" or "hf-hub".`);
        process.exit(1);
        return;
      }

      const log = (m) => {
        logToFile(planningDir, m);
        console.log(`[datasets] ${m}`);
      };

      if (!fs.existsSync(datasetsRoot)) {
        log('push-remote: no datasets directory found — run `gad datasets curate --once` first');
        process.exit(1);
        return;
      }

      let labelDirs;
      try { labelDirs = fs.readdirSync(datasetsRoot); } catch (_) { labelDirs = []; }

      const files = [];
      for (const label of labelDirs) {
        if (labelFilter && label !== labelFilter) continue;
        const labelDir = path.join(datasetsRoot, label);
        let stat;
        try { stat = fs.statSync(labelDir); } catch (_) { continue; }
        if (!stat.isDirectory()) continue;

        let labelFiles;
        try { labelFiles = fs.readdirSync(labelDir).filter((f) => f.endsWith('.jsonl')); } catch (_) { continue; }
        for (const file of labelFiles) {
          files.push({ filePath: path.join(labelDir, file), label });
        }
      }

      if (files.length === 0) {
        log(`push-remote: no JSONL files found${labelFilter ? ` for label=${labelFilter}` : ''}`);
        return;
      }

      let result;
      try {
        if (target === 'hf-hub') {
          const { pushToHfHub } = require('../../lib/datasets/remote-hf.cjs');
          result = await pushToHfHub({ files, repo: args.repo || undefined, log });
        } else {
          result = await pushToSupabase({ files, bucket, log });
        }
      } catch (e) {
        log(`push-remote: error — ${e.message}`);
        process.exit(1);
        return;
      }

      if (args['delete-after-push']) {
        let deleted = 0;
        for (const item of result.uploaded || []) {
          try { fs.unlinkSync(item.filePath); deleted++; } catch (e) {
            log(`delete-after-push: failed for ${item.filePath}: ${e.message}`);
          }
        }
        log(`delete-after-push: removed ${deleted} local file(s) after successful upload`);
      }

      if (args.json) {
        console.log(JSON.stringify({ target, ...result }, null, 2));
        return;
      }

      console.log(`\nUpload complete (target=${target}): ${result.uploaded.length} uploaded, ${result.errors.length} errors`);
      if (result.errors.length > 0) {
        for (const err of result.errors) {
          console.log(`  ERROR ${err.storageKey || err.filePath}: ${err.error}`);
        }
        process.exit(1);
      }
    },
  });

  // ── root command ─────────────────────────────────────────────────────────────
  return defineCommand({
    meta: {
      name: 'datasets',
      description: 'Dataset curation daemon — classify training events from transcripts/traces/gad-logs into labeled JSONL tuples. Phase 170 hardening: 30min tick, in-flight guard, BELOW_NORMAL priority, skip-if-no-changes, Supabase Storage push.',
    },
    subCommands: {
      curate:       curateCmd,
      stop:         stopCmd,
      status:       statusCmd,
      timeline:     timelineCmd,
      report:       reportCmd,
      'push-remote': pushRemoteCmd,
    },
  });
}

module.exports = { createDatasetsCommand };
module.exports.register = (ctx) => ({ datasets: createDatasetsCommand(ctx.common) });
