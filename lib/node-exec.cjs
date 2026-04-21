'use strict';

const path = require('path');

function isGadSeaBinary(execPath) {
  const base = path.basename(String(execPath || '')).toLowerCase();
  return base === 'gad.exe' || base === 'gad';
}

function pickNodeExecutable() {
  if (isGadSeaBinary(process.execPath)) return 'node';
  return process.execPath;
}

module.exports = { pickNodeExecutable, isGadSeaBinary };
