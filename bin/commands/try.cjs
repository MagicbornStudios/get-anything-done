'use strict';
/**
 * gad try — temporary skill install flow (task 42.2-40).
 *
 * Stage an external skill into .gad-try/<slug>/ without polluting
 * ~/.claude/skills/ or the current project's .claude/skills/. Designed
 * for trialing skills before full install — codebase maps, knowledge
 * graphs, one-off artifact generators. Supports three source types:
 *   - Local slug: `gad try codebase-map` → resolves to skills/<slug>/
 *   - Git URL:    `gad try https://github.com/safishamsi/graphify`
 *   - Local path: `gad try ./my-skill/`
 *
 * Does NOT execute the skill (decision gad-18: skills are methodology
 * docs, not executable code). Writes ENTRY.md with a copy-paste handoff
 * prompt for the user's coding agent and lists any dependencies the
 * skill declared via `requires:` / `installs:` frontmatter.
 *
 * Self-contained: only Node builtins (path, fs, child_process, os).
 */

const fs = require('fs');
const path = require('path');
const { defineCommand } = require('citty');

function tryPaths() {
  const cwd = process.cwd();
  return {
    cwd,
    sandboxRoot: path.join(cwd, '.gad-try'),
  };
}

function slugifyRef(ref) {
  // Extract a kebab-case slug from any source ref — always the LAST
  // meaningful path segment.
  //   https://github.com/user/REPO         → repo
  //   https://github.com/user/REPO.git     → repo
  //   git@github.com:user/REPO.git         → repo
  //   ./foo/bar/                           → bar
  //   already-good                         → already-good
  const normalizeSegment = (s) => s.replace(/\.git$/i, '').toLowerCase().replace(/[^a-z0-9-]/g, '-');

  if (/^https?:\/\/|^git@|^git\+|^ssh:\/\//.test(ref)) {
    const cleaned = ref.replace(/^git\+/, '').replace(/[#?].*$/, '').replace(/:/g, '/');
    const segments = cleaned.split('/').filter(Boolean);
    const last = segments[segments.length - 1] || 'skill';
    return normalizeSegment(last);
  }
  if (ref.includes('/') || ref.includes('\\')) {
    return normalizeSegment(path.basename(ref.replace(/[\\]/g, '/').replace(/\/$/, '')));
  }
  return normalizeSegment(ref);
}

function parseFrontmatterLoose(body) {
  const match = body.match(/^---\s*\r?\n([\s\S]*?)\r?\n---\s*(?:\r?\n|$)/);
  if (!match) return { raw: '', fields: {} };
  const raw = match[1];
  const fields = {};
  const lines = raw.split(/\r?\n/);
  let currentKey = null;
  let currentList = null;
  for (const line of lines) {
    const keyMatch = line.match(/^([a-zA-Z_][a-zA-Z0-9_-]*):\s*(.*)$/);
    if (keyMatch) {
      currentKey = keyMatch[1];
      const value = keyMatch[2].trim();
      if (value === '' || value === '|' || value === '>-' || value === '>') {
        currentList = null;
        fields[currentKey] = '';
      } else {
        fields[currentKey] = value;
        currentList = null;
      }
    } else if (/^\s+-\s+/.test(line) && currentKey) {
      if (!currentList) {
        currentList = [];
        fields[currentKey] = currentList;
      }
      currentList.push(line.replace(/^\s+-\s+/, '').trim());
    }
  }
  return { raw, fields };
}

function extractSkillDependencies(skillBody) {
  const { fields } = parseFrontmatterLoose(skillBody);
  const requires = Array.isArray(fields.requires) ? fields.requires : (fields.requires ? [fields.requires] : []);
  const installs = Array.isArray(fields.installs) ? fields.installs : (fields.installs ? [fields.installs] : []);
  const outputs = Array.isArray(fields.outputs) ? fields.outputs : (fields.outputs ? [fields.outputs] : []);
  // Implicit: scan body for pip/npm/brew/curl install lines.
  const implicit = [];
  const bodyAfterFrontmatter = skillBody.replace(/^---\s*\r?\n[\s\S]*?\r?\n---\s*\r?\n?/, '');
  const installPatterns = [
    /\b(?:pip|pip3|pipx|uv pip)\s+install\s+[^\n`]+/g,
    /\b(?:npm|pnpm|yarn|bun)\s+(?:install|add|i)\s+[^\n`]+/g,
    /\bbrew\s+install\s+[^\n`]+/g,
    /\bcurl\s+[^\n]+\|\s*(?:bash|sh|zsh)/g,
    /\bcargo\s+install\s+[^\n`]+/g,
    /\bgo\s+install\s+[^\n`]+/g,
  ];
  for (const pattern of installPatterns) {
    let m;
    while ((m = pattern.exec(bodyAfterFrontmatter)) !== null) {
      const cleaned = m[0].replace(/\s+/g, ' ').trim();
      if (!implicit.includes(cleaned)) implicit.push(cleaned);
    }
  }
  return { requires, installs, outputs, implicit };
}

function resolveTrySource(ref, repoRoot, opts = {}) {
  const slug = slugifyRef(ref);

  if (/^https?:\/\/|^git@|^git\+|^ssh:\/\//.test(ref)) {
    const cleanRef = ref.replace(/^git\+/, '').replace(/#.*$/, '');
    let cloneUrl = cleanRef;
    let branch = null;
    const atMatch = cleanRef.match(/^(.+?@[^:]+?:[^@]+?|[a-z]+:\/\/[^@]+?)@([^\/@]+)$/);
    if (atMatch) {
      cloneUrl = atMatch[1];
      branch = atMatch[2];
    }
    if (opts.branch) branch = opts.branch;

    const tmpBase = path.join(require('os').tmpdir(), `gad-try-clone-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
    const branchAttempts = branch ? [branch] : [null, 'v1', 'main', 'master'];
    let cloneErr = null;
    let cloned = false;
    for (const attempt of branchAttempts) {
      if (fs.existsSync(tmpBase)) {
        fs.rmSync(tmpBase, { recursive: true, force: true });
      }
      const cloneArgs = ['clone', '--depth', '1'];
      if (attempt) cloneArgs.push('-b', attempt);
      cloneArgs.push(cloneUrl, tmpBase);
      try {
        require('child_process').execFileSync('git', cloneArgs, { stdio: ['ignore', 'pipe', 'pipe'] });
        cloned = true;
        break;
      } catch (err) {
        cloneErr = err;
      }
    }
    if (!cloned) {
      throw new Error(`git clone failed for ${cleanRef}: ${cloneErr?.stderr?.toString()?.slice(0, 200) || cloneErr?.message || 'unknown error'}`);
    }

    function walkForSkillMd(dir, depth) {
      if (depth > 3) return null;
      let entries;
      try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return null; }
      for (const pref of ['SKILL.md', 'skill.md']) {
        const hit = entries.find((e) => e.isFile() && e.name === pref);
        if (hit) return path.join(dir, pref);
      }
      for (const e of entries) {
        if (e.isDirectory() && !e.name.startsWith('.') && e.name !== 'node_modules') {
          const nested = walkForSkillMd(path.join(dir, e.name), depth + 1);
          if (nested) return nested;
        }
      }
      return null;
    }

    const found = walkForSkillMd(tmpBase, 0);
    if (!found) {
      fs.rmSync(tmpBase, { recursive: true, force: true });
      throw new Error(`no SKILL.md or skill.md found in ${cleanRef} within 3 levels`);
    }
    return {
      kind: 'git-url',
      sourceDir: path.dirname(found),
      slug,
      source: cleanRef,
      cleanup: () => { try { fs.rmSync(tmpBase, { recursive: true, force: true }); } catch {} },
    };
  }

  if (ref.includes('/') || ref.includes('\\') || fs.existsSync(ref)) {
    const absPath = path.resolve(ref);
    if (!fs.existsSync(absPath)) throw new Error(`path does not exist: ${ref}`);
    const skillPath = fs.statSync(absPath).isFile() && /SKILL\.md$/i.test(absPath)
      ? absPath
      : path.join(absPath, 'SKILL.md');
    if (!fs.existsSync(skillPath)) throw new Error(`no SKILL.md at ${skillPath}`);
    return { kind: 'local-path', sourceDir: path.dirname(skillPath), slug, source: absPath, cleanup: () => {} };
  }

  const slugDir = path.join(repoRoot, 'skills', ref);
  const slugSkill = path.join(slugDir, 'SKILL.md');
  if (fs.existsSync(slugSkill)) {
    return { kind: 'local-slug', sourceDir: slugDir, slug: ref, source: path.relative(repoRoot, slugDir), cleanup: () => {} };
  }

  throw new Error(`could not resolve skill ref "${ref}" — not a URL, not a path, not a skills/ slug`);
}

function stageTrySandbox(resolved, sandboxRoot) {
  const sandboxDir = path.join(sandboxRoot, resolved.slug);
  if (fs.existsSync(sandboxDir)) {
    throw new Error(`sandbox already exists at ${path.relative(process.cwd(), sandboxDir)} — run \`gad try cleanup ${resolved.slug}\` first`);
  }
  fs.mkdirSync(sandboxDir, { recursive: true });
  fs.cpSync(resolved.sourceDir, sandboxDir, { recursive: true });
  // Strip .git/ from cloned sandboxes (task 42.2-40.b).
  const gitDir = path.join(sandboxDir, '.git');
  if (fs.existsSync(gitDir)) {
    try { fs.rmSync(gitDir, { recursive: true, force: true }); } catch {}
  }
  // Normalize lowercase skill.md -> SKILL.md.
  const upper = path.join(sandboxDir, 'SKILL.md');
  const lower = path.join(sandboxDir, 'skill.md');
  if (!fs.existsSync(upper) && fs.existsSync(lower)) {
    try {
      fs.renameSync(lower, upper);
      console.warn('  Note: source used lowercase skill.md — normalized to SKILL.md in sandbox.');
    } catch {
      console.warn('  Note: source used lowercase skill.md — filesystem may be case-insensitive; downstream reads target SKILL.md.');
    }
  }
  return sandboxDir;
}

function writeTryProvenance(sandboxDir, resolved, deps) {
  const body = [
    '---',
    `slug: ${resolved.slug}`,
    `source: ${resolved.source}`,
    `kind: ${resolved.kind}`,
    `staged_on: ${new Date().toISOString().slice(0, 10)}`,
    `staged_by: gad-try`,
    '---',
    '',
    `# Provenance — ${resolved.slug}`,
    '',
    `Staged by \`gad try\` from ${resolved.kind} source: ${resolved.source}`,
    '',
    '## Declared requires',
    deps.requires.length === 0 ? '_(none declared)_' : deps.requires.map((r) => `- ${r}`).join('\n'),
    '',
    '## Declared installs',
    deps.installs.length === 0 ? '_(none declared)_' : deps.installs.map((r) => `- ${r}`).join('\n'),
    '',
    '## Implicit (body-scanned) install commands',
    deps.implicit.length === 0 ? '_(no pip/npm/brew/curl install commands found in SKILL.md body)_' : deps.implicit.map((r) => `- \`${r}\``).join('\n'),
    '',
    '## Declared outputs',
    deps.outputs.length === 0 ? '_(none declared — artifacts may land in cwd)_' : deps.outputs.map((r) => `- ${r}`).join('\n'),
    '',
  ].join('\n');
  fs.writeFileSync(path.join(sandboxDir, 'PROVENANCE.md'), body);
}

function buildHandoffPrompt(resolved) {
  return [
    `Invoke the skill at .gad-try/${resolved.slug}/SKILL.md on this directory.`,
    `Follow its instructions exactly. When done, tell me what artifacts it produced.`,
  ].join(' ');
}

function copyToClipboardSync(text) {
  const { spawnSync } = require('child_process');
  const attempts = [];
  if (process.platform === 'win32') {
    attempts.push({ cmd: 'clip', args: [] });
  } else if (process.platform === 'darwin') {
    attempts.push({ cmd: 'pbcopy', args: [] });
  } else {
    if (process.env.WAYLAND_DISPLAY) attempts.push({ cmd: 'wl-copy', args: [] });
    attempts.push({ cmd: 'xclip', args: ['-selection', 'clipboard'] });
    attempts.push({ cmd: 'xsel', args: ['--clipboard', '--input'] });
    if (!process.env.WAYLAND_DISPLAY) attempts.push({ cmd: 'wl-copy', args: [] });
  }
  for (const { cmd, args } of attempts) {
    try {
      const result = spawnSync(cmd, args, { input: text, stdio: ['pipe', 'ignore', 'ignore'] });
      if (result.status === 0 && !result.error) return cmd;
    } catch {}
  }
  return null;
}

function writeTryEntry(sandboxDir, resolved, skillBody) {
  const { fields } = parseFrontmatterLoose(skillBody);
  const skillName = fields.name || resolved.slug;
  const cwd = path.dirname(sandboxDir).replace(new RegExp(`[\\\\/]?\\.gad-try$`), '');
  const prompt = buildHandoffPrompt(resolved);
  const body = [
    `# ${skillName} — try entry`,
    '',
    `Staged by \`gad try\` on ${new Date().toISOString().slice(0, 10)}.`,
    '',
    '## Where the sandbox is',
    '',
    `The sandbox lives at \`${sandboxDir}\` (relative to whatever directory`,
    'you ran `gad try` in — the sandbox is always under `<cwd>/.gad-try/<slug>/`,',
    'regardless of whether `gad` itself is globally or locally installed).',
    '',
    '## How to run it',
    '',
    'Open your coding agent (Claude Code, Codex, Cursor, Windsurf, etc.)',
    `in **${cwd}** (the directory that contains \`.gad-try/\`) and paste:`,
    '',
    '```',
    prompt,
    '```',
    '',
    'The exact prompt above was also copied to your clipboard when `gad try`',
    'finished, if your OS has a clipboard tool installed (clip.exe on Windows,',
    'pbcopy on macOS, xclip/xsel/wl-copy on Linux).',
    '',
    'Or, if the skill ships its own slash command and is wired into your',
    'runtime, use that command directly — the skill body will tell you what',
    'syntax it expects.',
    '',
    '## Where artifacts will land',
    '',
    'Read `PROVENANCE.md` in this sandbox for declared outputs. If the skill',
    'does not declare outputs, it will write to the current working directory —',
    `likely producing files next to \`.gad-try/\`.`,
    '',
    "## When you're done",
    '',
    `\`\`\`sh`,
    `gad try cleanup ${resolved.slug}    # remove this sandbox`,
    `\`\`\``,
    '',
    'If the skill installed system packages (pip / npm / brew), cleanup will',
    'print the suggested uninstall commands but will NOT run them — you',
    'decide whether to roll them back.',
    '',
  ].join('\n');
  fs.writeFileSync(path.join(sandboxDir, 'ENTRY.md'), body);
}

function dim(s) { return s; }

function printConsentGate(deps, resolved) {
  console.log('');
  console.log(`  ${dim('Source:')}  ${resolved.source} (${resolved.kind})`);
  console.log(`  ${dim('Slug:')}    ${resolved.slug}`);
  console.log('');
  if (deps.requires.length > 0) {
    console.log('  Requires (advisory — not checked):');
    for (const r of deps.requires) console.log(`    - ${r}`);
    console.log('');
  }
  if (deps.installs.length > 0) {
    console.log('  Declared installs (skill will run these when invoked):');
    for (const r of deps.installs) console.log(`    ! ${r}`);
    console.log('');
  }
  if (deps.implicit.length > 0) {
    console.log('  Implicit installs found in SKILL.md body:');
    for (const r of deps.implicit) console.log(`    ? ${r}`);
    console.log('');
  }
  if (deps.requires.length === 0 && deps.installs.length === 0 && deps.implicit.length === 0) {
    console.log('  No install commands declared or detected in SKILL.md.');
    console.log('  Sandbox will be staged with no system changes.');
    console.log('');
  }
}

function createTryCommand() {
  const tryStage = defineCommand({
    meta: { name: 'stage', description: 'Stage a skill into .gad-try/<slug>/ (default subcommand)' },
    args: {
      ref: { type: 'positional', description: 'slug | path | git url', required: true },
      yes: { type: 'boolean', description: 'Skip consent gate (scripted mode)', default: false },
      branch: { type: 'string', description: 'Explicit branch/tag for git sources (skips fallback probe). Task 42.2-40.b.', default: '' },
    },
    run({ args }) {
      const repoRoot = path.resolve(__dirname, '..', '..');
      const { cwd, sandboxRoot } = tryPaths();

      let resolved;
      try {
        resolved = resolveTrySource(args.ref, repoRoot, { branch: args.branch || undefined });
      } catch (err) {
        console.error(`gad try: ${err.message}`);
        process.exit(1);
      }

      try {
        const upperPath = path.join(resolved.sourceDir, 'SKILL.md');
        const lowerPath = path.join(resolved.sourceDir, 'skill.md');
        const skillPath = fs.existsSync(upperPath) ? upperPath : lowerPath;
        const skillBody = fs.readFileSync(skillPath, 'utf8');
        const deps = extractSkillDependencies(skillBody);

        console.log(`gad try ${resolved.slug}`);
        printConsentGate(deps, resolved);

        if (!args.yes && (deps.installs.length > 0 || deps.implicit.length > 0)) {
          console.log('  Note: staging is non-destructive. Install commands above');
          console.log('  will only run if you invoke the skill via your coding agent.');
          console.log('');
        }

        const sandboxDir = stageTrySandbox(resolved, sandboxRoot);
        writeTryProvenance(sandboxDir, resolved, deps);
        writeTryEntry(sandboxDir, resolved, skillBody);

        const prompt = buildHandoffPrompt(resolved);
        const clipboardTool = copyToClipboardSync(prompt);

        console.log('');
        console.log(`  Staged ${path.relative(cwd, sandboxDir)}`);
        console.log(`  Handoff prompt: ${path.relative(cwd, path.join(sandboxDir, 'ENTRY.md'))}`);
        if (clipboardTool) {
          console.log(`  Clipboard: copied via ${clipboardTool}`);
        } else {
          console.log(`  Clipboard: (no clipboard tool found — prompt is in ENTRY.md)`);
        }
        console.log('');
        console.log(`Paste this into your coding agent running in ${cwd}:`);
        console.log('');
        console.log(`  ${prompt}`);
        console.log('');
        console.log('Then:');
        console.log(`  gad try status                     # list all staged sandboxes`);
        console.log(`  gad try cleanup ${resolved.slug}   # remove this sandbox when done`);
      } finally {
        resolved.cleanup();
      }
    },
  });

  const tryStatus = defineCommand({
    meta: { name: 'status', description: 'List staged .gad-try/ sandboxes' },
    run() {
      const { sandboxRoot } = tryPaths();
      if (!fs.existsSync(sandboxRoot)) {
        console.log('No staged tries in this directory.');
        return;
      }
      const entries = fs.readdirSync(sandboxRoot, { withFileTypes: true }).filter((e) => e.isDirectory());
      if (entries.length === 0) {
        console.log('No staged tries in this directory.');
        return;
      }
      console.log(`Staged tries in ${path.relative(process.cwd(), sandboxRoot) || '.gad-try'}:`);
      for (const e of entries) {
        const provPath = path.join(sandboxRoot, e.name, 'PROVENANCE.md');
        let source = '(unknown)';
        if (fs.existsSync(provPath)) {
          const body = fs.readFileSync(provPath, 'utf8');
          const m = body.match(/^source:\s*(.+)$/m);
          if (m) source = m[1].trim();
        }
        console.log(`  - ${e.name}    ${source}`);
      }
      console.log('');
      console.log('Commands:');
      console.log('  gad try cleanup <slug>   # remove one sandbox');
      console.log('  gad try cleanup --all    # remove all sandboxes');
    },
  });

  const tryCleanup = defineCommand({
    meta: { name: 'cleanup', description: 'Remove a staged .gad-try/<slug>/ sandbox' },
    args: {
      slug: { type: 'positional', description: 'sandbox slug to remove', required: false },
      all: { type: 'boolean', description: 'Remove all staged sandboxes', default: false },
    },
    run({ args }) {
      const { sandboxRoot } = tryPaths();
      if (!fs.existsSync(sandboxRoot)) {
        console.log('No .gad-try/ directory in cwd — nothing to clean up.');
        return;
      }

      const toRemove = [];
      if (args.all) {
        for (const e of fs.readdirSync(sandboxRoot, { withFileTypes: true })) {
          if (e.isDirectory()) toRemove.push(e.name);
        }
      } else {
        if (!args.slug) {
          console.error('gad try cleanup: pass a <slug> or --all');
          process.exit(1);
        }
        const dir = path.join(sandboxRoot, args.slug);
        if (!fs.existsSync(dir)) {
          console.error(`No sandbox at ${path.relative(process.cwd(), dir)}`);
          process.exit(1);
        }
        toRemove.push(args.slug);
      }

      for (const slug of toRemove) {
        const dir = path.join(sandboxRoot, slug);
        const provPath = path.join(dir, 'PROVENANCE.md');
        if (fs.existsSync(provPath)) {
          const body = fs.readFileSync(provPath, 'utf8');
          const installsSection = body.match(/## Declared installs\s*\n([\s\S]*?)\n##/);
          const implicitSection = body.match(/## Implicit.*?install commands\s*\n([\s\S]*?)\n##/);
          const allInstallLines = [];
          for (const section of [installsSection, implicitSection]) {
            if (section && !/\(none/i.test(section[1]) && !/no pip/i.test(section[1])) {
              for (const line of section[1].split('\n')) {
                const trimmed = line.replace(/^[-!?\s]+/, '').replace(/`/g, '').trim();
                if (trimmed) allInstallLines.push(trimmed);
              }
            }
          }
          if (allInstallLines.length > 0) {
            console.log(`  ${slug}: skill declared or referenced these installs:`);
            for (const l of allInstallLines) console.log(`    ${l}`);
            console.log('  (not rolled back automatically — run manually if needed)');
          }
        }
        fs.rmSync(dir, { recursive: true, force: true });
        console.log(`  Removed ${path.relative(process.cwd(), dir)}`);
      }

      try {
        if (fs.readdirSync(sandboxRoot).length === 0) {
          fs.rmdirSync(sandboxRoot);
        }
      } catch {}
    },
  });

  const tryHelp = defineCommand({
    meta: { name: 'help', description: 'Show gad try usage' },
    run() {
      console.log('gad try — temporary skill install flow');
      console.log('');
      console.log('Stages an external skill into .gad-try/<slug>/ in your current');
      console.log('directory — NOT in ~/.claude/skills/ or any global location.');
      console.log('The sandbox is always under <cwd>/.gad-try/, regardless of');
      console.log('whether the gad binary is installed globally or locally, so cd');
      console.log('into the project where you want the sandbox to live before');
      console.log('running gad try.');
      console.log('');
      console.log('Usage:');
      console.log('  gad try <slug|path|url>       Stage a skill into .gad-try/<slug>/');
      console.log('  gad try status                List staged sandboxes in cwd');
      console.log('  gad try cleanup <slug>        Remove one sandbox');
      console.log('  gad try cleanup --all         Remove all sandboxes in cwd');
      console.log('');
      console.log('Examples:');
      console.log('  cd ~/my-project');
      console.log('  gad try gad-help                                  # local slug from framework skills/');
      console.log('  gad try ./my-skill/                               # local path');
      console.log('  gad try https://github.com/safishamsi/graphify    # git url, any branch');
      console.log('');
      console.log('On stage: the handoff prompt is copied to your clipboard');
      console.log('(clip.exe / pbcopy / xclip / xsel / wl-copy depending on OS),');
      console.log('so you can immediately paste it into your coding agent.');
      console.log('Silent degradation if no clipboard tool is installed.');
    },
  });

  const tryCmd = defineCommand({
    meta: { name: 'try', description: 'Stage a skill into .gad-try/<slug>/ without touching ~/.claude/skills/ or the project skill catalog' },
    subCommands: { stage: tryStage, status: tryStatus, cleanup: tryCleanup, help: tryHelp },
  });

  return { tryCmd };
}

module.exports = { createTryCommand };
