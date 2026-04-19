'use strict';
/**
 * Shared eval helpers — pure functions used by multiple eval command modules.
 * Extracted from bin/gad.cjs (sweep H, 2026-04-19) so eval modules can require
 * them directly without going through gad.cjs injection.
 */

const fs = require('fs');
const path = require('path');

function parseProjectSpeciesRef(value) {
  const raw = String(value || '').trim();
  if (!raw) return { project: '', species: '', projectRef: '' };
  const parts = raw.split('/').filter(Boolean);
  if (parts.length >= 2) {
    return {
      project: parts[0],
      species: parts[1],
      projectRef: `${parts[0]}/${parts[1]}`,
    };
  }
  return { project: raw, species: '', projectRef: raw };
}

function normalizeGenerationReference(projectArg, speciesArg, versionArg) {
  const parsed = parseProjectSpeciesRef(projectArg);
  let species = String(speciesArg || '').trim();
  let version = String(versionArg || '').trim();
  if (!version && /^v\d+$/i.test(species)) {
    version = species;
    species = '';
  }
  if (!parsed.species && species) {
    parsed.species = species;
    parsed.projectRef = `${parsed.project}/${species}`;
  }
  return {
    project: parsed.project,
    species: parsed.species,
    projectRef: parsed.projectRef,
    version,
  };
}

function formatGenerationPreserveCommand(projectRef, version) {
  const parsed = parseProjectSpeciesRef(projectRef);
  if (parsed.species) return `gad generation preserve ${parsed.project} ${parsed.species} ${version}`;
  return `gad generation preserve ${parsed.project} ${version}`;
}

/** Build skills provenance snapshot for eval run (decision gad-120) */
function buildSkillsProvenance(projectDir) {
  const templateSkillsDir = path.join(projectDir, 'template', 'skills');
  const installedMeta = path.join(projectDir, 'template', '.installed-skills.json');
  const inheritedMeta = path.join(projectDir, 'template', '.inherited-skills.json');

  const provenance = { installed: [], inherited: [], start_snapshot: [] };

  if (fs.existsSync(installedMeta)) {
    try {
      const meta = JSON.parse(fs.readFileSync(installedMeta, 'utf8'));
      provenance.installed = (meta.skills || []).map((s) => ({
        name: s.name,
        source: s.source || 'local',
        type: 'installed',
      }));
    } catch {}
  }

  if (fs.existsSync(inheritedMeta)) {
    try {
      const meta = JSON.parse(fs.readFileSync(inheritedMeta, 'utf8'));
      provenance.inherited = (meta.skills || []).map((s) => ({
        name: s.name,
        source: meta.source || 'unknown',
        type: 'inherited',
      }));
    } catch {}
  }

  if (fs.existsSync(templateSkillsDir)) {
    try {
      const skills = fs.readdirSync(templateSkillsDir, { withFileTypes: true })
        .filter((e) => e.isDirectory())
        .map((e) => e.name);
      provenance.start_snapshot = skills;
    } catch {}
  }

  return provenance;
}

function readIfExists(p) {
  return fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : null;
}

function runtimeInstallHint(runtimeId) {
  if (runtimeId === 'claude-code') return 'gad install all --claude --global';
  if (runtimeId === 'codex') return 'gad install all --codex --global';
  if (runtimeId === 'cursor') return 'gad install all --cursor --global';
  if (runtimeId === 'windsurf') return 'gad install all --windsurf --global';
  if (runtimeId === 'gemini-cli') return 'gad install all --gemini --global';
  return 'gad install all --<runtime> --global';
}

function buildEvalPrompt(projectDir, projectName, runNum, runtimeIdentity, runDir) {
  const templateDir = path.join(projectDir, 'template');
  const planDir = path.join(templateDir, '.planning');

  const agentsMd = readIfExists(path.join(templateDir, 'AGENTS.md'));
  const reqXml = readIfExists(path.join(planDir, 'REQUIREMENTS.xml'));
  const reqMd = readIfExists(path.join(projectDir, 'REQUIREMENTS.md'));
  const decisionsXml = readIfExists(path.join(planDir, 'DECISIONS.xml'));
  const conventionsMd = readIfExists(path.join(planDir, 'CONVENTIONS.md'));
  const roadmapXml = readIfExists(path.join(planDir, 'ROADMAP.xml'));
  const stateXml = readIfExists(path.join(planDir, 'STATE.xml'));

  const runtimeId = runtimeIdentity?.id || 'unknown';
  const runDirUnix = runDir.replace(/\\/g, '/');
  const runLogDirUnix = path.join(runDir, '.gad-log').replace(/\\/g, '/');

  const sourceDocs = [];

  const sections = [];
  sections.push(`# Eval: ${projectName} v${runNum}`);
  sections.push(`\nYou are running a GAD eval. Follow the loop defined in AGENTS.md. Your work is being traced.\n`);
  sections.push(`\n**Runtime target:** ${runtimeId}\n`);

  if (agentsMd) sections.push(`## AGENTS.md (follow this exactly)\n\n${agentsMd}`);
  if (reqXml) sections.push(`## REQUIREMENTS.xml\n\n\`\`\`xml\n${reqXml}\`\`\``);
  if (reqMd) sections.push(`## REQUIREMENTS.md (eval overview)\n\n${reqMd}`);
  if (decisionsXml) sections.push(`## DECISIONS.xml\n\n\`\`\`xml\n${decisionsXml}\`\`\``);
  if (conventionsMd) sections.push(`## CONVENTIONS.md\n\n${conventionsMd}`);
  if (roadmapXml) sections.push(`## ROADMAP.xml\n\n\`\`\`xml\n${roadmapXml}\`\`\``);
  if (stateXml) sections.push(`## STATE.xml\n\n\`\`\`xml\n${stateXml}\`\`\``);
  if (sourceDocs.length > 0) sections.push(`## Source documents\n\n${sourceDocs.join('\n\n')}`);

  sections.push(`\n## Instructions\n`);
  sections.push(`0. **FIRST:** Before writing any code, estimate how long these requirements would take a mid-senior human developer to implement WITHOUT AI tools. Consider the full scope: architecture, implementation, testing, debugging. Write your estimate to TRACE.json field \`human_estimate_hours\`. This is required before starting implementation.`);
  sections.push(`0b. **VERIFY RUNTIME TRACING:** This eval should run with GAD hooks installed for the runtime actually doing the work. Expected runtime: \`${runtimeId}\`.`);
  sections.push(`0c. If hooks are not already installed for this runtime, install them now:\n\`\`\`sh\n${runtimeInstallHint(runtimeId)}\n\`\`\``);
  sections.push(`0d. Export eval tracing env before running the agent loop.\n\nPOSIX shells:\n\`\`\`sh\nexport GAD_RUNTIME=${runtimeId}\nexport GAD_LOG_DIR=${runLogDirUnix}\nexport GAD_EVAL_TRACE_DIR=${runDirUnix}\n\`\`\`\n\nPowerShell:\n\`\`\`powershell\n$env:GAD_RUNTIME='${runtimeId}'\n$env:GAD_LOG_DIR='${runLogDirUnix}'\n$env:GAD_EVAL_TRACE_DIR='${runDirUnix}'\n\`\`\``);
  sections.push(`1. Copy the .planning/ directory from the template into your working directory`);
  sections.push(`2. Implement the project following the ROADMAP.xml phases`);
  sections.push(`3. For EACH task: update TASK-REGISTRY.xml, update STATE.xml, commit with task ID — one commit per task, not per phase`);
  sections.push(`4. Follow CONVENTIONS.md patterns and DECISIONS.xml architecture`);
  sections.push(`4b. Capture decisions AS YOU MAKE THEM — if you chose between alternatives (library, pattern, data model), write a <decision> to DECISIONS.xml before committing that task. Aim for 1-2 per phase minimum.`);
  sections.push(`5. After EACH phase completes: write/append to .planning/VERIFICATION.md (build result, task count, state check), commit with "verify: phase X verified"`);
  sections.push(`6. When complete: all phases done, build passes, planning docs current`);
  sections.push(`7. FINAL STEP: produce a production build (dist/ directory) and commit it. The build artifact is showcased on the docs site. No dist = eval incomplete.`);
  sections.push(`\n## Logging\n`);
  sections.push(`All gad CLI calls and tool uses should land in the eval run directory, not just the root repo log.`);
  sections.push(`This eval is only considered fully attributed if the preserved run includes runtime identity plus raw logs/trace events.`);

  return sections.join('\n\n');
}

/**
 * Factory for eval-roots helpers that need findRepoRoot/gadConfig from
 * the host. Returns: getEvalRoots, defaultEvalsDir, listAllEvalProjects,
 * resolveEvalProject, resolveOrDefaultEvalProjectDir, listEvalProjectsHint.
 */
function createEvalRootsHelpers({ repoRoot, findRepoRoot, gadConfig }) {
  function getEvalRoots() {
    const defaultRoot = {
      id: 'get-anything-done',
      dir: path.resolve(repoRoot, 'evals'),
    };
    let configuredRoots = [];
    try {
      const visited = new Set();
      let dir = findRepoRoot();
      while (dir && !visited.has(dir)) {
        visited.add(dir);
        try {
          const cfg = gadConfig.load(dir);
          if (cfg && Array.isArray(cfg.evalsRoots) && cfg.evalsRoots.length > 0) {
            configuredRoots = cfg.evalsRoots
              .filter((r) => r && r.enabled !== false && r.path)
              .map((r) => ({
                id: r.id || path.basename(r.path),
                dir: path.isAbsolute(r.path) ? r.path : path.resolve(dir, r.path),
              }));
            break;
          }
        } catch {}
        const parent = path.dirname(dir);
        if (parent === dir) break;
        dir = parent;
      }
    } catch {
      configuredRoots = [];
    }
    const seenDirs = new Set();
    const ordered = [];
    for (const r of configuredRoots) {
      const key = path.resolve(r.dir).toLowerCase();
      if (seenDirs.has(key)) continue;
      seenDirs.add(key);
      ordered.push(r);
    }
    const defaultKey = path.resolve(defaultRoot.dir).toLowerCase();
    if (!seenDirs.has(defaultKey)) ordered.push(defaultRoot);
    return ordered;
  }

  function defaultEvalsDir() {
    return path.join(repoRoot, 'evals');
  }

  function listAllEvalProjects() {
    const roots = getEvalRoots();
    const byName = new Map();
    for (const root of roots) {
      if (!fs.existsSync(root.dir)) continue;
      let entries = [];
      try {
        entries = fs.readdirSync(root.dir, { withFileTypes: true });
      } catch {
        continue;
      }
      for (const e of entries) {
        if (!e.isDirectory()) continue;
        if (e.name.startsWith('.')) continue;
        const projectDir = path.join(root.dir, e.name);
        if (byName.has(e.name)) {
          const existing = byName.get(e.name);
          throw new Error(
            `Duplicate eval project id "${e.name}" found in multiple roots:\n` +
            `  ${existing.projectDir}\n` +
            `  ${projectDir}\n` +
            'Eval project ids must be unique across [[evals.roots]].'
          );
        }
        byName.set(e.name, { name: e.name, projectDir, root });
      }
    }
    return Array.from(byName.values());
  }

  function resolveEvalProject(name) {
    if (!name) return null;
    const roots = getEvalRoots();
    for (const root of roots) {
      const candidate = path.join(root.dir, name);
      if (fs.existsSync(candidate)) {
        return { name, projectDir: candidate, root };
      }
    }
    return null;
  }

  function resolveOrDefaultEvalProjectDir(name) {
    const hit = resolveEvalProject(name);
    if (hit) return hit.projectDir;
    return path.join(defaultEvalsDir(), name);
  }

  function listEvalProjectsHint() {
    let discovered;
    try {
      discovered = listAllEvalProjects();
    } catch (err) {
      console.error(err.message);
      process.exit(1);
    }
    if (discovered.length === 0) {
      console.error('No eval projects found. Create evals/<name>/REQUIREMENTS.md to get started.');
      process.exit(1);
    }
    console.error('\nMissing --project. Available eval projects:\n');
    for (const p of discovered) console.error(`  ${p.name}`);
    console.error(`\nRerun: gad species run --project ${discovered[0].name}`);
    process.exit(1);
  }

  return {
    getEvalRoots,
    defaultEvalsDir,
    listAllEvalProjects,
    resolveEvalProject,
    resolveOrDefaultEvalProjectDir,
    listEvalProjectsHint,
  };
}

module.exports = {
  parseProjectSpeciesRef,
  normalizeGenerationReference,
  formatGenerationPreserveCommand,
  buildSkillsProvenance,
  readIfExists,
  runtimeInstallHint,
  buildEvalPrompt,
  createEvalRootsHelpers,
};
