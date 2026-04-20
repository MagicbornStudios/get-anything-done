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
 * upload + download implemented: task 71-03.
 *
 * Subcommands:
 *   list       [--project] [--species] [--generation] [--limit] [--offset] — live Supabase query
 *   upload     <file> --project [--species] [--generation] [--labels] [--mime] [--json]
 *   download   <asset_id> [--out] [--cli] [--json]
 *   move       <asset_id> --species   (placeholder — task 71-04)
 *   transfer   <asset_id> --project [--keep-source]   (placeholder — task 71-04)
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { defineCommand } = require('citty');
const { render } = require(path.join(__dirname, '../../lib/table.cjs'));
const { getSupabaseClient } = require(path.join(__dirname, '../../lib/supabase-client.cjs'));

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

function notImplemented(name) {
  console.error(`\n  gad assets ${name}: not implemented — see task 71-04\n`);
  process.exitCode = 1;
}

// Truncate a string to maxLen, appending '…' if truncated.
function trunc(s, maxLen) {
  if (!s) return '';
  const str = String(s);
  return str.length > maxLen ? str.slice(0, maxLen - 1) + '…' : str;
}

// ---------------------------------------------------------------------------
// Upload helpers
// ---------------------------------------------------------------------------

/**
 * Detect MIME type from file extension using mime-types.
 * Falls back to application/octet-stream if lookup fails.
 */
function detectMimeType(filePath, mimeOverride) {
  if (mimeOverride) return mimeOverride;
  try {
    // mime-types is an optional peer dep — lazy require so missing it only
    // affects MIME detection, not the entire module load.
    // eslint-disable-next-line
    const mime = require('mime-types');
    return mime.lookup(filePath) || 'application/octet-stream';
  } catch (_) {
    return 'application/octet-stream';
  }
}

/**
 * Sanitize a basename: lowercase, spaces → hyphens, strip chars outside [a-z0-9.-].
 * Preserves the file extension dot.
 */
function sanitizeBasename(name) {
  return name
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9.\-]/g, '');
}

/**
 * Build the storage path: <hash8>/<sanitized-basename>.
 */
function buildStoragePath(contentHash, basename) {
  const hash8 = contentHash.slice(0, 8);
  const safe = sanitizeBasename(basename);
  return `${hash8}/${safe}`;
}

// ---------------------------------------------------------------------------
// Download helper
// ---------------------------------------------------------------------------

/**
 * Stream a fetch Response body to a writable file path.
 * Cleans up the partial file on error.
 */
async function streamResponseToFile(response, outPath) {
  const ws = fs.createWriteStream(outPath);
  let bytesWritten = 0;

  try {
    // node:fetch returns a Web Streams API ReadableStream in Node 18+.
    // Convert via getReader() for robust cross-version compatibility.
    if (response.body && typeof response.body[Symbol.asyncIterator] === 'function') {
      for await (const chunk of response.body) {
        ws.write(chunk);
        bytesWritten += chunk.length;
      }
    } else {
      // Fallback: buffer via arrayBuffer()
      const buf = Buffer.from(await response.arrayBuffer());
      ws.write(buf);
      bytesWritten = buf.length;
    }
    await new Promise((resolve, reject) => {
      ws.end((err) => (err ? reject(err) : resolve()));
    });
  } catch (err) {
    ws.destroy();
    try { fs.unlinkSync(outPath); } catch (_) { /* best-effort cleanup */ }
    throw err;
  }

  return bytesWritten;
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
// upload (task 71-03)
// ---------------------------------------------------------------------------
const uploadCmd = defineCommand({
  meta: {
    name: 'upload',
    description: [
      'Upload a local file to project storage (Supabase Storage).',
      '',
      'Storage path within the project bucket:',
      '  <hash8>/<sanitized-basename>',
      '',
      'Bucket: project-assets-<project_id>  (created via create_project_bucket RPC)',
      'Creates an assets metadata row on success.',
      '',
      'Examples:',
      '  gad assets upload ./hero.png --project <uuid>',
      '  gad assets upload ./data.bin --project <uuid> --labels hero,cover --json',
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
      description: 'Species id (UUID) — stored in assets.species_id.',
    },
    generation: {
      type: 'string',
      description: 'Generation id (UUID) — stored in assets.generation_id.',
    },
    labels: {
      type: 'string',
      description: 'Comma-separated labels to attach to the asset (e.g. hero,cover).',
    },
    mime: {
      type: 'string',
      description: 'Override MIME type. Auto-detected from file extension if omitted.',
    },
    json: {
      type: 'boolean',
      description: 'Emit JSON output (full inserted row) instead of summary table.',
      default: false,
    },
  },
  async run({ args }) {
    // 1. Read local file.
    const localPath = path.resolve(args.file);
    let fileBuffer;
    try {
      fileBuffer = fs.readFileSync(localPath);
    } catch (err) {
      console.error(`assets upload: cannot read file "${localPath}": ${err.message}`);
      process.exitCode = 1;
      return;
    }

    // 2. Compute SHA-256 content hash.
    const contentHash = crypto.createHash('sha256').update(fileBuffer).digest('hex');

    // 3. Detect MIME type.
    const mimeType = detectMimeType(localPath, args.mime || null);

    // 4. Build storage path.
    const basename = path.basename(localPath);
    let storagePath = buildStoragePath(contentHash, basename);

    // 5. Get Supabase client.
    let client;
    try {
      ({ client } = getSupabaseClient());
    } catch (err) {
      console.error(err.message);
      process.exitCode = 1;
      return;
    }

    const bucketName = `project-assets-${args.project}`;

    // 5a. Ensure bucket exists — idempotent RPC.
    try {
      const { error: rpcErr } = await client.rpc('create_project_bucket', {
        project_id: args.project,
      });
      if (rpcErr) {
        // "already exists" variant — safe to continue.
        const msg = (rpcErr.message || '').toLowerCase();
        if (!msg.includes('already exist') && !msg.includes('duplicate')) {
          console.error(`assets upload: bucket creation failed: ${rpcErr.message}`);
          process.exitCode = 1;
          return;
        }
      }
    } catch (err) {
      // Non-fatal if the bucket was already created — network might still be ok.
      const msg = (err.message || '').toLowerCase();
      if (!msg.includes('already exist') && !msg.includes('duplicate')) {
        console.error(`assets upload: bucket RPC error: ${err.message}`);
        process.exitCode = 1;
        return;
      }
    }

    // 6. Upload to storage (upsert: false; retry with suffix on collision).
    let uploadPath = storagePath;
    let uploadResult = await client.storage
      .from(bucketName)
      .upload(uploadPath, fileBuffer, { contentType: mimeType, upsert: false });

    if (uploadResult.error) {
      const errMsg = (uploadResult.error.message || '').toLowerCase();
      const isCollision =
        errMsg.includes('already exists') ||
        errMsg.includes('duplicate') ||
        errMsg.includes('violates');

      if (isCollision) {
        // Retry once with a short numeric suffix before the extension.
        const ext = path.extname(uploadPath);
        const base = uploadPath.slice(0, uploadPath.length - ext.length);
        uploadPath = `${base}-1${ext}`;
        storagePath = uploadPath;

        uploadResult = await client.storage
          .from(bucketName)
          .upload(uploadPath, fileBuffer, { contentType: mimeType, upsert: false });
      }

      if (uploadResult.error) {
        console.error(`assets upload: storage upload failed: ${uploadResult.error.message}`);
        process.exitCode = 1;
        return;
      }
    }

    // 7. Insert metadata row.
    const labelsArr = args.labels
      ? args.labels.split(',').map((l) => l.trim()).filter(Boolean)
      : [];

    const insertPayload = {
      project_id: args.project,
      bucket_name: bucketName,
      storage_path: storagePath,
      mime_type: mimeType,
      size_bytes: fileBuffer.length,
      labels: labelsArr,
    };
    if (args.species) insertPayload.species_id = args.species;
    if (args.generation) insertPayload.generation_id = args.generation;

    const { data: insertedRows, error: insertErr } = await client
      .from('assets')
      .insert(insertPayload)
      .select('*');

    if (insertErr) {
      // Compensation: try to remove the uploaded object.
      await client.storage.from(bucketName).remove([storagePath]);
      console.error(`assets upload: metadata insert failed: ${insertErr.message}`);
      process.exitCode = 1;
      return;
    }

    const row = insertedRows && insertedRows[0] ? insertedRows[0] : insertPayload;

    // 8. Output.
    if (args.json) {
      process.stdout.write(JSON.stringify(row, null, 2) + '\n');
      return;
    }

    const rows = [{
      id: trunc(row.id || '(pending)', 36),
      storage_path: trunc(row.storage_path, 50),
      size_bytes: String(row.size_bytes),
    }];
    console.log(render(rows));
  },
});

// ---------------------------------------------------------------------------
// download (task 71-03)
// ---------------------------------------------------------------------------
const downloadCmd = defineCommand({
  meta: {
    name: 'download',
    description: [
      'Download an asset to a local path.',
      '',
      'Fetches metadata from the assets table, generates a signed URL,',
      'and streams the object to --out path (or cwd/<basename>).',
      '',
      'Signed URL TTL:',
      '  default  60s   (UI context)',
      '  --cli    3600s (scripted workflows)',
      '',
      'Examples:',
      '  gad assets download <asset-uuid>',
      '  gad assets download <asset-uuid> --out ./local-copy.png --cli',
      '  gad assets download <asset-uuid> --json',
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
      description: 'Output file path. Defaults to ./<storage_path_basename> in cwd.',
    },
    cli: {
      type: 'boolean',
      description: 'Use 3600s TTL (longer for scripted / agent workflows).',
      default: false,
    },
    json: {
      type: 'boolean',
      description: 'Emit JSON metadata after download instead of summary line.',
      default: false,
    },
  },
  async run({ args }) {
    // 1. Get Supabase client.
    let client;
    try {
      ({ client } = getSupabaseClient());
    } catch (err) {
      console.error(err.message);
      process.exitCode = 1;
      return;
    }

    // 2. Query asset metadata.
    const { data: asset, error: queryErr } = await client
      .from('assets')
      .select('*')
      .eq('id', args.assetId)
      .single();

    if (queryErr || !asset) {
      console.error(`Asset ${args.assetId} not found.`);
      process.exitCode = 1;
      return;
    }

    // 3. Determine output path.
    const storagePath = asset.storage_path;
    const storagePathBasename = path.basename(storagePath);
    const outPath = args.out
      ? path.resolve(args.out)
      : path.resolve(process.cwd(), storagePathBasename);

    // 4. Generate signed URL.
    const ttl = args.cli ? 3600 : 60;
    const { data: urlData, error: urlErr } = await client.storage
      .from(asset.bucket_name)
      .createSignedUrl(storagePath, ttl);

    if (urlErr || !urlData || !urlData.signedUrl) {
      console.error(`assets download: signed URL generation failed: ${urlErr ? urlErr.message : 'no URL returned'}`);
      process.exitCode = 1;
      return;
    }

    const signedUrl = urlData.signedUrl;

    // 5. Fetch and stream to file.
    let response;
    try {
      // node:fetch is available in Node 18+.
      response = await fetch(signedUrl);
    } catch (err) {
      console.error(`assets download: fetch error: ${err.message}`);
      process.exitCode = 1;
      return;
    }

    if (!response.ok) {
      console.error(`assets download: HTTP ${response.status} ${response.statusText}`);
      process.exitCode = 1;
      return;
    }

    let bytesWritten;
    try {
      bytesWritten = await streamResponseToFile(response, outPath);
    } catch (err) {
      console.error(`assets download: write error: ${err.message}`);
      process.exitCode = 1;
      return;
    }

    // 6. Output.
    if (args.json) {
      process.stdout.write(JSON.stringify({ ...asset, downloaded_to: outPath, bytes_written: bytesWritten }, null, 2) + '\n');
      return;
    }

    console.log(`Downloaded: ${bytesWritten} bytes → ${outPath}`);
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
        'upload + download: task 71-03. move + transfer: task 71-04 (placeholder).',
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
