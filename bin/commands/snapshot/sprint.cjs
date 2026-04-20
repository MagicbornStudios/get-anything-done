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
const { buildSprintTaskSection } = require('./sprint-tasks.cjs');
const { maybeBuildGraphSection, stampSnapshotSession } = require('./sprint-runtime.cjs');

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
    const stateContent = compactFmt ? deps.compactStateXml(stateXml) : stateXml.trim();
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

  stampSnapshotSession(deps, context, isActiveMode);

  const sessionSuffix = snapshotSession
    ? `  session=${snapshotSession.id}${isActiveMode ? ' (active-only, static elided)' : ''}`
    : '';

  if (args.json || deps.shouldUseJson()) {
    console.log(JSON.stringify({
      project: root.id,
      mode: isActiveMode ? 'active' : 'sprint',
      session: snapshotSession ? snapshotSession.id : null,
      scope,
      agent: agentView,
      assignments,
      sprintIndex,
      sprintPhaseIds,
      sections: deps.buildSnapshotSectionPayload(sections),
    }, null, 2));
    return;
  }

  const modeTag = isActiveMode ? 'active' : `sprint ${sprintIndex}`;
  console.log(`\nSnapshot (${modeTag}): ${root.id} - phases ${sprintPhaseIds.join(', ')}${sessionSuffix}\n`);
  deps.printSections(sections);
  console.log(`-- end snapshot (~${deps.countSectionTokensApprox(sections)} tokens) --`);
  if (snapshotSession) {
    console.log(`Reuse: --session ${snapshotSession.id}  (next call auto-downgrades to active mode)`);
  }
}

module.exports = { handleSprintSnapshot };
