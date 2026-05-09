'use strict';
/**
 * gad domains — per-project/per-customer subdomain management.
 *
 * Local registry at: <projectroot>/.planning/dns-records/<zone>.toml
 * Provider: IONOS Cloud DNS (https://api.hosting.ionos.com/dns/v1)
 *
 * Subcommands:
 *   list        — list registry records (+ optional live diff)
 *   add         — plan or provision a record
 *   remove      — plan or provision a deletion
 *   verify      — DNS-resolve all records to detect drift
 *   import      — pull live provider records into registry
 *   describe    — show full record detail
 */

const path = require('path');
const dns = require('dns').promises;
const { defineCommand } = require('citty');
const { getSetting: _getSetting } = require('../../lib/settings-registry.cjs');

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

function createDomainsCommand(deps) {
  const { findRepoRoot, outputError, render, shouldUseJson } = deps;
  const getSetting = _getSetting;

  // Lazy-load the registry + provider so they don't execute at require time
  function getRegistry() {
    return require('../../lib/dns/registry.cjs');
  }

  function getIonos() {
    return require('../../lib/dns/providers/ionos.cjs');
  }

  // Resolve projectRoot from the running environment
  function resolveProjectRoot() {
    const repoRoot = findRepoRoot();
    return repoRoot;
  }

  // -------------------------------------------------------------------------
  // list
  // -------------------------------------------------------------------------
  const listCmd = defineCommand({
    meta: { name: 'list', description: 'List DNS records from the local registry' },
    args: {
      zone: { type: 'string', description: 'Filter to a specific zone (e.g. magicbornstudios.com)', default: '' },
      provider: { type: 'string', description: 'Filter by provider (ionos|cloudflare|route53|other)', default: '' },
      projectid: { type: 'string', description: 'Filter by linked project id', default: '' },
      live: { type: 'boolean', description: 'Compare registry against live provider API', default: false },
      json: { type: 'boolean', description: 'JSON output', default: false },
    },
    async run({ args }) {
      const projectRoot = resolveProjectRoot();
      const registry = getRegistry();

      const defaultZone = getSetting ? getSetting('domains.default_zone') : null;
      const zone = args.zone || defaultZone || '';

      let records = [];
      if (zone) {
        records = registry.listRecords(projectRoot, zone, {
          provider: args.provider || undefined,
          projectid: args.projectid || undefined,
        });
      } else {
        // All known zones
        const zones = registry.listKnownZones(projectRoot);
        for (const z of zones) {
          const zoneRecords = registry.listRecords(projectRoot, z, {
            provider: args.provider || undefined,
            projectid: args.projectid || undefined,
          });
          records = records.concat(zoneRecords);
        }
      }

      if (args.live && zone) {
        try {
          const ionos = getIonos();
          const liveZone = await ionos.findZoneByName(zone);
          if (liveZone) {
            const liveRecords = await ionos.listRecords(liveZone.id);
            // Annotate registry records with live status
            for (const rec of records) {
              const liveMatch = liveRecords.find(
                lr => lr.name === rec.subdomain && lr.type === rec.type && lr.content === rec.value
              );
              rec._live_status = liveMatch ? 'in-sync' : 'not-found-live';
            }
          }
        } catch (err) {
          if (!args.json) process.stderr.write(`Warning: live diff failed — ${err.message}\n`);
        }
      }

      const useJson = args.json || shouldUseJson();
      if (useJson) {
        console.log(JSON.stringify(records, null, 2));
        return;
      }

      if (records.length === 0) {
        console.log('No records found. Use `gad domains add` or `gad domains import` to populate.');
        return;
      }

      const tableRows = records.map(r => ({
        record_id: r.record_id,
        zone: r.zone,
        subdomain: r.subdomain || '(apex)',
        type: r.type,
        value: r.value && r.value.length > 40 ? r.value.slice(0, 37) + '...' : (r.value || ''),
        status: r.status,
        purpose: r.purpose || '',
      }));
      console.log(render(tableRows, { format: 'table', title: `DNS Records (${records.length})` }));
    },
  });

  // -------------------------------------------------------------------------
  // add
  // -------------------------------------------------------------------------
  const addCmd = defineCommand({
    meta: { name: 'add', description: 'Add a DNS record to the registry (plan or provision)' },
    args: {
      subdomain: { type: 'positional', description: 'Subdomain label (e.g. client1). Use "" for apex.', required: true },
      value: { type: 'positional', description: 'Record value: IP for A/AAAA, hostname for CNAME, text for TXT', required: true },
      zone: { type: 'string', description: 'Zone (e.g. magicbornstudios.com)', required: true },
      type: { type: 'string', description: 'Record type: A|AAAA|CNAME|TXT|MX', default: 'A' },
      ttl: { type: 'string', description: 'TTL in seconds', default: '3600' },
      purpose: {
        type: 'string',
        description: 'Purpose: project_root|customer_storefront|external_platform_link|redirect|apex_redirect|mail|other',
        default: 'other',
      },
      'project-link': { type: 'string', description: 'Link to a GAD projectid', default: '' },
      'soul-id': { type: 'string', description: 'Soul id for soul-routed subdomains', default: '' },
      'customer-id': { type: 'string', description: 'Customer/tenant id', default: '' },
      apply: { type: 'boolean', description: 'Provision the record via provider API immediately', default: false },
      json: { type: 'boolean', description: 'JSON output', default: false },
    },
    async run({ args }) {
      const projectRoot = resolveProjectRoot();
      const registry = getRegistry();

      const validTypes = ['A', 'AAAA', 'CNAME', 'TXT', 'MX'];
      const recordType = String(args.type).toUpperCase();
      if (!validTypes.includes(recordType)) {
        outputError(`Invalid type "${args.type}". Must be one of: ${validTypes.join(', ')}`);
        process.exit(1);
      }

      const ttl = parseInt(String(args.ttl), 10) || 3600;

      const projectLink =
        args['project-link']
          ? {
              projectid: args['project-link'],
              soul_id: args['soul-id'] || null,
              customer_id: args['customer-id'] || null,
            }
          : null;

      const recordId = registry.buildRecordId(args.zone, args.subdomain, recordType);
      const now = new Date().toISOString();

      const record = {
        record_id: recordId,
        zone: args.zone,
        subdomain: args.subdomain,
        type: recordType,
        value: args.value,
        ttl,
        provider: getSetting ? (getSetting('domains.default_provider') || 'ionos') : 'ionos',
        provider_record_id: null,
        purpose: args.purpose || 'other',
        project_link: projectLink,
        created_at: now,
        updated_at: null,
        created_by: process.env.GAD_AGENT_NAME || 'claude-code',
        status: 'planned',
        last_verified_at: null,
        notes: null,
      };

      if (args.apply) {
        // Provision via provider API
        record.status = 'provisioning';
        registry.upsertRecord(projectRoot, args.zone, record);

        const providerName = record.provider;
        let providerRecord = null;
        let applyError = null;

        try {
          if (providerName === 'ionos') {
            const ionos = getIonos();
            const liveZone = await ionos.findZoneByName(args.zone);
            if (!liveZone) {
              throw new Error(
                `Zone "${args.zone}" not found in IONOS. ` +
                'Verify the domain is hosted at IONOS and the API key has access.'
              );
            }
            providerRecord = await ionos.createRecord(liveZone.id, {
              name: args.subdomain,
              type: recordType,
              content: args.value,
              ttl,
            });
            record.status = 'active';
            record.provider_record_id = providerRecord.id || null;
            record.updated_at = new Date().toISOString();
          } else {
            throw new Error(`Provider "${providerName}" not yet implemented. Only ionos is supported.`);
          }
        } catch (err) {
          applyError = err;
          record.status = 'failed';
          record.notes = `Apply failed: ${err.message}`;
          record.updated_at = new Date().toISOString();
        }

        registry.upsertRecord(projectRoot, args.zone, record);

        const useJson = args.json || shouldUseJson();
        if (useJson) {
          console.log(JSON.stringify({ record, error: applyError ? applyError.message : null }, null, 2));
        } else if (applyError) {
          outputError(`Failed to provision record: ${applyError.message}`);
          process.exit(1);
        } else {
          console.log(`✓ Record created: ${recordType} ${args.subdomain}.${args.zone} → ${args.value}`);
          if (providerRecord && providerRecord._dry_run) {
            console.log('  (dry-run mode — no live API call made)');
          }
        }

        // Auto-verify if configured
        const autoVerify = getSetting ? getSetting('domains.auto_verify_after_apply') : true;
        if (autoVerify && record.status === 'active' && !providerRecord?._dry_run) {
          // Non-blocking: verify quietly
          try {
            await verifyOneRecord(registry, projectRoot, record);
            registry.upsertRecord(projectRoot, args.zone, record);
          } catch (_) { /* non-fatal */ }
        }
        return;
      }

      // Plan only
      registry.upsertRecord(projectRoot, args.zone, record);

      const useJson = args.json || shouldUseJson();
      if (useJson) {
        // Also print the would-be API call
        const apiPreview = {
          record,
          would_be_api_call: {
            provider: record.provider,
            method: 'PATCH',
            path: `/zones/<zone-id>`,
            body: [
              {
                name: args.subdomain,
                type: recordType,
                content: args.value,
                ttl,
              },
            ],
            note: 'Re-run with --apply to provision.',
          },
        };
        console.log(JSON.stringify(apiPreview, null, 2));
      } else {
        console.log(`Planned: ${recordType} ${args.subdomain}.${args.zone} → ${args.value}`);
        console.log(`  Registry: ${registry.zoneFilePath(projectRoot, args.zone)}`);
        console.log(`  Re-run with --apply to provision via ${record.provider}.`);
      }
    },
  });

  // -------------------------------------------------------------------------
  // remove
  // -------------------------------------------------------------------------
  const removeCmd = defineCommand({
    meta: { name: 'remove', description: 'Remove (plan or provision deletion of) a DNS record' },
    args: {
      subdomain: { type: 'positional', description: 'Subdomain label to remove', required: true },
      zone: { type: 'string', description: 'Zone', required: true },
      type: { type: 'string', description: 'Record type (narrows if multiple same-name records exist)', default: '' },
      apply: { type: 'boolean', description: 'Delete from provider API immediately', default: false },
      json: { type: 'boolean', description: 'JSON output', default: false },
    },
    async run({ args }) {
      const projectRoot = resolveProjectRoot();
      const registry = getRegistry();

      const records = registry.listRecords(projectRoot, args.zone);
      let candidates = records.filter(r =>
        r.subdomain === args.subdomain && r.status !== 'deleted'
      );
      if (args.type) {
        candidates = candidates.filter(r => r.type === String(args.type).toUpperCase());
      }

      if (candidates.length === 0) {
        outputError(
          `No active record found for "${args.subdomain}" in zone "${args.zone}". ` +
          'Use `gad domains list` to see what exists.'
        );
        process.exit(1);
      }

      const useJson = args.json || shouldUseJson();

      if (!args.apply) {
        for (const rec of candidates) {
          registry.patchRecordStatus(projectRoot, args.zone, rec.record_id, 'deleted');
        }
        if (useJson) {
          console.log(JSON.stringify({ deleted_planned: candidates.map(r => r.record_id) }, null, 2));
        } else {
          console.log(`Marked as deleted (registry only): ${candidates.map(r => r.record_id).join(', ')}`);
          console.log('  Re-run with --apply to delete from provider.');
        }
        return;
      }

      // Provision deletion
      for (const rec of candidates) {
        if (!rec.provider_record_id && rec.provider === 'ionos') {
          // No provider id — try to look it up live
          try {
            const ionos = getIonos();
            const liveZone = await ionos.findZoneByName(args.zone);
            if (liveZone) {
              const liveRecords = await ionos.listRecords(liveZone.id);
              const match = liveRecords.find(
                lr => lr.name === rec.subdomain && lr.type === rec.type
              );
              if (match) rec.provider_record_id = match.id;
            }
          } catch (_) { /* continue without id */ }
        }

        if (rec.provider === 'ionos') {
          const ionos = getIonos();
          const liveZone = await ionos.findZoneByName(args.zone);
          if (liveZone && rec.provider_record_id) {
            await ionos.deleteRecord(liveZone.id, rec.provider_record_id);
          }
        }
        registry.patchRecordStatus(projectRoot, args.zone, rec.record_id, 'deleted');
      }

      if (useJson) {
        console.log(JSON.stringify({ deleted: candidates.map(r => r.record_id) }, null, 2));
      } else {
        console.log(`Deleted: ${candidates.map(r => `${r.type} ${r.subdomain}.${args.zone}`).join(', ')}`);
      }
    },
  });

  // -------------------------------------------------------------------------
  // verify
  // -------------------------------------------------------------------------
  async function verifyOneRecord(registry, projectRoot, rec) {
    const fqdn = rec.subdomain ? `${rec.subdomain}.${rec.zone}` : rec.zone;
    const now = new Date().toISOString();

    if (rec.type === 'A') {
      const addrs = await dns.resolve4(fqdn);
      if (addrs.includes(rec.value)) {
        rec.last_verified_at = now;
        rec._verify_status = 'ok';
      } else {
        rec._verify_status = `drift: expected ${rec.value}, got [${addrs.join(', ')}]`;
      }
    } else if (rec.type === 'AAAA') {
      const addrs = await dns.resolve6(fqdn);
      if (addrs.includes(rec.value)) {
        rec.last_verified_at = now;
        rec._verify_status = 'ok';
      } else {
        rec._verify_status = `drift: expected ${rec.value}, got [${addrs.join(', ')}]`;
      }
    } else if (rec.type === 'CNAME') {
      const targets = await dns.resolveCname(fqdn);
      const target = targets[0] ? targets[0].replace(/\.$/, '') : '';
      const expected = rec.value.replace(/\.$/, '');
      if (target === expected) {
        rec.last_verified_at = now;
        rec._verify_status = 'ok';
      } else {
        rec._verify_status = `drift: expected ${expected}, got ${target}`;
      }
    } else if (rec.type === 'TXT') {
      const txts = await dns.resolveTxt(fqdn);
      const flat = txts.map(t => t.join('')).join('|');
      if (flat.includes(rec.value)) {
        rec.last_verified_at = now;
        rec._verify_status = 'ok';
      } else {
        rec._verify_status = `drift: expected to contain "${rec.value}"`;
      }
    } else {
      rec._verify_status = `skipped (type ${rec.type} not checked)`;
    }
  }

  const verifyCmd = defineCommand({
    meta: { name: 'verify', description: 'Verify DNS records resolve to expected values' },
    args: {
      zone: { type: 'string', description: 'Limit to a specific zone', default: '' },
      json: { type: 'boolean', description: 'JSON output', default: false },
    },
    async run({ args }) {
      const projectRoot = resolveProjectRoot();
      const registry = getRegistry();

      const defaultZone = getSetting ? getSetting('domains.default_zone') : null;
      const zone = args.zone || defaultZone || '';
      let records;
      if (zone) {
        records = registry.listRecords(projectRoot, zone);
      } else {
        const zones = registry.listKnownZones(projectRoot);
        records = [];
        for (const z of zones) records = records.concat(registry.listRecords(projectRoot, z));
      }

      const active = records.filter(r => r.status === 'active');
      if (active.length === 0) {
        console.log('No active records to verify.');
        return;
      }

      const results = [];
      for (const rec of active) {
        const clone = { ...rec };
        try {
          await verifyOneRecord(registry, projectRoot, clone);
          // Persist last_verified_at update
          if (clone.last_verified_at && zone) {
            registry.patchRecordStatus(projectRoot, zone, rec.record_id, rec.status, {
              last_verified_at: clone.last_verified_at,
            });
          }
        } catch (err) {
          clone._verify_status = `error: ${err.message}`;
        }
        results.push(clone);
      }

      const useJson = args.json || shouldUseJson();
      if (useJson) {
        console.log(JSON.stringify(results, null, 2));
        return;
      }

      const tableRows = results.map(r => ({
        subdomain: r.subdomain || '(apex)',
        zone: r.zone,
        type: r.type,
        value: r.value,
        verify: r._verify_status || '?',
        last_verified_at: r.last_verified_at || 'never',
      }));
      console.log(render(tableRows, { format: 'table', title: `DNS Verify (${results.length})` }));
    },
  });

  // -------------------------------------------------------------------------
  // import
  // -------------------------------------------------------------------------
  const importCmd = defineCommand({
    meta: { name: 'import', description: 'Import live records from provider into local registry' },
    args: {
      provider: { type: 'string', description: 'Provider to import from (ionos)', default: 'ionos' },
      zone: { type: 'string', description: 'Zone to import (required)', required: true },
      apply: { type: 'boolean', description: 'Actually pull from API (default is dry-run preview)', default: false },
      json: { type: 'boolean', description: 'JSON output', default: false },
    },
    async run({ args }) {
      const projectRoot = resolveProjectRoot();
      const registry = getRegistry();

      const useJson = args.json || shouldUseJson();

      if (args.provider !== 'ionos') {
        outputError(`Provider "${args.provider}" is not yet implemented. Only ionos is supported.`);
        process.exit(1);
      }

      const ionos = getIonos();
      const liveZone = await ionos.findZoneByName(args.zone);
      if (!liveZone) {
        outputError(`Zone "${args.zone}" not found in IONOS. Verify the domain is hosted there.`);
        process.exit(1);
      }

      const liveRecords = await ionos.listRecords(liveZone.id);
      const now = new Date().toISOString();
      const imported = [];

      for (const lr of liveRecords) {
        const recordId = registry.buildRecordId(args.zone, lr.name, lr.type, 'imported');
        const record = {
          record_id: recordId,
          zone: args.zone,
          subdomain: lr.name,
          type: lr.type,
          value: lr.content,
          ttl: lr.ttl || 3600,
          provider: 'ionos',
          provider_record_id: lr.id || null,
          purpose: 'other',
          project_link: null,
          created_at: now,
          updated_at: null,
          created_by: 'gad-import',
          status: 'active',
          last_verified_at: null,
          notes: `Imported from IONOS live state ${now}`,
        };
        imported.push(record);
        if (args.apply) {
          registry.upsertRecord(projectRoot, args.zone, record);
        }
      }

      if (useJson) {
        console.log(JSON.stringify({ imported, applied: args.apply }, null, 2));
        return;
      }

      console.log(`${args.apply ? 'Imported' : 'Preview:'} ${imported.length} records from IONOS zone ${args.zone}`);
      if (!args.apply) {
        console.log('  Re-run with --apply to write to local registry.');
      }
    },
  });

  // -------------------------------------------------------------------------
  // describe
  // -------------------------------------------------------------------------
  const describeCmd = defineCommand({
    meta: { name: 'describe', description: 'Show full detail for a DNS record' },
    args: {
      subdomain: { type: 'positional', description: 'Subdomain to describe', required: true },
      zone: { type: 'string', description: 'Zone', required: true },
      live: { type: 'boolean', description: 'Also fetch from provider API', default: false },
      json: { type: 'boolean', description: 'JSON output', default: false },
    },
    async run({ args }) {
      const projectRoot = resolveProjectRoot();
      const registry = getRegistry();

      const records = registry.listRecords(projectRoot, args.zone);
      const matches = records.filter(r => r.subdomain === args.subdomain);

      if (matches.length === 0) {
        outputError(`No record found for "${args.subdomain}" in zone "${args.zone}".`);
        process.exit(1);
      }

      let liveRecord = null;
      if (args.live) {
        try {
          const ionos = getIonos();
          const liveZone = await ionos.findZoneByName(args.zone);
          if (liveZone) {
            const liveRecords = await ionos.listRecords(liveZone.id);
            liveRecord = liveRecords.find(lr => lr.name === args.subdomain) || null;
          }
        } catch (err) {
          if (!args.json) process.stderr.write(`Warning: live fetch failed — ${err.message}\n`);
        }
      }

      const useJson = args.json || shouldUseJson();
      if (useJson) {
        console.log(JSON.stringify({ registry_records: matches, live_record: liveRecord }, null, 2));
        return;
      }

      for (const rec of matches) {
        console.log('\n--- Registry record ---');
        for (const [k, v] of Object.entries(rec)) {
          console.log(`  ${k}: ${v === null ? '(null)' : JSON.stringify(v)}`);
        }
      }
      if (liveRecord) {
        console.log('\n--- Live provider record ---');
        for (const [k, v] of Object.entries(liveRecord)) {
          console.log(`  ${k}: ${JSON.stringify(v)}`);
        }
      }
    },
  });

  // -------------------------------------------------------------------------
  // Root command
  // -------------------------------------------------------------------------
  return defineCommand({
    meta: {
      name: 'domains',
      description: 'Manage DNS records for per-project and per-customer subdomains',
    },
    subCommands: {
      list: listCmd,
      add: addCmd,
      remove: removeCmd,
      verify: verifyCmd,
      import: importCmd,
      describe: describeCmd,
    },
  });
}

module.exports = { createDomainsCommand };
module.exports.register = (ctx) => ({ domains: createDomainsCommand(ctx.common) });
