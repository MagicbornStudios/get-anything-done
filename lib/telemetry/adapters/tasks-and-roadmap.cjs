'use strict';
/**
 * Phase 145.5 (training-data-adapters-v2) — task 145.5-04.
 *
 * Adapter H: tasks-and-roadmap.
 *
 * Sources (per planning root — host monorepo + vendor/get-anything-done
 * submodule are walked):
 *   - <root>/.planning/tasks/*.json                 → role=prompt
 *     (one envelope per task; goal+acceptance text, full task meta).
 *   - <root>/.planning/ROADMAP.xml                  → role=meta
 *     (one envelope per <phase> entry; description + meta block).
 *   - <root>/.planning/phases/<n>-<slug>/PLAN.md    → role=meta
 *     (one envelope per plan; first 8KB of plan markdown, truncated).
 *
 * Project derivation: each planning root maps to a project id —
 *   <rootDir>/.planning/             → 'global'
 *   <rootDir>/vendor/get-anything-done/.planning/ → 'get-anything-done'
 * Tasks with prefixed canonical IDs (e.g. SLM-LEARNING-T-…) override
 * the root-derived project from the prefix.
 *
 * Filtering: rows older than sinceMs are skipped. ts is sourced from
 *   - task.stamped_at OR task.completed_at OR task.updated_at OR
 *     task.created_at OR file mtime.
 *
 * Idempotent: ids are derived from
 *   `task|<project>|<task.id>`         for task prompts
 *   `phase|<project>|<phase-id>`       for ROADMAP phase metas
 *   `phase-plan|<project>|<phase-id>`  for phase PLAN.md metas
 * Re-export of unchanged sources yields identical envelopes.
 *
 * Reference: lib/telemetry/envelope.cjs (DO NOT MODIFY).
 */

const fs = require('fs');
const path = require('path');

const {
  validateEnvelope,
  deriveEnvelopeId,
  makeEnvelope,
  makeRunId,
  VALID_RUNTIMES,
} = require('../envelope.cjs');

const SOURCE_TAG = 'tasks-and-roadmap';
const PLAN_TEXT_CAP_BYTES = 8 * 1024; // 8 KB hard cap per plan envelope.

// Planning roots to walk. Each entry yields `<rootDir>/<rel>/.planning/`.
// Order is deterministic so envelope seq numbers stay stable across runs.
const PLANNING_ROOTS = [
  { rel: '', project: 'global' },
  { rel: 'vendor/get-anything-done', project: 'get-anything-done' },
];

// Prefix-based project override. If task.id matches `<PREFIX>-T-...` or
// `<prefix>-...`, we honour that prefix over the root-derived project.
const PROJECT_PREFIX_MAP = {
  'GLOBAL':         'global',
  'GET-ANYTHING-DONE': 'get-anything-done',
  'SLM-LEARNING':   'slm-learning',
  'GRIME-TIME':     'grime-time',
  'MB-CLI-FRAMEWORK': 'mb-cli-framework',
  'MAGICBORN':      'magicborn',
  'MAGICBORN-NARRATIVE': 'magicborn-narrative',
  'APP-FORGE':      'app-forge',
  'PROJECT-EDITOR': 'project-editor',
  'CLAW-CLI':       'claw-cli',
  '7GREENS':        '7greens',
};

function deriveProjectFromTaskId(taskId, fallback) {
  if (typeof taskId !== 'string' || !taskId) return fallback;
  // Match either `PROJECT-T-…` (canonical) or lowercase `project-…`
  // (legacy). Both forms appear in the corpus.
  const canon = taskId.match(/^([A-Z][A-Z0-9-]*)-T-/);
  if (canon) {
    const key = canon[1];
    if (PROJECT_PREFIX_MAP[key]) return PROJECT_PREFIX_MAP[key];
  }
  const legacy = taskId.match(/^([a-z][a-z0-9-]*?)-\d/);
  if (legacy) {
    const key = legacy[1].toUpperCase();
    if (PROJECT_PREFIX_MAP[key]) return PROJECT_PREFIX_MAP[key];
  }
  return fallback;
}

function pickTimestamp(task, fallbackIso) {
  for (const k of ['stamped_at', 'completed_at', 'updated_at', 'created_at']) {
    if (typeof task[k] === 'string' && task[k]) return task[k];
  }
  return fallbackIso;
}

function pickRuntime(task) {
  const r = task && typeof task.runtime === 'string' ? task.runtime : '';
  return VALID_RUNTIMES.has(r) ? r : 'gad-cli';
}

function joinTaskText(task) {
  // The task JSON schema doesn't have a separate `acceptance` field —
  // the goal often packs it in. Concatenate any present descriptive
  // fields we know about so the prompt envelope text is the operator-
  // facing prompt as-written.
  const parts = [];
  if (task && typeof task.goal === 'string' && task.goal) parts.push(task.goal);
  if (task && typeof task.acceptance === 'string' && task.acceptance) {
    parts.push(`\n\nAcceptance:\n${task.acceptance}`);
  }
  return parts.join('') || '(no goal text)';
}

function buildTaskMeta(task) {
  // Subset of task JSON we keep on the envelope content — stable
  // training-relevant fields, drop transient claim/lease state.
  const m = {};
  for (const k of ['id', 'phase', 'status', 'skill', 'agent_id', 'runtime', 'keywords', 'depends', 'commands', 'files', 'type']) {
    if (task[k] !== undefined && task[k] !== '' && !(Array.isArray(task[k]) && task[k].length === 0)) {
      m[k] = task[k];
    }
  }
  return m;
}

/**
 * Yield one prompt envelope per task JSON file under <rootDir>/<rel>/.planning/tasks/.
 */
async function* iterTasksForRoot(rootDir, rootEntry, sinceMs) {
  const tasksDir = path.join(rootDir, rootEntry.rel, '.planning', 'tasks');
  let entries;
  try {
    entries = fs.readdirSync(tasksDir, { withFileTypes: true });
  } catch (err) {
    if (err && err.code === 'ENOENT') return;
    process.stderr.write(`[tasks-and-roadmap] readdir ${tasksDir}: ${err.message}\n`);
    return;
  }
  // Sort for deterministic envelope order.
  const files = entries
    .filter((e) => e.isFile() && e.name.endsWith('.json'))
    .map((e) => e.name)
    .sort();

  let seq = 0;
  for (const fname of files) {
    seq += 1;
    const fpath = path.join(tasksDir, fname);
    let st;
    try {
      st = fs.statSync(fpath);
    } catch (err) {
      process.stderr.write(`[tasks-and-roadmap] stat ${fpath}: ${err.message}\n`);
      continue;
    }
    let raw;
    try {
      raw = fs.readFileSync(fpath, 'utf8');
    } catch (err) {
      process.stderr.write(`[tasks-and-roadmap] read ${fpath}: ${err.message}\n`);
      continue;
    }
    let task;
    try {
      task = JSON.parse(raw);
    } catch (err) {
      process.stderr.write(`[tasks-and-roadmap] parse ${fname}: ${err.message}\n`);
      continue;
    }
    if (!task || typeof task !== 'object' || typeof task.id !== 'string' || !task.id) {
      process.stderr.write(`[tasks-and-roadmap] ${fname}: missing id\n`);
      continue;
    }

    const fallbackIso = new Date(st.mtimeMs).toISOString();
    const tsRaw = pickTimestamp(task, fallbackIso);
    const ts = (() => {
      const t = Date.parse(tsRaw);
      return Number.isFinite(t) ? new Date(t).toISOString() : fallbackIso;
    })();
    if (sinceMs > 0 && Date.parse(ts) < sinceMs) continue;

    const project = deriveProjectFromTaskId(task.id, rootEntry.project);
    const runtime = pickRuntime(task);
    const id = deriveEnvelopeId(`task|${project}|${task.id}`);
    const content = {
      kind: 'task_prompt',
      text: joinTaskText(task),
      task_meta: buildTaskMeta(task),
    };

    let env;
    try {
      env = makeEnvelope({
        id,
        ts,
        run_id: makeRunId(runtime, `task-${task.id}`, ts),
        project,
        runtime,
        role: 'prompt',
        content,
        seq: 1, // one envelope per task file; per-file rather than per-stream
        task_id: task.id,
        agent_id: typeof task.agent_id === 'string' && task.agent_id ? task.agent_id : null,
        content_type: 'planning',
      });
    } catch (err) {
      process.stderr.write(`[tasks-and-roadmap] makeEnvelope ${task.id}: ${err.message}\n`);
      continue;
    }
    const v = validateEnvelope(env);
    if (!v.ok) {
      process.stderr.write(`[tasks-and-roadmap] invalid envelope ${task.id}: ${v.errors.join('; ')}\n`);
      continue;
    }
    yield env;
  }
}

/**
 * Tiny non-validating XML parser for the ROADMAP.xml shape we own:
 *   <phase id="14">
 *     <title>...</title>
 *     <goal>...</goal>
 *     <status>...</status>
 *     <depends>...</depends>
 *     <milestone>...</milestone>?
 *     <slug>...</slug>?
 *   </phase>
 *
 * Returns Array<{ id, title, goal, status, depends, milestone, slug }>.
 */
function parsePhases(xml) {
  const out = [];
  if (typeof xml !== 'string') return out;
  // Match each <phase id="..."> ... </phase> block.
  const phaseRe = /<phase\s+id="([^"]+)"[^>]*>([\s\S]*?)<\/phase>/g;
  let m;
  while ((m = phaseRe.exec(xml)) !== null) {
    const id = m[1];
    const body = m[2];
    const grab = (tag) => {
      const r = new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`);
      const mm = body.match(r);
      return mm ? decodeXmlEntities(mm[1].trim()) : '';
    };
    out.push({
      id,
      title: grab('title'),
      goal: grab('goal'),
      status: grab('status'),
      depends: grab('depends'),
      milestone: grab('milestone'),
      slug: grab('slug'),
    });
  }
  return out;
}

function decodeXmlEntities(s) {
  return s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&');
}

async function* iterRoadmapForRoot(rootDir, rootEntry, sinceMs) {
  const xmlPath = path.join(rootDir, rootEntry.rel, '.planning', 'ROADMAP.xml');
  let st;
  try {
    st = fs.statSync(xmlPath);
  } catch (err) {
    if (err && err.code === 'ENOENT') return;
    process.stderr.write(`[tasks-and-roadmap] stat ${xmlPath}: ${err.message}\n`);
    return;
  }
  const ts = new Date(st.mtimeMs).toISOString();
  if (sinceMs > 0 && st.mtimeMs < sinceMs) return;

  let xml;
  try {
    xml = fs.readFileSync(xmlPath, 'utf8');
  } catch (err) {
    process.stderr.write(`[tasks-and-roadmap] read ${xmlPath}: ${err.message}\n`);
    return;
  }
  const phases = parsePhases(xml);
  for (const ph of phases) {
    const id = deriveEnvelopeId(`phase|${rootEntry.project}|${ph.id}`);
    const content = {
      kind: 'phase_definition',
      text: ph.goal || ph.title || `phase ${ph.id}`,
      meta: {
        id: ph.id,
        title: ph.title || null,
        status: ph.status || null,
        slug: ph.slug || null,
        milestone: ph.milestone || null,
        deps: ph.depends ? ph.depends.split(',').map((s) => s.trim()).filter(Boolean) : [],
      },
    };
    let env;
    try {
      env = makeEnvelope({
        id,
        ts,
        run_id: makeRunId('gad-cli', `phase-${ph.id}`, ts),
        project: rootEntry.project,
        runtime: 'gad-cli',
        role: 'meta',
        content,
        seq: 1,
        content_type: 'planning',
      });
    } catch (err) {
      process.stderr.write(`[tasks-and-roadmap] makeEnvelope phase ${ph.id}: ${err.message}\n`);
      continue;
    }
    const v = validateEnvelope(env);
    if (!v.ok) {
      process.stderr.write(`[tasks-and-roadmap] invalid envelope phase ${ph.id}: ${v.errors.join('; ')}\n`);
      continue;
    }
    yield env;
  }
}

/**
 * Recursively list every PLAN.md under <rootDir>/<rel>/.planning/phases/.
 * Phase directory names are like `145-slm-training-data-collection-v1`,
 * `145.5-training-data-adapters-v2`, etc. We walk one level deep
 * primarily but recurse into nested phase dirs since the corpus has
 * mixed nesting.
 */
function listPlanFiles(phasesDir) {
  const out = [];
  let entries;
  try {
    entries = fs.readdirSync(phasesDir, { withFileTypes: true });
  } catch (_) {
    return out;
  }
  for (const ent of entries) {
    const full = path.join(phasesDir, ent.name);
    if (ent.isFile() && ent.name === 'PLAN.md') {
      // PLAN.md sometimes lives directly under .planning/phases/
      // (the section-level plan); attribute to phase id 'section'.
      out.push({ phaseId: 'section', planPath: full });
      continue;
    }
    if (!ent.isDirectory()) continue;
    // Phase id is the leading numeric segment of the dir name.
    const idMatch = ent.name.match(/^(\d+(?:\.\d+)?)/);
    const phaseId = idMatch ? idMatch[1] : ent.name;
    const planPath = path.join(full, 'PLAN.md');
    if (fs.existsSync(planPath)) {
      out.push({ phaseId, planPath });
    }
    // Walk one level deeper for occasional nested layouts.
    let sub;
    try {
      sub = fs.readdirSync(full, { withFileTypes: true });
    } catch (_) {
      continue;
    }
    for (const s of sub) {
      if (!s.isDirectory()) continue;
      const subPlan = path.join(full, s.name, 'PLAN.md');
      if (fs.existsSync(subPlan)) {
        const subId = s.name.match(/^(\d+(?:\.\d+)?)/);
        out.push({ phaseId: subId ? subId[1] : `${phaseId}/${s.name}`, planPath: subPlan });
      }
    }
  }
  // Stable order.
  out.sort((a, b) => a.planPath.localeCompare(b.planPath));
  return out;
}

async function* iterPhasePlansForRoot(rootDir, rootEntry, sinceMs) {
  const phasesDir = path.join(rootDir, rootEntry.rel, '.planning', 'phases');
  const plans = listPlanFiles(phasesDir);
  for (const { phaseId, planPath } of plans) {
    let st;
    try {
      st = fs.statSync(planPath);
    } catch (err) {
      process.stderr.write(`[tasks-and-roadmap] stat ${planPath}: ${err.message}\n`);
      continue;
    }
    if (sinceMs > 0 && st.mtimeMs < sinceMs) continue;
    const ts = new Date(st.mtimeMs).toISOString();

    let raw;
    try {
      raw = fs.readFileSync(planPath, 'utf8');
    } catch (err) {
      process.stderr.write(`[tasks-and-roadmap] read ${planPath}: ${err.message}\n`);
      continue;
    }
    let truncated = false;
    let text = raw;
    // 8KB hard cap measured in bytes (utf8). Use Buffer to avoid
    // counting code units.
    const buf = Buffer.from(raw, 'utf8');
    if (buf.length > PLAN_TEXT_CAP_BYTES) {
      text = buf.slice(0, PLAN_TEXT_CAP_BYTES).toString('utf8');
      truncated = true;
    }

    const id = deriveEnvelopeId(`phase-plan|${rootEntry.project}|${phaseId}`);
    const content = {
      kind: 'phase_plan',
      text,
      truncated,
      phase_id: phaseId,
      source_file: path.relative(rootDir, planPath).replace(/\\/g, '/'),
    };
    let env;
    try {
      env = makeEnvelope({
        id,
        ts,
        run_id: makeRunId('gad-cli', `phase-plan-${phaseId}`, ts),
        project: rootEntry.project,
        runtime: 'gad-cli',
        role: 'meta',
        content,
        seq: 1,
        content_type: 'planning',
      });
    } catch (err) {
      process.stderr.write(`[tasks-and-roadmap] makeEnvelope phase-plan ${phaseId}: ${err.message}\n`);
      continue;
    }
    const v = validateEnvelope(env);
    if (!v.ok) {
      process.stderr.write(`[tasks-and-roadmap] invalid envelope phase-plan ${phaseId}: ${v.errors.join('; ')}\n`);
      continue;
    }
    yield env;
  }
}

/**
 * Top-level async generator. Walks each planning root in PLANNING_ROOTS
 * and yields tasks → roadmap phases → phase plans, in that order.
 *
 * @param {string} rootDir   monorepo root (the dir containing .planning/)
 * @param {number} sinceMs   epoch ms; envelopes whose ts < sinceMs are skipped
 */
async function* iterEnvelopes(rootDir, sinceMs = 0) {
  for (const rootEntry of PLANNING_ROOTS) {
    yield* iterTasksForRoot(rootDir, rootEntry, sinceMs);
    yield* iterRoadmapForRoot(rootDir, rootEntry, sinceMs);
    yield* iterPhasePlansForRoot(rootDir, rootEntry, sinceMs);
  }
}

module.exports = {
  iterEnvelopes,
  // exposed for testing only
  _internals: {
    parsePhases,
    decodeXmlEntities,
    deriveProjectFromTaskId,
    pickTimestamp,
    pickRuntime,
    joinTaskText,
    buildTaskMeta,
    listPlanFiles,
    PLANNING_ROOTS,
    PLAN_TEXT_CAP_BYTES,
    SOURCE_TAG,
  },
};
