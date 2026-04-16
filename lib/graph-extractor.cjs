'use strict';
/**
 * graph-extractor.cjs — Node-only knowledge-graph builder from .planning/ XML files.
 *
 * Walks TASK-REGISTRY.xml, DECISIONS.xml, ROADMAP.xml, skills/SKILL.md files,
 * and .planning/workflows/ markdown to produce a typed-node, typed-edge graph.
 *
 * Output: { nodes: [...], edges: [...], meta: { generated, nodeCount, edgeCount } }
 *
 * Node types: phase, task, decision, skill, workflow, file
 * Edge types: BELONGS_TO, DEPENDS_ON, CITES, DECIDES, USES_SKILL, AUTHORED_BY, REFERENCES
 *
 * Structural extraction — no LLM, no Python.
 * Optional: pdf-parse for PDF content extraction (lazy-loaded).
 */

const fs = require('fs');
const path = require('path');

// Lazy-load pdf-parse — only imported when a PDF file is encountered
let pdfParse = null;
function getPdfParser() {
  if (pdfParse === null) {
    try {
      pdfParse = require('pdf-parse');
    } catch {
      pdfParse = false; // Mark as unavailable
    }
  }
  return pdfParse || null;
}

/**
 * Extract text from a PDF file. Returns null if pdf-parse isn't available.
 * @param {string} filePath
 * @returns {Promise<string|null>}
 */
async function extractPdfText(filePath) {
  const parser = getPdfParser();
  if (!parser) return null;
  try {
    const buffer = fs.readFileSync(filePath);
    const data = await parser(buffer);
    return data.text;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// XML-regex parsers (reuse same patterns as existing readers)
// ---------------------------------------------------------------------------

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
  // Track current phase context
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

function attr(attrStr, name) {
  // Use word-boundary to avoid matching compound attrs like agent-id when looking for id
  const re = new RegExp(`(?<![a-z-])${name}="([^"]*)"`, 'i');
  const m = attrStr.match(re);
  return m ? m[1] : '';
}

// ---------------------------------------------------------------------------
// Cross-reference extraction from text
// ---------------------------------------------------------------------------

/** Extract references to tasks (e.g. "42.2-45", "44.5-02") from text. */
function extractTaskRefs(text) {
  const refs = new Set();
  const re = /\b(\d+(?:\.\d+)?-\d+[a-z]?)\b/g;
  let m;
  while ((m = re.exec(text)) !== null) refs.add(m[1]);
  return [...refs];
}

/** Extract references to decisions (e.g. "gad-197", "GAD-D-104") from text. */
function extractDecisionRefs(text) {
  const refs = new Set();
  const re = /\b(gad-\d+|GAD-D-\d+)\b/gi;
  let m;
  while ((m = re.exec(text)) !== null) refs.add(m[1].toLowerCase());
  return [...refs];
}

/** Extract references to phases (e.g. "phase 44.5", "phase 42.2") from text. */
function extractPhaseRefs(text) {
  const refs = new Set();
  const re = /\bphase\s+(\d+(?:\.\d+)?)\b/gi;
  let m;
  while ((m = re.exec(text)) !== null) refs.add(m[1]);
  return [...refs];
}

/** Extract skill references (e.g. "gad:plan-phase", "gad-help") from text. */
function extractSkillRefs(text) {
  const refs = new Set();
  const re = /\b(gad[:-][a-z][a-z0-9-]*)\b/g;
  let m;
  while ((m = re.exec(text)) !== null) refs.add(m[1]);
  return [...refs];
}

// ---------------------------------------------------------------------------
// Graph builder
// ---------------------------------------------------------------------------

/**
 * Build graph from a planning root.
 * @param {{ id: string, path: string, planningDir: string }} root
 * @param {string} baseDir
 * @param {object} [opts]
 * @param {string} [opts.gadDir] — path to the GAD framework dir (for skills/)
 * @returns {{ nodes: object[], edges: object[], meta: object }}
 */
function buildGraph(root, baseDir, opts = {}) {
  const planDir = path.join(baseDir, root.path, root.planningDir);
  const gadDir = opts.gadDir || path.resolve(__dirname, '..');

  const nodes = [];
  const edges = [];
  const nodeIndex = new Map(); // id -> node

  function addNode(type, id, label, data = {}) {
    if (nodeIndex.has(id)) return;
    const node = { type, id, label, ...data };
    nodes.push(node);
    nodeIndex.set(id, node);
  }

  function addEdge(source, target, type, data = {}) {
    edges.push({ source, target, type, ...data });
  }

  // 1. Phases from ROADMAP.xml
  const roadmapPath = path.join(planDir, 'ROADMAP.xml');
  if (fs.existsSync(roadmapPath)) {
    const phases = parsePhases(fs.readFileSync(roadmapPath, 'utf8'));
    for (const p of phases) {
      addNode('phase', `phase:${p.id}`, p.title || `Phase ${p.id}`, {
        status: p.status,
        goal: p.goal,
      });
      if (p.depends) {
        for (const dep of p.depends.split(',').map(s => s.trim()).filter(Boolean)) {
          addEdge(`phase:${p.id}`, `phase:${dep}`, 'DEPENDS_ON');
        }
      }
    }
  }

  // 2. Tasks from TASK-REGISTRY.xml
  const taskRegPath = path.join(planDir, 'TASK-REGISTRY.xml');
  if (fs.existsSync(taskRegPath)) {
    const tasks = parseTasks(fs.readFileSync(taskRegPath, 'utf8'));
    for (const t of tasks) {
      addNode('task', `task:${t.id}`, t.goal.slice(0, 120), {
        status: t.status,
        goal: t.goal,
        skill: t.skill,
        taskType: t.type,
        keywords: t.keywords,
      });
      // BELONGS_TO phase
      if (t.phase) {
        addEdge(`task:${t.id}`, `phase:${t.phase}`, 'BELONGS_TO');
      }
      // DEPENDS_ON other tasks
      if (t.depends) {
        for (const dep of t.depends.split(',').map(s => s.trim()).filter(Boolean)) {
          addEdge(`task:${t.id}`, `task:${dep}`, 'DEPENDS_ON');
        }
      }
      // USES_SKILL
      if (t.skill) {
        for (const sk of t.skill.split(',').map(s => s.trim()).filter(Boolean)) {
          const skillId = `skill:${sk}`;
          addNode('skill', skillId, sk, { source: 'task-attribution' });
          addEdge(`task:${t.id}`, skillId, 'USES_SKILL');
        }
      }
      // Cross-references in goal text
      for (const ref of extractDecisionRefs(t.goal)) {
        addEdge(`task:${t.id}`, `decision:${ref}`, 'CITES');
      }
      for (const ref of extractPhaseRefs(t.goal)) {
        addEdge(`task:${t.id}`, `phase:${ref}`, 'CITES');
      }
      for (const ref of extractTaskRefs(t.goal)) {
        if (ref !== t.id) {
          addEdge(`task:${t.id}`, `task:${ref}`, 'CITES');
        }
      }
    }
  }

  // 3. Decisions from DECISIONS.xml
  const decisionsPath = path.join(planDir, 'DECISIONS.xml');
  if (fs.existsSync(decisionsPath)) {
    const decisions = parseDecisions(fs.readFileSync(decisionsPath, 'utf8'));
    for (const d of decisions) {
      addNode('decision', `decision:${d.id}`, d.title, {
        summary: d.summary.slice(0, 300),
      });
      // Extract cross-references from summary + impact
      const combined = `${d.summary} ${d.impact}`;
      for (const ref of extractTaskRefs(combined)) {
        addEdge(`decision:${d.id}`, `task:${ref}`, 'CITES');
      }
      for (const ref of extractPhaseRefs(combined)) {
        addEdge(`decision:${d.id}`, `phase:${ref}`, 'CITES');
      }
      for (const ref of extractDecisionRefs(combined)) {
        if (ref !== d.id) {
          addEdge(`decision:${d.id}`, `decision:${ref}`, 'CITES');
        }
      }
      for (const ref of extractSkillRefs(combined)) {
        const skillId = `skill:${ref}`;
        addNode('skill', skillId, ref, { source: 'decision-citation' });
        addEdge(`decision:${d.id}`, skillId, 'REFERENCES');
      }
    }
  }

  // 4. Skills from skills/*/SKILL.md
  const skillsDir = path.join(gadDir, 'skills');
  if (fs.existsSync(skillsDir)) {
    for (const entry of fs.readdirSync(skillsDir, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const skillMd = path.join(skillsDir, entry.name, 'SKILL.md');
      if (!fs.existsSync(skillMd)) continue;
      const content = fs.readFileSync(skillMd, 'utf8');
      const skill = parseSkillMd(content, entry.name);
      const sid = `skill:${skill.name}`;
      addNode('skill', sid, skill.description || skill.name, {
        slug: skill.slug,
        trigger: skill.trigger,
        source: 'canonical',
      });
      if (skill.workflow) {
        const wid = `workflow:${skill.workflow}`;
        addNode('workflow', wid, skill.workflow, { source: 'skill-ref' });
        addEdge(sid, wid, 'USES_WORKFLOW');
      }
    }
  }

  // 5. Workflows from .planning/workflows/*.md
  const workflowDir = path.join(planDir, 'workflows');
  if (fs.existsSync(workflowDir)) {
    for (const entry of fs.readdirSync(workflowDir, { withFileTypes: true })) {
      if (!entry.isFile() || !entry.name.endsWith('.md')) continue;
      const wid = `workflow:workflows/${entry.name}`;
      const content = fs.readFileSync(path.join(workflowDir, entry.name), 'utf8');
      const titleMatch = content.match(/^#\s+(.+)$/m);
      addNode('workflow', wid, titleMatch ? titleMatch[1].trim() : entry.name, {
        file: `workflows/${entry.name}`,
        source: 'planning',
      });
    }
  }

  // Also scan top-level workflows/
  const topWorkflowDir = path.join(gadDir, 'workflows');
  if (fs.existsSync(topWorkflowDir) && topWorkflowDir !== workflowDir) {
    for (const entry of fs.readdirSync(topWorkflowDir, { withFileTypes: true })) {
      if (!entry.isFile() || !entry.name.endsWith('.md')) continue;
      const wid = `workflow:workflows/${entry.name}`;
      if (nodeIndex.has(wid)) continue;
      const content = fs.readFileSync(path.join(topWorkflowDir, entry.name), 'utf8');
      const titleMatch = content.match(/^#\s+(.+)$/m);
      addNode('workflow', wid, titleMatch ? titleMatch[1].trim() : entry.name, {
        file: `workflows/${entry.name}`,
        source: 'top-level',
      });
    }
  }

  return {
    nodes,
    edges,
    meta: {
      project: root.id,
      generated: new Date().toISOString(),
      nodeCount: nodes.length,
      edgeCount: edges.length,
      nodeTypes: countBy(nodes, 'type'),
      edgeTypes: countBy(edges, 'type'),
    },
  };
}

function countBy(arr, key) {
  const counts = {};
  for (const item of arr) {
    const v = item[key] || 'unknown';
    counts[v] = (counts[v] || 0) + 1;
  }
  return counts;
}

// ---------------------------------------------------------------------------
// Query engine — structural queries over a built graph
// ---------------------------------------------------------------------------

/**
 * Query a graph structurally. Returns matching nodes + their immediate edges.
 * @param {object} graph — { nodes, edges }
 * @param {object} query
 * @param {string} [query.type] — filter by node type (phase, task, decision, skill, workflow)
 * @param {string} [query.status] — filter by node status
 * @param {string} [query.id] — exact id match
 * @param {string} [query.search] — text search across id + label + goal
 * @param {string} [query.depends] — find nodes that depend on this id
 * @param {string} [query.dependents] — find nodes that this id depends on
 * @param {string} [query.cites] — find nodes that cite this id
 * @param {string} [query.citedBy] — find nodes cited by this id
 * @param {string} [query.phase] — filter tasks belonging to this phase
 * @param {string} [query.skill] — filter tasks using this skill
 * @param {string} [query.edgeType] — filter edges by type
 * @param {number} [query.depth] — traversal depth (default 1)
 * @returns {{ matches: object[], edges: object[], stats: object }}
 */
function queryGraph(graph, query) {
  const { nodes, edges } = graph;
  let matches = [...nodes];

  // Type filter
  if (query.type) {
    matches = matches.filter(n => n.type === query.type);
  }

  // Status filter
  if (query.status) {
    matches = matches.filter(n => n.status === query.status);
  }

  // ID filter — supports prefix match with trailing *
  if (query.id) {
    if (query.id.endsWith('*')) {
      const prefix = query.id.slice(0, -1);
      matches = matches.filter(n => n.id.startsWith(prefix));
    } else {
      matches = matches.filter(n => n.id === query.id);
    }
  }

  // Text search
  if (query.search) {
    const terms = query.search.toLowerCase().split(/\s+/);
    matches = matches.filter(n => {
      const text = `${n.id} ${n.label} ${n.goal || ''} ${n.keywords || ''} ${n.summary || ''}`.toLowerCase();
      return terms.every(t => text.includes(t));
    });
  }

  // Phase membership filter
  if (query.phase) {
    const phaseId = `phase:${query.phase}`;
    const taskIdsInPhase = new Set(
      edges.filter(e => e.target === phaseId && e.type === 'BELONGS_TO').map(e => e.source)
    );
    matches = matches.filter(n => taskIdsInPhase.has(n.id) || n.id === phaseId);
  }

  // Skill usage filter
  if (query.skill) {
    const skillId = query.skill.startsWith('skill:') ? query.skill : `skill:${query.skill}`;
    const taskIdsUsingSkill = new Set(
      edges.filter(e => e.target === skillId && e.type === 'USES_SKILL').map(e => e.source)
    );
    matches = matches.filter(n => taskIdsUsingSkill.has(n.id) || n.id === skillId);
  }

  // Dependency queries
  if (query.depends) {
    // "what depends on X" — find nodes where X appears as target in DEPENDS_ON edges
    const targetId = normalizeQueryId(query.depends);
    const depIds = new Set(
      edges.filter(e => e.target === targetId && e.type === 'DEPENDS_ON').map(e => e.source)
    );
    matches = matches.filter(n => depIds.has(n.id));
  }

  if (query.dependents) {
    // "what does X depend on" — find DEPENDS_ON edges where X is source
    const sourceId = normalizeQueryId(query.dependents);
    const depIds = new Set(
      edges.filter(e => e.source === sourceId && e.type === 'DEPENDS_ON').map(e => e.target)
    );
    matches = matches.filter(n => depIds.has(n.id));
  }

  // Citation queries
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

  // Collect relevant edges
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

/**
 * Parse a natural-language-ish query string into a structured query object.
 * No LLM — pure pattern matching on common question shapes.
 */
function parseNaturalQuery(input) {
  const q = {};
  const lower = input.toLowerCase().trim();

  // "what depends on X" / "tasks depending on X"
  let m = lower.match(/(?:what|which|tasks?|nodes?)\s+(?:depends?|depending)\s+on\s+(.+)/);
  if (m) {
    q.depends = m[1].trim();
    return q;
  }

  // "what does X depend on"
  m = lower.match(/what\s+does\s+(.+?)\s+depend\s+on/);
  if (m) {
    q.dependents = m[1].trim();
    return q;
  }

  // "decisions citing phase X" / "tasks that cite X"
  m = lower.match(/(?:decisions?|tasks?|nodes?)\s+(?:that\s+)?cit(?:e|ing)\s+(.+)/);
  if (m) {
    q.cites = m[1].trim();
    return q;
  }

  // "show decisions that cite phase 44"
  m = lower.match(/show\s+(\w+)\s+that\s+cite\s+(.+)/);
  if (m) {
    q.type = m[1].replace(/s$/, '');
    q.cites = m[2].trim();
    return q;
  }

  // "which skills were used in phase X"
  m = lower.match(/(?:which|what)\s+skills?\s+(?:were\s+)?used\s+in\s+phase\s+(\S+)/);
  if (m) {
    q.phase = m[1];
    q.type = 'task'; // get tasks in the phase, they carry skill info
    return q;
  }

  // "open tasks in phase X" / "planned tasks in phase X"
  m = lower.match(/(?:open|planned|active|done|cancelled)\s+tasks?\s+in\s+phase\s+(\S+)/);
  if (m) {
    q.phase = m[1];
    q.type = 'task';
    q.status = lower.startsWith('open') || lower.startsWith('planned') ? 'planned' : lower.split(/\s/)[0];
    return q;
  }

  // "tasks in phase X"
  m = lower.match(/tasks?\s+in\s+phase\s+(\S+)/);
  if (m) {
    q.phase = m[1];
    q.type = 'task';
    return q;
  }

  // "phase X tasks"
  m = lower.match(/phase\s+(\S+)\s+tasks/);
  if (m) {
    q.phase = m[1];
    q.type = 'task';
    return q;
  }

  // Generic type filters: "show decisions", "list skills", "all phases"
  m = lower.match(/(?:show|list|all|get)\s+(phases?|tasks?|decisions?|skills?|workflows?)/);
  if (m) {
    q.type = m[1].replace(/s$/, '');
    return q;
  }

  // Status filter: "done tasks", "planned phases"
  m = lower.match(/(done|planned|active|cancelled|in-progress)\s+(phases?|tasks?|decisions?)/);
  if (m) {
    q.status = m[1];
    q.type = m[2].replace(/s$/, '');
    return q;
  }

  // Fallback: text search
  q.search = input;
  return q;
}

/** Normalize a query ID to the typed form used in the graph. */
function normalizeQueryId(raw) {
  const s = raw.trim();
  // Already typed
  if (s.includes(':')) return s;
  // "phase 44" / "phase 44.5"
  const phaseWord = s.match(/^phase\s+(\d+(?:\.\d+)?)$/i);
  if (phaseWord) return `phase:${phaseWord[1]}`;
  // Looks like a task id (digits-digits)
  if (/^\d+(?:\.\d+)?-\d+/.test(s)) return `task:${s}`;
  // Looks like a decision id (gad-NNN or GAD-D-NNN)
  if (/^gad-d?-?\d+$/i.test(s)) return `decision:${s.toLowerCase()}`;
  // Looks like a phase id (digits or digits.digits)
  if (/^\d+(?:\.\d+)?$/.test(s)) return `phase:${s}`;
  // "decision gad-NNN"
  const decWord = s.match(/^decision\s+(gad-\d+)$/i);
  if (decWord) return `decision:${decWord[1].toLowerCase()}`;
  // "task X-Y"
  const taskWord = s.match(/^task\s+(\d+(?:\.\d+)?-\d+\w?)$/i);
  if (taskWord) return `task:${taskWord[1]}`;
  // Assume it's a search term — return as-is
  return s;
}

// ---------------------------------------------------------------------------
// HTML visualization generator
// ---------------------------------------------------------------------------

function generateHtml(graph) {
  const { nodes, edges, meta } = graph;
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>GAD Planning Graph — ${meta.project}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: system-ui, -apple-system, sans-serif; background: #0a0a0a; color: #e0e0e0; }
  .header { padding: 16px 24px; background: #111; border-bottom: 1px solid #333; display: flex; gap: 16px; align-items: center; }
  .header h1 { font-size: 18px; font-weight: 600; }
  .header .stats { font-size: 13px; color: #888; }
  .controls { padding: 12px 24px; background: #111; border-bottom: 1px solid #222; display: flex; gap: 12px; flex-wrap: wrap; }
  .controls button { padding: 4px 12px; border: 1px solid #444; background: #222; color: #ccc; border-radius: 4px; cursor: pointer; font-size: 12px; }
  .controls button.active { background: #335; border-color: #668; color: #aaf; }
  .controls input { padding: 4px 10px; border: 1px solid #444; background: #1a1a1a; color: #ccc; border-radius: 4px; font-size: 12px; width: 240px; }
  #graph { width: 100%; height: calc(100vh - 100px); }
  .node-info { position: fixed; right: 16px; top: 120px; width: 320px; background: #1a1a1a; border: 1px solid #333; border-radius: 8px; padding: 16px; display: none; font-size: 13px; max-height: 60vh; overflow-y: auto; }
  .node-info h3 { margin-bottom: 8px; font-size: 14px; }
  .node-info .field { margin: 4px 0; }
  .node-info .field-label { color: #888; font-size: 11px; text-transform: uppercase; }
  .node-info .edges { margin-top: 12px; }
  .node-info .edge-item { padding: 2px 0; font-size: 12px; color: #aaa; }
  .type-badge { display: inline-block; padding: 1px 6px; border-radius: 3px; font-size: 11px; font-weight: 600; }
  .type-phase { background: #1a3a2a; color: #4ade80; }
  .type-task { background: #1a2a3a; color: #60a5fa; }
  .type-decision { background: #3a2a1a; color: #fbbf24; }
  .type-skill { background: #2a1a3a; color: #c084fc; }
  .type-workflow { background: #1a3a3a; color: #2dd4bf; }
</style>
</head>
<body>
<div class="header">
  <h1>GAD Planning Graph</h1>
  <div class="stats">${meta.nodeCount} nodes, ${meta.edgeCount} edges | Generated ${meta.generated.split('T')[0]}</div>
</div>
<div class="controls">
  <button class="active" data-type="all">All</button>
  <button data-type="phase">Phases</button>
  <button data-type="task">Tasks</button>
  <button data-type="decision">Decisions</button>
  <button data-type="skill">Skills</button>
  <button data-type="workflow">Workflows</button>
  <input type="text" id="search" placeholder="Search nodes..." />
</div>
<canvas id="graph"></canvas>
<div class="node-info" id="info"></div>
<script>
const GRAPH = ${JSON.stringify({ nodes, edges })};
const COLORS = { phase: '#4ade80', task: '#60a5fa', decision: '#fbbf24', skill: '#c084fc', workflow: '#2dd4bf', file: '#94a3b8' };
const SIZES = { phase: 10, task: 6, decision: 8, skill: 7, workflow: 5, file: 4 };

// Simple force-directed layout
const canvas = document.getElementById('graph');
const ctx = canvas.getContext('2d');
let W, H;

function resize() { W = canvas.width = canvas.clientWidth; H = canvas.height = canvas.clientHeight; }
resize();
window.addEventListener('resize', resize);

// Init positions
const pos = {};
GRAPH.nodes.forEach((n, i) => {
  const angle = (i / GRAPH.nodes.length) * Math.PI * 2;
  const r = Math.min(W, H) * 0.35;
  pos[n.id] = { x: W/2 + Math.cos(angle) * r + (Math.random() - 0.5) * 50, y: H/2 + Math.sin(angle) * r + (Math.random() - 0.5) * 50, vx: 0, vy: 0 };
});

const edgeIndex = {};
GRAPH.edges.forEach(e => {
  if (!edgeIndex[e.source]) edgeIndex[e.source] = [];
  if (!edgeIndex[e.target]) edgeIndex[e.target] = [];
  edgeIndex[e.source].push(e);
  edgeIndex[e.target].push(e);
});

let activeType = 'all';
let searchTerm = '';
let selectedNode = null;

function isVisible(n) {
  if (activeType !== 'all' && n.type !== activeType) return false;
  if (searchTerm && !(\`\${n.id} \${n.label}\`).toLowerCase().includes(searchTerm)) return false;
  return true;
}

function simulate() {
  const visible = GRAPH.nodes.filter(isVisible);
  const visIds = new Set(visible.map(n => n.id));
  // Repulsion
  for (let i = 0; i < visible.length; i++) {
    for (let j = i + 1; j < visible.length; j++) {
      const a = pos[visible[i].id], b = pos[visible[j].id];
      let dx = a.x - b.x, dy = a.y - b.y;
      let d = Math.sqrt(dx*dx + dy*dy) || 1;
      let f = 800 / (d * d);
      a.vx += dx/d * f; a.vy += dy/d * f;
      b.vx -= dx/d * f; b.vy -= dy/d * f;
    }
  }
  // Attraction (edges)
  GRAPH.edges.forEach(e => {
    if (!visIds.has(e.source) || !visIds.has(e.target)) return;
    const a = pos[e.source], b = pos[e.target];
    if (!a || !b) return;
    let dx = b.x - a.x, dy = b.y - a.y;
    let d = Math.sqrt(dx*dx + dy*dy) || 1;
    let f = (d - 100) * 0.01;
    a.vx += dx/d * f; a.vy += dy/d * f;
    b.vx -= dx/d * f; b.vy -= dy/d * f;
  });
  // Center gravity
  visible.forEach(n => {
    const p = pos[n.id];
    p.vx += (W/2 - p.x) * 0.001;
    p.vy += (H/2 - p.y) * 0.001;
    p.vx *= 0.9; p.vy *= 0.9;
    p.x += p.vx; p.y += p.vy;
    p.x = Math.max(20, Math.min(W-20, p.x));
    p.y = Math.max(20, Math.min(H-20, p.y));
  });
}

function draw() {
  ctx.clearRect(0, 0, W, H);
  const visible = GRAPH.nodes.filter(isVisible);
  const visIds = new Set(visible.map(n => n.id));
  // Edges
  GRAPH.edges.forEach(e => {
    if (!visIds.has(e.source) || !visIds.has(e.target)) return;
    const a = pos[e.source], b = pos[e.target];
    if (!a || !b) return;
    ctx.beginPath();
    ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y);
    ctx.strokeStyle = 'rgba(100,100,100,0.3)';
    ctx.stroke();
  });
  // Nodes
  visible.forEach(n => {
    const p = pos[n.id];
    const r = SIZES[n.type] || 5;
    ctx.beginPath();
    ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
    ctx.fillStyle = n === selectedNode ? '#fff' : (COLORS[n.type] || '#888');
    ctx.fill();
  });
}

function loop() { simulate(); draw(); requestAnimationFrame(loop); }
loop();

// Interaction
document.querySelectorAll('.controls button').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.controls button').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    activeType = btn.dataset.type;
  });
});
document.getElementById('search').addEventListener('input', e => { searchTerm = e.target.value.toLowerCase(); });

canvas.addEventListener('click', e => {
  const rect = canvas.getBoundingClientRect();
  const mx = e.clientX - rect.left, my = e.clientY - rect.top;
  const visible = GRAPH.nodes.filter(isVisible);
  let closest = null, closestDist = 20;
  visible.forEach(n => {
    const p = pos[n.id];
    const d = Math.sqrt((p.x - mx)**2 + (p.y - my)**2);
    if (d < closestDist) { closest = n; closestDist = d; }
  });
  selectedNode = closest;
  const info = document.getElementById('info');
  if (!closest) { info.style.display = 'none'; return; }
  const nodeEdges = (edgeIndex[closest.id] || []);
  info.style.display = 'block';
  info.innerHTML = \`
    <h3><span class="type-badge type-\${closest.type}">\${closest.type}</span> \${closest.id}</h3>
    <div class="field"><div class="field-label">Label</div>\${closest.label}</div>
    \${closest.status ? \`<div class="field"><div class="field-label">Status</div>\${closest.status}</div>\` : ''}
    \${closest.goal ? \`<div class="field"><div class="field-label">Goal</div>\${closest.goal.slice(0, 200)}</div>\` : ''}
    \${closest.skill ? \`<div class="field"><div class="field-label">Skill</div>\${closest.skill}</div>\` : ''}
    <div class="edges"><div class="field-label">Edges (\${nodeEdges.length})</div>
    \${nodeEdges.slice(0, 20).map(e => \`<div class="edge-item">\${e.type}: \${e.source === closest.id ? e.target : e.source}</div>\`).join('')}
    \${nodeEdges.length > 20 ? \`<div class="edge-item">... and \${nodeEdges.length - 20} more</div>\` : ''}
    </div>
  \`;
});
</script>
</body>
</html>`;
}

// ---------------------------------------------------------------------------
// Compact text formatter for agent consumption
// ---------------------------------------------------------------------------

function formatQueryResult(result, query) {
  const lines = [];
  const { matches, edges, stats } = result;

  lines.push(`Query result: ${stats.matchCount} matches, ${stats.edgeCount} edges`);
  if (Object.keys(stats.types).length > 0) {
    lines.push(`Types: ${Object.entries(stats.types).map(([k, v]) => `${k}(${v})`).join(', ')}`);
  }
  lines.push('');

  // For "which skills were used" queries, extract skill info from tasks
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

  // Compact node listing
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

  // Relevant edges (compact)
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

/**
 * Check if graph queries are enabled in gad-config.toml.
 * Returns false if the flag is missing or set to false — callers
 * should fall back to raw XML reads in that case.
 */
function isGraphQueryEnabled(repoRoot) {
  try {
    const configPath = path.join(repoRoot, '.planning', 'gad-config.toml');
    if (!fs.existsSync(configPath)) return false;
    const content = fs.readFileSync(configPath, 'utf8');
    const match = content.match(/useGraphQuery\s*=\s*(true|false)/);
    return match ? match[1] === 'true' : false;
  } catch {
    return false;
  }
}

module.exports = {
  buildGraph,
  queryGraph,
  parseNaturalQuery,
  formatQueryResult,
  generateHtml,
  isGraphQueryEnabled,
  extractPdfText,
  // Expose for testing
  parsePhases,
  parseTasks,
  parseDecisions,
  extractTaskRefs,
  extractDecisionRefs,
  extractPhaseRefs,
};
