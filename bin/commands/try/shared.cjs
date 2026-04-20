'use strict';

const fs = require('fs');
const path = require('path');

function tryPaths() {
  const cwd = process.cwd();
  return {
    cwd,
    sandboxRoot: path.join(cwd, '.gad-try'),
  };
}

function slugifyRef(ref) {
  const normalizeSegment = (segment) => segment.replace(/\.git$/i, '').toLowerCase().replace(/[^a-z0-9-]/g, '-');

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
      continue;
    }
    if (/^\s+-\s+/.test(line) && currentKey) {
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
    let match;
    while ((match = pattern.exec(bodyAfterFrontmatter)) !== null) {
      const cleaned = match[0].replace(/\s+/g, ' ').trim();
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
      if (fs.existsSync(tmpBase)) fs.rmSync(tmpBase, { recursive: true, force: true });
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
      for (const preferred of ['SKILL.md', 'skill.md']) {
        const hit = entries.find((entry) => entry.isFile() && entry.name === preferred);
        if (hit) return path.join(dir, preferred);
      }
      for (const entry of entries) {
        if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
          const nested = walkForSkillMd(path.join(dir, entry.name), depth + 1);
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

  const gitDir = path.join(sandboxDir, '.git');
  if (fs.existsSync(gitDir)) {
    try { fs.rmSync(gitDir, { recursive: true, force: true }); } catch {}
  }

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
    'staged_by: gad-try',
    '---',
    '',
    `# Provenance — ${resolved.slug}`,
    '',
    `Staged by \`gad try\` from ${resolved.kind} source: ${resolved.source}`,
    '',
    '## Declared requires',
    deps.requires.length === 0 ? '_(none declared)_' : deps.requires.map((entry) => `- ${entry}`).join('\n'),
    '',
    '## Declared installs',
    deps.installs.length === 0 ? '_(none declared)_' : deps.installs.map((entry) => `- ${entry}`).join('\n'),
    '',
    '## Implicit (body-scanned) install commands',
    deps.implicit.length === 0 ? '_(no pip/npm/brew/curl install commands found in SKILL.md body)_' : deps.implicit.map((entry) => `- \`${entry}\``).join('\n'),
    '',
    '## Declared outputs',
    deps.outputs.length === 0 ? '_(none declared — artifacts may land in cwd)_' : deps.outputs.map((entry) => `- ${entry}`).join('\n'),
    '',
  ].join('\n');
  fs.writeFileSync(path.join(sandboxDir, 'PROVENANCE.md'), body);
}

function buildHandoffPrompt(resolved) {
  return [
    `Invoke the skill at .gad-try/${resolved.slug}/SKILL.md on this directory.`,
    'Follow its instructions exactly. When done, tell me what artifacts it produced.',
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
    'likely producing files next to `.gad-try/`.',
    '',
    "## When you're done",
    '',
    '```sh',
    `gad try cleanup ${resolved.slug}    # remove this sandbox`,
    '```',
    '',
    'If the skill installed system packages (pip / npm / brew), cleanup will',
    'print the suggested uninstall commands but will NOT run them — you',
    'decide whether to roll them back.',
    '',
  ].join('\n');
  fs.writeFileSync(path.join(sandboxDir, 'ENTRY.md'), body);
}

function dim(value) {
  return value;
}

function printConsentGate(deps, resolved) {
  console.log('');
  console.log(`  ${dim('Source:')}  ${resolved.source} (${resolved.kind})`);
  console.log(`  ${dim('Slug:')}    ${resolved.slug}`);
  console.log('');
  if (deps.requires.length > 0) {
    console.log('  Requires (advisory — not checked):');
    for (const required of deps.requires) console.log(`    - ${required}`);
    console.log('');
  }
  if (deps.installs.length > 0) {
    console.log('  Declared installs (skill will run these when invoked):');
    for (const install of deps.installs) console.log(`    ! ${install}`);
    console.log('');
  }
  if (deps.implicit.length > 0) {
    console.log('  Implicit installs found in SKILL.md body:');
    for (const install of deps.implicit) console.log(`    ? ${install}`);
    console.log('');
  }
  if (deps.requires.length === 0 && deps.installs.length === 0 && deps.implicit.length === 0) {
    console.log('  No install commands declared or detected in SKILL.md.');
    console.log('  Sandbox will be staged with no system changes.');
    console.log('');
  }
}

module.exports = {
  buildHandoffPrompt,
  copyToClipboardSync,
  extractSkillDependencies,
  parseFrontmatterLoose,
  printConsentGate,
  resolveTrySource,
  slugifyRef,
  stageTrySandbox,
  tryPaths,
  writeTryEntry,
  writeTryProvenance,
};
