'use strict';
/**
 * gad evolution images — skill image inventory + optional OpenAI generation
 *
 * Required deps: splitCsvList, getProtoSkillGlobalDir, listSkillDirs, readSkillFrontmatter
 */

const path = require('path');
const fs = require('fs');
const { defineCommand } = require('citty');
const { generateOpenAiImage } = require('../../lib/openai-image.cjs');

function firstExistingImagePath(dir, candidates = []) {
  for (const rel of candidates) {
    const full = path.join(dir, rel);
    if (fs.existsSync(full)) return full;
  }
  return null;
}

function sanitizeSkillPromptText(input, maxLen = 420) {
  const raw = String(input || '').trim();
  if (!raw) return '';
  let text = raw
    .replace(/\r?\n+/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/^\s*[>|-]+\s*$/g, '')
    .replace(/\b(?:kill|weapon|blood|gore|violence|violent)\b/gi, '')
    .trim();
  if (!text || text === '>-') return '';
  if (text.length > maxLen) text = `${text.slice(0, maxLen - 1).trimEnd()}.`;
  return text;
}

function buildSafeSkillImagePrompt({ id, name, description }) {
  const label = sanitizeSkillPromptText(name || id, 120) || sanitizeSkillPromptText(id, 120) || 'skill';
  const purpose = sanitizeSkillPromptText(description, 320);
  const parts = [
    `Create a square icon-style illustration for the software skill "${label}".`,
    purpose ? `Purpose: ${purpose}` : '',
    'Use abstract symbols and tooling motifs only.',
    'No people, no faces, no text, no logos, no brand marks.',
    'Non-violent, safe-for-work, high contrast, clean silhouette, minimal background.',
  ];
  return parts.filter(Boolean).join(' ');
}

function skillImagePromptDataPath(repoRoot) {
  return path.join(repoRoot, 'data', 'skill-image-prompts.json');
}

function loadSkillImagePromptData(repoRoot) {
  const file = skillImagePromptDataPath(repoRoot);
  if (!fs.existsSync(file)) return null;
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return null; }
}

function writeSkillImagePromptData(repoRoot, payload) {
  const file = skillImagePromptDataPath(repoRoot);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(payload, null, 2)}\n`);
  return file;
}

function buildSkillImagePromptPayload(records, repoRoot) {
  const globalStyle = [
    'Magicborn narrative style.',
    'Game icon / spell glyph aesthetic.',
    'Centered composition.',
    'High-contrast readability at small sizes.',
    'No text, no logos, no UI chrome.',
    'Painterly-fantasy energy with clean silhouette.',
  ];
  return {
    version: 1,
    updatedAt: new Date().toISOString(),
    globalStyle,
    items: records.map((r) => ({
      id: r.id,
      name: r.name,
      kind: r.kind,
      runtime: r.runtime || null,
      targetImagePath: path.relative(repoRoot, r.targetImagePath).replace(/\\/g, '/'),
      prompt: r.prompt,
    })),
  };
}

function mergeInventoryWithPromptData(records, promptData, repoRoot) {
  if (!promptData || !Array.isArray(promptData.items)) return records;
  const byId = new Map(promptData.items.map((it) => [String(it.id || '').trim(), it]).filter(([id]) => id));
  const stylePrefix = Array.isArray(promptData.globalStyle) ? promptData.globalStyle.join(' ') : '';
  return records.map((r) => {
    const item = byId.get(r.id);
    if (!item) return r;
    const prompt = sanitizeSkillPromptText(item.prompt, 800);
    const targetImagePath = item.targetImagePath
      ? path.resolve(repoRoot, String(item.targetImagePath))
      : r.targetImagePath;
    return {
      ...r,
      prompt: prompt || sanitizeSkillPromptText(`${stylePrefix} ${r.prompt}`, 800),
      targetImagePath,
    };
  });
}

function parseImageInputFile(inputFile) {
  const resolved = path.resolve(inputFile);
  const src = fs.readFileSync(resolved, 'utf8');
  if (resolved.endsWith('.json')) {
    const parsed = JSON.parse(src);
    if (Array.isArray(parsed)) return parsed;
    if (parsed && Array.isArray(parsed.items)) return parsed.items;
    throw new Error(`Expected array or { items: [] } JSON in ${resolved}`);
  }
  const rows = [];
  for (const line of src.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    rows.push(JSON.parse(trimmed));
  }
  return rows;
}

function loadLocalEnvFile(repoRoot, relPath = '.env') {
  const envPath = path.resolve(repoRoot, relPath);
  if (!fs.existsSync(envPath)) return;
  const src = fs.readFileSync(envPath, 'utf8');
  for (const line of src.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const kv = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!kv) continue;
    const key = kv[1];
    let value = kv[2] || '';
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = value;
  }
}

// `generateImageWithOpenAI` moved into lib/openai-image.cjs so the new
// `gad generate image` + `gad media` commands (and the desktop app via
// sidecar) can reuse the same HTTP path. The local binding below is
// preserved as a thin alias to minimise churn at call sites.
const generateImageWithOpenAI = generateOpenAiImage;

function createEvolutionImagesCommand(deps) {
  const { splitCsvList, getProtoSkillGlobalDir, listSkillDirs, readSkillFrontmatter } = deps;
  const repoRoot = path.resolve(__dirname, '..', '..');

  function buildSkillImageInventory(args = {}) {
    const scopes = new Set(splitCsvList(args.scope, ['official', 'proto', 'installed']));
    const includeGlobal = Boolean(args['include-global']);
    const runtimeFilter = new Set(splitCsvList(args.runtime, ['claude', 'codex', 'cursor', 'windsurf', 'augment', 'copilot', 'antigravity']));
    const records = [];

    function pushRecord(base) {
      const imageCandidates = ['image.png', 'cover.png', 'icon.png', 'preview.png'];
      const existingImage = firstExistingImagePath(base.skillDir, imageCandidates);
      const outputPath = base.outputPath || path.join(repoRoot, 'site', 'public', 'skills', `${base.id}.png`);
      const hasOutputImage = fs.existsSync(outputPath);
      const promptSeed = buildSafeSkillImagePrompt({
        id: base.id,
        name: base.name || base.id,
        description: base.description,
      });
      records.push({
        id: base.id,
        name: base.name || base.id,
        kind: base.kind,
        runtime: base.runtime || null,
        sourceDir: base.skillDir,
        skillFile: base.skillFile,
        hasImage: Boolean(existingImage || hasOutputImage),
        imagePath: existingImage || (hasOutputImage ? outputPath : null),
        targetImagePath: outputPath,
        description: base.description || null,
        prompt: promptSeed,
      });
    }

    if (scopes.has('official')) {
      const officialRoot = path.join(repoRoot, 'skills');
      for (const entry of listSkillDirs(officialRoot)) {
        if (entry.id === 'candidates' || entry.id === 'emergent' || entry.id === 'proto-skills') continue;
        const meta = readSkillFrontmatter(entry.skillFile);
        pushRecord({
          id: entry.id,
          name: meta.name || entry.id,
          description: meta.description,
          kind: 'official',
          skillDir: entry.dir,
          skillFile: entry.skillFile,
          outputPath: path.join(repoRoot, 'site', 'public', 'skills', `${entry.id}.png`),
        });
      }
    }

    if (scopes.has('proto')) {
      const protoRoot = path.join(repoRoot, '.planning', 'proto-skills');
      for (const entry of listSkillDirs(protoRoot)) {
        const meta = readSkillFrontmatter(entry.skillFile);
        pushRecord({
          id: entry.id,
          name: meta.name || entry.id,
          description: meta.description,
          kind: 'proto',
          skillDir: entry.dir,
          skillFile: entry.skillFile,
          outputPath: path.join(entry.dir, 'image.png'),
        });
      }
    }

    if (scopes.has('installed')) {
      const localRuntimeRoots = [
        { runtime: 'claude', dir: path.join(process.cwd(), '.claude', 'skills') },
        { runtime: 'codex', dir: path.join(process.cwd(), '.codex', 'skills') },
        { runtime: 'cursor', dir: path.join(process.cwd(), '.cursor', 'skills') },
        { runtime: 'windsurf', dir: path.join(process.cwd(), '.windsurf', 'skills') },
        { runtime: 'augment', dir: path.join(process.cwd(), '.augment', 'skills') },
        { runtime: 'copilot', dir: path.join(process.cwd(), '.github', 'skills') },
        { runtime: 'antigravity', dir: path.join(process.cwd(), '.agent', 'skills') },
        { runtime: 'agents', dir: path.join(process.cwd(), '.agents', 'skills') },
      ];
      const runtimeRoots = [...localRuntimeRoots];
      if (includeGlobal) {
        for (const runtime of ['claude', 'codex', 'cursor', 'windsurf', 'augment', 'copilot', 'antigravity']) {
          runtimeRoots.push({ runtime, dir: path.join(getProtoSkillGlobalDir(runtime), 'skills') });
        }
      }
      for (const root of runtimeRoots) {
        if (root.runtime !== 'agents' && !runtimeFilter.has(root.runtime)) continue;
        for (const entry of listSkillDirs(root.dir)) {
          const meta = readSkillFrontmatter(entry.skillFile);
          const targetDir = path.join(repoRoot, 'site', 'public', 'skills', 'installed', root.runtime);
          pushRecord({
            id: `${root.runtime}:${entry.id}`,
            name: meta.name || entry.id,
            description: meta.description,
            kind: 'installed',
            runtime: root.runtime,
            skillDir: entry.dir,
            skillFile: entry.skillFile,
            outputPath: path.join(targetDir, `${entry.id}.png`),
          });
        }
      }
    }

    records.sort((a, b) => a.id.localeCompare(b.id));
    return records;
  }

  const status = defineCommand({
    meta: { name: 'status', description: 'List official/proto/installed skills and show which are missing images' },
    args: {
      scope: { type: 'string', description: 'Comma-separated: official,proto,installed (default all three)', default: 'official,proto,installed' },
      runtime: { type: 'string', description: 'When scope includes installed: comma-separated runtimes (default all)', default: 'claude,codex,cursor,windsurf,augment,copilot,antigravity' },
      'include-global': { type: 'boolean', description: 'Also scan global runtime config dirs in home directory', default: false },
      syncPrompts: { type: 'boolean', description: 'Write/update data/skill-image-prompts.json from current inventory', default: false },
      json: { type: 'boolean', description: 'Emit full JSON inventory', default: false },
    },
    run({ args }) {
      let records = buildSkillImageInventory(args);
      const promptData = loadSkillImagePromptData(repoRoot);
      records = mergeInventoryWithPromptData(records, promptData, repoRoot);
      const missing = records.filter((r) => !r.hasImage);
      let promptFile = null;
      if (args.syncPrompts) {
        const payload = buildSkillImagePromptPayload(records, repoRoot);
        promptFile = writeSkillImagePromptData(repoRoot, payload);
      }
      if (args.json) {
        console.log(JSON.stringify({
          total: records.length,
          missing: missing.length,
          promptFile: promptFile ? path.relative(process.cwd(), promptFile) : null,
          records,
        }, null, 2));
        return;
      }
      console.log(`Skill image inventory: ${records.length} total, ${missing.length} missing`);
      const byKind = ['official', 'proto', 'installed'];
      for (const kind of byKind) {
        const rows = records.filter((r) => r.kind === kind);
        if (rows.length === 0) continue;
        const missingCount = rows.filter((r) => !r.hasImage).length;
        console.log(`  ${kind}: ${rows.length} total, ${missingCount} missing`);
      }
      if (missing.length > 0) {
        console.log('');
        console.log('Missing image targets:');
        for (const row of missing) {
          console.log(`  - ${row.id}`);
          console.log(`    skill:  ${path.relative(process.cwd(), row.skillFile)}`);
          console.log(`    target: ${path.relative(process.cwd(), row.targetImagePath)}`);
        }
        console.log('');
        console.log('Generate with: gad evolution images generate');
      }
      if (promptFile) {
        console.log('');
        console.log(`Prompt registry updated: ${path.relative(process.cwd(), promptFile)}`);
      }
    },
  });

  const generate = defineCommand({
    meta: { name: 'generate', description: 'Generate skill images via OpenAI (opt-in, requires OPENAI_API_KEY)' },
    args: {
      input: { type: 'string', description: 'JSON/JSONL file with [{ id, prompt, targetImagePath? }]. If omitted, uses inventory rows.' },
      scope: { type: 'string', description: 'Used when --input is omitted. Comma-separated: official,proto,installed', default: 'official,proto' },
      runtime: { type: 'string', description: 'Used for installed scan when --input is omitted', default: 'claude,codex,cursor,windsurf,augment,copilot,antigravity' },
      'include-global': { type: 'boolean', description: 'Used for installed scan when --input is omitted', default: false },
      'missing-only': { type: 'boolean', description: 'When using inventory rows, generate only missing images', default: true },
      'auto-prompt': { type: 'boolean', description: 'Fill missing prompt fields from skill metadata', default: true },
      model: { type: 'string', description: 'OpenAI image model', default: 'gpt-image-1' },
      size: { type: 'string', description: 'Image size', default: '1024x1024' },
      limit: { type: 'string', description: 'Max images to generate', default: '' },
      overwrite: { type: 'boolean', description: 'Overwrite files that already exist', default: false },
      'env-file': { type: 'string', description: 'Load env vars from this file before generation', default: '.env' },
      prompts: { type: 'string', description: 'Prompt registry file (default: data/skill-image-prompts.json)', default: '' },
      dryRun: { type: 'boolean', description: 'Print planned writes without calling OpenAI', default: false },
    },
    async run({ args }) {
      loadLocalEnvFile(repoRoot, args['env-file'] || '.env');
      const apiKey = process.env.OPENAI_API_KEY || '';
      if (!apiKey && !args.dryRun) {
        console.error('OPENAI_API_KEY is required for image generation.');
        console.error('Set it in your shell or in vendor/get-anything-done/.env (see .env.example).');
        process.exit(1);
      }

      let rows;
      if (args.input) {
        rows = parseImageInputFile(args.input).map((row, idx) => ({
          id: row.id || `row-${idx + 1}`,
          prompt: row.prompt || '',
          targetImagePath: row.targetImagePath || row.imagePath || '',
        }));
      } else {
        const promptFile = args.prompts ? path.resolve(args.prompts) : skillImagePromptDataPath(repoRoot);
        let invRows = buildSkillImageInventory(args);
        if (fs.existsSync(promptFile)) {
          const promptData = loadSkillImagePromptData(repoRoot) || JSON.parse(fs.readFileSync(promptFile, 'utf8'));
          invRows = mergeInventoryWithPromptData(invRows, promptData, repoRoot);
        }
        rows = invRows.map((row) => ({
          id: row.id,
          prompt: row.prompt || '',
          targetImagePath: row.targetImagePath,
          hasImage: row.hasImage,
        }));
        if (args['missing-only']) rows = rows.filter((r) => !r.hasImage);
      }

      if (args['auto-prompt']) {
        for (const row of rows) {
          if (!row.prompt) row.prompt = buildSafeSkillImagePrompt({ id: row.id, name: row.id, description: '' });
          else row.prompt = sanitizeSkillPromptText(row.prompt, 800);
        }
      }
      rows = rows.filter((r) => r.prompt && r.targetImagePath);
      if (args.limit) {
        const lim = Number(args.limit);
        if (Number.isFinite(lim) && lim > 0) rows = rows.slice(0, lim);
      }
      if (rows.length === 0) { console.log('No image jobs to run.'); return; }

      let generated = 0;
      let skipped = 0;
      let failed = 0;
      for (const row of rows) {
        const target = path.resolve(row.targetImagePath);
        if (fs.existsSync(target) && !args.overwrite) {
          skipped += 1;
          console.log(`[skip] ${row.id} -> ${path.relative(process.cwd(), target)} (exists, pass --overwrite)`);
          continue;
        }
        if (args.dryRun) {
          console.log(`[dry-run] ${row.id} -> ${path.relative(process.cwd(), target)}`);
          continue;
        }
        try {
          const png = await generateImageWithOpenAI({
            apiKey,
            model: args.model || 'gpt-image-1',
            prompt: row.prompt,
            size: args.size || '1024x1024',
          });
          fs.mkdirSync(path.dirname(target), { recursive: true });
          fs.writeFileSync(target, png);
          generated += 1;
          console.log(`[ok] ${row.id} -> ${path.relative(process.cwd(), target)}`);
        } catch (err) {
          failed += 1;
          const msg = err && err.message ? String(err.message) : String(err || 'unknown error');
          console.error(`[fail] ${row.id}: ${msg}`);
        }
      }
      console.log(`Done. generated=${generated} skipped=${skipped} failed=${failed} total=${rows.length}`);
      if (failed > 0) process.exitCode = 2;
    },
  });

  return defineCommand({
    meta: { name: 'images', description: 'Skill image inventory + optional OpenAI generation (opt-in)' },
    subCommands: { status, generate },
  });
}

module.exports = { createEvolutionImagesCommand };
module.exports.provides = (ctx) => ({
  cmd: createEvolutionImagesCommand(ctx.common),
});
