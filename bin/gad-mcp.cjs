#!/usr/bin/env node
'use strict';

/**
 * GAD MCP Server — Stdio transport.
 *
 * Thin adapter over the same core as the CLI. Exposes planning operations
 * as MCP tools for Cursor, Claude Code, Codex, and other MCP-aware editors.
 *
 * Tools:
 *   gad_snapshot  — Full project snapshot (state, roadmap, tasks, decisions)
 *   gad_state     — Current state for a project
 *   gad_tasks     — Task list with statuses
 *   gad_phases    — Roadmap phases
 *   gad_decisions — Decision log
 *   gad_verify    — Verify planning refs (same as gad dev --once)
 *
 * Usage:
 *   node bin/gad-mcp.cjs                    # stdio transport
 *   Add to ~/.codex/config.toml or .cursor/ as an MCP server
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');

const gadConfig = require('./gad-config.cjs');
const { readState } = require('../lib/state-reader.cjs');
const { readTasks } = require('../lib/task-registry-reader.cjs');
const { readPhases } = require('../lib/roadmap-reader.cjs');
const { readDecisions } = require('../lib/decisions-reader.cjs');
const { verifyPlanningXmlRefs } = require('../lib/planning-ref-verify.cjs');
const skillHelpers = require('../lib/skill-helpers.cjs');

// Inlined from lib/evolution-config.cjs — that module is a factory that
// needs injected deps; the MCP server is a thin stdio adapter that doesn't
// have them. Two lines of env-aware path resolution is cheaper than
// wiring the full factory.
function resolveSkillRoots(repoRoot) {
  const pathMod = path;
  return {
    finalSkillsDir: process.env.GAD_SKILLS_DIR
      ? pathMod.resolve(process.env.GAD_SKILLS_DIR)
      : pathMod.join(repoRoot, 'skills'),
    protoSkillsDir: process.env.GAD_PROTO_SKILLS_DIR
      ? pathMod.resolve(process.env.GAD_PROTO_SKILLS_DIR)
      : pathMod.join(repoRoot, '.planning', 'proto-skills'),
  };
}

// ---------------------------------------------------------------------------
// MCP protocol helpers (JSON-RPC 2.0 over stdio)
// ---------------------------------------------------------------------------

function sendResponse(id, result) {
  const msg = JSON.stringify({ jsonrpc: '2.0', id, result });
  process.stdout.write(`Content-Length: ${Buffer.byteLength(msg)}\r\n\r\n${msg}`);
}

function sendError(id, code, message) {
  const msg = JSON.stringify({ jsonrpc: '2.0', id, error: { code, message } });
  process.stdout.write(`Content-Length: ${Buffer.byteLength(msg)}\r\n\r\n${msg}`);
}

// ---------------------------------------------------------------------------
// Tool definitions
// ---------------------------------------------------------------------------

const TOOLS = [
  {
    name: 'gad_snapshot',
    description: 'Full project snapshot — state, roadmap, tasks, decisions, file refs. Low-token context for session start.',
    inputSchema: {
      type: 'object',
      properties: {
        projectid: { type: 'string', description: 'Project ID (e.g. get-anything-done, global)' },
      },
      required: ['projectid'],
    },
  },
  {
    name: 'gad_state',
    description: 'Current state for a project — phase, milestone, status, next-action.',
    inputSchema: {
      type: 'object',
      properties: {
        projectid: { type: 'string', description: 'Project ID' },
      },
      required: ['projectid'],
    },
  },
  {
    name: 'gad_tasks',
    description: 'Task list with statuses for a project.',
    inputSchema: {
      type: 'object',
      properties: {
        projectid: { type: 'string', description: 'Project ID' },
      },
      required: ['projectid'],
    },
  },
  {
    name: 'gad_phases',
    description: 'Roadmap phases for a project.',
    inputSchema: {
      type: 'object',
      properties: {
        projectid: { type: 'string', description: 'Project ID' },
      },
      required: ['projectid'],
    },
  },
  {
    name: 'gad_decisions',
    description: 'Decision log for a project.',
    inputSchema: {
      type: 'object',
      properties: {
        projectid: { type: 'string', description: 'Project ID' },
      },
      required: ['projectid'],
    },
  },
  {
    name: 'gad_verify',
    description: 'Verify all planning XML file references exist on disk. Returns JSON with ok/missing.',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'gad_skills_list',
    description: 'List available GAD skills (canonical + proto) with id, name, description, workflow. Use this INSTEAD of reading .claude/skills/ or .codex/skills/ — skills are loaded on-demand, not via runtime auto-discovery. Optionally filter by lane (dev|prod|meta) or search term.',
    inputSchema: {
      type: 'object',
      properties: {
        lane: { type: 'string', description: 'Filter by lane — dev | prod | meta' },
        search: { type: 'string', description: 'Keyword filter across id/name/description (case-insensitive substring)' },
        include_proto: { type: 'boolean', description: 'Include proto-skills from .planning/proto-skills/ (default true)' },
        limit: { type: 'integer', description: 'Max results (default 200 — set lower for token economy)' },
      },
    },
  },
  {
    name: 'gad_skills_find',
    description: 'Keyword-ranked skill search. Returns top-N matches by relevance to a natural-language query. Use when you have a task in mind and want the best-matching skill.',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Natural-language query — e.g. "write a commit message", "debug flaky test", "render a UI surface"' },
        limit: { type: 'integer', description: 'Max results (default 10)' },
      },
      required: ['query'],
    },
  },
  {
    name: 'gad_skills_show',
    description: 'Full SKILL.md + linked workflow body for one skill id. Use after gad_skills_list / gad_skills_find to pull the complete skill contents on demand — no runtime-folder auto-discovery needed.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Skill id (e.g. gad-plan-phase, create-skill)' },
        include_workflow: { type: 'boolean', description: 'Include the linked workflow file body (default true)' },
      },
      required: ['id'],
    },
  },
];

// ---------------------------------------------------------------------------
// Tool handlers
// ---------------------------------------------------------------------------

function findRepoRoot() {
  let dir = process.cwd();
  for (let i = 0; i < 10; i++) {
    if (fs.existsSync(path.join(dir, 'gad-config.toml')) ||
        fs.existsSync(path.join(dir, '.planning', 'gad-config.toml')) ||
        fs.existsSync(path.join(dir, 'planning-config.toml')) ||
        fs.existsSync(path.join(dir, '.planning', 'planning-config.toml')) ||
        fs.existsSync(path.join(dir, '.planning', 'config.json')) ||
        fs.existsSync(path.join(dir, 'config.json'))) {
      return dir;
    }
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return process.cwd();
}

function findProjectRoot(config, projectId) {
  const root = config.roots.find(r => r.id === projectId);
  if (!root) return null;
  return root.path;
}

function handleToolCall(toolName, args) {
  const baseDir = findRepoRoot();
  const config = gadConfig.load(baseDir);

  switch (toolName) {
    case 'gad_snapshot': {
      const { execSync } = require('child_process');
      try {
        const output = execSync(
          `node "${path.join(__dirname, 'gad.cjs')}" snapshot --projectid "${args.projectid}"`,
          { cwd: baseDir, encoding: 'utf8', timeout: 10000 }
        );
        return [{ type: 'text', text: output }];
      } catch (e) {
        return [{ type: 'text', text: `Error: ${e.message}` }];
      }
    }

    case 'gad_state': {
      const projectRoot = findProjectRoot(config, args.projectid);
      if (!projectRoot) return [{ type: 'text', text: `Project '${args.projectid}' not found.` }];
      const planDir = path.join(projectRoot, '.planning');
      const state = readState(planDir);
      return [{ type: 'text', text: JSON.stringify(state, null, 2) }];
    }

    case 'gad_tasks': {
      const projectRoot = findProjectRoot(config, args.projectid);
      if (!projectRoot) return [{ type: 'text', text: `Project '${args.projectid}' not found.` }];
      const planDir = path.join(projectRoot, '.planning');
      const tasks = readTasks(planDir);
      return [{ type: 'text', text: JSON.stringify(tasks, null, 2) }];
    }

    case 'gad_phases': {
      const projectRoot = findProjectRoot(config, args.projectid);
      if (!projectRoot) return [{ type: 'text', text: `Project '${args.projectid}' not found.` }];
      const planDir = path.join(projectRoot, '.planning');
      const phases = readPhases(planDir);
      return [{ type: 'text', text: JSON.stringify(phases, null, 2) }];
    }

    case 'gad_decisions': {
      const projectRoot = findProjectRoot(config, args.projectid);
      if (!projectRoot) return [{ type: 'text', text: `Project '${args.projectid}' not found.` }];
      const planDir = path.join(projectRoot, '.planning');
      const decisions = readDecisions(planDir);
      return [{ type: 'text', text: JSON.stringify(decisions, null, 2) }];
    }

    case 'gad_verify': {
      const result = verifyPlanningXmlRefs(baseDir);
      return [{ type: 'text', text: JSON.stringify(result, null, 2) }];
    }

    case 'gad_skills_list': {
      const roots = resolveSkillRoots(baseDir);
      const includeProto = args.include_proto !== false;
      const limit = Number.isInteger(args.limit) ? args.limit : 200;
      const laneFilter = args.lane ? String(args.lane).trim().toLowerCase() : '';
      const searchTerm = args.search ? String(args.search).trim().toLowerCase() : '';

      const out = [];
      const harvest = (dir, origin) => {
        if (!dir) return;
        for (const s of skillHelpers.listSkillDirs(dir)) {
          const fm = skillHelpers.readSkillFrontmatter(s.skillFile) || {};
          if (laneFilter && !skillHelpers.skillMatchesLane(fm, laneFilter)) continue;
          const name = fm.name || s.id;
          const desc = (fm.description || '').replace(/\s+/g, ' ').trim();
          if (searchTerm) {
            const hay = `${s.id} ${name} ${desc}`.toLowerCase();
            if (!hay.includes(searchTerm)) continue;
          }
          out.push({
            id: s.id,
            name,
            description: desc.slice(0, 400),
            workflow: fm.workflow || null,
            lane: skillHelpers.normalizeSkillLaneValues ? skillHelpers.normalizeSkillLaneValues(fm.lane) : [],
            origin,
          });
          if (out.length >= limit) return;
        }
      };
      harvest(roots.finalSkillsDir, 'canonical');
      if (includeProto && out.length < limit) harvest(roots.protoSkillsDir, 'proto');

      return [{ type: 'text', text: JSON.stringify({ count: out.length, skills: out }, null, 2) }];
    }

    case 'gad_skills_find': {
      const query = String(args.query || '').toLowerCase().trim();
      if (!query) return [{ type: 'text', text: `Error: query is required` }];
      const limit = Number.isInteger(args.limit) ? args.limit : 10;
      const roots = resolveSkillRoots(baseDir);
      const queryTokens = new Set(query.split(/[^a-z0-9]+/).filter(t => t.length >= 2));

      const entries = [];
      const harvest = (dir, kind) => {
        if (!dir) return;
        for (const s of skillHelpers.listSkillDirs(dir)) {
          const fm = skillHelpers.readSkillFrontmatter(s.skillFile) || {};
          const haystack = `${s.id} ${fm.name || ''} ${fm.description || ''}`.toLowerCase();
          const haystackTokens = new Set(haystack.split(/[^a-z0-9]+/).filter(Boolean));
          let score = 0;
          if (haystack.includes(query)) score += 10;
          for (const t of queryTokens) if (haystackTokens.has(t)) score += 2;
          for (const t of queryTokens) for (const ht of haystackTokens) if (ht !== t && ht.includes(t)) score += 1;
          if (score > 0) {
            entries.push({
              id: s.id,
              name: fm.name || s.id,
              description: (fm.description || '').replace(/\s+/g, ' ').trim().slice(0, 400),
              workflow: fm.workflow || null,
              kind,
              score,
            });
          }
        }
      };
      harvest(roots.finalSkillsDir, 'canonical');
      harvest(roots.protoSkillsDir, 'proto');
      entries.sort((a, b) => b.score - a.score);
      const top = entries.slice(0, limit);

      return [{ type: 'text', text: JSON.stringify({ query, total: entries.length, returned: top.length, matches: top }, null, 2) }];
    }

    case 'gad_skills_show': {
      const id = String(args.id || '').trim();
      if (!id) return [{ type: 'text', text: `Error: id is required` }];
      const includeWorkflow = args.include_workflow !== false;
      const roots = resolveSkillRoots(baseDir);

      let hit = null;
      for (const [label, dir] of [['canonical', roots.finalSkillsDir], ['proto', roots.protoSkillsDir]]) {
        if (!dir) continue;
        const entries = skillHelpers.listSkillDirs(dir);
        for (const s of entries) {
          const fm = skillHelpers.readSkillFrontmatter(s.skillFile) || {};
          if (s.id === id || fm.name === id || fm.name === `gad:${id.replace(/^gad-/, '')}`) {
            hit = { ...s, fm, origin: label };
            break;
          }
        }
        if (hit) break;
      }
      if (!hit) return [{ type: 'text', text: JSON.stringify({ error: `Skill not found: ${id}` }) }];

      const out = {
        id: hit.id,
        origin: hit.origin,
        name: hit.fm.name || hit.id,
        description: hit.fm.description || '',
        workflow: hit.fm.workflow || null,
        skill_md_path: hit.skillFile,
        skill_md_body: fs.readFileSync(hit.skillFile, 'utf8'),
      };
      if (includeWorkflow && hit.fm.workflow) {
        const wf = skillHelpers.resolveSkillWorkflowPath(baseDir, hit.dir, hit.fm.workflow);
        if (wf && fs.existsSync(wf)) {
          out.workflow_path = wf;
          out.workflow_body = fs.readFileSync(wf, 'utf8');
        } else {
          out.workflow_path = wf || null;
          out.workflow_missing = true;
        }
      }
      return [{ type: 'text', text: JSON.stringify(out, null, 2) }];
    }

    default:
      return [{ type: 'text', text: `Unknown tool: ${toolName}` }];
  }
}

// ---------------------------------------------------------------------------
// MCP message router
// ---------------------------------------------------------------------------

function handleMessage(msg) {
  const { id, method, params } = msg;

  switch (method) {
    case 'initialize':
      sendResponse(id, {
        protocolVersion: '2024-11-05',
        capabilities: { tools: {} },
        serverInfo: { name: 'gad-mcp', version: require('../package.json').version },
      });
      break;

    case 'notifications/initialized':
      // No response needed
      break;

    case 'tools/list':
      sendResponse(id, { tools: TOOLS });
      break;

    case 'tools/call': {
      const { name, arguments: toolArgs } = params;
      try {
        const content = handleToolCall(name, toolArgs || {});
        sendResponse(id, { content });
      } catch (e) {
        sendResponse(id, { content: [{ type: 'text', text: `Error: ${e.message}` }], isError: true });
      }
      break;
    }

    default:
      if (id) sendError(id, -32601, `Method not found: ${method}`);
      break;
  }
}

// ---------------------------------------------------------------------------
// Stdio transport
// ---------------------------------------------------------------------------

let buffer = Buffer.alloc(0);

process.stdin.on('data', (chunk) => {
  const buf = typeof chunk === 'string' ? Buffer.from(chunk, 'utf8') : chunk;
  buffer = Buffer.concat([buffer, buf]);

  // Parse Content-Length framed messages
  while (true) {
    const headerEnd = buffer.indexOf('\r\n\r\n');
    if (headerEnd < 0) break;

    const header = buffer.slice(0, headerEnd).toString('utf8');
    const match = header.match(/Content-Length:\s*(\d+)/i);
    if (!match) {
      buffer = buffer.slice(headerEnd + 4);
      continue;
    }

    const contentLength = parseInt(match[1]);
    const bodyStart = headerEnd + 4;
    if (buffer.length < bodyStart + contentLength) break;

    const body = buffer.slice(bodyStart, bodyStart + contentLength).toString('utf8');
    buffer = buffer.slice(bodyStart + contentLength);

    try {
      const msg = JSON.parse(body);
      handleMessage(msg);
    } catch (e) {
      // Malformed JSON — skip
    }
  }
});

process.stderr.write(`gad-mcp server started (stdio)\n`);
