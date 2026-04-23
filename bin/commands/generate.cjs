'use strict';
/**
 * gad generate — AI generation fundamentals (decision gad-217).
 * Exposes `generate text` + `generate image`. Audio / video to follow.
 *
 * Required deps: outputError, findRepoRoot, gadConfig, shouldUseJson.
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { defineCommand } = require('citty');
const { generateOpenAiImage } = require('../../lib/openai-image.cjs');
const mediaStore = require('../../lib/media-store.cjs');

function loadLocalEnvFile(repoRoot, relPath = '.env') {
  if (!repoRoot) return;
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

function resolveProjectRootById(deps, projectid) {
  if (!projectid) return null;
  const baseDir = deps.findRepoRoot();
  const config = deps.gadConfig.load(baseDir);
  const root = (config.roots || []).find((r) => r.id === projectid);
  if (!root) return null;
  // root.path is relative to baseDir (or absolute). Resolve to abs.
  return path.isAbsolute(root.path) ? root.path : path.resolve(baseDir, root.path);
}

function createGenerateCommand(deps) {
  const { outputError, findRepoRoot, gadConfig, shouldUseJson } = deps;

  const generateText = defineCommand({
    meta: { name: 'text', description: 'Generate text from a prompt and write to file' },
    args: {
      prompt: { type: 'positional', description: 'The prompt text', required: true },
      out: { type: 'string', alias: 'o', description: 'Output file path (default: stdout)', default: '' },
      model: { type: 'string', alias: 'm', description: 'Model to use (default: claude-sonnet-4-20250514)', default: 'claude-sonnet-4-20250514' },
      system: { type: 'string', alias: 's', description: 'System prompt', default: '' },
      maxTokens: { type: 'string', description: 'Max output tokens', default: '4096' },
    },
    async run({ args }) {
      const apiKey = process.env.ANTHROPIC_API_KEY;
      if (!apiKey) {
        outputError('ANTHROPIC_API_KEY not set. Export it or add to .env');
        process.exit(1);
      }

      const body = {
        model: args.model,
        max_tokens: parseInt(args.maxTokens, 10),
        messages: [{ role: 'user', content: args.prompt }],
      };
      if (args.system) body.system = args.system;

      try {
        const resp = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01',
          },
          body: JSON.stringify(body),
        });

        if (!resp.ok) {
          const err = await resp.text();
          outputError(`API error ${resp.status}: ${err}`);
          process.exit(1);
        }

        const data = await resp.json();
        const text = data.content
          .filter((b) => b.type === 'text')
          .map((b) => b.text)
          .join('\n');

        if (args.out) {
          const outPath = path.resolve(args.out);
          const dir = path.dirname(outPath);
          if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
          fs.writeFileSync(outPath, text, 'utf8');
          console.log(`Written to ${args.out} (${text.length} chars)`);
        } else {
          console.log(text);
        }
      } catch (err) {
        outputError(`Generation failed: ${err.message}`);
        process.exit(1);
      }
    },
  });

  const generateImage = defineCommand({
    meta: {
      name: 'image',
      description: 'Generate an image from a prompt via OpenAI and write it to disk (or attach to a project).',
    },
    args: {
      prompt: { type: 'positional', description: 'The image prompt', required: true },
      out: { type: 'string', alias: 'o', description: 'Explicit output file path. Overrides --projectid storage.', default: '' },
      model: { type: 'string', alias: 'm', description: 'OpenAI image model (default: gpt-image-1)', default: 'gpt-image-1' },
      size: { type: 'string', alias: 's', description: 'Image size (default: 1024x1024)', default: '1024x1024' },
      projectid: { type: 'string', description: 'If set, save the image into ~/.gad/media and attach to this project', default: '' },
      'set-card': { type: 'boolean', description: 'With --projectid, also set this image as the project card', default: false },
      'env-file': { type: 'string', description: 'Load env vars from this file before calling OpenAI', default: '.env' },
      json: { type: 'boolean', description: 'Emit JSON result { ok, outPath, mediaId?, size, model }', default: false },
    },
    async run({ args }) {
      const wantJson = Boolean(args.json) || shouldUseJson();
      const repoRoot = findRepoRoot() || process.cwd();
      loadLocalEnvFile(repoRoot, args['env-file'] || '.env');
      const apiKey = process.env.OPENAI_API_KEY || '';
      if (!apiKey) {
        outputError('OPENAI_API_KEY not set. Export it or add to .env');
      }

      let buffer;
      try {
        buffer = await generateOpenAiImage({
          apiKey,
          prompt: args.prompt,
          model: args.model || 'gpt-image-1',
          size: args.size || '1024x1024',
        });
      } catch (err) {
        outputError(`Image generation failed: ${err.message || err}`);
      }

      // Decide where this image lives:
      //   1. --out wins (explicit caller-chosen path, no media-store side effects)
      //   2. --projectid (without --out) → media store + project attachment
      //   3. Neither → media store with no attachment
      const explicitOut = typeof args.out === 'string' && args.out.trim().length > 0;
      let outPath;
      let mediaId;

      if (explicitOut) {
        outPath = path.resolve(args.out);
        const dir = path.dirname(outPath);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(outPath, buffer);
      } else {
        const record = mediaStore.saveMediaBytes({
          bytes: buffer,
          mimeType: 'image/png',
          source: 'generate',
          prompt: args.prompt,
          model: args.model || 'gpt-image-1',
        });
        mediaId = record.id;
        outPath = mediaStore.mediaFilePath(record);

        if (args.projectid) {
          const projectRoot = resolveProjectRootById(deps, args.projectid);
          if (!projectRoot) {
            outputError(`Unknown projectid: ${args.projectid}. Use \`gad projects list\` to see registered projects.`);
          }
          if (args['set-card']) {
            mediaStore.setProjectCardMedia(projectRoot, record.id);
          } else {
            mediaStore.attachMediaToProject(projectRoot, record.id);
          }
        }
      }

      if (wantJson) {
        console.log(JSON.stringify({
          ok: true,
          outPath,
          mediaId: mediaId || null,
          model: args.model || 'gpt-image-1',
          size: args.size || '1024x1024',
          projectid: args.projectid || null,
          isCard: Boolean(args.projectid && args['set-card']),
          bytes: buffer.length,
        }));
      } else {
        console.log(`Written ${buffer.length} bytes to ${outPath}`);
        if (mediaId) console.log(`mediaId: ${mediaId}`);
        if (args.projectid) {
          console.log(`attached to project: ${args.projectid}${args['set-card'] ? ' (as card image)' : ''}`);
        }
      }
    },
  });

  const generateCmd = defineCommand({
    meta: { name: 'generate', description: 'AI generation fundamentals — prompt in, file out' },
    subCommands: { text: generateText, image: generateImage },
  });

  return { generateCmd };
}

module.exports = { createGenerateCommand };
module.exports.register = (ctx) => ({ generate: createGenerateCommand(ctx.common).generateCmd });
