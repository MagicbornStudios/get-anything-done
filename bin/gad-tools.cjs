#!/usr/bin/env node

/**
 * GAD Tools — CLI utility for GAD workflow operations
 *
 * Replaces gsd-tools.cjs for GAD workflows. Reads XML planning files.
 * Usage: node gad-tools.cjs <command> [args] [--raw] [--pick <field>]
 *
 * Core Commands:
 *   init phase-op <phase>              Phase operation context (JSON)
 *   init execute-phase <phase>         Execute-phase context
 *   init plan-phase <phase>            Plan-phase context
 *   commit <message> --files f1 f2     Commit planning docs
 *   config-get <key>                   Read from planning-config.toml or config.json
 *   config-set <key> <value>           Write to config.json
 *   state load                         Load project state from STATE.xml
 *   state update <field> <value>       Update STATE.xml field
 *   state record-session               Update session info in STATE.xml
 *   phase find <phase>                 Find phase directory
 *   phase add <description>            Add phase to roadmap
 *   phase complete <phase>             Mark phase done
 *   roadmap get-phase <phase>          Extract phase from ROADMAP.xml
 *   roadmap analyze                    Full roadmap parse
 *   generate-slug <text>               Convert text to URL-safe slug
 *   current-timestamp [format]         Get timestamp
 *   scaffold phase-dir --phase N --name S  Create phase directory
 *   scaffold context --phase N         Create CONTEXT.md template
 *   agent-skills <agent-type>          Get agent skill/prompt content
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// ─── Helpers ─────────────────────────────────────────────────────────────────

function error(msg) {
  console.error(`Error: ${msg}`);
  process.exit(1);
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

// ─── XML Readers (reuse gad.cjs readers where possible) ──────────────────────

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
  const configPath = path.join(cwd, '.planning', 'config.json');
  if (fs.existsSync(configPath)) {
    return JSON.parse(fs.readFileSync(configPath, 'utf8'));
  }
  return {};
}

function saveConfig(cwd, config) {
  const configPath = path.join(cwd, '.planning', 'config.json');
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
}

function configGet(cwd, key) {
  const config = loadConfig(cwd);
  const parts = key.split('.');
  let val = config;
  for (const p of parts) {
    if (val === undefined || val === null) return undefined;
    val = val[p];
  }
  return val;
}

function configSet(cwd, key, value) {
  const config = loadConfig(cwd);
  const parts = key.split('.');
  let obj = config;
  for (let i = 0; i < parts.length - 1; i++) {
    if (!obj[parts[i]] || typeof obj[parts[i]] !== 'object') obj[parts[i]] = {};
    obj = obj[parts[i]];
  }
  // Parse booleans and numbers
  if (value === 'true') value = true;
  else if (value === 'false') value = false;
  else if (!isNaN(value) && value !== '') value = Number(value);
  obj[parts[parts.length - 1]] = value;
  saveConfig(cwd, config);
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
    commit_docs: true,
  };
}

// ─── Commit ──────────────────────────────────────────────────────────────────

function commitFiles(cwd, message, files) {
  if (!files || files.length === 0) {
    error('No files specified for commit. Use --files f1 f2');
  }
  try {
    for (const f of files) {
      execSync(`git add "${f}"`, { cwd, stdio: 'pipe' });
    }
    execSync(`git commit -m "${message.replace(/"/g, '\\"')}"`, { cwd, stdio: 'pipe' });
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
  // Look for agent prompt in vendor/get-anything-done/agents/
  const gadDir = path.join(__dirname, '..');
  const agentFile = path.join(gadDir, 'agents', `${agentType}.md`);
  if (fs.existsSync(agentFile)) {
    return fs.readFileSync(agentFile, 'utf8');
  }
  // Also check skills/
  const skillDir = path.join(gadDir, 'skills', agentType);
  const skillFile = path.join(skillDir, 'SKILL.md');
  if (fs.existsSync(skillFile)) {
    return fs.readFileSync(skillFile, 'utf8');
  }
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

  // Map field names to XML tags
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
  // Always update last-updated
  const dateRe = /<last-updated>[\s\S]*?<\/last-updated>/;
  content = content.replace(dateRe, `<last-updated>${timestamp('date')}</last-updated>`);
  fs.writeFileSync(stateFile, content);
}

function stateRecordSession(cwd, args) {
  const stoppedAt = collectAfterFlag(args, 'stopped-at').join(' ');
  if (stoppedAt) {
    stateUpdate(cwd, 'next-action', stoppedAt);
  }
}

// ─── CLI Router ──────────────────────────────────────────────────────────────

function main() {
  const args = process.argv.slice(2);
  const cwd = findProjectRoot(process.cwd());
  const command = args[0];

  if (!command) {
    error('Usage: gad-tools <command> [args]\nCommands: init, commit, config-get, config-set, state, phase, roadmap, generate-slug, current-timestamp, scaffold, agent-skills');
  }

  switch (command) {
    case 'init': {
      const subCmd = args[1];
      const phaseArg = args[2];
      if (!subCmd) error('Usage: gad-tools init <phase-op|execute-phase|plan-phase> <phase>');
      if (subCmd === 'phase-op' || subCmd === 'execute-phase' || subCmd === 'plan-phase') {
        if (!phaseArg) error(`Usage: gad-tools init ${subCmd} <phase>`);
        const result = initPhaseOp(cwd, phaseArg);
        console.log(JSON.stringify(result, null, 2));
      } else {
        error(`Unknown init subcommand: ${subCmd}`);
      }
      break;
    }

    case 'commit': {
      const message = args[1];
      if (!message) error('Usage: gad-tools commit <message> --files f1 f2');
      const files = collectAfterFlag(args, 'files');
      commitFiles(cwd, message, files);
      break;
    }

    case 'config-get': {
      const key = args[1];
      if (!key) error('Usage: gad-tools config-get <key>');
      const val = configGet(cwd, key);
      console.log(val !== undefined ? String(val) : '');
      break;
    }

    case 'config-set': {
      const key = args[1];
      const value = args[2];
      if (!key || value === undefined) error('Usage: gad-tools config-set <key> <value>');
      configSet(cwd, key, value);
      break;
    }

    case 'state': {
      const sub = args[1];
      if (!sub || sub === 'load') {
        console.log(JSON.stringify(stateLoad(cwd), null, 2));
      } else if (sub === 'update') {
        stateUpdate(cwd, args[2], args.slice(3).join(' '));
      } else if (sub === 'record-session') {
        stateRecordSession(cwd, args);
      } else if (sub === 'json') {
        console.log(JSON.stringify(stateLoad(cwd), null, 2));
      } else {
        error(`Unknown state subcommand: ${sub}`);
      }
      break;
    }

    case 'phase': {
      const sub = args[1];
      if (sub === 'find' || sub === 'find-phase') {
        const dir = findPhaseDir(cwd, args[2]);
        console.log(dir || '');
      } else if (sub === 'complete') {
        // Mark phase done in ROADMAP.xml
        const phaseId = args[2];
        if (!phaseId) error('Usage: gad-tools phase complete <phase>');
        const roadmapFile = path.join(cwd, '.planning', 'ROADMAP.xml');
        let content = readXml(roadmapFile);
        if (!content) error('ROADMAP.xml not found');
        const padded = String(phaseId).padStart(2, '0');
        const re = new RegExp(`(<phase\\s+id="${padded}">[\\s\\S]*?<status>)\\w+(<\\/status>)`);
        content = content.replace(re, '$1done$2');
        fs.writeFileSync(roadmapFile, content);
        console.log(`Phase ${padded} marked done`);
      } else {
        error(`Unknown phase subcommand: ${sub}`);
      }
      break;
    }

    case 'find-phase': {
      const dir = findPhaseDir(cwd, args[1]);
      console.log(dir || '');
      break;
    }

    case 'roadmap': {
      const sub = args[1];
      if (sub === 'get-phase') {
        const content = readXml(path.join(cwd, '.planning', 'ROADMAP.xml'));
        const phases = parseRoadmapXml(content);
        const target = args[2];
        const phase = phases.find(p => p.id === target || p.id === String(target).padStart(2, '0'));
        if (phase) console.log(JSON.stringify(phase, null, 2));
        else error(`Phase not found: ${target}`);
      } else if (sub === 'analyze') {
        const content = readXml(path.join(cwd, '.planning', 'ROADMAP.xml'));
        const phases = parseRoadmapXml(content);
        console.log(JSON.stringify(phases, null, 2));
      } else {
        error(`Unknown roadmap subcommand: ${sub}`);
      }
      break;
    }

    case 'generate-slug': {
      const text = args.slice(1).join(' ');
      if (!text) error('Usage: gad-tools generate-slug <text>');
      console.log(generateSlug(text));
      break;
    }

    case 'current-timestamp': {
      console.log(timestamp(args[1] || 'full'));
      break;
    }

    case 'scaffold': {
      const sub = args[1];
      if (sub === 'phase-dir') {
        const named = parseNamedArgs(args, ['phase', 'name']);
        if (!named.phase) error('Usage: gad-tools scaffold phase-dir --phase N --name S');
        const dir = scaffoldPhaseDir(cwd, named.phase, named.name);
        console.log(dir);
      } else if (sub === 'context') {
        const named = parseNamedArgs(args, ['phase']);
        if (!named.phase) error('Usage: gad-tools scaffold context --phase N');
        const p = scaffoldContext(cwd, named.phase);
        console.log(p);
      } else {
        error(`Unknown scaffold subcommand: ${sub}`);
      }
      break;
    }

    case 'agent-skills': {
      const agentType = args[1];
      if (!agentType) error('Usage: gad-tools agent-skills <agent-type>');
      const content = agentSkills(agentType);
      if (content) console.log(content);
      break;
    }

    default:
      error(`Unknown command: ${command}`);
  }
}

main();
