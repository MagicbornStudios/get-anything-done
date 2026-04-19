'use strict';
/**
 * gad session / context / pause-work — agent work-window tracking
 *
 * Sessions are lightweight JSON files in .planning/sessions/<id>.json.
 * They track where an agent is in a project and what files to load.
 *   { id, projectId, position: { phase, plan, task }, status, refs[], createdAt, updatedAt }
 *
 * This module bundles three commands plus the session helpers they share:
 *   - sessionCmd  (list / new / resume / close)
 *   - pauseWorkCmd
 *   - contextCmd
 *
 * Helpers (loadSessions, SESSION_STATUS, buildContextRefs, touchStateXml) are
 * also exported so other CLI modules (e.g. runtime) can reuse them.
 */

const path = require('path');
const fs = require('fs');
const { defineCommand } = require('citty');

const SESSION_DIR = 'sessions';
const SESSION_STATUS = { ACTIVE: 'active', PAUSED: 'paused', CLOSED: 'closed' };

let _deps = null;

function deps() {
  if (!_deps) throw new Error('session.cjs: createSessionCommands() must be called before using helpers');
  return _deps;
}

function generateSessionId() {
  const ts = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 6);
  return `s-${ts}-${rand}`;
}

function sessionsDir(baseDir, root) {
  return path.join(baseDir, root.path, root.planningDir, SESSION_DIR);
}

function loadSessions(baseDir, roots) {
  const all = [];
  for (const root of roots) {
    const dir = sessionsDir(baseDir, root);
    if (!fs.existsSync(dir)) continue;
    for (const f of fs.readdirSync(dir)) {
      if (!f.endsWith('.json')) continue;
      try {
        const data = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
        all.push({ ...data, _root: root, _file: path.join(dir, f) });
      } catch { /* skip corrupt file */ }
    }
  }
  return all.sort((a, b) => (b.updatedAt || b.createdAt || '').localeCompare(a.updatedAt || a.createdAt || ''));
}

function writeSession(session) {
  const { sideEffectsSuppressed } = deps();
  if (sideEffectsSuppressed()) return;
  session.updatedAt = new Date().toISOString();
  fs.writeFileSync(session._file, JSON.stringify(
    (({ _root, _file, ...rest }) => rest)(session), null, 2,
  ));
}

/** Write ISO timestamp to <last-updated> in STATE.xml (creates tag if absent). */
function touchStateXml(root, baseDir) {
  const { sideEffectsSuppressed } = deps();
  if (sideEffectsSuppressed()) return;
  const planDir = path.join(baseDir, root.path, root.planningDir);
  const stateXml = path.join(planDir, 'STATE.xml');
  if (!fs.existsSync(stateXml)) return;
  try {
    let xml = fs.readFileSync(stateXml, 'utf8');
    const iso = new Date().toISOString();
    if (/<last-updated>/.test(xml)) {
      xml = xml.replace(/<last-updated>[^<]*<\/last-updated>/, `<last-updated>${iso}</last-updated>`);
    } else {
      xml = xml.replace(/<\/state>/, `  <last-updated>${iso}</last-updated>\n</state>`);
    }
    fs.writeFileSync(stateXml, xml);
  } catch { /* non-fatal */ }
}

/** Build the context refs an agent should load for a session. */
function buildContextRefs(root, baseDir, session) {
  const planDir = path.join(baseDir, root.path, root.planningDir);
  const refs = [];

  const agentsMd = path.join(baseDir, 'AGENTS.md');
  const planningAgentsMd = path.join(planDir, 'AGENTS.md');
  if (fs.existsSync(agentsMd)) refs.push({ file: 'AGENTS.md', reason: 'agent conventions' });
  if (fs.existsSync(planningAgentsMd)) refs.push({ file: path.join(root.planningDir, 'AGENTS.md'), reason: 'planning agent conventions' });

  const stateMd = path.join(planDir, 'STATE.md');
  const stateXml = path.join(planDir, 'STATE.xml');
  if (fs.existsSync(stateMd)) refs.push({ file: path.join(root.planningDir, 'STATE.md'), reason: 'current position and status' });
  else if (fs.existsSync(stateXml)) refs.push({ file: path.join(root.planningDir, 'STATE.xml'), reason: 'current position and status' });

  const roadmapMd = path.join(planDir, 'ROADMAP.md');
  const roadmapXml = path.join(planDir, 'ROADMAP.xml');
  if (fs.existsSync(roadmapMd)) refs.push({ file: path.join(root.planningDir, 'ROADMAP.md'), reason: 'phase roadmap' });
  else if (fs.existsSync(roadmapXml)) refs.push({ file: path.join(root.planningDir, 'ROADMAP.xml'), reason: 'phase roadmap' });

  const phase = session?.position?.phase;
  if (phase) {
    const phasesDir = path.join(planDir, 'phases');
    if (fs.existsSync(phasesDir)) {
      const phaseDir = fs.readdirSync(phasesDir).find(d => d.startsWith(phase) || d.includes(phase));
      if (phaseDir) {
        const planFile = path.join(phasesDir, phaseDir, 'PLAN.md');
        if (fs.existsSync(planFile)) {
          refs.push({ file: path.join(root.planningDir, 'phases', phaseDir, 'PLAN.md'), reason: `active phase plan (${phase})` });
        }
      }
    }
  }

  return refs;
}

function listActiveSessionsHint(baseDir, config, subcommand) {
  const sessions = loadSessions(baseDir, config.roots).filter(s => s.status !== 'closed');
  if (sessions.length === 0) {
    console.error('No active sessions. Run `gad session new` to start one.');
    process.exit(1);
  }
  console.error(`\nMissing --id. Active sessions:\n`);
  for (const s of sessions) {
    const phase = s.position?.phase ? `  phase: ${s.position.phase}` : '';
    console.error(`  ${s.id}  [${s.projectId || '?'}]${phase}`);
  }
  console.error(`\nRerun: gad session ${subcommand} --id ${sessions[0].id}`);
  process.exit(1);
}

function inferPauseWorkTask(root, baseDir, state) {
  const { readTasks } = deps();
  if (!state || !state.currentPhase) return null;
  const phaseTasks = readTasks(root, baseDir, { phase: String(state.currentPhase) });
  if (phaseTasks.length === 0) return null;
  const nextAction = String(state.nextAction || '');
  const referenced = phaseTasks.find((task) => nextAction.includes(task.id));
  if (referenced) return referenced;
  const inProgress = phaseTasks.find((task) => task.status === 'in-progress');
  if (inProgress) return inProgress;
  const claimed = phaseTasks.find((task) => task.agentId);
  if (claimed) return claimed;
  return phaseTasks.find((task) => task.status !== 'done' && task.status !== 'cancelled') || null;
}

function buildSessionList() {
  const { findRepoRoot, gadConfig, render, shouldUseJson } = deps();
  return defineCommand({
    meta: { name: 'list', description: 'List sessions' },
    args: {
      project: { type: 'string', description: 'Filter by project ID', default: '' },
      all: { type: 'boolean', description: 'Include closed sessions', default: false },
      json: { type: 'boolean', description: 'JSON output', default: false },
    },
    run({ args }) {
      const baseDir = findRepoRoot();
      const config = gadConfig.load(baseDir);
      let roots = config.roots;
      if (args.project) roots = roots.filter(r => r.id === args.project);

      let sessions = loadSessions(baseDir, roots);
      if (!args.all) sessions = sessions.filter(s => s.status !== SESSION_STATUS.CLOSED);

      if (sessions.length === 0) {
        console.log(args.all ? 'No sessions found.' : 'No active sessions. Run `gad session new` to start one.');
        return;
      }

      const rows = sessions.map(s => ({
        id: s.id,
        project: s.projectId || '—',
        phase: s.position?.phase || '—',
        status: s.status,
        ctx: s.contextMode || 'loaded',
        updated: s.updatedAt ? s.updatedAt.slice(0, 16).replace('T', ' ') : '—',
      }));

      const fmt = args.json ? 'json' : (shouldUseJson() ? 'json' : 'table');
      console.log(render(rows, { format: fmt, title: `Sessions (${rows.length})` }));
    },
  });
}

function buildSessionNew() {
  const { findRepoRoot, gadConfig, outputError, readState, shouldUseJson } = deps();
  return defineCommand({
    meta: { name: 'new', description: 'Create a new session and print context refs' },
    args: {
      project: { type: 'string', description: 'Project ID (uses first root if omitted)', default: '' },
      fresh: { type: 'boolean', description: 'Mark as fresh-context session (no prior planning state loaded)', default: false },
      json: { type: 'boolean', description: 'JSON output', default: false },
    },
    run({ args }) {
      const baseDir = findRepoRoot();
      const config = gadConfig.load(baseDir);
      let roots = config.roots;

      if (args.project) {
        roots = roots.filter(r => r.id === args.project);
        if (roots.length === 0) { outputError(`Project not found: ${args.project}`); return; }
      }

      if (roots.length === 0) { outputError('No projects configured. Run `gad projects sync` first.'); return; }

      const root = roots[0];
      const dir = sessionsDir(baseDir, root);
      fs.mkdirSync(dir, { recursive: true });

      const state = readState(root, baseDir);
      const session = {
        id: generateSessionId(),
        projectId: root.id,
        contextMode: args.fresh ? 'fresh' : 'loaded',
        position: {
          phase: state.currentPhase || null,
          plan: null,
          task: null,
        },
        status: SESSION_STATUS.ACTIVE,
        refs: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        _root: root,
        _file: '',
      };
      session._file = path.join(dir, `${session.id}.json`);
      session.refs = buildContextRefs(root, baseDir, session);
      writeSession(session);
      touchStateXml(root, baseDir);

      if (args.json || shouldUseJson()) {
        const { _root, _file, ...clean } = session;
        console.log(JSON.stringify(clean, null, 2));
      } else {
        console.log(`\nSession created: ${session.id}`);
        console.log(`Project:      ${root.id}`);
        console.log(`Context mode: ${session.contextMode}${session.contextMode === 'fresh' ? '  ← no prior state loaded' : '  ← planning state loaded before this session'}`);
        if (state.currentPhase) console.log(`Phase:        ${state.currentPhase}`);
        console.log(`\nLoad these files to resume context:\n`);
        for (const ref of session.refs) {
          console.log(`  ${ref.file}  — ${ref.reason}`);
        }
        console.log(`\nRun \`gad context --session ${session.id}\` to refresh refs at any time.`);
      }
    },
  });
}

function buildSessionResume() {
  const { findRepoRoot, gadConfig, outputError, shouldUseJson } = deps();
  return defineCommand({
    meta: { name: 'resume', description: 'Resume an existing session' },
    args: {
      id: { type: 'string', description: 'Session ID', default: '' },
      fresh: { type: 'boolean', description: 'Override context mode to fresh for this session', default: false },
      json: { type: 'boolean', description: 'JSON output', default: false },
    },
    run({ args }) {
      const baseDir = findRepoRoot();
      const config = gadConfig.load(baseDir);
      const id = args.id;
      if (!id) { listActiveSessionsHint(baseDir, config, 'resume'); return; }

      const sessions = loadSessions(baseDir, config.roots);
      const session = sessions.find(s => s.id === id);

      if (!session) { outputError(`Session not found: ${id}. Run \`gad session list --all\` to see all sessions.`); return; }
      if (session.status === SESSION_STATUS.CLOSED) {
        console.log(`Session ${id} is closed. Create a new one with \`gad session new\`.`);
        return;
      }

      session.refs = buildContextRefs(session._root, baseDir, session);
      session.status = SESSION_STATUS.ACTIVE;
      if (!session.contextMode) session.contextMode = 'loaded';
      if (args.fresh) session.contextMode = 'fresh';
      writeSession(session);
      touchStateXml(session._root, baseDir);

      if (args.json || shouldUseJson()) {
        const { _root, _file, ...clean } = session;
        console.log(JSON.stringify(clean, null, 2));
      } else {
        console.log(`\nResuming session: ${session.id}`);
        console.log(`Project: ${session.projectId}  Phase: ${session.position?.phase || '—'}`);
        console.log(`\nLoad these files to restore context:\n`);
        for (const ref of session.refs) {
          console.log(`  ${ref.file}  — ${ref.reason}`);
        }
      }
    },
  });
}

function buildSessionClose() {
  const { findRepoRoot, gadConfig, outputError } = deps();
  return defineCommand({
    meta: { name: 'close', description: 'Close a session' },
    args: {
      id: { type: 'string', description: 'Session ID', default: '' },
    },
    run({ args }) {
      const baseDir = findRepoRoot();
      const config = gadConfig.load(baseDir);
      const id = args.id;
      if (!id) { listActiveSessionsHint(baseDir, config, 'close'); return; }

      const sessions = loadSessions(baseDir, config.roots);
      const session = sessions.find(s => s.id === id);

      if (!session) { outputError(`Session not found: ${id}`); return; }

      session.status = SESSION_STATUS.CLOSED;
      writeSession(session);
      console.log(`Session ${id} closed.`);
    },
  });
}

function buildPauseWorkCmd() {
  const {
    findRepoRoot, gadConfig, resolveRoots, outputError, readState,
    createHandoff, resolveDetectedRuntimeId, getLastActiveProjectid, setLastActiveProjectid,
  } = deps();
  return defineCommand({
    meta: { name: 'pause-work', description: 'Capture current work as a handoff for zero-cost pickup later' },
    args: {
      goal: { type: 'string', description: 'What the next agent should accomplish', required: true },
      priority: { type: 'string', description: 'low | normal | high', default: 'normal' },
      context: { type: 'string', description: 'mechanical | reasoning', default: 'reasoning' },
      projectid: { type: 'string', description: 'Scope to one project', default: '' },
    },
    run({ args }) {
      const baseDir = findRepoRoot();
      const config = gadConfig.load(baseDir);
      let resolvedProjectid = String(args.projectid || '').trim();
      if (!resolvedProjectid) {
        try { resolvedProjectid = String(getLastActiveProjectid() || '').trim(); } catch { /* non-fatal */ }
      }
      let roots = resolveRoots({ projectid: resolvedProjectid }, baseDir, config.roots);
      if (roots.length === 0 && !resolvedProjectid && config.roots.length > 0) {
        roots = [config.roots[0]];
      }
      if (roots.length === 0) {
        outputError('No project resolved. Pass --projectid <id> or set a last-active project via gad startup.');
      }
      const root = roots[0];
      const state = readState(root, baseDir);
      if (!state.currentPhase) {
        outputError(`Current phase missing in ${path.join(root.path, root.planningDir, 'STATE.xml')}.`);
      }
      const currentTask = inferPauseWorkTask(root, baseDir, state);
      const bodyLines = [
        '# Paused work',
        '',
        `Goal: ${String(args.goal).trim()}`,
        `Project: ${root.id}`,
        `Phase: ${state.currentPhase}`,
        `Task: ${currentTask ? currentTask.id : '(not inferred)'}`,
      ];
      if (state.nextAction) {
        bodyLines.push(`Next action: ${String(state.nextAction).trim()}`);
      }
      bodyLines.push('');
      bodyLines.push('Resume from this state. Generated by `gad pause-work`.');
      const result = createHandoff({
        baseDir,
        projectid: root.id,
        phase: String(state.currentPhase),
        taskId: currentTask ? currentTask.id : undefined,
        priority: String(args.priority || 'normal'),
        estimatedContext: String(args.context || 'reasoning'),
        body: bodyLines.join('\n'),
        createdBy: process.env.GAD_AGENT || resolveDetectedRuntimeId(),
        runtimePreference: resolveDetectedRuntimeId(),
      });
      try { setLastActiveProjectid(root.id); } catch { /* non-fatal */ }
      console.log(`Created: ${result.id}`);
      console.log(`Path:    ${path.relative(baseDir, result.filePath)}`);
    },
  });
}

function buildContextCmd() {
  const { findRepoRoot, gadConfig, outputError, shouldUseJson } = deps();
  return defineCommand({
    meta: { name: 'context', description: 'Print context files for current project position (inlines content by default)' },
    args: {
      session: { type: 'string', description: 'Session ID (uses latest active session if omitted)', default: '' },
      project: { type: 'string', description: 'Project ID', default: '' },
      refs: { type: 'boolean', description: 'Print file refs only — no content (lightweight mode)', default: false },
      json: { type: 'boolean', description: 'JSON output', default: false },
    },
    run({ args }) {
      const baseDir = findRepoRoot();
      const config = gadConfig.load(baseDir);
      let roots = config.roots;
      if (args.project) roots = roots.filter(r => r.id === args.project);

      let session = null;

      if (args.session) {
        const all = loadSessions(baseDir, roots);
        session = all.find(s => s.id === args.session);
        if (!session) { outputError(`Session not found: ${args.session}`); return; }
      } else {
        const active = loadSessions(baseDir, roots).filter(s => s.status === SESSION_STATUS.ACTIVE);
        if (active.length > 0) session = active[0];
      }

      const root = session?._root || roots[0];
      if (!root) { outputError('No projects configured. Run `gad projects sync` first.'); return; }

      const refs = buildContextRefs(root, baseDir, session);

      if (args.json || shouldUseJson()) {
        if (args.refs) {
          console.log(JSON.stringify({ session: session?.id || null, project: root.id, refs }, null, 2));
        } else {
          const refsWithContent = refs.map(ref => {
            const filePath = fs.existsSync(path.join(baseDir, ref.file))
              ? path.join(baseDir, ref.file)
              : path.join(baseDir, root.path, ref.file);
            let content = null;
            try { content = fs.readFileSync(filePath, 'utf8'); } catch { /* missing */ }
            return { ...ref, content };
          });
          console.log(JSON.stringify({ session: session?.id || null, project: root.id, refs: refsWithContent }, null, 2));
        }
      } else if (args.refs) {
        const sessionLine = session ? `Session: ${session.id}  Status: ${session.status}` : 'No active session — run `gad session new` to track this work.';
        console.log(`\n${sessionLine}`);
        console.log(`Project: ${root.id}`);
        if (session?.position?.phase) console.log(`Phase:   ${session.position.phase}`);
        console.log('\nFiles to load:\n');
        for (const ref of refs) {
          console.log(`  ${ref.file}`);
          console.log(`    → ${ref.reason}`);
        }
        if (refs.length === 0) console.log('  (no planning files found)');
        console.log('');
      } else {
        const sessionLine = session ? `Session: ${session.id}  Status: ${session.status}` : 'No active session — run `gad session new` to track this work.';
        console.log(`\n${sessionLine}`);
        console.log(`Project: ${root.id}`);
        if (session?.position?.phase) console.log(`Phase:   ${session.position.phase}`);
        console.log('');
        for (const ref of refs) {
          const filePath = fs.existsSync(path.join(baseDir, ref.file))
            ? path.join(baseDir, ref.file)
            : path.join(baseDir, root.path, ref.file);
          console.log(`${'─'.repeat(60)}`);
          console.log(`# ${ref.file}  (${ref.reason})`);
          console.log(`${'─'.repeat(60)}`);
          try {
            console.log(fs.readFileSync(filePath, 'utf8'));
          } catch {
            console.log(`(file not found: ${filePath})`);
          }
          console.log('');
        }
        if (refs.length === 0) console.log('  (no planning files found)');
        console.log(`─── end context (${refs.length} files) ───`);
        console.log(`\nTo refresh: gad context${session ? ` --session ${session.id}` : ''}`);
      }
    },
  });
}

/**
 * Initialize the session/context/pause-work command family.
 * Returns { sessionCmd, pauseWorkCmd, contextCmd, helpers }.
 *
 * Required deps:
 *   findRepoRoot, gadConfig, resolveRoots, readState, readTasks,
 *   render, output, outputError, shouldUseJson, sideEffectsSuppressed,
 *   createHandoff, resolveDetectedRuntimeId,
 *   getLastActiveProjectid, setLastActiveProjectid,
 */
function createSessionCommands(injected) {
  _deps = injected;
  const sessionList = buildSessionList();
  const sessionNew = buildSessionNew();
  const sessionResume = buildSessionResume();
  const sessionClose = buildSessionClose();
  const sessionCmd = defineCommand({
    meta: { name: 'session', description: 'Manage work sessions' },
    subCommands: { list: sessionList, new: sessionNew, resume: sessionResume, close: sessionClose },
  });
  const pauseWorkCmd = buildPauseWorkCmd();
  const contextCmd = buildContextCmd();
  return {
    sessionCmd, pauseWorkCmd, contextCmd,
    helpers: {
      SESSION_STATUS, loadSessions, buildContextRefs, touchStateXml,
      listActiveSessionsHint, inferPauseWorkTask,
    },
  };
}

module.exports = {
  createSessionCommands,
  SESSION_STATUS,
  loadSessions,
  buildContextRefs,
  touchStateXml,
  writeSession,
};
