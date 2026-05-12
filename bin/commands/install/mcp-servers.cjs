'use strict';

/**
 * gad install --mcp-servers
 *
 * Auto-discovers every MCP server bundled under
 * vendor/get-anything-done/mcp-servers/<name>-server/ and registers each
 * with both:
 *
 *   - ~/.codex/config.toml — [mcp_servers.<derived_name>] blocks
 *   - ~/.claude/settings.json — top-level mcpServers.<derived_name> entries
 *
 * Derived name rule: directory name with the trailing `-server` stripped,
 * remaining hyphens converted to underscores.
 *   gad-state-server  -> gad_state
 *   gad-trace-server  -> gad_trace
 *   gad-memory-server -> gad_memory (future)
 *
 * Idempotent: re-running produces no diff. Existing user content under
 * unrelated keys is preserved. If the args path on an existing block
 * mismatches the on-disk index.js, it is updated in place.
 *
 * Flags:
 *   --dry-run               Print what would change, write nothing.
 *   --config-dir <path>     Override target config dir root. Two layouts
 *                           are supported:
 *                             a) a directory containing `.codex/` and
 *                                `.claude/` subdirs (treated like $HOME)
 *                             b) a directory containing `config.toml`
 *                                and `settings.json` directly (test fixture)
 *                           Layout (a) is auto-detected when EITHER
 *                           subdir exists; otherwise (b) is assumed.
 */

const fs = require('fs');
const os = require('os');
const path = require('path');

const SERVER_DIR_SUFFIX = '-server';

function getMcpServerRoot() {
  // bin/commands/install/mcp-servers.cjs → ../../../mcp-servers
  return path.resolve(__dirname, '..', '..', '..', 'mcp-servers');
}

function deriveServerName(dirName) {
  let base = dirName;
  if (base.endsWith(SERVER_DIR_SUFFIX)) {
    base = base.slice(0, -SERVER_DIR_SUFFIX.length);
  }
  return base.replace(/-/g, '_');
}

function discoverMcpServers(rootDir) {
  if (!fs.existsSync(rootDir)) return [];
  const entries = [];
  for (const dir of fs.readdirSync(rootDir).sort()) {
    const full = path.join(rootDir, dir);
    let stat;
    try { stat = fs.statSync(full); } catch { continue; }
    if (!stat.isDirectory()) continue;

    const pkgPath = path.join(full, 'package.json');
    if (!fs.existsSync(pkgPath)) continue;

    let pkg = {};
    try { pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8')); } catch { /* ignore */ }

    // Resolve the entrypoint: prefer `bin` (string or object first value),
    // else `main`, else default to index.js. Always returned as an absolute
    // path under the server directory.
    let rel = 'index.js';
    if (typeof pkg.bin === 'string') {
      rel = pkg.bin;
    } else if (pkg.bin && typeof pkg.bin === 'object') {
      const first = Object.values(pkg.bin).find((v) => typeof v === 'string');
      if (first) rel = first;
    } else if (typeof pkg.main === 'string') {
      rel = pkg.main;
    }
    const entrypoint = path.resolve(full, rel);
    if (!fs.existsSync(entrypoint)) {
      // skip servers with missing entrypoint — surface as warning later
      entries.push({ dirName: dir, name: deriveServerName(dir), entrypoint, missing: true });
      continue;
    }
    entries.push({ dirName: dir, name: deriveServerName(dir), entrypoint, missing: false });
  }
  return entries;
}

// ---------------------------------------------------------------------------
// Codex config.toml — minimal section-block editor
// ---------------------------------------------------------------------------

function tomlEscapeString(s) {
  return s.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

function renderMcpServerBlock(name, entrypoint) {
  const safeArg = `"${tomlEscapeString(entrypoint)}"`;
  return `[mcp_servers.${name}]\ncommand = "node"\nargs = [${safeArg}]\n`;
}

/**
 * Find the byte range [start, end) of a top-level table block whose header
 * matches `[mcp_servers.<name>]`. The block extends from the header line
 * to the start of the next table header or EOF. Comments and blank lines
 * before the next header are included in the block.
 *
 * Returns null if no block exists for `name`.
 */
function findMcpServerBlockRange(text, name) {
  const headerRe = new RegExp(
    `(^|\\r?\\n)\\[mcp_servers\\.${escapeRegExp(name)}\\]\\s*(\\r?\\n|$)`,
    'g',
  );
  const m = headerRe.exec(text);
  if (!m) return null;
  const start = m.index + (m[1] ? m[1].length : 0);
  // Find next top-level table header after the match end
  const after = text.slice(headerRe.lastIndex);
  const nextRe = /(^|\r?\n)\[[^\]\n]+\]/g;
  let end = text.length;
  let nm;
  while ((nm = nextRe.exec(after)) !== null) {
    // skip the matched header itself if it starts at position 0 with no leading nl
    const absIdx = headerRe.lastIndex + nm.index + (nm[1] ? nm[1].length : 0);
    if (absIdx <= headerRe.lastIndex) continue;
    end = absIdx;
    break;
  }
  return { start, end };
}

function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function ensureTrailingNewline(s) {
  if (s.length === 0) return s;
  return s.endsWith('\n') ? s : (s + '\n');
}

/**
 * Apply MCP server entries to a TOML string. Returns { content, changes }.
 * changes: Array<{ name, action: 'added'|'updated'|'noop', from?, to? }>.
 */
function applyCodexMcpServers(originalText, servers) {
  let text = originalText || '';
  const changes = [];

  for (const srv of servers) {
    if (srv.missing) {
      changes.push({ name: srv.name, action: 'skipped-missing', from: srv.entrypoint });
      continue;
    }
    const block = renderMcpServerBlock(srv.name, srv.entrypoint);
    const range = findMcpServerBlockRange(text, srv.name);

    if (!range) {
      // Append at EOF. Ensure a separating blank line.
      const base = ensureTrailingNewline(text);
      const sep = base.length === 0 || base.endsWith('\n\n') ? '' : '\n';
      text = base + sep + block;
      changes.push({ name: srv.name, action: 'added', to: srv.entrypoint });
      continue;
    }

    const existing = text.slice(range.start, range.end);
    // Compare logical content: extract args path from existing if possible
    const existingArgsMatch = existing.match(/args\s*=\s*\[\s*"((?:\\.|[^"\\])*)"\s*\]/);
    const existingPath = existingArgsMatch ? existingArgsMatch[1].replace(/\\"/g, '"').replace(/\\\\/g, '\\') : null;

    if (existingPath === srv.entrypoint) {
      // Still rewrite the block to canonical shape only if textual diff exists.
      const canonical = block;
      // Preserve trailing whitespace style: keep behavior simple — only rewrite if non-canonical.
      // We treat exact-match on args path as noop, regardless of command/extra keys, to avoid
      // clobbering user customizations.
      changes.push({ name: srv.name, action: 'noop', to: srv.entrypoint });
      continue;
    }

    // Replace block range with canonical content. Preserve trailing newline boundary.
    const before = text.slice(0, range.start);
    const after = text.slice(range.end);
    // Make sure the replacement ends with a newline so the next section starts cleanly.
    const replacement = ensureTrailingNewline(block);
    text = before + replacement + after;
    changes.push({ name: srv.name, action: 'updated', from: existingPath, to: srv.entrypoint });
  }

  return { content: text, changes };
}

// ---------------------------------------------------------------------------
// Claude settings.json
// ---------------------------------------------------------------------------

function readJsonSafe(file) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return null; }
}

function writeJsonPretty(file, data) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(data, null, 2) + '\n');
}

function applyClaudeMcpServers(originalJson, servers) {
  const settings = originalJson && typeof originalJson === 'object' ? { ...originalJson } : {};
  const mcpServers = settings.mcpServers && typeof settings.mcpServers === 'object'
    ? { ...settings.mcpServers }
    : {};
  const changes = [];

  for (const srv of servers) {
    if (srv.missing) {
      changes.push({ name: srv.name, action: 'skipped-missing', from: srv.entrypoint });
      continue;
    }
    const existing = mcpServers[srv.name];
    const canonical = { command: 'node', args: [srv.entrypoint] };

    if (existing && typeof existing === 'object'
      && existing.command === 'node'
      && Array.isArray(existing.args)
      && existing.args.length === 1
      && existing.args[0] === srv.entrypoint) {
      changes.push({ name: srv.name, action: 'noop', to: srv.entrypoint });
      continue;
    }

    if (existing) {
      const prevPath = (existing && Array.isArray(existing.args) && existing.args.length >= 1)
        ? existing.args[0]
        : null;
      mcpServers[srv.name] = canonical;
      changes.push({ name: srv.name, action: 'updated', from: prevPath, to: srv.entrypoint });
    } else {
      mcpServers[srv.name] = canonical;
      changes.push({ name: srv.name, action: 'added', to: srv.entrypoint });
    }
  }

  settings.mcpServers = mcpServers;
  return { content: settings, changes };
}

// ---------------------------------------------------------------------------
// Path resolution (supports --config-dir override for tests)
// ---------------------------------------------------------------------------

function resolveConfigPaths(configDirArg) {
  if (configDirArg) {
    const root = path.resolve(configDirArg);
    const codexSub = path.join(root, '.codex');
    const claudeSub = path.join(root, '.claude');
    const hasHomeLayout = fs.existsSync(codexSub) || fs.existsSync(claudeSub);
    if (hasHomeLayout) {
      return {
        codexConfigPath: path.join(codexSub, 'config.toml'),
        claudeSettingsPath: path.join(claudeSub, 'settings.json'),
      };
    }
    return {
      codexConfigPath: path.join(root, 'config.toml'),
      claudeSettingsPath: path.join(root, 'settings.json'),
    };
  }
  return {
    codexConfigPath: path.join(os.homedir(), '.codex', 'config.toml'),
    claudeSettingsPath: path.join(os.homedir(), '.claude', 'settings.json'),
  };
}

// ---------------------------------------------------------------------------
// Public runner — exported so install.cjs can compose without going through citty.
// ---------------------------------------------------------------------------

function runInstallMcpServers({ dryRun = false, configDir = '' } = {}) {
  const rootDir = getMcpServerRoot();
  const servers = discoverMcpServers(rootDir);
  const { codexConfigPath, claudeSettingsPath } = resolveConfigPaths(configDir);

  console.log('GAD MCP server registration');
  console.log(`  source dir: ${rootDir}`);
  console.log(`  codex toml: ${codexConfigPath}`);
  console.log(`  claude json: ${claudeSettingsPath}`);
  if (dryRun) console.log('  mode:       dry-run (no writes)');

  if (servers.length === 0) {
    console.log('\nNo MCP servers discovered. Nothing to register.');
    return { exitCode: 0, servers, codex: null, claude: null };
  }

  console.log(`\nDiscovered ${servers.length} server(s):`);
  for (const s of servers) {
    const status = s.missing ? ' [missing entrypoint — skipped]' : '';
    console.log(`  - ${s.name}  ←  ${path.relative(rootDir, s.entrypoint)}${status}`);
  }

  // ---- codex
  let codexBefore = '';
  if (fs.existsSync(codexConfigPath)) {
    codexBefore = fs.readFileSync(codexConfigPath, 'utf8');
  }
  const codexResult = applyCodexMcpServers(codexBefore, servers);

  console.log('\n[codex config.toml]');
  for (const c of codexResult.changes) {
    if (c.action === 'added')   console.log(`  + ${c.name}  → ${c.to}`);
    if (c.action === 'updated') console.log(`  ~ ${c.name}  ${c.from} → ${c.to}`);
    if (c.action === 'noop')    console.log(`  = ${c.name}  (already current)`);
    if (c.action === 'skipped-missing') console.log(`  ! ${c.name}  (entrypoint missing — skipped)`);
  }

  // ---- claude
  const claudeBefore = readJsonSafe(claudeSettingsPath) || {};
  const claudeResult = applyClaudeMcpServers(claudeBefore, servers);

  console.log('\n[claude settings.json]');
  for (const c of claudeResult.changes) {
    if (c.action === 'added')   console.log(`  + ${c.name}  → ${c.to}`);
    if (c.action === 'updated') console.log(`  ~ ${c.name}  ${c.from || '(unknown)'} → ${c.to}`);
    if (c.action === 'noop')    console.log(`  = ${c.name}  (already current)`);
    if (c.action === 'skipped-missing') console.log(`  ! ${c.name}  (entrypoint missing — skipped)`);
  }

  if (dryRun) {
    console.log('\nDry-run complete. Re-run without --dry-run to apply.');
    return { exitCode: 0, servers, codex: codexResult, claude: claudeResult };
  }

  // ---- write codex toml
  if (codexResult.content !== codexBefore) {
    fs.mkdirSync(path.dirname(codexConfigPath), { recursive: true });
    fs.writeFileSync(codexConfigPath, codexResult.content);
    console.log(`\nWrote ${codexConfigPath}`);
  } else {
    console.log(`\nNo changes to ${codexConfigPath}`);
  }

  // ---- write claude json
  const claudeBeforeStr = JSON.stringify(claudeBefore);
  const claudeAfterStr = JSON.stringify(claudeResult.content);
  if (claudeBeforeStr !== claudeAfterStr) {
    writeJsonPretty(claudeSettingsPath, claudeResult.content);
    console.log(`Wrote ${claudeSettingsPath}`);
  } else {
    console.log(`No changes to ${claudeSettingsPath}`);
  }

  return { exitCode: 0, servers, codex: codexResult, claude: claudeResult };
}

function createInstallMcpServersCommand({ defineCommand }) {
  return defineCommand({
    meta: {
      name: 'mcp-servers',
      description: 'Register bundled MCP servers (mcp-servers/*) with codex and Claude Code',
    },
    args: {
      'dry-run': { type: 'boolean', description: 'Print intended changes without writing', default: false },
      'config-dir': { type: 'string', description: 'Override root config dir (testing). Accepts either a home-like dir containing .codex/ and .claude/, or a flat dir with config.toml + settings.json.', default: '' },
    },
    run: ({ args }) => {
      const res = runInstallMcpServers({
        dryRun: Boolean(args['dry-run']),
        configDir: args['config-dir'] || '',
      });
      process.exit(res.exitCode);
    },
  });
}

module.exports = {
  createInstallMcpServersCommand,
  runInstallMcpServers,
  // exported for tests
  _internal: {
    deriveServerName,
    discoverMcpServers,
    applyCodexMcpServers,
    applyClaudeMcpServers,
    findMcpServerBlockRange,
    resolveConfigPaths,
  },
};
