'use strict';

const path = require('path');
const fs = require('fs');
const {
  getClaudeSettingsPath,
  readJsonSafe,
  writeJsonPretty,
  GAD_HOOK_MARKERS,
  GAD_SESSION_END_HOOK_MARKER,
} = require('../../../lib/install-helpers.cjs');

function createHandlerEntry(handlerPath) {
  return {
    hooks: [{ type: 'command', command: `node "${handlerPath}"` }],
  };
}

function filterHookEntries(entries) {
  return entries.filter((entry) => {
    if (!entry || !Array.isArray(entry.hooks)) return true;
    return !entry.hooks.some((hook) =>
      typeof hook?.command === 'string' &&
      GAD_HOOK_MARKERS.some((m) => hook.command.includes(m))
    );
  });
}

function createInstallHooksCommand({ defineCommand }) {
  return defineCommand({
    meta: {
      name: 'hooks',
      description: 'Wire GAD trace hook (PreToolUse + PostToolUse) and Stop hook (assistant text capture, phase 145) into Claude Code settings.json',
    },
    args: { global: { type: 'boolean', description: 'Install into ~/.claude/settings.json instead of local .claude/' } },
    run: ({ args }) => {
      const isGlobal = Boolean(args.global);
      const settingsPath = getClaudeSettingsPath(isGlobal);
      const traceHandlerPath = path.resolve(__dirname, '..', '..', 'gad-trace-hook.cjs');
      const stopHandlerPath = path.resolve(__dirname, '..', '..', 'gad-stop-hook.cjs');
      const sessionEndHandlerPath = path.resolve(__dirname, '..', '..', '..', 'scripts', 'claude-session-end-hook.cjs');

      for (const p of [traceHandlerPath, stopHandlerPath]) {
        if (!fs.existsSync(p)) {
          console.error(`gad install hooks: handler not found at ${p}`);
          process.exit(1);
        }
      }
      // session-end hook is best-effort — warn but don't abort if missing
      const hasSessionEndHook = fs.existsSync(sessionEndHandlerPath);
      if (!hasSessionEndHook) {
        console.warn(`gad install hooks: spend-ledger session-end hook not found at ${sessionEndHandlerPath} (skipping)`);
      }

      const settings = readJsonSafe(settingsPath) || {};
      settings.hooks = settings.hooks || {};

      const traceEntry = createHandlerEntry(traceHandlerPath);
      const stopEntry = createHandlerEntry(stopHandlerPath);

      for (const hookType of ['PreToolUse', 'PostToolUse']) {
        const existing = Array.isArray(settings.hooks[hookType]) ? settings.hooks[hookType] : [];
        settings.hooks[hookType] = [...filterHookEntries(existing), traceEntry];
      }
      for (const hookType of ['Stop', 'SubagentStop']) {
        const existing = Array.isArray(settings.hooks[hookType]) ? settings.hooks[hookType] : [];
        // Keep existing entries that aren't GAD-managed, then add stop + session-end
        const filtered = filterHookEntries(existing);
        const newEntries = [stopEntry];
        if (hasSessionEndHook) newEntries.push(createHandlerEntry(sessionEndHandlerPath));
        settings.hooks[hookType] = [...filtered, ...newEntries];
      }

      writeJsonPretty(settingsPath, settings);
      console.log('Installed GAD hooks');
      console.log(`  trace handler:       ${traceHandlerPath}`);
      console.log(`  stop handler:        ${stopHandlerPath}`);
      if (hasSessionEndHook) console.log(`  session-end handler: ${sessionEndHandlerPath}`);
      console.log(`  settings:            ${settingsPath}`);
      console.log('\n  Hooks wired: PreToolUse, PostToolUse, Stop, SubagentStop');
      console.log('  Events written to <project>/.planning/.trace-events.jsonl per run');
      console.log('  Stop hook captures assistant text + reasoning (phase 145, T-145-04)');
      if (hasSessionEndHook) console.log('  Session-end hook appends spend rows to ai-spend-ledger (phase 188-03)');
    },
  });
}

function createUninstallHooksCommand({ defineCommand }) {
  return defineCommand({
    meta: {
      name: 'hooks',
      description: 'Remove GAD trace hook entries from Claude Code settings.json',
    },
    args: { global: { type: 'boolean', description: 'Uninstall from ~/.claude/settings.json instead of local .claude/' } },
    run: ({ args }) => {
      const isGlobal = Boolean(args.global);
      const settingsPath = getClaudeSettingsPath(isGlobal);
      const settings = readJsonSafe(settingsPath);

      if (!settings || !settings.hooks) {
        console.log('No hooks configured; nothing to uninstall.');
        return;
      }

      let removed = 0;
      for (const hookType of ['PreToolUse', 'PostToolUse', 'Stop', 'SubagentStop']) {
        if (!Array.isArray(settings.hooks[hookType])) continue;
        const before = settings.hooks[hookType].length;
        settings.hooks[hookType] = filterHookEntries(settings.hooks[hookType]);
        removed += before - settings.hooks[hookType].length;
        if (settings.hooks[hookType].length === 0) delete settings.hooks[hookType];
      }

      writeJsonPretty(settingsPath, settings);
      console.log(`Removed ${removed} GAD trace hook entr${removed === 1 ? 'y' : 'ies'}`);
      console.log(`  settings: ${settingsPath}`);
    },
  });
}

/**
 * Copy hook source files (gad-statusline.js, etc) to every known
 * `.claude/hooks/` and `.opencode/hooks/` destination so project-local
 * Claude/opencode instances pick up the latest source. Standalone from
 * the settings.json wiring above.
 *
 * Walks:
 *   - ~/.claude/hooks/
 *   - <repo-root>/.claude/hooks/   (if present)
 *   - <each planning root>/.claude/hooks/  (if present)
 *   - <repo-root>/.opencode/hooks/  (if present)
 */
function createSyncHookFilesCommand({ defineCommand }) {
  return defineCommand({
    meta: {
      name: 'sync-hook-files',
      description: 'Copy hook source files (statusline, etc) to all .claude/hooks/ and .opencode/hooks/ locations across known planning roots. Standalone from settings.json wiring.',
    },
    args: {
      'dry-run': { type: 'boolean', description: 'Print targets without copying', default: false },
    },
    run: ({ args }) => {
      const sourceDir = path.resolve(__dirname, '..', '..', '..', 'hooks');
      if (!fs.existsSync(sourceDir)) {
        console.error(`Source hook dir not found: ${sourceDir}`);
        process.exit(1);
      }

      // Files to copy (drop dist/, dotfiles, tests)
      const sourceFiles = fs.readdirSync(sourceDir)
        .filter((f) => f.endsWith('.js') || f.endsWith('.sh'))
        .filter((f) => !f.startsWith('.'))
        .map((f) => path.join(sourceDir, f));

      // Build destination list
      const home = process.env.HOME || process.env.USERPROFILE || '';
      const destinations = [];
      if (home) destinations.push(path.join(home, '.claude', 'hooks'));

      // Walk gad-config.toml roots — load lazily to avoid circular deps
      try {
        const { findRepoRoot } = require('../../../lib/install-helpers.cjs');
        const baseDir = findRepoRoot ? findRepoRoot() : process.cwd();
        // <baseDir>/.claude/hooks
        destinations.push(path.join(baseDir, '.claude', 'hooks'));
        destinations.push(path.join(baseDir, '.opencode', 'hooks'));

        // Each root's .claude/hooks
        const configPath = path.join(baseDir, 'gad-config.toml');
        if (fs.existsSync(configPath)) {
          const tomlSrc = fs.readFileSync(configPath, 'utf8');
          const rootPaths = [];
          const sectionRe = /\[\[planning\.roots\]\]([\s\S]*?)(?=\[\[|\[[a-z]|$)/g;
          let m;
          while ((m = sectionRe.exec(tomlSrc)) !== null) {
            const block = m[1];
            const pm = block.match(/^\s*path\s*=\s*"([^"]+)"/m);
            if (pm) rootPaths.push(pm[1]);
          }
          for (const rp of rootPaths) {
            const abs = path.resolve(baseDir, rp);
            destinations.push(path.join(abs, '.claude', 'hooks'));
            destinations.push(path.join(abs, '.opencode', 'hooks'));
          }
        }
      } catch (e) {
        console.warn(`(could not enumerate planning roots: ${e.message})`);
      }

      // De-dupe + filter to existing
      const uniqueDests = Array.from(new Set(destinations.map((d) => path.resolve(d))))
        .filter((d) => fs.existsSync(d));

      if (uniqueDests.length === 0) {
        console.log('No hook destinations found. Run `gad install hooks --global` first.');
        return;
      }

      let totalCopies = 0;
      for (const dest of uniqueDests) {
        for (const src of sourceFiles) {
          const fname = path.basename(src);
          const target = path.join(dest, fname);
          // Skip if destination doesn't already have this file (don't introduce
          // hooks where they didn't exist — only refresh existing ones)
          if (!fs.existsSync(target)) continue;
          if (args['dry-run']) {
            console.log(`[dry-run] ${path.relative(process.cwd(), src)} -> ${target}`);
          } else {
            fs.copyFileSync(src, target);
            console.log(`copied ${fname} -> ${target}`);
          }
          totalCopies++;
        }
      }

      console.log(`\n${args['dry-run'] ? '[dry-run] would copy' : 'Copied'} ${totalCopies} file(s) to ${uniqueDests.length} location(s).`);
      if (args['dry-run']) console.log('Re-run without --dry-run to apply.');
    },
  });
}

module.exports = { createInstallHooksCommand, createUninstallHooksCommand, createSyncHookFilesCommand };
