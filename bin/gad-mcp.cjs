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
        fs.existsSync(path.join(dir, '.planning', 'planning-config.toml'))) {
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
