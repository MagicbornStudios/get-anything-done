'use strict';
/**
 * gad issues â€” durable operator inbox for non-blocking planning findings.
 *
 * `gad issues --web` launches a tiny localhost capture UI. Captures are stored
 * as one markdown file per issue under <planningDir>/issues/open/.
 */

const fs = require('fs');
const path = require('path');
const { spawn, spawnSync } = require('child_process');
const { defineCommand } = require('citty');

const {
  IssueError,
  createIssue,
  listIssues,
  readIssue,
  closeIssue,
} = require('../../lib/issues.cjs');
const { renderIssuesHtml } = require('../../lib/issues-web-html.cjs');

const DEFAULT_PORT = 3939;
const DEFAULT_HOST = '127.0.0.1';

function createIssuesCommand(deps) {
  const {
    findRepoRoot,
    gadConfig,
    resolveRoots,
    outputError,
    render,
    shouldUseJson,
    readPhases,
    readTasks,
    RAW_ARGV,
  } = deps;

  function loadContext() {
    const baseDir = findRepoRoot();
    const config = gadConfig.load(baseDir);
    return { baseDir, config };
  }

  function resolveOneRoot(projectid) {
    const { baseDir, config } = loadContext();
    const roots = resolveRoots({ projectid: projectid || '' }, baseDir, config.roots);
    if (roots.length === 0) {
      outputError('No project resolved. Pass --projectid <id> or run from a project root.');
      return null;
    }
    if (roots.length > 1) {
      outputError('This issues subcommand requires a single project. Pass --projectid <id>.');
      return null;
    }
    return { baseDir, config, root: roots[0] };
  }

  function rootByProjectid(baseDir, config, projectid) {
    const root = config.roots.find((entry) => entry.id === projectid);
    if (!root) {
      const known = config.roots.map((entry) => entry.id).join(', ');
      throw new IssueError('VALIDATION_FAILED', `Unknown projectid '${projectid}'. Known projects: ${known}`);
    }
    return root;
  }

  function issueRow(baseDir, issue) {
    const fm = issue.frontmatter || {};
    return {
      project: fm.projectid || issue.projectid,
      id: issue.id,
      status: fm.status || issue.bucket,
      severity: fm.severity || '',
      type: fm.type || '',
      phase: fm.phase || '',
      task: fm.task_id || '',
      title: fm.title || '',
      created_at: fm.created_at || '',
      file: path.relative(baseDir, issue.filePath),
    };
  }

  const listCmd = defineCommand({
    meta: { name: 'list', description: 'List captured planning issues' },
    args: {
      projectid: { type: 'string', description: 'Scope to one project by id', default: '' },
      status: { type: 'string', description: 'open | closed | all', default: 'open' },
      phase: { type: 'string', description: 'Filter by phase id', default: '' },
      type: { type: 'string', description: 'Filter by issue type', default: '' },
      json: { type: 'boolean', description: 'JSON output', default: false },
    },
    run({ args }) {
      const { baseDir, config } = loadContext();
      const roots = resolveRoots({ projectid: args.projectid }, baseDir, config.roots);
      if (roots.length === 0) return;
      const rows = [];
      for (const root of roots) {
        const issues = listIssues(root, baseDir, {
          bucket: args.status === 'all' ? 'all' : args.status || 'open',
          phase: args.phase || undefined,
          type: args.type || undefined,
        });
        for (const issue of issues) rows.push(issueRow(baseDir, issue));
      }
      if (rows.length === 0) {
        console.log('No issues found.');
        return;
      }
      const fmt = args.json ? 'json' : (shouldUseJson() ? 'json' : 'table');
      console.log(render(rows, { format: fmt, title: `Issues (${rows.length})` }));
    },
  });

  const showCmd = defineCommand({
    meta: { name: 'show', description: 'Show one captured planning issue' },
    args: {
      id: { type: 'positional', description: 'Issue id', required: true },
      projectid: { type: 'string', description: 'Scope to one project by id', default: '' },
      json: { type: 'boolean', description: 'JSON output', default: false },
    },
    run({ args }) {
      const resolved = resolveOneRoot(args.projectid);
      if (!resolved) return;
      try {
        const issue = readIssue(resolved.root, resolved.baseDir, String(args.id));
        if (args.json || shouldUseJson()) {
          console.log(JSON.stringify({ ...issue.frontmatter, body: issue.body, filePath: issue.filePath }, null, 2));
          return;
        }
        console.log(`Issue:   ${issue.id}`);
        console.log(`Project: ${issue.frontmatter.projectid || resolved.root.id}`);
        console.log(`Status:  ${issue.frontmatter.status || issue.bucket}`);
        console.log(`Title:   ${issue.frontmatter.title || '(untitled)'}`);
        console.log(`File:    ${path.relative(resolved.baseDir, issue.filePath)}`);
        console.log('');
        console.log(issue.body.trim());
      } catch (error) {
        if (error instanceof IssueError) outputError(error.message);
        else throw error;
      }
    },
  });

  const addCmd = defineCommand({
    meta: { name: 'add', description: 'Capture a new planning issue' },
    args: {
      title: { type: 'string', description: 'Short issue title', required: true },
      body: { type: 'string', description: 'Issue body / prompt to revisit later', required: true },
      projectid: { type: 'string', description: 'Scope to one project by id', default: '' },
      phase: { type: 'string', description: 'Related phase id', default: '' },
      'task-id': { type: 'string', description: 'Related task id', default: '' },
      severity: { type: 'string', description: 'low | normal | high | critical', default: 'normal' },
      type: { type: 'string', description: 'note | agent-error | bug | ux | planning | follow-up', default: 'note' },
      source: { type: 'string', description: 'Provenance hint', default: 'operator-cli' },
    },
    run({ args }) {
      const resolved = resolveOneRoot(args.projectid);
      if (!resolved) return;
      try {
        const result = createIssue(resolved.root, resolved.baseDir, {
          projectid: resolved.root.id,
          title: args.title,
          body: args.body,
          phase: args.phase || undefined,
          taskId: args['task-id'] || undefined,
          severity: args.severity || 'normal',
          type: args.type || 'note',
          source: args.source || 'operator-cli',
        });
        console.log(`Captured: ${result.id}`);
        console.log(`Path:     ${path.relative(resolved.baseDir, result.filePath)}`);
      } catch (error) {
        if (error instanceof IssueError) outputError(error.message);
        else throw error;
      }
    },
  });

  const closeCmd = defineCommand({
    meta: { name: 'close', description: 'Close a captured planning issue' },
    args: {
      id: { type: 'positional', description: 'Issue id', required: true },
      projectid: { type: 'string', description: 'Scope to one project by id', default: '' },
    },
    run({ args }) {
      const resolved = resolveOneRoot(args.projectid);
      if (!resolved) return;
      try {
        const destPath = closeIssue(resolved.root, resolved.baseDir, String(args.id));
        console.log(`Closed: ${args.id}`);
        console.log(`Path:   ${path.relative(resolved.baseDir, destPath)}`);
      } catch (error) {
        if (error instanceof IssueError) outputError(error.message);
        else throw error;
      }
    },
  });

  function serveWeb(args) {
    const { baseDir, config } = loadContext();
    const explicitProject = args.projectid || '';
    const defaultProjectid =
      explicitProject ||
      (config.roots.some((root) => root.id === 'global') ? 'global' : (config.roots[0] && config.roots[0].id) || '');
    const requestedPort = parseInt(String(args.port || process.env.GAD_ISSUES_PORT || DEFAULT_PORT), 10) || DEFAULT_PORT;
    const host = args.host || DEFAULT_HOST;

    startIssuesServer({
      baseDir,
      config,
      host,
      port: requestedPort,
      defaultProjectid,
      rootByProjectid,
      readPhases,
      readTasks,
      dev: Boolean(args.dev),
    });
  }

  const webCmd = defineCommand({
    meta: { name: 'web', description: 'Launch the local issue capture web UI' },
    args: {
      projectid: { type: 'string', description: 'Default project id for capture', default: '' },
      host: { type: 'string', description: 'Bind host', default: DEFAULT_HOST },
      port: { type: 'string', description: `Port (default ${DEFAULT_PORT}, or GAD_ISSUES_PORT)`, default: '' },
      dev: { type: 'boolean', description: 'Reload web UI source from disk on each page request', default: false },
    },
    run({ args }) {
      serveWeb(args);
    },
  });

  const devCmd = defineCommand({
    meta: { name: 'dev', description: 'Launch the issue capture UI with source reload on browser refresh' },
    args: {
      projectid: { type: 'string', description: 'Default project id for capture', default: '' },
      host: { type: 'string', description: 'Bind host', default: DEFAULT_HOST },
      port: { type: 'string', description: `Port (default ${DEFAULT_PORT}, or GAD_ISSUES_PORT)`, default: '' },
    },
    run({ args }) {
      serveWeb({ ...args, dev: true });
    },
  });

  function hasExplicitIssuesSubcommand() {
    const argv = Array.isArray(RAW_ARGV) ? RAW_ARGV : process.argv;
    const idx = argv.findIndex((part) => part === 'issues' || part === 'inbox');
    if (idx === -1) return false;
    const next = argv.slice(idx + 1).find((part) => part && !String(part).startsWith('-'));
    return ['list', 'show', 'add', 'close', 'web', 'dev'].includes(next);
  }

  return defineCommand({
    meta: { name: 'issues', description: 'Capture and review durable planning issues' },
    args: {
      web: { type: 'boolean', description: 'Launch the local issue capture web UI', default: false },
      projectid: { type: 'string', description: 'Default project id for capture', default: '' },
      host: { type: 'string', description: 'Bind host for --web', default: DEFAULT_HOST },
      port: { type: 'string', description: `Port for --web (default ${DEFAULT_PORT}, or GAD_ISSUES_PORT)`, default: '' },
      dev: { type: 'boolean', description: 'With --web, reload web UI source from disk on browser refresh', default: false },
    },
    subCommands: {
      list: listCmd,
      show: showCmd,
      add: addCmd,
      close: closeCmd,
      web: webCmd,
      dev: devCmd,
    },
    run({ args }) {
      if (hasExplicitIssuesSubcommand()) return;
      if (args.web) {
        serveWeb(args);
        return;
      }
      listCmd.run({ args: { ...args, status: 'open' } });
    },
  });
}

function startIssuesServer({
  baseDir,
  config,
  host,
  port,
  defaultProjectid,
  rootByProjectid,
  readPhases,
  readTasks,
  dev = false,
}) {
  const http = require('http');

  function sendJson(res, status, payload) {
    res.writeHead(status, {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
    });
    res.end(JSON.stringify(payload, null, 2));
  }

  function sendHtml(res) {
    res.writeHead(200, {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
    });
    res.end(renderIssuesHtmlForRequest({ baseDir, dev }));
  }

  function readJsonBody(req) {
    return new Promise((resolve, reject) => {
      let body = '';
      req.on('data', (chunk) => {
        body += chunk;
        if (body.length > 1024 * 1024) {
          reject(new Error('Request body too large'));
          req.destroy();
        }
      });
      req.on('end', () => {
        if (!body.trim()) {
          resolve({});
          return;
        }
        try {
          resolve(JSON.parse(body));
        } catch (error) {
          reject(error);
        }
      });
      req.on('error', reject);
    });
  }

  function listIssuePayload(root, status) {
    return listIssues(root, baseDir, { bucket: status === 'all' ? 'all' : status || 'open' }).map((issue) => ({
      id: issue.id,
      bucket: issue.bucket,
      body: issue.body,
      filePath: path.relative(baseDir, issue.filePath),
      ...issue.frontmatter,
    }));
  }

  function projectPayload(projectid) {
    const root = rootByProjectid(baseDir, config, projectid);
    const phases = readPhases(root, baseDir).map((phase) => ({
      id: phase.id,
      title: phase.title,
      status: phase.status,
    }));
    const tasks = readTasks(root, baseDir, {}).map((task) => ({
      id: task.id,
      phase: task.phase,
      status: task.status,
      goal: task.goal,
    }));
    return { root, phases, tasks };
  }

  const server = http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url, `http://${host}:${port}`);
      if (req.method === 'GET' && (url.pathname === '/' || url.pathname === '/index.html')) {
        sendHtml(res);
        return;
      }
      if (req.method === 'GET' && url.pathname === '/favicon.ico') {
        res.writeHead(204);
        res.end();
        return;
      }
      if (req.method === 'GET' && url.pathname === '/api/bootstrap') {
        sendJson(res, 200, {
          defaultProjectid,
          projects: config.roots.map((root) => ({
            id: root.id,
            path: root.path,
            planningDir: root.planningDir,
            kind: classifyPlanningRoot(root),
          })),
          severities: ['low', 'normal', 'high', 'critical'],
          types: ['note', 'agent-error', 'bug', 'ux', 'planning', 'follow-up'],
        });
        return;
      }
      if (req.method === 'GET' && url.pathname === '/api/project') {
        const projectid = url.searchParams.get('projectid') || defaultProjectid;
        const { phases, tasks } = projectPayload(projectid);
        sendJson(res, 200, { projectid, phases, tasks });
        return;
      }
      if (req.method === 'GET' && url.pathname === '/api/issues') {
        const projectid = url.searchParams.get('projectid') || defaultProjectid;
        const status = url.searchParams.get('status') || 'open';
        const root = rootByProjectid(baseDir, config, projectid);
        sendJson(res, 200, { projectid, issues: listIssuePayload(root, status) });
        return;
      }
      if (req.method === 'POST' && url.pathname === '/api/issues') {
        const payload = await readJsonBody(req);
        const projectid = String(payload.projectid || defaultProjectid);
        const root = rootByProjectid(baseDir, config, projectid);
        const result = createIssue(root, baseDir, {
          projectid,
          title: payload.title,
          body: payload.body,
          phase: payload.phase || undefined,
          taskId: payload.taskId || undefined,
          severity: payload.severity || 'normal',
          type: payload.type || 'note',
          source: 'operator-web',
        });
        sendJson(res, 201, {
          id: result.id,
          filePath: path.relative(baseDir, result.filePath),
          ...result.frontmatter,
        });
        return;
      }
      const closeMatch = url.pathname.match(/^\/api\/issues\/([^/]+)\/close$/);
      if (req.method === 'POST' && closeMatch) {
        const payload = await readJsonBody(req);
        const projectid = String(payload.projectid || defaultProjectid);
        const root = rootByProjectid(baseDir, config, projectid);
        const filePath = closeIssue(root, baseDir, decodeURIComponent(closeMatch[1]));
        sendJson(res, 200, { ok: true, filePath: path.relative(baseDir, filePath) });
        return;
      }
      if (req.method === 'POST' && url.pathname === '/api/shutdown') {
        sendJson(res, 200, { ok: true });
        setTimeout(() => {
          server.close(() => process.exit(0));
        }, 100);
        return;
      }
      if (req.method === 'POST' && url.pathname === '/api/tui') {
        const payload = await readJsonBody(req);
        const projectid = String(payload.projectid || defaultProjectid);
        launchGadTui({ baseDir, projectid });
        sendJson(res, 200, { ok: true, projectid });
        return;
      }
      sendJson(res, 404, { error: 'Not found' });
    } catch (error) {
      const message = error && error.message ? error.message : String(error);
      sendJson(res, error instanceof IssueError ? 400 : 500, { error: message });
    }
  });

  function listenWithRetry(portToTry, attemptsUsed) {
    const onListening = () => {
      server.removeListener('error', onError);
      const addr = server.address();
      const boundPort = addr && typeof addr === 'object' ? addr.port : portToTry;
      console.log(`[gad issues] capture UI http://${host}:${boundPort}/`);
      if (dev) console.log('[gad issues] dev mode: UI source reloads on browser refresh');
      console.log('[gad issues] press ctrl+c or use Shutdown in the UI to stop');
    };
    const onError = (error) => {
      server.removeListener('listening', onListening);
      if (error && error.code === 'EADDRINUSE' && attemptsUsed < 50) {
        const nextPort = portToTry + 1;
        console.log(`[gad issues] port ${portToTry} in use, trying ${nextPort}`);
        listenWithRetry(nextPort, attemptsUsed + 1);
        return;
      }
      throw error;
    };
    server.once('listening', onListening);
    server.once('error', onError);
    server.listen(portToTry, host);
  }

  listenWithRetry(port, 0);
  return server;
}

function renderIssuesHtmlForRequest({ baseDir, dev }) {
  if (!dev) return renderIssuesHtml();
  const sourcePath = resolveIssuesWebHtmlSource(baseDir);
  if (!sourcePath) return renderIssuesHtml();
  try {
    const resolved = require.resolve(sourcePath);
    delete require.cache[resolved];
    const fresh = require(resolved);
    if (fresh && typeof fresh.renderIssuesHtml === 'function') {
      return fresh.renderIssuesHtml();
    }
  } catch (error) {
    return [
      '<!doctype html><meta charset="utf-8">',
      '<title>GAD Issue Capture - Dev Load Error</title>',
      '<pre style="white-space:pre-wrap;font:14px monospace;color:#f6f0df;background:#10100e;padding:24px">',
      escapeHtml(`Failed to reload ${sourcePath}\n\n${error.stack || error.message || error}`),
      '</pre>',
    ].join('');
  }
  return renderIssuesHtml();
}

function resolveIssuesWebHtmlSource(baseDir) {
  const candidates = [
    process.env.GAD_ISSUES_WEB_SOURCE,
    path.join(process.cwd(), 'lib', 'issues-web-html.cjs'),
    path.join(process.cwd(), 'vendor', 'get-anything-done', 'lib', 'issues-web-html.cjs'),
    path.join(baseDir || '', 'lib', 'issues-web-html.cjs'),
    path.join(baseDir || '', 'vendor', 'get-anything-done', 'lib', 'issues-web-html.cjs'),
  ].filter(Boolean);
  for (const candidate of candidates) {
    const resolved = path.resolve(candidate);
    if (fs.existsSync(resolved)) return resolved;
  }
  return null;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function launchGadTui({ baseDir, projectid }) {
  const args = ['tui'];
  if (projectid) args.push('--projectid', projectid);
  if (process.platform === 'win32') {
    const cwd = psSingleQuote(baseDir || process.cwd());
    const tuiCommand = `Set-Location -LiteralPath ${cwd}; gad ${args.map(psSingleQuote).join(' ')}`;
    const argList = ['-NoExit', '-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', tuiCommand]
      .map(psSingleQuote)
      .join(', ');
    const command = `Start-Process -FilePath ${psSingleQuote('powershell.exe')} -ArgumentList @(${argList}) -WorkingDirectory ${cwd}`;
    const result = spawnSync('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', command], {
      cwd: baseDir || process.cwd(),
      encoding: 'utf8',
      windowsHide: false,
    });
    if (result.error) throw result.error;
    if (result.status !== 0) {
      throw new Error((result.stderr || result.stdout || `PowerShell exited with ${result.status}`).trim());
    }
    return;
  }

  const candidates = [
    ['x-terminal-emulator', ['-e', 'gad', ...args]],
    ['gnome-terminal', ['--', 'gad', ...args]],
    ['konsole', ['-e', 'gad', ...args]],
    ['open', ['-a', 'Terminal', 'gad', ...args]],
  ];
  let lastError = null;
  for (const [cmd, cmdArgs] of candidates) {
    try {
      const child = spawn(cmd, cmdArgs, {
        cwd: baseDir || process.cwd(),
        detached: true,
        stdio: 'ignore',
      });
      child.unref();
      return;
    } catch (error) {
      lastError = error;
    }
  }
  throw new Error(`Could not launch terminal for gad tui: ${lastError ? lastError.message : 'no terminal command worked'}`);
}

function psSingleQuote(value) {
  return `'${String(value).replace(/'/g, "''")}'`;
}

function classifyPlanningRoot(root) {
  const id = String(root.id || '');
  const rel = String(root.path || '.').replace(/\\/g, '/');
  if (id === 'global' || rel === '.') return 'global';
  if (id === 'get-anything-done' || rel === 'vendor/get-anything-done') return 'framework';
  if (rel.startsWith('sites/')) return 'site';
  if (rel.startsWith('vendor/')) return 'vendor';
  if (rel.startsWith('projects/')) return 'project';
  if (rel.startsWith('apps/')) return 'app';
  if (rel.startsWith('packages/') || rel.startsWith('packages-shared/')) return 'package';
  return 'workspace';
}

module.exports = { createIssuesCommand };
module.exports.register = (ctx) => ({
  issues: createIssuesCommand(ctx.common),
  inbox: createIssuesCommand(ctx.common),
});
