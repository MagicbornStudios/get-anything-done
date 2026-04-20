'use strict';

function attr(attrStr, name) {
  const re = new RegExp(`(?<![a-z-])${name}="([^"]*)"`, 'i');
  const m = attrStr.match(re);
  return m ? m[1] : '';
}

function parsePhases(xmlContent) {
  const phases = [];
  const re = /<phase\b([^>]*)>([\s\S]*?)<\/phase>/g;
  let m;
  while ((m = re.exec(xmlContent)) !== null) {
    const attrs = m[1];
    const body = m[2];
    const id = attr(attrs, 'id');
    const status = attr(attrs, 'status') || 'planned';
    const depends = attr(attrs, 'depends');
    const titleMatch = body.match(/<title>([\s\S]*?)<\/title>/);
    const goalMatch = body.match(/<goal>([\s\S]*?)<\/goal>/);
    const statusBody = body.match(/<status>([\s\S]*?)<\/status>/);
    phases.push({
      id,
      title: titleMatch ? titleMatch[1].trim() : '',
      goal: goalMatch ? goalMatch[1].trim() : '',
      status: statusBody ? statusBody[1].trim() : status,
      depends: depends || '',
    });
  }
  return phases;
}

function parseTasks(xmlContent) {
  const tasks = [];
  const phaseRe = /<phase\b([^>]*)>([\s\S]*?)<\/phase>/g;
  let pm;
  while ((pm = phaseRe.exec(xmlContent)) !== null) {
    const phaseAttrs = pm[1];
    const phaseBody = pm[2];
    const phaseId = attr(phaseAttrs, 'id');

    const taskRe = /<task\s([^>]*)>([\s\S]*?)<\/task>/g;
    let tm;
    while ((tm = taskRe.exec(phaseBody)) !== null) {
      const attrs = tm[1];
      const body = tm[2];
      const id = attr(attrs, 'id');
      const status = attr(attrs, 'status') || 'planned';
      const skill = attr(attrs, 'skill');
      const type = attr(attrs, 'type');
      const goalMatch = body.match(/<goal>([\s\S]*?)<\/goal>/);
      const depMatch = body.match(/<depends>([\s\S]*?)<\/depends>/);
      const kwMatch = body.match(/<keywords>([\s\S]*?)<\/keywords>/);
      tasks.push({
        id,
        phase: phaseId,
        status,
        skill,
        type,
        goal: goalMatch ? goalMatch[1].trim() : '',
        depends: depMatch ? depMatch[1].trim() : '',
        keywords: kwMatch ? kwMatch[1].trim() : '',
      });
    }
  }
  return tasks;
}

function parseDecisions(xmlContent) {
  const decisions = [];
  const re = /<decision\b([^>]*)>([\s\S]*?)<\/decision>/g;
  let m;
  while ((m = re.exec(xmlContent)) !== null) {
    const attrs = m[1];
    const body = m[2];
    const id = attr(attrs, 'id');
    const titleMatch = body.match(/<title>([\s\S]*?)<\/title>/);
    const summaryMatch = body.match(/<summary>([\s\S]*?)<\/summary>/);
    const impactMatch = body.match(/<impact>([\s\S]*?)<\/impact>/);
    decisions.push({
      id,
      title: titleMatch ? titleMatch[1].trim() : '',
      summary: summaryMatch ? summaryMatch[1].trim() : '',
      impact: impactMatch ? impactMatch[1].trim() : '',
    });
  }
  return decisions;
}

function parseSkillMd(content, slug) {
  const nameMatch = content.match(/^name:\s*(.+)$/m);
  const descMatch = content.match(/^description:\s*(.+)$/m);
  const workflowMatch = content.match(/^workflow:\s*(.+)$/m);
  const triggerMatch = content.match(/^trigger:\s*(.+)$/m);
  return {
    slug,
    name: nameMatch ? nameMatch[1].trim() : slug,
    description: descMatch ? descMatch[1].trim() : '',
    workflow: workflowMatch ? workflowMatch[1].trim() : '',
    trigger: triggerMatch ? triggerMatch[1].trim() : '',
  };
}

function extractTaskRefs(text) {
  const refs = new Set();
  const re = /\b(\d+(?:\.\d+)?-\d+[a-z]?)\b/g;
  let m;
  while ((m = re.exec(text)) !== null) refs.add(m[1]);
  return [...refs];
}

function extractDecisionRefs(text) {
  const refs = new Set();
  const re = /\b(gad-\d+|GAD-D-\d+)\b/gi;
  let m;
  while ((m = re.exec(text)) !== null) refs.add(m[1].toLowerCase());
  return [...refs];
}

function extractPhaseRefs(text) {
  const refs = new Set();
  const re = /\bphase\s+(\d+(?:\.\d+)?)\b/gi;
  let m;
  while ((m = re.exec(text)) !== null) refs.add(m[1]);
  return [...refs];
}

function extractSkillRefs(text) {
  const refs = new Set();
  const re = /\b(gad[:-][a-z][a-z0-9-]*)\b/g;
  let m;
  while ((m = re.exec(text)) !== null) refs.add(m[1]);
  return [...refs];
}

function countBy(arr, key) {
  const counts = {};
  for (const item of arr) {
    const v = item[key] || 'unknown';
    counts[v] = (counts[v] || 0) + 1;
  }
  return counts;
}

module.exports = {
  attr,
  parsePhases,
  parseTasks,
  parseDecisions,
  parseSkillMd,
  extractTaskRefs,
  extractDecisionRefs,
  extractPhaseRefs,
  extractSkillRefs,
  countBy,
};
