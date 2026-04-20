'use strict';
/**
 * gad workflow — manage GAD workflows (status/validate/promote/discard)
 *
 * Phase 42.3-11, decision gad-174. Mirrors the `gad evolution` surface so users
 * learn one mental model. Authored workflows live at .planning/workflows/<slug>.md.
 * Emergent candidates surface from compute-self-eval / build-site-data mining
 * trace events; promotion persists the detector's best candidate to disk.
 */

const path = require('path');
const fs = require('fs');
const { defineCommand } = require('citty');

function workflowPaths(repoRoot) {
  return {
    workflowsDir: path.join(repoRoot, '.planning', 'workflows'),
    emergentDir: path.join(repoRoot, '.planning', 'workflows', 'emergent'),
    catalogFile: path.join(repoRoot, 'site', 'lib', 'catalog.generated.ts'),
  };
}

function loadWorkflowsFromCatalog(catalogFile) {
  if (!fs.existsSync(catalogFile)) {
    return { authored: [], emergent: [], error: `catalog not found at ${catalogFile} — run build-site-data.mjs first` };
  }
  const src = fs.readFileSync(catalogFile, 'utf8');
  const m = src.match(/export const WORKFLOWS: Workflow\[\] = (\[[\s\S]*?\]);/);
  if (!m) return { authored: [], emergent: [], error: 'WORKFLOWS export not found in catalog.generated.ts' };
  try {
    const arr = JSON.parse(m[1]);
    return {
      authored: arr.filter((w) => w.origin !== 'emergent'),
      emergent: arr.filter((w) => w.origin === 'emergent'),
    };
  } catch (err) {
    return { authored: [], emergent: [], error: `parse error: ${err.message}` };
  }
}

function createWorkflowCommand() {
  const status = defineCommand({
    meta: { name: 'status', description: 'Show workflow state — authored + emergent candidates + conformance' },
    async run() {
      const repoRoot = process.cwd();
      const { workflowsDir, catalogFile } = workflowPaths(repoRoot);

      let authoredOnDisk = 0;
      if (fs.existsSync(workflowsDir)) {
        for (const name of fs.readdirSync(workflowsDir)) {
          if (name.endsWith('.md') && name !== 'README.md') authoredOnDisk += 1;
        }
      }

      const { authored, emergent, error } = loadWorkflowsFromCatalog(catalogFile);
      if (error) {
        console.log(`Authored workflows on disk: ${authoredOnDisk}`);
        console.log(`Emergent candidates: unknown (${error})\n`);
        console.log('Run `node site/scripts/build-site-data.mjs` to refresh the catalog.');
        return;
      }

      console.log(`Authored workflows: ${authored.length}`);
      for (const w of authored) {
        const conf = w.conformance ? ` conformance=${(w.conformance.score * 100).toFixed(0)}%` : '';
        const parent = w.parentWorkflow ? ` [→ ${w.parentWorkflow}]` : '';
        console.log(`  ${w.slug}${parent}${conf}`);
      }
      console.log('');
      console.log(`Emergent candidates: ${emergent.length}`);
      for (const e of emergent) {
        const support = e.support ? ` support=${e.support.phases}×` : '';
        console.log(`  ${e.slug}${support}`);
      }
      if (emergent.length > 0) {
        console.log('\nNext:');
        console.log('  gad workflow promote <slug>   # persist as .planning/workflows/<name>.md');
        console.log('  gad workflow discard <slug>   # drop for this run (will re-detect next build if still above threshold)');
      }
    },
  });

  const validate = defineCommand({
    meta: { name: 'validate', description: 'Re-run the detector + conformance scorer against current trace data' },
    async run() {
      const repoRoot = process.cwd();
      const script = path.join(repoRoot, 'site', 'scripts', 'build-site-data.mjs');
      if (!fs.existsSync(script)) { console.error(`build-site-data.mjs not found at ${script}`); process.exitCode = 1; return; }
      console.log('Refreshing workflow catalog by running build-site-data.mjs...');
      const { spawnSync } = require('child_process');
      const result = spawnSync(process.execPath, [script], { cwd: path.dirname(script), stdio: 'inherit' });
      if (result.status !== 0) {
        console.error(`build-site-data.mjs exited with status ${result.status}`);
        process.exitCode = result.status || 1;
        return;
      }
      console.log('\nCatalog refreshed. Run `gad workflow status` to see the current state.');
    },
  });

  const promote = defineCommand({
    meta: { name: 'promote', description: 'Promote an emergent candidate to an authored workflow' },
    args: {
      slug: { type: 'positional', description: 'Emergent workflow slug from `gad workflow status`' },
      name: { type: 'string', alias: 'n', description: 'Final workflow slug on disk (defaults to emergent slug stripped of support suffix)' },
    },
    async run({ args }) {
      const repoRoot = process.cwd();
      const { workflowsDir, catalogFile } = workflowPaths(repoRoot);
      const { emergent, error } = loadWorkflowsFromCatalog(catalogFile);
      if (error) { console.error(error); process.exitCode = 1; return; }
      const cand = emergent.find((e) => e.slug === args.slug);
      if (!cand) {
        console.error(`Emergent workflow not found: ${args.slug}`);
        console.error('Run `gad workflow status` to list current candidates.');
        process.exitCode = 1;
        return;
      }
      const finalSlug = args.name || cand.slug.replace(/^emergent-/, '').replace(/-\d+-\d+$/, '');
      const targetFile = path.join(workflowsDir, `${finalSlug}.md`);
      if (fs.existsSync(targetFile)) {
        console.error(`Refusing to overwrite existing workflow file: ${path.relative(repoRoot, targetFile)}`);
        console.error(`Use --name to choose a different slug.`);
        process.exitCode = 1;
        return;
      }

      const now = new Date().toISOString();
      const frontmatter = [
        '---',
        `slug: ${finalSlug}`,
        `name: ${cand.name || finalSlug}`,
        `description: ${(cand.description || '').replace(/\n/g, ' ')}`,
        `trigger: ${(cand.trigger || 'Detected automatically from trace data.').replace(/\n/g, ' ')}`,
        'participants:',
        '  skills: []',
        '  agents: [default]',
        '  cli: []',
        '  artifacts: []',
        'parent-workflow: null',
        'related-phases: [42.3]',
        'origin: authored',
        'provenance:',
        `  emergent-slug: ${cand.slug}`,
        `  support: ${cand.support ? cand.support.phases : 1}`,
        `  promoted-at: ${now}`,
        '---',
        '',
        '## Provenance',
        '',
        `This workflow was promoted from an emergent detector candidate on ${now.slice(0, 10)}.`,
        `It was observed ${cand.support ? cand.support.phases : 'N'}× in trace data before promotion.`,
        'Original detector slug: `' + cand.slug + '`.',
        '',
        '## Expected graph',
        '',
        '```mermaid',
        cand.mermaidBody || 'flowchart LR\n  a[unknown]',
        '```',
        '',
      ].join('\n');

      if (!fs.existsSync(workflowsDir)) fs.mkdirSync(workflowsDir, { recursive: true });
      fs.writeFileSync(targetFile, frontmatter, 'utf8');
      console.log(`✓ Promoted ${args.slug}`);
      console.log(`  → ${path.relative(repoRoot, targetFile)}\n`);
      console.log('Review the file, edit frontmatter participants to describe the real pattern,');
      console.log('then re-run `node site/scripts/build-site-data.mjs` so the authored graph picks it up.');
    },
  });

  const discard = defineCommand({
    meta: { name: 'discard', description: 'Discard an emergent candidate for this run (detector will re-emit next build if still above threshold)' },
    args: { slug: { type: 'positional', description: 'Emergent workflow slug' } },
    async run({ args }) {
      console.log(`Discarded candidate: ${args.slug}\n`);
      console.log('Emergent candidates are regenerated from trace data on every build.');
      console.log('To permanently suppress this pattern, raise the detector thresholds in');
      console.log('.planning/config.json (min_support, min_length, etc).');
    },
  });

  return defineCommand({
    meta: { name: 'workflow', description: 'Manage GAD workflows — status/validate/promote/discard authored + emergent' },
    subCommands: { status, validate, promote, discard },
  });
}

module.exports = { createWorkflowCommand };
module.exports.register = () => ({ workflow: createWorkflowCommand() });
