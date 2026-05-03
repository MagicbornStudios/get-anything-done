'use strict';
/**
 * gad site — compile / serve. Required deps: outputError.
 *
 * `gad site serve` port policy: monorepo / dev defaults to GAD_SITE_SERVE_PORT_DEV
 * so it is visually distinct from `gad play` / `gad generation open` (random 4173+).
 * Packaged installs should pass `--consumer` (default GAD_SITE_SERVE_PORT_CONSUMER)
 * or set GAD_SITE_SERVE_PORT / GAD_SITE_PORT in the environment.
 */

const path = require('path');
const { defineCommand } = require('citty');

const GAD_SITE_SERVE_PORT_DEV = 3456;
const GAD_SITE_SERVE_PORT_CONSUMER = 3780;

function resolveGadSiteServePortDetailed(args) {
  const raw = String(args.port != null ? args.port : '').trim();
  if (raw !== '') {
    const p = parseInt(raw, 10);
    if (Number.isFinite(p) && p > 0) return { port: p, source: 'explicit' };
  }
  const envRaw = String(process.env.GAD_SITE_SERVE_PORT || process.env.GAD_SITE_PORT || '').trim();
  if (envRaw !== '') {
    const e = parseInt(envRaw, 10);
    if (Number.isFinite(e) && e > 0) return { port: e, source: 'env' };
  }
  const consumer = args.consumer === true || args['consumer'] === true;
  if (consumer) return { port: GAD_SITE_SERVE_PORT_CONSUMER, source: 'consumer' };
  return { port: GAD_SITE_SERVE_PORT_DEV, source: 'dev' };
}

function createSiteCommand(deps) {
  const { outputError } = deps;

  const siteCompileCmd = defineCommand({
    meta: {
      name: 'compile',
      description: "Compile a GAD project's planning data into a static deployable site (extracts /planning from GAD site build)",
    },
    args: {
      root: { type: 'string', description: 'Project root (dir containing .planning/). Defaults to cwd.', default: '' },
      projectid: { type: 'string', description: 'Project id used for display + data lookups. Defaults to root dir name.', default: '' },
      out: { type: 'string', description: 'Output directory for compiled static site. Defaults to <root>/dist/site.', default: '' },
    },
    run({ args }) {
      const { compileSite } = require('../../lib/site-compile.cjs');
      const projectRoot = path.resolve(args.root || process.cwd());
      const projectId = args.projectid || path.basename(projectRoot);
      const outDir = path.resolve(args.out || path.join(projectRoot, 'dist', 'site'));
      try {
        compileSite({ projectRoot, projectId, outDir });
      } catch (err) {
        outputError(err.message);
      }
    },
  });

  const siteServeCmd = defineCommand({
    meta: {
      name: 'serve',
      description:
        'Compile then locally serve the GAD planning/landing static site (no dev hot reload). Default port 3456 (dev); use `--consumer` for 3780 when side-by-side with dev. For generation HTML use `gad play`, not this command.',
    },
    args: {
      root: { type: 'string', description: 'Project root (dir containing .planning/). Defaults to cwd.', default: '' },
      projectid: { type: 'string', description: 'Project id. Defaults to root dir name.', default: '' },
      out: { type: 'string', description: 'Output directory. Defaults to <root>/dist/site.', default: '' },
      port: {
        type: 'string',
        description: `Explicit TCP port, or leave empty for auto (${GAD_SITE_SERVE_PORT_DEV} dev, ${GAD_SITE_SERVE_PORT_CONSUMER} with --consumer, or GAD_SITE_SERVE_PORT / GAD_SITE_PORT).`,
        default: '',
      },
      host: { type: 'string', description: 'Bind host. Defaults to 127.0.0.1.', default: '127.0.0.1' },
      consumer: {
        type: 'boolean',
        description: `Use packaged-install default port ${GAD_SITE_SERVE_PORT_CONSUMER} when --port is omitted (dev default without this flag is ${GAD_SITE_SERVE_PORT_DEV}).`,
        default: false,
      },
      skipCompile: { type: 'boolean', description: 'Skip compile and serve existing output dir as-is.', default: false },
    },
    run({ args }) {
      const { compileSite, serveStatic } = require('../../lib/site-compile.cjs');
      const projectRoot = path.resolve(args.root || process.cwd());
      const projectId = args.projectid || path.basename(projectRoot);
      const outDir = path.resolve(args.out || path.join(projectRoot, 'dist', 'site'));
      const { port, source } = resolveGadSiteServePortDetailed(args);
      const skipCompile = args.skipCompile === true || args['skip-compile'] === true;
      try {
        if (!skipCompile) compileSite({ projectRoot, projectId, outDir });
        if (source !== 'explicit') {
          const why =
            source === 'env'
              ? 'GAD_SITE_SERVE_PORT / GAD_SITE_PORT'
              : source === 'consumer'
                ? '--consumer install profile'
                : 'dev default (omit --consumer)';
          console.log(`[gad site] port ${port} (${why})`);
        }
        serveStatic({ rootDir: outDir, port, host: args.host });
      } catch (err) {
        outputError(err.message);
      }
    },
  });

  const siteNewCmd = defineCommand({
    meta: {
      name: 'new',
      description: 'Bootstrap a new customer site from template',
    },
    args: {
      slug: { type: 'positional', description: 'Slug for the new site (e.g. test-tenant)', required: true },
      name: { type: 'string', description: 'Site name. Defaults to slug.', default: '' },
    },
    run({ args }) {
      const fs = require('fs');
      const { execSync } = require('child_process');

      const repoRoot = deps.findRepoRoot();
      const templateDir = path.join(repoRoot, 'vendor/get-anything-done/templates/customer-site');
      const targetDir = path.join(repoRoot, 'sites', args.slug);

      if (fs.existsSync(targetDir)) {
        outputError(`Target directory already exists: ${targetDir}`);
        return;
      }

      console.log(`[gad site new] bootstrapping sites/${args.slug} ...`);

      try {
        // 1. Copy template
        fs.cpSync(templateDir, targetDir, { recursive: true });

        // 2. Replace tokens
        const siteName = args.name || args.slug;
        const tenantId = `tenant-${args.slug}`;

        function replaceInFile(filePath) {
          if (fs.statSync(filePath).isDirectory()) return;
          // Skip binary files if any (very basic check)
          const ext = path.extname(filePath);
          if (['.png', '.jpg', '.ico', '.pdf'].includes(ext)) return;

          let content = fs.readFileSync(filePath, 'utf8');
          let changed = false;
          if (content.includes('{{SITE_NAME}}')) {
            content = content.replace(/{{SITE_NAME}}/g, siteName);
            changed = true;
          }
          if (content.includes('{{TENANT_ID}}')) {
            content = content.replace(/{{TENANT_ID}}/g, tenantId);
            changed = true;
          }
          if (changed) {
            fs.writeFileSync(filePath, content, 'utf8');
          }
        }

        function walk(dir) {
          const files = fs.readdirSync(dir);
          for (const file of files) {
            const fullPath = path.join(dir, file);
            if (fs.statSync(fullPath).isDirectory()) {
              walk(fullPath);
            } else {
              replaceInFile(fullPath);
            }
          }
        }

        walk(targetDir);

        // Update package.json name
        const pkgPath = path.join(targetDir, 'package.json');
        if (fs.existsSync(pkgPath)) {
          const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
          pkg.name = `@gad-sites/${args.slug}`;
          fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2), 'utf8');
        }

        // 3. pnpm install
        console.log(`[gad site new] running pnpm install ...`);
        execSync('pnpm install', { cwd: repoRoot, stdio: 'inherit' });

        console.log(`[gad site new] done! New site at sites/${args.slug}`);
      } catch (err) {
        outputError(`Failed to bootstrap site: ${err.message}`);
      }
    },
  });

  return defineCommand({
    meta: {
      name: 'site',
      description:
        'GAD planning / landing site (Next.js app under vendor/get-anything-done/site): compile static extract or serve it. Not preserved generation builds — use `gad play` or `gad generation open` for those.',
    },
    subCommands: { compile: siteCompileCmd, serve: siteServeCmd, new: siteNewCmd },
  });
}

module.exports = { createSiteCommand };
module.exports.register = (ctx) => ({ site: createSiteCommand(ctx.common) });
