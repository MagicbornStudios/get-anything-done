'use strict';
/**
 * Preserved-generation preview + human review surfaces.
 *
 *   - servePreservedGenerationBuildArtifact: serves a preserved build artifact
 *     directory (HTML bundle) over HTTP. Used by `gad generation open` and
 *     `gad play`.
 *   - evalOpen: `gad generation open` command (and `eval open` alias).
 *   - evalReview: `gad generation review` command — submit human review
 *     score, supports legacy --score and structured --rubric (phase 27 track 1).
 *
 * Required deps:
 *   resolveOrDefaultEvalProjectDir, outputError, findRepoRoot, loadAllResolvedSpecies.
 */

const fs = require('fs');
const path = require('path');
const { defineCommand } = require('citty');

function createEvalPreviewSurfaces(deps) {
  const { resolveOrDefaultEvalProjectDir, outputError, findRepoRoot, loadAllResolvedSpecies } = deps;

  /**
   * Serve a preserved generation **build artifact** (HTML/JS/CSS under a directory with index.html).
   * Not the GAD planning/landing Next app — that is `gad site serve` only (decision gad-225).
   * Uses `lib/static-http-serve.cjs` (not `site-compile.cjs`) so this path does not load the site pipeline.
   */
  function servePreservedGenerationBuildArtifact({ project, version: versionArg, logPrefix, noBrowser }) {
    const projectDir = resolveOrDefaultEvalProjectDir(project);

    if (!fs.existsSync(projectDir)) {
      outputError(`Eval project not found: ${project}`);
      return;
    }

    let version = versionArg;
    if (!version) {
      const versions = fs.readdirSync(projectDir).filter((n) => /^v\d+$/.test(n)).sort((a, b) => parseInt(a.slice(1)) - parseInt(b.slice(1)));
      version = versions[versions.length - 1] || '';
    }

    if (!version) {
      outputError(`No runs found for ${project}`);
      return;
    }

    const repoRoot = findRepoRoot();
    const candidates = [
      path.join(repoRoot, 'apps', 'portfolio', 'public', 'evals', project, version, 'index.html'),
      path.join(projectDir, version, 'game', 'dist', 'index.html'),
      path.join(projectDir, version, 'dist', 'index.html'),
      path.join(projectDir, version, 'build', 'index.html'),
      path.join(projectDir, version, 'index.html'),
      path.join(repoRoot, 'apps', 'portfolio', 'public', 'evals', project, 'index.html'),
    ];

    let found = null;
    for (const c of candidates) {
      if (fs.existsSync(c)) { found = c; break; }
    }

    if (!found) {
      console.log(`No preserved build artifact (index.html) found for ${project} ${version}`);
      console.log('Checked:');
      for (const c of candidates) console.log(`  ${path.relative(process.cwd(), c)}`);
      return;
    }

    const serveDir = path.dirname(path.resolve(found));
    const { serveStatic } = require('../../lib/static-http-serve.cjs');
    const { exec } = require('child_process');

    const port = 4173 + Math.floor(Math.random() * 500);
    const host = '127.0.0.1';
    const previewUrl = `http://${host}:${port}/`;

    console.log(`${logPrefix} preserved generation build artifact (HTML bundle — not \`gad site serve\`)`);
    console.log(`${logPrefix} artifact root: ${path.relative(process.cwd(), serveDir)}`);

    let opened = false;
    const openBrowser = () => {
      if (noBrowser) return;
      if (opened) return;
      opened = true;
      const isWin = process.platform === 'win32';
      const cmd = isWin ? `start "" "${previewUrl}"` : (process.platform === 'darwin' ? `open "${previewUrl}"` : `xdg-open "${previewUrl}"`);
      exec(cmd);
    };

    const server = serveStatic({
      rootDir: serveDir,
      port,
      host,
      logPrefix,
      onListening: () => { openBrowser(); },
    });

    if (noBrowser) {
      console.log(`${logPrefix} --no-browser: embed this preview URL in an iframe (e.g. editor generation preview):`);
      console.log(`${logPrefix} ${previewUrl}`);
    }

    console.log(`\n${logPrefix} Press Ctrl+C to stop the server.`);
    process.on('SIGINT', () => {
      try { server.close(() => process.exit(0)); } catch { process.exit(0); }
    });
  }

  const evalOpen = defineCommand({
    meta: {
      name: 'open',
      description:
        'HTTP preview of a preserved **generation build artifact** (directory with index.html). Not the GAD planning/marketing site (`gad site serve`). Use `--no-browser` to print the preview URL for an editor iframe.',
    },
    args: {
      project: { type: 'positional', description: 'Eval project name (or project/species for nested ids)', required: true },
      version: { type: 'positional', description: 'Version (default: latest)', default: '' },
      noBrowser: {
        type: 'boolean',
        description: 'Do not open a system browser; print the preview URL only (e.g. for iframe embedding in the editor).',
        default: false,
      },
    },
    run({ args }) {
      const noBrowser = args.noBrowser === true || args['no-browser'] === true;
      servePreservedGenerationBuildArtifact({
        project: args.project,
        version: args.version,
        logPrefix: '[gad generation open]',
        noBrowser,
      });
    },
  });

  const evalReview = defineCommand({
    meta: { name: 'review', description: 'Submit human review score for an eval run — single score or rubric JSON (phase 27 track 1)' },
    args: {
      project: { type: 'positional', description: 'Eval project name', required: true },
      version: { type: 'positional', description: 'Version (e.g. v5)', required: true },
      score: { type: 'string', description: 'Legacy single score 0.0-1.0 (use --rubric for structured)', default: '' },
      rubric: { type: 'string', description: 'Rubric JSON: {"playability":0.8,"ui_polish":0.7,...}', default: '' },
      notes: { type: 'string', description: 'Review notes', default: '' },
      reviewer: { type: 'string', description: 'Reviewer id (default: human)', default: 'human' },
    },
    run({ args }) {
      const projectDir = resolveOrDefaultEvalProjectDir(args.project);
      const runDir = path.join(projectDir, args.version);
      const traceFile = path.join(runDir, 'TRACE.json');

      if (!fs.existsSync(traceFile)) {
        outputError(`No TRACE.json found at evals/${args.project}/${args.version}/`);
        return;
      }

      if (!args.score && !args.rubric) {
        outputError('Either --score (legacy) or --rubric <json> (structured) is required');
        return;
      }

      const trace = JSON.parse(fs.readFileSync(traceFile, 'utf8'));

      if (args.rubric) {
        let parsed;
        try { parsed = JSON.parse(args.rubric); }
        catch (err) {
          outputError(`--rubric must be valid JSON: ${err.message}`);
          return;
        }

        // Load project's declared rubric dimensions. Walk resolved species
        // for the first that declares a humanReviewRubric. Decision gad-184.
        let rubricDef = null;
        try {
          const resolved = loadAllResolvedSpecies(projectDir);
          for (const sp of resolved) {
            if (!sp) continue;
            if (sp.humanReviewRubric && Array.isArray(sp.humanReviewRubric.dimensions)) {
              rubricDef = sp.humanReviewRubric;
              break;
            }
          }
        } catch (err) {
          outputError(`Failed to resolve species for project ${args.project}: ${err.message}`);
          return;
        }
        if (!rubricDef || !Array.isArray(rubricDef.dimensions)) {
          outputError(`Project ${args.project} has no humanReviewRubric in project.json or any species.json. Add one or use --score for legacy mode.`);
          return;
        }

        const dimensions = {};
        let sum = 0;
        let totalWeight = 0;
        const errors = [];
        for (const d of rubricDef.dimensions) {
          const rawScore = parsed[d.key];
          if (rawScore == null) {
            errors.push(`missing dimension: ${d.key}`);
            continue;
          }
          const n = typeof rawScore === 'number' ? rawScore : parseFloat(rawScore);
          if (isNaN(n) || n < 0 || n > 1) {
            errors.push(`${d.key} out of range [0, 1]: ${rawScore}`);
            continue;
          }
          const dimNotes = parsed[`${d.key}_notes`] ?? null;
          dimensions[d.key] = { score: n, notes: dimNotes };
          sum += n * d.weight;
          totalWeight += d.weight;
        }
        if (errors.length > 0) {
          outputError(`Rubric validation failed:\n  ${errors.join('\n  ')}`);
          return;
        }

        const aggregate = totalWeight > 0 ? +(sum / totalWeight).toFixed(4) : null;

        trace.human_review = {
          rubric_version: rubricDef.version || 'v1',
          dimensions,
          aggregate_score: aggregate,
          notes: args.notes || null,
          reviewed_by: args.reviewer,
          reviewed_at: new Date().toISOString(),
        };

        const s = trace.scores || {};
        s.human_review = aggregate;
        trace.scores = s;

        fs.writeFileSync(traceFile, JSON.stringify(trace, null, 2));

        console.log(`\n✓ Rubric review saved: ${args.project} ${args.version}`);
        console.log(`  Aggregate: ${aggregate}`);
        console.log(`  Dimensions:`);
        for (const d of rubricDef.dimensions) {
          const dim = dimensions[d.key];
          console.log(`    ${d.label.padEnd(30)} ${dim.score.toFixed(2)}  (weight ${d.weight.toFixed(2)})`);
        }
        return;
      }

      const scoreVal = parseFloat(args.score);
      if (isNaN(scoreVal) || scoreVal < 0 || scoreVal > 1) {
        outputError('Score must be between 0.0 and 1.0');
        return;
      }

      trace.human_review = {
        score: scoreVal,
        notes: args.notes || null,
        reviewed_by: args.reviewer,
        reviewed_at: new Date().toISOString(),
      };

      const s = trace.scores || {};
      s.human_review = scoreVal;
      if (s.requirement_coverage != null && s.planning_quality != null && s.per_task_discipline != null && s.skill_accuracy != null && s.time_efficiency != null) {
        s.composite = (s.requirement_coverage * 0.15) + (s.planning_quality * 0.15) + (s.per_task_discipline * 0.15) + (s.skill_accuracy * 0.10) + (s.time_efficiency * 0.05) + (scoreVal * 0.30);
        if (scoreVal < 0.10) s.composite = Math.min(s.composite, 0.25);
        else if (scoreVal < 0.20) s.composite = Math.min(s.composite, 0.40);
        s.auto_composite = null;
      }
      trace.scores = s;

      fs.writeFileSync(traceFile, JSON.stringify(trace, null, 2));

      const scoresFile = path.join(runDir, 'scores.json');
      if (fs.existsSync(scoresFile)) {
        try {
          const sd = JSON.parse(fs.readFileSync(scoresFile, 'utf8'));
          sd.dimensions = sd.dimensions || {};
          sd.dimensions.human_review = scoreVal;
          sd.human_reviewed = true;
          if (s.composite != null) sd.composite = s.composite;
          fs.writeFileSync(scoresFile, JSON.stringify(sd, null, 2));
        } catch {}
      }

      console.log(`Human review recorded: ${args.project} ${args.version}`);
      console.log(`  Score: ${scoreVal}`);
      if (args.notes) console.log(`  Notes: ${args.notes}`);
      if (s.composite != null) console.log(`  New composite: ${s.composite.toFixed(3)} (with human review)`);
    },
  });

  return { servePreservedGenerationBuildArtifact, evalOpen, evalReview };
}

module.exports = { createEvalPreviewSurfaces };
