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
      description: 'Bootstrap a new site from the GAD site template (Next.js 16 + Tailwind v4 + VCS). Use --template <slug> to clone an existing site instead.',
    },
    args: {
      slug: { type: 'positional', description: 'Slug for the new site (e.g. my-site)', required: true },
      'target-dir': { type: 'string', description: 'Override destination directory. Defaults to sites/<slug> in repo root.', default: '' },
      template: { type: 'string', description: "Template source. 'gad' (default) = lib/site-template; or an existing site slug under sites/ to clone.", default: 'gad' },
      'gh-init': { type: 'boolean', description: 'Run `gh repo create` after scaffolding.', default: false },
      'gh-org': { type: 'string', description: 'GitHub org/user for --gh-init. Defaults to personal account.', default: '' },
      'vercel-link': { type: 'boolean', description: 'Run `vercel link --project=<slug>` after scaffolding.', default: false },
      'vercel-team': { type: 'string', description: 'Vercel team scope for --vercel-link.', default: '' },
      'dry-run': { type: 'boolean', description: 'Print the file plan without writing anything.', default: false },
    },
    run({ args }) {
      const fs = require('fs');

      const dryRun = args['dry-run'] === true || args.dryRun === true;
      const doGhInit = args['gh-init'] === true || args.ghInit === true;
      const doVercelLink = args['vercel-link'] === true || args.vercelLink === true;
      const ghOrg = args['gh-org'] || args.ghOrg || '';
      const vercelTeam = args['vercel-team'] || args.vercelTeam || '';

      const repoRoot = deps.findRepoRoot();
      const targetDir = args['target-dir']
        ? path.resolve(args['target-dir'])
        : path.join(repoRoot, 'sites', args.slug);

      // ── Template kind resolution ──────────────────────────────────────────
      const templateArg = args.template || 'gad';

      if (templateArg === 'gad') {
        // Use lib/site-template generator (primary path).
        const { generateSite, addToPnpmWorkspace, runGhInit, runVercelLink } = require('../../lib/site-template/index.cjs');

        if (!dryRun && fs.existsSync(targetDir)) {
          outputError(`Target directory already exists: ${targetDir}`);
          return;
        }

        console.log(`[gad site new] scaffolding ${args.slug} → ${targetDir}${dryRun ? ' (dry-run)' : ''}`);

        try {
          const result = generateSite({ slug: args.slug, targetDir, dryRun });

          if (result.errors.length) {
            for (const e of result.errors) outputError(e);
            if (!dryRun) return; // abort on real errors; dry-run continues
          }

          if (dryRun) {
            console.log('');
            console.log(`File plan (${result.files.length} files):`);
            for (const f of result.files) console.log(`  ${f}`);
            console.log('');
            // Dry-run pnpm-workspace check.
            const wsPath = path.join(repoRoot, 'pnpm-workspace.yaml');
            const wsResult = addToPnpmWorkspace({ slug: args.slug, workspaceYamlPath: wsPath, dryRun: true });
            if (wsResult.reason && wsResult.reason !== 'dry-run') {
              console.log(`  [pnpm-workspace] ${wsResult.reason}`);
            }
            if (doGhInit) runGhInit({ slug: args.slug, org: ghOrg, targetDir, dryRun: true });
            if (doVercelLink) runVercelLink({ slug: args.slug, team: vercelTeam, targetDir, dryRun: true });
            return;
          }

          // Append `sites/<slug>` to pnpm-workspace.yaml (idempotent — no-op
          // if a `sites/*` glob or explicit entry already covers it).
          const wsPath = path.join(repoRoot, 'pnpm-workspace.yaml');
          const wsResult = addToPnpmWorkspace({ slug: args.slug, workspaceYamlPath: wsPath });
          if (wsResult.touched) {
            console.log(`[pnpm-workspace] ${wsResult.reason}`);
          } else {
            console.log(`[pnpm-workspace] no-op (${wsResult.reason})`);
          }

          if (doGhInit) runGhInit({ slug: args.slug, org: ghOrg, targetDir });
          if (doVercelLink) runVercelLink({ slug: args.slug, team: vercelTeam, targetDir });

          const slugUpper = args.slug.replace(/-/g, '_').toUpperCase();
          console.log('');
          console.log(`[gad site new] done! ${result.files.length} files written to ${targetDir}`);
          console.log('');
          console.log('Next steps:');
          console.log(`  1. cd sites/${args.slug}`);
          if (!doVercelLink) console.log(`  2. vercel link --project=${args.slug}   # link Vercel project`);
          console.log(`  ${doVercelLink ? '2' : '3'}. cd ../.. && gad site link --slug ${args.slug} --domain <yourdomain.com>`);
          console.log(`  ${doVercelLink ? '3' : '4'}. Add VERCEL_PROJECT_ID_${slugUpper} to repo secrets`);
          console.log(`  ${doVercelLink ? '4' : '5'}. Commit + push — first push triggers the deploy workflow`);
        } catch (err) {
          outputError(`Failed to scaffold site: ${err.message}`);
        }

      } else {
        // Fallback: clone an existing site under sites/<template>.
        const templateDir = path.join(repoRoot, 'sites', templateArg);
        if (!fs.existsSync(templateDir)) {
          outputError(`Template not found: --template ${templateArg} resolves to ${templateDir}, which does not exist.`);
          return;
        }

        if (!dryRun && fs.existsSync(targetDir)) {
          outputError(`Target directory already exists: ${targetDir}`);
          return;
        }

        console.log(`[gad site new] cloning sites/${templateArg} → ${targetDir}${dryRun ? ' (dry-run)' : ''}`);

        if (dryRun) {
          console.log('[dry-run] would copy site tree + substitute slug tokens.');
          return;
        }

        try {
          copySiteTree(templateDir, targetDir);

          // Substitute source slug with new slug in text files.
          function replaceInFile(filePath) {
            if (fs.statSync(filePath).isDirectory()) return;
            const ext = path.extname(filePath);
            const safeExt = ['.md', '.json', '.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.toml', '.yml', '.yaml', '.css'];
            if (!safeExt.includes(ext)) return;
            let content;
            try { content = fs.readFileSync(filePath, 'utf8'); } catch { return; }
            const re = new RegExp(`\\b${templateArg.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'g');
            if (re.test(content)) {
              fs.writeFileSync(filePath, content.replace(re, args.slug), 'utf8');
            }
          }

          function walkReplace(dir) {
            for (const file of fs.readdirSync(dir)) {
              const fullPath = path.join(dir, file);
              if (fs.statSync(fullPath).isDirectory()) walkReplace(fullPath);
              else replaceInFile(fullPath);
            }
          }

          walkReplace(targetDir);

          const pkgPath = path.join(targetDir, 'package.json');
          if (fs.existsSync(pkgPath)) {
            const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
            pkg.name = args.slug;
            fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n', 'utf8');
          }

          console.log(`[gad site new] done! Cloned to ${targetDir}`);
        } catch (err) {
          outputError(`Failed to clone site: ${err.message}`);
        }
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
