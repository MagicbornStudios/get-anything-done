'use strict';
/**
 * Tests for DNS registry (lib/dns/registry.cjs) and IONOS provider dry-run.
 *
 * Run: node --test tests/domains-registry.test.cjs
 */

const { test, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const os = require('os');

const {
  readZoneRecords,
  writeZoneRecords,
  listRecords,
  upsertRecord,
  patchRecordStatus,
  buildRecordId,
  zoneFilePath,
} = require('../lib/dns/registry.cjs');

const {
  listZones,
  listRecords: ionosListRecords,
  createRecord,
  deleteRecord,
  findZoneByName,
} = require('../lib/dns/providers/ionos.cjs');

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

const tempDirs = [];

function makeTempDir() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gad-dns-test-'));
  tempDirs.push(dir);
  return dir;
}

afterEach(() => {
  while (tempDirs.length > 0) {
    try { fs.rmSync(tempDirs.pop(), { recursive: true, force: true }); } catch (_) { /* ignore */ }
  }
});

function setDryRun(enabled) {
  if (enabled) {
    process.env.GAD_DOMAINS_DRY_RUN = '1';
  } else {
    delete process.env.GAD_DOMAINS_DRY_RUN;
  }
}

const ZONE = 'magicbornstudios.com';

function makeSampleRecord(overrides = {}) {
  return {
    record_id: 'magicborn-framework-a-record',
    zone: ZONE,
    subdomain: 'framework',
    type: 'A',
    value: '1.2.3.4',
    ttl: 3600,
    provider: 'ionos',
    provider_record_id: null,
    purpose: 'project_root',
    project_link: { projectid: 'global', soul_id: null, customer_id: null },
    created_at: '2026-05-09T10:00:00Z',
    updated_at: null,
    created_by: 'operator-manual',
    status: 'active',
    last_verified_at: null,
    notes: null,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Test 1: list reads block-table TOML and returns records
// ---------------------------------------------------------------------------

test('list reads block-table TOML and returns records', () => {
  const projectRoot = makeTempDir();
  const filePath = zoneFilePath(projectRoot, ZONE);
  const dir = path.dirname(filePath);
  fs.mkdirSync(dir, { recursive: true });

  // Write raw TOML manually to test the parser
  const toml = `
[[records]]
record_id = "magicborn-framework-a-record"
zone = "magicbornstudios.com"
subdomain = "framework"
type = "A"
value = "1.2.3.4"
ttl = 3600
provider = "ionos"
provider_record_id = null
purpose = "project_root"
created_at = "2026-05-09T10:00:00Z"
updated_at = null
created_by = "operator-manual"
status = "active"
last_verified_at = null
notes = null
project_link_projectid = "global"
project_link_soul_id = null
project_link_customer_id = null

[[records]]
record_id = "magicborn-platform-a-record"
zone = "magicbornstudios.com"
subdomain = "platform"
type = "A"
value = "5.6.7.8"
ttl = 3600
provider = "ionos"
provider_record_id = null
purpose = "project_root"
created_at = "2026-05-09T10:30:00Z"
updated_at = null
created_by = "claude-code"
status = "active"
last_verified_at = null
notes = null
project_link_projectid = "global"
project_link_soul_id = null
project_link_customer_id = null
`.trim();

  fs.writeFileSync(filePath, toml, 'utf8');

  const records = listRecords(projectRoot, ZONE);

  assert.equal(records.length, 2, 'should return 2 records');
  assert.equal(records[0].record_id, 'magicborn-framework-a-record');
  assert.equal(records[0].type, 'A');
  assert.equal(records[0].value, '1.2.3.4');
  assert.deepEqual(records[0].project_link, { projectid: 'global', soul_id: null, customer_id: null });
  assert.equal(records[1].subdomain, 'platform');
});

// ---------------------------------------------------------------------------
// Test 2: add --type CNAME without --apply writes status=planned
// ---------------------------------------------------------------------------

test('upsertRecord writes status=planned CNAME to registry', () => {
  const projectRoot = makeTempDir();
  const zone = ZONE;

  const record = makeSampleRecord({
    record_id: buildRecordId(zone, 'client1', 'CNAME'),
    subdomain: 'client1',
    type: 'CNAME',
    value: 'client1-store.myshopify.com',
    purpose: 'external_platform_link',
    status: 'planned',
    project_link: { projectid: 'magicborn', soul_id: null, customer_id: 'cust-001' },
  });

  upsertRecord(projectRoot, zone, record);

  const records = listRecords(projectRoot, zone);
  assert.equal(records.length, 1);
  assert.equal(records[0].status, 'planned');
  assert.equal(records[0].type, 'CNAME');
  assert.equal(records[0].subdomain, 'client1');
  assert.equal(records[0].value, 'client1-store.myshopify.com');
  assert.equal(records[0].project_link.customer_id, 'cust-001');
});

// ---------------------------------------------------------------------------
// Test 3: remove without --apply marks status=deleted
// ---------------------------------------------------------------------------

test('patchRecordStatus marks existing record as deleted', () => {
  const projectRoot = makeTempDir();
  const zone = ZONE;

  const record = makeSampleRecord({ status: 'active' });
  upsertRecord(projectRoot, zone, record);

  const patched = patchRecordStatus(projectRoot, zone, record.record_id, 'deleted');
  assert.equal(patched, true, 'patchRecordStatus should return true on success');

  const records = listRecords(projectRoot, zone);
  assert.equal(records.length, 1);
  assert.equal(records[0].status, 'deleted');
  assert.ok(records[0].updated_at, 'updated_at should be set after patch');
});

// ---------------------------------------------------------------------------
// Test 4: IONOS provider in dry-run mode returns mock create response
// ---------------------------------------------------------------------------

test('IONOS provider dry-run returns mock create response without live API call', async () => {
  setDryRun(true);
  try {
    // listZones
    const zones = await listZones();
    assert.ok(Array.isArray(zones), 'listZones returns array');
    assert.ok(zones.length > 0, 'dry-run zones not empty');
    assert.equal(zones[0].name, 'magicbornstudios.com', 'dry-run zone name matches');

    // findZoneByName
    const zone = await findZoneByName('magicbornstudios.com');
    assert.ok(zone, 'findZoneByName returns a zone');
    assert.equal(zone.name, 'magicbornstudios.com');

    // listRecords
    const records = await ionosListRecords(zone.id);
    assert.ok(Array.isArray(records), 'listRecords returns array in dry-run');
    assert.ok(records.length > 0, 'dry-run mock records not empty');

    // createRecord — should return mock with _dry_run flag
    const created = await createRecord(zone.id, {
      name: 'client1',
      type: 'CNAME',
      content: 'client1-store.myshopify.com',
      ttl: 3600,
    });

    assert.ok(created._dry_run === true, 'create response should have _dry_run=true');
    assert.equal(created.name, 'client1');
    assert.equal(created.type, 'CNAME');
    assert.equal(created.content, 'client1-store.myshopify.com');
    assert.ok(typeof created.id === 'string', 'created record should have an id');

    // deleteRecord — dry-run should return object with deleted field
    const deleted = await deleteRecord(zone.id, created.id);
    assert.ok(deleted._dry_run === true, 'delete response should have _dry_run=true');
    assert.equal(deleted.deleted, created.id);
  } finally {
    setDryRun(false);
  }
});
