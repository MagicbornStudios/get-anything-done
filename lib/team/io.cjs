'use strict';
/**
 * lib/team/io.cjs — low-level JSON + JSONL helpers.
 * Keep this tiny. Used by every other module.
 */

const fs = require('fs');
const path = require('path');

function readJsonSafe(p, fallback) {
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return fallback; }
}

function writeJson(p, obj) {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(obj, null, 2));
}

function appendJsonl(p, obj) {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.appendFileSync(p, JSON.stringify(obj) + '\n');
}

module.exports = { readJsonSafe, writeJson, appendJsonl };
