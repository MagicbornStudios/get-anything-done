'use strict';

const path = require('path');

function isGadSeaBinary(execPath) {
  const base = path.basename(String(execPath || '')).toLowerCase();
  return base === 'gad.exe' || base === 'gad';
}

function isPackagedRuntime(execPath, env = process.env) {
  return Boolean(
    (env && (env.GAD_PACKAGED_EXECUTABLE || env.GAD_PACKAGED_ROOT))
    || isGadSeaBinary(execPath),
  );
}

function pickNodeExecutableFor(execPath, env = process.env) {
  if (isPackagedRuntime(execPath, env)) return 'node';
  return execPath;
}

function pickNodeExecutable() {
  return pickNodeExecutableFor(process.execPath, process.env);
}

module.exports = { pickNodeExecutable, pickNodeExecutableFor, isGadSeaBinary, isPackagedRuntime };
