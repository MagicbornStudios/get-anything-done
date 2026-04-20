'use strict';
/**
 * gad assets — manage project storage assets backed by Supabase Storage.
 *
 * Design doc:
 *   vendor/get-anything-done/.planning/notes/2026-04-20-asset-storage-design.md
 *
 * Phase 71-01: scaffold only. All subcommands except `list` print
 * "not implemented — see task 71-02" and exit 1.
 * Actual implementation: task 71-02.
 *
 * Subcommands:
 *   list       [--project] [--species] [--generation]  — stubbed empty table
 *   upload     <file> --project [--species] [--generation] [--labels]
 *   download   <asset_id> [--out]
 *   move       <asset_id> --species
 *   transfer   <asset_id> --project [--keep-source]
 */

const { defineCommand } = require('citty');

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

function notImplemented(name) {
  console.error(`\n  gad assets ${name}: not implemented — see task 71-02\n`);
  process.exitCode = 1;
}

function printTableHeader(cols) {
  const widths = cols.map((c) => c.length);
  const fmt = (cells) => cells.map((c, i) => String(c).padEnd(widths[i])).join('  ');
  console.log('');
  console.log('  ' + fmt(cols));
  console.log('  ' + widths.map((w) => '-'.repeat(w)).join('  '));
  return { fmt, widths };
}

// ---------------------------------------------------------------------------
// list
// ---------------------------------------------------------------------------
const listCmd = defineCommand({
  meta: {
    name: 'list',
    description: 'List assets for a project. Queries the assets metadata table via Supabase client.',
  },
  args: {
    project: {
      type: 'string',
      description: 'Project id (UUID or slug) to list assets for.',
    },
    species: {
      type: 'string',
      description: 'Filter by species id.',
    },
    generation: {
      type: 'string',
      description: 'Filter by generation id.',
    },
    json: {
      type: 'boolean',
      description: 'Emit JSON output instead of table.',
    },
  },
  run({ args }) {
    // 71-01: placeholder — prints empty table with correct shape.
    // 71-02 will query Supabase: SELECT * FROM assets WHERE project_id = <args.project>
    //        filtered by species_id / generation_id when provided.
    if (args.json) {
      process.stdout.write(JSON.stringify({
        _note: 'not implemented — see task 71-02',
        project: args.project ?? null,
        species: args.species ?? null,
        generation: args.generation ?? null,
        assets: [],
      }, null, 2) + '\n');
      return;
    }

    const cols = ['ID', 'BUCKET', 'PATH', 'MIME', 'SIZE', 'LABELS', 'CREATED'];
    const { fmt } = printTableHeader(cols);
    console.log(`  ${'(no assets — list not implemented yet, see task 71-02)'.padEnd(cols.join('  ').length)}`);
    console.log('');

    if (args.project) {
      console.log(`  (would filter: project=${args.project})`);
    }
    if (args.species) console.log(`  (would filter: species=${args.species})`);
    if (args.generation) console.log(`  (would filter: generation=${args.generation})`);
    console.log('');
    void fmt; // used in 71-02
  },
});

// ---------------------------------------------------------------------------
// upload
// ---------------------------------------------------------------------------
const uploadCmd = defineCommand({
  meta: {
    name: 'upload',
    description: [
      'Upload a local file to project storage.',
      '',
      'Storage path within the project bucket:',
      '  <species_slug>/<generation_id>/<sanitized_name>-<hash8>.<ext>',
      '',
      'Creates an assets metadata row: INSERT INTO assets (...) VALUES (...)',
      '',
      'Not implemented — see task 71-02.',
    ].join('\n'),
  },
  args: {
    file: {
      type: 'positional',
      required: true,
      description: 'Local file path to upload.',
    },
    project: {
      type: 'string',
      required: true,
      description: 'Destination project id (UUID).',
    },
    species: {
      type: 'string',
      description: 'Species slug for storage path prefix.',
    },
    generation: {
      type: 'string',
      description: 'Generation id (UUID) for storage path segment.',
    },
    labels: {
      type: 'string',
      description: 'Comma-separated labels to attach to the asset (e.g. hero,cover).',
    },
  },
  run() {
    notImplemented('upload');
  },
});

// ---------------------------------------------------------------------------
// download
// ---------------------------------------------------------------------------
const downloadCmd = defineCommand({
  meta: {
    name: 'download',
    description: [
      'Download an asset to a local path.',
      '',
      'Generates a signed URL (TTL: 3600s default, 86400s with --handoff)',
      'and streams the object to --out path (or current directory).',
      '',
      'Not implemented — see task 71-02.',
    ].join('\n'),
  },
  args: {
    assetId: {
      type: 'positional',
      required: true,
      description: 'Asset id (UUID from assets table).',
    },
    out: {
      type: 'string',
      description: 'Output file path. Defaults to ./<original-filename> in cwd.',
    },
    ttl: {
      type: 'string',
      description: 'Signed URL TTL in seconds (default 3600, max 86400).',
    },
    handoff: {
      type: 'boolean',
      description: 'Set TTL to 86400s (24h) — suitable for agent-to-agent handoffs.',
    },
  },
  run() {
    notImplemented('download');
  },
});

// ---------------------------------------------------------------------------
// move
// ---------------------------------------------------------------------------
const moveCmd = defineCommand({
  meta: {
    name: 'move',
    description: [
      'Re-assign an asset to a different species within the same project.',
      '',
      'Updates: assets.species_id = <new species id>',
      'Also moves the storage object to the new species path prefix',
      'via storage.move() (atomic rename within same bucket).',
      '',
      'Not implemented — see task 71-02.',
    ].join('\n'),
  },
  args: {
    assetId: {
      type: 'positional',
      required: true,
      description: 'Asset id (UUID) to move.',
    },
    species: {
      type: 'string',
      required: true,
      description: 'Target species slug to move the asset under.',
    },
  },
  run() {
    notImplemented('move');
  },
});

// ---------------------------------------------------------------------------
// transfer
// ---------------------------------------------------------------------------
const transferCmd = defineCommand({
  meta: {
    name: 'transfer',
    description: [
      'Copy an asset to a different project (cross-project transfer).',
      '',
      'Implementation (71-02):',
      '  1. Download storage object from source bucket.',
      '  2. Upload to destination bucket (project-assets-<dest_project_id>).',
      '  3. INSERT new assets row in destination project.',
      '  4. Unless --keep-source: DELETE source assets row (storage object kept).',
      '',
      'Ownership semantics: copy model — no shared storage paths.',
      'See design doc for rationale over shared-path (zero-copy) approach.',
      '',
      'Not implemented — see task 71-02.',
    ].join('\n'),
  },
  args: {
    assetId: {
      type: 'positional',
      required: true,
      description: 'Asset id (UUID) to transfer.',
    },
    project: {
      type: 'string',
      required: true,
      description: 'Destination project id (UUID).',
    },
    keepSource: {
      type: 'boolean',
      description: 'Keep the source assets metadata row after transfer (storage object always kept).',
    },
  },
  run() {
    notImplemented('transfer');
  },
});

// ---------------------------------------------------------------------------
// Root command
// ---------------------------------------------------------------------------
function createAssetsCommand() {
  return defineCommand({
    meta: {
      name: 'assets',
      description: [
        'Manage project storage assets backed by Supabase Storage.',
        '',
        'Bucket layout: one bucket per project (project-assets-<project_uuid>).',
        'Public projects use public buckets; private projects use signed URLs.',
        'Cross-project transfer: copy model (storage object duplicated, new metadata row).',
        '',
        'Design doc: .planning/notes/2026-04-20-asset-storage-design.md',
        'Implementation: task 71-02 (CLI bodies, storage client, upload/download/move/transfer).',
      ].join('\n'),
    },
    subCommands: {
      list: listCmd,
      upload: uploadCmd,
      download: downloadCmd,
      move: moveCmd,
      transfer: transferCmd,
    },
  });
}

module.exports = { createAssetsCommand };
module.exports.register = () => ({ assets: createAssetsCommand() });
