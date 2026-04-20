'use strict';
/**
 * gad models — manage local embedding models per gad project.
 * Models cache under `.gad/models/` at the repo root (never committed).
 * Zero-cost when unused; lazy-requires @huggingface/transformers only when
 * an action that needs it runs.
 */

const path = require('path');
const fs = require('fs');
const { defineCommand } = require('citty');

function createModelsCommand() {
  function emb() { return require('../../lib/embeddings.cjs'); }

  const listAvailable = defineCommand({
    meta: { name: 'list-available', description: 'Show curated embedding models we know work with gad' },
    run() {
      const e = emb();
      console.log('Curated embedding models:\n');
      for (const m of e.CURATED_MODELS) {
        const def = m.id === e.DEFAULT_MODEL ? ' (default)' : '';
        console.log(`  ${m.tag.padEnd(12)} ${m.id}${def}`);
        console.log(`    ${m.note}`);
        console.log(`    ~${m.sizeMB}MB on disk, ${m.dim}-dim vectors, task=${m.task}\n`);
      }
      console.log('Install: gad models install <tag-or-id>');
      console.log('Example: gad models install minilm');
    },
  });

  const list = defineCommand({
    meta: { name: 'list', description: 'Show models installed in this gad project' },
    run() {
      const e = emb();
      const repoRoot = process.cwd();
      const installed = e.listInstalledModels(repoRoot);
      const dir = e.projectModelsDir(repoRoot);
      console.log(`Project models dir: ${dir}\n`);
      if (installed.length === 0) {
        console.log('No models installed.\n');
        console.log('Install one with: gad models install <tag-or-id>');
        console.log('See options with:  gad models list-available');
        return;
      }
      console.log(`Installed models (${installed.length}):`);
      for (const m of installed) {
        console.log(`  ${m.id}   ${e.formatBytes(m.sizeBytes)}`);
        console.log(`    ${m.path}`);
      }
    },
  });

  const pathCmd = defineCommand({
    meta: { name: 'path', description: 'Print the project models cache directory' },
    run() { console.log(emb().projectModelsDir(process.cwd())); },
  });

  const install = defineCommand({
    meta: { name: 'install', description: 'Download and cache an embedding model from HuggingFace' },
    args: { model: { type: 'positional', description: 'Model id or tag (e.g. minilm, Xenova/all-MiniLM-L6-v2)', required: false, default: '' } },
    async run({ args }) {
      const e = emb();
      const repoRoot = process.cwd();
      const modelId = e.resolveModelId(args.model);
      console.log(`Resolving: ${modelId}`);
      console.log(`Cache dir: ${e.projectModelsDir(repoRoot)}\n`);
      console.log('Downloading (first run will fetch ~90MB for MiniLM)...');
      try {
        await e.getEmbedder(modelId, repoRoot);
        console.log(`\nInstalled: ${modelId}`);
        const installed = e.listInstalledModels(repoRoot);
        const match = installed.find((m) => m.id === modelId);
        if (match) {
          console.log(`  ${match.path}`);
          console.log(`  ${e.formatBytes(match.sizeBytes)}`);
        }
      } catch (err) {
        if (err.code === 'TRANSFORMERS_MISSING') { console.error(err.message); process.exit(2); }
        console.error(`Install failed: ${err.message}`);
        process.exit(1);
      }
    },
  });

  const remove = defineCommand({
    meta: { name: 'remove', description: 'Delete a cached model from this gad project' },
    args: { model: { type: 'positional', description: 'Model id to remove (full org/model form)', required: true } },
    run({ args }) {
      const e = emb();
      const repoRoot = process.cwd();
      const installed = e.listInstalledModels(repoRoot);
      const match = installed.find((m) => m.id === args.model || m.id.endsWith(`/${args.model}`));
      if (!match) {
        console.error(`Not installed: ${args.model}`);
        console.error('Run `gad models list` to see what is installed.');
        process.exit(1);
      }
      fs.rmSync(match.path, { recursive: true, force: true });
      const orgDir = path.dirname(match.path);
      try {
        if (fs.existsSync(orgDir) && fs.readdirSync(orgDir).length === 0) fs.rmdirSync(orgDir);
      } catch (_) { /* ignore */ }
      console.log(`Removed: ${match.id}`);
      console.log(`  ${match.path}`);
    },
  });

  return defineCommand({
    meta: { name: 'models', description: 'Manage local embedding models for this gad project (install/remove/list)' },
    subCommands: { list, 'list-available': listAvailable, install, remove, path: pathCmd },
  });
}

module.exports = { createModelsCommand };
module.exports.register = () => ({ models: createModelsCommand() });
