'use strict';
/**
 * snapshot/handoff.cjs — `gad snapshot --handoff <id>` handler.
 *
 * Produces a single pipe-able prompt block:
 *   1. Snapshot orientation (state + roadmap + tasks for inferred projectid)
 *   2. ## Loaded skills section with matched SKILL.md bodies inlined verbatim
 *   3. ## Handoff section with the handoff body verbatim
 *
 * Used by lib/team/subprocess.cjs to feed `gad snapshot --handoff <id> | runtime`
 * so codex/gemini/opencode runtimes (which have no native skill-registry) get
 * skill orientation as plain stdin text via the same code path as claude-code.
 *
 * Skill-load events log to .planning/.gad-log/<date>-skill-loads.jsonl with
 * { ts, runtime, worker, handoff_id, slug, projectid, match_reason }.
 *
 * No --no-side-effects: skill-load logging respects the flag — when
 * suppressed, the prompt still emits but the .gad-log entry is skipped.
 */

const fs = require('fs');
const path = require('path');
const { readHandoff } = require('../../../lib/handoffs.cjs');
const {
  matchRelevantSkills,
  defaultSkillRoots,
} = require('../../../lib/skills/relevance-match.cjs');

function appendJsonl(filePath, obj) {
  try {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.appendFileSync(filePath, `${JSON.stringify(obj)}\n`, 'utf8');
  } catch {
    // best-effort; never let logging break the prompt
  }
}

function logSkillLoad({ baseDir, projectid, runtime, worker, handoffId, skill, suppressed }) {
  if (suppressed) return;
  const day = new Date().toISOString().slice(0, 10);
  const file = path.join(baseDir, '.planning', '.gad-log', `${day}-skill-loads.jsonl`);
  appendJsonl(file, {
    ts: new Date().toISOString(),
    runtime: runtime || null,
    worker: worker || null,
    handoff_id: handoffId,
    slug: skill.slug,
    projectid: projectid || null,
    match_reason: skill.match_reason || null,
    source: skill.source || null,
    score: skill.score || null,
  });
}

function readPhaseTitle(planDir, phaseId) {
  if (!phaseId) return '';
  const roadmapPath = path.join(planDir, 'ROADMAP.xml');
  if (!fs.existsSync(roadmapPath)) return '';
  let xml = '';
  try { xml = fs.readFileSync(roadmapPath, 'utf8'); } catch { return ''; }
  const re = new RegExp(`<phase\\s+id="${phaseId}"[^>]*>([\\s\\S]*?)<\\/phase>`, 'i');
  const m = xml.match(re);
  if (!m) return '';
  const goalMatch = m[1].match(/<goal>([\s\S]*?)<\/goal>/i);
  return goalMatch ? goalMatch[1].trim().slice(0, 300) : '';
}

function readTaskGoal(planDir, taskId) {
  if (!taskId) return '';
  const taskPath = path.join(planDir, 'tasks', `${taskId}.json`);
  if (!fs.existsSync(taskPath)) return '';
  try {
    const json = JSON.parse(fs.readFileSync(taskPath, 'utf8'));
    return String(json.goal || '').slice(0, 400);
  } catch { return ''; }
}

function emitSkillsSection(matched) {
  const lines = [];
  lines.push('## Loaded skills');
  lines.push('');
  if (matched.length === 0) {
    lines.push('(no skills matched — runtime falls back to AGENTS.md / project CLAUDE.md only)');
    lines.push('');
    return lines.join('\n');
  }
  lines.push(`The following ${matched.length} skill(s) were auto-loaded for this handoff. Read them as orientation BEFORE editing.`);
  lines.push('');
  for (const skill of matched) {
    lines.push(`### Skill: ${skill.slug}  _(${skill.source}, score=${skill.score}, ${skill.match_reason || 'n/a'})_`);
    lines.push('');
    // Inline verbatim — the body already has internal headings; we keep
    // them so codex/gemini sees the original formatting.
    lines.push(skill.raw.trimEnd());
    lines.push('');
    lines.push('---');
    lines.push('');
  }
  return lines.join('\n');
}

function emitHandoffSection(handoffId, frontmatter, body) {
  const lines = [];
  lines.push('## Handoff');
  lines.push('');
  lines.push(`**Handoff ID:** ${handoffId}`);
  if (frontmatter.projectid) lines.push(`**Project:** ${frontmatter.projectid}`);
  if (frontmatter.phase) lines.push(`**Phase:** ${frontmatter.phase}`);
  if (frontmatter.task_id) lines.push(`**Task:** ${frontmatter.task_id}`);
  if (frontmatter.runtime_preference) lines.push(`**Runtime preference:** ${frontmatter.runtime_preference}`);
  lines.push('');
  lines.push(body || '(handoff body empty)');
  lines.push('');
  return lines.join('\n');
}

/**
 * Main entry. Called from createSnapshotCommand when args.handoff is set.
 *
 * @param {object} commandDeps  — snapshot command's bound deps
 * @param {object} args         — citty args
 * @param {object} extras
 * @param {function} extras.runSprintForOrientation — fn that emits the
 *        sprint orientation lines (state/roadmap/tasks) to console.log
 *        after we've resolved the handoff and overridden args.projectid.
 */
function handleHandoffSnapshot({ commandDeps, args, baseDir, runOrientation }) {
  const handoffId = args.handoff;
  let handoff;
  try {
    handoff = readHandoff({ baseDir, id: handoffId });
  } catch (err) {
    console.error(`gad snapshot --handoff: ${err.message}`);
    process.exit(1);
    return;
  }
  const fm = handoff.frontmatter || {};
  const projectid = fm.projectid || args.projectid || args.project || '';
  if (!projectid) {
    console.error(`gad snapshot --handoff: handoff ${handoffId} has no projectid; pass --projectid explicitly.`);
    process.exit(1);
    return;
  }

  // Override projectid + scope to the handoff's phase, ensure side-effects
  // are suppressed so worker dispatch doesn't churn session state.
  args.projectid = projectid;
  if (!args.phaseid) args.phaseid = fm.phase || '';
  args['no-side-effects'] = true;

  // Resolve project root details for skill scanning + phase/task lookup.
  const baseConfig = commandDeps.gadConfig.load(baseDir);
  const root = baseConfig.roots.find((r) => r.id === projectid);
  const planDir = root ? path.join(baseDir, root.path, root.planningDir) : null;

  const phaseTitle = planDir ? readPhaseTitle(planDir, fm.phase) : '';
  const taskGoal = planDir ? readTaskGoal(planDir, fm.task_id) : '';

  const repoRoot = commandDeps.repoRoot;
  const skillRoots = defaultSkillRoots({ repoRoot, baseDir });
  const matched = matchRelevantSkills({
    handoffFrontmatter: fm,
    handoffBody: handoff.body,
    phaseTitle,
    taskGoal,
    skillRoots,
    limit: 8,
  });

  // Header — single banner identifying this prompt as a handoff prompt.
  console.log(`# gad snapshot --handoff ${handoffId}`);
  console.log('');
  console.log('You are receiving a unified handoff prompt: project orientation + auto-loaded skill bodies + the handoff itself. Read all three sections; act on the handoff section.');
  console.log('');

  // Orientation block (sprint snapshot for the project).
  console.log('## Orientation');
  console.log('');
  try {
    runOrientation();
  } catch (err) {
    console.log(`(orientation render failed: ${err.message})`);
  }
  console.log('');

  // Skills block.
  console.log(emitSkillsSection(matched));

  // Handoff body block.
  console.log(emitHandoffSection(handoffId, fm, handoff.body));

  // Footer — invocation hints for the runtime.
  console.log('---');
  console.log('');
  console.log('Discipline:');
  console.log('- Run `gad snapshot --terse` only if you need a fresh active state.');
  console.log('- Stamp completion via `gad tasks stamp <id> --status done` and `gad handoffs complete <handoff-id>`.');
  console.log('- Commit each cohesive edit immediately (parallel-agent hygiene).');

  // Fire skill-load logs after stdout to keep prompt fully emitted first.
  const runtime = String(args.runtime || commandDeps.resolveDetectedRuntimeId() || '').trim();
  const worker = String(process.env.GAD_TEAM_WORKER_ID || '').trim() || null;
  const suppressed = !!process.env.GAD_NO_SKILL_LOAD;
  for (const skill of matched) {
    logSkillLoad({
      baseDir,
      projectid,
      runtime,
      worker,
      handoffId,
      skill,
      suppressed,
    });
  }
}

module.exports = {
  handleHandoffSnapshot,
  emitSkillsSection,
  emitHandoffSection,
  readPhaseTitle,
  readTaskGoal,
};
