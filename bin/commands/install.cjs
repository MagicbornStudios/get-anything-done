'use strict';
/**
 * gad install / uninstall — wire GAD into agent runtimes (hooks, framework, full install).
 *
 * Required deps:
 *   getClaudeSettingsPath, readJsonSafe, writeJsonPretty, GAD_HOOK_MARKER,
 *   isPackagedExecutableRuntime, getPackagedExecutablePath,
 *   getDefaultSelfInstallDir, updateWindowsUserPath
 */

const path = require('path');
const fs = require('fs');
const { defineCommand } = require('citty');

function createInstallCommand(deps) {
  const {
    getClaudeSettingsPath, readJsonSafe, writeJsonPretty, GAD_HOOK_MARKER,
    isPackagedExecutableRuntime, getPackagedExecutablePath,
    getDefaultSelfInstallDir, updateWindowsUserPath,
  } = deps;

  const hooks = defineCommand({
    meta: {
      name: 'hooks',
      description: 'Wire GAD trace hook (PreToolUse + PostToolUse) into Claude Code settings.json',
    },
    args: { global: { type: 'boolean', description: 'Install into ~/.claude/settings.json instead of local .claude/' } },
    run: ({ args }) => {
      const isGlobal = Boolean(args.global);
      const settingsPath = getClaudeSettingsPath(isGlobal);
      const handlerPath = path.resolve(__dirname, '..', 'gad-trace-hook.cjs');

      if (!fs.existsSync(handlerPath)) {
        console.error(`gad install hooks: handler not found at ${handlerPath}`);
        process.exit(1);
      }

      const settings = readJsonSafe(settingsPath) || {};
      settings.hooks = settings.hooks || {};

      const hookCommand = `node "${handlerPath}"`;
      const handlerEntry = { hooks: [{ type: 'command', command: hookCommand }] };

      for (const hookType of ['PreToolUse', 'PostToolUse']) {
        const existing = Array.isArray(settings.hooks[hookType]) ? settings.hooks[hookType] : [];
        const filtered = existing.filter((entry) => {
          if (!entry || !Array.isArray(entry.hooks)) return true;
          return !entry.hooks.some((h) => typeof h?.command === 'string' && h.command.includes(GAD_HOOK_MARKER));
        });
        filtered.push(handlerEntry);
        settings.hooks[hookType] = filtered;
      }

      writeJsonPretty(settingsPath, settings);
      console.log(`✓ Installed GAD trace hooks`);
      console.log(`  handler: ${handlerPath}`);
      console.log(`  settings: ${settingsPath}`);
      console.log(`\n  Hooks wired: PreToolUse, PostToolUse`);
      console.log(`  Events written to <project>/.planning/.trace-events.jsonl per run`);
    },
  });

  const all = defineCommand({
    meta: {
      name: 'all',
      description: 'Delegate to bin/install.js for full framework install (skills, agents, commands, hooks)',
    },
    args: {
      claude: { type: 'boolean' }, opencode: { type: 'boolean' }, gemini: { type: 'boolean' },
      cursor: { type: 'boolean' }, codex: { type: 'boolean' }, copilot: { type: 'boolean' },
      antigravity: { type: 'boolean' }, windsurf: { type: 'boolean' }, augment: { type: 'boolean' },
      all: { type: 'boolean' }, local: { type: 'boolean' }, global: { type: 'boolean' },
      sdk: { type: 'boolean' }, uninstall: { type: 'boolean' },
      'force-statusline': { type: 'boolean' },
      'config-dir': { type: 'string', description: 'Custom runtime config directory', default: '' },
    },
    run: ({ args }) => {
      const { spawnSync } = require('child_process');
      const installerPath = path.resolve(__dirname, '..', 'install.js');
      const flagArgs = [];
      const flagMap = ['claude','opencode','gemini','cursor','codex','copilot','antigravity','windsurf','augment','all','local','global','sdk','uninstall','force-statusline'];
      for (const k of flagMap) if (args[k]) flagArgs.push(`--${k}`);
      if (args['config-dir']) flagArgs.push('--config-dir', args['config-dir']);
      if (flagArgs.length === 0) {
        console.log('Usage: gad install all [runtime flags] [--local|--global] [--config-dir <path>]');
        console.log('       passes through to bin/install.js');
        console.log('       runtimes: --claude --opencode --gemini --codex --copilot --antigravity --cursor --windsurf --augment --all');
        return;
      }
      const command = isPackagedExecutableRuntime() ? getPackagedExecutablePath() : process.execPath;
      const commandArgs = isPackagedExecutableRuntime()
        ? ['__gad_internal_install__', ...flagArgs]
        : [installerPath, ...flagArgs];
      const result = spawnSync(command, commandArgs, { stdio: 'inherit', env: process.env });
      process.exit(result.status || 0);
    },
  });

  const self = defineCommand({
    meta: {
      name: 'self',
      description: 'Install the packaged gad executable into a user bin directory and add it to PATH',
    },
    args: { dir: { type: 'string', description: 'Target install directory', default: '' } },
    run: ({ args }) => {
      if (!isPackagedExecutableRuntime()) {
        console.error('gad install self is only available from a packaged gad executable.');
        process.exit(1);
      }
      const targetDir = args.dir ? path.resolve(args.dir) : getDefaultSelfInstallDir();
      const sourceExecutable = getPackagedExecutablePath();
      const executableName = process.platform === 'win32' ? 'gad.exe' : 'gad';
      const targetExecutable = path.join(targetDir, executableName);

      fs.mkdirSync(targetDir, { recursive: true });
      fs.copyFileSync(sourceExecutable, targetExecutable);
      if (process.platform === 'win32') {
        fs.copyFileSync(sourceExecutable, path.join(targetDir, 'get-anything-done.exe'));
        updateWindowsUserPath(targetDir);
      }

      console.log(`✓ Installed gad executable`);
      console.log(`  source: ${sourceExecutable}`);
      console.log(`  target: ${targetExecutable}`);
      if (process.platform === 'win32') {
        console.log(`  path:   ${targetDir}`);
        console.log(`\nOpen a new terminal and run: gad --help`);
      } else {
        console.log(`\nAdd ${targetDir} to PATH if it is not already present.`);
      }
    },
  });

  const uninstallHooks = defineCommand({
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
        settings.hooks[hookType] = settings.hooks[hookType].filter((entry) => {
          if (!entry || !Array.isArray(entry.hooks)) return true;
          return !entry.hooks.some((h) => typeof h?.command === 'string' && h.command.includes(GAD_HOOK_MARKER));
        });
        removed += before - settings.hooks[hookType].length;
        if (settings.hooks[hookType].length === 0) delete settings.hooks[hookType];
      }

      writeJsonPretty(settingsPath, settings);
      console.log(`✓ Removed ${removed} GAD trace hook entr${removed === 1 ? 'y' : 'ies'}`);
      console.log(`  settings: ${settingsPath}`);
    },
  });

  const install = defineCommand({
    meta: { name: 'install', description: 'Install GAD into an agent runtime (hooks, framework, or full install)' },
    subCommands: { hooks, all, self },
  });

  const uninstall = defineCommand({
    meta: { name: 'uninstall', description: 'Uninstall GAD trace hooks (full uninstall: use install.js --uninstall)' },
    subCommands: { hooks: uninstallHooks },
  });

  return { install, uninstall };
}

module.exports = { createInstallCommand };
module.exports.register = (ctx) => {
  const { install, uninstall } = createInstallCommand(ctx.extras.install);
  return { install, uninstall };
};
