'use strict';
/**
 * lib/team/mailbox.cjs — per-worker mailbox ops.
 * Mailbox items are .msg.json files. Oldest-first consumption.
 * Failed items get renamed to .failed.json for diagnosis.
 */

const fs = require('fs');
const path = require('path');
const { readJsonSafe, writeJson, appendJsonl } = require('./io.cjs');
const { workerMailbox, dispatchSeqPath, supervisorLog } = require('./paths.cjs');

function mailboxDepth(baseDir, id) {
  const mbox = workerMailbox(baseDir, id);
  if (!fs.existsSync(mbox)) return 0;
  return fs.readdirSync(mbox).filter(f => f.endsWith('.msg.json')).length;
}

function popOldest(baseDir, id) {
  const mbox = workerMailbox(baseDir, id);
  if (!fs.existsSync(mbox)) return null;
  const files = fs.readdirSync(mbox).filter(f => f.endsWith('.msg.json')).sort();
  if (files.length === 0) return null;
  const file = files[0];
  const full = path.join(mbox, file);
  const msg = readJsonSafe(full, null);
  if (!msg) { try { fs.unlinkSync(full); } catch {} return null; }
  return { msg, file, fullPath: full };
}

function markFailed(fullPath) {
  try { fs.renameSync(fullPath, fullPath.replace(/\.msg\.json$/, '.failed.json')); } catch {}
}

function markDone(fullPath) {
  try { fs.unlinkSync(fullPath); } catch {}
}

function nextSeq(baseDir) {
  const p = dispatchSeqPath(baseDir);
  const cur = Number(fs.existsSync(p) ? fs.readFileSync(p, 'utf8').trim() : '0') || 0;
  const n = cur + 1;
  fs.writeFileSync(p, String(n));
  return String(n).padStart(4, '0');
}

function enqueueMessage(baseDir, workerId, msg) {
  const seq = nextSeq(baseDir);
  const refSafe = String(msg.ref || 'unknown').replace(/[^A-Za-z0-9._-]/g, '_');
  const filename = `${seq}-${msg.kind}-${refSafe}.msg.json`;
  const fullPath = path.join(workerMailbox(baseDir, workerId), filename);
  writeJson(fullPath, msg);
  appendJsonl(supervisorLog(baseDir), {
    ts: msg.enqueued_at || new Date().toISOString(),
    kind: msg.enqueued_by === 'dispatcher' ? 'dispatch' : 'enqueue',
    worker_id: workerId,
    ref: msg.ref,
    priority: msg.priority,
  });
  return fullPath;
}

function listMailboxRefs(baseDir, ids) {
  const queued = new Set();
  for (const id of ids) {
    const mbox = workerMailbox(baseDir, id);
    if (!fs.existsSync(mbox)) continue;
    for (const f of fs.readdirSync(mbox)) {
      if (!f.endsWith('.msg.json')) continue;
      const m = readJsonSafe(path.join(mbox, f), null);
      if (m && m.ref) queued.add(m.ref);
    }
  }
  return queued;
}

module.exports = { mailboxDepth, popOldest, markFailed, markDone, nextSeq, enqueueMessage, listMailboxRefs };
