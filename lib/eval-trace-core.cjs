'use strict';

const fs = require('fs');
const path = require('path');

const FIDELITY_SCORE = {
  Full: 1.0,
  Referenced: 1.0,
  Truncated: 0.5,
  Approximated: 0.5,
  Absent: 0,
};

const ALL_UNITS = ['U1','U2','U3','U4','U5','U6','U7','U8','U9','U10','U11','U12'];

const UNIT_LABELS = {
  U1: 'Current phase ID',
  U2: 'Milestone / plan name',
  U3: 'Project status',
  U4: 'Open task count',
  U5: 'Next action (full text)',
  U6: 'In-progress task IDs + goals',
  U7: 'Phase history',
  U8: 'Last activity date',
  U9: 'Active session ID + phase',
  U10: 'Files to read (refs)',
  U11: 'Agent loop steps',
  U12: 'Build / verify commands',
};

function loadTrace(projectDir, version) {
  const traceFile = path.join(projectDir, version, 'TRACE.json');
  if (!fs.existsSync(traceFile)) return null;
  try {
    return JSON.parse(fs.readFileSync(traceFile, 'utf8'));
  } catch {
    return null;
  }
}

function computeCompleteness(unitCoverage) {
  const units = Object.entries(unitCoverage);
  if (units.length === 0) return null;
  const full = units.filter(([, v]) => v === 'Full' || v === 'Referenced').length;
  const partial = units.filter(([, v]) => v === 'Truncated' || v === 'Approximated').length;
  return (full + 0.5 * partial) / units.length;
}

function listVersionDirs(projectDir, { newestFirst = false, parseNames = false } = {}) {
  const versions = fs.readdirSync(projectDir, { withFileTypes: true })
    .filter((r) => r.isDirectory() && /^v\d+$/.test(r.name))
    .map((r) => parseNames ? r.name : r)
    .sort((a, b) => {
      const aName = typeof a === 'string' ? a : a.name;
      const bName = typeof b === 'string' ? b : b.name;
      const result = parseInt(aName.slice(1), 10) - parseInt(bName.slice(1), 10);
      return newestFirst ? -result : result;
    });
  return versions;
}

module.exports = {
  FIDELITY_SCORE,
  ALL_UNITS,
  UNIT_LABELS,
  loadTrace,
  computeCompleteness,
  listVersionDirs,
};
