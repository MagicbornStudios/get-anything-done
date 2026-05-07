'use strict';
/**
 * lib/mcp/server.cjs — Model Context Protocol stdio server for GAD.
 *
 * Phase 157. Hand-rolled JSON-RPC 2.0 over stdin/stdout — no @modelcontextprotocol/sdk
 * dependency. The MCP spec is small: initialize + tools/list + tools/call covers v1.
 *
 * Wire-up: any MCP-compatible LLM client (Claude Code, Cursor, future SLM with MCP
 * support) adds this server in its config and gets typed tool access to GAD state.
 *
 * Reference: https://modelcontextprotocol.io/specification
 */

const tools = require('./tools.cjs');

const PROTOCOL_VERSION = '2024-11-05';

function sendMessage(msg) {
  const line = JSON.stringify(msg);
  process.stdout.write(line + '\n');
}

function sendError(id, code, message, data = undefined) {
  sendMessage({
    jsonrpc: '2.0',
    id,
    error: { code, message, ...(data !== undefined ? { data } : {}) },
  });
}

function sendResult(id, result) {
  sendMessage({ jsonrpc: '2.0', id, result });
}

async function handleInitialize(id, params) {
  sendResult(id, {
    protocolVersion: PROTOCOL_VERSION,
    capabilities: {
      tools: { listChanged: false },
      resources: { subscribe: false, listChanged: false },
    },
    serverInfo: {
      name: 'gad-mcp',
      version: '1.0.0',
    },
  });
}

async function handleToolsList(id) {
  const list = tools.listTools().map((t) => ({
    name: t.name,
    description: t.description,
    inputSchema: t.inputSchema,
  }));
  sendResult(id, { tools: list });
}

async function handleToolsCall(id, params) {
  const name = params && params.name;
  const args = (params && params.arguments) || {};
  const tool = tools.getTool(name);
  if (!tool) {
    sendError(id, -32601, `Tool not found: ${name}`);
    return;
  }
  try {
    const result = await tool.run(args);
    // MCP expects content array with typed parts
    const content = Array.isArray(result)
      ? result
      : [{ type: 'text', text: typeof result === 'string' ? result : JSON.stringify(result, null, 2) }];
    sendResult(id, { content, isError: false });
  } catch (e) {
    sendResult(id, {
      content: [{ type: 'text', text: `Error: ${e.message || String(e)}` }],
      isError: true,
    });
  }
}

async function handleMessage(msg) {
  if (!msg || msg.jsonrpc !== '2.0') return;
  const { id, method, params } = msg;

  // Notifications (no id) per JSON-RPC 2.0
  if (id === undefined) {
    if (method === 'notifications/initialized') {
      // client signaled it's ready; nothing to do
    }
    return;
  }

  switch (method) {
    case 'initialize':
      return handleInitialize(id, params);
    case 'tools/list':
      return handleToolsList(id);
    case 'tools/call':
      return handleToolsCall(id, params);
    case 'ping':
      return sendResult(id, {});
    default:
      sendError(id, -32601, `Method not found: ${method}`);
  }
}

function start() {
  let buffer = '';
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', (chunk) => {
    buffer += chunk;
    // MCP stdio transport uses newline-delimited JSON
    let nl;
    while ((nl = buffer.indexOf('\n')) !== -1) {
      const line = buffer.slice(0, nl).trim();
      buffer = buffer.slice(nl + 1);
      if (!line) continue;
      try {
        const msg = JSON.parse(line);
        handleMessage(msg).catch((e) => {
          if (msg && msg.id !== undefined) sendError(msg.id, -32603, e.message || String(e));
        });
      } catch (e) {
        // malformed; ignore (no id to respond against)
      }
    }
  });
  process.stdin.on('end', () => process.exit(0));
  // Heartbeat-ish: server announces itself via stderr (not stdout — that's the
  // protocol channel)
  process.stderr.write(`gad-mcp v1.0.0 ready (protocol ${PROTOCOL_VERSION}, ${tools.listTools().length} tools)\n`);
}

module.exports = { start, PROTOCOL_VERSION };
