'use strict';
/**
 * gad assets — manage project storage assets backed by Supabase Storage.
 *
 * Design doc:
 *   vendor/get-anything-done/.planning/notes/2026-04-20-asset-storage-design.md
 *
 * Phase 71-01: scaffold only. All subcommands except `list` print
 * "not implemented — see task 71-03" and exit 1.
 * list implemented: task 71-02.
 *
 * Subcommands:
 *   list       [--project] [--species] [--generation] [--limit] [--offset] — live Supabase query
 *   upload     <file> --project [--species] [--generation] [--labels]
 *   download   <asset_id> [--out]
 *   move       <asset_id> --species
 *   transfer   <asset_id> --project [--keep-source]
 */

const path = require('path');
const { defineCommand } = require('citty');
const { render } = require(path.join(__dirname, '../../lib/table.cjs'));
const { getSupabaseClient } = require(path.join(__dirname, '../../lib/supabase-client.cjs'));

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

function notImplemented(name) {
  console.error(`\n  gad assets ${name}: not implemented — see task 71-03\n`);
  process.exitCode = 1;
}

// Truncate a string to maxLen, appending '…' if truncated.
function trunc(s, maxLen) {
  if (!s) return '';
  const str = String(s);
  return str.length > maxLen ? str.slice(0, maxLen - 1) + '…' : str;
}

// ---------------------------------------------------------------------------
// list (task 71-02)
// ---------------------------------------------------------------------------
const listCmd = defineCommand({
  meta: {
    name: 'list',
    description: 'List assets for a project. Queries the assets metadata table via Supabase.',
  },
  args: {
    project: {
      type: 'string',
      description: 'Filter by project_id (UUID).',
    },
    species: {
      type: 'string',
      description: 'Filter by species_id (UUID).',
    },
    generation: {
      type: 'string',
      description: 'Filter by generation_id (UUID).',
    },
    projectid: {
      type: 'string',
      description: 'GAD project id for session scoping (no-op filter — reserves arg slot for 71-03).',
    },
    json: {
      type: 'boolean',
      description: 'Emit JSON output instead of table.',
      default: false,
    },
    limit: {
      type: 'string',
      description: 'Max rows to return (default 50).',
      default: '50',
    },
    offset: {
      type: 'string',
      description: 'Row offset for pagination (default 0).',
      default: '0',
    },
  },
  async run({ args }) {
    const limit = Math.max(1, parseInt(args.limit, 10) || 50);
    const offset = Math.max(0, parseInt(args.offset, 10) || 0);

    let client;
    try {
      ({ client } = getSupabaseClient());
    } catch (err) {
      console.error(err.message);
      process.exitCode = 1;
      return;
    }

    // Build query — select all metadata columns, ordered newest-first.
    let query = client
      .from('assets')
      .select('id, project_id, species_id, generation_id, bucket_name, storage_path, mime_type, size_bytes, labels, created_at')
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (args.project) query = query.eq('project_id', args.project);
    if (args.species) query = query.eq('species_id', args.species);
    if (args.generation) query = query.eq('generation_id', args.generation);

    const { data, error } = await query;

    if (error) {
      console.error(`assets list: ${error.message}`);
      process.exitCode = 1;
      return;
    }

    if (!data || data.length === 0) {
      console.log('No assets found.');
      return;
    }

    if (args.json) {
      process.stdout.write(JSON.stringify(data, null, 2) + '\n');
      return;
    }

    // Render as table with truncated paths for readability.
    const rows = data.map((a) => ({
      project_id: trunc(a.project_id, 16),
      species_id: trunc(a.species_id, 16),
      gen_id: trunc(a.generation_id, 16),
      path: trunc(a.storage_path, 40),
      mime: trunc(a.mime_type, 20),
      size_bytes: a.size_bytes != null ? String(a.size_bytes) : '',
      created_at: a.created_at ? String(a.created_at).slice(0, 19) : '',
    }));

    console.log(render(rows));
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
