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
const {
  countBy,
  extractDecisionRefs,
  extractPhaseRefs,
  extractSkillRefs,
  extractTaskRefs,
  parseDecisions,
  parsePhases,
  parseSkillMd,
  parseTasks,
} = require('./graph/parsers.cjs');
const {
  formatQueryResult,
  parseNaturalQuery,
  normalizeQueryId,
  queryGraph,
} = require('./graph/query.cjs');

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

  // 2. Tasks — prefer per-task JSON files under <planDir>/tasks/ (decision
  // 2026-04-20 D3). Fall back to TASK-REGISTRY.xml when tasks/ is absent
  // or empty. Same shape (id, status, goal, phase, depends, skill, type,
  // keywords) so downstream graph logic is unchanged.
  const taskRegPath = path.join(planDir, 'TASK-REGISTRY.xml');
  const taskFiles = require('./task-files.cjs');
  let tasks = [];
  if (taskFiles.hasTasksDir(planDir)) {
    tasks = taskFiles.listAll(planDir).map(t => ({
      id: t.id,
      status: t.status,
      goal: t.goal,
      phase: t.phase,
      depends: Array.isArray(t.depends) ? t.depends.join(',') : (t.depends || ''),
      skill: t.skill,
      type: t.type,
      keywords: t.keywords,
    }));
  }
  if (tasks.length === 0 && fs.existsSync(taskRegPath)) {
    tasks = parseTasks(fs.readFileSync(taskRegPath, 'utf8'));
  }
  if (tasks.length > 0) {
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

// ---------------------------------------------------------------------------
// Task 63-graph-task-stale: cache invalidation
// ---------------------------------------------------------------------------

/**
 * Source files the graph extractor reads. If any has an mtime newer
 * than graph.json, the cache is stale and `gad query` / `gad snapshot`
 * will return outdated task statuses or miss hand-edited entries.
 *
 * Skill markdown and workflow files are intentionally excluded — they
 * change too rarely to be worth a stat-walk on every snapshot, and
 * task/decision/phase data is what the bug actually surfaced on.
 */
const STALENESS_SOURCES = ['TASK-REGISTRY.xml', 'ROADMAP.xml', 'DECISIONS.xml'];

function safeMtimeMs(filePath) {
  try {
    return fs.statSync(filePath).mtimeMs;
  } catch {
    return 0;
  }
}

/**
 * Returns true when graph.json is older than any of its source XML
 * files. Missing graph.json counts as stale. Missing source files do
 * not (so an empty .planning/ doesn't force perpetual rebuilds).
 *
 * Workaround documented in 63-graph-task-stale: callers that hand-edit
 * TASK-REGISTRY.xml relied on `gad tasks add` to invalidate the cache;
 * with this helper, every read site that goes through loadOrBuildGraph
 * gets invalidation for free.
 */
function isGraphStale(planDir, jsonPath) {
  if (!fs.existsSync(jsonPath)) return true;
  const graphMtime = safeMtimeMs(jsonPath);
  if (graphMtime === 0) return true;
  for (const name of STALENESS_SOURCES) {
    const srcMtime = safeMtimeMs(path.join(planDir, name));
    if (srcMtime > graphMtime) return true;
  }
  return false;
}

/**
 * Single entry point for read sites that want a guaranteed-fresh
 * graph: returns `{ graph, rebuilt, reason }` where `rebuilt` is true
 * when the helper had to re-extract from XML.
 *
 * Honours `readOnly` — when true, never writes graph.json back to
 * disk; useful for snapshot-readers that share filesystem space with
 * other agents and don't want to race on file writes. The returned
 * graph is still freshly built when stale; the file just isn't
 * persisted.
 *
 * On parse errors of an existing graph.json, transparently rebuilds
 * (the disk copy is treated as cache, never source of truth).
 */
function loadOrBuildGraph(root, baseDir, opts = {}) {
  const planDir = path.join(baseDir, root.path, root.planningDir);
  const jsonPath = path.join(planDir, 'graph.json');
  const readOnly = opts.readOnly === true;

  if (!isGraphStale(planDir, jsonPath)) {
    try {
      const graph = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
      return { graph, rebuilt: false, reason: 'fresh', planDir, jsonPath };
    } catch {
      // Fall through to rebuild if the file is corrupt.
    }
  }

  const reason = fs.existsSync(jsonPath) ? 'stale' : 'missing';
  const graph = buildGraph(root, baseDir, opts);
  if (!readOnly) {
    try {
      fs.writeFileSync(jsonPath, JSON.stringify(graph, null, 2));
    } catch {
      // Best-effort persist — the in-memory graph is still returned.
    }
  }
  return { graph, rebuilt: true, reason, planDir, jsonPath };
}

module.exports = {
  buildGraph,
  queryGraph,
  parseNaturalQuery,
  formatQueryResult,
  generateHtml,
  isGraphQueryEnabled,
  isGraphStale,
  loadOrBuildGraph,
  extractPdfText,
  // Expose for testing
  parsePhases,
  parseTasks,
  parseDecisions,
  extractTaskRefs,
  extractDecisionRefs,
  extractPhaseRefs,
};
