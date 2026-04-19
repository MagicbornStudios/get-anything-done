'use strict';
/**
 * subagent-dispatch.cjs — daily-subagent dispatch hook (phase 59 task 59-07).
 *
 * Decisions:
 *   gad-258  Subagent execution model — llm-from-scratch runs via subagent,
 *            reports back to main session. Canonical dispatch contract.
 *   gad-262  `gad start` — daily operator entry; this module is wired into
 *            the `--dispatch-subagents` flag of the start command.
 *   gad-266 G  Scoped-spawn merge default (future real-dispatch integration
 *              uses lib/scoped-spawn.cjs; this phase is prompt-emit-only).
 *
 * Design choices for this phase:
 *   - Config lives in root gad-config.toml `[[planning.roots]]` entries as
 *     `dailySubagent = true` (spelling: lowerCamelCase to match existing
 *     `planningDir`, `discover` — the file already uses camelCase keys).
 *     Option A of the task spec; rejected alternatives in header comment.
 *   - Dispatch mode is option (Y) prompt-emit-only: we write the prompt to
 *     `.planning/subagent-runs/<projectId>/<YYYY-MM-DD>-<taskId>.prompt.md`
 *     and a stub run-record alongside, then print the prompt path. Real
 *     runtime dispatch is deferred — see the follow-up todo filed with this
 *     task. Real dispatch would use lib/scoped-spawn.cjs (see `// FOLLOW-UP`
 *     markers below).
 *   - Dates are local-time YYYY-MM-DD. An operator who starts their day on
 *     the same local wall-clock should not see two dispatches of the same
 *     task just because UTC rolled over. Injected via `now()` so tests can
 *     pin a boundary.
 *
 * Public API (factory pattern for testability):
 *   createDispatcher({ fs, path, now, readers })  → { dispatchAll, dispatchOne, ... }
 *   dispatch(opts)  convenience bound to real deps
 *
 * File layout written by a successful dispatch (per project):
 *   <absPath>/.planning/subagent-runs/<projectId>/
 *     <today>-<taskId>.prompt.md    — operator-dispatchable prompt
 *     <today>-<taskId>.json         — stub run record, status="pending-dispatch"
 *
 * Fail-safe behaviors:
 *   - If ANY <today>-*.json already exists (parseable or not) we treat the
 *     project as handled-today and skip (per R6 + defensive aggregation).
 *   - If the TASK-REGISTRY yields no planned task in the current phase we
 *     log "nothing to do" and skip without writing anything.
 */

const fsReal = require('fs');
const pathReal = require('path');
const crypto = require('crypto');

const DEFAULT_DAILY_FLAG_KEY = 'dailySubagent';

// ---------------------------------------------------------------------------
// gad-config.toml parsing — CJS-side twin of projects-data.ts's parser.
// Kept in this module so the CLI never has to cross the ESM/CJS boundary into
// apps/planning-app/. If the toml schema grows, swap a dep in here.
// ---------------------------------------------------------------------------

/**
 * Parse `[[planning.roots]]` blocks from a gad-config.toml string.
 * Returns an array of { id, path, planningDir, discover, dailySubagent }.
 * Unknown keys on the block are preserved on the returned object so callers
 * can extend without another parser change.
 *
 * @param {string} tomlText
 * @returns {Array<{ id: string, path: string, planningDir: string, discover: boolean, dailySubagent: boolean }>}
 */
function parsePlanningRoots(tomlText) {
  const out = [];
  const headerRe = /^\[\[?[^\]\n]+\]\]?\s*$/gm;
  const headers = [];
  let m;
  while ((m = headerRe.exec(tomlText)) !== null) {
    headers.push({ index: m.index, text: m[0].trim() });
  }
  for (let i = 0; i < headers.length; i++) {
    const h = headers[i];
    if (h.text !== '[[planning.roots]]') continue;
    const start = h.index + h.text.length;
    const end = i + 1 < headers.length ? headers[i + 1].index : tomlText.length;
    const body = tomlText.slice(start, end);

    const id = matchKey(body, 'id');
    const pth = matchKey(body, 'path');
    if (!id || !pth) continue;
    const planningDir = matchKey(body, 'planningDir') ?? '.planning';
    const discoverRaw = matchKey(body, 'discover');
    const dailyRaw = matchKey(body, DEFAULT_DAILY_FLAG_KEY);
    out.push({
      id,
      path: pth,
      planningDir,
      discover: discoverRaw === 'true',
      dailySubagent: dailyRaw === 'true',
    });
  }
  return out;
}

/**
 * Pull a scalar `key = value` from a toml block body. Handles basic strings
 * (with `\\` escape), literal strings, booleans, and bare numbers.
 * @param {string} body
 * @param {string} key
 * @returns {string|null}
 */
function matchKey(body, key) {
  const re = new RegExp(`^\\s*${key}\\s*=\\s*(.+?)\\s*$`, 'm');
  const m = body.match(re);
  if (!m) return null;
  const raw = m[1].trim();
  if (raw.startsWith('"') && raw.endsWith('"')) {
    return raw.slice(1, -1).replace(/\\\\/g, '\\');
  }
  if (raw.startsWith("'") && raw.endsWith("'")) {
    return raw.slice(1, -1);
  }
  return raw;
}

// ---------------------------------------------------------------------------
// Date handling — local YYYY-MM-DD so a late-night dispatch doesn't fire a
// "second" run when UTC rolls over at 7-8pm local.
// ---------------------------------------------------------------------------

/**
 * Format a Date as local-time YYYY-MM-DD. Injected `now()` returns epoch ms;
 * tests pin it to exercise the day boundary.
 *
 * @param {Date|number} when
 * @returns {string}
 */
function toLocalIsoDate(when) {
  const d = when instanceof Date ? when : new Date(when);
  const y = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, '0');
  const da = String(d.getDate()).padStart(2, '0');
  return `${y}-${mo}-${da}`;
}

/**
 * Format a Date as ISO string with offset (for startedAt in run records).
 * Uses the host locale's offset — matches local date above so the record's
 * date prefix agrees with the filename prefix.
 *
 * @param {Date|number} when
 * @returns {string}
 */
function toLocalIsoDateTime(when) {
  const d = when instanceof Date ? when : new Date(when);
  const pad = (n) => String(n).padStart(2, '0');
  const y = d.getFullYear();
  const mo = pad(d.getMonth() + 1);
  const da = pad(d.getDate());
  const h = pad(d.getHours());
  const mi = pad(d.getMinutes());
  const s = pad(d.getSeconds());
  const offMin = -d.getTimezoneOffset();
  const sign = offMin >= 0 ? '+' : '-';
  const offAbs = Math.abs(offMin);
  const offH = pad(Math.floor(offAbs / 60));
  const offM = pad(offAbs % 60);
  return `${y}-${mo}-${da}T${h}:${mi}:${s}${sign}${offH}:${offM}`;
}

// ---------------------------------------------------------------------------
// Run-record shape — stub written pre-dispatch; subagent updates it on report.
// Keep in sync with apps/planning-app/lib/projects-data.ts SubagentRunRecord.
// ---------------------------------------------------------------------------

/**
 * @typedef {Object} RunRecordStub
 * @property {string} runId           UUID
 * @property {string} projectId
 * @property {string} taskId
 * @property {string} startedAt       ISO datetime (local offset)
 * @property {null}   endedAt         null until subagent reports
 * @property {'pending-dispatch'} status
 * @property {string} promptPath      relative to project root (posix slashes)
 * @property {null}   reportBody      null until subagent reports
 * @property {null}   teachingTipId
 * @property {null}   nextTaskId
 * @property {string} dispatchMode    'prompt-emit-only'
 */

/**
 * Build a run-record stub. Marks the day as "handled" so a second invocation
 * of `gad start --dispatch-subagents` on the same day skips the project.
 * Subagent is responsible for updating endedAt/status/reportBody/
 * teachingTipId/nextTaskId when it reports back.
 *
 * @param {{ projectId: string, taskId: string, startedAt: string, promptPath: string, runId?: string }} opts
 * @returns {RunRecordStub}
 */
function buildRunRecord(opts) {
  return {
    runId: opts.runId || crypto.randomUUID(),
    projectId: opts.projectId,
    taskId: opts.taskId,
    startedAt: opts.startedAt,
    endedAt: null,
    status: 'pending-dispatch',
    promptPath: opts.promptPath.replace(/\\/g, '/'),
    reportBody: null,
    teachingTipId: null,
    nextTaskId: null,
    dispatchMode: 'prompt-emit-only',
  };
}

// ---------------------------------------------------------------------------
// Prompt template — mirrors the shape that produced the llm-from-scratch
// 01-01 run. Report-format contract matches gad-258 (single block, ~5
// sections, max ~200 words). Teaching-tip instruction per llm-004.
// ---------------------------------------------------------------------------

/**
 * @param {{ projectId: string, taskId: string, taskGoal: string, phaseId: string, nextAction: string|null, today: string }} ctx
 * @returns {string}
 */
function buildPromptBody(ctx) {
  const { projectId, taskId, taskGoal, phaseId, nextAction, today } = ctx;
  const lines = [];
  lines.push(`# Daily subagent — ${projectId} — ${today}`);
  lines.push('');
  lines.push(`You are the daily subagent for project **${projectId}** (phase ${phaseId || 'unknown'}).`);
  lines.push(`Today's date: ${today} (local).`);
  lines.push('');
  lines.push('## Orientation');
  lines.push('');
  lines.push('Run the following before writing any code:');
  lines.push('');
  lines.push('```sh');
  lines.push(`gad snapshot --projectid ${projectId}`);
  lines.push('```');
  lines.push('');
  lines.push('Save the session id from the snapshot footer and reuse it with `--session <id>` on any subsequent snapshot call (decision gad-195).');
  lines.push('');
  lines.push('## Task to complete');
  lines.push('');
  lines.push(`- **Task id:** ${taskId}`);
  lines.push(`- **Phase:** ${phaseId || '(unknown)'}`);
  lines.push('');
  lines.push('### Goal (verbatim from TASK-REGISTRY.xml)');
  lines.push('');
  lines.push(taskGoal.trim());
  lines.push('');
  if (nextAction && nextAction.trim()) {
    lines.push('### STATE.xml <next-action>');
    lines.push('');
    lines.push(nextAction.trim());
    lines.push('');
  }
  lines.push('## Acceptance criteria');
  lines.push('');
  lines.push('The goal text above is the acceptance contract. Complete it exactly as written; do not re-scope.');
  lines.push('After implementation:');
  lines.push('');
  lines.push(`1. Update \`TASK-REGISTRY.xml\` for task \`${taskId}\`: \`status="done"\`, add \`skill\`, \`agent\`, \`type\` attributes (decision GAD-D-18 + GAD-D-104).`);
  lines.push('2. Update `STATE.xml` `<next-action>` to point at the next planned task in this phase.');
  lines.push('3. Commit with a message referencing the task id.');
  lines.push('');
  lines.push('## Report format contract (decision gad-258)');
  lines.push('');
  lines.push('When you finish, emit ONE fenced report block, max ~200 words, 4-5 sections:');
  lines.push('');
  lines.push('```');
  lines.push('STATUS: done | blocked | partial');
  lines.push('FILES TOUCHED: <list>');
  lines.push('ONE-LINE OUTCOME: <single sentence>');
  lines.push('TEACHING TIP: <one insight worth authoring as a static tip; see llm-004>');
  lines.push('NEXT TASK: <next task id in this phase, or "(phase complete)">');
  lines.push('COMMIT: <short sha>');
  lines.push('```');
  lines.push('');
  lines.push('Do not narrate beyond this block. The main session parses it directly.');
  lines.push('');
  lines.push('## Teaching-tip instruction (llm-004)');
  lines.push('');
  lines.push('Pick the single most load-bearing insight you gained from this task. Surface it in the TEACHING TIP field above. If nothing was surprising, write `TEACHING TIP: (none)`.');
  lines.push('');
  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Next-task resolution — pick the first planned task in the current phase.
// ---------------------------------------------------------------------------

/**
 * @param {{ readers: { readTasks: Function, readState: Function }, root: { id: string, planningDir: string }, absPath: string }} args
 * @returns {{ task: { id: string, goal: string, phase: string }|null, phaseId: string|null, nextAction: string|null, reason?: string }}
 */
function resolveNextTask({ readers, root, absPath }) {
  const readerRoot = { id: root.id, path: '.', planningDir: root.planningDir };
  let state = null;
  try {
    const raw = readers.readState(readerRoot, absPath);
    state = Array.isArray(raw) ? raw[0] : raw;
  } catch {
    /* ignore — state may be legit-absent */
  }
  const phaseId = state && state.currentPhase ? String(state.currentPhase) : null;
  const nextAction = state && state.nextAction ? String(state.nextAction) : null;
  if (!phaseId) {
    return { task: null, phaseId: null, nextAction: null, reason: 'no current-phase in STATE' };
  }
  let tasks = [];
  try {
    tasks = readers.readTasks(readerRoot, absPath, { phase: phaseId, status: 'planned' });
  } catch (err) {
    return { task: null, phaseId, nextAction, reason: `readTasks failed: ${err.message}` };
  }
  if (!tasks || tasks.length === 0) {
    return { task: null, phaseId, nextAction, reason: `no planned tasks in phase ${phaseId}` };
  }
  // tasks come in registry order — readTasks preserves XML order. Pick first.
  const first = tasks[0];
  return {
    task: { id: first.id, goal: first.goal || '', phase: first.phase || phaseId },
    phaseId,
    nextAction,
  };
}

// ---------------------------------------------------------------------------
// Per-project dispatch — writes stub record + prompt file, or skips.
// ---------------------------------------------------------------------------

/**
 * @typedef {Object} DispatchOutcome
 * @property {'dispatched'|'skipped'|'error'} kind
 * @property {string} projectId
 * @property {string} today
 * @property {string=} taskId
 * @property {string=} promptPath
 * @property {string=} recordPath
 * @property {string=} reason
 */

/**
 * @param {{
 *   project: { id: string, absPath: string, planningDir: string },
 *   now: () => number,
 *   fs: typeof import('fs'),
 *   path: typeof import('path'),
 *   readers: { readTasks: Function, readState: Function }
 * }} deps
 * @returns {DispatchOutcome}
 */
function dispatchOne({ project, now, fs, path, readers }) {
  const today = toLocalIsoDate(now());
  const runsDir = path.join(project.absPath, project.planningDir, 'subagent-runs', project.id);

  // Skip-already-ran check. Any <today>-*.json (parseable or not) means we
  // already handled this project today. Per R6 + defensive aggregation
  // (corrupt files must not trigger a re-dispatch).
  let already = false;
  if (fs.existsSync(runsDir)) {
    let entries;
    try {
      entries = fs.readdirSync(runsDir);
    } catch {
      entries = [];
    }
    const prefix = `${today}-`;
    for (const name of entries) {
      if (name.startsWith(prefix) && name.endsWith('.json')) {
        already = true;
        break;
      }
    }
  }
  if (already) {
    return {
      kind: 'skipped',
      projectId: project.id,
      today,
      reason: 'already dispatched today',
    };
  }

  // Derive next task.
  const picked = resolveNextTask({ readers, root: project, absPath: project.absPath });
  if (!picked.task) {
    return {
      kind: 'skipped',
      projectId: project.id,
      today,
      reason: picked.reason || 'nothing to do',
    };
  }

  // Write files atomically: prompt first, then run-record (record is the
  // skip-already-ran signal; if it lands we are committed). Use .tmp + rename
  // per PLAN.md R6 mitigation so a reader during write sees either the old
  // state or the new state, never a truncated file.
  fs.mkdirSync(runsDir, { recursive: true });
  const baseName = `${today}-${picked.task.id}`;
  const promptPath = path.join(runsDir, `${baseName}.prompt.md`);
  const recordPath = path.join(runsDir, `${baseName}.json`);

  const promptBody = buildPromptBody({
    projectId: project.id,
    taskId: picked.task.id,
    taskGoal: picked.task.goal,
    phaseId: picked.phaseId || '',
    nextAction: picked.nextAction,
    today,
  });

  // Path recorded in the stub is project-relative (posix slashes) so it is
  // stable across machines and renders cleanly on /my-projects.
  const relPromptFromProjectRoot = path
    .relative(project.absPath, promptPath)
    .replace(/\\/g, '/');

  const startedAt = toLocalIsoDateTime(now());
  const record = buildRunRecord({
    projectId: project.id,
    taskId: picked.task.id,
    startedAt,
    promptPath: relPromptFromProjectRoot,
  });

  // Prompt first.
  writeAtomic(fs, path, promptPath, promptBody);
  // Record second — its existence is the "handled today" marker.
  writeAtomic(fs, path, recordPath, JSON.stringify(record, null, 2) + '\n');

  // FOLLOW-UP (task 59-07a, todo 2026-04-17-subagent-real-dispatch-runtime.md):
  // Real dispatch integration lands here. Replace the prompt-emit with:
  //
  //   const { scopedSpawn } = require('./scoped-spawn.cjs');
  //   const child = await scopedSpawn({
  //     projectId: project.id,
  //     command: runtimeCmd,         // e.g. 'claude-code'
  //     args: ['--prompt-file', promptPath, '--report-back', recordPath],
  //   });
  //   // wire child.on('exit') → update the run-record to status=done|failed,
  //   // populate reportBody/teachingTipId/nextTaskId from parsed report block.
  //
  // Until then we stop at prompt-emit and the operator (or future automation)
  // takes it from here.

  return {
    kind: 'dispatched',
    projectId: project.id,
    today,
    taskId: picked.task.id,
    promptPath,
    recordPath,
  };
}

/**
 * Write a file atomically via <path>.tmp + rename, so readers under
 * apps/planning-app/ (59-04/59-09) never observe a truncated JSON file.
 *
 * @param {typeof import('fs')} fs
 * @param {typeof import('path')} path
 * @param {string} dest
 * @param {string} body
 */
function writeAtomic(fs, path, dest, body) {
  const tmp = dest + '.tmp';
  fs.writeFileSync(tmp, body, 'utf8');
  fs.renameSync(tmp, dest);
}

// ---------------------------------------------------------------------------
// Top-level dispatcher — reads config, filters, dispatches each.
// ---------------------------------------------------------------------------

/**
 * @param {{ fs?: typeof import('fs'), path?: typeof import('path'), now?: () => number, readers?: { readTasks: Function, readState: Function } }} [deps]
 */
function createDispatcher(deps = {}) {
  const fs = deps.fs || fsReal;
  const path = deps.path || pathReal;
  const now = deps.now || (() => Date.now());
  let readers = deps.readers;
  function getReaders() {
    if (readers) return readers;
    readers = {
      readTasks: require('./task-registry-reader.cjs').readTasks,
      readState: require('./state-reader.cjs').readState,
    };
    return readers;
  }

  /**
   * List projects from gad-config.toml that carry `dailySubagent = true`
   * and whose resolved .planning directory exists on disk. Missing .planning
   * dirs are skipped (not an error — the project may be a stub entry).
   *
   * @param {string} baseDir — monorepo root (dir containing gad-config.toml)
   * @param {{ projectId?: string }} [filter] — scope to a single project id
   * @returns {Array<{ id: string, absPath: string, planningDir: string }>}
   */
  function listDailyProjects(baseDir, filter = {}) {
    const tomlPath = path.join(baseDir, 'gad-config.toml');
    if (!fs.existsSync(tomlPath)) return [];
    const text = fs.readFileSync(tomlPath, 'utf8');
    const rows = parsePlanningRoots(text);
    const out = [];
    for (const r of rows) {
      if (!r.dailySubagent) continue;
      if (filter.projectId && r.id !== filter.projectId) continue;
      const normalized = r.path.replace(/\\/g, '/');
      const abs = path.isAbsolute(normalized)
        ? path.resolve(normalized)
        : path.join(baseDir, normalized);
      const planningAbs = path.join(abs, r.planningDir);
      if (!fs.existsSync(planningAbs)) continue;
      out.push({ id: r.id, absPath: abs, planningDir: r.planningDir });
    }
    return out;
  }

  /**
   * Run dispatchOne for every daily-subagent project. Produces a per-project
   * outcome array and prints human-readable lines to stderr (so stdout stays
   * machine-parseable for callers that want JSON).
   *
   * @param {{ baseDir: string, projectId?: string, stdout?: NodeJS.WritableStream, stderr?: NodeJS.WritableStream }} opts
   * @returns {{ outcomes: DispatchOutcome[], exitCode: 0|1 }}
   */
  function dispatchAll({ baseDir, projectId, stdout, stderr }) {
    const log = (msg) => (stderr || process.stderr).write(`${msg}\n`);
    const print = (msg) => (stdout || process.stdout).write(`${msg}\n`);

    let projects;
    try {
      projects = listDailyProjects(baseDir, { projectId });
    } catch (err) {
      log(`gad subagents dispatch: config parse failed — ${err.message}`);
      return { outcomes: [], exitCode: 1 };
    }

    if (projects.length === 0) {
      if (projectId) {
        log(`gad subagents dispatch: project "${projectId}" is not flagged dailySubagent=true or has no .planning/`);
      } else {
        log('gad subagents dispatch: no daily-subagent projects configured (add `dailySubagent = true` to a [[planning.roots]] entry).');
      }
      return { outcomes: [], exitCode: 0 };
    }

    const outcomes = [];
    const theReaders = getReaders();
    for (const project of projects) {
      let outcome;
      try {
        outcome = dispatchOne({ project, now, fs, path, readers: theReaders });
      } catch (err) {
        outcome = {
          kind: 'error',
          projectId: project.id,
          today: toLocalIsoDate(now()),
          reason: err && err.message ? err.message : String(err),
        };
      }
      outcomes.push(outcome);
      if (outcome.kind === 'dispatched') {
        log(`gad subagents dispatch: ${outcome.projectId} — dispatched ${outcome.taskId}`);
        print(outcome.promptPath);
      } else if (outcome.kind === 'skipped') {
        log(`gad subagents dispatch: ${outcome.projectId} — skipped (${outcome.reason})`);
      } else {
        log(`gad subagents dispatch: ${outcome.projectId} — error (${outcome.reason})`);
      }
    }
    // An error in one project does NOT tank the run — we still want other
    // projects dispatched. Exit 1 only if every project errored.
    const anyOk = outcomes.some((o) => o.kind !== 'error');
    return { outcomes, exitCode: anyOk ? 0 : 1 };
  }

  /**
   * List today's subagent-run artifacts across all configured daily projects.
   * Returns [{ projectId, taskId, date, status, promptPath, jsonPath,
   *            endedAt, startedAt, runId }].
   *
   * Used by `gad subagents status` + startup's DAILY SUBAGENTS section.
   */
  function listTodaysRuns({ baseDir, date }) {
    const today = date || toLocalIsoDate(now());
    const projects = listDailyProjects(baseDir);
    const out = [];
    for (const project of projects) {
      const runsDir = path.join(project.absPath, '.planning', 'subagent-runs', project.id);
      if (!fs.existsSync(runsDir)) continue;
      let files;
      try { files = fs.readdirSync(runsDir); } catch { continue; }
      for (const file of files) {
        if (!file.startsWith(today)) continue;
        if (!file.endsWith('.json')) continue;
        const full = path.join(runsDir, file);
        let data;
        try {
          data = JSON.parse(fs.readFileSync(full, 'utf8'));
        } catch { continue; }
        out.push({
          projectId: data.projectId || project.id,
          taskId: data.taskId || null,
          date: today,
          status: data.status || 'unknown',
          promptPath: data.promptPath || null,
          jsonPath: path.relative(baseDir, full),
          runId: data.runId || null,
          startedAt: data.startedAt || null,
          endedAt: data.endedAt || null,
        });
      }
    }
    return out;
  }

  /**
   * Mark a subagent run as completed. Updates the JSON record in place,
   * sets status="completed" and endedAt=now if not already set. Optionally
   * records the commit sha that landed the work.
   *
   * Finds the run by (projectId, date, taskId?). If taskId omitted, marks
   * the single non-completed run for today in that project; errors if
   * multiple candidates.
   */
  function markCompleted({ baseDir, projectId, date, taskId, commit }) {
    const today = date || toLocalIsoDate(now());
    const allToday = listTodaysRuns({ baseDir, date: today });
    const forProject = allToday.filter((r) => r.projectId === projectId);
    if (forProject.length === 0) {
      throw new Error(`No subagent runs found for project=${projectId} on ${today}`);
    }
    let candidates = forProject;
    if (taskId) {
      candidates = forProject.filter((r) => r.taskId === taskId);
      if (candidates.length === 0) {
        throw new Error(`No subagent run for project=${projectId} task=${taskId} on ${today}`);
      }
    } else {
      const unfinished = forProject.filter((r) => r.status !== 'completed');
      if (unfinished.length === 1) {
        candidates = unfinished;
      } else if (unfinished.length === 0) {
        throw new Error(`All subagent runs for project=${projectId} on ${today} are already completed`);
      } else {
        const ids = unfinished.map((r) => r.taskId).join(', ');
        throw new Error(`Multiple unfinished runs for project=${projectId} on ${today}: pass --task-id (${ids})`);
      }
    }

    const updated = [];
    for (const c of candidates) {
      const full = path.join(baseDir, c.jsonPath);
      let data;
      try {
        data = JSON.parse(fs.readFileSync(full, 'utf8'));
      } catch (err) {
        throw new Error(`Could not read run record at ${c.jsonPath}: ${err.message}`);
      }
      data.status = 'completed';
      if (!data.endedAt) data.endedAt = toLocalIsoDateTime(now());
      if (commit) data.commit = commit;
      fs.writeFileSync(full, JSON.stringify(data, null, 2) + '\n');
      updated.push({ ...c, status: 'completed', endedAt: data.endedAt, commit: data.commit || null });
    }
    return updated;
  }

  return {
    listDailyProjects,
    dispatchOne: (project) => dispatchOne({ project, now, fs, path, readers: getReaders() }),
    dispatchAll,
    listTodaysRuns: (opts) => listTodaysRuns(opts || {}),
    markCompleted,
  };
}

// Default instance bound to real deps. CLI uses this; tests construct their
// own via createDispatcher with injected fs/readers/now.
const _default = createDispatcher();

module.exports = {
  createDispatcher,
  // Convenience wrappers bound to real deps:
  listDailyProjects: (baseDir, filter) => _default.listDailyProjects(baseDir, filter),
  dispatchAll: (opts) => _default.dispatchAll(opts),
  listTodaysRuns: (opts) => _default.listTodaysRuns(opts || {}),
  markCompleted: (opts) => _default.markCompleted(opts || {}),
  // Pure helpers re-exported for tests + callers:
  parsePlanningRoots,
  toLocalIsoDate,
  toLocalIsoDateTime,
  buildRunRecord,
  buildPromptBody,
  resolveNextTask,
  DEFAULT_DAILY_FLAG_KEY,
};
