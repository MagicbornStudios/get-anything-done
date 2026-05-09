'use strict';
/**
 * lib/dns/registry.cjs
 *
 * Local TOML-based DNS record registry.
 *
 * Storage layout:
 *   <projectroot>/.planning/dns-records/<zone>.toml
 *
 * TOML format — block-table arrays:
 *   [[records]]
 *   record_id = "magicborn-framework-a-record"
 *   zone      = "magicbornstudios.com"
 *   ...
 *
 * No new dependencies — all helpers are inline.
 */

const fs = require('fs');
const path = require('path');

// ---------------------------------------------------------------------------
// Minimal TOML block-table parser
// ---------------------------------------------------------------------------

/**
 * Parse a TOML file containing [[records]] block-table arrays plus optional
 * scalar key/value pairs at the top level.  Returns an array of record objects.
 *
 * Only supports:
 *   - [[records]] block-table header
 *   - scalar values: unquoted, double-quoted, single-quoted, bool, null, integer
 *   - skips comments and blank lines
 *
 * This is intentionally minimal — sufficient for the dns-records format.
 */
function parseBlockTableToml(text) {
  const records = [];
  let current = null;

  const lines = text.split(/\r?\n/);
  for (const raw of lines) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;

    if (line === '[[records]]') {
      if (current) records.push(current);
      current = {};
      continue;
    }

    if (line.startsWith('[')) continue; // skip other section headers

    const eqIdx = line.indexOf('=');
    if (eqIdx === -1) continue;

    const key = line.slice(0, eqIdx).trim();
    const rawVal = line.slice(eqIdx + 1).trim();
    const val = parseTomlScalar(rawVal);

    if (current) {
      current[key] = val;
    }
  }

  if (current) records.push(current);
  return records;
}

function parseTomlScalar(rawV) {
  if (rawV === 'true') return true;
  if (rawV === 'false') return false;
  if (rawV === 'null') return null;
  const dq = rawV.match(/^"(.*)"$/s);
  if (dq) {
    return dq[1]
      .replace(/\\n/g, '\n')
      .replace(/\\t/g, '\t')
      .replace(/\\"/g, '"')
      .replace(/\\\\/g, '\\');
  }
  const sq = rawV.match(/^'(.*)'$/s);
  if (sq) return sq[1];
  const num = Number(rawV);
  if (!isNaN(num) && rawV !== '') return num;
  return rawV;
}

function tomlScalarSerialize(v) {
  if (v === null || v === undefined) return 'null';
  if (typeof v === 'boolean') return String(v);
  if (typeof v === 'number') return String(v);
  if (typeof v === 'string') {
    const escaped = v
      .replace(/\\/g, '\\\\')
      .replace(/"/g, '\\"')
      .replace(/\n/g, '\\n')
      .replace(/\t/g, '\\t');
    return `"${escaped}"`;
  }
  return `"${String(v)}"`;
}

// ---------------------------------------------------------------------------
// Path helpers
// ---------------------------------------------------------------------------

function dnsRecordsDirForProject(projectRoot) {
  return path.join(projectRoot, '.planning', 'dns-records');
}

function zoneFilePath(projectRoot, zone) {
  const safe = zone.replace(/[^a-zA-Z0-9._-]/g, '_');
  return path.join(dnsRecordsDirForProject(projectRoot), `${safe}.toml`);
}

// ---------------------------------------------------------------------------
// Read / write
// ---------------------------------------------------------------------------

/**
 * Read all records from the zone TOML file.
 * Returns [] if the file does not exist.
 */
function readZoneRecords(projectRoot, zone) {
  const filePath = zoneFilePath(projectRoot, zone);
  let text;
  try {
    text = fs.readFileSync(filePath, 'utf8');
  } catch (e) {
    if (e.code === 'ENOENT') return [];
    throw e;
  }
  return parseBlockTableToml(text);
}

/**
 * Write all records to the zone TOML file (full overwrite).
 * Creates parent directories if needed.
 */
function writeZoneRecords(projectRoot, zone, records) {
  const filePath = zoneFilePath(projectRoot, zone);
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  const SCALAR_KEYS = [
    'record_id', 'zone', 'subdomain', 'type', 'value', 'ttl',
    'provider', 'provider_record_id', 'purpose', 'created_at',
    'updated_at', 'created_by', 'status', 'last_verified_at', 'notes',
  ];

  const lines = [];
  for (const rec of records) {
    lines.push('[[records]]');
    for (const k of SCALAR_KEYS) {
      if (k in rec) {
        lines.push(`${k} = ${tomlScalarSerialize(rec[k])}`);
      }
    }
    // project_link: may already be flattened (project_link_projectid keys) or
    // may be an object (when writeZoneRecords is called with hydrated records).
    if ('project_link_projectid' in rec) {
      // Already flattened — write the prefixed keys directly
      lines.push(`project_link_projectid = ${tomlScalarSerialize(rec.project_link_projectid)}`);
      lines.push(`project_link_soul_id = ${tomlScalarSerialize(rec.project_link_soul_id || null)}`);
      lines.push(`project_link_customer_id = ${tomlScalarSerialize(rec.project_link_customer_id || null)}`);
    } else if (rec.project_link && typeof rec.project_link === 'object') {
      lines.push(`project_link_projectid = ${tomlScalarSerialize(rec.project_link.projectid || null)}`);
      lines.push(`project_link_soul_id = ${tomlScalarSerialize(rec.project_link.soul_id || null)}`);
      lines.push(`project_link_customer_id = ${tomlScalarSerialize(rec.project_link.customer_id || null)}`);
    } else {
      lines.push(`project_link_projectid = null`);
      lines.push(`project_link_soul_id = null`);
      lines.push(`project_link_customer_id = null`);
    }
    lines.push('');
  }

  const tmp = `${filePath}.tmp-${process.pid}-${Date.now()}`;
  fs.writeFileSync(tmp, lines.join('\n'), 'utf8');
  fs.renameSync(tmp, filePath);
}

/**
 * Reconstruct project_link object from prefixed TOML keys.
 * Mutates the record in-place — call after parseBlockTableToml.
 */
function hydrateProjectLink(rec) {
  if ('project_link_projectid' in rec) {
    const projectid = rec.project_link_projectid;
    if (projectid) {
      rec.project_link = {
        projectid,
        soul_id: rec.project_link_soul_id || null,
        customer_id: rec.project_link_customer_id || null,
      };
    } else {
      rec.project_link = null;
    }
    delete rec.project_link_projectid;
    delete rec.project_link_soul_id;
    delete rec.project_link_customer_id;
  }
  return rec;
}

/**
 * List records, optionally filtered.
 * Hydrates project_link from prefixed keys.
 */
function listRecords(projectRoot, zone, { provider, projectid } = {}) {
  let records = readZoneRecords(projectRoot, zone).map(hydrateProjectLink);
  if (provider) records = records.filter(r => r.provider === provider);
  if (projectid) records = records.filter(r => r.project_link && r.project_link.projectid === projectid);
  return records;
}

/**
 * Upsert a record by record_id.  If an entry with the same record_id exists,
 * it is replaced; otherwise appended.
 */
function upsertRecord(projectRoot, zone, record) {
  // Flatten project_link before storage
  const flat = { ...record };
  if (flat.project_link && typeof flat.project_link === 'object') {
    flat.project_link_projectid = flat.project_link.projectid || null;
    flat.project_link_soul_id = flat.project_link.soul_id || null;
    flat.project_link_customer_id = flat.project_link.customer_id || null;
    delete flat.project_link;
  } else {
    flat.project_link_projectid = null;
    flat.project_link_soul_id = null;
    flat.project_link_customer_id = null;
    delete flat.project_link;
  }

  const existing = readZoneRecords(projectRoot, zone);
  const idx = existing.findIndex(r => r.record_id === flat.record_id);
  if (idx >= 0) {
    existing[idx] = flat;
  } else {
    existing.push(flat);
  }
  writeZoneRecords(projectRoot, zone, existing);
}

/**
 * Mark a record's status field (planned → deleted, etc.).
 * Returns false if record_id not found.
 */
function patchRecordStatus(projectRoot, zone, recordId, status, extra = {}) {
  const existing = readZoneRecords(projectRoot, zone);
  const idx = existing.findIndex(r => r.record_id === recordId);
  if (idx < 0) return false;
  existing[idx] = {
    ...existing[idx],
    status,
    updated_at: new Date().toISOString(),
    ...extra,
  };
  writeZoneRecords(projectRoot, zone, existing);
  return true;
}

/**
 * Enumerate all zones for which a .toml file exists under .planning/dns-records/.
 */
function listKnownZones(projectRoot) {
  const dir = dnsRecordsDirForProject(projectRoot);
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter(f => f.endsWith('.toml'))
    .map(f => f.replace(/\.toml$/, ''));
}

/**
 * Build a canonical record_id from subdomain + type + zone + optional suffix.
 */
function buildRecordId(zone, subdomain, type, suffix = '') {
  const base = zone.replace(/\./g, '-');
  const sub = subdomain || 'apex';
  const t = type.toLowerCase();
  const parts = [base, sub, t];
  if (suffix) parts.push(suffix);
  return parts.join('-').replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-');
}

module.exports = {
  zoneFilePath,
  readZoneRecords,
  writeZoneRecords,
  listRecords,
  upsertRecord,
  patchRecordStatus,
  listKnownZones,
  buildRecordId,
  hydrateProjectLink,
  // expose for tests
  parseBlockTableToml,
  tomlScalarSerialize,
};
