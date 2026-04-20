'use strict';

const { countBy } = require('./parsers.cjs');

function queryGraph(graph, query) {
  const { nodes, edges } = graph;
  let matches = [...nodes];

  if (query.type) {
    matches = matches.filter(n => n.type === query.type);
  }

  if (query.status) {
    matches = matches.filter(n => n.status === query.status);
  }

  if (query.id) {
    if (query.id.endsWith('*')) {
      const prefix = query.id.slice(0, -1);
      matches = matches.filter(n => n.id.startsWith(prefix));
    } else {
      matches = matches.filter(n => n.id === query.id);
    }
  }

  if (query.search) {
    const terms = query.search.toLowerCase().split(/\s+/);
    matches = matches.filter(n => {
      const text = `${n.id} ${n.label} ${n.goal || ''} ${n.keywords || ''} ${n.summary || ''}`.toLowerCase();
      return terms.every(t => text.includes(t));
    });
  }

  if (query.phase) {
    const phaseId = `phase:${query.phase}`;
    const taskIdsInPhase = new Set(
      edges.filter(e => e.target === phaseId && e.type === 'BELONGS_TO').map(e => e.source)
    );
    matches = matches.filter(n => taskIdsInPhase.has(n.id) || n.id === phaseId);
  }

  if (query.skill) {
    const skillId = query.skill.startsWith('skill:') ? query.skill : `skill:${query.skill}`;
    const taskIdsUsingSkill = new Set(
      edges.filter(e => e.target === skillId && e.type === 'USES_SKILL').map(e => e.source)
    );
    matches = matches.filter(n => taskIdsUsingSkill.has(n.id) || n.id === skillId);
  }

  if (query.depends) {
    const targetId = normalizeQueryId(query.depends);
    const depIds = new Set(
      edges.filter(e => e.target === targetId && e.type === 'DEPENDS_ON').map(e => e.source)
    );
    matches = matches.filter(n => depIds.has(n.id));
  }

  if (query.dependents) {
    const sourceId = normalizeQueryId(query.dependents);
    const depIds = new Set(
      edges.filter(e => e.source === sourceId && e.type === 'DEPENDS_ON').map(e => e.target)
    );
    matches = matches.filter(n => depIds.has(n.id));
  }

  if (query.cites) {
    const targetId = normalizeQueryId(query.cites);
    const citerIds = new Set(
      edges.filter(e => e.target === targetId && e.type === 'CITES').map(e => e.source)
    );
    matches = matches.filter(n => citerIds.has(n.id));
  }

  if (query.citedBy) {
    const sourceId = normalizeQueryId(query.citedBy);
    const citedIds = new Set(
      edges.filter(e => e.source === sourceId && e.type === 'CITES').map(e => e.target)
    );
    matches = matches.filter(n => citedIds.has(n.id));
  }

  const matchIds = new Set(matches.map(n => n.id));
  let relevantEdges = edges.filter(e => matchIds.has(e.source) || matchIds.has(e.target));

  if (query.edgeType) {
    relevantEdges = relevantEdges.filter(e => e.type === query.edgeType);
  }

  return {
    matches,
    edges: relevantEdges,
    stats: {
      matchCount: matches.length,
      edgeCount: relevantEdges.length,
      types: countBy(matches, 'type'),
    },
  };
}

function parseNaturalQuery(input) {
  const q = {};
  const lower = input.toLowerCase().trim();

  let m = lower.match(/(?:what|which|tasks?|nodes?)\s+(?:depends?|depending)\s+on\s+(.+)/);
  if (m) {
    q.depends = m[1].trim();
    return q;
  }

  m = lower.match(/what\s+does\s+(.+?)\s+depend\s+on/);
  if (m) {
    q.dependents = m[1].trim();
    return q;
  }

  m = lower.match(/(?:decisions?|tasks?|nodes?)\s+(?:that\s+)?cit(?:e|ing)\s+(.+)/);
  if (m) {
    q.cites = m[1].trim();
    return q;
  }

  m = lower.match(/show\s+(\w+)\s+that\s+cite\s+(.+)/);
  if (m) {
    q.type = m[1].replace(/s$/, '');
    q.cites = m[2].trim();
    return q;
  }

  m = lower.match(/(?:which|what)\s+skills?\s+(?:were\s+)?used\s+in\s+phase\s+(\S+)/);
  if (m) {
    q.phase = m[1];
    q.type = 'task';
    return q;
  }

  m = lower.match(/(?:open|planned|active|done|cancelled)\s+tasks?\s+in\s+phase\s+(\S+)/);
  if (m) {
    q.phase = m[1];
    q.type = 'task';
    q.status = lower.startsWith('open') || lower.startsWith('planned') ? 'planned' : lower.split(/\s/)[0];
    return q;
  }

  m = lower.match(/tasks?\s+in\s+phase\s+(\S+)/);
  if (m) {
    q.phase = m[1];
    q.type = 'task';
    return q;
  }

  m = lower.match(/phase\s+(\S+)\s+tasks/);
  if (m) {
    q.phase = m[1];
    q.type = 'task';
    return q;
  }

  m = lower.match(/(?:show|list|all|get)\s+(phases?|tasks?|decisions?|skills?|workflows?)/);
  if (m) {
    q.type = m[1].replace(/s$/, '');
    return q;
  }

  m = lower.match(/(done|planned|active|cancelled|in-progress)\s+(phases?|tasks?|decisions?)/);
  if (m) {
    q.status = m[1];
    q.type = m[2].replace(/s$/, '');
    return q;
  }

  q.search = input;
  return q;
}

function normalizeQueryId(raw) {
  const s = raw.trim();
  if (s.includes(':')) return s;
  const phaseWord = s.match(/^phase\s+(\d+(?:\.\d+)?)$/i);
  if (phaseWord) return `phase:${phaseWord[1]}`;
  if (/^\d+(?:\.\d+)?-\d+/.test(s)) return `task:${s}`;
  if (/^gad-d?-?\d+$/i.test(s)) return `decision:${s.toLowerCase()}`;
  if (/^\d+(?:\.\d+)?$/.test(s)) return `phase:${s}`;
  const decWord = s.match(/^decision\s+(gad-\d+)$/i);
  if (decWord) return `decision:${decWord[1].toLowerCase()}`;
  const taskWord = s.match(/^task\s+(\d+(?:\.\d+)?-\d+\w?)$/i);
  if (taskWord) return `task:${taskWord[1]}`;
  return s;
}

function formatQueryResult(result, query) {
  const lines = [];
  const { matches, edges, stats } = result;

  lines.push(`Query result: ${stats.matchCount} matches, ${stats.edgeCount} edges`);
  if (Object.keys(stats.types).length > 0) {
    lines.push(`Types: ${Object.entries(stats.types).map(([k, v]) => `${k}(${v})`).join(', ')}`);
  }
  lines.push('');

  if (query.phase && query.type === 'task' && /skill/i.test(JSON.stringify(query))) {
    const skills = new Set();
    for (const m of matches) {
      if (m.skill) m.skill.split(',').forEach(s => skills.add(s.trim()));
    }
    if (skills.size > 0) {
      lines.push(`Skills used in phase ${query.phase}: ${[...skills].join(', ')}`);
      lines.push('');
    }
  }

  for (const m of matches.slice(0, 50)) {
    const parts = [`[${m.type}] ${m.id}`];
    if (m.status) parts.push(`(${m.status})`);
    if (m.label && m.label.length < 120) parts.push(`— ${m.label}`);
    lines.push(parts.join(' '));
    if (m.skill) lines.push(`  skill: ${m.skill}`);
    if (m.depends) lines.push(`  depends: ${m.depends}`);
  }

  if (matches.length > 50) {
    lines.push(`... and ${matches.length - 50} more`);
  }

  if (edges.length > 0 && edges.length <= 30) {
    lines.push('');
    lines.push('Edges:');
    for (const e of edges) {
      lines.push(`  ${e.source} --${e.type}--> ${e.target}`);
    }
  } else if (edges.length > 30) {
    lines.push('');
    lines.push(`Edges: ${edges.length} total (${Object.entries(countBy(edges, 'type')).map(([k,v]) => `${k}(${v})`).join(', ')})`);
  }

  return lines.join('\n');
}

module.exports = {
  queryGraph,
  parseNaturalQuery,
  normalizeQueryId,
  formatQueryResult,
};
