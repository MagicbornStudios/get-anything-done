'use strict';

const path = require('path');
const {
  buildDecisionsSection,
  buildFileRefsSection,
  buildConventionsSection,
  buildAgentSection,
  buildAssignmentsSection,
} = require('../../../lib/snapshot-sections.cjs');
const { buildEquippedSkillsSection } = require('../../../lib/snapshot-equipped-skills.cjs');

function handleScopedSnapshot(deps, context, args) {
  const {
    baseDir,
    root,
    planDir,
    scope,
    sdkAssetAliases,
    agentView,
    assignments,
    stateXml,
    phases,
    scopedPhaseId,
    scopedTask,
    allTasks,
    currentPhase,
  } = context;

  const compactFmt = (args.format || 'compact').toLowerCase() !== 'xml';
  const sections = [];
  sections.push({
    title: 'SDK ASSET ALIASES',
    content: Object.entries(sdkAssetAliases).map(([alias, relPath]) => `${alias}/... -> ${relPath}/...`).join('\n'),
  });
  const agentSection = buildAgentSection(agentView);
  if (agentSection) sections.push(agentSection);
  const assignmentsSection = buildAssignmentsSection(assignments);
  if (assignmentsSection) sections.push(assignmentsSection);
  if (stateXml) {
    const stateContent = compactFmt ? deps.compactStateXml(stateXml) : stateXml.trim();
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
  const scopedHandoffsSection = deps.buildHandoffsSection({
    baseDir,
    projectid: root.id,
    runtime: deps.resolveDetectedRuntimeId(),
  });
  if (scopedHandoffsSection) sections.push(scopedHandoffsSection);
  const scopedEvolutionSection = deps.buildEvolutionSection(root, baseDir);
  if (scopedEvolutionSection) sections.push(scopedEvolutionSection);
  const scopedDecisionsSection = buildDecisionsSection({ readXmlFile: deps.readXmlFile, planDir });
  if (scopedDecisionsSection) sections.push(scopedDecisionsSection);
  const scopedFileRefsSection = buildFileRefsSection({ scopedTask, root, baseDir });
  if (scopedFileRefsSection) sections.push(scopedFileRefsSection);
  const scopedConventionsSection = buildConventionsSection({ readXmlFile: deps.readXmlFile, planDir, baseDir, root });
  if (scopedConventionsSection) sections.push(scopedConventionsSection);
  const scopedSkillsLimit = Number.parseInt(String(args.skills || '5'), 10) || 0;
  const scopedEquippedSkillsSection = buildEquippedSkillsSection({
    limit: scopedSkillsLimit,
    stateXml,
    phases,
    currentPhase,
    allTasks,
    repoRoot: deps.repoRoot,
    listSkillDirs: deps.listSkillDirs,
    readSkillFrontmatter: deps.readSkillFrontmatter,
  });
  if (scopedEquippedSkillsSection) sections.push(scopedEquippedSkillsSection);
  const docsMapXml = deps.readXmlFile(path.join(planDir, 'DOCS-MAP.xml'));
  if (docsMapXml) sections.push({ title: 'DOCS-MAP.xml', content: docsMapXml.trim() });

  if (args.json || deps.shouldUseJson()) {
    console.log(JSON.stringify({
      project: root.id,
      mode: 'scoped',
      scope,
      agent: agentView,
      assignments,
      sdkAssetAliases,
      sections: deps.buildSnapshotSectionPayload(sections),
    }, null, 2));
    return;
  }

  console.log(`\nSnapshot (scoped ${scope.snapshotMode}): ${root.id}${scope.phaseId ? ` - phase ${scope.phaseId}` : ''}${scope.taskId ? ` - task ${scope.taskId}` : ''}\n`);
  deps.printSections(sections);
  console.log(`-- end snapshot (~${deps.countSectionTokensApprox(sections)} tokens) --`);
}

module.exports = { handleScopedSnapshot };
