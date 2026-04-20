'use strict';

const fs = require('fs');
const path = require('path');
const { defineCommand } = require('citty');

function createSkillFindCommand(deps) {
  const {
    repoRoot,
    findRepoRoot,
    outputError,
    shouldUseJson,
    evolutionPaths,
    resolveSkillRoots,
    listSkillDirs,
    readSkillFrontmatter,
    validateSkillLaneFilter,
    skillMatchesLane,
    resolveSkillWorkflowPath,
    normalizeSkillLaneValues,
    lintSkill,
    summarizeLint,
    lintAllSkills,
    filterIssuesBySeverity,
    auditSkillTokens,
    buildSkillUsageIndex,
    evolutionPromote,
    evolutionInstall,
    isCanonicalGadRepo,
  } = deps;
  const skillFind = defineCommand({
    meta: { name: 'find', description: 'Search canonical + proto skills by keyword — matches name, description, id. Ranked by token overlap. Eliminates the "guess the slug" problem for cold agents.' },
    args: {
      query: { type: 'positional', description: 'keyword(s) to match', required: true },
      limit: { type: 'string', description: 'max results (default 10)', default: '10' },
    },
    run({ args }) {
      const { protoSkillsDir, finalSkillsDir } = evolutionPaths(repoRoot);
      const limit = parseInt(args.limit, 10) || 10;
      const query = String(args.query || '').toLowerCase();
      if (!query) {
        console.error('gad skill find requires a search query');
        process.exit(1);
      }
      const queryTokens = new Set(
        query.split(/[^a-z0-9]+/).filter((t) => t.length >= 2)
      );

      const entries = [];
      const harvest = (root, kind) => {
        for (const s of listSkillDirs(root)) {
          const fm = readSkillFrontmatter(s.skillFile);
          const haystack = `${s.id} ${fm.name || ''} ${fm.description || ''}`.toLowerCase();
          const haystackTokens = new Set(haystack.split(/[^a-z0-9]+/).filter(Boolean));
          let score = 0;
          if (haystack.includes(query)) score += 10;
          for (const t of queryTokens) if (haystackTokens.has(t)) score += 2;
          for (const t of queryTokens) {
            for (const ht of haystackTokens) {
              if (ht !== t && ht.includes(t)) score += 1;
            }
          }
          if (score > 0) {
            entries.push({ id: s.id, name: fm.name || s.id, description: fm.description || '', workflow: fm.workflow || null, kind, score });
          }
        }
      };
      harvest(finalSkillsDir, 'canonical');
      harvest(protoSkillsDir, 'proto');

      if (entries.length === 0) {
        console.log(`No skills matched query: ${query}`);
        console.log(`Try:  gad skill list          # full inventory`);
        console.log(`      gad skill find debug    # keyword search`);
        return;
      }

      entries.sort((a, b) => b.score - a.score);
      const top = entries.slice(0, limit);
      console.log(`Skills matching "${query}" (${top.length} of ${entries.length}):`);
      console.log('');
      for (const e of top) {
        const tag = e.kind === 'proto' ? ' [proto]' : '';
        const wf = e.workflow ? ` → ${e.workflow}` : '';
        const desc = (e.description || '').replace(/\s+/g, ' ').slice(0, 120);
        console.log(`  ${e.id}${tag}${wf}`);
        if (desc) console.log(`      ${desc}`);
      }
      console.log('');
      console.log('Inspect with: gad skill show <id>');
    },
  });
  return skillFind;
}

module.exports = { createSkillFindCommand };