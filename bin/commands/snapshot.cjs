'use strict';

const fs = require('fs');
const path = require('path');
const { defineCommand } = require('citty');

function createSnapshotCommand(deps) {
  const {
    repoRoot,
    findRepoRoot,
    gadConfig,
    outputError,
    sideEffectsSuppressed,
    ensureGraphFresh,
    loadSessions,
    writeSession,
    readPhases,
    readXmlFile,
    readTasks,
    resolveSnapshotAgentInputs,
    detectRuntimeIdentity,
    detectRuntimeSessionId,
    resolveSnapshotRuntime,
    ensureAgentLane,
    listAgentLanes,
    touchAgentLane,
    buildAssignmentsView,
    compactStateXml,
    compactRoadmapSection,
    compactTasksSection,
    buildHandoffsSection,
    resolveDetectedRuntimeId,
    buildEvolutionSection,
    listSkillDirs,
    readSkillFrontmatter,
    getCurrentSprintIndex,
    getSprintPhaseIds,
    graphExtractor,
    shouldUseJson,
  } = deps;

return defineCommand({
  meta: { name: 'snapshot', description: 'Print all planning files inlined for a project' },
  args: {
    projectid: { type: 'string', description: 'Project ID (default: first root)', default: '' },
    project: { type: 'string', description: 'Project ID (alias for --projectid)', default: '' },
    phaseid: { type: 'string', description: 'Scope snapshot to one phase id', default: '' },
    taskid: { type: 'string', description: 'Scope snapshot to one task id', default: '' },
    agentid: { type: 'string', description: 'Existing agent id to reuse', default: '' },
    role: { type: 'string', description: 'Logical agent role for auto-registration', default: '' },
    runtime: { type: 'string', description: 'Runtime identity override (claude-code, codex, cursor, human, etc.)', default: '' },
    'parent-agentid': { type: 'string', description: 'Parent/root agent id when bootstrapping a subagent lane', default: '' },
    'model-profile': { type: 'string', description: 'Model profile attached to the lane', default: '' },
    'resolved-model': { type: 'string', description: 'Resolved concrete model attached to the lane', default: '' },
    full: { type: 'boolean', description: 'Full dump (no sprint filtering)', default: false },
    json: { type: 'boolean', description: 'JSON output', default: false },
    skills: { type: 'string', description: 'Number of equipped skills to surface (44-35). 0 disables. Default: 5.', default: '5' },
    mode: { type: 'string', description: 'full (default) | active — "active" emits ONLY STATE.xml next-action + current phase + open sprint tasks (skips static catalog, references, decisions). Decision gad-195: static info loaded once at session start, active info re-pullable cheap without context waste.', default: '' },
    session: { type: 'string', description: 'Session ID. When provided, auto-downgrades to mode=active if static context was already delivered in this session. Env fallback: GAD_SESSION_ID.', default: '' },
    sessionid: { type: 'string', description: 'Session ID alias for --session (runtime command compatibility).', default: '' },
    format: { type: 'string', description: 'compact (default) | xml — "compact" strips XML envelope tokens (prolog, outer tags, per-item tag pairs) while preserving content. "xml" dumps raw file content (legacy). Decision gad-241.', default: 'compact' },
    'no-side-effects': { type: 'boolean', description: 'Read-only snapshot: suppress session/lane/log/graph writes.', default: false },
  },
  run({ args }) {
    const baseDir = findRepoRoot();
    const config = gadConfig.load(baseDir);
    let roots = config.roots;
    const projectId = args.projectid || args.project;

    if (projectId) {
      roots = roots.filter((root) => root.id === projectId);
      if (roots.length === 0) {
        const ids = config.roots.map((root) => root.id);
        console.error(`\nProject not found: ${projectId}\n\nAvailable projects:\n`);
        for (const id of ids) console.error(`  ${id}`);
        console.error(`\nRerun with: --projectid ${ids[0]}`);
        process.exit(1);
      }
    }

    if (roots.length === 0) {
      outputError('No projects configured. Run `gad projects sync` first.');
      return;
    }

    const root = roots[0];
    const planDir = path.join(baseDir, root.path, root.planningDir);
    const sprintSize = config.sprintSize || 5;
    const useFull = args.full;
    const readOnlySnapshot = sideEffectsSuppressed();

    // Auto-rebuild graph cache if stale or missing (post-2026-04-19 model:
    // .planning/graph.{json,html} are gitignored, regenerated on demand).
    // Closes 63-graph-task-stale at the snapshot read point. Silent unless
    // a rebuild happened, then a single stderr info line.
    if (!readOnlySnapshot) {
      const r = ensureGraphFresh(baseDir, root);
      if (r.rebuilt) console.error(`[snapshot] graph cache rebuilt (${r.reason})`);
    }

    // Session-aware mode resolution: auto-downgrade to active when session
    // has already received static context, unless --mode was explicitly passed.
    const sessionId = (args.sessionid || args.session || process.env.GAD_SESSION_ID || '').trim();
    let snapshotSession = null;
    if (sessionId) {
      const allSessions = loadSessions(baseDir, [root]);
      snapshotSession = allSessions.find((s) => s.id === sessionId) || null;
    }
    const explicitMode = (args.mode || '').trim().toLowerCase();
    const resolvedMode = (() => {
      if (explicitMode) return explicitMode;
      if (snapshotSession && snapshotSession.staticLoadedAt) return 'active';
      return 'full';
    })();

    const sdkAssetAliases = {
      '@skills': 'skills',
      '@workflows': 'workflows',
      '@templates': 'templates',
      '@references': 'references',
      '@agents': 'agents',
      '@hooks': 'hooks',
    };
    const phases = readPhases(root, baseDir);
    const stateXml = readXmlFile(path.join(planDir, 'STATE.xml'));
    const currentPhase = stateXml ? (stateXml.match(/<current-phase>([\s\S]*?)<\/current-phase>/) || [])[1]?.trim() || '' : '';
    const allTasks = readTasks(root, baseDir, {});
    const taskMap = new Map(allTasks.map((task) => [task.id, task]));
    const scopedTaskId = String(args.taskid || '').trim();
    const explicitPhaseId = String(args.phaseid || '').trim();
    const scopedTask = scopedTaskId ? taskMap.get(scopedTaskId) : null;

    if (scopedTaskId && !scopedTask) {
      outputError(`Task not found for snapshot scope: ${scopedTaskId}`);
    }

    const scopedPhaseId = explicitPhaseId || (scopedTask ? scopedTask.phase : '');
    if (scopedPhaseId && !phases.find((phase) => phase.id === scopedPhaseId)) {
      outputError(`Phase not found for snapshot scope: ${scopedPhaseId}`);
    }
    if (useFull && (scopedPhaseId || scopedTaskId)) {
      outputError('`gad snapshot --full` cannot be combined with --phaseid or --taskid.');
    }

    const agentInputs = resolveSnapshotAgentInputs(args);
    const detectedRuntime = detectRuntimeIdentity();
    const shouldAutoRegister = Boolean(
      agentInputs.requestedAgentId ||
      agentInputs.parentAgentId ||
      args.role ||
      scopedPhaseId ||
      scopedTaskId ||
      process.env.GAD_AGENT_ID ||
      process.env.GAD_AGENT_ROLE ||
      process.env.GAD_PARENT_AGENT_ID
    );
    const runtimeIdentity = resolveSnapshotRuntime(args.runtime, {
      humanFallback: Boolean(scopedPhaseId || scopedTaskId || agentInputs.parentAgentId || args.role || args.agentid),
    });
    let agentBootstrap = null;
    if (!readOnlySnapshot && shouldAutoRegister && runtimeIdentity.id !== 'unknown') {
      try {
        agentBootstrap = ensureAgentLane(planDir, {
          requestedAgentId: agentInputs.requestedAgentId,
          role: agentInputs.role,
          runtime: runtimeIdentity.id,
          runtimeSessionId: detectRuntimeSessionId(),
          parentAgentId: agentInputs.parentAgentId,
          modelProfile: agentInputs.modelProfile,
          resolvedModel: agentInputs.resolvedModel || runtimeIdentity.model || null,
        });
      } catch (error) {
        outputError(error && error.message ? error.message : String(error));
      }
    }
    let laneListing = listAgentLanes(planDir);
    const currentAgent = agentBootstrap?.agent
      || (agentInputs.requestedAgentId
        ? laneListing.activeAgents.find((agent) => agent.agentId === agentInputs.requestedAgentId) || null
        : null);

    if (!readOnlySnapshot && currentAgent) {
      touchAgentLane(planDir, currentAgent.agentId, {
        runtime: runtimeIdentity.id,
        runtimeSessionId: detectRuntimeSessionId() || currentAgent.runtimeSessionId || null,
        resolvedModel: agentInputs.resolvedModel || runtimeIdentity.model || currentAgent.resolvedModel || null,
      });
      laneListing = listAgentLanes(planDir);
    }

    const scope = {
      projectId: root.id,
      phaseId: scopedPhaseId || null,
      taskId: scopedTaskId || null,
      snapshotMode: scopedTask ? 'task' : (scopedPhaseId ? 'phase' : 'project'),
      isScoped: Boolean(scopedTask || scopedPhaseId),
    };
    const assignments = buildAssignmentsView(
      allTasks,
      laneListing.activeAgents,
      laneListing.staleAgents,
      currentAgent,
      scopedTaskId || null,
    );
    const agentView = currentAgent ? {
      agentId: currentAgent.agentId,
      agentRole: currentAgent.agentRole,
      runtime: currentAgent.runtime,
      runtimeSessionId: currentAgent.runtimeSessionId || null,
      parentAgentId: currentAgent.parentAgentId || null,
      rootAgentId: currentAgent.rootAgentId || currentAgent.agentId,
      depth: currentAgent.depth,
      modelProfile: currentAgent.modelProfile || null,
      resolvedModel: currentAgent.resolvedModel || null,
      autoRegistered: agentBootstrap?.autoRegistered === true,
      humanOperator: currentAgent.humanOperator === true,
    } : null;

    function buildAgentSection() {
      if (!agentView) return null;
      const lines = [
        `agent-id: ${agentView.agentId}`,
        `agent-role: ${agentView.agentRole}`,
        `runtime: ${agentView.runtime}`,
        `depth: ${agentView.depth}`,
        `root-agent-id: ${agentView.rootAgentId}`,
      ];
      if (agentView.parentAgentId) lines.push(`parent-agent-id: ${agentView.parentAgentId}`);
      if (agentView.runtimeSessionId) lines.push(`runtime-session-id: ${agentView.runtimeSessionId}`);
      if (agentView.modelProfile) lines.push(`model-profile: ${agentView.modelProfile}`);
      if (agentView.resolvedModel) lines.push(`resolved-model: ${agentView.resolvedModel}`);
      lines.push(`auto-registered: ${agentView.autoRegistered ? 'yes' : 'no'}`);
      return { title: 'AGENT LANE', content: lines.join('\n') };
    }

    function buildAssignmentsSection() {
      if (
        assignments.self.length === 0 &&
        assignments.activeAgents.length === 0 &&
        assignments.collisions.length === 0 &&
        assignments.staleAgents.length === 0
      ) {
        return null;
      }
      const lines = [];
      if (assignments.self.length > 0) {
        lines.push(`self: ${assignments.self.join(', ')}`);
      }
      if (assignments.activeAgents.length > 0) {
        if (lines.length) lines.push('');
        lines.push('active:');
        for (const row of assignments.activeAgents) {
          lines.push(`- ${row.agentId} [${row.runtime}] role=${row.agentRole} depth=${row.depth} tasks=${row.tasks.join(', ') || '(none)'}`);
        }
      }
      if (assignments.collisions.length > 0) {
        if (lines.length) lines.push('');
        lines.push('collisions:');
        for (const row of assignments.collisions) {
          lines.push(`- ${row.taskId} already claimed by ${row.agentId}${row.runtime ? ` (${row.runtime})` : ''}`);
        }
      }
      if (assignments.staleAgents.length > 0) {
        if (lines.length) lines.push('');
        lines.push('stale:');
        for (const row of assignments.staleAgents) {
          lines.push(`- ${row.agentId} last-seen=${row.lastSeenAt || 'unknown'} tasks=${row.tasks.join(', ') || '(none)'}`);
        }
      }
      return { title: 'ACTIVE ASSIGNMENTS', content: lines.join('\n').trim() };
    }

    function buildDecisionsSection() {
      const decisionsXml = readXmlFile(path.join(planDir, 'DECISIONS.xml'));
      if (!decisionsXml) return null;
      const ALWAYS_INCLUDE = ['gad-04', 'gad-17', 'gad-18'];
      const RECENT_CAP = 15; // last N one-liners; older are summarized as a count
      const decisionRe = /<decision\s+id="([^"]*)">([\s\S]*?)<\/decision>/g;
      const all = [];
      let dm;
      while ((dm = decisionRe.exec(decisionsXml)) !== null) {
        const decId = dm[1];
        const decInner = dm[2];
        const titleMatch = decInner.match(/<title>([\s\S]*?)<\/title>/);
        const title = titleMatch ? titleMatch[1].trim() : '';
        all.push({ id: decId, inner: decInner, title });
      }
      const totalDec = all.length;
      // Title-only for all, including core. Core bodies (gad-04/17/18) are
      // duplicated in CLAUDE.md/AGENTS.md — inlining them here wasted ~500
      // tokens per snapshot. Mark core with ★ for emphasis.
      const nonCore = all.filter((d) => !ALWAYS_INCLUDE.includes(d.id));
      const recent = nonCore.slice(-RECENT_CAP);
      const olderCount = nonCore.length - recent.length;
      const coreLines = all
        .filter((d) => ALWAYS_INCLUDE.includes(d.id))
        .map((d) => `★ ${d.id}: ${d.title.slice(0, 96)}`);
      const recentLines = recent.map((d) => `  ${d.id}: ${d.title.slice(0, 96)}`);
      const sections = [];
      if (coreLines.length) sections.push(coreLines.join('\n'));
      if (olderCount > 0) sections.push(`(+${olderCount} older decisions omitted; \`gad decisions list\` or \`gad decisions show <id>\`)`);
      if (recentLines.length) sections.push(recentLines.join('\n'));
      return {
        title: `DECISIONS (${totalDec} total, ★=core loop — see CLAUDE.md; last ${recent.length} shown, full body via \`gad decisions show <id>\`)`,
        content: sections.join('\n').trim(),
      };
    }

    function buildFileRefsSection() {
      let fileRefs = '';
      if (scopedTask?.files?.length) {
        fileRefs += `Task files:\n${scopedTask.files.join('\n')}\n`;
      }
      if (scopedTask?.commands?.length) {
        fileRefs += `${fileRefs ? '\n' : ''}Task commands:\n${scopedTask.commands.join('\n')}\n`;
      }
      try {
        const { execSync } = require('child_process');
        const projectPath = root.path === '.' ? '' : root.path;
        const gitCmd = projectPath
          ? `git log --oneline -5 -- "${projectPath}"`
          : `git log --oneline -5`;
        const gitLog = execSync(gitCmd, { cwd: baseDir, encoding: 'utf8', timeout: 5000, stdio: ['pipe', 'pipe', 'pipe'] }).trim();
        if (gitLog) fileRefs += `${fileRefs ? '\n' : ''}Recent commits:\n${gitLog}\n`;
        const filesCmd = projectPath
          ? `git log --name-only --pretty=format: -3 -- "${projectPath}"`
          : `git log --name-only --pretty=format: -3`;
        const changedFiles = execSync(filesCmd, { cwd: baseDir, encoding: 'utf8', timeout: 5000, stdio: ['pipe', 'pipe', 'pipe'] }).trim();
        if (changedFiles) fileRefs += `\nRecently changed files:\n${changedFiles}`;
      } catch {}
      return fileRefs.trim() ? { title: 'FILE REFS (git)', content: fileRefs.trim() } : null;
    }

    function buildConventionsSection() {
      let conventions = '';
      const projConventions = readXmlFile(path.join(planDir, 'CONVENTIONS.md'));
      if (projConventions) conventions += projConventions.trim();
      const projAgentsMd = readXmlFile(path.join(baseDir, root.path, 'AGENTS.md'));
      if (projAgentsMd) {
        const convMatch = projAgentsMd.match(/##\s*(Conventions|Style|Coding\s+conventions|Code\s+style)[^\n]*\n([\s\S]*?)(?=\n##\s|\nâ•|$)/i);
        if (convMatch) {
          conventions += (conventions ? '\n\n' : '') + `## ${convMatch[1].trim()}\n${convMatch[2].trim()}`;
        }
      }
      if (!conventions && root.path !== '.') {
        const rootAgentsMd = readXmlFile(path.join(baseDir, 'AGENTS.md'));
        if (rootAgentsMd) {
          const globalConv = rootAgentsMd.match(/##\s*(Conventions|Public site copy)[^\n]*\n([\s\S]*?)(?=\n##\s[A-Z]|\nâ•|$)/i);
          if (globalConv) {
            conventions += `## ${globalConv[1].trim()} (global)\n${globalConv[2].trim()}`;
          }
        }
      }
      return conventions.trim() ? { title: 'CONVENTIONS', content: conventions.trim() } : null;
    }

    // ---- 44-35: encounter-style equipped skills block -------------------
    // Tokenize query (open tasks + next-action + current phase goal) and rank
    // skills (canonical + pending proto-skills) by Jaccard overlap. Skills
    // the agent doesn't see via its runtime dir still appear here, so
    // subagents + post-compact rehydration get the relevance signal.
    function tokenizeForRelevance(text) {
      const STOP = new Set([
        'the','a','an','and','or','but','if','of','for','in','on','to','at','by','from','with','as','is','are','was','were','be','been','being','it','its','this','that','these','those','then','than','which','who','what','when','where','why','how','we','they','their','there','has','have','had','do','does','did','will','would','should','could','can','may','might','must','not','no','yes','so','too','very','just','also','any','all','some','one','two','three','per','into','out','up','down','over','under','before','after','again','once','new','old','use','used','using','via','about','above','below','between','because','while','during','each','other','more','most','less','few','many','much','such','own','same','only','own','get','got','make','made','run','ran','running','shipped','ship','work','working','task','tasks','phase','phases','goal','goals','goal','item','items','thing','things','stuff','plan','planning','done','closed','planned','active','current','next','open','status','good','bad','first','last','need','needs','needed','want','wants'
      ]);
      const raw = String(text || '').toLowerCase();
      const tokens = raw
        .replace(/[`*_#>~]/g, ' ')
        .split(/[^a-z0-9]+/)
        .filter(Boolean)
        .filter((t) => t.length >= 3 && !STOP.has(t));
      return new Set(tokens);
    }
    function jaccard(a, b) {
      if (a.size === 0 || b.size === 0) return 0;
      let intersect = 0;
      for (const t of a) if (b.has(t)) intersect += 1;
      const union = a.size + b.size - intersect;
      return union === 0 ? 0 : intersect / union;
    }
    function buildEquippedSkillsSection(limit) {
      if (!limit || limit <= 0) return null;
      // Build query text from current sprint shape.
      const queryParts = [];
      if (stateXml) {
        const nextAction = (stateXml.match(/<next-action>([\s\S]*?)<\/next-action>/) || [])[1];
        if (nextAction) queryParts.push(nextAction);
      }
      const currentPhaseObj = phases.find((p) => p.id === currentPhase);
      if (currentPhaseObj) {
        if (currentPhaseObj.title) queryParts.push(currentPhaseObj.title);
        if (currentPhaseObj.goal) queryParts.push(currentPhaseObj.goal);
      }
      // Use a small window of open tasks — first 8 — to bias toward what's
      // actually being worked on rather than the long tail of the backlog.
      const openTasksSample = allTasks.filter((t) => t.status !== 'done').slice(0, 8);
      for (const t of openTasksSample) {
        if (t.goal) queryParts.push(String(t.goal).slice(0, 240));
      }
      const queryText = queryParts.join(' ');
      const queryTokens = tokenizeForRelevance(queryText);
      if (queryTokens.size === 0) return null;

      const skillsRoot = path.join(repoRoot, 'skills');
      const protoRoot = path.join(repoRoot, '.planning', 'proto-skills');
      const entries = [];
      try {
        for (const s of listSkillDirs(skillsRoot)) {
          const fm = readSkillFrontmatter(s.skillFile);
          const searchText = [s.id, fm.name || '', fm.description || ''].join(' ');
          const score = jaccard(queryTokens, tokenizeForRelevance(searchText));
          if (score > 0) entries.push({ id: s.id, name: fm.name || s.id, description: fm.description || '', workflow: fm.workflow || null, score, kind: 'canonical' });
        }
      } catch {}
      try {
        for (const s of listSkillDirs(protoRoot)) {
          const fm = readSkillFrontmatter(s.skillFile);
          const searchText = [s.id, fm.name || '', fm.description || ''].join(' ');
          const score = jaccard(queryTokens, tokenizeForRelevance(searchText));
          // Proto-skills get a small boost so they surface even against
          // many-decades-old canonical skills with overlapping descriptions.
          if (score > 0) entries.push({ id: s.id, name: fm.name || s.id, description: fm.description || '', workflow: fm.workflow || null, score: score * 1.1, kind: 'proto' });
        }
      } catch {}

      if (entries.length === 0) return null;
      entries.sort((a, b) => b.score - a.score);
      const picked = entries.slice(0, limit);
      // Per decision gad-192: surface the `workflow:` frontmatter pointer
      // alongside the description so the agent sees where the procedural
      // body lives without a second read.
      const lines = picked.map((e) => {
        const tag = e.kind === 'proto' ? ' (proto — `gad skill promote <slug> --project --claude` to equip)' : '';
        const descFrag = (e.description || '').replace(/\s+/g, ' ').slice(0, 160);
        const workflowFrag = e.workflow ? ` → ${e.workflow}` : '';
        return `  ${e.id}${workflowFrag}${tag}\n    ${descFrag}`;
      });
      // Hard-cap the body at ~2000 chars (~500 tokens) so the block never blows budget.
      let body = lines.join('\n');
      if (body.length > 2000) body = body.slice(0, 1970).trimEnd() + '\n    [truncated]';
      return { title: `EQUIPPED SKILLS (top ${picked.length} by relevance)`, content: body };
    }

    function collectFullFiles() {
      const allFiles = [];
      const PRIORITY = ['AGENTS.md', 'STATE.md', 'STATE.xml', 'ROADMAP.md', 'ROADMAP.xml', 'REQUIREMENTS.md', 'REQUIREMENTS.xml', 'DECISIONS.xml', 'TASK-REGISTRY.xml', 'session.md', 'ERRORS-AND-ATTEMPTS.xml'];
      function collectDir(dir, relBase) {
        if (!fs.existsSync(dir)) return;
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
          const rel = relBase ? `${relBase}/${entry.name}` : entry.name;
          if (entry.isDirectory()) {
            if (entry.name === 'archive' || entry.name === 'sessions' || entry.name === 'node_modules') continue;
            collectDir(path.join(dir, entry.name), rel);
          } else if (entry.isFile()) {
            allFiles.push(rel);
          }
        }
      }
      collectDir(planDir, '');
      allFiles.sort((a, b) => {
        const aIdx = PRIORITY.indexOf(path.basename(a));
        const bIdx = PRIORITY.indexOf(path.basename(b));
        if (aIdx !== -1 && bIdx === -1) return -1;
        if (bIdx !== -1 && aIdx === -1) return 1;
        if (aIdx !== -1 && bIdx !== -1) return aIdx - bIdx;
        return a.localeCompare(b);
      });
      return allFiles;
    }

    if (useFull) {
      const allFiles = collectFullFiles();
      if (args.json || shouldUseJson()) {
        const files = allFiles.map((rel) => {
          let content = null;
          try { content = fs.readFileSync(path.join(planDir, rel), 'utf8'); } catch {}
          return { path: `${root.planningDir}/${rel}`, content };
        });
        console.log(JSON.stringify({
          project: root.id,
          mode: 'full',
          planningDir: root.planningDir,
          scope,
          agent: agentView,
          assignments,
          sdkAssetAliases,
          files,
        }, null, 2));
        return;
      }

      console.log(`\nSnapshot (full): ${root.id} - ${allFiles.length} files\n`);
      console.log('SDK asset aliases:');
      for (const [alias, relPath] of Object.entries(sdkAssetAliases)) {
        console.log(`- ${alias}/... -> ${relPath}/...`);
      }
      if (agentView) {
        console.log('\nAgent lane:');
        console.log(`- ${agentView.agentId} [${agentView.runtime}] role=${agentView.agentRole} depth=${agentView.depth}`);
      }
      if (assignments.activeAgents.length > 0) {
        console.log('\nActive assignments:');
        for (const row of assignments.activeAgents) {
          console.log(`- ${row.agentId} tasks=${row.tasks.join(', ') || '(none)'}`);
        }
      }
      console.log('');
      for (const rel of allFiles) {
        console.log(`${'='.repeat(70)}`);
        console.log(`## ${root.planningDir}/${rel}`);
        console.log(`${'='.repeat(70)}`);
        try { console.log(fs.readFileSync(path.join(planDir, rel), 'utf8')); } catch { console.log('(unreadable)'); }
        console.log('');
      }
      console.log(`=== end snapshot (${allFiles.length} files) ===`);
      return;
    }

    const compactFmt = (args.format || 'compact').toLowerCase() !== 'xml';

    if (scope.isScoped) {
      const sections = [];
      sections.push({
        title: 'SDK ASSET ALIASES',
        content: Object.entries(sdkAssetAliases).map(([alias, relPath]) => `${alias}/... -> ${relPath}/...`).join('\n'),
      });
      const agentSection = buildAgentSection();
      if (agentSection) sections.push(agentSection);
      const assignmentsSection = buildAssignmentsSection();
      if (assignmentsSection) sections.push(assignmentsSection);
      if (stateXml) {
        const stateContent = compactFmt ? compactStateXml(stateXml) : stateXml.trim();
        sections.push({ title: 'STATE', content: stateContent });
      }
      if (scopedPhaseId) {
        const phase = phases.find((row) => row.id === scopedPhaseId);
        if (phase) {
          sections.push({
            title: `ROADMAP PHASE ${phase.id}`,
            content: `<phase id="${phase.id}">\n  <title>${phase.title || ''}</title>\n  <goal>${phase.goal || ''}</goal>\n  <status>${phase.status}</status>\n  <depends>${phase.depends || ''}</depends>\n</phase>`,
          });
        }
      }
      if (scopedTask) {
        const attrs = [
          `id="${scopedTask.id}"`,
          `status="${scopedTask.status}"`,
          scopedTask.agentId ? `agent-id="${scopedTask.agentId}"` : '',
          scopedTask.agentRole ? `agent-role="${scopedTask.agentRole}"` : '',
          scopedTask.runtime ? `runtime="${scopedTask.runtime}"` : '',
          scopedTask.modelProfile ? `model-profile="${scopedTask.modelProfile}"` : '',
          scopedTask.resolvedModel ? `resolved-model="${scopedTask.resolvedModel}"` : '',
          scopedTask.claimedAt ? `claimed-at="${scopedTask.claimedAt}"` : '',
          scopedTask.skill ? `skill="${scopedTask.skill}"` : '',
          scopedTask.type ? `type="${scopedTask.type}"` : '',
        ].filter(Boolean).join(' ');
        sections.push({
          title: `TASK ${scopedTask.id}`,
          content: `<task ${attrs}>\n  <goal>${scopedTask.goal || ''}</goal>\n  <keywords>${scopedTask.keywords || ''}</keywords>\n  <depends>${scopedTask.depends || ''}</depends>\n</task>`,
        });
        const peerTasks = allTasks.filter((task) => task.phase === scopedTask.phase && task.id !== scopedTask.id && task.status !== 'done');
        if (peerTasks.length > 0) {
          sections.push({
            title: `PHASE ${scopedTask.phase} OPEN TASKS`,
            content: peerTasks.map((task) =>
              `<task id="${task.id}" status="${task.status}"${task.agentId ? ` agent-id="${task.agentId}"` : ''}><goal>${(task.goal || '').slice(0, 220)}</goal></task>`
            ).join('\n'),
          });
        }
      } else {
        const phaseTasks = allTasks.filter((task) => task.phase === scopedPhaseId && task.status !== 'done');
        sections.push({
          title: `PHASE ${scopedPhaseId} OPEN TASKS`,
          content: phaseTasks.length > 0
            ? phaseTasks.map((task) =>
              `<task id="${task.id}" status="${task.status}"${task.agentId ? ` agent-id="${task.agentId}"` : ''}><goal>${(task.goal || '').slice(0, 220)}</goal></task>`
            ).join('\n')
            : '(no open tasks in scoped phase)',
        });
      }
      const scopedHandoffsSection = buildHandoffsSection({
        baseDir,
        projectid: root.id,
        runtime: resolveDetectedRuntimeId(),
      });
      if (scopedHandoffsSection) sections.push(scopedHandoffsSection);
      const scopedEvolutionSection = buildEvolutionSection(root, baseDir);
      if (scopedEvolutionSection) sections.push(scopedEvolutionSection);
      const scopedDecisionsSection = buildDecisionsSection();
      if (scopedDecisionsSection) sections.push(scopedDecisionsSection);
      const scopedFileRefsSection = buildFileRefsSection();
      if (scopedFileRefsSection) sections.push(scopedFileRefsSection);
      const scopedConventionsSection = buildConventionsSection();
      if (scopedConventionsSection) sections.push(scopedConventionsSection);
      const scopedSkillsLimit = Number.parseInt(String(args.skills || '5'), 10) || 0;
      const scopedEquippedSkillsSection = buildEquippedSkillsSection(scopedSkillsLimit);
      if (scopedEquippedSkillsSection) sections.push(scopedEquippedSkillsSection);
      const docsMapXml = readXmlFile(path.join(planDir, 'DOCS-MAP.xml'));
      if (docsMapXml) sections.push({ title: 'DOCS-MAP.xml', content: docsMapXml.trim() });

      if (args.json || shouldUseJson()) {
        console.log(JSON.stringify({
          project: root.id,
          mode: 'scoped',
          scope,
          agent: agentView,
          assignments,
          sdkAssetAliases,
          sections: sections.map((section) => ({ title: section.title, content: section.content })),
        }, null, 2));
        return;
      }

      console.log(`\nSnapshot (scoped ${scope.snapshotMode}): ${root.id}${scope.phaseId ? ` - phase ${scope.phaseId}` : ''}${scope.taskId ? ` - task ${scope.taskId}` : ''}\n`);
      for (const section of sections) {
        console.log(`-- ${section.title} ${'-'.repeat(Math.max(0, 60 - section.title.length))}`);
        console.log(section.content);
        console.log('');
      }
      const totalChars = sections.reduce((sum, section) => sum + section.content.length, 0);
      console.log(`-- end snapshot (~${Math.round(totalChars / 4)} tokens) --`);
      return;
    }

    const k = getCurrentSprintIndex(phases, sprintSize, currentPhase);
    const sprintPhaseIds = getSprintPhaseIds(phases, sprintSize, k);
    const sections = [];
    sections.push({
      title: 'SDK ASSET ALIASES',
      content: Object.entries(sdkAssetAliases).map(([alias, relPath]) => `${alias}/... -> ${relPath}/...`).join('\n'),
    });
    const sprintAgentSection = buildAgentSection();
    if (sprintAgentSection) sections.push(sprintAgentSection);
    const sprintAssignmentsSection = buildAssignmentsSection();
    if (sprintAssignmentsSection) sections.push(sprintAssignmentsSection);
    const useCompact = compactFmt;
    if (stateXml) {
      const stateContent = useCompact ? compactStateXml(stateXml) : stateXml.trim();
      sections.push({ title: 'STATE', content: stateContent });
    }

    let roadmapSection = '';
    let outOfSprintCount = 0;
    for (const phase of phases) {
      if (sprintPhaseIds.includes(phase.id)) {
        const goalSlice = (phase.goal || '').slice(0, 240);
        const dependsAttr = phase.depends ? ` depends="${phase.depends}"` : '';
        roadmapSection += `<phase id="${phase.id}" status="${phase.status}"${dependsAttr}>${phase.title || ''}: ${goalSlice}</phase>\n`;
      } else {
        outOfSprintCount += 1;
      }
    }
    if (outOfSprintCount > 0) {
      roadmapSection += `(+${outOfSprintCount} out-of-sprint phases — see .planning/ROADMAP.xml)`;
    }
    const roadmapContent = useCompact ? compactRoadmapSection(roadmapSection.trim()) : roadmapSection.trim();
    sections.push({ title: `ROADMAP (sprint ${k}, phases ${sprintPhaseIds.join(',')})`, content: roadmapContent });

    // Graph-backed task listing for sprint snapshot (decision gad-201, gad-202)
    // Filters out cancelled (permanent history, not actionable) and scopes
    // to current-sprint phases by default (decision: snapshot bloat audit,
    // 2026-04-18). Out-of-sprint open tasks are counted but not listed —
    // `gad tasks --projectid <id>` shows the full set on demand.
    const sprintPhaseIdSet = new Set(sprintPhaseIds.map(String));
    const isSprintPhase = (phaseId) => sprintPhaseIdSet.has(String(phaseId));
    const sprintUseGraph = graphExtractor.isGraphQueryEnabled(path.join(baseDir, root.path));
    let sprintOpenTasks, sprintTasksSection = '', sprintDoneCount;
    let outOfSprintOpenCount = 0;
    if (sprintUseGraph) {
      // Task 63-graph-task-stale: invalidate on TASK-REGISTRY.xml mtime,
      // honouring readOnlySnapshot so concurrent agents don't race on
      // the file write. When read-only and the cache is missing/stale,
      // the helper still returns a freshly-built graph in memory.
      const gadDir = repoRoot;
      const { graph: sprintGraph } = graphExtractor.loadOrBuildGraph(root, baseDir, {
        gadDir,
        readOnly: readOnlySnapshot,
      });
      if (sprintGraph) {
        const sprintAllResult = graphExtractor.queryGraph(sprintGraph, { type: 'task' });
        const sprintAllMatches = sprintAllResult.matches || [];
        const sprintOpenMatches = sprintAllMatches.filter(m => m.status !== 'done' && m.status !== 'cancelled');
        sprintDoneCount = sprintAllMatches.filter(m => m.status === 'done').length;
        const inSprintOpenMatches = sprintOpenMatches.filter(m => {
          const taskPhase = m.id.replace(/^task:/, '').split('-')[0];
          return isSprintPhase(taskPhase);
        });
        outOfSprintOpenCount = sprintOpenMatches.length - inSprintOpenMatches.length;
        if (inSprintOpenMatches.length > 0) {
          let currentTaskPhase = '';
          for (const m of inSprintOpenMatches) {
            const taskId = m.id.replace(/^task:/, '');
            const taskPhase = taskId.split('-')[0];
            if (taskPhase !== currentTaskPhase) {
              currentTaskPhase = taskPhase;
              sprintTasksSection += `\n  <phase id="${taskPhase.padStart(2, '0')}">\n`;
            }
            const goalText = (m.goal || m.label || '').slice(0, 120);
            const extraAttrs = [
              m.skill ? `skill="${m.skill}"` : '',
              m.type ? `type="${m.type}"` : '',
            ].filter(Boolean).join(' ');
            const attrStr = extraAttrs ? ` ${extraAttrs}` : '';
            sprintTasksSection += `    <task id="${taskId}" status="${m.status}"${attrStr}>${goalText}</task>\n`;
          }
        }
        sprintOpenTasks = inSprintOpenMatches;
      } else {
        sprintDoneCount = allTasks.filter(t => t.status === 'done').length;
        sprintOpenTasks = [];
      }
    } else {
      const allOpenTasks = allTasks.filter((task) => task.status !== 'done' && task.status !== 'cancelled');
      const inSprintOpenTasks = allOpenTasks.filter((task) => {
        const taskPhase = task.id ? task.id.split('-')[0] : '';
        return isSprintPhase(taskPhase);
      });
      outOfSprintOpenCount = allOpenTasks.length - inSprintOpenTasks.length;
      sprintOpenTasks = inSprintOpenTasks;
      if (inSprintOpenTasks.length > 0) {
        let currentTaskPhase = '';
        for (const task of inSprintOpenTasks) {
          const taskPhase = task.id ? task.id.split('-')[0] : '';
          if (taskPhase !== currentTaskPhase) {
            currentTaskPhase = taskPhase;
            sprintTasksSection += `\n  <phase id="${taskPhase.padStart(2, '0')}">\n`;
          }
          const goalText = (task.goal || '').slice(0, 120);
          const extraAttrs = [
            task.skill ? `skill="${task.skill}"` : '',
            task.type ? `type="${task.type}"` : '',
            task.agentId ? `agent-id="${task.agentId}"` : '',
          ].filter(Boolean).join(' ');
          const attrStr = extraAttrs ? ` ${extraAttrs}` : '';
          sprintTasksSection += `    <task id="${task.id}" status="${task.status}"${attrStr}>${goalText}</task>\n`;
        }
      }
      sprintDoneCount = allTasks.filter(t => t.status === 'done').length;
    }
    if (outOfSprintOpenCount > 0) {
      sprintTasksSection += `\n(+${outOfSprintOpenCount} open out-of-sprint — see \`gad tasks --projectid ${root.id}\`)\n`;
    }
    const tasksContent = (() => {
      const raw = sprintTasksSection.trim() || '(no open sprint tasks)';
      return useCompact ? compactTasksSection(raw) : raw;
    })();
    const tasksTitle = outOfSprintOpenCount > 0
      ? `TASKS (${sprintOpenTasks.length} sprint, +${outOfSprintOpenCount} out-of-sprint, ${sprintDoneCount} done)`
      : `TASKS (${sprintOpenTasks.length} open, ${sprintDoneCount} done)`;
    sections.push({ title: tasksTitle, content: tasksContent });
    const sprintHandoffsSection = buildHandoffsSection({
      baseDir,
      projectid: root.id,
      runtime: resolveDetectedRuntimeId(),
    });
    if (sprintHandoffsSection) sections.push(sprintHandoffsSection);
    const sprintEvolutionSection = buildEvolutionSection(root, baseDir);
    if (sprintEvolutionSection) sections.push(sprintEvolutionSection);

    // Decision gad-259 (2026-04-17): DAILY section retired. See function-site
    // comment above where buildDailySection used to live.

    // Decision gad-195: --mode=active emits ONLY the changing state —
    // STATE.xml (next-action), ROADMAP (sprint phases), TASKS (open sprint).
    // Static sections (decisions, file refs, conventions, equipped skills,
    // docs-map) are loaded once at session start via --mode=full (default)
    // and NOT re-emitted mid-session. This is the session-scoped snapshot
    // contract that prevents redundant context re-loading.
    const isActiveMode = resolvedMode === 'active';
    if (!isActiveMode) {
      const sprintDecisionsSection = buildDecisionsSection();
      if (sprintDecisionsSection) sections.push(sprintDecisionsSection);
      const sprintFileRefsSection = buildFileRefsSection();
      if (sprintFileRefsSection) sections.push(sprintFileRefsSection);
      const sprintConventionsSection = buildConventionsSection();
      if (sprintConventionsSection) sections.push(sprintConventionsSection);
      const skillsLimit = Number.parseInt(String(args.skills || '5'), 10) || 0;
      const sprintEquippedSkillsSection = buildEquippedSkillsSection(skillsLimit);
      if (sprintEquippedSkillsSection) sections.push(sprintEquippedSkillsSection);
      const docsMapXml = readXmlFile(path.join(planDir, 'DOCS-MAP.xml'));
      if (docsMapXml) sections.push({ title: 'DOCS-MAP.xml', content: docsMapXml.trim() });

      // Graph stats section (decision gad-201, freshness via 63-graph-task-stale)
      if (graphExtractor.isGraphQueryEnabled(path.join(baseDir, root.path))) {
        const gadDir = repoRoot;
        const { graph } = graphExtractor.loadOrBuildGraph(root, baseDir, {
          gadDir,
          readOnly: readOnlySnapshot,
        });
        if (graph && graph.meta) {
          const lines = [];
          lines.push(`${graph.meta.nodeCount} nodes, ${graph.meta.edgeCount} edges`);
          lines.push(`Types: ${Object.entries(graph.meta.nodeTypes).map(([k, v]) => `${k}(${v})`).join(', ')}`);
          lines.push(`Last rebuild: ${graph.meta.generated}`);
          // Top 5 most-connected nodes by edge count
          const edgeCounts = new Map();
          for (const e of graph.edges) {
            edgeCounts.set(e.source, (edgeCounts.get(e.source) || 0) + 1);
            edgeCounts.set(e.target, (edgeCounts.get(e.target) || 0) + 1);
          }
          const topNodes = [...edgeCounts.entries()]
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5);
          if (topNodes.length > 0) {
            lines.push('');
            lines.push('Most-connected:');
            for (const [nodeId, count] of topNodes) {
              const node = graph.nodes.find(n => n.id === nodeId);
              const label = node ? (node.label || '').slice(0, 60) : '';
              lines.push(`  ${nodeId} (${count} edges)${label ? ' — ' + label : ''}`);
            }
          }
          lines.push('');
          lines.push('Query: `gad query "open tasks in phase X"` — 12.9x token savings vs raw XML');
          sections.push({ title: 'GRAPH', content: lines.join('\n') });
        }
      }
    }

    // Stamp session after building sections, before output.
    if (snapshotSession && !readOnlySnapshot) {
      const now = new Date().toISOString();
      snapshotSession.lastSnapshotAt = now;
      if (!isActiveMode) snapshotSession.staticLoadedAt = now;
      writeSession(snapshotSession);
    }

    const sessionSuffix = snapshotSession
      ? `  session=${snapshotSession.id}${isActiveMode ? ' (active-only, static elided)' : ''}`
      : '';

    if (args.json || shouldUseJson()) {
      console.log(JSON.stringify({
        project: root.id,
        mode: isActiveMode ? 'active' : 'sprint',
        session: snapshotSession ? snapshotSession.id : null,
        scope,
        agent: agentView,
        assignments,
        sprintIndex: k,
        sprintPhaseIds,
        sections: sections.map((section) => ({ title: section.title, content: section.content })),
      }, null, 2));
      return;
    }

    const modeTag = isActiveMode ? 'active' : `sprint ${k}`;
    console.log(`\nSnapshot (${modeTag}): ${root.id} - phases ${sprintPhaseIds.join(', ')}${sessionSuffix}\n`);
    for (const section of sections) {
      console.log(`-- ${section.title} ${'-'.repeat(Math.max(0, 60 - section.title.length))}`);
      console.log(section.content);
      console.log('');
    }
    const totalChars = sections.reduce((sum, section) => sum + section.content.length, 0);
    console.log(`-- end snapshot (~${Math.round(totalChars / 4)} tokens) --`);
    if (snapshotSession) {
      console.log(`Reuse: --session ${snapshotSession.id}  (next call auto-downgrades to active mode)`);
    }
  },
});
}

module.exports = { createSnapshotCommand };
module.exports.register = (ctx) => ({
  snapshot: createSnapshotCommand({
    ...ctx.common,
    ...ctx.extras.snapshot,
    loadSessions: ctx.services.session.helpers.loadSessions,
    writeSession: ctx.services.session.writeSession,
    getCurrentSprintIndex: ctx.services.sprint.getCurrentSprintIndex,
    getSprintPhaseIds: ctx.services.sprint.getSprintPhaseIds,
  }),
});
