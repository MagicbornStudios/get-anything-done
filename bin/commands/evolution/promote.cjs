'use strict';

const fs = require('fs');
const path = require('path');
const { defineCommand } = require('citty');
const xpMath = require('../../../lib/xp-math.cjs');

/**
 * Write a skill_preference row to .planning/datasets/skill-preference/<date>.jsonl
 * inside the resolved project root (or GAD repo root for framework promotions).
 * Appended atomically — one JSON object per line. Never throws; errors are
 * logged as warnings so the promote flow is never interrupted by DPO write failures.
 *
 * Shape matches slm_learning/schemas/skill_preference.schema.json.
 */
function writeSkillPreferenceRow({ slug, mode, projectRoot, gadRepoRoot, skillMdContent, workflowMdContent, protoDir }) {
  try {
    const root = (mode === 'project' && projectRoot) ? projectRoot : gadRepoRoot;
    const datasetDir = path.join(root, '.planning', 'datasets', 'skill-preference');
    fs.mkdirSync(datasetDir, { recursive: true });
    const dateStr = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
    const filePath = path.join(datasetDir, `${dateStr}.jsonl`);
    const row = {
      pair_id: `skpr-${mode === 'project' ? 'project' : 'framework'}-${dateStr.replace(/-/g, '')}-${Date.now().toString(36)}`,
      ts: new Date().toISOString(),
      projectid: mode === 'project' ? null : null,
      decision_kind: 'promote',
      candidate_slug: slug,
      verdict_source: 'operator_review',
      skill_under_review: {
        slug,
        draft_path: protoDir,
        skill_md_content: skillMdContent || '',
        workflow_md_content: workflowMdContent || null,
        candidate_md_content: null,
      },
      verdict: 'promoted',
      rationale: `Operator promoted via gad evolution promote at ${new Date().toISOString()}`,
      promoted_to: mode === 'project' ? 'project' : 'framework',
      promoted_at: new Date().toISOString(),
      expected_trigger_patterns: null,
      expected_anti_patterns: null,
      discard_reason: null,
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
    // Non-fatal — DPO write must never break the promote flow.
    console.warn(`  [dpo] warn: could not write skill_preference row: ${e.message}`);
  }
}

/**
 * Resolve the proto-skill source root + final destination roots for a promote
 * invocation. Mirrors the priority used by `gad evolution install`
 * (resolveProtoSkillsDir): explicit env override > --projectid > CWD repoRoot
 * != gadRepoRoot > fallback to gadRepoRoot (framework canonical).
 *
 * Returns:
 *   {
 *     mode:           'project' | 'framework',
 *     projectRoot:    absolute path to project (for XP award) — null in framework mode,
 *     projectId:      project id when resolved (for messaging) — null in framework mode,
 *     protoSkillsDir, finalSkillsDir, candidatesDir, workflowsRootDir,
 *   }
 *
 * Per slm-learning-209: project-level proto-skill promotion MUST award PROJECT
 * XP, not framework XP. The two tracks are completely separate.
 */
function resolvePromoteRoots({ args, gadRepoRoot, findRepoRoot, gadConfig, resolveRoots, evolutionPaths }) {
  const explicitFramework = Boolean(args.framework);
  // Env override is for tests / CI only — treat as framework-style absolute paths.
  if (process.env.GAD_PROTO_SKILLS_DIR && !args.projectid) {
    const protoSkillsDir = path.resolve(process.env.GAD_PROTO_SKILLS_DIR);
    const finalSkillsDir = process.env.GAD_SKILLS_DIR
      ? path.resolve(process.env.GAD_SKILLS_DIR)
      : evolutionPaths(gadRepoRoot).finalSkillsDir;
    return {
      mode: 'framework',
      projectRoot: null,
      projectId: null,
      protoSkillsDir,
      finalSkillsDir,
      candidatesDir: evolutionPaths(gadRepoRoot).candidatesDir,
      workflowsRootDir: gadRepoRoot,
    };
  }

  const baseDir = findRepoRoot();

  // Explicit framework opt-in always promotes inside the canonical framework
  // checkout. Refuses to award project XP. Useful when the operator is
  // promoting a candidate the framework itself drafted from its own pressure.
  if (explicitFramework && !args.projectid) {
    const fp = evolutionPaths(gadRepoRoot);
    return {
      mode: 'framework',
      projectRoot: null,
      projectId: null,
      protoSkillsDir: fp.protoSkillsDir,
      finalSkillsDir: fp.finalSkillsDir,
      candidatesDir: fp.candidatesDir,
      workflowsRootDir: gadRepoRoot,
    };
  }

  // --projectid <id> → look up the project root via gad-config and target it.
  if (args.projectid) {
    if (explicitFramework) {
      // Mutually-exclusive: refuse.
      const err = new Error(
        '--projectid and --framework are mutually exclusive. Pick one: --projectid <id> for project XP, --framework for canonical framework promotion.'
      );
      err.code = 'GAD_PROMOTE_FLAG_CONFLICT';
      throw err;
    }
    const config = gadConfig.load(baseDir);
    const roots = resolveRoots({ projectid: args.projectid }, baseDir, config.roots);
    if (roots.length === 0) {
      const err = new Error(
        `No project resolved for --projectid ${args.projectid}. Check \`gad workspace show\`.`
      );
      err.code = 'GAD_PROMOTE_PROJECT_NOT_FOUND';
      throw err;
    }
    if (roots.length > 1) {
      const err = new Error(
        `--projectid ${args.projectid} resolved to multiple roots; promote requires a single project.`
      );
      err.code = 'GAD_PROMOTE_AMBIGUOUS_PROJECT';
      throw err;
    }
    const projectRoot = path.resolve(baseDir, roots[0].path || '.');
    return {
      mode: 'project',
      projectRoot,
      projectId: roots[0].id,
      protoSkillsDir: path.join(projectRoot, '.planning', 'proto-skills'),
      finalSkillsDir: path.join(projectRoot, 'skills'),
      candidatesDir: path.join(projectRoot, '.planning', 'candidates'),
      workflowsRootDir: projectRoot,
    };
  }

  // CWD-based: if the operator is sitting inside a non-framework repo, prefer
  // that as the project root. This makes `cd <project> && gad evolution promote`
  // award project XP by default — matching the principle that pressure is
  // project-local (slm-learning-209).
  if (baseDir && baseDir !== gadRepoRoot) {
    return {
      mode: 'project',
      projectRoot: baseDir,
      projectId: null, // unknown — derived from CWD, not from --projectid
      protoSkillsDir: path.join(baseDir, '.planning', 'proto-skills'),
      finalSkillsDir: path.join(baseDir, 'skills'),
      candidatesDir: path.join(baseDir, '.planning', 'candidates'),
      workflowsRootDir: baseDir,
    };
  }

  // Final fallback: framework canonical (the gad source repo itself).
  const fp = evolutionPaths(gadRepoRoot);
  return {
    mode: 'framework',
    projectRoot: null,
    projectId: null,
    protoSkillsDir: fp.protoSkillsDir,
    finalSkillsDir: fp.finalSkillsDir,
    candidatesDir: fp.candidatesDir,
    workflowsRootDir: gadRepoRoot,
  };
}

/**
 * Award project XP for a successful proto-skill promotion. Mirrors the level
 * cache update pattern in bin/commands/tasks/stamp.cjs (creates the <level>
 * element if missing). Idempotent against double-promotion attempts because
 * the proto-skill dir is removed atomically after promotion succeeds; a
 * second invocation with the same slug fails before reaching this function.
 *
 * Promotion XP weight matches the `create-proto-skill` skill weight (8) —
 * graduating a proto-skill is a compound/orchestration-tier accomplishment.
 */
const PROMOTE_XP_WEIGHT = 8;

function awardProjectXp(stateXmlPath, slug) {
  if (!fs.existsSync(stateXmlPath)) return null;
  let xml = fs.readFileSync(stateXmlPath, 'utf8');
  const levelMatch = xml.match(/<level\s+value="(\d+)"\s+xp="(\d+(?:\.\d+)?)"\s+xp_to_next="(\d+)"\s+loaded_skills="(\d+)"\/?>/);
  if (levelMatch) {
    const curValue = parseInt(levelMatch[1], 10);
    const curXp = parseFloat(levelMatch[2]);
    const curXpToNext = parseInt(levelMatch[3], 10);
    const curLoadedSkills = parseInt(levelMatch[4], 10);
    const newXp = curXp + PROMOTE_XP_WEIGHT;
    const levelTag = `  <level value="${curValue}" xp="${newXp}" xp_to_next="${curXpToNext}" loaded_skills="${curLoadedSkills}"/>`;
    xml = xml.replace(/(\s*<level\s[^>]*\/?>)/, levelTag);
    fs.writeFileSync(stateXmlPath, xml);
    return { value: curValue, xp: newXp, xpToNext: curXpToNext, weight: PROMOTE_XP_WEIGHT };
  }
  // No <level> yet — create one. Default xp_to_next = xpToNextLevel(1) = 100.
  const initialXpToNext = xpMath.xpToNextLevel(1);
  const levelTag = `  <level value="1" xp="${PROMOTE_XP_WEIGHT}" xp_to_next="${initialXpToNext}" loaded_skills="0"/>`;
  if (/<state[^>]*>/.test(xml)) {
    xml = xml.replace(/(<state[^>]*>)/, `$1\n${levelTag}`);
    fs.writeFileSync(stateXmlPath, xml);
    return { value: 1, xp: PROMOTE_XP_WEIGHT, xpToNext: initialXpToNext, weight: PROMOTE_XP_WEIGHT };
  }
  return null;
}

function createEvolutionPromoteCommand({
  repoRoot,
  evolutionPaths,
  findRepoRoot,
  gadConfig,
  resolveRoots,
}) {
  return defineCommand({
    meta: { name: 'promote', description: 'Promote a proto-skill into skills/ + workflows/ (joins species DNA). Defaults to project scope when --projectid is set; --framework forces canonical promotion.' },
    args: {
      slug: { type: 'positional', description: 'proto-skill slug', required: true },
      name: { type: 'string', description: 'final skill name in skills/ (defaults to slug)', required: false },
      projectid: { type: 'string', description: 'Project ID — promote project-local proto-skill into <projectRoot>/skills + <projectRoot>/workflows and award PROJECT XP (slm-learning-209)', default: '' },
      framework: { type: 'boolean', description: 'Force framework-canonical promotion. Mutually exclusive with --projectid. Awards FRAMEWORK XP only.', default: false },
    },
    run({ args }) {
      let resolved;
      try {
        resolved = resolvePromoteRoots({
          args,
          gadRepoRoot: repoRoot,
          findRepoRoot,
          gadConfig,
          resolveRoots,
          evolutionPaths,
        });
      } catch (err) {
        console.error(err.message);
        process.exit(1);
        return;
      }

      const { mode, projectRoot, projectId, protoSkillsDir, finalSkillsDir, candidatesDir, workflowsRootDir } = resolved;
      const protoDir = path.join(protoSkillsDir, args.slug);
      if (!fs.existsSync(protoDir)) {
        console.error(`No proto-skill at ${protoDir}`);
        if (mode === 'framework') {
          console.error('Hint: pass --projectid <id> to promote a project-local proto-skill (e.g. one drafted from project pressure).');
        }
        process.exit(1);
      }
      const skillPath = path.join(protoDir, 'SKILL.md');
      if (!fs.existsSync(skillPath)) {
        console.error('Missing SKILL.md in proto-skill - cannot promote');
        process.exit(1);
      }

      let frontmatterName = null;
      try {
        const skillBody = fs.readFileSync(skillPath, 'utf8');
        const fmMatch = skillBody.match(/^---\s*\r?\n([\s\S]*?)\r?\n---\s*(?:\r?\n|$)/);
        if (fmMatch) {
          const nameLine = fmMatch[1].match(/^name:\s*(.+?)\s*$/m);
          if (nameLine && nameLine[1]) frontmatterName = nameLine[1].trim();
        }
      } catch {}
      const finalName = args.name || frontmatterName || args.slug;
      const finalDir = path.join(finalSkillsDir, finalName);
      if (fs.existsSync(finalDir)) {
        console.error(`Final skill dir already exists at ${finalDir} - refusing to overwrite. Pass --name <other> or remove it manually.`);
        process.exit(1);
      }

      fs.mkdirSync(finalDir, { recursive: true });

      const siblingWorkflowPath = path.join(protoDir, 'workflow.md');
      const hasSiblingWorkflow = fs.existsSync(siblingWorkflowPath);
      const workflowsDir = path.join(workflowsRootDir, 'workflows');
      const canonicalWorkflowPath = hasSiblingWorkflow
        ? path.join(workflowsDir, `${finalName}.md`)
        : null;

      if (hasSiblingWorkflow) {
        if (fs.existsSync(canonicalWorkflowPath)) {
          fs.rmSync(finalDir, { recursive: true, force: true });
          console.error(
            `Canonical workflow already exists at ${path.relative(workflowsRootDir, canonicalWorkflowPath)} - refusing to overwrite. Pass --name <other> or remove it manually.`
          );
          process.exit(1);
        }
        fs.mkdirSync(workflowsDir, { recursive: true });
      }

      for (const entry of fs.readdirSync(protoDir, { withFileTypes: true })) {
        if (hasSiblingWorkflow && entry.name === 'workflow.md') continue;
        const src = path.join(protoDir, entry.name);
        const dest = path.join(finalDir, entry.name);
        if (entry.isDirectory()) fs.cpSync(src, dest, { recursive: true });
        else fs.copyFileSync(src, dest);
      }

      if (hasSiblingWorkflow) {
        fs.copyFileSync(siblingWorkflowPath, canonicalWorkflowPath);
      }

      const copiedSkillPath = path.join(finalDir, 'SKILL.md');
      let copiedSkillBody = fs.readFileSync(copiedSkillPath, 'utf8');
      if (hasSiblingWorkflow) {
        const canonicalRef = `workflows/${finalName}.md`;
        copiedSkillBody = copiedSkillBody.replace(
          /^(workflow:\s*)(.+)$/m,
          (_, prefix) => `${prefix}${canonicalRef}`
        );
      }
      copiedSkillBody = copiedSkillBody.replace(
        /^(status:\s*)proto\s*$/m,
        (_, prefix) => `${prefix}stable`
      );
      fs.writeFileSync(copiedSkillPath, copiedSkillBody);

      // --- DPO: capture skill_preference row before removing proto-skill dir ---
      writeSkillPreferenceRow({
        slug: args.slug,
        mode,
        projectRoot,
        gadRepoRoot: repoRoot,
        skillMdContent: fs.existsSync(skillPath) ? fs.readFileSync(skillPath, 'utf8') : null,
        workflowMdContent: hasSiblingWorkflow ? fs.readFileSync(siblingWorkflowPath, 'utf8') : null,
        protoDir,
      });

      fs.rmSync(protoDir, { recursive: true, force: true });
      const candidateDir = path.join(candidatesDir, args.slug);
      if (fs.existsSync(candidateDir)) fs.rmSync(candidateDir, { recursive: true, force: true });

      const scopeLabel = mode === 'project'
        ? `project ${projectId || `(at ${workflowsRootDir})`}`
        : 'framework';
      console.log(`Promoted ${args.slug} -> ${path.relative(workflowsRootDir, finalDir)} [${scopeLabel}]`);
      if (hasSiblingWorkflow) {
        console.log(`  Split workflow: ${path.relative(workflowsRootDir, canonicalWorkflowPath)}`);
      } else {
        console.log('  (no sibling workflow.md - SKILL.md promoted as inline body)');
      }
      console.log(`  Removed proto-skill: ${path.relative(workflowsRootDir, protoDir)}`);

      // Project-mode XP award — slm-learning-209. Framework promotions never
      // touch project STATE.xml (would be cross-attribution); project
      // promotions never touch framework STATE.xml (different concern).
      if (mode === 'project' && projectRoot) {
        const stateXmlPath = path.join(projectRoot, '.planning', 'STATE.xml');
        const xpResult = awardProjectXp(stateXmlPath, args.slug);
        if (xpResult) {
          const ready = xpResult.xp >= xpResult.xpToNext;
          if (ready) {
            console.log(`  +${xpResult.weight} XP (project) — Level ${xpResult.value + 1} unlocked! Run \`gad evolution level-up${projectId ? ` --projectid ${projectId}` : ''}\` to advance.`);
          } else {
            console.log(`  +${xpResult.weight} XP (project) — ${xpResult.xp}/${xpResult.xpToNext} (${xpResult.xpToNext - xpResult.xp} to next level)`);
          }
        } else {
          console.log(`  (no STATE.xml at ${stateXmlPath} — XP not awarded)`);
        }
      }
    },
  });
}

module.exports = { createEvolutionPromoteCommand, resolvePromoteRoots, awardProjectXp, PROMOTE_XP_WEIGHT };
