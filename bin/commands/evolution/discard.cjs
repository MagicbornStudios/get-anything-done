'use strict';

const fs = require('fs');
const path = require('path');
const { defineCommand } = require('citty');

/**
 * Write a skill_preference row to .planning/datasets/skill-preference/<date>.jsonl
 * on discard. Non-fatal — discard flow is never interrupted by DPO write failures.
 * Shape matches slm_learning/schemas/skill_preference.schema.json.
 */
function writeDiscardPreferenceRow({ slug, repoRoot, skillMdContent, workflowMdContent, protoDir }) {
  try {
    const datasetDir = path.join(repoRoot, '.planning', 'datasets', 'skill-preference');
    fs.mkdirSync(datasetDir, { recursive: true });
    const dateStr = new Date().toISOString().slice(0, 10);
    const filePath = path.join(datasetDir, `${dateStr}.jsonl`);
    const row = {
      pair_id: `skpr-framework-${dateStr.replace(/-/g, '')}-${Date.now().toString(36)}`,
      ts: new Date().toISOString(),
      projectid: null,
      decision_kind: 'discard',
      candidate_slug: slug,
      verdict_source: 'operator_review',
      skill_under_review: {
        slug,
        draft_path: protoDir,
        skill_md_content: skillMdContent || '',
        workflow_md_content: workflowMdContent || null,
        candidate_md_content: null,
      },
      verdict: 'discarded',
      rationale: `Operator discarded via gad evolution discard at ${new Date().toISOString()}`,
      promoted_to: null,
      promoted_at: null,
      expected_trigger_patterns: null,
      expected_anti_patterns: null,
      discard_reason: 'other',
      superseded_by_skill_id: null,
      merged_into_skill_id: null,
      retained_sections: null,
      required_changes: null,
      re_review_after_edit: null,
      operator_id: null,
      runtime: 'claude-code',
      session_id: null,
      license_class: 'owned',
    };
    fs.appendFileSync(filePath, JSON.stringify(row) + '\n', 'utf8');
  } catch (e) {
    console.warn(`  [dpo] warn: could not write skill_preference row: ${e.message}`);
  }
}

function createEvolutionDiscardCommand({ repoRoot, evolutionPaths }) {
  return defineCommand({
    meta: { name: 'discard', description: 'Discard a proto-skill (deletes the directory)' },
    args: {
      slug: { type: 'positional', description: 'proto-skill slug', required: true },
      keepCandidate: { type: 'boolean', description: 'keep the candidate file (only delete the proto-skill draft)', required: false },
    },
    run({ args }) {
      const { protoSkillsDir, candidatesDir } = evolutionPaths(repoRoot);
      const protoDir = path.join(protoSkillsDir, args.slug);
      if (!fs.existsSync(protoDir)) {
        console.error(`No proto-skill at ${protoDir}`);
        process.exit(1);
      }

      // --- DPO: capture skill content before deletion ---
      const skillPath = path.join(protoDir, 'SKILL.md');
      const workflowPath = path.join(protoDir, 'workflow.md');
      const skillMdContent = fs.existsSync(skillPath) ? fs.readFileSync(skillPath, 'utf8') : null;
      const workflowMdContent = fs.existsSync(workflowPath) ? fs.readFileSync(workflowPath, 'utf8') : null;
      writeDiscardPreferenceRow({ slug: args.slug, repoRoot, skillMdContent, workflowMdContent, protoDir });

      fs.rmSync(protoDir, { recursive: true, force: true });
      console.log(`Discarded proto-skill: ${path.relative(repoRoot, protoDir)}`);
      if (!args.keepCandidate) {
        const candidateDir = path.join(candidatesDir, args.slug);
        if (fs.existsSync(candidateDir)) {
          fs.rmSync(candidateDir, { recursive: true, force: true });
          console.log(`Discarded candidate:    ${path.relative(repoRoot, candidateDir)}`);
        }
      }
    },
  });
}

module.exports = { createEvolutionDiscardCommand };
