'use strict';

const fs = require('fs');
const path = require('path');

function parseSelectedProjects(projectsArg, allProjects) {
  return projectsArg
    ? projectsArg.split(',').map((s) => s.trim()).filter(Boolean)
    : allProjects;
}

function discoverEvalProjects(listAllEvalProjects, outputError) {
  let discovered;
  try {
    discovered = listAllEvalProjects();
  } catch (err) {
    outputError(err.message);
    return null;
  }
  if (discovered.length === 0) {
    outputError('No eval projects found.');
    return null;
  }
  return discovered;
}

function resolveLatestRunDir(projectDir) {
  const runs = fs.readdirSync(projectDir, { withFileTypes: true })
    .filter((r) => r.isDirectory() && /^v\d+$/.test(r.name))
    .map((r) => ({ name: r.name, num: parseInt(r.name.slice(1), 10) }))
    .sort((a, b) => b.num - a.num);
  return runs[0] || null;
}

function listRunVersions(projectDir) {
  return fs.readdirSync(projectDir)
    .filter((n) => /^v\d+$/.test(n))
    .sort((a, b) => parseInt(a.slice(1), 10) - parseInt(b.slice(1), 10));
}

function readJsonIfExists(file) {
  if (!fs.existsSync(file)) return null;
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return null;
  }
}

function pick(...vals) {
  for (const value of vals) {
    if (value != null && value !== '') return value;
  }
  return null;
}

module.exports = {
  discoverEvalProjects,
  listRunVersions,
  parseSelectedProjects,
  pick,
  readJsonIfExists,
  resolveLatestRunDir,
  fs,
  path,
};
