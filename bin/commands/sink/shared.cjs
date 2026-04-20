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
  const roots = resolveRoots(args, baseDir, config.roots);
  return { baseDir, config, roots, sink };
}

module.exports = {
  fs,
  getSink,
  path,
  resolveSinkScope,
  SINK_SOURCE_MAP,
  stampSinkCompileNote,
};
