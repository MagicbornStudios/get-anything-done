'use strict';

const path = require('path');
const fs = require('fs');
const {
  getClaudeSettingsPath,
  readJsonSafe,
  writeJsonPretty,
  GAD_HOOK_MARKER,
} = require('../../../lib/install-helpers.cjs');

function createHandlerEntry(handlerPath) {
  return {
    hooks: [{ type: 'command', command: `node "${handlerPath}"` }],
  };
}

function filterHookEntries(entries) {
  return entries.filter((entry) => {
    if (!entry || !Array.isArray(entry.hooks)) return true;
    return !entry.hooks.some((hook) => typeof hook?.command === 'string' && hook.command.includes(GAD_HOOK_MARKER));
  });
}

function createInstallHooksCommand({ defineCommand }) {
  return defineCommand({
    meta: {
      name: 'hooks',
      description: 'Wire GAD trace hook (PreToolUse + PostToolUse) into Claude Code settings.json',
    },
    args: { global: { type: 'boolean', description: 'Install into ~/.claude/settings.json instead of local .claude/' } },
    run: ({ args }) => {
      const isGlobal = Boolean(args.global);
      const settingsPath = getClaudeSettingsPath(isGlobal);
      const handlerPath = path.resolve(__dirname, '..', '..', 'gad-trace-hook.cjs');

      if (!fs.existsSync(handlerPath)) {
        console.error(`gad install hooks: handler not found at ${handlerPath}`);
        process.exit(1);
      }

      const settings = readJsonSafe(settingsPath) || {};
      settings.hooks = settings.hooks || {};
      const handlerEntry = createHandlerEntry(handlerPath);

      for (const hookType of ['PreToolUse', 'PostToolUse']) {
        const existing = Array.isArray(settings.hooks[hookType]) ? settings.hooks[hookType] : [];
        settings.hooks[hookType] = [...filterHookEntries(existing), handlerEntry];
      }

      writeJsonPretty(settingsPath, settings);
      console.log('Installed GAD trace hooks');
      console.log(`  handler: ${handlerPath}`);
      console.log(`  settings: ${settingsPath}`);
      console.log('\n  Hooks wired: PreToolUse, PostToolUse');
      console.log('  Events written to <project>/.planning/.trace-events.jsonl per run');
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
      for (const hookType of ['PreToolUse', 'PostToolUse']) {
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
