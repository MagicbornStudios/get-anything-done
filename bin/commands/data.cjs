'use strict';
/**
 * gad data — CRUD for data/*.json (plain fs + JSON; lowdb was removed)
 *
 * Required deps: outputError
 */

const path = require('path');
const fs = require('fs');
const { defineCommand } = require('citty');

function createDataCommand(deps) {
  const { outputError } = deps;
  const gadDir = path.join(__dirname, '..', '..');
  const dataDir = path.join(gadDir, 'data');

  const list = defineCommand({
    meta: { name: 'list', description: 'List all data collections in data/' },
    run() {
      if (!fs.existsSync(dataDir)) { console.log('No data/ directory found.'); return; }
      const files = fs.readdirSync(dataDir).filter(f => f.endsWith('.json'));
      console.log(`Data collections (${files.length}):\n`);
      for (const f of files) {
        try {
          const content = JSON.parse(fs.readFileSync(path.join(dataDir, f), 'utf8'));
          const keys = Array.isArray(content) ? `${content.length} items` : `${Object.keys(content).length} keys`;
          console.log(`  ${f.padEnd(30)} ${keys}`);
        } catch {
          console.log(`  ${f.padEnd(30)} (invalid JSON)`);
        }
      }
    },
  });

  const get = defineCommand({
    meta: { name: 'get', description: 'Read a value from a data collection (dot notation)' },
    args: { path: { type: 'positional', description: 'Dot path: file.key.subkey', required: true } },
    run({ args }) {
      const parts = (args.path || args._[0] || '').split('.');
      if (parts.length < 1) { console.log('Usage: gad data get <file>.<key>'); return; }
      const file = parts[0].endsWith('.json') ? parts[0] : `${parts[0]}.json`;
      const filePath = path.join(dataDir, file);
      if (!fs.existsSync(filePath)) { outputError(`Collection not found: ${file}`); return; }
      let data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      for (let i = 1; i < parts.length; i++) {
        if (data == null || typeof data !== 'object') { outputError(`Path not found: ${parts.slice(0, i + 1).join('.')}`); return; }
        data = data[parts[i]];
      }
      console.log(typeof data === 'object' ? JSON.stringify(data, null, 2) : String(data));
    },
  });

  const set = defineCommand({
    meta: { name: 'set', description: 'Set a value in a data collection (dot notation)' },
    args: {
      path: { type: 'positional', description: 'Dot path: file.key.subkey', required: true },
      value: { type: 'positional', description: 'Value to set (JSON or string)', required: true },
    },
    run({ args }) {
      const rawPath = args.path || args._[0] || '';
      const rawValue = args.value || args._[1] || '';
      const parts = rawPath.split('.');
      if (parts.length < 2) { console.log('Usage: gad data set <file>.<key> <value>'); return; }
      const file = parts[0].endsWith('.json') ? parts[0] : `${parts[0]}.json`;
      const filePath = path.join(dataDir, file);
      if (!fs.existsSync(filePath)) { outputError(`Collection not found: ${file}`); return; }
      const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      let target = data;
      for (let i = 1; i < parts.length - 1; i++) {
        if (target[parts[i]] == null) target[parts[i]] = {};
        target = target[parts[i]];
      }
      let parsed;
      try { parsed = JSON.parse(rawValue); } catch { parsed = rawValue; }
      target[parts[parts.length - 1]] = parsed;
      fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n');
      console.log(`✓ Set ${rawPath} = ${JSON.stringify(parsed)}`);
    },
  });

  return defineCommand({
    meta: { name: 'data', description: 'CRUD operations on data/*.json collections (decision gad-109)' },
    subCommands: { list, get, set },
  });
}

module.exports = { createDataCommand };
