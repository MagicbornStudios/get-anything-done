'use strict';
/**
 * `gad evolution …` command family — validate, install, promote, discard,
 * status, similarity, scan, shed (+ images delegated externally).
 *
 * Most helpers (evolutionPaths, install plumbing, scan writers) stay in
 * gad.cjs because snapshot/eval also consume them; we accept them as deps.
 *
 * Returns evolutionCmd as well as evolutionPromote/evolutionInstall, since
 * the skill family delegates into those two.
 */

const fs = require('fs');
const path = require('path');
const { defineCommand } = require('citty');

function createEvolutionCommands(deps) {
  const {
    repoRoot,
    findRepoRoot,
    gadConfig,
    resolveRoots,
    outputError,
    shouldUseJson,
    evolutionPaths,
    resolveProtoSkillInstallRuntimes,
    installProtoSkillToRuntime,
    protoSkillRelativePath,
    writeEvolutionScan,
    readEvolutionScan,
    evolutionImagesCmd,
  } = deps;

  const { classifyProtoSkillDraftingState } = require('../../lib/proto-skill-state.cjs');

  const evolutionValidate = defineCommand({
    meta: { name: 'validate', description: 'Run advisory validator on a proto-skill (writes VALIDATION.md)' },
    args: {
      slug: { type: 'positional', description: 'proto-skill slug (directory name under .planning/proto-skills/)', required: true },
    },
    run({ args }) {
      const { protoSkillsDir } = evolutionPaths(repoRoot);
      const dir = path.join(protoSkillsDir, args.slug);
      const skillPath = path.join(dir, 'SKILL.md');
      if (!fs.existsSync(skillPath)) {
        console.error(`No proto-skill found at ${skillPath}`);
        process.exit(1);
      }
      const { writeValidation } = require('../../lib/evolution-validator.cjs');
      const { outPath, result } = writeValidation(skillPath, path.resolve(repoRoot, '..', '..'));
      const okFiles = result.fileRefs.filter((f) => f.exists).length;
      const okCmds = result.cliCommands.filter((c) => c.valid === true).length;
      console.log(`Validated ${args.slug}`);
      console.log(`  File refs: ${okFiles}/${result.fileRefs.length}`);
      console.log(`  CLI cmds:  ${okCmds}/${result.cliCommands.length}`);
      console.log(`  → ${outPath}`);
    },
  });

  const evolutionInstall = defineCommand({
    meta: { name: 'install', description: 'Install a staged proto-skill into one or more coding-agent runtimes without promoting it' },
    args: {
      slug: { type: 'positional', description: 'proto-skill slug', required: true },
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
      'config-dir': { type: 'string', description: 'Custom runtime config directory', default: '' },
    },
    run({ args }) {
      if (args.global && args.local) {
        console.error('Choose either --global or --local for proto-skill install, not both.');
        process.exit(1);
      }
      const { protoSkillsDir } = evolutionPaths(repoRoot);
      const protoDir = path.join(protoSkillsDir, args.slug);
      const skillPath = path.join(protoDir, 'SKILL.md');
      if (!fs.existsSync(skillPath)) {
        console.error(`No proto-skill found at ${skillPath}`);
        process.exit(1);
      }
      const runtimes = resolveProtoSkillInstallRuntimes(args);
      const installMode = args.global ? 'global' : 'local';
      console.log(`Installing proto-skill ${args.slug} from ${protoSkillRelativePath(args.slug)}/`);
      console.log(`  mode: ${installMode}`);
      for (const runtime of runtimes) {
        const result = installProtoSkillToRuntime(protoDir, args.slug, runtime, {
          global: Boolean(args.global),
          configDir: args['config-dir'] || '',
        });
        console.log(`  ${runtime}: ${result.nativeDir}`);
        console.log(`           ${result.mirrorDir}`);
      }
      console.log('');
      console.log('Proto-skill remains staged in .planning until you promote or discard it.');
    },
  });

  const evolutionPromote = defineCommand({
    meta: { name: 'promote', description: 'Promote a proto-skill into skills/ + workflows/ (joins species DNA)' },
    args: {
      slug: { type: 'positional', description: 'proto-skill slug', required: true },
      name: { type: 'string', description: 'final skill name in skills/ (defaults to slug)', required: false },
    },
    run({ args }) {
      const { protoSkillsDir, finalSkillsDir, candidatesDir } = evolutionPaths(repoRoot);
      const protoDir = path.join(protoSkillsDir, args.slug);
      if (!fs.existsSync(protoDir)) {
        console.error(`No proto-skill at ${protoDir}`);
        process.exit(1);
      }
      const skillPath = path.join(protoDir, 'SKILL.md');
      if (!fs.existsSync(skillPath)) {
        console.error(`Missing SKILL.md in proto-skill — cannot promote`);
        process.exit(1);
      }

      // Resolve final skill name. Precedence: --name > frontmatter `name:` > slug.
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
        console.error(`Final skill dir already exists at ${finalDir} — refusing to overwrite. Pass --name <other> or remove it manually.`);
        process.exit(1);
      }

      fs.mkdirSync(finalDir, { recursive: true });

      const siblingWorkflowPath = path.join(protoDir, 'workflow.md');
      const hasSiblingWorkflow = fs.existsSync(siblingWorkflowPath);
      const workflowsDir = path.join(repoRoot, 'workflows');
      const canonicalWorkflowPath = hasSiblingWorkflow
        ? path.join(workflowsDir, `${finalName}.md`)
        : null;

      if (hasSiblingWorkflow) {
        if (fs.existsSync(canonicalWorkflowPath)) {
          fs.rmSync(finalDir, { recursive: true, force: true });
          console.error(
            `Canonical workflow already exists at ${path.relative(repoRoot, canonicalWorkflowPath)} — refusing to overwrite. Pass --name <other> or remove it manually.`
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

      fs.rmSync(protoDir, { recursive: true, force: true });
      const candidateDir = path.join(candidatesDir, args.slug);
      if (fs.existsSync(candidateDir)) fs.rmSync(candidateDir, { recursive: true, force: true });

      console.log(`Promoted ${args.slug} → ${path.relative(repoRoot, finalDir)}`);
      if (hasSiblingWorkflow) {
        console.log(`  Split workflow: ${path.relative(repoRoot, canonicalWorkflowPath)}`);
      } else {
        console.log('  (no sibling workflow.md — SKILL.md promoted as inline body)');
      }
      console.log(`  Removed proto-skill: ${path.relative(repoRoot, protoDir)}`);
    },
  });

  const evolutionDiscard = defineCommand({
    meta: { name: 'discard', description: 'Discard a proto-skill (deletes the directory)' },
    args: {
      slug: { type: 'positional', description: 'proto-skill slug', required: true },
      keepCandidate: { type: 'boolean', description: 'keep the candidate file (only delete the proto-skill draft)', required: false },
    },
    run({ args }) {
      const { protoSkillsDir, candidatesDir } = evolutionPaths(repoRoot);
      const protoDir = path.join(protoSkillsDir, args.slug);
      if (!fs.existsSync(protoDir)) {
        console.error(`No proto-skill at ${protoDir}`);
        process.exit(1);
      }
      fs.rmSync(protoDir, { recursive: true, force: true });
      console.log(`Discarded proto-skill: ${path.relative(repoRoot, protoDir)}`);
      if (!args.keepCandidate) {
        const candidateDir = path.join(candidatesDir, args.slug);
        if (fs.existsSync(candidateDir)) {
          fs.rmSync(candidateDir, { recursive: true, force: true });
          console.log(`Discarded candidate:    ${path.relative(repoRoot, candidateDir)}`);
        }
      }
    },
  });

  const evolutionStatus = defineCommand({
    meta: { name: 'status', description: 'Show evolution state — pending proto-skills + candidates' },
    run() {
      const { candidatesDir, protoSkillsDir, evolutionsDir } = evolutionPaths(repoRoot);
      const candidates = fs.existsSync(candidatesDir)
        ? fs.readdirSync(candidatesDir, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name)
        : [];
      const protoSkills = fs.existsSync(protoSkillsDir)
        ? fs.readdirSync(protoSkillsDir, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name)
        : [];
      const evolutions = fs.existsSync(evolutionsDir)
        ? fs.readdirSync(evolutionsDir).filter((e) => !e.startsWith('.'))
        : [];

      const drafting = classifyProtoSkillDraftingState(candidatesDir, protoSkillsDir);

      if (candidates.length === 0 && protoSkills.length === 0) {
        console.log('No active evolution.');
        console.log(`  ${evolutions.length} historical evolutions recorded in skills/.evolutions/`);
        return;
      }
      console.log(`Active evolution: ${evolutions[evolutions.length - 1] || '(no marker found)'}`);
      console.log('');

      console.log('Drafting queue (create-proto-skill):');
      console.log(`  pending:     ${drafting.pending.length}   (candidate without proto-skill dir)`);
      console.log(`  in-progress: ${drafting.inProgress.length}   (PROVENANCE.md present, SKILL.md missing — resume target)`);
      console.log(`  complete:    ${drafting.complete.length}   (proto-skill bundle drafted)`);
      console.log('');

      if (drafting.inProgress.length > 0) {
        console.log('Resume in-progress proto-skills (previous run crashed mid-draft):');
        for (const slug of drafting.inProgress) {
          console.log(`  - ${protoSkillRelativePath(slug)}/   [PROVENANCE.md only]`);
        }
        console.log('');
      }

      if (candidates.length > 0) {
        console.log(`Candidates (raw, awaiting drafting): ${candidates.length}`);
        for (const c of candidates) console.log(`  - .planning/candidates/${c}/`);
        console.log('');
      }
      if (protoSkills.length > 0) {
        console.log(`Proto-skills (drafted, awaiting human review): ${protoSkills.length}`);
        for (const p of protoSkills) {
          const hasValidation = fs.existsSync(path.join(protoSkillsDir, p, 'VALIDATION.md'));
          console.log(`  - ${protoSkillRelativePath(p)}/   ${hasValidation ? '[validated]' : '[no validation yet]'}`);
        }
        console.log('');
        console.log('Review then run:');
        console.log('  gad evolution install <slug> [--codex|--claude|...]   # test without promotion');
        console.log('  gad evolution promote <slug>   # joins species DNA');
        console.log('  gad evolution discard <slug>   # delete');
      }
    },
  });

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
      const sim = require('../../lib/similarity.cjs');
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
        const emb = require('../../lib/embeddings.cjs');
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
          const emb = require('../../lib/embeddings.cjs');
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

  const evolutionScan = defineCommand({
    meta: { name: 'scan', description: 'Run the lightweight evolution scan and write .planning/.evolution-scan.json' },
    args: {
      projectid: { type: 'string', description: 'Scope to one project', default: '' },
      json: { type: 'boolean', description: 'JSON output', default: false },
    },
    run({ args }) {
      const baseDir = findRepoRoot();
      const config = gadConfig.load(baseDir);
      const roots = resolveRoots({ projectid: args.projectid }, baseDir, config.roots);
      if (roots.length === 0) return;
      const root = roots[0];
      const { scan, filePath } = writeEvolutionScan(root, baseDir, repoRoot);
      const payload = {
        project: root.id,
        file: path.relative(baseDir, filePath),
        candidateCount: scan.candidates.length,
        shedCount: scan.shedCandidates.length,
        scan,
      };
      if (args.json || shouldUseJson()) {
        console.log(JSON.stringify(payload, null, 2));
        return;
      }
      console.log(`Evolution scan: ${payload.candidateCount} candidate(s), ${payload.shedCount} shed candidate(s) -> ${payload.file}`);
    },
  });

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
        const sim = require('../../lib/similarity.cjs');
        const sprintDoc = sim.loadSprintCorpus(repoRoot, repoRoot);
        const candidateDocs = sim.loadCorpusFromDirs([
          { kind: 'candidate', root: candidatesDir },
        ]);
        const cutoff = args.threshold ? parseFloat(args.threshold) : (args.embeddings ? 0.65 : 0.40);
        let scores;
        if (args.embeddings) {
          const emb = require('../../lib/embeddings.cjs');
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

  const evolutionCmd = defineCommand({
    meta: { name: 'evolution', description: 'Manage GAD evolution proto-skills (validate/promote/discard/status/similarity/images)' },
    subCommands: {
      scan: evolutionScan,
      install: evolutionInstall,
      validate: evolutionValidate,
      promote: evolutionPromote,
      discard: evolutionDiscard,
      status: evolutionStatus,
      similarity: evolutionSimilarity,
      shed: evolutionShed,
      images: evolutionImagesCmd,
    },
  });

  return { evolutionCmd, evolutionPromote, evolutionInstall };
}

module.exports = { createEvolutionCommands };
