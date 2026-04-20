'use strict';

const path = require('path');
const { execSync } = require('child_process');

function buildAgentSection(agentView) {
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

function buildAssignmentsSection(assignments) {
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

function buildDecisionsSection({ readXmlFile, planDir }) {
  const decisionsXml = readXmlFile(path.join(planDir, 'DECISIONS.xml'));
  if (!decisionsXml) return null;
  const ALWAYS_INCLUDE = ['gad-04', 'gad-17', 'gad-18'];
  const RECENT_CAP = 15;
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
  const nonCore = all.filter((d) => !ALWAYS_INCLUDE.includes(d.id));
  const recent = nonCore.slice(-RECENT_CAP);
  const olderCount = nonCore.length - recent.length;
  const coreLines = all
    .filter((d) => ALWAYS_INCLUDE.includes(d.id))
    .map((d) => `* ${d.id}: ${d.title.slice(0, 96)}`);
  const recentLines = recent.map((d) => `  ${d.id}: ${d.title.slice(0, 96)}`);
  const sections = [];
  if (coreLines.length) sections.push(coreLines.join('\n'));
  if (olderCount > 0) sections.push(`(+${olderCount} older decisions omitted; \`gad decisions list\` or \`gad decisions show <id>\`)`);
  if (recentLines.length) sections.push(recentLines.join('\n'));
  return {
    title: `DECISIONS (${totalDec} total, *=core loop - see CLAUDE.md; last ${recent.length} shown, full body via \`gad decisions show <id>\`)`,
    content: sections.join('\n').trim(),
  };
}

function buildFileRefsSection({ scopedTask, root, baseDir }) {
  let fileRefs = '';
  if (scopedTask?.files?.length) {
    fileRefs += `Task files:\n${scopedTask.files.join('\n')}\n`;
  }
  if (scopedTask?.commands?.length) {
    fileRefs += `${fileRefs ? '\n' : ''}Task commands:\n${scopedTask.commands.join('\n')}\n`;
  }
  try {
    const projectPath = root.path === '.' ? '' : root.path;
    const gitCmd = projectPath
      ? `git log --oneline -5 -- "${projectPath}"`
      : 'git log --oneline -5';
    const gitLog = execSync(gitCmd, { cwd: baseDir, encoding: 'utf8', timeout: 5000, stdio: ['pipe', 'pipe', 'pipe'] }).trim();
    if (gitLog) fileRefs += `${fileRefs ? '\n' : ''}Recent commits:\n${gitLog}\n`;
    const filesCmd = projectPath
      ? `git log --name-only --pretty=format: -3 -- "${projectPath}"`
      : 'git log --name-only --pretty=format: -3';
    const changedFiles = execSync(filesCmd, { cwd: baseDir, encoding: 'utf8', timeout: 5000, stdio: ['pipe', 'pipe', 'pipe'] }).trim();
    if (changedFiles) fileRefs += `\nRecently changed files:\n${changedFiles}`;
  } catch {}
  return fileRefs.trim() ? { title: 'FILE REFS (git)', content: fileRefs.trim() } : null;
}

function buildConventionsSection({ readXmlFile, planDir, baseDir, root }) {
  let conventions = '';
  const projConventions = readXmlFile(path.join(planDir, 'CONVENTIONS.md'));
  if (projConventions) conventions += projConventions.trim();
  const projAgentsMd = readXmlFile(path.join(baseDir, root.path, 'AGENTS.md'));
  if (projAgentsMd) {
    const convMatch = projAgentsMd.match(/##\s*(Conventions|Style|Coding\s+conventions|Code\s+style)[^\n]*\n([\s\S]*?)(?=\n##\s|$)/i);
    if (convMatch) {
      conventions += (conventions ? '\n\n' : '') + `## ${convMatch[1].trim()}\n${convMatch[2].trim()}`;
    }
  }
  if (!conventions && root.path !== '.') {
    const rootAgentsMd = readXmlFile(path.join(baseDir, 'AGENTS.md'));
    if (rootAgentsMd) {
      const globalConv = rootAgentsMd.match(/##\s*(Conventions|Public site copy)[^\n]*\n([\s\S]*?)(?=\n##\s[A-Z]|$)/i);
      if (globalConv) {
        conventions += `## ${globalConv[1].trim()} (global)\n${globalConv[2].trim()}`;
      }
    }
  }
  return conventions.trim() ? { title: 'CONVENTIONS', content: conventions.trim() } : null;
}

module.exports = {
  buildAgentSection,
  buildAssignmentsSection,
  buildDecisionsSection,
  buildFileRefsSection,
  buildConventionsSection,
};
