'use strict';
/**
 * lib/dns/providers/ionos.cjs
 *
 * IONOS Cloud DNS API client.
 *
 * Auth: set IONOS_API_KEY or IONOS_API_TOKEN in your environment.
 * Generate a key at https://developer.hosting.ionos.com/
 * Store it via: gad env set IONOS_API_KEY --projectid global
 *
 * Dry-run: set GAD_DOMAINS_DRY_RUN=1 to return mock responses without
 * firing any HTTP. Safe for tests and smoke runs.
 *
 * No new dependencies — uses native Node fetch (Node 18+).
 */

const DEFAULT_BASE_URL = 'https://api.hosting.ionos.com/dns/v1';

// ---------------------------------------------------------------------------
// Mock data for dry-run mode
// ---------------------------------------------------------------------------

const MOCK_ZONES = [
  { id: 'mock-zone-magicbornstudios', name: 'magicbornstudios.com', type: 'NATIVE' },
];

const MOCK_RECORDS = [
  {
    id: 'mock-record-001',
    name: 'framework',
    type: 'A',
    content: '1.2.3.4',
    ttl: 3600,
    prio: 0,
    disabled: false,
    zoneId: 'mock-zone-magicbornstudios',
  },
  {
    id: 'mock-record-002',
    name: 'platform',
    type: 'A',
    content: '5.6.7.8',
    ttl: 3600,
    prio: 0,
    disabled: false,
    zoneId: 'mock-zone-magicbornstudios',
  },
];

// ---------------------------------------------------------------------------
// API key resolution
// ---------------------------------------------------------------------------

function resolveApiKey() {
  const key = process.env.IONOS_API_KEY || process.env.IONOS_API_TOKEN;
  if (!key) {
    const err = new Error(
      'IONOS API key not found. Set IONOS_API_KEY or IONOS_API_TOKEN in your environment.\n' +
      'Generate one at: https://developer.hosting.ionos.com/\n' +
      'Store it via:    gad env set IONOS_API_KEY --projectid global\n' +
      'Or set it inline: IONOS_API_KEY=<token> gad domains list'
    );
    err.code = 'IONOS_NO_API_KEY';
    throw err;
  }
  return key;
}

// ---------------------------------------------------------------------------
// HTTP helper
// ---------------------------------------------------------------------------

async function ionosRequest(method, path, body, baseUrl) {
  const url = `${baseUrl || DEFAULT_BASE_URL}${path}`;
  const apiKey = resolveApiKey();

  const opts = {
    method,
    headers: {
      'X-API-Key': apiKey,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
  };
  if (body !== undefined && body !== null) {
    opts.body = JSON.stringify(body);
  }

  let res;
  try {
    res = await fetch(url, opts);
  } catch (err) {
    const wrapped = new Error(`IONOS API network error [${method} ${url}]: ${err.message}`);
    wrapped.code = 'IONOS_NETWORK_ERROR';
    wrapped.cause = err;
    throw wrapped;
  }

  if (!res.ok) {
    let detail = '';
    try {
      const text = await res.text();
      detail = text.slice(0, 400);
    } catch (_) { /* ignore */ }
    const err = new Error(`IONOS API error ${res.status} [${method} ${url}]: ${detail}`);
    err.code = 'IONOS_API_ERROR';
    err.status = res.status;
    throw err;
  }

  if (res.status === 204) return null;
  return res.json();
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * List all DNS zones accessible with the configured API key.
 * @returns {Promise<Array<{id, name, type}>>}
 */
async function listZones({ baseUrl } = {}) {
  if (process.env.GAD_DOMAINS_DRY_RUN === '1') {
    return MOCK_ZONES.map(z => ({ ...z }));
  }
  const data = await ionosRequest('GET', '/zones', null, baseUrl);
  return Array.isArray(data) ? data : (data.zones || []);
}

/**
 * List all records in a zone.
 * @param {string} zoneId — provider zone id (from listZones)
 * @returns {Promise<Array<{id, name, type, content, ttl, prio, disabled}>>}
 */
async function listRecords(zoneId, { baseUrl } = {}) {
  if (process.env.GAD_DOMAINS_DRY_RUN === '1') {
    return MOCK_RECORDS.filter(r => r.zoneId === zoneId).map(r => ({ ...r }));
  }
  const data = await ionosRequest('GET', `/zones/${zoneId}`, null, baseUrl);
  // IONOS returns { id, name, records: [...] } for a zone detail
  if (data && Array.isArray(data.records)) return data.records;
  if (Array.isArray(data)) return data;
  return [];
}

/**
 * Create a record in a zone.
 * @param {string} zoneId
 * @param {{ name: string, type: string, content: string, ttl?: number, prio?: number }} payload
 * @returns {Promise<{id, name, type, content, ttl, prio, disabled}>}
 */
async function createRecord(zoneId, payload, { baseUrl } = {}) {
  if (process.env.GAD_DOMAINS_DRY_RUN === '1') {
    return {
      id: `mock-record-dry-${Date.now()}`,
      name: payload.name,
      type: payload.type,
      content: payload.content,
      ttl: payload.ttl || 3600,
      prio: payload.prio || 0,
      disabled: false,
      zoneId,
      _dry_run: true,
    };
  }
  // IONOS expects an array of records under the zone patch
  const body = [
    {
      name: payload.name,
      type: payload.type,
      content: payload.content,
      ttl: payload.ttl || 3600,
      prio: payload.prio || 0,
      disabled: false,
    },
  ];
  const data = await ionosRequest('PATCH', `/zones/${zoneId}`, body, baseUrl);
  // Returns array of created records
  if (Array.isArray(data) && data.length > 0) return data[0];
  return data;
}

/**
 * Delete a record from a zone.
 * @param {string} zoneId
 * @param {string} recordId — provider record id
 * @returns {Promise<null>}
 */
async function deleteRecord(zoneId, recordId, { baseUrl } = {}) {
  if (process.env.GAD_DOMAINS_DRY_RUN === '1') {
    return { _dry_run: true, deleted: recordId };
  }
  await ionosRequest('DELETE', `/zones/${zoneId}/records/${recordId}`, null, baseUrl);
  return null;
}

/**
 * Find a zone by name from the list of accessible zones.
 * Useful for resolving a zone name like "magicbornstudios.com" to its provider id.
 * @param {string} zoneName
 * @returns {Promise<{id, name, type}|null>}
 */
async function findZoneByName(zoneName, opts = {}) {
  const zones = await listZones(opts);
  return zones.find(z => z.name === zoneName || z.name === `${zoneName}.`) || null;
}

module.exports = {
  DEFAULT_BASE_URL,
  listZones,
  listRecords,
  createRecord,
  deleteRecord,
  findZoneByName,
};
