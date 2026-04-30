#!/usr/bin/env node

/**
 * GAD Tools — CLI utility for GAD workflow operations
 *
 * Replaces gsd-tools.cjs for GAD workflows. Reads XML planning files.
 * Usage: node gad-tools.cjs <command> [args] [--raw] [--pick <field>]
 *
 * Commands (alphabetical):
 *   agent-skills <agent-type>              Get agent skill/prompt content
 *   audit-uat [--raw]                      Summarize UAT debt across phases
 *   commit <message> --files f1 f2         Commit planning docs (git add + commit)
 *   commit-to-subrepo <msg> --files …      Commit to sub-repo (falls through to commit)
 *   config-ensure-section <section>        Ensure gad-config.toml section exists
 *   config-get <key>                       Read from gad-config.toml / compat config.json
 *   config-new-project '<json>'            Write full project config from JSON blob
 *   config-set <key> <value>               Write gad-config.toml and regenerate compat JSON
 *   current-timestamp [format]             Get timestamp (date|filename|full)
 *   docs-init                              Initialize .planning/docs/ scaffold
 *   find-phase <phase>                     Find phase directory path
 *   frontmatter get <file> --field <f>     Extract YAML frontmatter field
 *   generate-claude-md                     Write/refresh CLAUDE.md for current project
 *   generate-claude-profile …              (stub) Generate agent-specific CLAUDE profile
 *   generate-dev-preferences               (stub) Write gad dev preferences file
 *   generate-slug <text>                   Convert text to URL-safe slug
 *   init <subcommand> [args]               Initialize context for a workflow
 *     init new-project                     Project-level init context (JSON)
 *     init execute-phase <phase>           Execute-phase context (JSON)
 *     init plan-phase <phase>              Plan-phase context (JSON)
 *     init phase-op <phase>                Phase operation context (JSON)
 *     init milestone-op                    Milestone operation context (JSON)
 *     init new-milestone                   New-milestone context (JSON)
 *     init map-codebase                    Map-codebase context (JSON)
 *     init progress                        Progress context (JSON)
 *     init quick [description]             Quick-task context (JSON)
 *     init todos                           Todos context (JSON)
 *     init manager                         Manager context (JSON)
 *     init list-workspaces                 List-workspaces context (JSON)
 *     init new-workspace                   New-workspace context (JSON)
 *     init remove-workspace <name>         Remove-workspace context (JSON)
 *     init verify-work <phase>             Verify-work context (JSON)
 *   milestone complete <version> --name …  Archive milestone
 *   phase add <description>                Add phase to roadmap
 *   phase complete <phase>                 Mark phase done in ROADMAP.xml
 *   phase-plan-index <phase>               List plans in a phase directory
 *   phases list [--type summaries] [--raw] List phases (or phase dirs)
 *   profile-questionnaire --answers … --json  (stub) Analyze profiling answers
 *   profile-sample                         (stub) Return profile sample answers
 *   progress bar [--raw]                   Render compact progress bar
 *   requirements mark-complete <REQ-IDs…>  Mark requirements done in REQUIREMENTS.md
 *   resolve-model <agent-type> [--raw]     Resolve model alias for an agent type
 *   roadmap analyze                        Full roadmap parse (JSON array)
 *   roadmap get-phase <phase>              Extract single phase from ROADMAP.xml
 *   roadmap update-plan-progress …        (stub) Update plan progress in roadmap
 *   scan-sessions [--json]                 Scan .planning/sessions/ files
 *   scaffold phase-dir --phase N --name S  Create phase directory
 *   scaffold context --phase N             Create CONTEXT.md template
 *   state add-blocker <text>               Append blocker to STATE.xml
 *   state add-decision <text>              Append decision to STATE.xml
 *   state advance-plan <phase> <plan>      Advance plan pointer in STATE.xml
 *   state begin-phase <phase>              Set current-phase in STATE.xml
 *   state json                             Print STATE.xml as JSON
 *   state load                             Load project state from STATE.xml
 *   state record-metric <key> <value>      Record metric in STATE.xml
 *   state record-session                   Update session info in STATE.xml
 *   state update <field> <value>           Update STATE.xml field
 *   state update-progress <text>           Append progress note to STATE.xml
 *   state-snapshot                         Alias for `state json`
 *   summary-extract <path> --fields …      Extract fields from SUMMARY.md frontmatter
 *   todo match-phase <phase>               List todos tagged for a phase
 *   uat render-checkpoint --file … --raw   (stub) Render UAT checkpoint section
 *   validate health [--repair]             Check planning file integrity
 *   verify artifacts <plan-file>           Check plan file has required artifact sections
 *   verify key-links <plan-file>           Check plan file markdown links resolve
 *   verify schema-drift <phase>            (stub) Check schema drift in phase artifacts
 *   workstream                             (stub) Workstream command — returns empty
 *   write-profile --input … --json        (stub) Write user profile from analysis
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { resolveWorkflowModels, resolveAgentModel, getAgentToModelMapForProfile, normalizeProfile, VALID_PROFILES } = require('../lib/model-profiles.cjs');
const gadConfig = require('./gad-config.cjs');

// ─── Helpers ─────────────────────────────────────────────────────────────────

function error(msg) {
  console.error(`Error: ${msg}`);
  process.exit(1);
}

/** Stub: emit message but exit 0 so workflows continue */
function stub(verb) {
  console.error(`gad-tools ${verb}: not yet fully implemented — tracked at vendor/get-anything-done/.planning/tasks/73-01.json`);
}

function findProjectRoot(startDir) {
  let dir = startDir;
  while (dir !== path.dirname(dir)) {
    if (fs.existsSync(path.join(dir, '.planning'))) return dir;
    dir = path.dirname(dir);
  }
  return startDir;
}

function parseNamedArgs(args, valueFlags = [], booleanFlags = []) {
  const result = {};
  for (const flag of valueFlags) {
    const idx = args.indexOf(`--${flag}`);
    result[flag] = idx !== -1 && args[idx + 1] !== undefined && !args[idx + 1].startsWith('--')
      ? args[idx + 1] : null;
  }
  for (const flag of booleanFlags) {
    result[flag] = args.includes(`--${flag}`);
  }
  return result;
}

function collectAfterFlag(args, flag) {
  const idx = args.indexOf(`--${flag}`);
  if (idx === -1) return [];
  const tokens = [];
  for (let i = idx + 1; i < args.length; i++) {
    if (args[i].startsWith('--')) break;
    tokens.push(args[i]);
  }
  return tokens;
}

function generateSlug(text) {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60);
}

function timestamp(format) {
  const now = new Date();
  if (format === 'date') return now.toISOString().split('T')[0];
  if (format === 'filename') return now.toISOString().replace(/[:.]/g, '-').slice(0, 19);
  return now.toISOString();
}

// ─── XML Readers ─────────────────────────────────────────────────────────────

function readXml(filePath) {
  if (!fs.existsSync(filePath)) return null;
  return fs.readFileSync(filePath, 'utf8');
}

function parseStateXml(content) {
  if (!content) return {};
  const get = (tag) => {
    const m = content.match(new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`));
    return m ? m[1].trim() : '';
  };
  return {
    currentPhase: get('current-phase'),
    currentPlan: get('current-plan'),
    milestone: get('milestone'),
    status: get('status'),
    nextAction: get('next-action'),
    lastUpdated: get('last-updated'),
  };
}

function parseRoadmapXml(content) {
  if (!content) return [];
  const phases = [];
  const phaseRe = /<phase\s+id="([^"]*)">([\s\S]*?)<\/phase>/g;
  let m;
  while ((m = phaseRe.exec(content)) !== null) {
    const inner = m[2];
    const get = (tag) => {
      const r = inner.match(new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`));
      return r ? r[1].trim() : '';
    };
    phases.push({
      id: m[1],
      title: get('title'),
      goal: get('goal'),
      status: get('status'),
      depends: get('depends'),
    });
  }
  return phases;
}

function parseTasksXml(content) {
  if (!content) return [];
  const tasks = [];
  const taskRe = /<task\s+([^>]*)>([\s\S]*?)<\/task>/g;
  let m;
  while ((m = taskRe.exec(content)) !== null) {
    const attrs = m[1];
    const inner = m[2];
    const id = (attrs.match(/id="([^"]*)"/) || [])[1] || '';
    const status = (attrs.match(/status="([^"]*)"/) || [])[1] || '';
    const agentId = (attrs.match(/agent-id="([^"]*)"/) || [])[1] || '';
    const goalMatch = inner.match(/<goal>([\s\S]*?)<\/goal>/);
    tasks.push({ id, status, agentId, goal: goalMatch ? goalMatch[1].trim() : '' });
  }
  return tasks;
}

// ─── Config ──────────────────────────────────────────────────────────────────

function loadConfig(cwd) {
  const loaded = gadConfig.load(cwd);
  try { gadConfig.writeCompatJson(cwd, loaded); } catch {}
  return loaded;
}

function saveConfig(cwd, config) {
  try { gadConfig.writeToml(cwd, config); } catch {}
  // Always write config.json directly to preserve arbitrary keys that TOML schema omits
  const compatPath = path.join(cwd, '.planning', 'config.json');
  fs.mkdirSync(path.join(cwd, '.planning'), { recursive: true });
  // Merge with existing to preserve keys we don't write
  let existing = {};
  try {
    if (fs.existsSync(compatPath)) existing = JSON.parse(fs.readFileSync(compatPath, 'utf8'));
  } catch {}
  const merged = { ...existing, ...config };
  fs.writeFileSync(compatPath, JSON.stringify(merged, null, 2) + '\n');
}

function configGet(cwd, key) {
  // Read config.json directly for arbitrary key support
  const compatPath = path.join(cwd, '.planning', 'config.json');
  if (!fs.existsSync(compatPath)) {
    console.error(`Error: No config.json found at ${compatPath}. Run config-ensure-section first.`);
    process.exit(1);
  }
  let config;
  try {
    config = JSON.parse(fs.readFileSync(compatPath, 'utf8'));
  } catch (e) {
    console.error(`Error: Failed to read config.json — ${e.message}`);
    process.exit(1);
  }
  const parts = key.split('.');
  let val = config;
  for (const p of parts) {
    if (val === null || typeof val !== 'object') {
      // Traversing through a non-object value
      return { __error: `Key not found: ${key}` };
    }
    if (!Object.prototype.hasOwnProperty.call(val, p)) {
      return undefined;
    }
    val = val[p];
  }
  return val;
}

function configGetOrExit(cwd, key) {
  const val = configGet(cwd, key);
  if (val === undefined) {
    console.error(`Error: Key not found: ${key}`);
    process.exit(1);
  }
  if (val && typeof val === 'object' && val.__error) {
    console.error(`Error: ${val.__error}`);
    process.exit(1);
  }
  return val;
}

// Known valid config keys (allowlist for validation)
const VALID_CONFIG_KEYS = new Set([
  'model_profile', 'commit_docs', 'parallelization', 'search_gitignored', 'brave_search',
  'firecrawl', 'exa_search', 'mode', 'granularity', 'context_window',
  'git.branching_strategy', 'git.phase_branch_template', 'git.milestone_branch_template',
  'git.quick_branch_template', 'git.base_branch',
  'workflow.research', 'workflow.plan_check', 'workflow.verifier', 'workflow.nyquist_validation',
  'workflow.auto_advance', 'workflow.node_repair', 'workflow.node_repair_budget',
  'workflow.ui_phase', 'workflow.ui_safety_gate', 'workflow.text_mode', 'workflow.use_worktrees',
  'workflow.research_before_questions', 'workflow.discuss_mode', 'workflow.skip_discuss',
  'workflow.security_enforcement', 'workflow.max_discuss_passes', 'workflow._auto_chain_active',
  'workflow.auto', 'workflow.node_repair_enabled',
  'hooks.context_warnings',
  'planning.docs_sink', 'planning.docs_sink_ignore', 'planning.ignore', 'planning.sprintSize',
  'planning.currentProfile', 'planning.conventionsPaths',
]);

// Key suggestions for common mistakes
const KEY_SUGGESTIONS = {
  'workflow.nyquist_validation_enabled': 'workflow.nyquist_validation',
  'workflow.plan-check': 'workflow.plan_check',
  'workflow.nyquist': 'workflow.nyquist_validation',
  'hooks.research_questions': 'workflow.research_before_questions',
  'workflow.research_questions': 'workflow.research_before_questions',
};

function configSet(cwd, key, value) {
  // Validate key
  if (!VALID_CONFIG_KEYS.has(key)) {
    const suggestion = KEY_SUGGESTIONS[key];
    const msg = suggestion
      ? `Unknown config key: ${key}\n  Did you mean: ${suggestion}`
      : `Unknown config key: ${key}`;
    console.error(`Error: ${msg}`);
    process.exit(1);
  }

  const compatPath = path.join(cwd, '.planning', 'config.json');
  let config = {};
  try {
    if (fs.existsSync(compatPath)) config = JSON.parse(fs.readFileSync(compatPath, 'utf8'));
  } catch {}

  const parts = key.split('.');
  let obj = config;
  for (let i = 0; i < parts.length - 1; i++) {
    if (!obj[parts[i]] || typeof obj[parts[i]] !== 'object') obj[parts[i]] = {};
    obj = obj[parts[i]];
  }
  if (value === 'true') value = true;
  else if (value === 'false') value = false;
  else if (!isNaN(value) && value !== '') value = Number(value);
  obj[parts[parts.length - 1]] = value;

  fs.mkdirSync(path.join(cwd, '.planning'), { recursive: true });
  fs.writeFileSync(compatPath, JSON.stringify(config, null, 2) + '\n');
  try { gadConfig.writeToml(cwd, config); } catch {}
}

// Default config shape materialized on every config-new-project call.
const CONFIG_NEW_PROJECT_DEFAULTS = {
  model_profile: 'balanced',
  commit_docs: true,
  parallelization: true,
  search_gitignored: false,
  brave_search: false,
  git: {
    branching_strategy: 'none',
    phase_branch_template: 'gsd/phase-{phase}-{slug}',
    milestone_branch_template: 'gsd/{milestone}-{slug}',
  },
  workflow: {
    research: true,
    plan_check: true,
    verifier: true,
    nyquist_validation: true,
    auto_advance: false,
    node_repair: true,
    node_repair_budget: 2,
    ui_phase: true,
    ui_safety_gate: true,
    research_before_questions: false,
    discuss_mode: 'discuss',
    skip_discuss: false,
  },
  hooks: {
    context_warnings: true,
  },
};

function deepMerge(base, override) {
  const result = Object.assign({}, base);
  for (const [k, v] of Object.entries(override)) {
    if (v !== null && typeof v === 'object' && !Array.isArray(v) &&
        result[k] !== null && typeof result[k] === 'object') {
      result[k] = deepMerge(result[k], v);
    } else {
      result[k] = v;
    }
  }
  return result;
}

function configNewProject(cwd, jsonBlob) {
  let parsed;
  try { parsed = JSON.parse(jsonBlob); } catch (e) {
    console.error(`Error: Invalid JSON — ${e.message}`);
    process.exit(1);
  }

  const planDir = path.join(cwd, '.planning');
  fs.mkdirSync(planDir, { recursive: true });
  const compatPath = path.join(planDir, 'config.json');

  // Idempotency check — if config already exists, return already_exists
  if (fs.existsSync(compatPath)) {
    try {
      const existing = JSON.parse(fs.readFileSync(compatPath, 'utf8'));
      if (existing._created_by === 'config-new-project') {
        console.log(JSON.stringify({ created: false, reason: 'already_exists', path: '.planning/config.json' }));
        return;
      }
    } catch {}
  }

  // Merge: defaults < user choices
  const merged = deepMerge(CONFIG_NEW_PROJECT_DEFAULTS, parsed);
  merged._created_by = 'config-new-project';

  // Write TOML + compat JSON
  try { gadConfig.writeToml(cwd, merged); } catch {}
  fs.writeFileSync(compatPath, JSON.stringify(merged, null, 2));

  console.log(JSON.stringify({ created: true, path: '.planning/config.json' }));
}

// ─── Phase Operations ────────────────────────────────────────────────────────

function findPhaseDir(cwd, phaseId) {
  const phasesDir = path.join(cwd, '.planning', 'phases');
  if (!fs.existsSync(phasesDir)) return null;
  const padded = String(phaseId).padStart(2, '0');
  const entries = fs.readdirSync(phasesDir);
  const match = entries.find(e => e.startsWith(padded + '-') || e === padded);
  return match ? path.join(phasesDir, match) : null;
}

function initPhaseOp(cwd, phaseId) {
  const planDir = path.join(cwd, '.planning');
  const roadmapContent = readXml(path.join(planDir, 'ROADMAP.xml'));
  const phases = parseRoadmapXml(roadmapContent);
  const phase = phases.find(p => p.id === phaseId || p.id === String(phaseId).padStart(2, '0'));
  const padded = String(phaseId).padStart(2, '0');
  const slug = phase ? generateSlug(phase.title) : 'unknown';
  const phaseDir = findPhaseDir(cwd, phaseId) || path.join(planDir, 'phases', `${padded}-${slug}`);

  const hasContext = fs.existsSync(path.join(phaseDir, `${padded}-CONTEXT.md`));
  const hasPlans = fs.existsSync(phaseDir) &&
    fs.readdirSync(phaseDir).some(f => f.endsWith('-PLAN.md') || f === 'PLAN.md');
  const planCount = hasPlans ?
    fs.readdirSync(phaseDir).filter(f => f.endsWith('-PLAN.md') || f === 'PLAN.md').length : 0;
  const config = loadConfig(cwd);
  const workflowModels = resolveWorkflowModels(config, 'claude');

  return {
    phase_found: !!phase,
    phase_number: phaseId,
    phase_name: phase ? phase.title : '',
    phase_slug: slug,
    padded_phase: padded,
    phase_dir: phaseDir,
    has_context: hasContext,
    has_plans: hasPlans,
    plan_count: planCount,
    has_research: fs.existsSync(path.join(phaseDir, `${padded}-RESEARCH.md`)),
    has_verification: fs.existsSync(path.join(phaseDir, `${padded}-VERIFICATION.md`)),
    roadmap_exists: !!roadmapContent,
    planning_exists: fs.existsSync(planDir),
    research_enabled: config.workflow?.research !== false,
    model_overrides: config.model_overrides || {},
    commit_docs: config.commit_docs !== false,
    ...workflowModels,
  };
}

function initNewProject(cwd) {
  const planDir = path.join(cwd, '.planning');
  const hasPlanning = fs.existsSync(planDir);
  const hasProject = fs.existsSync(path.join(planDir, 'PROJECT.md'));
  const hasCodebaseMap = fs.existsSync(path.join(planDir, 'codebase', 'ARCHITECTURE.md'));
  const hasGit = fs.existsSync(path.join(cwd, '.git'));

  // Detect existing code (non-hidden, non-planning directories)
  let hasExistingCode = false;
  let hasPackageFile = false;
  try {
    const entries = fs.readdirSync(cwd);
    hasPackageFile = entries.includes('package.json') || entries.includes('pyproject.toml') || entries.includes('Cargo.toml');
    hasExistingCode = hasPackageFile || entries.some(e =>
      !e.startsWith('.') && e !== '.planning' && e !== 'node_modules' &&
      fs.statSync(path.join(cwd, e)).isDirectory()
    );
  } catch {}

  const isBrownfield = hasExistingCode;
  const needsCodebaseMap = isBrownfield && !hasCodebaseMap;

  const config = loadConfig(cwd);
  const workflowModels = resolveWorkflowModels(config, 'claude');

  return {
    project_exists: hasProject,
    has_codebase_map: hasCodebaseMap,
    planning_exists: hasPlanning,
    has_existing_code: hasExistingCode,
    has_package_file: hasPackageFile,
    is_brownfield: isBrownfield,
    needs_codebase_map: needsCodebaseMap,
    has_git: hasGit,
    project_path: path.join(planDir, 'PROJECT.md'),
    commit_docs: config.commit_docs !== false,
    ...workflowModels,
  };
}

function initMilestoneOp(cwd) {
  const planDir = path.join(cwd, '.planning');
  const config = loadConfig(cwd);
  const workflowModels = resolveWorkflowModels(config, 'claude');
  const state = parseStateXml(readXml(path.join(planDir, 'STATE.xml')));
  const phases = parseRoadmapXml(readXml(path.join(planDir, 'ROADMAP.xml')));
  const totalPhases = phases.length;
  const donePhases = phases.filter(p => p.status === 'done').length;
  return {
    planning_exists: fs.existsSync(planDir),
    total_phases: totalPhases,
    done_phases: donePhases,
    current_phase: state.currentPhase || '',
    milestone: state.milestone || '',
    commit_docs: config.commit_docs !== false,
    ...workflowModels,
  };
}

function initMapCodebase(cwd) {
  const planDir = path.join(cwd, '.planning');
  const config = loadConfig(cwd);
  const workflowModels = resolveWorkflowModels(config, 'claude');
  return {
    planning_exists: fs.existsSync(planDir),
    codebase_map_exists: fs.existsSync(path.join(planDir, 'codebase', 'ARCHITECTURE.md')),
    has_git: fs.existsSync(path.join(cwd, '.git')),
    output_dir: path.join(planDir, 'codebase'),
    commit_docs: config.commit_docs !== false,
    ...workflowModels,
  };
}

function initProgress(cwd) {
  const planDir = path.join(cwd, '.planning');
  const config = loadConfig(cwd);
  const state = parseStateXml(readXml(path.join(planDir, 'STATE.xml')));
  const phases = parseRoadmapXml(readXml(path.join(planDir, 'ROADMAP.xml')));
  return {
    planning_exists: fs.existsSync(planDir),
    total_phases: phases.length,
    done_phases: phases.filter(p => p.status === 'done').length,
    in_progress_phases: phases.filter(p => p.status === 'in-progress').length,
    current_phase: state.currentPhase || '',
    milestone: state.milestone || '',
    commit_docs: config.commit_docs !== false,
  };
}

function initTodos(cwd) {
  const planDir = path.join(cwd, '.planning');
  const todosDir = path.join(planDir, 'todos');
  const pending = fs.existsSync(path.join(todosDir, 'pending'))
    ? fs.readdirSync(path.join(todosDir, 'pending')).filter(f => f.endsWith('.md'))
    : [];
  return {
    planning_exists: fs.existsSync(planDir),
    todos_dir: todosDir,
    pending_count: pending.length,
    pending_files: pending,
  };
}

// ─── Commit ──────────────────────────────────────────────────────────────────

function commitFiles(cwd, message, files, opts = {}) {
  if (!files || files.length === 0) {
    error('No files specified for commit. Use --files f1 f2');
  }
  try {
    for (const f of files) {
      execSync(`git add "${f}"`, { cwd, stdio: 'pipe' });
    }
    const amendFlag = opts.amend ? '--amend --no-edit' : '';
    execSync(`git commit ${amendFlag} -m "${message.replace(/"/g, '\\"')}"`, { cwd, stdio: 'pipe' });
    console.log(`Committed: ${message}`);
  } catch (e) {
    console.error(`Commit failed: ${e.message}`);
    process.exit(1);
  }
}

// ─── Scaffold ────────────────────────────────────────────────────────────────

function scaffoldPhaseDir(cwd, phaseId, name) {
  const padded = String(phaseId).padStart(2, '0');
  const slug = generateSlug(name || `phase-${phaseId}`);
  const dirPath = path.join(cwd, '.planning', 'phases', `${padded}-${slug}`);
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
    fs.writeFileSync(path.join(dirPath, '.gitkeep'), '');
  }
  return dirPath;
}

function scaffoldContext(cwd, phaseId) {
  const info = initPhaseOp(cwd, phaseId);
  const dirPath = info.phase_dir;
  if (!fs.existsSync(dirPath)) fs.mkdirSync(dirPath, { recursive: true });
  const contextPath = path.join(dirPath, `${info.padded_phase}-CONTEXT.md`);
  if (!fs.existsSync(contextPath)) {
    fs.writeFileSync(contextPath, `# Phase ${phaseId}: ${info.phase_name} - Context

**Gathered:** ${timestamp('date')}
**Status:** Ready for planning

<domain>
## Phase Boundary

${info.phase_name}

</domain>

<decisions>
## Implementation Decisions

</decisions>

<canonical_refs>
## Canonical References

</canonical_refs>

<code_context>
## Existing Code Insights

</code_context>

<specifics>
## Specific Ideas

</specifics>

<deferred>
## Deferred Ideas

</deferred>
`);
  }
  return contextPath;
}

// ─── Agent Skills ────────────────────────────────────────────────────────────

function agentSkills(agentType) {
  const gadDir = path.join(__dirname, '..');
  // Normalize agent aliases
  const aliases = {
    'gad-checker': 'gad-plan-checker',
    'gad-researcher': 'gad-phase-researcher',
    'gad-synthesizer': 'gad-research-synthesizer',
    'gad-advisor': 'gad-advisor-researcher',
    'gad-ui': 'gad-ui-researcher',
    'gad-mapper': 'gad-codebase-mapper',
  };
  const resolvedType = aliases[agentType] || agentType;

  const agentFile = path.join(gadDir, 'agents', `${resolvedType}.md`);
  if (fs.existsSync(agentFile)) return fs.readFileSync(agentFile, 'utf8');

  // Try original name if alias didn't match
  const agentFileOrig = path.join(gadDir, 'agents', `${agentType}.md`);
  if (fs.existsSync(agentFileOrig)) return fs.readFileSync(agentFileOrig, 'utf8');

  // Check skills/ directory
  const skillFile = path.join(gadDir, 'skills', resolvedType, 'SKILL.md');
  if (fs.existsSync(skillFile)) return fs.readFileSync(skillFile, 'utf8');
  const skillFileOrig = path.join(gadDir, 'skills', agentType, 'SKILL.md');
  if (fs.existsSync(skillFileOrig)) return fs.readFileSync(skillFileOrig, 'utf8');

  return '';
}

// ─── State Operations ────────────────────────────────────────────────────────

function stateLoad(cwd) {
  const content = readXml(path.join(cwd, '.planning', 'STATE.xml'));
  return parseStateXml(content);
}

function stateUpdate(cwd, field, value) {
  const stateFile = path.join(cwd, '.planning', 'STATE.xml');
  let content = readXml(stateFile);
  if (!content) error('STATE.xml not found');

  const tagMap = {
    'current-phase': 'current-phase',
    'currentPhase': 'current-phase',
    'next-action': 'next-action',
    'nextAction': 'next-action',
    'status': 'status',
    'milestone': 'milestone',
    'last-updated': 'last-updated',
    'lastUpdated': 'last-updated',
  };
  const tag = tagMap[field] || field;
  const re = new RegExp(`<${tag}>[\\s\\S]*?</${tag}>`);
  if (re.test(content)) {
    content = content.replace(re, `<${tag}>${value}</${tag}>`);
  }
  const dateRe = /<last-updated>[\s\S]*?<\/last-updated>/;
  if (dateRe.test(content)) {
    content = content.replace(dateRe, `<last-updated>${timestamp('date')}</last-updated>`);
  }
  fs.writeFileSync(stateFile, content);
}

function stateRecordSession(cwd, args) {
  const stoppedAt = collectAfterFlag(args, 'stopped-at').join(' ');
  if (stoppedAt) stateUpdate(cwd, 'next-action', stoppedAt);
}

function stateBeginPhase(cwd, phaseId) {
  stateUpdate(cwd, 'current-phase', String(phaseId));
  stateUpdate(cwd, 'status', 'in-progress');
  console.log(`State: current-phase = ${phaseId}, status = in-progress`);
}

function stateAdvancePlan(cwd, phase, plan) {
  stateUpdate(cwd, 'current-plan', `${phase}-${plan}`);
  console.log(`State: current-plan = ${phase}-${plan}`);
}

function stateUpdateProgress(cwd, text) {
  // Append to next-action (simple approach)
  const state = stateLoad(cwd);
  const current = state.nextAction || '';
  const updated = current ? `${current}\n${text}` : text;
  stateUpdate(cwd, 'next-action', updated);
  console.log(`Progress noted.`);
}

function stateAddBlocker(cwd, text) {
  const stateFile = path.join(cwd, '.planning', 'STATE.xml');
  let content = readXml(stateFile);
  if (!content) error('STATE.xml not found');
  const entry = `  <blocker at="${timestamp()}">${text}</blocker>`;
  if (/<blockers>/.test(content)) {
    content = content.replace(/<blockers>/, `<blockers>\n${entry}`);
  } else {
    content = content.replace(/<\/state>/, `  <blockers>\n${entry}\n  </blockers>\n</state>`);
  }
  fs.writeFileSync(stateFile, content);
  console.log(`Blocker added.`);
}

function stateAddDecision(cwd, text) {
  const stateFile = path.join(cwd, '.planning', 'STATE.xml');
  let content = readXml(stateFile);
  if (!content) error('STATE.xml not found');
  const entry = `  <decision at="${timestamp()}">${text}</decision>`;
  if (/<decisions>/.test(content)) {
    content = content.replace(/<decisions>/, `<decisions>\n${entry}`);
  } else {
    content = content.replace(/<\/state>/, `  <decisions>\n${entry}\n  </decisions>\n</state>`);
  }
  fs.writeFileSync(stateFile, content);
  console.log(`Decision added.`);
}

function stateRecordMetric(cwd, key, value) {
  const stateFile = path.join(cwd, '.planning', 'STATE.xml');
  let content = readXml(stateFile);
  if (!content) error('STATE.xml not found');
  const entry = `  <metric key="${key}" at="${timestamp()}">${value}</metric>`;
  if (/<metrics>/.test(content)) {
    content = content.replace(/<metrics>/, `<metrics>\n${entry}`);
  } else {
    content = content.replace(/<\/state>/, `  <metrics>\n${entry}\n  </metrics>\n</state>`);
  }
  fs.writeFileSync(stateFile, content);
  console.log(`Metric recorded: ${key} = ${value}`);
}

// ─── Phases list ──────────────────────────────────────────────────────────────

function phasesList(cwd, opts = {}) {
  const planDir = path.join(cwd, '.planning');
  const phasesDir = path.join(planDir, 'phases');

  if (opts.type === 'summaries') {
    // Return list of phase dirs that have a SUMMARY file
    if (!fs.existsSync(phasesDir)) return [];
    return fs.readdirSync(phasesDir)
      .filter(d => fs.statSync(path.join(phasesDir, d)).isDirectory())
      .filter(d => {
        const padded = d.split('-')[0];
        return fs.existsSync(path.join(phasesDir, d, `${padded}-SUMMARY.md`));
      })
      .map(d => path.join(phasesDir, d));
  }

  // Default: parse ROADMAP.xml phases
  const phases = parseRoadmapXml(readXml(path.join(planDir, 'ROADMAP.xml')));
  return phases;
}

function phasePlanIndex(cwd, phaseId) {
  const phaseDir = findPhaseDir(cwd, phaseId);
  if (!phaseDir || !fs.existsSync(phaseDir)) return [];
  const padded = String(phaseId).padStart(2, '0');
  const plans = fs.readdirSync(phaseDir)
    .filter(f => f.endsWith('-PLAN.md') || f === 'PLAN.md')
    .map(f => ({ file: f, path: path.join(phaseDir, f) }));
  return plans;
}

// ─── Progress bar ────────────────────────────────────────────────────────────

function progressBar(cwd) {
  const planDir = path.join(cwd, '.planning');
  const phases = parseRoadmapXml(readXml(path.join(planDir, 'ROADMAP.xml')));
  const total = phases.length;
  const done = phases.filter(p => p.status === 'done').length;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  const filled = Math.round(pct / 5);
  const bar = '█'.repeat(filled) + '░'.repeat(20 - filled);
  return `[${bar}] ${pct}% (${done}/${total} phases)`;
}

// ─── Milestone ───────────────────────────────────────────────────────────────

function milestoneComplete(cwd, version, name) {
  const planDir = path.join(cwd, '.planning');
  const milestonesDir = path.join(planDir, 'milestones');
  fs.mkdirSync(milestonesDir, { recursive: true });

  const phases = parseRoadmapXml(readXml(path.join(planDir, 'ROADMAP.xml')));
  const donePhases = phases.filter(p => p.status === 'done');

  const entry = `\n## ${version}${name ? ` — ${name}` : ''}\n\n- Date: ${timestamp('date')}\n- Phases: ${donePhases.length}\n`;

  const milestonesFile = path.join(planDir, 'MILESTONES.md');
  if (fs.existsSync(milestonesFile)) {
    fs.appendFileSync(milestonesFile, entry);
  } else {
    fs.writeFileSync(milestonesFile, `# Milestones\n${entry}`);
  }

  const result = { version, name: name || '', date: timestamp('date'), phases_done: donePhases.length };
  console.log(JSON.stringify(result, null, 2));
  return result;
}

// ─── Requirements ────────────────────────────────────────────────────────────

function requirementsMarkComplete(cwd, reqIds) {
  const reqFile = path.join(cwd, '.planning', 'REQUIREMENTS.md');
  if (!fs.existsSync(reqFile)) { console.log('REQUIREMENTS.md not found — skipping'); return; }
  let content = fs.readFileSync(reqFile, 'utf8');
  for (const reqId of reqIds) {
    // Mark checkbox: - [ ] REQ-ID → - [x] REQ-ID
    content = content.replace(
      new RegExp(`(- \\[ \\]\\s*\\*?\\*?${reqId}\\*?\\*?)`, 'g'),
      (m) => m.replace('[ ]', '[x]')
    );
  }
  fs.writeFileSync(reqFile, content);
  console.log(`Marked complete: ${reqIds.join(', ')}`);
}

// ─── Verify ──────────────────────────────────────────────────────────────────

function verifyArtifacts(planFile) {
  if (!fs.existsSync(planFile)) {
    console.log(JSON.stringify({ ok: false, error: `File not found: ${planFile}` }));
    return;
  }
  const content = fs.readFileSync(planFile, 'utf8');
  const checks = {
    has_goal: /^#{1,3}\s+goal/im.test(content) || /\bgoal\b/i.test(content),
    has_tasks: /- \[/m.test(content) || /^##\s+tasks/im.test(content),
    has_success_criteria: /success.criteria/i.test(content) || /acceptance/i.test(content),
  };
  const ok = Object.values(checks).every(Boolean);
  console.log(JSON.stringify({ ok, file: planFile, checks }, null, 2));
}

function verifyKeyLinks(planFile) {
  if (!fs.existsSync(planFile)) {
    console.log(JSON.stringify({ ok: false, error: `File not found: ${planFile}` }));
    return;
  }
  const dir = path.dirname(planFile);
  const content = fs.readFileSync(planFile, 'utf8');
  const linkRe = /\[([^\]]+)\]\(([^)]+)\)/g;
  const results = [];
  let m;
  while ((m = linkRe.exec(content)) !== null) {
    const href = m[2];
    if (href.startsWith('http')) { results.push({ href, ok: true, reason: 'external' }); continue; }
    const resolved = path.resolve(dir, href);
    results.push({ href, ok: fs.existsSync(resolved), resolved });
  }
  const broken = results.filter(r => !r.ok && r.reason !== 'external');
  console.log(JSON.stringify({ ok: broken.length === 0, broken_count: broken.length, links: results }, null, 2));
}

// ─── Validate ────────────────────────────────────────────────────────────────

function validateHealth(cwd, repair) {
  const planDir = path.join(cwd, '.planning');
  const issues = [];

  const required = ['STATE.xml', 'ROADMAP.xml'];
  for (const f of required) {
    if (!fs.existsSync(path.join(planDir, f))) {
      issues.push({ file: f, issue: 'missing' });
    }
  }

  if (issues.length === 0) {
    console.log(JSON.stringify({ ok: true, issues: [] }, null, 2));
  } else {
    console.log(JSON.stringify({ ok: false, issues }, null, 2));
    if (!repair) process.exit(1);
  }
}

// ─── Generate CLAUDE.md ──────────────────────────────────────────────────────

function generateClaudeMd(cwd) {
  const planDir = path.join(cwd, '.planning');
  const templateDir = path.join(__dirname, '..', 'templates');
  const templateFile = path.join(templateDir, 'CLAUDE.md');

  let base = '';
  if (fs.existsSync(templateFile)) {
    base = fs.readFileSync(templateFile, 'utf8');
  } else {
    // Minimal default
    base = `# Project Guide

This project uses GAD (Get Anything Done) for planning and execution.

## Working with GAD

- Planning state: \`.planning/\`
- Start a session: \`gad startup --projectid <id>\`
- Snapshot: \`gad snapshot --projectid <id>\`
- Skills: \`gad skill list --paths\`

## Loop

1. \`gad snapshot\` — where you are
2. Pick one planned task
3. Implement
4. \`gad tasks stamp <id> --status done --agent <name> --runtime <id> --skill <skill>\`
5. \`gad state log "<summary>"\`
6. Commit
`;
  }

  const claudeMdPath = path.join(cwd, 'CLAUDE.md');
  fs.writeFileSync(claudeMdPath, base);
  console.log(`Generated: CLAUDE.md`);
}

// ─── Scan Sessions ───────────────────────────────────────────────────────────

function scanSessions(cwd, asJson) {
  const sessionsDir = path.join(cwd, '.planning', 'sessions');
  if (!fs.existsSync(sessionsDir)) {
    if (asJson) console.log(JSON.stringify({ sessions: [] }));
    else console.log('No sessions found.');
    return;
  }

  const files = fs.readdirSync(sessionsDir).filter(f => f.endsWith('.json'));
  const sessions = files.map(f => {
    try {
      const data = JSON.parse(fs.readFileSync(path.join(sessionsDir, f), 'utf8'));
      return { file: f, ...data };
    } catch { return { file: f, error: 'parse failed' }; }
  }).sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));

  if (asJson) {
    console.log(JSON.stringify({ sessions }, null, 2));
  } else {
    for (const s of sessions) {
      console.log(`${s.file}: ${s.projectId || s.project || '?'} — ${s.status || '?'}`);
    }
  }
}

// ─── Docs Init ───────────────────────────────────────────────────────────────

function docsInit(cwd) {
  const planDir = path.join(cwd, '.planning');
  const docsDir = path.join(planDir, 'docs');
  fs.mkdirSync(docsDir, { recursive: true });

  const state = parseStateXml(readXml(path.join(planDir, 'STATE.xml')));
  const result = {
    docs_dir: docsDir,
    planning_exists: fs.existsSync(planDir),
    current_phase: state.currentPhase || '',
    has_docs: fs.readdirSync(docsDir).length > 0,
  };
  console.log(JSON.stringify(result, null, 2));
}

// ─── Frontmatter ─────────────────────────────────────────────────────────────

function frontmatterGet(filePath, field) {
  if (!fs.existsSync(filePath)) { console.log(''); return; }
  const content = fs.readFileSync(filePath, 'utf8');
  const fmMatch = content.match(/^---\n([\s\S]*?)\n---/);
  if (!fmMatch) { console.log(''); return; }
  const fm = fmMatch[1];
  // Simple key: value parser
  const lineRe = new RegExp(`^${field}:\\s*(.+)$`, 'm');
  const m = fm.match(lineRe);
  if (m) {
    // Handle multiline array values in simple cases
    let val = m[1].trim();
    if (val.startsWith('[') && val.endsWith(']')) {
      val = val.slice(1, -1).split(',').map(s => s.trim()).join(' ');
    }
    console.log(val);
  } else {
    // Try YAML block scalar / list
    const blockRe = new RegExp(`^${field}:([\\s\\S]*?)^(?=\\w)`, 'm');
    const bm = fm.match(blockRe);
    if (bm) console.log(bm[1].trim());
    else console.log('');
  }
}

// ─── Summary Extract ─────────────────────────────────────────────────────────

function summaryExtract(summaryPath, fields, pickField) {
  if (!fs.existsSync(summaryPath)) { console.log(''); return; }
  const content = fs.readFileSync(summaryPath, 'utf8');
  const result = {};

  for (const field of fields) {
    // Try frontmatter first
    const fmMatch = content.match(/^---\n([\s\S]*?)\n---/);
    if (fmMatch) {
      const lineRe = new RegExp(`^${field}:\\s*(.+)$`, 'm');
      const m = fmMatch[1].match(lineRe);
      if (m) { result[field] = m[1].trim(); continue; }
    }
    // Try H2 section
    const h2Re = new RegExp(`## ${field.replace(/_/g, '[ _]')}\\s*\\n([\\s\\S]*?)(?=^##|$)`, 'im');
    const h2m = content.match(h2Re);
    if (h2m) { result[field] = h2m[1].trim().split('\n')[0]; continue; }
    result[field] = '';
  }

  if (pickField) {
    console.log(result[pickField] || '');
  } else {
    console.log(JSON.stringify(result, null, 2));
  }
}

// ─── Todo match-phase ─────────────────────────────────────────────────────────

function todoMatchPhase(cwd, phase) {
  const todosDir = path.join(cwd, '.planning', 'todos', 'pending');
  if (!fs.existsSync(todosDir)) { console.log(JSON.stringify([])); return; }

  const padded = String(phase).padStart(2, '0');
  const matches = fs.readdirSync(todosDir)
    .filter(f => f.includes(`-phase-${padded}`) || f.includes(`-phase-${phase}`))
    .map(f => ({ file: f, path: path.join(todosDir, f) }));

  console.log(JSON.stringify(matches, null, 2));
}

// ─── Resolve Model ───────────────────────────────────────────────────────────

function resolveModel(cwd, agentType, rawFlag) {
  const config = loadConfig(cwd);
  const model = resolveAgentModel(agentType, {
    profile: config.model_profile || 'off',
    modelOverrides: config.model_overrides || {},
    target: 'claude',
  });
  const out = model || 'inherit';
  if (rawFlag) {
    console.log(out);
  } else {
    console.log(JSON.stringify({ agent: agentType, model: out }));
  }
}

// ─── Config ensure-section ───────────────────────────────────────────────────

function configEnsureSection(cwd, section) {
  const planDir = path.join(cwd, '.planning');
  fs.mkdirSync(planDir, { recursive: true });
  const compatPath = path.join(planDir, 'config.json');

  // When called without a section arg (or with 'all'), behave like init-config:
  // write the full default config if it doesn't exist yet.
  if (!section || section === 'all') {
    if (fs.existsSync(compatPath)) {
      try {
        const existing = JSON.parse(fs.readFileSync(compatPath, 'utf8'));
        if (existing._created_by === 'config-ensure-section') {
          console.log(JSON.stringify({ created: false, reason: 'already_exists' }));
          return;
        }
      } catch {}
    }

    // Load user defaults from ~/.gsd/defaults.json if present
    let userDefaults = {};
    try {
      const homeDir = process.env.HOME || process.env.USERPROFILE || '';
      const defaultsFile = path.join(homeDir, '.gsd', 'defaults.json');
      if (homeDir && fs.existsSync(defaultsFile)) {
        userDefaults = JSON.parse(fs.readFileSync(defaultsFile, 'utf8'));
      }
    } catch {}

    // Detect Brave Search API key
    let braveSearch = false;
    try {
      const homeDir = process.env.HOME || process.env.USERPROFILE || '';
      if (homeDir && fs.existsSync(path.join(homeDir, '.gsd', 'brave_api_key'))) {
        braveSearch = true;
      }
    } catch {}

    const merged = deepMerge(CONFIG_NEW_PROJECT_DEFAULTS, userDefaults);
    if (braveSearch) merged.brave_search = true;
    merged._created_by = 'config-ensure-section';

    try { gadConfig.writeToml(cwd, merged); } catch {}
    fs.writeFileSync(compatPath, JSON.stringify(merged, null, 2));
    console.log(JSON.stringify({ created: true, path: '.planning/config.json' }));
    return;
  }

  // Section-scoped variant — ensure a specific key exists
  const config = loadConfig(cwd);
  if (!config[section] || typeof config[section] !== 'object') {
    config[section] = {};
    saveConfig(cwd, config);
    console.log(JSON.stringify({ created: true, section }));
  } else {
    console.log(JSON.stringify({ created: false, reason: 'already_exists', section }));
  }
}

// ─── Audit UAT ───────────────────────────────────────────────────────────────

function auditUat(cwd, rawFlag) {
  const phasesDir = path.join(cwd, '.planning', 'phases');
  const debts = [];
  if (fs.existsSync(phasesDir)) {
    for (const phase of fs.readdirSync(phasesDir)) {
      const phaseDir = path.join(phasesDir, phase);
      if (!fs.statSync(phaseDir).isDirectory()) continue;
      const padded = phase.split('-')[0];
      const uatFile = path.join(phaseDir, `${padded}-UAT.md`);
      if (!fs.existsSync(uatFile)) continue;
      const content = fs.readFileSync(uatFile, 'utf8');
      const open = (content.match(/- \[ \]/g) || []).length;
      if (open > 0) debts.push({ phase, uat_file: uatFile, open_items: open });
    }
  }
  const result = { total_debt: debts.reduce((s, d) => s + d.open_items, 0), phases: debts };
  if (rawFlag) {
    console.log(`UAT Debt: ${result.total_debt} open items across ${debts.length} phases`);
  } else {
    console.log(JSON.stringify(result, null, 2));
  }
}

// ─── CLI Router ──────────────────────────────────────────────────────────────

const HELP = `gad-tools — GAD workflow helper

USAGE
  gad-tools <command> [args]

COMMANDS
  agent-skills <agent-type>            Get agent skill content
  audit-uat [--raw]                    Summarize UAT debt
  commit <msg> --files f1 f2 …        Git add + commit
  commit-to-subrepo <msg> --files …   Same as commit (subrepo variant)
  config-ensure-section <section>      Ensure config section exists
  config-get <key>                     Read config value
  config-new-project '<json>'          Write full project config
  config-set <key> <value>             Write config value
  current-timestamp [format]           Print timestamp
  docs-init                            Initialize .planning/docs/
  find-phase <phase>                   Find phase directory
  frontmatter get <file> --field <f>   Extract frontmatter field
  generate-claude-md                   Write/refresh CLAUDE.md
  generate-claude-profile …           (stub)
  generate-dev-preferences             (stub)
  generate-slug <text>                 Text to URL-safe slug
  init <subcommand> [args]             Init context for workflow
  milestone complete <v> --name <n>    Archive milestone
  phase add <description>              Add phase to roadmap (stub)
  phase complete <phase>               Mark phase done
  phase-plan-index <phase>             List plans in phase dir
  phases list [--type summaries]       List phases
  profile-questionnaire …             (stub)
  profile-sample                       (stub)
  progress bar [--raw]                 Render progress bar
  requirements mark-complete <ids…>    Mark requirements done
  resolve-model <agent> [--raw]        Resolve model for agent type
  roadmap analyze                      Full roadmap (JSON array)
  roadmap get-phase <phase>            Extract one phase
  roadmap update-plan-progress …      (stub)
  scaffold <subcommand>                Scaffold files
  scan-sessions [--json]               Scan session files
  state <subcommand>                   STATE.xml operations
  state-snapshot                       Alias: state json
  summary-extract <path> --fields …   Extract SUMMARY.md fields
  todo match-phase <phase>             List todos for phase
  uat render-checkpoint …             (stub)
  validate health [--repair]           Check planning integrity
  verify artifacts <file>              Check plan artifacts
  verify key-links <file>              Check markdown links
  verify schema-drift <phase>         (stub)
  workstream                           (stub)
  write-profile …                     (stub)
`;

function main() {
  const args = process.argv.slice(2);
  const cwd = findProjectRoot(process.cwd());
  const command = args[0];
  const rawFlag = args.includes('--raw');

  if (!command || command === '--help' || command === '-h') {
    console.log(HELP);
    return;
  }

  // --pick <field> post-processor
  const pickIdx = args.indexOf('--pick');
  const pickField = pickIdx !== -1 ? args[pickIdx + 1] : null;

  switch (command) {
    // ── init ──────────────────────────────────────────────────────────────
    case 'init': {
      const subCmd = args[1];
      if (!subCmd) error('Usage: gad-tools init <subcommand> [args]');
      const phaseArg = args[2];

      if (subCmd === 'new-project') {
        const result = initNewProject(cwd);
        console.log(JSON.stringify(result, null, 2));
      } else if (subCmd === 'phase-op' || subCmd === 'execute-phase' || subCmd === 'plan-phase' || subCmd === 'verify-work') {
        if (!phaseArg) error(`Usage: gad-tools init ${subCmd} <phase>`);
        const result = initPhaseOp(cwd, phaseArg);
        console.log(JSON.stringify(result, null, 2));
      } else if (subCmd === 'milestone-op' || subCmd === 'new-milestone') {
        const result = initMilestoneOp(cwd);
        console.log(JSON.stringify(result, null, 2));
      } else if (subCmd === 'map-codebase') {
        const result = initMapCodebase(cwd);
        console.log(JSON.stringify(result, null, 2));
      } else if (subCmd === 'progress') {
        const result = initProgress(cwd);
        console.log(JSON.stringify(result, null, 2));
      } else if (subCmd === 'todos') {
        const result = initTodos(cwd);
        console.log(JSON.stringify(result, null, 2));
      } else if (subCmd === 'quick') {
        const description = args.slice(2).join(' ');
        const config = loadConfig(cwd);
        const wm = resolveWorkflowModels(config, 'claude');
        console.log(JSON.stringify({
          description,
          quick_id: `q-${timestamp('filename')}`,
          planning_exists: fs.existsSync(path.join(cwd, '.planning')),
          commit_docs: config.commit_docs !== false,
          ...wm,
        }, null, 2));
      } else if (subCmd === 'manager') {
        const config = loadConfig(cwd);
        const phases = parseRoadmapXml(readXml(path.join(cwd, '.planning', 'ROADMAP.xml')));
        const wm = resolveWorkflowModels(config, 'claude');
        console.log(JSON.stringify({
          planning_exists: fs.existsSync(path.join(cwd, '.planning')),
          total_phases: phases.length,
          done_phases: phases.filter(p => p.status === 'done').length,
          commit_docs: config.commit_docs !== false,
          ...wm,
        }, null, 2));
      } else if (subCmd === 'list-workspaces' || subCmd === 'new-workspace' || subCmd === 'remove-workspace') {
        // Workspace management — return workspaces from config
        const config = loadConfig(cwd);
        const workspaces = config.workspaces || [];
        const targetWorkspace = subCmd === 'remove-workspace' ? phaseArg : null;
        console.log(JSON.stringify({
          workspaces,
          target: targetWorkspace,
          commit_docs: config.commit_docs !== false,
        }, null, 2));
      } else {
        error(`Unknown init subcommand: ${subCmd}. Valid: new-project, phase-op, execute-phase, plan-phase, milestone-op, new-milestone, map-codebase, progress, quick, todos, manager, list-workspaces, new-workspace, remove-workspace, verify-work`);
      }
      break;
    }

    // ── commit ────────────────────────────────────────────────────────────
    case 'commit': {
      const message = args[1];
      if (!message) error('Usage: gad-tools commit <message> --files f1 f2');
      const files = collectAfterFlag(args, 'files');
      const isAmend = args.includes('--amend');
      commitFiles(cwd, message, files, { amend: isAmend });
      break;
    }

    case 'commit-to-subrepo': {
      const message = args[1];
      if (!message) error('Usage: gad-tools commit-to-subrepo <message> --files f1 f2');
      const files = collectAfterFlag(args, 'files');
      commitFiles(cwd, message, files);
      break;
    }

    // ── config ────────────────────────────────────────────────────────────
    case 'config-get': {
      const key = args[1];
      if (!key) error('Usage: gad-tools config-get <key>');
      const val = configGetOrExit(cwd, key);
      // Output as JSON so callers can parse it (e.g. JSON.parse(result.output) === 'balanced')
      if (pickField && typeof val === 'object' && val !== null) {
        console.log(val[pickField] !== undefined ? JSON.stringify(val[pickField]) : '');
      } else {
        console.log(JSON.stringify(val));
      }
      break;
    }

    case 'config-set': {
      const key = args[1];
      const value = args[2];
      if (!key || value === undefined) error('Usage: gad-tools config-set <key> <value>');
      configSet(cwd, key, value);
      // Return JSON-parseable output that tests can verify
      const coerced = value === 'true' ? true : value === 'false' ? false
        : (!isNaN(value) && value !== '') ? Number(value) : value;
      console.log(JSON.stringify({ updated: true, key, value: coerced }));
      break;
    }

    case 'config-new-project': {
      const jsonBlob = args[1];
      if (!jsonBlob) error('Usage: gad-tools config-new-project \'<json>\'');
      configNewProject(cwd, jsonBlob);
      break;
    }

    case 'config-ensure-section': {
      // section arg is optional — no arg means initialize full default config
      const section = args[1] || null;
      configEnsureSection(cwd, section);
      break;
    }

    // ── state ─────────────────────────────────────────────────────────────
    case 'state': {
      const sub = args[1];
      if (!sub || sub === 'load') {
        const result = stateLoad(cwd);
        if (pickField) console.log(result[pickField] || '');
        else console.log(JSON.stringify(result, null, 2));
      } else if (sub === 'update') {
        stateUpdate(cwd, args[2], args.slice(3).join(' '));
      } else if (sub === 'record-session') {
        stateRecordSession(cwd, args);
      } else if (sub === 'json') {
        console.log(JSON.stringify(stateLoad(cwd), null, 2));
      } else if (sub === 'begin-phase') {
        if (!args[2]) error('Usage: gad-tools state begin-phase <phase>');
        stateBeginPhase(cwd, args[2]);
      } else if (sub === 'advance-plan') {
        if (!args[2] || !args[3]) error('Usage: gad-tools state advance-plan <phase> <plan>');
        stateAdvancePlan(cwd, args[2], args[3]);
      } else if (sub === 'update-progress') {
        stateUpdateProgress(cwd, args.slice(2).join(' '));
      } else if (sub === 'add-blocker') {
        stateAddBlocker(cwd, args.slice(2).join(' '));
      } else if (sub === 'add-decision') {
        stateAddDecision(cwd, args.slice(2).join(' '));
      } else if (sub === 'record-metric') {
        if (!args[2] || !args[3]) error('Usage: gad-tools state record-metric <key> <value>');
        stateRecordMetric(cwd, args[2], args[3]);
      } else {
        error(`Unknown state subcommand: ${sub}`);
      }
      break;
    }

    case 'state-snapshot': {
      // Alias for state json
      console.log(JSON.stringify(stateLoad(cwd), null, 2));
      break;
    }

    // ── phase ─────────────────────────────────────────────────────────────
    case 'phase': {
      const sub = args[1];
      if (sub === 'find' || sub === 'find-phase') {
        console.log(findPhaseDir(cwd, args[2]) || '');
      } else if (sub === 'complete') {
        const phaseId = args[2];
        if (!phaseId) error('Usage: gad-tools phase complete <phase>');
        const roadmapFile = path.join(cwd, '.planning', 'ROADMAP.xml');
        let content = readXml(roadmapFile);
        if (!content) error('ROADMAP.xml not found');
        const padded = String(phaseId).padStart(2, '0');
        // Try exact id match first, then padded
        let replaced = false;
        for (const id of [phaseId, padded]) {
          const re = new RegExp(`(<phase\\s+id="${id}">[\\s\\S]*?<status>)([^<]*?)(<\\/status>)`);
          if (re.test(content)) {
            content = content.replace(re, '$1done$3');
            replaced = true;
            break;
          }
        }
        if (!replaced) { console.error(`Phase ${phaseId} not found in ROADMAP.xml`); }
        else { fs.writeFileSync(roadmapFile, content); console.log(`Phase ${phaseId} marked done`); }
        // Return JSON result for workflows that parse it
        const stateData = parseStateXml(readXml(path.join(cwd, '.planning', 'STATE.xml')));
        console.log(JSON.stringify({ phase: phaseId, status: 'done', ...stateData }, null, 2));
      } else if (sub === 'add') {
        stub('phase add');
        console.log(JSON.stringify({ ok: false, message: 'Use `gad phases add` CLI instead' }));
      } else {
        error(`Unknown phase subcommand: ${sub}`);
      }
      break;
    }

    case 'find-phase': {
      console.log(findPhaseDir(cwd, args[1]) || '');
      break;
    }

    // ── phases ────────────────────────────────────────────────────────────
    case 'phases': {
      const sub = args[1];
      if (!sub || sub === 'list') {
        const named = parseNamedArgs(args.slice(2), ['type', 'pick'], []);
        const type = named.type || args[args.indexOf('--type') + 1] || null;
        const list = phasesList(cwd, { type });
        const out = rawFlag
          ? list.map(p => (typeof p === 'string' ? p : `${p.id}: ${p.title} [${p.status}]`)).join('\n')
          : JSON.stringify(list, null, 2);
        if (pickField && !rawFlag) {
          const parsed = JSON.parse(out);
          if (pickField.endsWith('[-1]')) {
            const baseKey = pickField.replace('[-1]', '');
            const arr = parsed.map(p => p[baseKey] || p);
            console.log(arr[arr.length - 1] || '');
          } else {
            console.log(parsed[pickField] || '');
          }
        } else {
          console.log(out);
        }
      } else {
        error(`Unknown phases subcommand: ${sub}`);
      }
      break;
    }

    // ── phase-plan-index ──────────────────────────────────────────────────
    case 'phase-plan-index': {
      const phaseId = args[1];
      if (!phaseId) error('Usage: gad-tools phase-plan-index <phase>');
      const plans = phasePlanIndex(cwd, phaseId);
      console.log(JSON.stringify(plans, null, 2));
      break;
    }

    // ── roadmap ───────────────────────────────────────────────────────────
    case 'roadmap': {
      const sub = args[1];
      if (sub === 'get-phase') {
        const content = readXml(path.join(cwd, '.planning', 'ROADMAP.xml'));
        const phases = parseRoadmapXml(content);
        const target = args[2];
        const phase = phases.find(p => p.id === target || p.id === String(target).padStart(2, '0'));
        if (phase) console.log(JSON.stringify(phase, null, 2));
        else { console.error(`Phase not found: ${target}`); process.exit(1); }
      } else if (sub === 'analyze') {
        const content = readXml(path.join(cwd, '.planning', 'ROADMAP.xml'));
        const phases = parseRoadmapXml(content);
        console.log(JSON.stringify(phases, null, 2));
      } else if (sub === 'update-plan-progress') {
        stub('roadmap update-plan-progress');
        console.log(JSON.stringify({ ok: true, message: 'stub' }));
      } else {
        error(`Unknown roadmap subcommand: ${sub}`);
      }
      break;
    }

    // ── requirements ──────────────────────────────────────────────────────
    case 'requirements': {
      const sub = args[1];
      if (sub === 'mark-complete') {
        const reqIds = args.slice(2).filter(a => !a.startsWith('--'));
        if (reqIds.length === 0) error('Usage: gad-tools requirements mark-complete REQ-ID …');
        requirementsMarkComplete(cwd, reqIds);
      } else {
        error(`Unknown requirements subcommand: ${sub}`);
      }
      break;
    }

    // ── verify ────────────────────────────────────────────────────────────
    case 'verify': {
      const sub = args[1];
      if (sub === 'artifacts') {
        const planFile = args[2];
        if (!planFile) error('Usage: gad-tools verify artifacts <plan-file>');
        verifyArtifacts(planFile);
      } else if (sub === 'key-links') {
        const planFile = args[2];
        if (!planFile) error('Usage: gad-tools verify key-links <plan-file>');
        verifyKeyLinks(planFile);
      } else if (sub === 'schema-drift') {
        stub('verify schema-drift');
        console.log(JSON.stringify({ ok: true, drifted: [], message: 'stub' }));
      } else {
        error(`Unknown verify subcommand: ${sub}`);
      }
      break;
    }

    // ── validate ──────────────────────────────────────────────────────────
    case 'validate': {
      const sub = args[1];
      if (sub === 'health') {
        const repair = args.includes('--repair');
        validateHealth(cwd, repair);
      } else {
        error(`Unknown validate subcommand: ${sub}`);
      }
      break;
    }

    // ── milestone ─────────────────────────────────────────────────────────
    case 'milestone': {
      const sub = args[1];
      if (sub === 'complete') {
        const version = args[2];
        if (!version) error('Usage: gad-tools milestone complete <version> [--name <name>]');
        const named = parseNamedArgs(args, ['name']);
        milestoneComplete(cwd, version, named.name);
      } else {
        error(`Unknown milestone subcommand: ${sub}`);
      }
      break;
    }

    // ── progress ──────────────────────────────────────────────────────────
    case 'progress': {
      const sub = args[1];
      if (!sub || sub === 'bar') {
        const bar = progressBar(cwd);
        if (rawFlag) console.log(bar);
        else console.log(JSON.stringify({ bar }, null, 2));
      } else {
        error(`Unknown progress subcommand: ${sub}`);
      }
      break;
    }

    // ── audit-uat ─────────────────────────────────────────────────────────
    case 'audit-uat': {
      auditUat(cwd, rawFlag);
      break;
    }

    // ── uat ───────────────────────────────────────────────────────────────
    case 'uat': {
      const sub = args[1];
      if (sub === 'render-checkpoint') {
        stub('uat render-checkpoint');
        console.log('UAT checkpoint rendering not yet implemented — see .planning/tasks/73-01.json');
      } else {
        error(`Unknown uat subcommand: ${sub}`);
      }
      break;
    }

    // ── scaffold ──────────────────────────────────────────────────────────
    case 'scaffold': {
      const sub = args[1];
      if (sub === 'phase-dir') {
        const named = parseNamedArgs(args, ['phase', 'name']);
        if (!named.phase) error('Usage: gad-tools scaffold phase-dir --phase N --name S');
        console.log(scaffoldPhaseDir(cwd, named.phase, named.name));
      } else if (sub === 'context') {
        const named = parseNamedArgs(args, ['phase']);
        if (!named.phase) error('Usage: gad-tools scaffold context --phase N');
        console.log(scaffoldContext(cwd, named.phase));
      } else {
        error(`Unknown scaffold subcommand: ${sub}`);
      }
      break;
    }

    // ── agent-skills ──────────────────────────────────────────────────────
    case 'agent-skills': {
      const agentType = args[1];
      if (!agentType) error('Usage: gad-tools agent-skills <agent-type>');
      const content = agentSkills(agentType);
      if (content) console.log(content);
      break;
    }

    // ── resolve-model ─────────────────────────────────────────────────────
    case 'resolve-model': {
      const agentType = args[1];
      if (!agentType) error('Usage: gad-tools resolve-model <agent-type> [--raw]');
      resolveModel(cwd, agentType, rawFlag);
      break;
    }

    // ── generate-slug ─────────────────────────────────────────────────────
    case 'generate-slug': {
      const text = args.slice(1).filter(a => !a.startsWith('--')).join(' ');
      if (!text) error('Usage: gad-tools generate-slug <text>');
      console.log(generateSlug(text));
      break;
    }

    // ── generate-claude-md ────────────────────────────────────────────────
    case 'generate-claude-md': {
      generateClaudeMd(cwd);
      break;
    }

    // ── generate-claude-profile ───────────────────────────────────────────
    case 'generate-claude-profile': {
      stub('generate-claude-profile');
      console.log(JSON.stringify({ ok: false, message: 'stub — tracked at .planning/tasks/73-01.json' }));
      break;
    }

    // ── generate-dev-preferences ──────────────────────────────────────────
    case 'generate-dev-preferences': {
      stub('generate-dev-preferences');
      console.log(JSON.stringify({ ok: false, message: 'stub — tracked at .planning/tasks/73-01.json' }));
      break;
    }

    // ── current-timestamp ─────────────────────────────────────────────────
    case 'current-timestamp': {
      console.log(timestamp(args[1] || 'full'));
      break;
    }

    // ── scan-sessions ─────────────────────────────────────────────────────
    case 'scan-sessions': {
      const asJson = args.includes('--json');
      scanSessions(cwd, asJson);
      break;
    }

    // ── docs-init ─────────────────────────────────────────────────────────
    case 'docs-init': {
      docsInit(cwd);
      break;
    }

    // ── frontmatter ───────────────────────────────────────────────────────
    case 'frontmatter': {
      const sub = args[1];
      if (sub === 'get') {
        const filePath = args[2];
        const named = parseNamedArgs(args, ['field']);
        if (!filePath || !named.field) error('Usage: gad-tools frontmatter get <file> --field <name>');
        frontmatterGet(filePath, named.field);
      } else {
        error(`Unknown frontmatter subcommand: ${sub}`);
      }
      break;
    }

    // ── summary-extract ───────────────────────────────────────────────────
    case 'summary-extract': {
      const summaryPath = args[1];
      if (!summaryPath) error('Usage: gad-tools summary-extract <path> --fields f1 f2 [--pick field]');
      const fields = collectAfterFlag(args, 'fields');
      if (fields.length === 0) error('--fields required');
      summaryExtract(summaryPath, fields, pickField);
      break;
    }

    // ── todo match-phase ──────────────────────────────────────────────────
    case 'todo': {
      const sub = args[1];
      if (sub === 'match-phase') {
        const phase = args[2];
        if (!phase) error('Usage: gad-tools todo match-phase <phase>');
        todoMatchPhase(cwd, phase);
      } else {
        error(`Unknown todo subcommand: ${sub}`);
      }
      break;
    }

    // ── profile stubs ─────────────────────────────────────────────────────
    case 'profile-questionnaire': {
      stub('profile-questionnaire');
      console.log(JSON.stringify({ ok: false, analysis: null, message: 'stub — tracked at .planning/tasks/73-01.json' }));
      break;
    }

    case 'profile-sample': {
      stub('profile-sample');
      console.log(JSON.stringify({ ok: false, sample: null, message: 'stub — tracked at .planning/tasks/73-01.json' }));
      break;
    }

    case 'write-profile': {
      stub('write-profile');
      console.log(JSON.stringify({ ok: false, message: 'stub — tracked at .planning/tasks/73-01.json' }));
      break;
    }

    // ── config-set-model-profile ──────────────────────────────────────────
    case 'config-set-model-profile': {
      const profileArg = args[1];
      if (!profileArg) error('Usage: gad-tools config-set-model-profile <profile>');
      const normalized = normalizeProfile(profileArg);
      if (!VALID_PROFILES.includes(normalized)) {
        console.error(`Error: Invalid profile: ${profileArg}. Valid: ${VALID_PROFILES.join(', ')}`);
        process.exit(1);
      }

      const compatPath = path.join(cwd, '.planning', 'config.json');
      let config = Object.assign({}, CONFIG_NEW_PROJECT_DEFAULTS);
      try {
        if (fs.existsSync(compatPath)) config = JSON.parse(fs.readFileSync(compatPath, 'utf8'));
      } catch {}

      const previousProfile = config.model_profile || 'off';
      config.model_profile = normalized;

      fs.mkdirSync(path.join(cwd, '.planning'), { recursive: true });
      fs.writeFileSync(compatPath, JSON.stringify(config, null, 2) + '\n');
      try { gadConfig.writeToml(cwd, config); } catch {}

      const agentToModelMap = getAgentToModelMapForProfile(normalized);
      console.log(JSON.stringify({ updated: true, profile: normalized, previousProfile, agentToModelMap }));
      break;
    }

    // ── workstream stub ───────────────────────────────────────────────────
    case 'workstream': {
      // Workstream determines which repo/workspace to operate on
      // For now: return empty/default to let workflows continue
      const wsEnv = process.env.GAD_WORKSTREAM || '';
      console.log(wsEnv);
      break;
    }

    default:
      error(`Unknown command: ${command}\n\nRun 'gad-tools --help' for usage.`);
  }
}

main();
