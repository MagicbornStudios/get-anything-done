'use strict';

const fs = require('fs');
const path = require('path');
const { defineCommand } = require('citty');

function createEvolutionShedCommand({ repoRoot, findRepoRoot, gadConfig, resolveRoots, readEvolutionScan, writeEvolutionScan, outputError, shouldUseJson }) {
  function shedOne(slug, reason) {
    const candidateDir = path.join(repoRoot, '.planning', 'candidates', slug);
    const shedDir = path.join(repoRoot, 'skills', '.shed');
    if (!fs.existsSync(candidateDir)) return { ok: false, reason: 'not-found', slug };
    if (!fs.existsSync(shedDir)) fs.mkdirSync(shedDir, { recursive: true });
    fs.writeFileSync(path.join(shedDir, slug), `${new Date().toISOString()}\n${reason}\n`);
    fs.rmSync(candidateDir, { recursive: true, force: true });
    return { ok: true, slug, marker: path.join(shedDir, slug) };
  }

  const evolutionShed = defineCommand({
    meta: { name: 'shed', description: 'Dry-run or confirm shedding of unused skills; legacy candidate shedding remains available behind --all/--obsolete/<slug>.' },
    args: {
      slug: { type: 'positional', description: 'Candidate slug (omit when using --all or --obsolete)', required: false, default: '' },
      confirm: { type: 'string', description: 'Archive the named canonical skill into .archive/skills/', default: '' },
      projectid: { type: 'string', description: 'Scope scan/readout to one project', default: '' },
      all: { type: 'boolean', description: 'Shed every candidate currently under .planning/candidates/', default: false },
      obsolete: { type: 'boolean', description: 'Shed only candidates flagged obsolete by sprint-window analysis (uses --threshold)', default: false },
      threshold: { type: 'string', description: 'Obsolete cutoff for --obsolete (default 0.65 with embeddings, 0.40 TF-IDF)', default: '' },
      embeddings: { type: 'boolean', description: 'Use embeddings backend for --obsolete (default TF-IDF)', default: false },
      reason: { type: 'string', description: 'Reason recorded in skills/.shed/<slug>', default: 'shed via cli' },
      dryRun: { type: 'boolean', description: 'Print what would be shed without doing it', default: false },
      json: { type: 'boolean', description: 'JSON output', default: false },
    },
    async run({ args }) {
      const useLegacyCandidateFlow = Boolean(args.slug || args.all || args.obsolete);
      if (!useLegacyCandidateFlow) {
        const baseDir = findRepoRoot();
        const config = gadConfig.load(baseDir);
        const roots = resolveRoots({ projectid: args.projectid }, baseDir, config.roots);
        if (roots.length === 0) return;
        const root = roots[0];
        const scan = readEvolutionScan(root, baseDir) || writeEvolutionScan(root, baseDir, repoRoot).scan;
        const flagged = Array.isArray(scan.shedCandidates) ? scan.shedCandidates : [];

        if (args.confirm) {
          const slug = String(args.confirm).trim();
          const skillDir = path.join(repoRoot, 'skills', slug);
          if (!fs.existsSync(skillDir)) {
            outputError(`Canonical skill not found: ${slug}`);
          }
          const archiveRoot = path.join(repoRoot, '.archive', 'skills');
          const archiveDir = path.join(archiveRoot, `${slug}-${new Date().toISOString().slice(0, 10)}`);
          fs.mkdirSync(archiveRoot, { recursive: true });
          fs.renameSync(skillDir, archiveDir);
          if (args.json || shouldUseJson()) {
            console.log(JSON.stringify({
              project: root.id,
              archived: slug,
              archiveDir: path.relative(repoRoot, archiveDir),
            }, null, 2));
            return;
          }
          console.log(`Shed skill: ${slug}`);
          console.log(`Archive: ${path.relative(repoRoot, archiveDir)}`);
          return;
        }

        if (args.json || shouldUseJson()) {
          console.log(JSON.stringify({
            project: root.id,
            dryRun: true,
            count: flagged.length,
            skills: flagged,
          }, null, 2));
          return;
        }

        console.log(`Evolution shed dry-run: ${flagged.length} skill(s) flagged`);
        if (flagged.length === 0) {
          console.log('  none');
          return;
        }
        for (const entry of flagged) {
          console.log(`  ${entry.id}${entry.type ? `  type=${entry.type}` : ''}`);
        }
        console.log('');
        console.log('Confirm one skill at a time:');
        console.log('  gad evolution shed --confirm <slug>');
        return;
      }

      const candidatesDir = path.join(repoRoot, '.planning', 'candidates');

      let targets = [];
      if (args.all) {
        targets = fs.existsSync(candidatesDir)
          ? fs.readdirSync(candidatesDir, { withFileTypes: true })
              .filter((e) => e.isDirectory()).map((e) => e.name)
          : [];
      } else if (args.obsolete) {
        const sim = require('../../../lib/similarity.cjs');
        const sprintDoc = sim.loadSprintCorpus(repoRoot, repoRoot);
        const candidateDocs = sim.loadCorpusFromDirs([
          { kind: 'candidate', root: candidatesDir },
        ]);
        const cutoff = args.threshold ? parseFloat(args.threshold) : (args.embeddings ? 0.65 : 0.40);
        let scores;
        if (args.embeddings) {
          const emb = require('../../../lib/embeddings.cjs');
          const modelId = emb.resolveModelId('');
          const [sv] = await emb.embedCorpus([sprintDoc], modelId, repoRoot);
          const cv = await emb.embedCorpus(candidateDocs, modelId, repoRoot);
          scores = candidateDocs.map((c, i) => ({ slug: c.id.split(':').pop(), score: emb.cosineSimDense(cv[i], sv) }));
        } else {
          const tf = sim.analyzeCorpus([...candidateDocs, sprintDoc], { threshold: 0 });
          const last = tf.matrix.length - 1;
          scores = candidateDocs.map((c, i) => ({ slug: c.id.split(':').pop(), score: tf.matrix[i][last] }));
        }
        targets = scores.filter((s) => s.score < cutoff).map((s) => s.slug);
        console.log(`[obsolete] cutoff=${cutoff.toFixed(2)} → ${targets.length}/${candidateDocs.length} candidates flagged`);
      } else if (args.slug) {
        targets = [args.slug];
      } else {
        console.error('Provide a slug, or use --all, or --obsolete.');
        process.exit(1);
      }

      if (targets.length === 0) {
        console.log('Nothing to shed.');
        return;
      }

      if (args.dryRun) {
        console.log(`[dry-run] would shed ${targets.length}:`);
        for (const s of targets) console.log(`  ${s}`);
        return;
      }

      const results = targets.map((slug) => shedOne(slug, args.reason));
      const ok = results.filter((r) => r.ok);
      const missing = results.filter((r) => !r.ok);
      console.log(`Shed: ${ok.length}/${targets.length}`);
      for (const r of ok) console.log(`  ${path.relative(repoRoot, path.join(repoRoot, '.planning', 'candidates', r.slug))}`);
      if (missing.length) {
        console.log('');
        console.log(`Not found: ${missing.length}`);
        for (const r of missing) console.log(`  ${r.slug}`);
      }
      console.log('');
      console.log(`Markers: ${path.relative(repoRoot, path.join(repoRoot, 'skills', '.shed'))}`);
      console.log('Self-eval will skip these slugs on future runs.');
    },
  });
  return evolutionShed;
}

module.exports = { createEvolutionShedCommand };