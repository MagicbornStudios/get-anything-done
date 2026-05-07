'use strict';
/**
 * gad mcp — Model Context Protocol server (Phase 157).
 *
 * Subcommands:
 *   serve   — start the stdio MCP server (long-running; agents pipe to it)
 *   tools   — list registered tools (debug aid)
 *   client-config  — print sample Claude/Cursor config snippet
 */

const path = require('node:path');
const { defineCommand } = require('citty');

function createMcpCommand() {
  const serveCmd = defineCommand({
    meta: { name: 'serve', description: 'Start the MCP stdio server. Long-running. Pipe stdin/stdout from your MCP client.' },
    args: {},
    run() {
      const server = require('../../lib/mcp/server.cjs');
      server.start();
      // Keep alive
      setInterval(() => {}, 1 << 30);
    },
  });

  const toolsCmd = defineCommand({
    meta: { name: 'tools', description: 'List MCP tools registered (debug)' },
    args: {
      json: { type: 'boolean', description: 'JSON output', default: false },
    },
    run({ args }) {
      const tools = require('../../lib/mcp/tools.cjs').listTools();
      if (args.json) { console.log(JSON.stringify(tools.map((t) => ({ name: t.name, description: t.description, inputSchema: t.inputSchema })), null, 2)); return; }
      console.log(`${tools.length} MCP tool(s):\n`);
      for (const t of tools) {
        console.log(`  ${t.name}`);
        console.log(`    ${t.description}`);
      }
    },
  });

  const clientConfigCmd = defineCommand({
    meta: { name: 'client-config', description: 'Print Claude Code / Cursor MCP server config snippet' },
    args: {
      client: { type: 'string', description: 'claude-code | cursor', default: 'claude-code' },
    },
    run({ args }) {
      const gadCliPath = path.resolve(__dirname, '..', 'gad.cjs');
      const snippet = {
        'claude-code': {
          mcpServers: {
            gad: {
              command: 'node',
              args: [gadCliPath, 'mcp', 'serve'],
            },
          },
        },
        cursor: {
          mcpServers: {
            gad: {
              command: 'node',
              args: [gadCliPath, 'mcp', 'serve'],
            },
          },
        },
      };
      const target = args.client || 'claude-code';
      console.log(`# ${target} MCP server config — paste into ~/.config/${target === 'cursor' ? 'cursor' : 'claude-code'}/mcp.json (or equivalent)\n`);
      console.log(JSON.stringify(snippet[target] || snippet['claude-code'], null, 2));
    },
  });

  return defineCommand({
    meta: {
      name: 'mcp',
      description: 'Model Context Protocol server — exposes GAD state (provenance, todos, concerns, handoffs, env, decisions, ask-operator) as MCP tools for any LLM client.',
    },
    subCommands: {
      serve: serveCmd,
      tools: toolsCmd,
      'client-config': clientConfigCmd,
    },
  });
}

module.exports = { createMcpCommand };
module.exports.register = () => ({ mcp: createMcpCommand() });
