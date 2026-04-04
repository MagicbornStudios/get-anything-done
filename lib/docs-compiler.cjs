'use strict';
/**
 * docs-compiler.cjs — compile planning docs from all roots into MDX sink.
 * Used by `gad docs compile` CLI command.
 */

const fs = require('fs');
const path = require('path');

/**
 * Compile STATE.md + ROADMAP.md from every root into MDX files in the sink directory.
 *
 * @param {{ roots: import('../bin/gad-config.cjs').Root[], docs_sink: string|null }} config
 * @param {{ sink?: string, baseDir?: string, verbose?: boolean }} opts
 * @returns {{ compiled: number, warnings: string[] }}
 */
function compile(config, opts = {}) {
  const sink = opts.sink || config.docs_sink;
  const baseDir = opts.baseDir || process.cwd();
  const verbose = opts.verbose || false;

  if (!sink) {
    throw new Error('No docs_sink configured. Pass --sink <path> or set docs_sink in planning-config.toml.');
  }

  let compiled = 0;
  const warnings = [];

  for (const root of config.roots) {
    const planDir = path.join(baseDir, root.path, root.planningDir);
    const outDir = path.join(baseDir, sink, root.id);

    fs.mkdirSync(outDir, { recursive: true });

    const now = new Date().toISOString();
    const sourceBase = `${root.path}/${root.planningDir}`;

    // STATE.md → STATE.mdx
    const stateIn = path.join(planDir, 'STATE.md');
    if (fs.existsSync(stateIn)) {
      const content = fs.readFileSync(stateIn, 'utf8');
      const mdx = toMdx(content, {
        title: `${root.id} — Planning State`,
        description: `Auto-compiled from ${sourceBase}/STATE.md`,
        generated: now,
        source: `${sourceBase}/STATE.md`,
      });
      fs.writeFileSync(path.join(outDir, 'STATE.mdx'), mdx);
      compiled++;
      if (verbose) console.log(`  ✓ ${root.id}/STATE.mdx`);
    } else {
      warnings.push(`${root.id}: STATE.md not found at ${stateIn}`);
    }

    // ROADMAP.md → ROADMAP.mdx
    const roadmapIn = path.join(planDir, 'ROADMAP.md');
    if (fs.existsSync(roadmapIn)) {
      const content = fs.readFileSync(roadmapIn, 'utf8');
      const mdx = toMdx(content, {
        title: `${root.id} — Roadmap`,
        description: `Auto-compiled from ${sourceBase}/ROADMAP.md`,
        generated: now,
        source: `${sourceBase}/ROADMAP.md`,
      });
      fs.writeFileSync(path.join(outDir, 'ROADMAP.mdx'), mdx);
      compiled++;
      if (verbose) console.log(`  ✓ ${root.id}/ROADMAP.mdx`);
    } else {
      warnings.push(`${root.id}: ROADMAP.md not found at ${roadmapIn}`);
    }

    // Compile phase files if phases/ dir exists
    const phasesDir = path.join(planDir, 'phases');
    if (fs.existsSync(phasesDir)) {
      const phaseDirs = fs.readdirSync(phasesDir, { withFileTypes: true })
        .filter(e => e.isDirectory())
        .map(e => e.name);

      for (const phaseId of phaseDirs) {
        const phaseOut = path.join(outDir, 'phases', phaseId);
        fs.mkdirSync(phaseOut, { recursive: true });

        for (const fname of ['PLAN.md', 'SUMMARY.md', 'KICKOFF.md']) {
          const src = path.join(phasesDir, phaseId, fname);
          if (!fs.existsSync(src)) continue;
          const content = fs.readFileSync(src, 'utf8');
          const mdx = toMdx(content, {
            title: `${root.id} ${phaseId} — ${fname.replace('.md', '')}`,
            generated: now,
            source: `${sourceBase}/phases/${phaseId}/${fname}`,
          });
          fs.writeFileSync(path.join(phaseOut, fname.replace('.md', '.mdx')), mdx);
          compiled++;
        }
      }
    }
  }

  return { compiled, warnings };
}

/**
 * Wrap Markdown content with MDX frontmatter.
 */
function toMdx(content, frontmatter) {
  const fm = Object.entries(frontmatter)
    .filter(([, v]) => v != null)
    .map(([k, v]) => `${k}: "${v}"`)
    .join('\n');

  return `---\n${fm}\n---\n\n${content}`;
}

module.exports = { compile };
