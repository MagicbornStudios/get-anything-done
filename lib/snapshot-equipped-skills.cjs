'use strict';

const path = require('path');

function tokenizeForRelevance(text) {
  const STOP = new Set([
    'the','a','an','and','or','but','if','of','for','in','on','to','at','by','from','with','as','is','are','was','were','be','been','being','it','its','this','that','these','those','then','than','which','who','what','when','where','why','how','we','they','their','there','has','have','had','do','does','did','will','would','should','could','can','may','might','must','not','no','yes','so','too','very','just','also','any','all','some','one','two','three','per','into','out','up','down','over','under','before','after','again','once','new','old','use','used','using','via','about','above','below','between','because','while','during','each','other','more','most','less','few','many','much','such','own','same','only','get','got','make','made','run','ran','running','shipped','ship','work','working','task','tasks','phase','phases','goal','goals','item','items','thing','things','stuff','plan','planning','done','closed','planned','active','current','next','open','status','good','bad','first','last','need','needs','needed','want','wants'
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

function buildEquippedSkillsSection({
  limit,
  stateXml,
  phases,
  currentPhase,
  allTasks,
  repoRoot,
  listSkillDirs,
  readSkillFrontmatter,
}) {
  if (!limit || limit <= 0) return null;
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
  const openTasksSample = allTasks.filter((t) => t.status !== 'done').slice(0, 8);
  for (const t of openTasksSample) {
    if (t.goal) queryParts.push(String(t.goal).slice(0, 240));
  }
  const queryTokens = tokenizeForRelevance(queryParts.join(' '));
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
      if (score > 0) entries.push({ id: s.id, name: fm.name || s.id, description: fm.description || '', workflow: fm.workflow || null, score: score * 1.1, kind: 'proto' });
    }
  } catch {}

  if (entries.length === 0) return null;
  entries.sort((a, b) => b.score - a.score);
  const picked = entries.slice(0, limit);
  const lines = picked.map((e) => {
    const tag = e.kind === 'proto' ? ' (proto - `gad skill promote <slug> --project --claude` to equip)' : '';
    const descFrag = (e.description || '').replace(/\s+/g, ' ').slice(0, 160);
    const workflowFrag = e.workflow ? ` -> ${e.workflow}` : '';
    return `  ${e.id}${workflowFrag}${tag}\n    ${descFrag}`;
  });
  let body = lines.join('\n');
  if (body.length > 2000) body = body.slice(0, 1970).trimEnd() + '\n    [truncated]';
  return { title: `EQUIPPED SKILLS (top ${picked.length} by relevance)`, content: body };
}

module.exports = {
  buildEquippedSkillsSection,
  tokenizeForRelevance,
  jaccard,
};
