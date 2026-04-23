'use strict';
/**
 * media-store.cjs — user-local media library with per-project attachments.
 *
 * Storage model (hybrid — decision captured in chat 2026-04-23):
 *
 *   ~/.gad/media/
 *     index.json                    canonical list of all saved media
 *     files/<uuid>.<ext>            binary files, uuid-keyed
 *
 *   <project_root>/.planning/media-attachments.json
 *     {
 *       cardMediaId: string | null,     // image shown on the project card
 *       attachments: [
 *         { mediaId: string, attachedAt: ISO8601 },
 *         ...
 *       ]
 *     }
 *
 * Global storage means the same asset can be attached to multiple projects
 * without duplication on disk. Per-project attachment files keep the
 * project→media edges with the project root (portable when the project
 * moves, cleanly removed when the project is archived).
 *
 * All writes are atomic (write temp + rename) to survive a crash
 * mid-update. All reads tolerate missing / corrupt JSON by falling back
 * to an empty shape — the store is never blocking for a fresh user.
 *
 * Public API:
 *   - resolveMediaRoot()            → absolute path to ~/.gad/media
 *   - readMediaIndex()              → { version, items: MediaItem[] }
 *   - writeMediaIndex(index)        → void (atomic)
 *   - addMediaRecord(record)        → MediaItem (appends + writes)
 *   - findMediaById(id)             → MediaItem | null
 *   - deleteMediaRecord(id)         → boolean (removes index entry + file)
 *   - mediaFilePath(item | id)      → absolute path to the binary
 *   - extensionForMime(mime)        → 'png' | 'jpg' | …
 *   - mimeForExtension(ext)         → 'image/png' | …
 *
 *   Per-project attachments (project root required):
 *   - projectAttachmentsPath(root)  → abs path to .planning/media-attachments.json
 *   - readProjectAttachments(root)  → { cardMediaId, attachments[] }
 *   - writeProjectAttachments(root, data) → void
 *   - attachMediaToProject(root, mediaId) → void
 *   - detachMediaFromProject(root, mediaId) → boolean
 *   - setProjectCardMedia(root, mediaId | null) → void
 *   - getProjectCardMedia(root)     → mediaId | null
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');

// ---------------------------------------------------------------------------
// Paths
// ---------------------------------------------------------------------------

function resolveMediaRoot() {
  const override = process.env.GAD_MEDIA_ROOT;
  if (override && override.trim()) return path.resolve(override.trim());
  return path.join(os.homedir(), '.gad', 'media');
}

function mediaIndexPath() {
  return path.join(resolveMediaRoot(), 'index.json');
}

function mediaFilesDir() {
  return path.join(resolveMediaRoot(), 'files');
}

function mediaFilePath(itemOrId) {
  const item = typeof itemOrId === 'string' ? findMediaById(itemOrId) : itemOrId;
  if (!item || !item.storageFilename) return null;
  return path.join(mediaFilesDir(), item.storageFilename);
}

function projectAttachmentsPath(projectRoot) {
  if (!projectRoot || typeof projectRoot !== 'string') {
    throw new TypeError('projectAttachmentsPath: projectRoot must be a non-empty string');
  }
  return path.join(projectRoot, '.planning', 'media-attachments.json');
}

// ---------------------------------------------------------------------------
// MIME / extension mapping
// ---------------------------------------------------------------------------

const MIME_TO_EXT = Object.freeze({
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/svg+xml': 'svg',
  'image/avif': 'avif',
});

const EXT_TO_MIME = Object.freeze({
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  gif: 'image/gif',
  svg: 'image/svg+xml',
  avif: 'image/avif',
});

function extensionForMime(mime) {
  if (!mime || typeof mime !== 'string') return 'bin';
  return MIME_TO_EXT[mime.toLowerCase().trim()] || 'bin';
}

function mimeForExtension(ext) {
  if (!ext || typeof ext !== 'string') return 'application/octet-stream';
  const trimmed = ext.replace(/^\./, '').toLowerCase().trim();
  return EXT_TO_MIME[trimmed] || 'application/octet-stream';
}

// ---------------------------------------------------------------------------
// Atomic JSON helpers (private)
// ---------------------------------------------------------------------------

function readJsonSafely(filePath, fallback) {
  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    const parsed = JSON.parse(raw);
    return parsed;
  } catch (err) {
    if (err && err.code === 'ENOENT') return fallback;
    // Tolerate corrupt JSON — return the fallback rather than crash the CLI.
    // A corrupt index.json shouldn't brick every subsequent `gad media` call.
    return fallback;
  }
}

function writeJsonAtomic(filePath, value) {
  const dir = path.dirname(filePath);
  fs.mkdirSync(dir, { recursive: true });
  const tmp = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  fs.writeFileSync(tmp, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  fs.renameSync(tmp, filePath);
}

// ---------------------------------------------------------------------------
// Global index
// ---------------------------------------------------------------------------

const INDEX_VERSION = 1;

function emptyIndex() {
  return { version: INDEX_VERSION, items: [] };
}

function readMediaIndex() {
  const data = readJsonSafely(mediaIndexPath(), emptyIndex());
  if (!data || typeof data !== 'object') return emptyIndex();
  if (!Array.isArray(data.items)) return emptyIndex();
  return {
    version: Number.isInteger(data.version) ? data.version : INDEX_VERSION,
    items: data.items.filter((item) => item && typeof item.id === 'string'),
  };
}

function writeMediaIndex(index) {
  const safe = {
    version: Number.isInteger(index?.version) ? index.version : INDEX_VERSION,
    items: Array.isArray(index?.items) ? index.items : [],
  };
  writeJsonAtomic(mediaIndexPath(), safe);
}

/**
 * @typedef {{
 *   id: string,
 *   storageFilename: string,
 *   originalFilename?: string,
 *   mimeType: string,
 *   bytes?: number,
 *   createdAt: string,
 *   source: 'upload' | 'generate' | 'external',
 *   prompt?: string,
 *   model?: string,
 *   revisedPrompt?: string,
 * }} MediaItem
 */

function findMediaById(id) {
  if (!id || typeof id !== 'string') return null;
  const index = readMediaIndex();
  return index.items.find((item) => item.id === id) || null;
}

function listMedia() {
  return readMediaIndex().items;
}

function addMediaRecord(partial) {
  if (!partial || !partial.mimeType) {
    throw new Error('addMediaRecord: mimeType is required');
  }
  const id = partial.id || crypto.randomUUID();
  const ext = extensionForMime(partial.mimeType);
  const storageFilename = partial.storageFilename || `${id}.${ext}`;
  const record = {
    id,
    storageFilename,
    originalFilename: partial.originalFilename || '',
    mimeType: partial.mimeType,
    bytes: Number.isInteger(partial.bytes) ? partial.bytes : undefined,
    createdAt: partial.createdAt || new Date().toISOString(),
    source: partial.source || 'external',
    prompt: partial.prompt || undefined,
    model: partial.model || undefined,
    revisedPrompt: partial.revisedPrompt || undefined,
  };
  const index = readMediaIndex();
  // Dedup: if id already exists, replace the row (idempotent re-save).
  const without = index.items.filter((it) => it.id !== id);
  without.push(record);
  writeMediaIndex({ version: INDEX_VERSION, items: without });
  return record;
}

function deleteMediaRecord(id) {
  const index = readMediaIndex();
  const target = index.items.find((it) => it.id === id);
  if (!target) return false;
  const remaining = index.items.filter((it) => it.id !== id);
  writeMediaIndex({ version: INDEX_VERSION, items: remaining });
  const filePath = path.join(mediaFilesDir(), target.storageFilename);
  try { fs.unlinkSync(filePath); } catch (err) { if (err && err.code !== 'ENOENT') throw err; }
  return true;
}

/**
 * Copy bytes (or a source file) into the media store and create an index
 * entry. Returns the persisted MediaItem.
 */
function saveMediaBytes({ bytes, sourcePath, mimeType, originalFilename, source, prompt, model, revisedPrompt }) {
  let buffer;
  let mime = mimeType;
  let origName = originalFilename || '';

  if (Buffer.isBuffer(bytes)) {
    buffer = bytes;
  } else if (sourcePath) {
    const abs = path.resolve(sourcePath);
    buffer = fs.readFileSync(abs);
    if (!origName) origName = path.basename(abs);
    if (!mime) {
      const ext = path.extname(abs).replace(/^\./, '').toLowerCase();
      mime = mimeForExtension(ext);
    }
  } else {
    throw new Error('saveMediaBytes: bytes or sourcePath is required');
  }

  if (!mime) mime = 'application/octet-stream';

  fs.mkdirSync(mediaFilesDir(), { recursive: true });
  const record = addMediaRecord({
    mimeType: mime,
    originalFilename: origName,
    source: source || 'external',
    bytes: buffer.length,
    prompt,
    model,
    revisedPrompt,
  });
  const target = path.join(mediaFilesDir(), record.storageFilename);
  fs.writeFileSync(target, buffer);
  return record;
}

// ---------------------------------------------------------------------------
// Per-project attachments
// ---------------------------------------------------------------------------

function emptyAttachments() {
  return { version: 1, cardMediaId: null, attachments: [] };
}

function readProjectAttachments(projectRoot) {
  const data = readJsonSafely(projectAttachmentsPath(projectRoot), emptyAttachments());
  if (!data || typeof data !== 'object') return emptyAttachments();
  return {
    version: Number.isInteger(data.version) ? data.version : 1,
    cardMediaId: typeof data.cardMediaId === 'string' ? data.cardMediaId : null,
    attachments: Array.isArray(data.attachments)
      ? data.attachments.filter((a) => a && typeof a.mediaId === 'string')
      : [],
  };
}

function writeProjectAttachments(projectRoot, data) {
  writeJsonAtomic(projectAttachmentsPath(projectRoot), {
    version: 1,
    cardMediaId: data?.cardMediaId ?? null,
    attachments: Array.isArray(data?.attachments) ? data.attachments : [],
  });
}

function attachMediaToProject(projectRoot, mediaId) {
  if (!mediaId) throw new Error('attachMediaToProject: mediaId required');
  const state = readProjectAttachments(projectRoot);
  if (state.attachments.some((a) => a.mediaId === mediaId)) return false;
  state.attachments.push({ mediaId, attachedAt: new Date().toISOString() });
  writeProjectAttachments(projectRoot, state);
  return true;
}

function detachMediaFromProject(projectRoot, mediaId) {
  const state = readProjectAttachments(projectRoot);
  const before = state.attachments.length;
  state.attachments = state.attachments.filter((a) => a.mediaId !== mediaId);
  if (state.cardMediaId === mediaId) state.cardMediaId = null;
  writeProjectAttachments(projectRoot, state);
  return state.attachments.length !== before;
}

function setProjectCardMedia(projectRoot, mediaId) {
  const state = readProjectAttachments(projectRoot);
  if (mediaId && !state.attachments.some((a) => a.mediaId === mediaId)) {
    state.attachments.push({ mediaId, attachedAt: new Date().toISOString() });
  }
  state.cardMediaId = mediaId || null;
  writeProjectAttachments(projectRoot, state);
}

function getProjectCardMedia(projectRoot) {
  const state = readProjectAttachments(projectRoot);
  return state.cardMediaId || null;
}

// ---------------------------------------------------------------------------
// Cross-cutting: "media + project context" helpers
// ---------------------------------------------------------------------------

/**
 * List media attached to a project, joined with their index rows.
 * Returns entries sorted by attachedAt desc. Dangling attachments
 * (mediaId that no longer exists in the index) are silently dropped.
 */
function listMediaForProject(projectRoot) {
  const state = readProjectAttachments(projectRoot);
  const index = readMediaIndex();
  const byId = new Map(index.items.map((it) => [it.id, it]));
  const rows = [];
  for (const attachment of state.attachments) {
    const item = byId.get(attachment.mediaId);
    if (!item) continue;
    rows.push({
      ...item,
      attachedAt: attachment.attachedAt,
      isCard: state.cardMediaId === item.id,
    });
  }
  rows.sort((a, b) => String(b.attachedAt).localeCompare(String(a.attachedAt)));
  return rows;
}

module.exports = {
  // Paths
  resolveMediaRoot,
  mediaIndexPath,
  mediaFilesDir,
  mediaFilePath,
  projectAttachmentsPath,
  // MIME
  extensionForMime,
  mimeForExtension,
  // Global index
  readMediaIndex,
  writeMediaIndex,
  addMediaRecord,
  deleteMediaRecord,
  findMediaById,
  listMedia,
  saveMediaBytes,
  // Per-project
  readProjectAttachments,
  writeProjectAttachments,
  attachMediaToProject,
  detachMediaFromProject,
  setProjectCardMedia,
  getProjectCardMedia,
  listMediaForProject,
};
