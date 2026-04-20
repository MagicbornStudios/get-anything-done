'use strict';

const { defineCommand } = require('citty');
const path = require('path');

function createEvolutionSimilarityCommand({ repoRoot }) {
  const evolutionSimilarity = defineCommand({
    meta: { name: 'similarity', description: 'Compute semantic similarity matrix across candidates + proto-skills (offline, no API)' },
    args: {
      threshold: { type: 'string', description: 'Flag pairs with score >= threshold (default 0.6)', default: '0.6' },
      shedThreshold: { type: 'string', description: 'Flag candidates stale vs promoted skills above this score (default 0.55)', default: '0.55' },
      includePromoted: { type: 'boolean', description: 'Include promoted skills/ in the main matrix (default: only shedding-compare)', default: false },
      against: { type: 'string', description: 'Reference corpus for shedding: "skills" (promoted skills — HIGH = redundant) or "sprint" (current sprint trajectory — LOW = obsolete)', default: 'skills' },
      obsoleteThreshold: { type: 'string', description: 'With --against sprint, flag candidates BELOW this score as obsolete (default 0.40 TF-IDF / 0.65 embeddings)', default: '' },
      embeddings: { type: 'boolean', description: 'Use transformers.js embeddings instead of TF-IDF (requires `gad models install`)', default: false },
      model: { type: 'string', description: 'Embedding model id or tag (e.g. minilm, bge-small) — default Xenova/all-MiniLM-L6-v2', default: '' },
      json: { type: 'boolean', description: 'Emit JSON instead of markdown report', default: false },
    },
    async run({ args }) {
      const sim = require('../../../lib/similarity.cjs');
      const threshold = parseFloat(args.threshold);
      const shedThreshold = parseFloat(args.shedThreshold);
      const useSprint = args.against === 'sprint';
      const obsoleteDefault = args.embeddings ? 0.65 : 0.40;
      const obsoleteThreshold = args.obsoleteThreshold ? parseFloat(args.obsoleteThreshold) : obsoleteDefault;

      const candidateDocs = sim.loadCorpusFromDirs([
        { kind: 'candidate', root: path.join(repoRoot, '.planning', 'candidates') },
        { kind: 'proto',     root: path.join(repoRoot, '.planning', 'proto-skills') },
      ]);
      const promotedDocs = sim.loadCorpusFromDirs([
        { kind: 'skill', root: path.join(repoRoot, 'skills') },
      ]).filter((d) => !d.id.includes('/candidates/') && !d.id.includes('/.evolutions/'));

      const sprintDoc = useSprint ? sim.loadSprintCorpus(repoRoot, repoRoot) : null;

      const mainDocs = args.includePromoted ? [...candidateDocs, ...promotedDocs] : candidateDocs;

      let analysis, shed;
      if (args.embeddings) {
        const emb = require('../../../lib/embeddings.cjs');
        const modelId = emb.resolveModelId(args.model);
        console.error(`[embeddings] model=${modelId}`);
        console.error(`[embeddings] encoding ${mainDocs.length} docs...`);
        try {
          const vectors = await emb.embedCorpus(mainDocs, modelId, repoRoot, (i, n) => {
            if (i % 5 === 0 || i === n) console.error(`[embeddings]   ${i}/${n}`);
          });
          analysis = emb.analyzeEmbeddingCorpus(mainDocs, vectors, { threshold });
          console.error(`[embeddings] encoding ${promotedDocs.length} promoted skills for shedding...`);
          const promotedVecs = await emb.embedCorpus(promotedDocs, modelId, repoRoot);
          const candVecStart = 0;
          const shedResults = [];
          for (let i = 0; i < candidateDocs.length; i++) {
            const cv = vectors[candVecStart + i];
            let best = { id: null, score: 0 };
            for (let j = 0; j < promotedDocs.length; j++) {
              const score = emb.cosineSimDense(cv, promotedVecs[j]);
              if (score > best.score) best = { id: promotedDocs[j].id, score };
            }
            shedResults.push({
              candidate: candidateDocs[i].id,
              bestMatch: best.id,
              score: best.score,
              cosine: best.score,
              jaccard: 0,
              stale: best.score >= shedThreshold,
            });
          }
          shedResults.sort((a, b) => b.score - a.score);
          shed = { results: shedResults, threshold: shedThreshold };
          const tfidfRef = sim.analyzeCorpus(mainDocs, { threshold: 0 });
          const pairIndex = new Map();
          for (const p of tfidfRef.pairs) pairIndex.set(`${p.a}||${p.b}`, p);
          analysis.pairs = analysis.pairs.map((p) => {
            const tf = pairIndex.get(`${p.a}||${p.b}`) || pairIndex.get(`${p.b}||${p.a}`);
            return {
              ...p,
              cosine: p.score,
              jaccard: 0,
              uniqueInA: tf?.uniqueInA || [],
              uniqueInB: tf?.uniqueInB || [],
              sharedFiles: tf?.sharedFiles || [],
            };
          });
        } catch (err) {
          if (err.code === 'TRANSFORMERS_MISSING') {
            console.error(err.message);
            process.exit(2);
          }
          throw err;
        }
      } else {
        analysis = sim.analyzeCorpus(mainDocs, { threshold });
        shed = sim.analyzeShedding(candidateDocs, promotedDocs, { threshold: shedThreshold });
      }

      let obsolete = null;
      if (useSprint && sprintDoc && sprintDoc.text.trim()) {
        if (args.embeddings) {
          const emb = require('../../../lib/embeddings.cjs');
          const modelId = emb.resolveModelId(args.model);
          console.error(`[embeddings] encoding sprint corpus...`);
          const [sprintVec] = await emb.embedCorpus([sprintDoc], modelId, repoRoot);
          console.error(`[embeddings] scoring ${candidateDocs.length} candidates vs sprint...`);
          const candVecs = await emb.embedCorpus(candidateDocs, modelId, repoRoot);
          const rows = candidateDocs.map((c, i) => {
            const score = emb.cosineSimDense(candVecs[i], sprintVec);
            return { candidate: c.id, score, obsolete: score < obsoleteThreshold };
          });
          rows.sort((a, b) => a.score - b.score);
          obsolete = { threshold: obsoleteThreshold, results: rows };
        } else {
          const all = [...candidateDocs, sprintDoc];
          const tf = sim.analyzeCorpus(all, { threshold: 0 });
          const sprintIdx = all.length - 1;
          const rows = candidateDocs.map((c, i) => ({
            candidate: c.id,
            score: tf.matrix[i][sprintIdx],
            obsolete: tf.matrix[i][sprintIdx] < obsoleteThreshold,
          }));
          rows.sort((a, b) => a.score - b.score);
          obsolete = { threshold: obsoleteThreshold, results: rows };
        }
      }

      if (args.json) {
        console.log(JSON.stringify({
          docCount: analysis.docCount,
          threshold: analysis.threshold,
          pairs: analysis.pairs,
          matrix: analysis.matrix,
          ids: analysis.ids,
          shedding: shed,
        }, null, 2));
        return;
      }

      const pathMap = sim.buildPathMap([...candidateDocs, ...promotedDocs]);
      const cwd = process.cwd();

      console.log(`# Similarity analysis — ${analysis.docCount} docs, threshold ${threshold.toFixed(2)}`);
      if (args.embeddings) {
        console.log('');
        console.log('Backend: embeddings (Xenova/all-MiniLM-L6-v2 by default).');
        console.log('Note: embedding scores run ~0.15-0.25 higher than TF-IDF on the same');
        console.log('corpus because the model captures topical prior ("GAD framework prose")');
        console.log('as baseline similarity. Suggested thresholds with --embeddings:');
        console.log('  merge-candidate:  --threshold 0.80   (vs 0.60 for TF-IDF)');
        console.log('  stale-shed:       --shedThreshold 0.75   (vs 0.55 for TF-IDF)');
      }
      console.log('');
      console.log('## Flagged pairs (score >= threshold)');
      if (analysis.pairs.length === 0) {
        console.log('  none');
      } else {
        console.log('');
        for (const pair of analysis.pairs) {
          console.log(sim.formatPairReport(pair, pathMap, cwd));
          console.log('');
        }
      }
      console.log('## Full matrix');
      console.log('');
      console.log(sim.formatMatrixMarkdown(analysis));
      console.log('');
      console.log('## Shedding (candidates vs promoted skills)');
      console.log('');
      console.log(sim.formatSheddingReport(shed, pathMap, cwd));
      console.log('');
      const stale = shed.results.filter((r) => r.stale).length;
      const flagged = analysis.pairs.length;
      let obsoleteCount = 0;
      if (obsolete) {
        console.log('');
        console.log(`## Sprint-window obsolescence (candidates vs active trajectory)`);
        console.log('');
        console.log(`Low score = candidate is outside the live sprint trajectory.`);
        console.log(`Obsolete threshold: < ${obsoleteThreshold.toFixed(2)} (below this = probably shed)`);
        console.log('');
        const obs = obsolete.results.filter((r) => r.obsolete);
        const live = obsolete.results.filter((r) => !r.obsolete);
        console.log(`Likely obsolete (${obs.length}): project evolved past these — discard candidates`);
        for (const r of obs) {
          console.log(`  [${r.score.toFixed(3)}] ${r.candidate}`);
          const p = pathMap.get(r.candidate);
          if (p) {
            const rel = path.relative(cwd, p).split(path.sep).join('/');
            console.log(`           ${rel}`);
          }
        }
        console.log('');
        console.log(`Still in trajectory (${live.length}):`);
        for (const r of live) {
          console.log(`  [${r.score.toFixed(3)}] ${r.candidate}`);
        }
        obsoleteCount = obs.length;
      }
      console.log('');
      console.log(`Summary: ${flagged} merge-candidate pair(s) above ${threshold.toFixed(2)}, ${stale} stale candidate(s) above ${shedThreshold.toFixed(2)}${obsolete ? `, ${obsoleteCount} obsolete candidate(s) below ${obsoleteThreshold.toFixed(2)} vs sprint` : ''}.`);
      if (obsolete && obsoleteCount > 0) {
        console.log('');
        console.log(`Shed the obsolete ones with:`);
        for (const r of obsolete.results.filter((r) => r.obsolete)) {
          const slug = r.candidate.split(':').pop();
          console.log(`  gad evolution shed ${slug}`);
        }
      }
    },
  });
  return evolutionSimilarity;
}

module.exports = { createEvolutionSimilarityCommand };