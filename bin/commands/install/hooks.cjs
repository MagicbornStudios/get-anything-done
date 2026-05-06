'use strict';

const path = require('path');
const fs = require('fs');
const {
  getClaudeSettingsPath,
  readJsonSafe,
  writeJsonPretty,
  GAD_HOOK_MARKERS,
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

      for (const p of [traceHandlerPath, stopHandlerPath]) {
        if (!fs.existsSync(p)) {
          console.error(`gad install hooks: handler not found at ${p}`);
          process.exit(1);
        }
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
        settings.hooks[hookType] = [...filterHookEntries(existing), stopEntry];
      }

      writeJsonPretty(settingsPath, settings);
      console.log('Installed GAD hooks');
      console.log(`  trace handler: ${traceHandlerPath}`);
      console.log(`  stop handler:  ${stopHandlerPath}`);
      console.log(`  settings:      ${settingsPath}`);
      console.log('\n  Hooks wired: PreToolUse, PostToolUse, Stop, SubagentStop');
      console.log('  Events written to <project>/.planning/.trace-events.jsonl per run');
      console.log('  Stop hook captures assistant text + reasoning (phase 145, T-145-04)');
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

module.exports = { createInstallHooksCommand, createUninstallHooksCommand };
