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

  // Directories never copied when cloning an existing site as a template.
  const SITE_COPY_EXCLUDES = new Set([
    '.next', 'node_modules', '.vercel', 'dist', 'out',
    '.turbo', '.cache', '.git',
  ]);
  const SITE_COPY_EXCLUDE_FILES = new Set([
    '.env', '.env.local', '.env.production', '.env.development',
  ]);

  function copySiteTree(src, dst) {
    const fs = require('fs');
    fs.mkdirSync(dst, { recursive: true });
    for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
      if (entry.isDirectory() && SITE_COPY_EXCLUDES.has(entry.name)) continue;
      if (entry.isFile() && SITE_COPY_EXCLUDE_FILES.has(entry.name)) continue;
      if (entry.isFile() && entry.name.endsWith('.tsbuildinfo')) continue;
      const s = path.join(src, entry.name);
      const d = path.join(dst, entry.name);
      if (entry.isDirectory()) copySiteTree(s, d);
      else fs.copyFileSync(s, d);
    }
  }

  const siteNewCmd = defineCommand({
    meta: {
      name: 'new',
      description: 'Bootstrap a new customer site from template (default: vendor template; --template <existing-slug> clones a sites/<slug>)',
    },
    args: {
      slug: { type: 'positional', description: 'Slug for the new site (e.g. test-tenant)', required: true },
      name: { type: 'string', description: 'Site name. Defaults to slug.', default: '' },
      template: { type: 'string', description: "Template source. Either 'customer-site' (default vendor template) or an existing site slug under sites/ (e.g. '7greens', 'grime-time').", default: 'customer-site' },
    },
    run({ args }) {
      const fs = require('fs');
      const { execSync } = require('child_process');

      const repoRoot = deps.findRepoRoot();
      const targetDir = path.join(repoRoot, 'sites', args.slug);

      if (fs.existsSync(targetDir)) {
        outputError(`Target directory already exists: ${targetDir}`);
        return;
      }

      // Resolve template source.
      let templateDir;
      let templateKind;
      if (args.template === 'customer-site') {
        templateDir = path.join(repoRoot, 'vendor/get-anything-done/templates/customer-site');
        templateKind = 'vendor';
      } else {
        templateDir = path.join(repoRoot, 'sites', args.template);
        templateKind = 'site-clone';
        if (!fs.existsSync(templateDir)) {
          outputError(`Template not found: --template ${args.template} resolves to ${templateDir}, which does not exist. Pass an existing slug under sites/ or 'customer-site'.`);
          return;
        }
      }

      console.log(`[gad site new] bootstrapping sites/${args.slug} from template '${args.template}' (${templateKind}) ...`);

      try {
        // 1. Copy template
        if (templateKind === 'site-clone') {
          copySiteTree(templateDir, targetDir);
        } else {
          fs.cpSync(templateDir, targetDir, { recursive: true });
        }

        // 2. Replace tokens (vendor template only) + slug substitution (both kinds)
        const siteName = args.name || args.slug;
        const tenantId = `tenant-${args.slug}`;
        const sourceSlug = args.template; // for site-clone substitutions

        function replaceInFile(filePath) {
          if (fs.statSync(filePath).isDirectory()) return;
          const ext = path.extname(filePath);
          if (['.png', '.jpg', '.jpeg', '.ico', '.pdf', '.webp', '.gif', '.woff', '.woff2', '.ttf'].includes(ext)) return;

          let content;
          try { content = fs.readFileSync(filePath, 'utf8'); }
          catch { return; }
          let changed = false;
          if (content.includes('{{SITE_NAME}}')) {
            content = content.replace(/{{SITE_NAME}}/g, siteName);
            changed = true;
          }
          if (content.includes('{{TENANT_ID}}')) {
            content = content.replace(/{{TENANT_ID}}/g, tenantId);
            changed = true;
          }
          // Site-clone: rewrite source-slug occurrences in known-safe text files only.
          if (templateKind === 'site-clone' && sourceSlug && sourceSlug !== args.slug) {
            const safeExt = ['.md', '.json', '.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.toml', '.yml', '.yaml'];
            if (safeExt.includes(ext)) {
              const re = new RegExp(`\\b${sourceSlug.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'g');
              if (re.test(content)) {
                content = content.replace(re, args.slug);
                changed = true;
              }
            }
          }
          if (changed) fs.writeFileSync(filePath, content, 'utf8');
        }

        function walk(dir) {
          for (const file of fs.readdirSync(dir)) {
            const fullPath = path.join(dir, file);
            if (fs.statSync(fullPath).isDirectory()) walk(fullPath);
            else replaceInFile(fullPath);
          }
        }

        walk(targetDir);

        // Update package.json name
        const pkgPath = path.join(targetDir, 'package.json');
        if (fs.existsSync(pkgPath)) {
          const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
          pkg.name = templateKind === 'site-clone' ? args.slug : `@gad-sites/${args.slug}`;
          fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n', 'utf8');
        }

        // 3. pnpm install (skip on site-clone — assume root workspace install handles it)
        if (templateKind === 'vendor') {
          console.log(`[gad site new] running pnpm install ...`);
          execSync('pnpm install', { cwd: repoRoot, stdio: 'inherit' });
        }

        const slugUpper = args.slug.replace(/-/g, '_').toUpperCase();
        console.log('');
        console.log(`[gad site new] done! New site at sites/${args.slug}`);
        console.log('');
        console.log('Next steps:');
        console.log(`  1. cd sites/${args.slug}`);
        console.log(`  2. vercel link            # link to a new (or existing) Vercel project`);
        console.log(`  3. cd ../.. && gad site link --slug ${args.slug} --domain <yourdomain.com>`);
        console.log(`  4. Copy .github/workflows/${args.template === 'customer-site' ? '<template>' : args.template}-deploy.yml`);
        console.log(`     → .github/workflows/${args.slug}-deploy.yml and update slug refs`);
        console.log(`  5. Add VERCEL_PROJECT_ID_${slugUpper} to repo secrets`);
        console.log(`  6. Commit + push — first push to main triggers the deploy workflow`);
      } catch (err) {
        outputError(`Failed to bootstrap site: ${err.message}`);
      }
    },
  });

  const siteLinkCmd = defineCommand({
    meta: {
      name: 'link',
      description: 'Attach a custom domain to a site\'s Vercel project. Uses VERCEL_TOKEN if set; otherwise prints the manual `vercel domains add` / `vercel alias set` commands.',
    },
    args: {
      slug: { type: 'string', description: 'Site slug under sites/ (required)', required: true },
      domain: { type: 'string', description: 'Custom domain to attach (e.g. example.com)', required: true },
      redirect: { type: 'string', description: "Optional redirect target. 'www' redirects www.<domain> → apex; 'apex' redirects apex → www. Default: none.", default: '' },
    },
    run({ args }) {
      const fs = require('fs');
      const repoRoot = deps.findRepoRoot();
      const siteDir = path.join(repoRoot, 'sites', args.slug);
      const projectJsonPath = path.join(siteDir, '.vercel', 'project.json');

      if (!fs.existsSync(siteDir)) {
        outputError(`Site not found: sites/${args.slug}`);
        return;
      }

      let projectId = '';
      let orgId = '';
      if (fs.existsSync(projectJsonPath)) {
        try {
          const pj = JSON.parse(fs.readFileSync(projectJsonPath, 'utf8'));
          projectId = pj.projectId || '';
          orgId = pj.orgId || '';
        } catch {/* ignore */}
      }

      const token = process.env.VERCEL_TOKEN || '';
      const apiBase = 'https://api.vercel.com';

      if (!token) {
        console.log(`[gad site link] VERCEL_TOKEN not set — printing manual commands.`);
        console.log('');
        console.log(`From sites/${args.slug}/:`);
        console.log(`  vercel domains add ${args.domain}`);
        console.log(`  vercel alias set ${args.domain}`);
        if (args.redirect === 'www') {
          console.log(`  vercel domains add www.${args.domain}`);
          console.log(`  # then in dashboard: redirect www.${args.domain} → ${args.domain}`);
        } else if (args.redirect === 'apex') {
          console.log(`  vercel domains add www.${args.domain}`);
          console.log(`  # then in dashboard: redirect ${args.domain} → www.${args.domain}`);
        }
        console.log('');
        console.log('At your DNS registrar, add:');
        console.log(`  A     @     76.76.21.21`);
        console.log(`  CNAME www   cname.vercel-dns.com`);
        console.log('');
        console.log(`To enable one-call automation: gad env set VERCEL_TOKEN <token> --projectid global`);
        return;
      }

      if (!projectId) {
        outputError(`No Vercel project linked at sites/${args.slug}/.vercel/project.json. Run \`vercel link\` from sites/${args.slug}/ first.`);
        return;
      }

      // Fire the Vercel API request.
      console.log(`[gad site link] attaching ${args.domain} to project ${projectId} ...`);
      const url = `${apiBase}/v10/projects/${projectId}/domains${orgId ? `?teamId=${orgId}` : ''}`;
      const body = JSON.stringify({ name: args.domain });
      const headers = {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      };

      // Use Node's built-in fetch (Node 18+).
      (async () => {
        try {
          const res = await fetch(url, { method: 'POST', headers, body });
          const txt = await res.text();
          if (!res.ok) {
            console.error(`[gad site link] Vercel API ${res.status}: ${txt}`);
            console.error('');
            console.error(`Falling back to manual commands. From sites/${args.slug}/:`);
            console.error(`  vercel domains add ${args.domain}`);
            console.error(`  vercel alias set ${args.domain}`);
            process.exit(1);
          }
          let parsed = {};
          try { parsed = JSON.parse(txt); } catch {/* ignore */}
          console.log(`[gad site link] domain attached.`);
          if (parsed.verification && Array.isArray(parsed.verification) && parsed.verification.length) {
            console.log('');
            console.log('DNS verification required — add at your registrar:');
            for (const v of parsed.verification) {
              console.log(`  ${v.type || '?'}  ${v.domain || args.domain}  ${v.value || ''}`);
            }
          } else {
            console.log('');
            console.log('At your DNS registrar, add:');
            console.log(`  A     @     76.76.21.21`);
            console.log(`  CNAME www   cname.vercel-dns.com`);
          }
        } catch (err) {
          outputError(`Vercel API call failed: ${err.message}`);
        }
      })();
    },
  });

  return defineCommand({
    meta: {
      name: 'site',
      description:
        'GAD planning / landing site (Next.js app under vendor/get-anything-done/site): compile static extract or serve it. Not preserved generation builds — use `gad play` or `gad generation open` for those.',
    },
    subCommands: { compile: siteCompileCmd, serve: siteServeCmd, new: siteNewCmd, link: siteLinkCmd },
  });
}

module.exports = { createSiteCommand };
module.exports.register = (ctx) => ({ site: createSiteCommand(ctx.common) });
