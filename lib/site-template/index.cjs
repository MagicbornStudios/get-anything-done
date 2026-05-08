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

module.exports = { generateSite, addToGadConfig, runGhInit, runVercelLink };
