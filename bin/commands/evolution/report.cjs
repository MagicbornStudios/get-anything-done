'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const { defineCommand } = require('citty');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Parse <level value xp xp_to_next loaded_skills/> from STATE.xml */
function readLevel(stateXmlPath) {
  if (!fs.existsSync(stateXmlPath)) return { value: 1, xp: 0, xpToNext: 100, loadedSkills: 0 };
  const xml = fs.readFileSync(stateXmlPath, 'utf8');
  const m = xml.match(/<level\s+value="(\d+)"\s+xp="(\d+)"\s+xp_to_next="(\d+)"\s+loaded_skills="(\d+)"\/?>/);
  if (m) {
    return {
      value: parseInt(m[1], 10),
      xp: parseInt(m[2], 10),
      xpToNext: parseInt(m[3], 10),
      loadedSkills: parseInt(m[4], 10),
    };
  }
  return { value: 1, xp: 0, xpToNext: 100, loadedSkills: 0 };
}

/** Count stamped tasks in STATE.xml <stamped-tasks> block */
function countStampedTasks(stateXmlPath) {
  if (!fs.existsSync(stateXmlPath)) return 0;
  const xml = fs.readFileSync(stateXmlPath, 'utf8');
  const m = xml.match(/<stamped-tasks>([\s\S]*?)<\/stamped-tasks>/);
  if (!m) return 0;
  return m[1].trim().split(/\s+/).filter(Boolean).length;
}

/** ASCII progress bar — same █░ chars as reference */
function progressBar(xp, xpToNext, width = 16) {
  const pct = xpToNext > 0 ? Math.min(1, xp / xpToNext) : 0;
  const filled = Math.round(pct * width);
  const bar = '█'.repeat(filled) + '░'.repeat(width - filled);
  return { bar, pct: Math.round(pct * 100) };
}

/** Auto-increment evolution NN from existing files in evolutionsDir */
function nextCycleNumber(evolutionsDir) {
  if (!fs.existsSync(evolutionsDir)) return 1;
  const files = fs.readdirSync(evolutionsDir).filter((f) => f.endsWith('.md') && !f.startsWith('.'));
  let max = 0;
  for (const f of files) {
    const m = f.match(/evolution-(\d+)\.md$/);
    if (m) max = Math.max(max, parseInt(m[1], 10));
  }
  return max + 1;
}

/** Read SKILL.md frontmatter + PROVENANCE.md for slug info */
function readProtoSkillMeta(protoSkillsDir, slug) {
  const skillPath = path.join(protoSkillsDir, slug, 'SKILL.md');
  const provPath  = path.join(protoSkillsDir, slug, 'PROVENANCE.md');

  let name = slug;
  let triggerReason = '—';

  // Parse SKILL.md frontmatter
  if (fs.existsSync(skillPath)) {
    const raw = fs.readFileSync(skillPath, 'utf8');
    const fm = raw.match(/^---\r?\n([\s\S]*?)\r?\n---/);
    if (fm) {
      const nameM = fm[1].match(/^name:\s*(.+)$/m);
      if (nameM) name = nameM[1].trim();
      const descM = fm[1].match(/^description:\s*[>|]?\s*\n?(.*)/ms);
      if (descM) triggerReason = descM[1].trim().replace(/\s+/g, ' ').slice(0, 80);
    }
  }

  // PROVENANCE.md often has a cleaner one-liner trigger
  if (fs.existsSync(provPath)) {
    const raw = fs.readFileSync(provPath, 'utf8');
    const fm = raw.match(/^---\r?\n([\s\S]*?)\r?\n---/);
    if (fm) {
      // Use the source_phase + candidate_slug to infer a trigger from the body text
      const body = raw.slice(raw.indexOf('---', 3) + 3).trim();
      const firstLine = body.split('\n').find((l) => l.trim().length > 0);
      if (firstLine) {
        // Trim "Proto-skill drafted from ... " preamble
        const cleaned = firstLine
          .replace(/^Proto-skill drafted from.*?during evolution cycle following phase \d+\.\s*/i, '')
          .replace(/^Source candidate shows\s*/i, '')
          .trim();
        if (cleaned.length > 0 && cleaned.length < 120) {
          triggerReason = cleaned.slice(0, 100);
        }
      }
    }
  }

  return { slug, name, triggerReason };
}

/** Check if a slug is loadable in .claude/skills/<slug>/SKILL.md */
function claudeLoadable(repoRoot, slug) {
  const localPath = path.join(repoRoot, '.claude', 'skills', slug, 'SKILL.md');
  const globalPath = path.join(os.homedir(), '.claude', 'skills', slug, 'SKILL.md');
  return fs.existsSync(localPath) || fs.existsSync(globalPath);
}

/** Count loadable proto-skills for claude runtime */
function countClaudeLoadable(repoRoot, slugs) {
  return slugs.filter((s) => claudeLoadable(repoRoot, s)).length;
}

/** Read pressure from cache or compute live */
function readPressure(projectid, repoRoot) {
  const cachePath = path.join(os.homedir(), '.cache', 'gad', `pressure-${projectid}.json`);
  if (fs.existsSync(cachePath)) {
    try {
      return JSON.parse(fs.readFileSync(cachePath, 'utf8'));
    } catch { /* fall through */ }
  }
  // Try to compute live
  try {
    const { computePressure } = require('../../../lib/entropy/compute.cjs');
    return computePressure(projectid, { baseDir: repoRoot });
  } catch {
    return null;
  }
}

/** Read worker status files from .planning/team/workers/ */
function readTeamHealth(planDir) {
  const workersDir = path.join(planDir, 'team', 'workers');
  if (!fs.existsSync(workersDir)) return [];
  const workers = [];
  for (const id of fs.readdirSync(workersDir)) {
    const statusFile = path.join(workersDir, id, 'status.json');
    if (!fs.existsSync(statusFile)) continue;
    try {
      const s = JSON.parse(fs.readFileSync(statusFile, 'utf8'));
      workers.push(s);
    } catch { /* skip */ }
  }
  return workers;
}

/** Count handoffs in open/claimed/closed dirs */
function countHandoffs(planDir) {
  function countDir(dir) {
    if (!fs.existsSync(dir)) return 0;
    try { return fs.readdirSync(dir).filter((f) => f.endsWith('.md')).length; } catch { return 0; }
  }
  return {
    open:    countDir(path.join(planDir, 'handoffs', 'open')),
    claimed: countDir(path.join(planDir, 'handoffs', 'claimed')),
    closed:  countDir(path.join(planDir, 'handoffs', 'closed')),
  };
}

/** Read dispatcher PID file */
function readDispatcher(planDir) {
  const pidFile = path.join(planDir, 'team', 'dispatcher.pid');
  if (!fs.existsSync(pidFile)) return null;
  try { return JSON.parse(fs.readFileSync(pidFile, 'utf8')); } catch { return null; }
}

/** Get top-5 planned phases from ROADMAP.xml */
function getPlannedPhases(planDir) {
  const roadmapPath = path.join(planDir, 'ROADMAP.xml');
  if (!fs.existsSync(roadmapPath)) return [];
  const xml = fs.readFileSync(roadmapPath, 'utf8');
  const matches = [...xml.matchAll(/<phase id="(\d+)"[^>]*>([\s\S]*?)<\/phase>/g)];
  const planned = matches
    .filter((m) => m[2].includes('<status>planned</status>'))
    .slice(0, 5)
    .map((m) => {
      const goalM = m[2].match(/<goal>([\s\S]*?)<\/goal>/);
      const titleM = m[2].match(/<title>([\s\S]*?)<\/title>/);
      const goal = goalM ? goalM[1].trim().replace(/\s+/g, ' ') : '';
      const title = titleM ? titleM[1].trim() : '';
      const label = (title || goal).slice(0, 70);
      return { id: m[1], label };
    });
  return planned;
}

/** Build the full markdown report */
function buildReport({ projectid, cycleId, repoRoot, planDir, evolutionsDir, protoSkillsDir }) {
  const now = new Date();
  const generatedAt = now.toISOString();
  const dateStr = now.toISOString().slice(0, 10);

  // Level
  const stateXmlPath = path.join(planDir, 'STATE.xml');
  const level = readLevel(stateXmlPath);
  const stampedCount = countStampedTasks(stateXmlPath);
  const { bar, pct } = progressBar(level.xp, level.xpToNext);

  // Proto-skills
  const protoSlugs = fs.existsSync(protoSkillsDir)
    ? fs.readdirSync(protoSkillsDir, { withFileTypes: true })
        .filter((e) => e.isDirectory())
        .map((e) => e.name)
    : [];

  const protoMetas = protoSlugs.map((slug) => readProtoSkillMeta(protoSkillsDir, slug));
  const claudeLoadableCount = countClaudeLoadable(repoRoot, protoSlugs);

  // Candidates dir
  const candidatesDir = path.join(planDir, 'candidates');
  const candidates = fs.existsSync(candidatesDir)
    ? fs.readdirSync(candidatesDir, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name)
    : [];

  // Cross-reference candidates with proto-skills
  const candidateRows = candidates.map((c) => ({
    slug: c,
    status: protoSlugs.includes(c) ? 'drafted (proto-skill exists)' : 'pending — not yet drafted',
  }));

  // Pressure
  const pressure = readPressure(projectid, repoRoot);

  // Handoffs
  const handoffs = countHandoffs(planDir);

  // Team
  const workers = readTeamHealth(planDir);
  const dispatcher = readDispatcher(planDir);

  // Planned phases
  const plannedPhases = getPlannedPhases(planDir);

  // XP math
  const xpNeeded = Math.max(0, level.xpToNext - level.xp);

  // ─── Build markdown ───────────────────────────────────────────────────────

  const lines = [];

  // Frontmatter
  lines.push('---');
  lines.push(`projectid: ${projectid}`);
  lines.push(`cycle: ${cycleId}`);
  lines.push(`generated_at: ${generatedAt}`);
  lines.push(`generated_by: gad evolution report`);
  lines.push(`schema: evolution-summary/v0`);
  lines.push('---');
  lines.push('');

  // Title
  lines.push(`# Evolution Summary — ${projectid} @ ${dateStr}`);
  lines.push('');
  lines.push('> Game-screen view of this project\'s evolution cycle.');
  lines.push('> Generated by `gad evolution report`.');
  lines.push('');

  // Level block
  lines.push('## Level');
  lines.push('');
  lines.push('```');
  lines.push(
    `LEVEL  ${level.value}          XP  ${level.xp} / ${level.xpToNext}         [${bar}] ${pct}%`,
  );
  lines.push(`                                        +${xpNeeded} XP to LEVEL ${level.value + 1}`);
  lines.push('```');
  lines.push('');
  lines.push(`- Stamped tasks contributing XP since cycle start: ${stampedCount}`);
  lines.push(`- Last level-up: never (still on first level milestone)`);
  lines.push('');

  // Skills — drafted
  lines.push('## Skills');
  lines.push('');
  lines.push(`### + Drafted this cycle (${protoSlugs.length} proto-skills carried in \`.planning/proto-skills/\`)`);
  lines.push('');
  lines.push('| # | Slug | Trigger reason |');
  lines.push('|---|---|---|');
  protoMetas.forEach((m, i) => {
    lines.push(`| ${i + 1} | \`${m.slug}\` | ${m.triggerReason} |`);
  });
  lines.push('');

  // Auto-loadable matrix
  lines.push('### Auto-loadable status (per runtime load-skill path)');
  lines.push('');
  lines.push('| Runtime | Path | Loadable? |');
  lines.push('|---|---|---|');
  lines.push(
    `| claude-code | \`.claude/skills/<slug>/SKILL.md\` | **${claudeLoadableCount === protoSlugs.length && protoSlugs.length > 0 ? 'YES' : claudeLoadableCount > 0 ? 'PARTIAL' : 'NO'}** (${claudeLoadableCount}/${protoSlugs.length} copied this cycle) |`,
  );
  lines.push('| codex-cli | codex skills dir (TBD) | **NO** — gap, addressed in 107-08 |');
  lines.push('| gemini-cli | gemini skills dir (TBD) | **NO** — gap, addressed in 107-08 |');
  lines.push('| opencode | opencode skills dir (TBD) | **NO** — gap, addressed in 107-08 |');
  lines.push('| cursor | `.cursor/skills/<slug>/` | **NO** — gap, but cursor is OUT (memory) |');
  lines.push('');

  // Shed / promoted
  lines.push('### − Shed (none this cycle)');
  lines.push('');
  lines.push('Run `gad evolution shed --projectid ' + projectid + ' --dry-run` to surface candidates. None confirmed-shed yet — operator policy is shed-from-trace not shed-from-snapshot.');
  lines.push('');
  lines.push('### Promoted to permanent skills (none this cycle)');
  lines.push('');
  lines.push('By policy: promotion happens from trace evidence, not as part of evolution close. Drafted proto-skills sit in `.planning/proto-skills/` until trace data justifies promotion.');
  lines.push('');

  // Candidates
  lines.push('## Candidates carried forward');
  lines.push('');
  if (candidateRows.length === 0) {
    lines.push('No candidates in `.planning/candidates/` this cycle.');
  } else {
    lines.push(`${candidateRows.length} candidate(s) surfaced into \`.planning/candidates/\`:`);
    lines.push('');
    lines.push('| Slug | Status |');
    lines.push('|---|---|');
    for (const c of candidateRows) {
      lines.push(`| \`${c.slug}\` | ${c.status} |`);
    }
  }
  lines.push('');

  // Pressure
  lines.push('## Pressure breakdown');
  lines.push('');
  if (pressure && pressure.score != null) {
    lines.push('```');
    lines.push(`score          ${pressure.score.toFixed(2).padEnd(6)} / 1.0        (composite, normalized)`);
    lines.push(`top_phase      ${String(pressure.top_phase).padEnd(15)} (see ROADMAP.xml)`);
    lines.push(`top_phase_score ${pressure.top_phase_score != null ? pressure.top_phase_score.toFixed(3) : '0.000'}`);
    lines.push('```');
    lines.push('');
    lines.push('| Bucket | Value | Interpretation |');
    lines.push('|---|---|---|');
    const bd = pressure.breakdown || {};
    lines.push(`| rate_limits | ${bd.rate_limits ?? 0} | ${(bd.rate_limits ?? 0) > 100 ? 'HIGH — rate storms detected' : (bd.rate_limits ?? 0) > 20 ? 'ELEVATED' : 'normal'} |`);
    lines.push(`| open_handoffs | ${bd.open_handoffs ?? handoffs.open} | ${(bd.open_handoffs ?? handoffs.open) > 20 ? 'high queue depth' : 'normal queue depth'} |`);
    lines.push(`| handoffs_with_unclaims | ${bd.handoffs_with_unclaims ?? 0} | ${(bd.handoffs_with_unclaims ?? 0) > 0 ? 'workers struggling to pick up' : 'clean'} |`);
    lines.push(`| worker_failures | ${bd.worker_failures ?? 0} | ${(bd.worker_failures ?? 0) > 0 ? 'non-zero exit codes' : 'clean'} |`);
    lines.push(`| errors_recent | ${bd.errors_recent ?? 0} | ${(bd.errors_recent ?? 0) > 10 ? 'elevated background errors' : 'normal background'} |`);
    lines.push(`| errors_open | ${bd.errors_open ?? 0} | ${(bd.errors_open ?? 0) > 0 ? 'unfixed structural pain' : 'clean'} |`);
  } else {
    lines.push('_Pressure data unavailable — run `gad evolution scan --projectid ' + projectid + '` to populate._');
  }
  lines.push('');

  // Team health
  lines.push('## Team / dispatcher health');
  lines.push('');
  lines.push('| Metric | Value | Note |');
  lines.push('|---|---|---|');
  const configuredCount = workers.length;
  const workerIds = workers.map((w) => w.id).join('/');
  lines.push(`| Workers configured | ${configuredCount} (${workerIds}) | from .planning/team/config.json |`);
  const alive = workers.filter((w) => w.state && w.state !== 'STOPPED');
  lines.push(`| Workers alive | ${alive.length} | ${alive.map((w) => `${w.id}=${w.state}`).join(', ') || 'none'} |`);
  const dispStatus = dispatcher
    ? `UP (pid=${dispatcher.pid})`
    : 'UNKNOWN — no dispatcher.pid';
  lines.push(`| Dispatcher | ${dispStatus} | check .planning/team/dispatcher.log.jsonl |`);
  lines.push(`| Open handoffs | ${handoffs.open} | |`);
  lines.push(`| Claimed handoffs | ${handoffs.claimed} | |`);
  lines.push(`| Closed handoffs (lifetime) | ${handoffs.closed} | |`);
  lines.push('');

  // Trace queries
  lines.push('## Trace queries to run later (review checkpoint)');
  lines.push('');
  lines.push('Per memory `feedback_evolution_review_instructions.md`, skill quality is judged by trace, not review. Run these against `.planning/.gad-log/*.jsonl` + task-stamp attribution after enough usage:');
  lines.push('');
  lines.push('| Question | Query |');
  lines.push('|---|---|');
  lines.push('| Which proto-skills are getting invoked? | `gad log show --skill <slug> --since 7d` |');
  lines.push('| Which correlate with task closeout? | cross-ref `.gad-log` skill-load events with `STATE.xml` `<stamped-tasks>` deltas |');
  lines.push('| Negative correlation (load-then-fail)? | `gad log show --skill <slug> --grep "error\\|failed"` |');
  lines.push('| Self-eval score on trajectories that loaded the skill | `gad self-eval --filter-skill <slug>` |');
  lines.push('');

  // Gaps
  lines.push('## Gaps surfaced this cycle (drove the next phase plans)');
  lines.push('');
  if (plannedPhases.length > 0) {
    plannedPhases.forEach((p, i) => {
      lines.push(`${i + 1}. **Phase ${p.id}** — ${p.label}`);
    });
  } else {
    lines.push('No planned phases found in ROADMAP.xml.');
  }
  if (handoffs.open > 20) {
    lines.push(`${plannedPhases.length + 1}. **Open handoff backlog** — ${handoffs.open} open handoffs; workers may need scaling or new runtime accounts.`);
  }
  lines.push('');

  // Forecast
  lines.push('## "What we level up next"');
  lines.push('');
  lines.push('| To unlock | Need |');
  lines.push('|---|---|');
  lines.push(
    `| LEVEL ${level.value + 1} | +${xpNeeded} XP — drain the ${handoffs.open} open + ${handoffs.claimed} claimed handoffs (mix of impl + plan tasks) |`,
  );
  lines.push(
    `| Pressure → 0 | Close open handoffs + address rate-limit rotation if elevated |`,
  );
  lines.push(
    `| Auto-evolution loop | 107-08 (auto-loadability) + 107-09 (summary CLI ✓ shipped) + 131 (dispatcher hardening) |`,
  );
  lines.push('');
  lines.push('---');
  lines.push('');
  lines.push(`*Generated by \`gad evolution report --projectid ${projectid}\` at ${generatedAt}.*`);

  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Command factory
// ---------------------------------------------------------------------------

function createEvolutionReportCommand(deps) {
  const { repoRoot, evolutionPaths, findRepoRoot, gadConfig, resolveRoots, outputError } = deps;

  return defineCommand({
    meta: { name: 'report', description: 'Write a game-screen evolution summary to .planning/.evolutions/<ts>-evolution-NN.md' },
    args: {
      projectid: { type: 'string', description: 'Target project ID', default: '' },
      stdout:    { type: 'boolean', description: 'Print to stdout instead of writing file', default: false },
      'cycle-id': { type: 'string', description: 'Override auto-numbered cycle id (e.g. evolution-03)', default: '' },
    },
    run({ args }) {
      // Resolve project root
      const baseDir = findRepoRoot ? findRepoRoot() : repoRoot;
      let planDir;
      let projectid = args.projectid;

      if (gadConfig && resolveRoots) {
        const config = gadConfig.load(baseDir);
        const roots = resolveRoots({ projectid }, baseDir, config.roots);
        if (roots.length === 0) {
          if (outputError) outputError('No project resolved. Pass --projectid <id>.');
          else console.error('No project resolved. Pass --projectid <id>.');
          process.exit(1);
          return;
        }
        const root = roots[0];
        projectid = root.id;
        planDir = path.join(baseDir, root.path, root.planningDir);
      } else {
        // Fallback: assume baseDir is repo root, planDir is .planning/
        planDir = path.join(baseDir, '.planning');
        if (!projectid) projectid = 'unknown';
      }

      const { evolutionsDir, protoSkillsDir } = evolutionPaths(baseDir);

      // Auto-increment cycle number
      const nn = nextCycleNumber(evolutionsDir);
      const cycleId = args['cycle-id'] || `evolution-${String(nn).padStart(2, '0')}`;

      const report = buildReport({
        projectid,
        cycleId,
        repoRoot: baseDir,
        planDir,
        evolutionsDir,
        protoSkillsDir,
      });

      if (args.stdout) {
        process.stdout.write(report + '\n');
        return;
      }

      // Write file
      fs.mkdirSync(evolutionsDir, { recursive: true });
      const datePrefix = new Date().toISOString().slice(0, 10);
      const filename = `${datePrefix}-${cycleId}.md`;
      const outPath = path.join(evolutionsDir, filename);
      fs.writeFileSync(outPath, report + '\n');
      console.log(`Evolution report written → ${outPath}`);
    },
  });
}

module.exports = { createEvolutionReportCommand };
