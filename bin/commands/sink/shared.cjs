'use strict';

const path = require('path');
const fs = require('fs');
const { stampSinkCompileNote } = require('../../../lib/install-helpers.cjs');

const SINK_SOURCE_MAP = [
  { srcs: ['STATE.xml', 'STATE.md'], sink: 'state.mdx' },
  { srcs: ['ROADMAP.xml', 'ROADMAP.md'], sink: 'roadmap.mdx' },
  { srcs: ['DECISIONS.xml', 'DECISIONS.md'], sink: 'decisions.mdx' },
  { srcs: ['TASK-REGISTRY.xml', 'TASK-REGISTRY.md'], sink: 'task-registry.mdx' },
  { srcs: ['REQUIREMENTS.xml', 'REQUIREMENTS.md'], sink: 'requirements.mdx' },
  { srcs: ['ERRORS-AND-ATTEMPTS.xml'], sink: 'errors-and-attempts.mdx' },
  { srcs: ['BLOCKERS.xml'], sink: 'blockers.mdx' },
];

function getSink(config, outputError) {
  if (!config.docs_sink) {
    outputError('No docs_sink configured in gad-config.toml. Add: docs_sink = "apps/portfolio/content/docs"');
    return null;
  }
  return config.docs_sink;
}

function resolveSinkScope(args, findRepoRoot, gadConfig, resolveRoots, outputError) {
  const baseDir = findRepoRoot();
  const config = gadConfig.load(baseDir);
  const sink = getSink(config, outputError);
  if (!sink) return null;

  // Decision gad-08-02: Default to all roots if no projectid provided,
  // respecting `enabled` and `docs_sink_ignore` config.
  const roots = resolveRoots(args, baseDir, config.roots);

  const configIgnore = new Set(config.docs_sink_ignore || []);
  const cliOnly = new Set((args.only || '').split(',').map((s) => s.trim()).filter(Boolean));
  const cliIgnore = new Set((args.ignore || '').split(',').map((s) => s.trim()).filter(Boolean));

  const filtered = roots.filter((r) => {
    // CLI --only always wins
    if (cliOnly.size > 0) return cliOnly.has(r.id);
    // Explicitly disabled in config
    if (r.enabled === false) return false;
    // In the persistent ignore list
    if (configIgnore.has(r.id)) return false;
    // Ad-hoc CLI --ignore
    if (cliIgnore.has(r.id)) return false;
    return true;
  });

  return { baseDir, config, roots: filtered, sink };
}

module.exports = {
  fs,
  getSink,
  path,
  resolveSinkScope,
  SINK_SOURCE_MAP,
  stampSinkCompileNote,
};
