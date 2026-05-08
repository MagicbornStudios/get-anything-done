'use strict';
/**
 * gad handoffs — work-stealing queue (list / show / claim / claim-next /
 * complete / create / create-closeout).
 *
 * NOTE: gad.cjs still owns `buildHandoffsSection`, `printSection`, and
 * `resolveDetectedRuntimeId` because they're called from snapshot/sprint/
 * startup code paths in the monolith. Only the CLI command surface is
 * extracted here.
 *
 * Required deps:
 *   findRepoRoot, outputError, render, shouldUseJson, detectRuntimeIdentity
 */

const path = require('path');
const fs = require('fs');
const { defineCommand } = require('citty');

const {
  HandoffError,
  listHandoffs,
  readHandoff,
  claimHandoff,
  completeHandoff,
  unclaimHandoff,
  createHandoff,
} = require('../../lib/handoffs.cjs');

function createHandoffsCommand(deps) {
  const {
    findRepoRoot,
    outputError,
    render,
    shouldUseJson,
    detectRuntimeIdentity,
    gadConfig,
    resolveRoots,
  } = deps;

  function resolveTargetRoot(projectid) {
    const baseDir = findRepoRoot();
    if (!gadConfig || typeof gadConfig.load !== 'function' || typeof resolveRoots !== 'function') {
      return { baseDir, projectid: projectid || '' };
    }

    const config = gadConfig.load(baseDir);
    const roots = resolveRoots({ projectid: projectid || '' }, baseDir, config.roots);
    if (!Array.isArray(roots) || roots.length === 0) {
      return { baseDir, projectid: projectid || '' };
    }

    const root = roots[0];
    return {
      baseDir: path.resolve(baseDir, root.path || '.'),
      projectid: root.id || projectid || '',
    };
  }

  const handoffsListCmd = defineCommand({
    meta: { name: 'list', description: 'List handoffs (default: open bucket)' },
    args: {
      projectid: { type: 'string', description: 'Filter by project id', default: '' },
      unclaimed: { type: 'boolean', description: 'Show only open/unclaimed (default)', default: false },
      claimed: { type: 'boolean', description: 'Show claimed handoffs', default: false },
      closed: { type: 'boolean', description: 'Show closed handoffs', default: false },
      all: { type: 'boolean', description: 'Show all buckets', default: false },
      'mine-first': { type: 'boolean', description: 'Sort by runtime_preference match', default: false },
      json: { type: 'boolean', description: 'JSON output', default: false },
    },
    run({ args }) {
      const baseDir = findRepoRoot();
      let bucket = 'open';
      if (args.all) bucket = 'all';
      else if (args.claimed) bucket = 'claimed';
      else if (args.closed) bucket = 'closed';

      const results = listHandoffs({
        baseDir,
        bucket,
        projectid: args.projectid || undefined,
        mineFirst: args['mine-first'],
        runtime: process.env.GAD_AGENT || undefined,
      });

      const fmt = args.json ? 'json' : (shouldUseJson() ? 'json' : 'table');
      if (results.length === 0) {
        if (fmt === 'json') {
          console.log('[]');
        } else {
          console.log(`No handoffs in '${bucket}' bucket${args.projectid ? ` for ${args.projectid}` : ''}.`);
        }
        return;
      }

      if (fmt === 'json') {
        console.log(JSON.stringify(results.map(r => ({ ...r.frontmatter, bucket: r.bucket, filePath: r.filePath })), null, 2));
      } else {
        const rows = results.map(r => ({
          bucket: r.bucket,
          id: r.id,
          project: r.frontmatter.projectid || '',
          phase: r.frontmatter.phase || '',
          priority: r.frontmatter.priority || '',
          context: r.frontmatter.estimated_context || '',
          claimed_by: r.frontmatter.claimed_by || '',
          runtime: r.frontmatter.runtime_preference || '',
        }));
        console.log(render(rows, { format: 'table', title: `Handoffs — ${bucket} (${rows.length})` }));
      }
    },
  });

  const handoffsShowCmd = defineCommand({
    meta: { name: 'show', description: 'Print full content of a handoff file' },
    args: {
      id: { type: 'positional', description: 'Handoff id (e.g. h-2026-04-18-claude-orchestration-handoff)', required: true },
    },
    run({ args }) {
      const baseDir = findRepoRoot();
      try {
        const { frontmatter, body, bucket, filePath } = readHandoff({ baseDir, id: String(args.id) });
        console.log(`-- ${args.id} [${bucket}] ----`);
        console.log(`File: ${path.relative(baseDir, filePath)}`);
        console.log('');
        for (const [k, v] of Object.entries(frontmatter)) {
          console.log(`  ${k}: ${v}`);
        }
        console.log('');
        console.log(body);
      } catch (e) {
        if (e instanceof HandoffError) {
          outputError(e.message);
          process.exit(1);
        }
        throw e;
      }
    },
  });

  const handoffsClaimCmd = defineCommand({
    meta: { name: 'claim', description: 'Claim an open handoff (moves open→claimed)' },
    args: {
      id: { type: 'positional', description: 'Handoff id', required: true },
      agent: { type: 'string', description: 'Agent name to record as claimer', default: '' },
    },
    run({ args }) {
      const baseDir = findRepoRoot();
      try {
        const destPath = claimHandoff({
          baseDir,
          id: String(args.id),
          agent: args.agent || process.env.GAD_AGENT || 'unknown',
        });
        console.log(`Claimed: ${args.id}`);
        console.log(`Path:    ${path.relative(baseDir, destPath)}`);
      } catch (e) {
        if (e instanceof HandoffError) {
          outputError(e.message);
          process.exit(1);
        }
        throw e;
      }
    },
  });

  const handoffsCompleteCmd = defineCommand({
    meta: { name: 'complete', description: 'Mark a claimed handoff complete (moves claimed→closed)' },
    args: {
      id: { type: 'positional', description: 'Handoff id', required: true },
    },
    run({ args }) {
      const baseDir = findRepoRoot();
      try {
        const destPath = completeHandoff({ baseDir, id: String(args.id) });
        console.log(`Completed: ${args.id}`);
        console.log(`Path:      ${path.relative(baseDir, destPath)}`);
      } catch (e) {
        if (e instanceof HandoffError) {
          outputError(e.message);
          process.exit(1);
        }
        throw e;
      }
    },
  });

  const handoffsUnclaimCmd = defineCommand({
    meta: { name: 'unclaim', description: 'Return a claimed handoff to open (moves claimed→open)' },
    args: {
      id: { type: 'positional', description: 'Handoff id', required: true },
      reason: { type: 'string', description: 'Reason for unclaiming', default: '' },
      by: { type: 'string', description: 'Agent/runtime recording the unclaim', default: '' },
    },
    run({ args }) {
      const baseDir = findRepoRoot();
      try {
        const destPath = unclaimHandoff({
          baseDir,
          id: String(args.id),
          reason: args.reason || '',
          by: args.by || process.env.GAD_AGENT || '',
        });
        console.log(`Unclaimed: ${args.id}`);
        console.log(`Path:      ${path.relative(baseDir, destPath)}`);
      } catch (e) {
        if (e instanceof HandoffError) {
          outputError(e.message);
          process.exit(1);
        }
        throw e;
      }
    },
  });

  const handoffsClaimNextCmd = defineCommand({
    meta: {
      name: 'claim-next',
      description: 'Claim the best-matching open handoff for the current runtime. Respects runtime_preference + priority, then FIFO. Prints the handoff body so the caller can dispatch it.',
    },
    args: {
      runtime: { type: 'string', description: 'Override runtime detection (e.g. claude-code, codex, cursor). Defaults to detected runtime.', default: '' },
      agent: { type: 'string', description: 'Agent name to record as claimer (default: env GAD_AGENT or detected runtime)', default: '' },
      projectid: { type: 'string', description: 'Restrict to a single project id', default: '' },
      'max-priority': { type: 'string', description: 'Ignore handoffs above this priority (low|normal|high|critical)', default: 'critical' },
      'dry-run': { type: 'boolean', description: 'Show what would be claimed; do not claim', default: false },
      json: { type: 'boolean', description: 'Emit JSON { id, frontmatter, body, bucket }; no stdout chrome', default: false },
    },
    run({ args }) {
      const baseDir = findRepoRoot();
      const { sortHandoffsForPickup, isHandoffCompatible, priorityRank } = require('../../lib/agent-detect.cjs');
      const { loadGlobalFallbacks, isHandoffExhausted } = require('../../lib/team/rate-limit.cjs');
      const runtime = (args.runtime || detectRuntimeIdentity().id || process.env.GAD_AGENT || '').trim();
      if (!runtime || runtime === 'unknown') {
        outputError('Could not detect runtime. Pass --runtime <id> or set GAD_RUNTIME.');
        process.exit(1);
      }
      const maxRank = priorityRank(args['max-priority']);
      const all = listHandoffs({
        baseDir,
        bucket: 'open',
        projectid: args.projectid || undefined,
      });
      const globalFallbacks = loadGlobalFallbacks(baseDir);
      const compatible = all.filter((h) =>
        !isHandoffExhausted(h.frontmatter)
        && isHandoffCompatible(h.frontmatter, runtime)
        && priorityRank(h.frontmatter && h.frontmatter.priority) <= maxRank,
      );
      if (compatible.length === 0) {
        if (args.json) {
          console.log(JSON.stringify({ claimed: false, reason: 'no-match', runtime, total: all.length }));
        } else {
          console.log(`No open handoffs match runtime=${runtime} (total open: ${all.length}).`);
        }
        process.exit(all.length === 0 ? 0 : 2);
      }
      const sorted = sortHandoffsForPickup(compatible, runtime, { globalFallbacks });
      const pick = sorted[0];
      if (args['dry-run']) {
        if (args.json) {
          console.log(JSON.stringify({ claimed: false, dryRun: true, pick: { id: pick.id, frontmatter: pick.frontmatter } }));
        } else {
          console.log(`Would claim: ${pick.id} (priority=${pick.frontmatter.priority}, runtime_preference=${pick.frontmatter.runtime_preference || 'any'})`);
        }
        return;
      }
      try {
        const destPath = claimHandoff({
          baseDir,
          id: pick.id,
          agent: args.agent || process.env.GAD_AGENT || runtime,
          runtime,
        });
        const { body, frontmatter } = readHandoff({ baseDir, id: pick.id });
        if (args.json) {
          console.log(JSON.stringify({ claimed: true, id: pick.id, frontmatter, body, path: path.relative(baseDir, destPath) }));
          return;
        }
        console.log(`Claimed: ${pick.id}`);
        console.log(`Runtime: ${runtime} · priority: ${frontmatter.priority} · project: ${frontmatter.projectid}`);
        console.log(`Path:    ${path.relative(baseDir, destPath)}`);
        console.log('');
        console.log('-- handoff body --');
        console.log(body.trim());
        console.log('-- end --');
      } catch (e) {
        if (e instanceof HandoffError) {
          outputError(e.message);
          process.exit(1);
        }
        throw e;
      }
    },
  });

  // ---------------------------------------------------------------------------
  // Quality-gate helpers (decision GLOBAL-D-<auto>)
  // ---------------------------------------------------------------------------

  /** Allowed runtime values for --runtime-preference (no "any"). */
  const ALLOWED_RUNTIMES = ['claude-code', 'codex-cli', 'gemini-cli', 'opencode'];

  /**
   * Validate handoff intake contract.
   * Returns array of error strings; empty = valid.
   *
   * @param {{ taskId, runtimePreference, body, baseDir, projectid, noTask? }} opts
   *   noTask=true — caller has opted out of task-id; validation skips task-id check.
   */
  function validateHandoffIntake({ taskId, runtimePreference, body, baseDir, projectid, noTask }) {
    const errors = [];

    // 1. task-id: required unless --no-task was passed.
    //    Sentinel value '__no-task__' means the caller opted out.
    if (!noTask && taskId !== '__no-task__') {
      if (!taskId || !String(taskId).trim()) {
        errors.push('--task-id is required (must reference an existing task in .planning/tasks/). Pass --no-task to opt out.');
      } else {
        const taskFile = path.join(baseDir, '.planning', 'tasks', `${String(taskId).trim()}.json`);
        if (!fs.existsSync(taskFile)) {
          // Also check projectid-prefixed path for sub-projects
          const resolved = (projectid && projectid !== 'global')
            ? path.join(findRepoRoot(), '.planning', 'tasks', `${String(taskId).trim()}.json`)
            : taskFile;
          if (!fs.existsSync(resolved) && !fs.existsSync(taskFile)) {
            errors.push(`--task-id "${taskId}" not found in .planning/tasks/ (file: ${path.basename(taskFile)} missing)`);
          }
        }
      }
    }

    // 2. runtime-preference: required, must be one of ALLOWED_RUNTIMES.
    //    When --any-runtime is set, caller substitutes a valid runtime before calling us;
    //    validation sees a valid value and passes.
    if (!runtimePreference || !String(runtimePreference).trim()) {
      errors.push(`--runtime-preference is required (one of: ${ALLOWED_RUNTIMES.join(', ')}). Pass --any-runtime to opt out.`);
    } else if (!ALLOWED_RUNTIMES.includes(String(runtimePreference).trim())) {
      errors.push(`--runtime-preference "${runtimePreference}" is not allowed. Must be one of: ${ALLOWED_RUNTIMES.join(', ')}`);
    }

    // 3. body: must contain ## Acceptance gate OR ## Acceptance criteria (case-insensitive)
    if (!body || !String(body).trim()) {
      errors.push('body is empty');
    } else if (!/^##\s+(acceptance\s+gate|acceptance\s+criteria)\s*$/im.test(String(body))) {
      errors.push('body must contain a "## Acceptance gate" or "## Acceptance criteria" section (pass --quick to bypass all checks)');
    }

    return errors;
  }

  /**
   * Score a single handoff against the quality contract.
   * Returns { checks: { [name]: boolean }, score: number, grade: string, missing: string[] }
   */
  function scoreHandoff(frontmatter, body, baseDir) {
    const checks = {
      'has-task-id': false,
      'has-runtime-preference': false,
      'has-acceptance-section': false,
      'has-priority': false,
      'body-length-reasonable': false,
    };

    // has-task-id: frontmatter.task_id is non-null, non-empty, and file exists
    const rawTaskId = frontmatter.task_id;
    if (rawTaskId && rawTaskId !== 'null' && String(rawTaskId).trim()) {
      const taskFile = path.join(baseDir, '.planning', 'tasks', `${String(rawTaskId).trim()}.json`);
      checks['has-task-id'] = fs.existsSync(taskFile);
    }

    // has-runtime-preference: frontmatter.runtime_preference is one of ALLOWED_RUNTIMES
    const rp = frontmatter.runtime_preference;
    checks['has-runtime-preference'] = Boolean(rp && ALLOWED_RUNTIMES.includes(String(rp).trim()));

    // has-acceptance-section: body contains ## Acceptance gate|criteria
    checks['has-acceptance-section'] = Boolean(body && /^##\s+(acceptance\s+gate|acceptance\s+criteria)\s*$/im.test(String(body)));

    // has-priority: frontmatter.priority is a non-empty recognised value
    const validPriorities = ['low', 'normal', 'high', 'critical'];
    checks['has-priority'] = Boolean(frontmatter.priority && validPriorities.includes(String(frontmatter.priority).toLowerCase()));

    // body-length-reasonable: 50–3000 chars
    const bodyLen = body ? String(body).length : 0;
    checks['body-length-reasonable'] = bodyLen >= 50 && bodyLen <= 3000;

    const score = Object.values(checks).filter(Boolean).length;
    const gradeMap = { 5: 'A', 4: 'B', 3: 'C', 2: 'D', 1: 'E', 0: 'F' };
    const grade = gradeMap[score] || 'F';
    const missing = Object.entries(checks).filter(([, v]) => !v).map(([k]) => k);

    return { checks, score, grade, missing };
  }

  const handoffsCreateCmd = defineCommand({
    meta: { name: 'create', description: 'Create a new handoff in open/' },
    args: {
      projectid: { type: 'string', description: 'Project id (defaults to session / cwd scope)', default: '' },
      phase: { type: 'string', description: 'Phase id (e.g. 60)', required: true },
      'task-id': { type: 'string', description: 'Task id (REQUIRED unless --no-task — must exist in .planning/tasks/)', default: '' },
      'no-task': { type: 'boolean', description: 'Explicitly opt out of task-id requirement (logs a WARN)', default: false },
      priority: { type: 'string', description: 'low | normal | high', default: 'normal' },
      context: { type: 'string', description: 'prescribed | bounded | exploratory | design | audit | decision', default: 'prescribed' },
      risk: { type: 'string', description: 'safe | destructive | irreversible', default: 'safe' },
      time: { type: 'string', description: 'quick | standard | deep', default: 'standard' },
      surface: { type: 'string', description: 'local | api-bound | human-loop', default: 'local' },
      body: { type: 'string', description: 'Handoff body (markdown, MUST include ## Acceptance gate section)', required: true },
      'runtime-preference': { type: 'string', description: `REQUIRED: one of ${ALLOWED_RUNTIMES.join('|')}`, default: '' },
      'any-runtime': { type: 'boolean', description: 'Explicitly opt out of runtime-preference requirement (logs a WARN)', default: false },
      'runtime-fallbacks': { type: 'string', description: 'Comma-separated fallback runtimes override', default: '' },
      'runtime-required': { type: 'boolean', description: 'Treat runtime_preference as a hard requirement', default: false },
      'to-agent': { type: 'string', description: 'Direct this handoff to a specific agent slug from the presence ledger (e.g. gilgamesh-monorepo, dr-stein-slm-learning). When set the handoff appears in BOTH the recipient project snapshot AND that agent\'s session-open notice.', default: '' },
      quick: { type: 'boolean', description: 'Bypass all quality gate checks (logs a WARN; emergency use only)', default: false },
    },
    run({ args }) {
      const target = resolveTargetRoot(args.projectid);
      const runtimeFallbacks = String(args['runtime-fallbacks'] || '')
        .split(',')
        .map((value) => value.trim())
        .filter(Boolean);

      const body = String(args.body);
      const taskId = args['task-id'] || '';
      const runtimePreference = args['runtime-preference'] || '';

      // Quality gate — skip entirely on --quick; apply selective overrides otherwise.
      if (!args.quick) {
        // Build an effective task-id and runtime-pref for validation,
        // substituting sentinel values when bypass flags are set.
        const effectiveTaskId = args['no-task'] ? '__no-task__' : taskId;
        const effectiveRuntime = args['any-runtime'] ? ALLOWED_RUNTIMES[0] : runtimePreference;

        const errors = validateHandoffIntake({
          taskId: effectiveTaskId,
          runtimePreference: effectiveRuntime,
          body,
          baseDir: target.baseDir,
          projectid: String(args.projectid || target.projectid),
          noTask: args['no-task'],
        });
        if (errors.length > 0) {
          const hint = [
            args['no-task'] ? null : '  pass --no-task to opt out of task-id requirement',
            args['any-runtime'] ? null : '  pass --any-runtime to opt out of runtime-preference requirement',
            '  pass --quick to bypass all quality checks',
          ].filter(Boolean).join('\n');
          outputError(`Handoff quality gate FAILED:\n${errors.map((e) => `  - ${e}`).join('\n')}\n\nBypass options:\n${hint}`);
          process.exit(1);
        }

        // Emit WARNs for selective bypasses
        if (args['no-task']) {
          process.stderr.write(`WARN: --no-task — handoff created without a task-id reference (no audit link)\n`);
        }
        if (args['any-runtime']) {
          process.stderr.write(`WARN: --any-runtime — handoff created without a runtime-preference (any worker may claim it)\n`);
        }
      }

      try {
        if (body.length > 2000) {
          console.warn(`Warning: handoff body is ${body.length} characters. Consider using references instead of verbose inline content.`);
        }
        const result = createHandoff({
          baseDir: target.baseDir,
          projectid: String(args.projectid || target.projectid),
          phase: String(args.phase),
          taskId: taskId || undefined,
          priority: String(args.priority || 'normal'),
          estimatedContext: String(args.context || 'prescribed'),
          risk: String(args.risk || 'safe'),
          time: String(args.time || 'standard'),
          surface: String(args.surface || 'local'),
          body,
          createdBy: process.env.GAD_AGENT || 'unknown',
          runtimePreference: runtimePreference || undefined,
          runtimeFallbacks,
          runtimeRequired: args['runtime-required'] === true,
          toAgent: args['to-agent'] ? String(args['to-agent']).trim() : undefined,
        });

        if (args.quick) {
          process.stderr.write(`WARN: --quick bypass — handoff ${result.id} skipped quality gate\n`);
        }

        console.log(`Created: ${result.id}`);
        console.log(`Path:    ${path.relative(findRepoRoot(), result.filePath)}`);
      } catch (e) {
        if (e instanceof HandoffError) {
          outputError(e.message);
          process.exit(1);
        }
        throw e;
      }
    },
  });

  // ---------------------------------------------------------------------------
  // lint subcommand
  // ---------------------------------------------------------------------------

  const handoffsLintCmd = defineCommand({
    meta: { name: 'lint', description: 'Retroactively grade all handoffs in open/ + claimed/ against the quality contract' },
    args: {
      projectid: { type: 'string', description: 'Filter by project id', default: '' },
      json: { type: 'boolean', description: 'Emit JSON array instead of table', default: false },
    },
    run({ args }) {
      const baseDir = findRepoRoot();
      const { listHandoffs: _list, parseFrontmatter: _parse } = require('../../lib/handoffs.cjs');

      // Collect from open + claimed (not closed — already done)
      const allHandoffs = _list({ baseDir, bucket: 'all', projectid: args.projectid || undefined });

      if (allHandoffs.length === 0) {
        console.log(`No handoffs found${args.projectid ? ` for project ${args.projectid}` : ''}.`);
        return;
      }

      const results = allHandoffs.map((h) => {
        const text = fs.readFileSync(h.filePath, 'utf8');
        const { body } = _parse(text);
        const { score, grade, missing } = scoreHandoff(h.frontmatter, body, baseDir);
        return { id: h.id, bucket: h.bucket, grade, score, missing };
      });

      if (args.json || shouldUseJson()) {
        console.log(JSON.stringify(results, null, 2));
        return;
      }

      // Per-handoff lines
      for (const r of results) {
        const missingStr = r.missing.length > 0 ? r.missing.join(', ') : '(all checks pass)';
        console.log(`${r.id}  [${r.bucket}]  ${r.grade}  ${missingStr}`);
      }

      // Summary
      const gradeCounts = { A: 0, B: 0, C: 0, D: 0, E: 0, F: 0 };
      for (const r of results) gradeCounts[r.grade] = (gradeCounts[r.grade] || 0) + 1;
      const totalScore = results.reduce((s, r) => s + r.score, 0);
      const avgScore = (totalScore / results.length).toFixed(1);
      const gradeOrder = ['A', 'B', 'C', 'D', 'E', 'F'];
      const gradeAvgIdx = Math.min(Math.round((5 - parseFloat(avgScore))), 5);
      const avgGrade = gradeOrder[gradeAvgIdx] || 'F';

      const countStr = gradeOrder
        .filter((g) => gradeCounts[g] > 0)
        .map((g) => `${g}=${gradeCounts[g]}`)
        .join(' ');

      console.log('');
      console.log(`Project handoff-quality: ${countStr}  avg=${avgGrade} (${avgScore}/5)`);
    },
  });

  // ---------------------------------------------------------------------------
  // new subcommand — create a handoff from the canonical template
  // ---------------------------------------------------------------------------

  const handoffsNewCmd = defineCommand({
    meta: { name: 'new', description: 'Create a prefilled handoff from the handoff-template.md template' },
    args: {
      projectid: { type: 'string', description: 'Project id (required)', required: true },
      phase: { type: 'string', description: 'Phase id (required)', required: true },
      'task-id': { type: 'string', description: 'Task id — must exist in .planning/tasks/ (required)', required: true },
      'runtime-preference': { type: 'string', description: `REQUIRED: one of ${ALLOWED_RUNTIMES.join('|')}`, required: true },
      priority: { type: 'string', description: 'low | normal | high (default: normal)', default: 'normal' },
      body: { type: 'string', description: 'Optional: body text to use instead of the template skeleton', default: '' },
    },
    run({ args }) {
      const target = resolveTargetRoot(args.projectid);

      // Validate required args explicitly (citty required:true doesn't always exit cleanly)
      const missing = [];
      if (!args.projectid) missing.push('--projectid');
      if (!args.phase) missing.push('--phase');
      if (!args['task-id']) missing.push('--task-id');
      if (!args['runtime-preference']) missing.push('--runtime-preference');
      if (missing.length > 0) {
        outputError(`Missing required arguments: ${missing.join(', ')}`);
        process.exit(1);
      }

      // Validate runtime-preference
      const rp = String(args['runtime-preference']).trim();
      if (!ALLOWED_RUNTIMES.includes(rp)) {
        outputError(`--runtime-preference "${rp}" is not allowed. Must be one of: ${ALLOWED_RUNTIMES.join(', ')}`);
        process.exit(1);
      }

      // Validate priority
      const validPriorities = ['low', 'normal', 'high'];
      const priority = String(args.priority || 'normal').trim();
      if (!validPriorities.includes(priority)) {
        outputError(`--priority "${priority}" must be one of: ${validPriorities.join(', ')}`);
        process.exit(1);
      }

      // Load template and substitute placeholders
      const templatePath = path.join(__dirname, '..', '..', 'templates', 'handoff-template.md');
      if (!fs.existsSync(templatePath)) {
        outputError(`Template not found at: ${templatePath}`);
        process.exit(1);
      }

      const taskId = String(args['task-id']).trim();
      let body;

      if (args.body && String(args.body).trim()) {
        // Caller supplied explicit body — use it directly (drop-in for gad handoffs create)
        body = String(args.body).trim();
      } else {
        // Substitute template placeholders
        const raw = fs.readFileSync(templatePath, 'utf8');
        // Strip the YAML frontmatter block from the template — we don't include it in body
        const withoutFrontmatter = raw.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, '');
        body = withoutFrontmatter
          .replace(/\{\{task_id\}\}/g, taskId)
          .replace(/\{\{runtime_preference\}\}/g, rp)
          .replace(/\{\{priority\}\}/g, priority)
          .replace(/\{\{title\}\}/g, `(fill in title)`);
      }

      try {
        const result = createHandoff({
          baseDir: target.baseDir,
          projectid: String(args.projectid),
          phase: String(args.phase),
          taskId,
          priority,
          estimatedContext: 'bounded',
          body,
          createdBy: process.env.GAD_AGENT || 'unknown',
          runtimePreference: rp,
        });

        console.log(`Created: ${result.id}`);
        console.log(`Path:    ${path.relative(findRepoRoot(), result.filePath)}`);
        console.log('');
        console.log('Edit the handoff to fill in ## Acceptance gate and ## Why before dispatching.');
      } catch (e) {
        if (e instanceof HandoffError) {
          outputError(e.message);
          process.exit(1);
        }
        throw e;
      }
    },
  });

  const handoffsCreateCloseoutCmd = defineCommand({
    meta: {
      name: 'create-closeout',
      description:
        'Create a closeout handoff: evidence that a task in another lane was completed by you. Receiving lane sweeps + marks the task done in TASK-REGISTRY.',
    },
    args: {
      projectid: { type: 'string', description: 'Project id owning the task', required: true },
      phase: { type: 'string', description: 'Phase id (e.g. 44)', required: true },
      'task-id': { type: 'string', description: 'Task id being closed', required: true },
      commit: { type: 'string', description: 'Commit sha landing the work', required: true },
      files: { type: 'string', description: 'Comma-separated list of files touched', default: '' },
      resolution: { type: 'string', description: 'One-line human resolution', required: true },
      'runtime-preference': { type: 'string', description: 'Receiving lane runtime (the one that owns the task)', default: '' },
      priority: { type: 'string', description: 'low | normal | high', default: 'normal' },
    },
    run({ args }) {
      const target = resolveTargetRoot(args.projectid);
      const files = String(args.files || '')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);

      const body = [
        '## Closeout evidence',
        '',
        `- **Task:** \`${args['task-id']}\` (project: ${args.projectid}, phase: ${args.phase})`,
        `- **Commit:** \`${args.commit}\``,
        files.length > 0 ? `- **Files:**\n${files.map((f) => `  - \`${f}\``).join('\n')}` : '- **Files:** (none listed)',
        `- **Resolution:** ${args.resolution}`,
        '',
        '## Receiving-lane action',
        '',
        `Verify the commit exists and touches the listed files, then update \`${args.projectid}/.planning/TASK-REGISTRY.xml\` for task \`${args['task-id']}\`:`,
        '- `status="done"`',
        `- add/update attribution attributes pointing to commit \`${args.commit}\``,
        '',
        `Then complete this handoff: \`gad handoffs complete <this-id>\`.`,
      ].join('\n');

      try {
        const result = createHandoff({
          baseDir: target.baseDir,
          projectid: String(args.projectid),
          phase: String(args.phase),
          taskId: String(args['task-id']),
          priority: String(args.priority || 'normal'),
          estimatedContext: 'prescribed',
          body,
          createdBy: process.env.GAD_AGENT || detectRuntimeIdentity().id || 'unknown',
          runtimePreference: args['runtime-preference'] || undefined,
        });

        try {
          const text = fs.readFileSync(result.filePath, 'utf8');
          const headerMatch = text.match(/^(---\r?\n[\s\S]*?\r?\n---\r?\n)([\s\S]*)$/);
          if (headerMatch) {
            const header = headerMatch[1];
            const rest = headerMatch[2];
            const extra = `type: closeout\ncloseout_commit: ${args.commit}\ncloseout_files: ${files.join(';')}\n`;
            const updated = header.replace(/\r?\n---\r?\n$/, (m) => `\n${extra.trimEnd()}\n---\n`) + rest;
            fs.writeFileSync(result.filePath, updated);
          }
        } catch (e) { /* non-fatal; body already has the evidence */ }

        console.log(`Created closeout: ${result.id}`);
        console.log(`Task:    ${args['task-id']} (${args.projectid}:${args.phase})`);
        console.log(`Commit:  ${args.commit}`);
        console.log(`Path:    ${path.relative(findRepoRoot(), result.filePath)}`);
        console.log('');
        console.log(`Receiving lane sweep: \`gad handoffs list --projectid ${args.projectid}\``);
      } catch (e) {
        if (e instanceof HandoffError) {
          outputError(e.message);
          process.exit(1);
        }
        throw e;
      }
    },
  });

  return defineCommand({
    meta: { name: 'handoffs', description: 'Work-stealing handoff queue — list, show, claim, claim-next, unclaim, complete, create, create-closeout, lint, new' },
    subCommands: {
      list: handoffsListCmd,
      show: handoffsShowCmd,
      claim: handoffsClaimCmd,
      'claim-next': handoffsClaimNextCmd,
      unclaim: handoffsUnclaimCmd,
      complete: handoffsCompleteCmd,
      create: handoffsCreateCmd,
      'create-closeout': handoffsCreateCloseoutCmd,
      lint: handoffsLintCmd,
      new: handoffsNewCmd,
    },
  });
}

module.exports = { createHandoffsCommand };
module.exports.register = (ctx) => ({ handoffs: createHandoffsCommand(ctx.common) });
