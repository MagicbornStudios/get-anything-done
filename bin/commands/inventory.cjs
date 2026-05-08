'use strict';
/**
 * gad inventory — cross-project rollup of installed models, binaries, runtime CLIs, versions.
 *
 * Sections:
 *   A) RUNTIME CLIs    — installed yes/no, version, path
 *   B) LOCAL MODELS    — slm-learning REGISTRY.json (canonical/staging/candidate/rejected per lane)
 *   C) EMBEDDING MODELS — .gad/models/ installed transformers.js models
 *   D) GAD SIDECARS    — %LOCALAPPDATA%/Programs/gad/bin/ (Win) or /usr/local/bin/gad* (Unix)
 *   E) BUILT BINARIES  — vendor/get-anything-done/dist/release/ exe/bin
 *   F) PER-PROJECT BINS — bin/ or tools/ dirs under each planning root
 *
 * Flags:
 *   --json   Emit structured JSON instead of text tables.
 */

const path = require('path');
const { defineCommand } = require('citty');

// ---------------------------------------------------------------------------
// Text rendering helpers
// ---------------------------------------------------------------------------

function pad(s, len) {
  return String(s == null ? '' : s).padEnd(len).slice(0, len);
}

function renderTable(title, rows, cols) {
  if (!rows || rows.length === 0) {
    return `\n=== ${title} ===\n  (none)\n`;
  }
  const widths = cols.map((c) => Math.max(c.label.length, ...rows.map((r) => String(r[c.key] == null ? '' : r[c.key]).length)));
  const header = cols.map((c, i) => pad(c.label, widths[i])).join('  ');
  const sep = widths.map((w) => '─'.repeat(w)).join('  ');
  const lines = [`\n=== ${title} ===`, header, sep];
  for (const row of rows) {
    lines.push(cols.map((c, i) => pad(row[c.key], widths[i])).join('  '));
  }
  lines.push(`  ${rows.length} record(s)`);
  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Command
// ---------------------------------------------------------------------------

function createInventoryCommand() {
  return defineCommand({
    meta: {
      name: 'inventory',
      description: 'Cross-project rollup of installed models, available binaries, runtime CLIs, and versions.',
    },
    args: {
      json: { type: 'boolean', description: 'Emit structured JSON', default: false },
    },
    run({ args }) {
      const { runInventory } = require('../../lib/inventory.cjs');
      const gadVendorDir = path.resolve(__dirname, '..', '..');

      const inv = runInventory({ gadVendorDir });

      if (args.json) {
        process.stdout.write(JSON.stringify(inv, null, 2) + '\n');
        return;
      }

      // ── Section A: Runtime CLIs ─────────────────────────────────────────
      console.log(renderTable('RUNTIME CLIs', inv.runtime_clis, [
        { key: 'id',        label: 'RUNTIME' },
        { key: 'installed', label: 'INSTALLED' },
        { key: 'version',   label: 'VERSION' },
        { key: 'path',      label: 'PATH/BIN' },
      ]));

      // ── Section B: Local Models ─────────────────────────────────────────
      const localModels = inv.local_models.error ? [] : inv.local_models.models;
      if (inv.local_models.error) {
        console.log(`\n=== LOCAL MODELS (slm-learning) ===\n  ${inv.local_models.error}`);
      } else {
        console.log(renderTable('LOCAL MODELS (slm-learning)', localModels, [
          { key: 'lane',   label: 'LANE' },
          { key: 'id',     label: 'MODEL ID' },
          { key: 'status', label: 'STATUS' },
          { key: 'size',   label: 'SIZE' },
          { key: 'scores', label: 'SCORES' },
        ]));
      }

      // ── Section C: Embedding Models ─────────────────────────────────────
      console.log(renderTable('EMBEDDING MODELS (.gad/models/)', inv.embedding_models, [
        { key: 'id',   label: 'MODEL ID' },
        { key: 'tag',  label: 'TAG' },
        { key: 'dim',  label: 'DIM' },
        { key: 'size', label: 'SIZE' },
        { key: 'path', label: 'PATH' },
      ]));

      // ── Section D: GAD Sidecars ─────────────────────────────────────────
      console.log(renderTable('GAD SIDECARS (Programs/gad/bin/)', inv.gad_sidecars, [
        { key: 'name',    label: 'FILE' },
        { key: 'version', label: 'VERSION' },
        { key: 'size',    label: 'SIZE' },
        { key: 'mtime',   label: 'MODIFIED' },
      ]));

      // ── Section E: Built Binaries ───────────────────────────────────────
      console.log(renderTable('BUILT BINARIES (dist/release/)', inv.built_binaries, [
        { key: 'name',  label: 'FILE' },
        { key: 'size',  label: 'SIZE' },
        { key: 'mtime', label: 'MODIFIED' },
        { key: 'path',  label: 'PATH' },
      ]));

      // ── Section F: Per-Project Bins ─────────────────────────────────────
      console.log(renderTable('PER-PROJECT BINS (bin/ tools/)', inv.per_project_bins, [
        { key: 'project', label: 'PROJECT' },
        { key: 'name',    label: 'FILE' },
        { key: 'size',    label: 'SIZE' },
        { key: 'mtime',   label: 'MODIFIED' },
        { key: 'path',    label: 'PATH' },
      ]));

      // ── Totals ──────────────────────────────────────────────────────────
      console.log('\n── TOTALS ──────────────────────────────────────────────────────');
      const rCliInstalled = inv.runtime_clis.filter((r) => r.installed === 'yes').length;
      console.log(`  runtime CLIs installed : ${rCliInstalled}/${inv.runtime_clis.length}`);
      console.log(`  local models           : ${localModels.length} (across ${new Set(localModels.map((m) => m.lane)).size} lanes)`);
      console.log(`  embedding models       : ${inv.embedding_models.length}`);
      console.log(`  gad sidecars           : ${inv.gad_sidecars.length}`);
      console.log(`  built binaries         : ${inv.built_binaries.length}`);
      console.log(`  per-project bins       : ${inv.per_project_bins.length}`);
      console.log('');
    },
  });
}

module.exports = { createInventoryCommand };
module.exports.register = () => ({ inventory: createInventoryCommand() });
