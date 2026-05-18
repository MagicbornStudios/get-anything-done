'use strict';
/**
 * lib/site-template/index.cjs
 *
 * Generator library for `gad site new <slug>`.
 *
 * Exports:
 *   generateSite({ slug, targetDir, dryRun }) → { files, commands_run, errors }
 *   addToGadConfig({ slug, configPath })
 *   runGhInit({ slug, org, targetDir, dryRun })
 *   runVercelLink({ slug, team, targetDir, dryRun })
 *
 * Templates live in ./files/ with .tmpl extensions.
 * Mustache-style {{slug}} is substituted throughout.
 * Binary file extensions (images, fonts, etc.) are copied as-is.
 */

const fs = require('node:fs');
const path = require('node:path');
const { execSync } = require('node:child_process');

const TEMPLATE_DIR = path.join(__dirname, 'files');

// Extensions we never do text substitution on.
const BINARY_EXTS = new Set([
  '.png', '.jpg', '.jpeg', '.gif', '.webp', '.ico', '.svg',
  '.woff', '.woff2', '.ttf', '.otf', '.eot',
  '.pdf', '.zip',
]);

/**
 * Walk a directory, yielding { rel, abs } for every file.
 * @param {string} dir
 * @param {string} [base]
 * @returns {{ rel: string, abs: string }[]}
 */
function walkDir(dir, base) {
  base = base || dir;
  const result = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const abs = path.join(dir, entry.name);
    const rel = path.relative(base, abs);
    if (entry.isDirectory()) {
      result.push(...walkDir(abs, base));
    } else {
      result.push({ rel, abs });
    }
  }
  return result;
}

/**
 * Apply {{slug}} substitution to a string.
 * @param {string} content
 * @param {string} slug
 * @returns {string}
 */
function applySubstitutions(content, slug) {
  return content.replace(/\{\{slug\}\}/g, slug);
}

/**
 * Derive the target filename from a template filename.
 * Strips the trailing .tmpl extension; preserves everything else.
 * @param {string} relPath
 * @returns {string}
 */
function targetRelPath(relPath) {
  if (relPath.endsWith('.tmpl')) {
    return relPath.slice(0, -5); // remove ".tmpl"
  }
  return relPath;
}

/**
 * Generate a new site from the built-in template.
 *
 * @param {object} opts
 * @param {string} opts.slug         - Site slug, e.g. "my-site"
 * @param {string} opts.targetDir    - Absolute path to write into, e.g. "/path/to/sites/my-site"
 * @param {boolean} [opts.dryRun]    - If true, log plan but write nothing.
 * @returns {{ files: string[], commands_run: string[], errors: string[] }}
 */
function generateSite({ slug, targetDir, dryRun }) {
  if (!slug || typeof slug !== 'string') throw new TypeError('slug is required');
  if (!targetDir || typeof targetDir !== 'string') throw new TypeError('targetDir is required');

  const files = [];
  const commands_run = [];
  const errors = [];

  if (!dryRun && fs.existsSync(targetDir)) {
    errors.push(`Target directory already exists: ${targetDir}`);
    return { files, commands_run, errors };
  }

  const templateFiles = walkDir(TEMPLATE_DIR);

  for (const { rel, abs } of templateFiles) {
    const destRel = applySubstitutions(targetRelPath(rel), slug);
    const destAbs = path.join(targetDir, destRel);
    const ext = path.extname(rel);

    files.push(destRel);

    if (dryRun) {
      console.log(`  [dry-run] would write: ${destRel}`);
      continue;
    }

    fs.mkdirSync(path.dirname(destAbs), { recursive: true });

    if (BINARY_EXTS.has(ext.toLowerCase())) {
      fs.copyFileSync(abs, destAbs);
    } else {
      let content;
      try {
        content = fs.readFileSync(abs, 'utf8');
      } catch (err) {
        errors.push(`Read failed: ${rel} — ${err.message}`);
        continue;
      }
      const rendered = applySubstitutions(content, slug);
      fs.writeFileSync(destAbs, rendered, 'utf8');
    }
  }

  return { files, commands_run, errors };
}

/**
 * Ensure a `sites/*` (or explicit `sites/<slug>`) entry is present in the
 * monorepo `pnpm-workspace.yaml`. Idempotent — leaves the file untouched if
 * any existing entry already matches the new site path (the common case,
 * because most monorepos declare `- "sites/*"` once).
 *
 * @param {object} opts
 * @param {string} opts.slug                  - Site slug
 * @param {string} opts.workspaceYamlPath     - Absolute path to pnpm-workspace.yaml
 * @param {boolean} [opts.dryRun]
 * @returns {{ touched: boolean, reason: string }}
 */
function addToPnpmWorkspace({ slug, workspaceYamlPath, dryRun }) {
  if (!slug || !workspaceYamlPath) throw new TypeError('slug and workspaceYamlPath are required');

  if (!fs.existsSync(workspaceYamlPath)) {
    return { touched: false, reason: `pnpm-workspace.yaml not found at ${workspaceYamlPath}` };
  }

  const existing = fs.readFileSync(workspaceYamlPath, 'utf8');
  const sitePath = `sites/${slug}`;

  // Detect coverage:
  //   1. Glob entry "sites/*" or 'sites/*'
  //   2. Explicit entry "sites/<slug>" or 'sites/<slug>'
  const globRe = /^\s*-\s*["']?sites\/\*["']?\s*$/m;
  const explicitRe = new RegExp(`^\\s*-\\s*["']?sites\\/${slug.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}["']?\\s*$`, 'm');

  if (globRe.test(existing)) {
    return { touched: false, reason: `sites/* glob already covers ${sitePath}` };
  }
  if (explicitRe.test(existing)) {
    return { touched: false, reason: `${sitePath} already listed explicitly` };
  }

  if (dryRun) {
    console.log(`  [dry-run] would append "- \"${sitePath}\"" to pnpm-workspace.yaml`);
    return { touched: false, reason: 'dry-run' };
  }

  // Append under the `packages:` block. Try to insert right before any
  // trailing blank line / comment block; fall back to plain append.
  let next;
  if (/^packages:\s*$/m.test(existing)) {
    // Insert after the last existing `- ` line under packages.
    const lines = existing.split(/\r?\n/);
    let lastListIdx = -1;
    let inPackages = false;
    for (let i = 0; i < lines.length; i++) {
      if (/^packages:\s*$/.test(lines[i])) { inPackages = true; continue; }
      if (inPackages) {
        if (/^\s*-\s/.test(lines[i])) lastListIdx = i;
        else if (/^\S/.test(lines[i]) && lines[i].trim() !== '') break; // new top-level key
      }
    }
    if (lastListIdx >= 0) {
      lines.splice(lastListIdx + 1, 0, `  - "${sitePath}"`);
      next = lines.join('\n');
    } else {
      next = existing.replace(/^packages:\s*$/m, `packages:\n  - "${sitePath}"`);
    }
  } else {
    next = existing + (existing.endsWith('\n') ? '' : '\n') + `  - "${sitePath}"\n`;
  }

  fs.writeFileSync(workspaceYamlPath, next, 'utf8');
  return { touched: true, reason: `appended ${sitePath}` };
}

/**
 * Append a [[planning.roots]] entry for the new site to a gad-config.toml.
 *
 * @param {object} opts
 * @param {string} opts.slug       - Site slug
 * @param {string} opts.configPath - Absolute path to gad-config.toml
 */
function addToGadConfig({ slug, configPath }) {
  if (!slug || !configPath) throw new TypeError('slug and configPath are required');

  const entry = `\n[[planning.roots]]\npath = "sites/${slug}"\nprojectId = "${slug}"\n`;

  if (!fs.existsSync(configPath)) {
    throw new Error(`gad-config.toml not found at: ${configPath}`);
  }

  const existing = fs.readFileSync(configPath, 'utf8');
  // Idempotent — don't add duplicate
  if (existing.includes(`projectId = "${slug}"`)) {
    console.log(`[gad-config] ${slug} already registered, skipping.`);
    return;
  }

  fs.appendFileSync(configPath, entry, 'utf8');
  console.log(`[gad-config] appended planning root for ${slug}`);
}

/**
 * Run `gh repo create` to initialise a GitHub repository for the site.
 *
 * @param {object} opts
 * @param {string} opts.slug      - Site slug (used as repo name)
 * @param {string} [opts.org]     - GitHub org/user. Defaults to slug-only (personal repo).
 * @param {string} opts.targetDir - Absolute path to the site directory.
 * @param {boolean} [opts.dryRun]
 * @returns {string} Command that was (or would be) run.
 */
function runGhInit({ slug, org, targetDir, dryRun }) {
  const repoName = org ? `${org}/${slug}` : slug;
  const cmd = `gh repo create ${repoName} --private --source "${targetDir}" --remote origin --push`;

  if (dryRun) {
    console.log(`[dry-run] would run: ${cmd}`);
    return cmd;
  }

  console.log(`[gh-init] ${cmd}`);
  execSync(cmd, { stdio: 'inherit' });
  return cmd;
}

/**
 * Run `vercel link` to connect the site directory to a Vercel project.
 *
 * @param {object} opts
 * @param {string} opts.slug      - Site slug (used as project name)
 * @param {string} [opts.team]    - Vercel team slug. Optional.
 * @param {string} opts.targetDir - Absolute path to the site directory.
 * @param {boolean} [opts.dryRun]
 * @returns {string} Command that was (or would be) run.
 */
function runVercelLink({ slug, team, targetDir, dryRun }) {
  const teamFlag = team ? `--scope ${team}` : '';
  const cmd = `vercel link --project=${slug} ${teamFlag} --yes`.trim().replace(/\s+/g, ' ');

  if (dryRun) {
    console.log(`[dry-run] would run (from ${targetDir}): ${cmd}`);
    return cmd;
  }

  console.log(`[vercel-link] ${cmd}`);
  execSync(cmd, { cwd: targetDir, stdio: 'inherit' });
  return cmd;
}

module.exports = { generateSite, addToGadConfig, addToPnpmWorkspace, runGhInit, runVercelLink };
