'use strict';

const path = require('path');
const {
  buildAgentSection,
  buildAssignmentsSection,
  buildDecisionsSection,
  buildFileRefsSection,
  buildConventionsSection,
} = require('../../../lib/snapshot-sections.cjs');
const { buildEquippedSkillsSection } = require('../../../lib/snapshot-equipped-skills.cjs');
const { buildHealthSection } = require('../../../lib/snapshot-health-rollup.cjs');
const { buildAgentPresenceSection } = require('../../../lib/snapshot-agent-presence-section.cjs');
const { buildSprintTaskSection } = require('./sprint-tasks.cjs');
const { maybeBuildGraphSection, stampSnapshotSession } = require('./sprint-runtime.cjs');
const { buildCrossProjectHandoffsSection } = require('../../../lib/snapshot-cross-project-section.cjs');

function handleSprintSnapshot(deps, context, args) {
  const {
    baseDir,
    root,
    planDir,
    sprintSize,
    resolvedMode,
    snapshotSession,
    scope,
    agentView,
    assignments,
    sdkAssetAliases,
    phases,
    currentPhase,
    stateXml,
    nextAction,
    allTasks,
  } = context;

  const sprintIndex = deps.getCurrentSprintIndex(phases, sprintSize, currentPhase);
  const sprintPhaseIds = deps.getSprintPhaseIds(phases, sprintSize, sprintIndex);
  const sections = [];
  const compactFmt = (args.format || 'compact').toLowerCase() !== 'xml';

  sections.push({
    title: 'SDK ASSET ALIASES',
    content: Object.entries(sdkAssetAliases).map(([alias, relPath]) => `${alias}/... -> ${relPath}/...`).join('\n'),
  });
  const sprintAgentSection = buildAgentSection(agentView);
  if (sprintAgentSection) sections.push(sprintAgentSection);
  const sprintAssignmentsSection = buildAssignmentsSection(assignments);
  if (sprintAssignmentsSection) sections.push(sprintAssignmentsSection);
  if (stateXml) {
    const stateContent = compactFmt ? deps.compactStateXml(stateXml, nextAction) : stateXml.trim();
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
  const roadmapContent = compactFmt ? deps.compactRoadmapSection(roadmapSection.trim()) : roadmapSection.trim();
  sections.push({ title: `ROADMAP (sprint ${sprintIndex}, phases ${sprintPhaseIds.join(',')})`, content: roadmapContent });

  const sprintTaskData = buildSprintTaskSection(deps, context, sprintPhaseIds);
  const tasksContent = (() => {
    const raw = sprintTaskData.sprintTasksSection.trim() || '(no open sprint tasks)';
    return compactFmt ? deps.compactTasksSection(raw) : raw;
  })();
  const tasksTitle = sprintTaskData.outOfSprintOpenCount > 0
    ? `TASKS (${sprintTaskData.sprintOpenTasks.length} sprint, +${sprintTaskData.outOfSprintOpenCount} out-of-sprint, ${sprintTaskData.sprintDoneCount} done)`
    : `TASKS (${sprintTaskData.sprintOpenTasks.length} open, ${sprintTaskData.sprintDoneCount} done)`;
  sections.push({ title: tasksTitle, content: tasksContent });

  const sprintHandoffsSection = deps.buildHandoffsSection({
    baseDir,
    projectid: root.id,
    runtime: deps.resolveDetectedRuntimeId(),
  });
  if (sprintHandoffsSection) sections.push(sprintHandoffsSection);

  // GLOBAL-D-323 Phase A — cross-project handoffs aggregation
  try {
    const _crossConfig = deps.gadConfig ? deps.gadConfig.load(baseDir) : null;
    if (_crossConfig) {
      const crossSection = buildCrossProjectHandoffsSection({
        baseDir,
        projectid: root.id,
        gadConfig: _crossConfig,
        render: deps.render,
      });
      if (crossSection) sections.push(crossSection);
    }
  } catch (_crossErr) {
    // Never let cross-project scan break the main snapshot
    try { process.stderr.write(`[snapshot] cross-project handoffs scan failed (non-fatal): ${_crossErr.message}\n`); } catch {}
  }

  // GLOBAL-D-323 Phase B — agent presence ledger
  let _presenceConfig = null;
  try { _presenceConfig = deps.gadConfig ? deps.gadConfig.load(baseDir) : null; } catch {}
  const agentPresenceSection = buildAgentPresenceSection({ baseDir, config: _presenceConfig });
  if (agentPresenceSection) sections.push(agentPresenceSection);

  // Task 265-19: Surface subagent dispatch protocol
  // Shows in both full and active modes — it's a standing rule every session needs
  const subagentDispatchContent = [
    'haiku — clear-contract panel insertion, mechanical refactor, file rewrite from spec, audit-and-list',
    'sonnet — architecture detection (vendor-synced files, shared state, iframe vs refactor), cross-file invariant work',
    'opus — new protocol design, multi-system integration, decisions-then-code, parallel agent coordination',
    '',
    'Standing rules: pass explicit model: to Agent tool. Concurrent dispatch 3-5 in parallel. Subagents stage explicit files only (no git add -A). DO NOT commit — main thread serializes.',
  ].join('\n');
  sections.push({ title: 'SUBAGENT DISPATCH PROTOCOL', content: subagentDispatchContent });

  const sprintEvolutionSection = deps.buildEvolutionSection(root, baseDir);
  if (sprintEvolutionSection) sections.push(sprintEvolutionSection);

  const isActiveMode = resolvedMode === 'active';
  if (!isActiveMode) {
    const sprintDecisionsSection = buildDecisionsSection({ readXmlFile: deps.readXmlFile, planDir });
    if (sprintDecisionsSection) sections.push(sprintDecisionsSection);
    const sprintFileRefsSection = buildFileRefsSection({ scopedTask: null, root, baseDir });
    if (sprintFileRefsSection) sections.push(sprintFileRefsSection);
    const sprintConventionsSection = buildConventionsSection({ readXmlFile: deps.readXmlFile, planDir, baseDir, root });
    if (sprintConventionsSection) sections.push(sprintConventionsSection);
    const skillsLimit = Number.parseInt(String(args.skills || '5'), 10) || 0;
    const sprintEquippedSkillsSection = buildEquippedSkillsSection({
      limit: skillsLimit,
      stateXml,
      phases,
      currentPhase,
      allTasks,
      repoRoot: deps.repoRoot,
      listSkillDirs: deps.listSkillDirs,
      readSkillFrontmatter: deps.readSkillFrontmatter,
    });
    if (sprintEquippedSkillsSection) sections.push(sprintEquippedSkillsSection);
    const docsMapXml = deps.readXmlFile(path.join(planDir, 'DOCS-MAP.xml'));
    if (docsMapXml) sections.push({ title: 'DOCS-MAP.xml', content: docsMapXml.trim() });
    const graphSection = maybeBuildGraphSection(deps, context);
    if (graphSection) sections.push(graphSection);
  }

  const healthSection = buildHealthSection(baseDir);
  if (healthSection) sections.push(healthSection);

  stampSnapshotSession(deps, context, isActiveMode);

  const sessionSuffix = snapshotSession
    ? `  session=${snapshotSession.id}${isActiveMode ? ' (active-only, static elided)' : ''}`
    : '';

  if (args.json || deps.shouldUseJson()) {
    // Extract cross_project_handoffs array from the section if present
    const _crossSection = sections.find((s) => s.cross_project_handoffs);
    console.log(JSON.stringify({
      project: root.id,
      mode: isActiveMode ? 'active' : 'sprint',
      session: snapshotSession ? snapshotSession.id : null,
      scope,
      agent: agentView,
      assignments,
      sprintIndex,
      sprintPhaseIds,
      cross_project_handoffs: _crossSection ? _crossSection.cross_project_handoffs : [],
      sections: deps.buildSnapshotSectionPayload(sections),
    }, null, 2));
    return;
  }

  const modeTag = isActiveMode ? 'active' : `sprint ${sprintIndex}`;
  console.log(`\nSnapshot (${modeTag}): ${root.id} - phases ${sprintPhaseIds.join(', ')}${sessionSuffix}\n`);
  printActiveHandoff(deps, context);
  deps.printSections(sections);
  console.log(`-- end snapshot (~${deps.countSectionTokensApprox(sections)} tokens) --`);
  if (snapshotSession) {
    console.log(`Reuse: --session ${snapshotSession.id}  (next call auto-downgrades to active mode)`);
  }
}

// Operator 2026-05-19: snapshot should auto-surface the rolling handoff doc
// at .planning/HANDOFF.md so the next-session agent can't miss it. Single
// canonical file (not the timestamped handoff queue under .planning/handoffs/
// — that's the work-stealing queue for inter-agent task passing). When this
// file exists, snapshot prints it inline as the first section after the
// header. Operator updates it on session close; new session reads it
// automatically via the normal `gad snapshot` call.
function printActiveHandoff(deps, context) {
  const path = require('path');
  const fs = require('fs');
  const baseDir = deps.findRepoRoot();
  const root = context.root;
  if (!root) return;
  const handoffPath = path.join(baseDir, root.path, root.planningDir, 'HANDOFF.md');
  if (!fs.existsSync(handoffPath)) return;
  let content = '';
  let stat;
  try {
    content = fs.readFileSync(handoffPath, 'utf8');
    stat = fs.statSync(handoffPath);
  } catch {
    return;
  }
  if (!content.trim()) return;
  const ageHours = stat ? Math.round((Date.now() - stat.mtimeMs) / 3_600_000) : null;
  const ageLabel = ageHours == null ? '' : ageHours < 1 ? ' (<1h old)' :
                   ageHours < 24 ? ` (${ageHours}h old)` :
                   ` (${Math.round(ageHours / 24)}d old)`;
  console.log(`-- HANDOFF (${path.relative(baseDir, handoffPath).replace(/\\/g, '/')}${ageLabel}) -------------------`);
  console.log(content.trim());
  console.log('-- end HANDOFF — clear / overwrite when read so next session sees fresh content --\n');
}

module.exports = { handleSprintSnapshot };
