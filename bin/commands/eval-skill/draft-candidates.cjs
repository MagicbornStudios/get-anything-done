'use strict';

const path = require('path');
const { defineCommand } = require('citty');

function createEvalSkillDraftCandidatesCommand() {
  return defineCommand({
    meta: {
      name: 'draft-candidates',
      description: 'Invoke claude CLI to rewrite auto-drafted skill candidate stubs into real bodies (GAD-D-145)',
    },
    args: {
      'dry-run': { type: 'boolean', description: 'Print prompts without spawning claude CLI', default: false },
      force: { type: 'boolean', description: 'Redraft candidates that already have drafted: true', default: false },
      only: { type: 'string', description: 'Only draft a single candidate (matches by name substring)' },
    },
    run({ args }) {
      const { draftAllCandidates } = require('../../../lib/skill-draft.cjs');
      const repoRoot = path.resolve(__dirname, '..', '..', '..');
      const stats = draftAllCandidates(repoRoot, {
        dryRun: args['dry-run'],
        force: args.force,
        only: args.only,
      });
      if (stats.failed > 0) process.exit(1);
    },
  });
}

module.exports = { createEvalSkillDraftCandidatesCommand };
