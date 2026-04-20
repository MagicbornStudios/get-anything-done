'use strict';
/**
 * `gad skill …` command family — list, show, find, promote, promote-folder,
 * lint, status, token-audit. Includes `isCanonicalGadRepo` helper.
 *
 * skillPromote delegates to evolutionPromote/evolutionInstall (both injected).
 *
 * Most skill helpers stay in gad.cjs because snapshotCmd and canonical-skill
 * record builders also consume them; we accept them as factory deps.
 */

const fs = require('fs');
const path = require('path');
const { defineCommand } = require('citty');

function isCanonicalGadRepo(repoRoot) {
  try {
    if (fs.existsSync(path.join(repoRoot, '.gad-canonical'))) return true;
  } catch {}
  try {
    const out = require('child_process')
      .execSync('git config --get remote.origin.url', { cwd: repoRoot, stdio: ['ignore', 'pipe', 'ignore'] })
      .toString().trim();
    if (/MagicbornStudios\/get-anything-done(\.git)?$/i.test(out)) return true;
    if (/get-anything-done(\.git)?$/i.test(out)) return true;
  } catch {}
  return false;
}

function createSkillCommands(deps) {
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
  } = deps;

  const skillPromote = defineCommand({
    meta: { name: 'promote', description: 'Promote a proto-skill — --framework (canonical skills/) or --project (consumer runtime dir)' },
    args: {
      slug: { type: 'positional', description: 'proto-skill slug', required: true },
      framework: { type: 'boolean', description: 'Promote to canonical skills/ (canonical repo only)' },
      project: { type: 'boolean', description: "Install into the current project's coding-agent runtime dirs" },
      name: { type: 'string', description: 'final skill name for --framework (defaults to slug)', required: false },
      claude: { type: 'boolean' },
      codex: { type: 'boolean' },
      cursor: { type: 'boolean' },
      windsurf: { type: 'boolean' },
      augment: { type: 'boolean' },
      copilot: { type: 'boolean' },
      antigravity: { type: 'boolean' },
      all: { type: 'boolean' },
      global: { type: 'boolean' },
      local: { type: 'boolean' },
      'config-dir': { type: 'string', description: 'Custom runtime config directory (--project only)', default: '' },
    },
    run({ args }) {
      if (args.framework && args.project) {
        console.error('Choose either --framework or --project, not both.');
        process.exit(1);
      }
      if (!args.framework && !args.project) {
        console.error('Specify a mode: --framework (canonical skills/) or --project (consumer runtime).');
        console.error('');
        console.error('Examples:');
        console.error('  gad skill promote my-skill --framework                # canonical (repo gate)');
        console.error('  gad skill promote my-skill --project --claude          # install to ./.claude/skills/');
        console.error('  gad skill promote my-skill --project --all --global    # install to all runtimes globally');
        process.exit(1);
      }

      if (args.framework) {
        if (!isCanonicalGadRepo(repoRoot)) {
          console.error('Refusing --framework promote: this does not look like the canonical get-anything-done repo.');
          console.error('');
          console.error('Detection: git remote.origin.url must match MagicbornStudios/get-anything-done,');
          console.error('or a .gad-canonical sentinel file must exist at the repo root.');
          console.error('');
          console.error('For a consumer project, use: gad skill promote <slug> --project [--claude|--codex|...]');
          process.exit(1);
        }
        return evolutionPromote.run({ args: { slug: args.slug, name: args.name } });
      }

      return evolutionInstall.run({
        args: {
          slug: args.slug,
          claude: args.claude,
          codex: args.codex,
          cursor: args.cursor,
          windsurf: args.windsurf,
          augment: args.augment,
          copilot: args.copilot,
          antigravity: args.antigravity,
          all: args.all,
          global: args.global,
          local: args.local,
          'config-dir': args['config-dir'] || '',
        },
      });
    },
  });

  const skillList = defineCommand({
    meta: { name: 'list', description: 'List canonical skills (from skills/) and any pending proto-skills' },
    args: {
      proto: { type: 'boolean', description: 'List only pending proto-skills' },
      canonical: { type: 'boolean', description: 'List only canonical skills' },
      paths: { type: 'boolean', description: 'Print absolute SKILL.md path and resolved workflow path for each skill (decision gad-194, task 42.2-20)' },
      lane: { type: 'string', description: 'Filter by lane (dev|prod|meta)', default: '' },
      'lint-summary': { type: 'boolean', description: 'Append a non-blocking lint summary for the listed canonical skills', default: false },
    },
    run({ args }) {
      const { protoSkillsDir, finalSkillsDir } = resolveSkillRoots(repoRoot);
      const showCanonical = !args.proto;
      const showProto = !args.canonical;
      const showPaths = Boolean(args.paths);
      const laneFilter = validateSkillLaneFilter(args.lane);
      let listedCanonical = [];
      if (showCanonical) {
        const canonical = listSkillDirs(finalSkillsDir).filter((skill) => skillMatchesLane(readSkillFrontmatter(skill.skillFile), laneFilter));
        listedCanonical = canonical;
        console.log(`Canonical skills (skills/): ${canonical.length}${laneFilter ? `  lane=${laneFilter}` : ''}`);
        for (const s of canonical) {
          const fm = readSkillFrontmatter(s.skillFile);
          console.log(`  ${s.id}${fm.name && fm.name !== s.id ? `  (${fm.name})` : ''}`);
          if (showPaths) {
            console.log(`      SKILL.md: ${s.skillFile}`);
            if (fm.workflow) {
              const resolved = resolveSkillWorkflowPath(repoRoot, s.dir, fm.workflow);
              const exists = fs.existsSync(resolved);
              console.log(`      workflow: ${resolved}${exists ? '' : ' (MISSING)'}`);
            }
          }
        }
        console.log('');
      }
      if (showProto) {
        const proto = listSkillDirs(protoSkillsDir).filter((skill) => skillMatchesLane(readSkillFrontmatter(skill.skillFile), laneFilter));
        console.log(`Proto-skills (.planning/proto-skills/): ${proto.length}${laneFilter ? `  lane=${laneFilter}` : ''}`);
        for (const s of proto) {
          const fm = readSkillFrontmatter(s.skillFile);
          console.log(`  ${s.id}${fm.name && fm.name !== s.id ? `  (${fm.name})` : ''}`);
          if (showPaths) {
            console.log(`      SKILL.md: ${s.skillFile}`);
            if (fm.workflow) {
              const resolved = resolveSkillWorkflowPath(repoRoot, s.dir, fm.workflow);
              const exists = fs.existsSync(resolved);
              console.log(`      workflow: ${resolved}${exists ? '' : ' (MISSING)'}`);
            }
          }
        }
        if (proto.length > 0) {
          console.log('');
          console.log('Promote with:');
          console.log('  gad skill promote <slug> --framework            # canonical (this repo only)');
          console.log('  gad skill promote <slug> --project --claude     # runtime install');
        }
      }
      if (args['lint-summary'] && showCanonical) {
        const lintReports = listedCanonical.map((skill) => lintSkill(skill.skillFile, { gadDir: repoRoot }));
        const lintSummary = summarizeLint(lintReports);
        console.log('');
        console.log(`Lint: ${lintSummary.clean} clean, ${lintSummary.bySeverity.error} errors, ${lintSummary.bySeverity.warning} warnings, ${lintSummary.bySeverity.info} info - run \`gad skill lint\` for detail.`);
      }
      console.log('');
      console.log('Authoring skills — which to fire when:');
      console.log('  create-skill         neutral generic authoring, no eval loop');
      console.log('  create-proto-skill   fast drafter inside evolution loop (candidate → proto)');
      console.log('  gad-skill-creator    GAD-tailored heavy path, eval scaffold');
      console.log('  merge-skill          fuse overlapping / duplicate skills');
      console.log('');
      console.log('Skill lifecycle (decision gad-183 / references/skill-shape.md §11):');
      console.log('  candidate → proto-skill → [install/validate] → promoted');
      console.log('  gad evolution evolve       # find high-pressure phases → write CANDIDATE.md');
      console.log('  create-proto-skill         # draft from candidate → .planning/proto-skills/<slug>/');
      console.log('  gad evolution install      # test in runtime without promoting');
      console.log('  gad evolution validate     # advisory checker → VALIDATION.md');
      console.log('  gad evolution promote      # → skills/<name>/ + workflows/<name>.md');
      console.log('');
      console.log('Discovery helpers:');
      console.log('  gad skill show <id>        # name, description, resolved workflow path');
      console.log('  gad skill show <id> --body # full SKILL.md + workflow contents');
      console.log('  gad skill list --paths     # inventory with absolute paths + MISSING flags');
    },
  });

  const skillLint = defineCommand({
    meta: { name: 'lint', description: 'Run the non-blocking skill linter across canonical skills or one named skill' },
    args: {
      id: { type: 'string', description: 'Lint a single canonical skill id', default: '' },
      severity: { type: 'string', description: 'Filter to issues at or above error|warning|info', default: '' },
      json: { type: 'boolean', description: 'JSON output', default: false },
    },
    run({ args }) {
      const { finalSkillsDir } = resolveSkillRoots(repoRoot);
      const minimumSeverity = String(args.severity || '').trim().toLowerCase();
      if (minimumSeverity && !['error', 'warning', 'info'].includes(minimumSeverity)) {
        outputError(`Invalid severity: ${minimumSeverity}. Expected error, warning, or info.`);
      }

      let reports;
      if (args.id) {
        const skillPath = path.join(finalSkillsDir, String(args.id), 'SKILL.md');
        if (!fs.existsSync(skillPath)) {
          outputError(`Skill not found: ${args.id}`);
        }
        reports = [lintSkill(skillPath, { gadDir: repoRoot })];
      } else {
        reports = lintAllSkills(finalSkillsDir, { gadDir: repoRoot });
      }

      const filteredReports = reports.map((report) => ({
        ...report,
        issues: filterIssuesBySeverity(report.issues || [], minimumSeverity),
      }));
      const summary = summarizeLint(filteredReports);

      if (args.json || shouldUseJson()) {
        console.log(JSON.stringify({ summary, reports: filteredReports }, null, 2));
        return;
      }

      const issueBuckets = filteredReports.filter((report) => report.issues.length > 0);
      console.log(`Skill lint report - ${summary.totalSkills} skills, ${summary.clean} clean, ${issueBuckets.length} with issues`);
      if (issueBuckets.length > 0) console.log('');
      for (const report of issueBuckets) {
        console.log(`${path.relative(repoRoot, report.skillPath)} (${report.issues.length} issue${report.issues.length === 1 ? '' : 's'})`);
        for (const issue of report.issues) {
          console.log(`  [${issue.severity}] ${issue.code} - ${issue.message}`);
        }
        console.log('');
      }
      console.log(`Summary: ${summary.bySeverity.error} errors, ${summary.bySeverity.warning} warnings, ${summary.bySeverity.info} info`);
      console.log(`Total tokens: ${summary.totalTokens} across ${summary.totalSkills} skills (avg ${summary.averageTokens}/skill)`);
    },
  });

  const skillTokenAudit = defineCommand({
    meta: { name: 'token-audit', description: 'Audit canonical skill token footprint and highlight the largest skill bundles' },
    args: {
      top: { type: 'string', description: 'How many skills to show (default 10)', default: '10' },
      json: { type: 'boolean', description: 'JSON output', default: false },
    },
    run({ args }) {
      const { finalSkillsDir } = resolveSkillRoots(repoRoot);
      const topN = Math.max(1, Number.parseInt(String(args.top || '10'), 10) || 10);
      const audits = listSkillDirs(finalSkillsDir).map((skill) => ({
        id: skill.id,
        path: skill.skillFile,
        audit: auditSkillTokens(skill.skillFile, { gadDir: repoRoot }),
      }));
      const summary = {
        totalSkills: audits.length,
        totalTokens: audits.reduce((sum, entry) => sum + (entry.audit.totalTokens || 0), 0),
      };
      summary.averageTokens = summary.totalSkills > 0 ? Math.round(summary.totalTokens / summary.totalSkills) : 0;
      const top = [...audits]
        .sort((a, b) => (b.audit.totalTokens || 0) - (a.audit.totalTokens || 0))
        .slice(0, topN);

      if (args.json || shouldUseJson()) {
        console.log(JSON.stringify({
          summary,
          top: top.map((entry) => ({
            id: entry.id,
            path: path.relative(repoRoot, entry.path),
            totalTokens: entry.audit.totalTokens || 0,
            sections: entry.audit.sections || [],
          })),
        }, null, 2));
        return;
      }

      console.log(`Skill token audit - ${summary.totalSkills} skills, ${summary.totalTokens} total tokens, ${summary.averageTokens} avg`);
      console.log('');
      console.log(`Top ${top.length} bloat:`);
      for (const entry of top) {
        console.log(`  ${(entry.audit.totalTokens || 0).toString().padStart(4, ' ')}  ${path.relative(repoRoot, entry.path)}`);
      }
      const breakdown = top.slice(0, Math.min(3, top.length));
      if (breakdown.length > 0) {
        console.log('');
        console.log(`Per-section breakdown for top ${breakdown.length}:`);
        for (const entry of breakdown) {
          console.log(`  ${entry.id}:`);
          for (const section of entry.audit.sections || []) {
            console.log(`    ${section.name.padEnd(28, ' ')} ~${section.tokens}`);
          }
        }
      }
    },
  });

  const skillStatus = defineCommand({
    meta: { name: 'status', description: 'Show one skill health card: frontmatter, lint issues, bundle completeness, usage, and token footprint' },
    args: {
      id: { type: 'positional', description: 'Skill id (canonical or proto)', required: true },
    },
    run({ args }) {
      const baseDir = findRepoRoot();
      const { protoSkillsDir, finalSkillsDir } = resolveSkillRoots(repoRoot);
      const roots = [
        { label: 'canonical', dir: finalSkillsDir },
        { label: 'proto', dir: protoSkillsDir },
      ];
      let hit = null;
      for (const root of roots) {
        const candidate = listSkillDirs(root.dir).find((skill) => skill.id === args.id);
        if (!candidate) continue;
        hit = { ...candidate, origin: root.label, fm: readSkillFrontmatter(candidate.skillFile) };
        break;
      }
      if (!hit) outputError(`Skill not found: ${args.id}`);

      const lintReport = lintSkill(hit.skillFile, { gadDir: repoRoot });
      const workflowPath = hit.fm.workflow ? resolveSkillWorkflowPath(repoRoot, hit.dir, hit.fm.workflow) : null;
      const skillTokens = auditSkillTokens(hit.skillFile, { gadDir: repoRoot });
      const workflowTokenAudit = workflowPath && fs.existsSync(workflowPath)
        ? auditSkillTokens(workflowPath, { gadDir: repoRoot })
        : null;
      const usageIndex = buildSkillUsageIndex(baseDir, finalSkillsDir);
      const usage = usageIndex.bySkill.get(hit.id) || null;
      const bundleChecks = [
        ['SKILL.md', true],
        ['PROVENANCE.md', fs.existsSync(path.join(hit.dir, 'PROVENANCE.md'))],
        ['VALIDATION.md', fs.existsSync(path.join(hit.dir, 'VALIDATION.md'))],
        ['workflow.md', fs.existsSync(path.join(hit.dir, 'workflow.md'))],
        ['COMMAND.md', fs.existsSync(path.join(hit.dir, 'COMMAND.md'))],
        ['references/', fs.existsSync(path.join(hit.dir, 'references'))],
      ];

      console.log(`Skill: ${hit.id} [${hit.origin}]`);
      console.log(`  name:       ${hit.fm.name || hit.id}`);
      console.log(`  lane:       ${normalizeSkillLaneValues(hit.fm.lane).join(', ') || '(none)'}`);
      console.log(`  type:       ${hit.fm.type || '(none)'}`);
      console.log(`  status:     ${hit.fm.status || '(none)'}`);
      console.log(`  parent:     ${hit.fm.parent_skill || '(none)'}`);
      if (workflowPath) {
        console.log(`  workflow:   ${hit.fm.workflow} [${fs.existsSync(workflowPath) ? 'ok' : 'missing'}]`);
      } else {
        console.log('  workflow:   (none)');
      }
      if (workflowTokenAudit) {
        const totalTokens = (skillTokens.totalTokens || 0) + (workflowTokenAudit.totalTokens || 0);
        console.log(`  tokens:     ~${skillTokens.totalTokens || 0} SKILL.md + ~${workflowTokenAudit.totalTokens || 0} workflow (~${totalTokens} total)`);
      } else {
        console.log(`  tokens:     ~${lintReport.tokenEstimate} (SKILL.md)`);
      }
      console.log(`  bundle:     ${bundleChecks.map(([label, ok]) => `${label} ${ok ? '[ok]' : '[missing]'}`).join('  ')}`);
      if (usage) {
        const projects = usage.projects || [];
        const projectSummary = projects.length === 1 ? ` (${projects[0]})` : '';
        console.log(`  usage:      ${usage.runs} done tasks, ${projects.length} project${projects.length === 1 ? '' : 's'}${projectSummary}; last run ${usage.lastUsedAt ? usage.lastUsedAt.slice(0, 10) : 'unknown'}`);
      } else {
        console.log('  usage:      0 done tasks, 0 projects; last run unknown');
      }
      if (hit.fm.canonicalization_rationale) {
        console.log(`  lineage:    ${String(hit.fm.canonicalization_rationale).replace(/\s+/g, ' ').trim()}`);
      }
      console.log('');
      console.log(`Issues${lintReport.issues.length === 0 ? ': (none)' : ` (${lintReport.issues.length}):`}`);
      if (lintReport.issues.length > 0) {
        for (const issue of lintReport.issues) {
          console.log(`  [${issue.severity}] ${issue.code} - ${issue.message}`);
        }
      }
      console.log('');
      console.log('Section tokens:');
      for (const section of skillTokens.sections || []) {
        console.log(`  ${section.name.padEnd(34, ' ')} ~${section.tokens}`);
      }
      console.log(`  ${'(total)'.padEnd(34, ' ')} ~${skillTokens.totalTokens || 0}`);
    },
  });

  const skillShow = defineCommand({
    meta: { name: 'show', description: 'Show a canonical or proto-skill: resolved paths, frontmatter, and (optionally) SKILL.md + workflow body. Decision gad-194, task 42.2-20.' },
    args: {
      id: { type: 'positional', description: 'skill id (e.g. gad-plan-phase) or slug', required: true },
      body: { type: 'boolean', description: 'Also print SKILL.md and workflow file body', default: false },
    },
    run({ args }) {
      const { protoSkillsDir, finalSkillsDir } = resolveSkillRoots(repoRoot);
      const roots = [
        { label: 'canonical', dir: finalSkillsDir },
        { label: 'proto', dir: protoSkillsDir },
      ];
      let hit = null;
      for (const root of roots) {
        const entries = listSkillDirs(root.dir);
        for (const s of entries) {
          const fm = readSkillFrontmatter(s.skillFile);
          if (s.id === args.id || fm.name === args.id || fm.name === `gad:${args.id.replace(/^gad-/, '')}`) {
            hit = { ...s, fm, origin: root.label };
            break;
          }
        }
        if (hit) break;
      }

      if (!hit) {
        console.error(`Skill not found: ${args.id}`);
        console.error(`  Try:  gad skill list --paths   # full inventory with paths`);
        process.exit(1);
      }

      console.log(`Skill: ${hit.id}  [${hit.origin}]`);
      console.log(`  public name: ${hit.fm.name || '(none)'}`);
      console.log(`  description: ${(hit.fm.description || '').replace(/\s+/g, ' ').trim()}`);
      console.log(`  SKILL.md:    ${hit.skillFile}`);
      if (hit.fm.workflow) {
        const resolved = resolveSkillWorkflowPath(repoRoot, hit.dir, hit.fm.workflow);
        const exists = fs.existsSync(resolved);
        console.log(`  workflow:    ${resolved}${exists ? '' : ' (MISSING)'}`);
      } else {
        console.log(`  workflow:    (none — inline body in SKILL.md)`);
      }

      if (args.body) {
        console.log('');
        console.log('-- SKILL.md ---------------------------------------------------');
        console.log(fs.readFileSync(hit.skillFile, 'utf8'));
        if (hit.fm.workflow) {
          const resolved = resolveSkillWorkflowPath(repoRoot, hit.dir, hit.fm.workflow);
          if (fs.existsSync(resolved)) {
            console.log('');
            console.log(`-- workflow (${path.relative(repoRoot, resolved)}) --------`);
            console.log(fs.readFileSync(resolved, 'utf8'));
          }
        }
      }
    },
  });

  const skillPromoteFolder = defineCommand({
    meta: { name: 'promote-folder', description: 'Promote any skill-shaped folder into the canonical get-anything-done framework `skills/` + `workflows/` tree. Generalizes `evolution promote` — source can be `.planning/proto-skills/<slug>/` (the evolve-loop pathway), a hand-authored draft, or a consumer project proto-skill being elevated to framework canonical. Consumer projects do NOT use this — their proto-skills auto-register in the project tree. Decision gad-196 (task 42.2-32/34).' },
    args: {
      source: { type: 'positional', description: 'absolute or relative path to a skill-shaped folder (must contain SKILL.md with valid frontmatter)', required: true },
      name: { type: 'string', description: 'Final skill name (defaults to source dir basename)', default: '' },
      'dry-run': { type: 'boolean', description: 'Print what would happen without writing anything', default: false },
      force: { type: 'boolean', description: 'Overwrite an existing skills/<name>/ or workflows/<name>.md at the destination', default: false },
    },
    run({ args }) {
      const srcDir = path.resolve(args.source);
      if (!fs.existsSync(srcDir) || !fs.statSync(srcDir).isDirectory()) {
        console.error(`Source path is not a directory: ${srcDir}`);
        process.exit(1);
      }
      const srcSkill = path.join(srcDir, 'SKILL.md');
      if (!fs.existsSync(srcSkill)) {
        console.error(`Source folder is not skill-shaped: missing SKILL.md at ${srcSkill}`);
        process.exit(1);
      }

      const raw = fs.readFileSync(srcSkill, 'utf8');
      const fmMatch = raw.match(/^---\s*\r?\n([\s\S]*?)\r?\n---\s*(?:\r?\n|$)/);
      if (!fmMatch) {
        console.error(`SKILL.md has no frontmatter block: ${srcSkill}`);
        process.exit(1);
      }
      const fmBody = fmMatch[1];
      const nameMatch = fmBody.match(/^name:\s*(.+?)\s*$/m);
      const descMatch = fmBody.match(/^description:\s*(.+?)\s*$/m);
      if (!nameMatch) {
        console.error(`SKILL.md frontmatter missing required 'name:' key`);
        process.exit(1);
      }
      if (!descMatch) {
        console.error(`SKILL.md frontmatter missing required 'description:' key`);
        process.exit(1);
      }

      const finalName = args.name || path.basename(srcDir);
      if (!isCanonicalGadRepo(repoRoot)) {
        console.error('Refusing promote-folder: not in the canonical get-anything-done repo.');
        console.error('');
        console.error('Detection: git remote.origin.url must match MagicbornStudios/get-anything-done,');
        console.error('or a .gad-canonical sentinel file must exist at the repo root.');
        console.error('');
        console.error('Consumer projects do not promote — proto-skills in a consumer project');
        console.error("live in that project's own tree and are automatically available.");
        console.error('There is no cross-project install operation for this command.');
        process.exit(1);
      }
      const destRoot = repoRoot;

      const destSkillDir = path.join(destRoot, 'skills', finalName);
      const destWorkflowsDir = path.join(destRoot, 'workflows');

      const workflowRefMatch = fmBody.match(/^workflow:\s*(.+?)\s*$/m);
      let workflowRef = null;
      let sourceWorkflowPath = null;
      let destCanonicalWorkflowPath = null;
      if (workflowRefMatch) {
        workflowRef = workflowRefMatch[1].replace(/^["']|["']$/g, '').trim();
        const isSibling = workflowRef.startsWith('./') || workflowRef.startsWith('../');
        if (isSibling) {
          sourceWorkflowPath = path.resolve(srcDir, workflowRef);
        } else {
          const candidate = path.resolve(path.dirname(path.dirname(srcDir)), workflowRef);
          if (fs.existsSync(candidate)) sourceWorkflowPath = candidate;
        }
        destCanonicalWorkflowPath = path.join(destWorkflowsDir, `${finalName}.md`);
      }

      const collisions = [];
      if (fs.existsSync(destSkillDir) && !args.force) {
        collisions.push(`destination skill dir already exists: ${destSkillDir}`);
      }
      if (destCanonicalWorkflowPath && fs.existsSync(destCanonicalWorkflowPath) && !args.force) {
        collisions.push(`destination workflow file already exists: ${destCanonicalWorkflowPath}`);
      }
      if (collisions.length > 0) {
        console.error('Refusing to overwrite (pass --force to override):');
        for (const c of collisions) console.error(`  ${c}`);
        process.exit(1);
      }

      console.log(`Promote skill folder`);
      console.log(`  source:      ${srcDir}`);
      console.log(`  destination: ${destSkillDir}`);
      if (destCanonicalWorkflowPath) {
        console.log(`  workflow →   ${destCanonicalWorkflowPath}`);
      }
      console.log(`  name:        ${finalName}`);
      console.log(`  public name: ${nameMatch[1].replace(/^["']|["']$/g, '').trim()}`);
      console.log('');

      if (args['dry-run']) {
        console.log('--dry-run: no files written.');
        return;
      }

      fs.mkdirSync(destSkillDir, { recursive: true });
      if (destCanonicalWorkflowPath) fs.mkdirSync(destWorkflowsDir, { recursive: true });

      const siblingToSkip = sourceWorkflowPath && workflowRef &&
        (workflowRef.startsWith('./') || workflowRef.startsWith('../'))
        ? path.resolve(sourceWorkflowPath)
        : null;
      for (const entry of fs.readdirSync(srcDir, { withFileTypes: true })) {
        const src = path.join(srcDir, entry.name);
        if (siblingToSkip && path.resolve(src) === siblingToSkip) continue;
        const dest = path.join(destSkillDir, entry.name);
        if (entry.isDirectory()) fs.cpSync(src, dest, { recursive: true });
        else fs.copyFileSync(src, dest);
      }

      if (sourceWorkflowPath && fs.existsSync(sourceWorkflowPath) && destCanonicalWorkflowPath) {
        fs.copyFileSync(sourceWorkflowPath, destCanonicalWorkflowPath);
        const canonicalRef = `workflows/${finalName}.md`;
        const destSkillFile = path.join(destSkillDir, 'SKILL.md');
        const destRaw = fs.readFileSync(destSkillFile, 'utf8');
        const rewritten = destRaw.replace(
          /^(workflow:\s*)(.+)$/m,
          (_, prefix) => `${prefix}${canonicalRef}`
        );
        fs.writeFileSync(destSkillFile, rewritten);
      }

      console.log(`Promoted → ${path.relative(destRoot, destSkillDir)}`);
      if (destCanonicalWorkflowPath && fs.existsSync(destCanonicalWorkflowPath)) {
        console.log(`  Workflow: ${path.relative(destRoot, destCanonicalWorkflowPath)}`);
      }
      console.log('');
      console.log('Verify:');
      console.log(`  gad skill show ${finalName}`);
    },
  });

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

  const skillCmd = defineCommand({
    meta: { name: 'skill', description: 'Skill ops — list, show, find, promote (--framework canonical / --project consumer runtime install), promote-folder (any skill-shaped folder → framework canonical, framework-only). See decisions gad-188, gad-196.' },
    subCommands: {
      list: skillList,
      show: skillShow,
      lint: skillLint,
      status: skillStatus,
      'token-audit': skillTokenAudit,
      find: skillFind,
      promote: skillPromote,
      'promote-folder': skillPromoteFolder,
    },
  });

  return { skillCmd, isCanonicalGadRepo };
}

module.exports = { createSkillCommands, isCanonicalGadRepo };
module.exports.register = (ctx) => {
  const { skillCmd } = createSkillCommands({
    ...ctx.common,
    ...ctx.extras.skill,
    evolutionPromote: ctx.services.evolution.evolutionPromote,
    evolutionInstall: ctx.services.evolution.evolutionInstall,
  });
  return { skill: skillCmd };
};
