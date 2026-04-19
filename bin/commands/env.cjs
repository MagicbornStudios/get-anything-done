'use strict';
/**
 * gad env — per-project BYOK secrets (task 60-03, decision gad-266)
 *
 * Wraps lib/env-cli.cjs which wraps lib/secrets-store.cjs. Routing-only here.
 */

const { defineCommand } = require('citty');

function createEnvCommand() {
  let _envCliSingleton = null;
  function getEnvCli() {
    if (!_envCliSingleton) {
      const { createEnvCli } = require('../../lib/env-cli.cjs');
      _envCliSingleton = createEnvCli();
    }
    return _envCliSingleton;
  }

  const get = defineCommand({
    meta: {
      name: 'get',
      description: "Decrypt and print a key's value to stdout. Nothing else is printed so it composes with $(...). Exit 1 if the key is missing or the passphrase is invalid.",
    },
    args: {
      key: { type: 'positional', description: 'Key name (e.g. OPENAI_API_KEY)', required: true },
      projectid: { type: 'string', description: 'Project id whose bag to read', required: true },
      version: { type: 'string', description: 'Specific version (default: current)', default: '' },
      passphrase: { type: 'boolean', description: 'Force passphrase prompt — skip keychain', default: false },
    },
    async run({ args }) {
      const cli = getEnvCli();
      const version = args.version ? Number(args.version) : undefined;
      await cli.getCmd({
        keyName: String(args.key),
        projectid: String(args.projectid),
        version: Number.isFinite(version) ? version : undefined,
        passphrase: !!args.passphrase,
      });
    },
  });

  const set = defineCommand({
    meta: {
      name: 'set',
      description: 'Store a key. The value is read from an echoless TTY prompt (not argv — shell history would leak it). Piped stdin is also accepted for scripting: `echo val | gad env set KEY --projectid P`. Creates the project bag + .gitignore entry on first use.',
    },
    args: {
      key: { type: 'positional', description: 'Key name (uppercase-underscore convention)', required: true },
      projectid: { type: 'string', description: 'Project id whose bag to write into', required: true },
      provider: { type: 'string', description: 'Optional provider label (e.g. openai, anthropic)', default: '' },
      scope: { type: 'string', description: 'Optional scope label (e.g. model-api, image-gen)', default: '' },
      passphrase: { type: 'boolean', description: 'Force passphrase prompt — skip keychain', default: false },
    },
    async run({ args }) {
      const cli = getEnvCli();
      await cli.setCmd({
        keyName: String(args.key),
        projectid: String(args.projectid),
        provider: String(args.provider || ''),
        scope: String(args.scope || ''),
        passphrase: !!args.passphrase,
      });
    },
  });

  const list = defineCommand({
    meta: {
      name: 'list',
      description: 'List keys + metadata (name, provider, scope, version, last-rotated). Never prints values. --json emits a JSON array for tooling.',
    },
    args: {
      projectid: { type: 'string', description: 'Project id whose bag to inspect', required: true },
      json: { type: 'boolean', description: 'Emit JSON array instead of a table', default: false },
      passphrase: { type: 'boolean', description: 'Force passphrase prompt — skip keychain', default: false },
    },
    async run({ args }) {
      const cli = getEnvCli();
      await cli.listCmd({
        projectid: String(args.projectid),
        json: !!args.json,
        passphrase: !!args.passphrase,
      });
    },
  });

  const rotate = defineCommand({
    meta: {
      name: 'rotate',
      description: 'Additive rotation. Prompts for the NEW value (echoless TTY or piped stdin), appends a new version, and retires the old with a grace window (default 7 days, range 0-30).',
    },
    args: {
      key: { type: 'positional', description: 'Key name to rotate (must already exist)', required: true },
      projectid: { type: 'string', description: 'Project id whose bag to rotate in', required: true },
      'grace-days': { type: 'string', description: 'Grace period for old version (0-30, default 7)', default: '7' },
      passphrase: { type: 'boolean', description: 'Force passphrase prompt — skip keychain', default: false },
    },
    async run({ args }) {
      const cli = getEnvCli();
      await cli.rotateCmd({
        keyName: String(args.key),
        projectid: String(args.projectid),
        graceDays: args['grace-days'],
        passphrase: !!args.passphrase,
      });
    },
  });

  const revoke = defineCommand({
    meta: {
      name: 'revoke',
      description: 'Remove a key (or a specific version) immediately — no grace. Without --force, prompts for confirmation.',
    },
    args: {
      key: { type: 'positional', description: 'Key name to revoke', required: true },
      projectid: { type: 'string', description: 'Project id whose bag to revoke from', required: true },
      version: { type: 'string', description: 'Revoke a specific version (default: all versions)', default: '' },
      force: { type: 'boolean', description: 'Skip confirmation prompt', default: false },
      passphrase: { type: 'boolean', description: 'Force passphrase prompt — skip keychain', default: false },
    },
    async run({ args }) {
      const cli = getEnvCli();
      const version = args.version ? Number(args.version) : undefined;
      await cli.revokeCmd({
        keyName: String(args.key),
        projectid: String(args.projectid),
        version: Number.isFinite(version) ? version : undefined,
        force: !!args.force,
        passphrase: !!args.passphrase,
      });
    },
  });

  const audit = defineCommand({
    meta: {
      name: 'audit',
      description: 'Show the append-only audit log for a project bag (rotate/revoke/purge events, newest-first). Never prints values — metadata only.',
    },
    args: {
      projectid: { type: 'string', description: 'Project id whose audit log to read', required: true },
      since: { type: 'string', description: 'Filter to events with ts >= this ISO timestamp', default: '' },
      limit: { type: 'string', description: 'Max events to return (default: all)', default: '' },
      json: { type: 'boolean', description: 'Emit JSON {events, nextCursor} instead of a table', default: false },
    },
    async run({ args }) {
      const cli = getEnvCli();
      const parsedLimit = args.limit ? Number(args.limit) : undefined;
      await cli.auditCmd({
        projectid: String(args.projectid),
        since: args.since || null,
        limit: Number.isFinite(parsedLimit) ? parsedLimit : null,
        json: !!args.json,
      });
    },
  });

  const purge = defineCommand({
    meta: {
      name: 'purge',
      description: 'Remove non-current versions whose grace window has elapsed. --dry-run previews without mutating. Current version is always preserved.',
    },
    args: {
      projectid: { type: 'string', description: 'Project id whose bag to purge', required: true },
      'as-of': { type: 'string', description: 'Cutoff timestamp (ISO8601, default: now)', default: '' },
      'dry-run': { type: 'boolean', description: 'Preview what would be purged without writing', default: false },
      json: { type: 'boolean', description: 'Emit JSON result instead of text', default: false },
    },
    async run({ args }) {
      const cli = getEnvCli();
      await cli.purgeCmd({
        projectid: String(args.projectid),
        asOf: args['as-of'] || null,
        dryRun: !!args['dry-run'],
        json: !!args.json,
      });
    },
  });

  return defineCommand({
    meta: {
      name: 'env',
      description: 'Per-project BYOK secrets — get / set / list / rotate / revoke / audit / purge. Values are encrypted with AES-256-GCM under a PBKDF2-derived master key and stored at .gad/secrets/<projectid>.enc. See references/byok-design.md.',
    },
    subCommands: { get, set, list, rotate, revoke, audit, purge },
  });
}

module.exports = { createEnvCommand };
