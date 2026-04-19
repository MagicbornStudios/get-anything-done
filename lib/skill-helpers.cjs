// Skill / evolution-scan helpers extracted from bin/gad.cjs.
// Pure utilities that read the filesystem; require side-effect knobs
// (sideEffectsSuppressed) and a few injected deps for portability.

const fs = require('fs');
const path = require('path');

const {
  parseFrontmatter: parseSkillFrontmatter,
  extractBodyRefs,
} = require('./skill-linter.cjs');
const {
  collectAttributions,
  buildUsageReport,
  discoverSkillIds,
  SENTINEL_SKILL_VALUES,
} = require('./skill-usage-stats.cjs');
const gadConfig = require('../bin/gad-config.cjs');
const { readTasks } = require('./task-registry-reader.cjs');

function splitCsvList(raw, fallback = []) {
  if (!raw || typeof raw !== 'string') return fallback;
  return raw
    .split(',')
    .map((s) => String(s || '').trim().toLowerCase())
    .filter(Boolean);
}

function listSkillDirs(rootDir) {
  if (!fs.existsSync(rootDir)) return [];
  const out = [];
  for (const entry of fs.readdirSync(rootDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const skillDir = path.join(rootDir, entry.name);
    const skillFile = path.join(skillDir, 'SKILL.md');
    if (!fs.existsSync(skillFile)) continue;
    out.push({ id: entry.name, dir: skillDir, skillFile });
  }
  return out.sort((a, b) => a.id.localeCompare(b.id));
}

function readSkillFrontmatter(skillFile) {
  let src = '';
  try { src = fs.readFileSync(skillFile, 'utf8'); }
  catch { return { name: null, description: null, workflow: null }; }
  const parsed = parseSkillFrontmatter(src);
  if (!parsed.hasFrontmatter) return { name: null, description: null, workflow: null };
  const fields = parsed.fields || {};
  return {
    ...fields,
    name: fields.name || null,
    description: fields.description || null,
    workflow: fields.workflow || null,
  };
}

function normalizeSkillLaneValues(value) {
  const raw = Array.isArray(value) ? value : (value ? [value] : []);
  return raw
    .map((entry) => String(entry || '').trim().toLowerCase())
    .filter(Boolean);
}

function skillMatchesLane(frontmatter, lane) {
  if (!lane) return true;
  return normalizeSkillLaneValues(frontmatter.lane).includes(lane);
}

function severityRank(severity) {
  if (severity === 'error') return 3;
  if (severity === 'warning') return 2;
  return 1;
}

function filterIssuesBySeverity(issues, minimumSeverity) {
  const min = minimumSeverity ? severityRank(minimumSeverity) : 0;
  if (!min) return issues.slice();
  return issues.filter((issue) => severityRank(issue.severity) >= min);
}

function resolveSkillWorkflowPath(repoRoot, skillDir, workflowRef) {
  if (!workflowRef) return null;
  const isSibling = workflowRef.startsWith('./') || workflowRef.startsWith('../');
  return isSibling
    ? path.resolve(skillDir, workflowRef)
    : path.resolve(repoRoot, workflowRef);
}

function buildSkillUsageIndex(baseDir, finalSkillsDir) {
  const config = gadConfig.load(baseDir);
  const knownSkills = discoverSkillIds(finalSkillsDir);
  const attributions = collectAttributions(config, baseDir);
  const usageReport = buildUsageReport(attributions, knownSkills);
  return {
    report: usageReport,
    bySkill: new Map((usageReport.bySkill || []).map((entry) => [entry.skill, entry])),
  };
}

function readSkillSource(skillFile) {
  try {
    const raw = fs.readFileSync(skillFile, 'utf8');
    const parsed = parseSkillFrontmatter(raw);
    const bodyStart = parsed.hasFrontmatter ? (parsed.frontmatterEnd + 1) : 0;
    const body = (parsed.rawLines || raw.split(/\r?\n/)).slice(bodyStart).join('\n');
    return { raw, body, frontmatter: parsed.fields || {} };
  } catch {
    return { raw: '', body: '', frontmatter: {} };
  }
}

function skillReferencesId(source, skillId) {
  if (!source || !skillId) return false;
  if (String(source.parent_skill || '').trim() === skillId) return true;
  const refs = extractBodyRefs(source.body || '');
  return refs.some((ref) => ref.kind === 'alias' && ref.ref === `@skills/${skillId}`);
}

function findReferencedSkillIds(skillRecords) {
  const referenced = new Set();
  for (const record of skillRecords) {
    for (const candidate of skillRecords) {
      if (record.id === candidate.id) continue;
      if (skillReferencesId(record.source, candidate.id)) referenced.add(candidate.id);
    }
  }
  return referenced;
}

function listCandidateDirs(repoRoot) {
  const candidatesDir = path.join(repoRoot, '.planning', 'candidates');
  if (!fs.existsSync(candidatesDir)) return [];
  return fs.readdirSync(candidatesDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
}

function buildEvolutionScan(root, baseDir, repoRoot, { resolveSkillRoots }) {
  const { finalSkillsDir } = resolveSkillRoots(repoRoot);
  const skillRecords = listSkillDirs(finalSkillsDir).map((entry) => ({
    ...entry,
    frontmatter: readSkillFrontmatter(entry.skillFile),
    source: readSkillSource(entry.skillFile),
  }));
  const { report, bySkill } = buildSkillUsageIndex(baseDir, finalSkillsDir);
  const referencedSkillIds = findReferencedSkillIds(skillRecords);
  const existingCandidates = listCandidateDirs(repoRoot);

  const tasks = readTasks(root, baseDir, {});
  const groupedByPhase = new Map();
  for (const task of tasks) {
    const phaseId = String(task.phase || task.id.split('-')[0] || '').trim();
    if (!phaseId) continue;
    const list = groupedByPhase.get(phaseId) || [];
    list.push(task);
    groupedByPhase.set(phaseId, list);
  }
  const phaseSignals = [];
  for (const [phaseId, phaseTasks] of groupedByPhase.entries()) {
    const doneTasks = phaseTasks.filter((task) => task.status === 'done');
    if (doneTasks.length < 2) continue;
    const realSkills = new Set(
      doneTasks
        .flatMap((task) => String(task.skill || '').split(',').map((value) => value.trim()).filter(Boolean))
        .filter((value) => !SENTINEL_SKILL_VALUES.has(value.toLowerCase()))
    );
    if (realSkills.size <= 1) {
      phaseSignals.push({
        id: `phase-${phaseId}-repeated-work`,
        phase: phaseId,
        reason: `${doneTasks.length} done tasks, ${realSkills.size} real attributed skills`,
      });
    }
  }

  const shedCandidates = skillRecords
    .filter((record) => {
      const type = String(record.frontmatter.type || '').trim().toLowerCase();
      if (type === 'meta-framework') return false;
      if (referencedSkillIds.has(record.id)) return false;
      const usage = bySkill.get(record.id);
      return !usage || usage.runs === 0;
    })
    .map((record) => ({
      id: record.id,
      type: record.frontmatter.type || '',
      lane: normalizeSkillLaneValues(record.frontmatter.lane),
      reason: 'unused, unreferenced, and not meta-framework',
    }))
    .sort((a, b) => a.id.localeCompare(b.id));

  return {
    scannedAt: new Date().toISOString(),
    projectid: root.id,
    candidates: [
      ...existingCandidates.map((id) => ({ id, source: 'existing-candidate-dir' })),
      ...phaseSignals.map((signal) => ({ ...signal, source: 'phase-signal' })),
    ],
    shedCandidates,
    usageSummary: {
      totalRuns: report.totalRuns,
      uniqueSkillsUsed: report.uniqueSkillsUsed,
      unusedSkills: report.unused.length,
      attributedButMissing: report.attributedButMissing.length,
    },
  };
}

function evolutionScanFilePath(root, baseDir) {
  return path.join(baseDir, root.path, root.planningDir, '.evolution-scan.json');
}

function writeEvolutionScan(root, baseDir, repoRoot, deps) {
  if (deps.sideEffectsSuppressed && deps.sideEffectsSuppressed()) {
    return { scan: null, filePath: evolutionScanFilePath(root, baseDir) };
  }
  const scan = buildEvolutionScan(root, baseDir, repoRoot, deps);
  const filePath = evolutionScanFilePath(root, baseDir);
  fs.writeFileSync(filePath, `${JSON.stringify(scan, null, 2)}\n`, 'utf8');
  return { scan, filePath };
}

function readEvolutionScan(root, baseDir) {
  const filePath = evolutionScanFilePath(root, baseDir);
  if (!fs.existsSync(filePath)) return null;
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return null;
  }
}

module.exports = {
  splitCsvList,
  listSkillDirs,
  readSkillFrontmatter,
  normalizeSkillLaneValues,
  skillMatchesLane,
  severityRank,
  filterIssuesBySeverity,
  resolveSkillWorkflowPath,
  buildSkillUsageIndex,
  readSkillSource,
  skillReferencesId,
  findReferencedSkillIds,
  listCandidateDirs,
  buildEvolutionScan,
  evolutionScanFilePath,
  writeEvolutionScan,
  readEvolutionScan,
};
