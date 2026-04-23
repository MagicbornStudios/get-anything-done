'use strict';
/**
 * gad media — local media library management.
 *
 * Backed by lib/media-store.cjs. Storage layout:
 *
 *   ~/.gad/media/                        global, uuid-keyed binaries + index
 *   <project_root>/.planning/
 *     media-attachments.json             per-project card pointer + attachments
 *
 * All subcommands support --json for machine-readable output. The desktop
 * app consumes these via the tauri-plugin-shell sidecar.
 *
 * Subcommands:
 *   list       — list media (global or project-scoped)
 *   save       — copy a file into the media store, optional --projectid + --set-card
 *   save-base64 — save bytes from --data or stdin (desktop upload flow)
 *   attach     — attach an existing mediaId to a project
 *   detach     — detach a mediaId from a project (card pointer cleared if matched)
 *   set-card   — set a media item as the project's card image
 *   get-card   — print the project's current card image info (or null)
 *   path       — print the absolute file path for a mediaId
 *   read-base64 — print a data URL (or JSON object) for a mediaId
 *   delete     — remove a media item globally (file + index)
 */

const fs = require('fs');
const path = require('path');
const { defineCommand } = require('citty');
const mediaStore = require('../../lib/media-store.cjs');

function resolveProjectRootById(deps, projectid) {
  if (!projectid) return null;
  const baseDir = deps.findRepoRoot();
  const config = deps.gadConfig.load(baseDir);
  const root = (config.roots || []).find((r) => r.id === projectid);
  if (!root) return null;
  return path.isAbsolute(root.path) ? root.path : path.resolve(baseDir, root.path);
}

function requireProjectRoot(deps, projectid) {
  if (!projectid) deps.outputError('--projectid is required');
  const root = resolveProjectRootById(deps, projectid);
  if (!root) deps.outputError(`Unknown projectid: ${projectid}. Use \`gad projects list\` to see registered projects.`);
  return root;
}

function formatSize(bytes) {
  if (!Number.isFinite(bytes)) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function readStdinSync() {
  try {
    return fs.readFileSync(0);
  } catch (err) {
    throw new Error(`Failed to read stdin: ${err.message || err}`);
  }
}

function createMediaCommand(deps) {
  const { outputError, output, shouldUseJson } = deps;

  const list = defineCommand({
    meta: { name: 'list', description: 'List media (all or --projectid-scoped)' },
    args: {
      projectid: { type: 'string', description: 'If set, list media attached to this project (card-first)', default: '' },
      limit: { type: 'string', description: 'Max rows (default: 200)', default: '200' },
      json: { type: 'boolean', description: 'Emit JSON array of MediaItem', default: false },
    },
    run({ args }) {
      const wantJson = Boolean(args.json) || shouldUseJson();
      const limit = Math.max(1, parseInt(args.limit, 10) || 200);

      let rows;
      if (args.projectid) {
        const projectRoot = requireProjectRoot(deps, args.projectid);
        rows = mediaStore.listMediaForProject(projectRoot);
      } else {
        rows = mediaStore.listMedia();
        // Newest first.
        rows = rows.slice().sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
        rows = rows.map((r) => ({ ...r, isCard: false }));
      }
      rows = rows.slice(0, limit);

      if (wantJson) {
        console.log(JSON.stringify(rows));
        return;
      }

      if (rows.length === 0) {
        console.log('No media.');
        return;
      }

      const display = rows.map((r) => ({
        id: r.id,
        source: r.source,
        mime: r.mimeType,
        size: formatSize(r.bytes || 0),
        card: r.isCard ? 'yes' : '',
        created: String(r.createdAt).slice(0, 19).replace('T', ' '),
        prompt: (r.prompt || r.originalFilename || '').slice(0, 60),
      }));
      output(display, { title: args.projectid ? `Media attached to ${args.projectid}` : 'Media library' });
    },
  });

  const save = defineCommand({
    meta: {
      name: 'save',
      description: 'Copy a file into ~/.gad/media and optionally attach to a project.',
    },
    args: {
      file: { type: 'positional', description: 'Path to the local file', required: true },
      projectid: { type: 'string', description: 'Attach to this project', default: '' },
      'set-card': { type: 'boolean', description: 'With --projectid, set as card image', default: false },
      prompt: { type: 'string', description: 'Optional prompt/caption to record', default: '' },
      source: { type: 'string', description: 'Source tag (upload|generate|external)', default: 'upload' },
      mime: { type: 'string', description: 'Override MIME type (else inferred from extension)', default: '' },
      json: { type: 'boolean', description: 'Emit JSON', default: false },
    },
    run({ args }) {
      const wantJson = Boolean(args.json) || shouldUseJson();
      const abs = path.resolve(args.file);
      if (!fs.existsSync(abs)) outputError(`File not found: ${abs}`);

      const record = mediaStore.saveMediaBytes({
        sourcePath: abs,
        mimeType: args.mime || undefined,
        source: args.source || 'upload',
        prompt: args.prompt || undefined,
      });

      let attached = false;
      let setCard = false;
      if (args.projectid) {
        const projectRoot = requireProjectRoot(deps, args.projectid);
        if (args['set-card']) {
          mediaStore.setProjectCardMedia(projectRoot, record.id);
          setCard = true;
          attached = true;
        } else {
          attached = mediaStore.attachMediaToProject(projectRoot, record.id) || true;
        }
      }

      if (wantJson) {
        console.log(JSON.stringify({ ok: true, media: record, attached, setCard, projectid: args.projectid || null }));
      } else {
        console.log(`Saved ${record.id} → ${mediaStore.mediaFilePath(record)}`);
        if (attached) console.log(`Attached to ${args.projectid}${setCard ? ' (as card)' : ''}`);
      }
    },
  });

  const saveBase64 = defineCommand({
    meta: {
      name: 'save-base64',
      description: 'Save image bytes from --data (base64) or stdin. Used by the desktop app for uploads.',
    },
    args: {
      data: { type: 'string', description: 'Base64-encoded bytes. If omitted, reads stdin.', default: '' },
      mime: { type: 'string', description: 'MIME type (e.g. image/png). Required.', default: '' },
      filename: { type: 'string', description: 'Original filename (for display)', default: '' },
      projectid: { type: 'string', description: 'Attach to this project', default: '' },
      'set-card': { type: 'boolean', description: 'With --projectid, set as card image', default: false },
      prompt: { type: 'string', description: 'Optional prompt/caption to record', default: '' },
      source: { type: 'string', description: 'Source tag (upload|generate|external)', default: 'upload' },
      json: { type: 'boolean', description: 'Emit JSON', default: false },
    },
    run({ args }) {
      const wantJson = Boolean(args.json) || shouldUseJson();
      if (!args.mime) outputError('--mime is required (e.g. image/png)');

      let base64 = (args.data || '').trim();
      if (!base64) {
        const buf = readStdinSync();
        base64 = buf.toString('utf8').trim();
      }
      if (!base64) outputError('No base64 data provided (--data or stdin)');

      let bytes;
      try {
        bytes = Buffer.from(base64, 'base64');
      } catch (err) {
        outputError(`Invalid base64: ${err.message || err}`);
      }
      if (!bytes || bytes.length === 0) outputError('Decoded buffer is empty');

      const record = mediaStore.saveMediaBytes({
        bytes,
        mimeType: args.mime,
        originalFilename: args.filename || undefined,
        source: args.source || 'upload',
        prompt: args.prompt || undefined,
      });

      let attached = false;
      let setCard = false;
      if (args.projectid) {
        const projectRoot = requireProjectRoot(deps, args.projectid);
        if (args['set-card']) {
          mediaStore.setProjectCardMedia(projectRoot, record.id);
          setCard = true;
          attached = true;
        } else {
          attached = mediaStore.attachMediaToProject(projectRoot, record.id) || true;
        }
      }

      if (wantJson) {
        console.log(JSON.stringify({ ok: true, media: record, attached, setCard, projectid: args.projectid || null }));
      } else {
        console.log(`Saved ${record.id} (${formatSize(record.bytes || 0)}) → ${mediaStore.mediaFilePath(record)}`);
        if (attached) console.log(`Attached to ${args.projectid}${setCard ? ' (as card)' : ''}`);
      }
    },
  });

  const attach = defineCommand({
    meta: { name: 'attach', description: 'Attach a mediaId to a project.' },
    args: {
      mediaid: { type: 'positional', description: 'Media id', required: true },
      projectid: { type: 'string', description: 'Project id', default: '' },
      'set-card': { type: 'boolean', description: 'Also set as card image', default: false },
      json: { type: 'boolean', description: 'Emit JSON', default: false },
    },
    run({ args }) {
      const wantJson = Boolean(args.json) || shouldUseJson();
      const projectRoot = requireProjectRoot(deps, args.projectid);
      const media = mediaStore.findMediaById(args.mediaid);
      if (!media) outputError(`Unknown mediaId: ${args.mediaid}`);
      if (args['set-card']) mediaStore.setProjectCardMedia(projectRoot, media.id);
      else mediaStore.attachMediaToProject(projectRoot, media.id);
      if (wantJson) {
        console.log(JSON.stringify({ ok: true, mediaId: media.id, projectid: args.projectid, setCard: Boolean(args['set-card']) }));
      } else {
        console.log(`Attached ${media.id} to ${args.projectid}${args['set-card'] ? ' (as card)' : ''}`);
      }
    },
  });

  const detach = defineCommand({
    meta: { name: 'detach', description: 'Detach a mediaId from a project (global file kept).' },
    args: {
      mediaid: { type: 'positional', description: 'Media id', required: true },
      projectid: { type: 'string', description: 'Project id', default: '' },
      json: { type: 'boolean', description: 'Emit JSON', default: false },
    },
    run({ args }) {
      const wantJson = Boolean(args.json) || shouldUseJson();
      const projectRoot = requireProjectRoot(deps, args.projectid);
      const removed = mediaStore.detachMediaFromProject(projectRoot, args.mediaid);
      if (wantJson) {
        console.log(JSON.stringify({ ok: true, mediaId: args.mediaid, projectid: args.projectid, removed }));
      } else {
        console.log(removed ? `Detached ${args.mediaid} from ${args.projectid}` : `${args.mediaid} was not attached to ${args.projectid}`);
      }
    },
  });

  const setCard = defineCommand({
    meta: { name: 'set-card', description: "Set a media item as the project's card image." },
    args: {
      mediaid: { type: 'positional', description: 'Media id', required: true },
      projectid: { type: 'string', description: 'Project id', default: '' },
      json: { type: 'boolean', description: 'Emit JSON', default: false },
    },
    run({ args }) {
      const wantJson = Boolean(args.json) || shouldUseJson();
      const projectRoot = requireProjectRoot(deps, args.projectid);
      const media = mediaStore.findMediaById(args.mediaid);
      if (!media) outputError(`Unknown mediaId: ${args.mediaid}`);
      mediaStore.setProjectCardMedia(projectRoot, media.id);
      if (wantJson) {
        console.log(JSON.stringify({ ok: true, mediaId: media.id, projectid: args.projectid, isCard: true }));
      } else {
        console.log(`Set ${media.id} as card image for ${args.projectid}`);
      }
    },
  });

  const getCard = defineCommand({
    meta: { name: 'get-card', description: "Print the project's current card media info." },
    args: {
      projectid: { type: 'string', description: 'Project id', default: '' },
      json: { type: 'boolean', description: 'Emit JSON', default: false },
    },
    run({ args }) {
      const wantJson = Boolean(args.json) || shouldUseJson();
      const projectRoot = requireProjectRoot(deps, args.projectid);
      const mediaId = mediaStore.getProjectCardMedia(projectRoot);
      const media = mediaId ? mediaStore.findMediaById(mediaId) : null;
      if (wantJson) {
        console.log(JSON.stringify({
          ok: true,
          projectid: args.projectid,
          mediaId: mediaId || null,
          media: media || null,
          filePath: media ? mediaStore.mediaFilePath(media) : null,
        }));
      } else if (!media) {
        console.log('No card image set.');
      } else {
        console.log(`${media.id} (${media.mimeType}) → ${mediaStore.mediaFilePath(media)}`);
      }
    },
  });

  const pathCmd = defineCommand({
    meta: { name: 'path', description: 'Print the absolute file path for a mediaId.' },
    args: {
      mediaid: { type: 'positional', description: 'Media id', required: true },
      json: { type: 'boolean', description: 'Emit JSON', default: false },
    },
    run({ args }) {
      const wantJson = Boolean(args.json) || shouldUseJson();
      const media = mediaStore.findMediaById(args.mediaid);
      if (!media) outputError(`Unknown mediaId: ${args.mediaid}`);
      const p = mediaStore.mediaFilePath(media);
      if (wantJson) {
        console.log(JSON.stringify({ ok: true, mediaId: media.id, filePath: p, mimeType: media.mimeType }));
      } else {
        console.log(p);
      }
    },
  });

  const readBase64 = defineCommand({
    meta: {
      name: 'read-base64',
      description: 'Print the media bytes as base64. With --data-url, wraps in a data: URL.',
    },
    args: {
      mediaid: { type: 'positional', description: 'Media id', required: true },
      'data-url': { type: 'boolean', description: 'Emit a data: URL instead of raw base64', default: false },
      json: { type: 'boolean', description: 'Emit JSON { ok, mediaId, mimeType, dataUrl }', default: false },
    },
    run({ args }) {
      const wantJson = Boolean(args.json) || shouldUseJson();
      const media = mediaStore.findMediaById(args.mediaid);
      if (!media) outputError(`Unknown mediaId: ${args.mediaid}`);
      const p = mediaStore.mediaFilePath(media);
      if (!fs.existsSync(p)) outputError(`Media file missing on disk: ${p}`);
      const base64 = fs.readFileSync(p).toString('base64');
      const dataUrl = `data:${media.mimeType};base64,${base64}`;
      if (wantJson) {
        console.log(JSON.stringify({
          ok: true,
          mediaId: media.id,
          mimeType: media.mimeType,
          bytes: media.bytes || base64.length,
          dataUrl,
        }));
      } else if (args['data-url']) {
        console.log(dataUrl);
      } else {
        console.log(base64);
      }
    },
  });

  const del = defineCommand({
    meta: { name: 'delete', description: 'Delete a media item globally (file + index entry).' },
    args: {
      mediaid: { type: 'positional', description: 'Media id', required: true },
      json: { type: 'boolean', description: 'Emit JSON', default: false },
    },
    run({ args }) {
      const wantJson = Boolean(args.json) || shouldUseJson();
      const removed = mediaStore.deleteMediaRecord(args.mediaid);
      if (wantJson) {
        console.log(JSON.stringify({ ok: true, mediaId: args.mediaid, removed }));
      } else {
        console.log(removed ? `Deleted ${args.mediaid}` : `${args.mediaid} not found`);
      }
    },
  });

  return defineCommand({
    meta: {
      name: 'media',
      description: 'Local media library — generate/upload images, attach to projects, set card images.',
    },
    subCommands: {
      list,
      save,
      'save-base64': saveBase64,
      attach,
      detach,
      'set-card': setCard,
      'get-card': getCard,
      path: pathCmd,
      'read-base64': readBase64,
      delete: del,
    },
  });
}

module.exports = { createMediaCommand };
module.exports.register = (ctx) => ({ media: createMediaCommand(ctx.common) });
