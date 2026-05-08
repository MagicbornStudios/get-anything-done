'use strict';
/**
 * lib/requirements/index.cjs — requirements distillation + verification.
 *
 * Phase 115 (2026-05-07, sonnet-requirements).
 *
 * Exports:
 *   distillRequirements({ projectRoot, projectid, planningDir }) → string (path written)
 *   verifyRequirements({ projectRoot, planningDir })             → VerifyResult[]
 *   driftPercentage(verifyResult)                               → number 0-100
 *
 * v1 heuristic — best-effort analysis of:
 *   1. GAD planning artifacts (ROADMAP.xml / DECISIONS.xml / STATE.xml)
 *   2. package.json scripts / bin declarations
 *   3. Source code entry-points (bin/, lib/, apps/, packages/, src/)
 *   4. Test files (tests/, __tests__, *.test.*)
 */

const fs   = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function safeRead(p) {
  try { return fs.readFileSync(p, 'utf8'); } catch { return null; }
}

function safeExec(cmd, args, cwd) {
  try {
    return execFileSync(cmd, args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch { return ''; }
}

/** Walk a directory, yielding relative file paths (no node_modules/.git). */
function* walkDir(dir, rel = '', maxDepth = 4, depth = 0) {
  if (depth > maxDepth) return;
  let entries;
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
  for (const e of entries) {
    if (e.name.startsWith('.') || e.name === 'node_modules' || e.name === '.git') continue;
    const relPath = rel ? `${rel}/${e.name}` : e.name;
    if (e.isDirectory()) {
      yield* walkDir(path.join(dir, e.name), relPath, maxDepth, depth + 1);
    } else {
      yield relPath;
    }
  }
}

/** Grep for a pattern in a directory tree. Returns list of matching files. */
function grepDir(root, pattern, globExts = ['.js', '.cjs', '.mjs', '.ts', '.tsx', '.jsx']) {
  const re = typeof pattern === 'string' ? new RegExp(pattern, 'i') : pattern;
  const matches = [];
  for (const rel of walkDir(root)) {
    if (!globExts.some(ext => rel.endsWith(ext))) continue;
    const content = safeRead(path.join(root, rel));
    if (content && re.test(content)) matches.push(rel);
  }
  return matches;
}

// ---------------------------------------------------------------------------
// Evidence extractors (tier 1 — GAD planning artifacts)
// ---------------------------------------------------------------------------

function extractFromRoadmapXml(xml) {
  const verbs = [];
  const constraints = [];
  const phaseRe = /<phase\b[^>]*>([\s\S]*?)<\/phase>/g;
  let m;
  while ((m = phaseRe.exec(xml)) !== null) {
    const body = m[1];
    const goalMatch = body.match(/<goal>([\s\S]*?)<\/goal>/);
    if (goalMatch) {
      const goal = goalMatch[1].replace(/<[^>]+>/g, '').trim();
      if (goal) verbs.push(goal);
    }
    const reqMatch = body.match(/<requirements>([\s\S]*?)<\/requirements>/);
    if (reqMatch) {
      const reqs = reqMatch[1].replace(/<[^>]+>/g, '').trim();
      if (reqs) constraints.push(reqs);
    }
  }
  return { verbs, constraints };
}

function extractFromDecisionsXml(xml) {
  const constraints = [];
  const decRe = /<decision\b[^>]*>([\s\S]*?)<\/decision>/g;
  let m;
  while ((m = decRe.exec(xml)) !== null) {
    const body = m[1];
    const summaryMatch = body.match(/<summary>([\s\S]*?)<\/summary>/);
    if (summaryMatch) {
      const s = summaryMatch[1].replace(/<[^>]+>/g, '').trim();
      if (s) constraints.push(s);
    }
  }
  return constraints;
}

function extractFromStateXml(xml) {
  const verbs = [];
  const milestoneMatch = xml.match(/<milestone>([\s\S]*?)<\/milestone>/);
  if (milestoneMatch) {
    const ms = milestoneMatch[1].replace(/<[^>]+>/g, '').trim();
    if (ms) verbs.push(`Milestone: ${ms}`);
  }
  // Extract state-log entries as clues to what the system does
  const logRe = /<entry\b[^>]*>([\s\S]*?)<\/entry>/g;
  let m;
  const seen = new Set();
  while ((m = logRe.exec(xml)) !== null) {
    const entry = m[1].replace(/<[^>]+>/g, '').trim();
    if (entry && entry.length < 200 && !seen.has(entry)) {
      seen.add(entry);
      verbs.push(entry);
    }
    if (seen.size >= 10) break; // cap — state-log can be huge
  }
  return verbs;
}

// ---------------------------------------------------------------------------
// Evidence extractors (tier 2 — package.json / bin)
// ---------------------------------------------------------------------------

function extractFromPackageJson(projectRoot) {
  const pkg = (() => {
    try { return JSON.parse(safeRead(path.join(projectRoot, 'package.json')) || '{}'); } catch { return {}; }
  })();

  const exposes = [];
  if (pkg.bin) {
    for (const [name, p] of Object.entries(pkg.bin)) {
      exposes.push(`CLI binary: \`${name}\` → ${p}`);
    }
  }
  if (pkg.main)    exposes.push(`CJS entry: ${pkg.main}`);
  if (pkg.exports) {
    if (typeof pkg.exports === 'string') {
      exposes.push(`ESM/CJS export: ${pkg.exports}`);
    } else {
      for (const [k, v] of Object.entries(pkg.exports)) {
        const target = typeof v === 'string' ? v : (v.require || v.import || JSON.stringify(v));
        exposes.push(`Export \`${k}\`: ${target}`);
      }
    }
  }

  const constraints = [];
  if (pkg.engines) {
    for (const [k, v] of Object.entries(pkg.engines)) {
      constraints.push(`Requires ${k} ${v}`);
    }
  }
  if (pkg.peerDependencies) {
    for (const [k, v] of Object.entries(pkg.peerDependencies)) {
      constraints.push(`Peer dependency: ${k}@${v}`);
    }
  }

  return { exposes, constraints };
}

// ---------------------------------------------------------------------------
// Evidence extractors (tier 3 — source code heuristics)
// ---------------------------------------------------------------------------

function extractCommandsFromBin(projectRoot) {
  const exposes = [];
  const binDir = path.join(projectRoot, 'bin', 'commands');
  if (!fs.existsSync(binDir)) return exposes;
  let files;
  try { files = fs.readdirSync(binDir); } catch { return exposes; }
  for (const f of files) {
    if (f.startsWith('_') || !f.endsWith('.cjs')) continue;
    const name = f.replace(/\.cjs$/, '');
    exposes.push(`CLI command: \`gad ${name}\``);
  }
  return exposes;
}

function extractLibExports(projectRoot) {
  const exposes = [];
  const libDir = path.join(projectRoot, 'lib');
  if (!fs.existsSync(libDir)) return exposes;
  let files;
  try { files = fs.readdirSync(libDir); } catch { return exposes; }
  for (const f of files.slice(0, 40)) { // cap to avoid overwhelming output
    if (!f.endsWith('.cjs') && !f.endsWith('.mjs') && !f.endsWith('.js')) continue;
    exposes.push(`Library module: lib/${f}`);
  }
  return exposes;
}

function extractVerbs(projectRoot) {
  const verbs = [];

  // skills directory
  const skillsDir = path.join(projectRoot, 'skills');
  if (fs.existsSync(skillsDir)) {
    let dirs;
    try { dirs = fs.readdirSync(skillsDir, { withFileTypes: true }); } catch { dirs = []; }
    for (const d of dirs) {
      if (d.isDirectory()) verbs.push(`Provides skill: ${d.name}`);
    }
  }

  // workflows directory
  const wfDir = path.join(projectRoot, 'workflows');
  if (fs.existsSync(wfDir)) {
    let files;
    try { files = fs.readdirSync(wfDir); } catch { files = []; }
    for (const f of files) {
      if (f.endsWith('.md')) verbs.push(`Workflow: ${f.replace(/\.md$/, '')}`);
    }
  }

  return verbs;
}

// ---------------------------------------------------------------------------
// distillRequirements
// ---------------------------------------------------------------------------

/**
 * Runs best-effort heuristic extraction and writes requirements.md.
 * @param {{ projectRoot: string, projectid: string, planningDir: string }} opts
 * @returns {string} Path of written file.
 */
function distillRequirements({ projectRoot, projectid, planningDir }) {
  const plan = planningDir || '.planning';
  const planPath = path.isAbsolute(plan) ? plan : path.join(projectRoot, plan);

  const verbs       = [];
  const exposes     = [];
  const constraints = [];

  // Tier 1 — GAD planning artifacts
  const roadmapXml = safeRead(path.join(planPath, 'ROADMAP.xml'));
  if (roadmapXml) {
    const r = extractFromRoadmapXml(roadmapXml);
    verbs.push(...r.verbs.slice(0, 20));
    constraints.push(...r.constraints.slice(0, 10));
  }

  const decisionsXml = safeRead(path.join(planPath, 'DECISIONS.xml'));
  if (decisionsXml) {
    constraints.push(...extractFromDecisionsXml(decisionsXml).slice(0, 15));
  }

  const stateXml = safeRead(path.join(planPath, 'STATE.xml'));
  if (stateXml) {
    verbs.push(...extractFromStateXml(stateXml).slice(0, 8));
  }

  // Tier 2 — package.json
  const pkgData = extractFromPackageJson(projectRoot);
  exposes.push(...pkgData.exposes);
  constraints.push(...pkgData.constraints);

  // Tier 3 — source code
  exposes.push(...extractCommandsFromBin(projectRoot));
  exposes.push(...extractLibExports(projectRoot));
  verbs.push(...extractVerbs(projectRoot));

  // Deduplicate
  function dedup(arr) {
    const seen = new Set();
    return arr.filter(s => {
      const k = s.trim().toLowerCase();
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
  }

  const verbLines       = dedup(verbs).slice(0, 30);
  const exposeLines     = dedup(exposes).slice(0, 30);
  const constraintLines = dedup(constraints).slice(0, 20);

  const md = [
    `# Requirements — ${projectid || path.basename(projectRoot)}`,
    '',
    `> Auto-distilled ${new Date().toISOString()} (heuristic v1). Review + curate before treating as authoritative.`,
    '',
    '## What it DOES (verbs)',
    ...verbLines.map(l => `- ${l}`),
    '',
    '## What it EXPOSES (interfaces)',
    ...exposeLines.map(l => `- ${l}`),
    '',
    '## What it CONSTRAINS (invariants)',
    ...constraintLines.map(l => `- ${l}`),
    '',
  ].join('\n');

  const outPath = path.join(planPath, 'requirements.md');
  fs.mkdirSync(planPath, { recursive: true });
  fs.writeFileSync(outPath, md, 'utf8');
  return outPath;
}

// ---------------------------------------------------------------------------
// verifyRequirements
// ---------------------------------------------------------------------------

/**
 * @typedef {{ requirement: string, section: string, verdict: 'met'|'partial'|'missing', evidence: string[] }} VerifyResult
 */

/**
 * Parses requirements.md and attempts to verify each bullet.
 * @param {{ projectRoot: string, planningDir: string }} opts
 * @returns {VerifyResult[]}
 */
function verifyRequirements({ projectRoot, planningDir }) {
  const plan = planningDir || '.planning';
  const planPath = path.isAbsolute(plan) ? plan : path.join(projectRoot, plan);
  const reqPath = path.join(planPath, 'requirements.md');

  const content = safeRead(reqPath);
  if (!content) {
    return [{ requirement: 'requirements.md', section: 'meta', verdict: 'missing', evidence: [`File not found: ${reqPath}`] }];
  }

  const results = [];
  let currentSection = 'unknown';
  const sectionMap = {
    'what it does': 'does',
    'what it exposes': 'exposes',
    'what it constrains': 'constrains',
  };

  for (const line of content.split('\n')) {
    const trimmed = line.trim();

    // Detect section headings
    if (trimmed.startsWith('## ')) {
      const heading = trimmed.slice(3).toLowerCase().replace(/\s*\(.*/, '').trim();
      currentSection = sectionMap[heading] || heading;
      continue;
    }

    // Bullet items
    if (!trimmed.startsWith('- ')) continue;
    const req = trimmed.slice(2).trim();
    if (!req) continue;

    const result = verifyOne(req, currentSection, projectRoot);
    results.push(result);
  }

  return results;
}

function verifyOne(req, section, projectRoot) {
  const evidence = [];
  let verdict = 'missing';

  if (section === 'does') {
    verdict = verifyDoes(req, projectRoot, evidence);
  } else if (section === 'exposes') {
    verdict = verifyExposes(req, projectRoot, evidence);
  } else if (section === 'constrains') {
    verdict = verifyConstrains(req, projectRoot, evidence);
  } else {
    // Unknown section — partial credit
    verdict = 'partial';
    evidence.push('Unknown section; skipped deep verify');
  }

  return { requirement: req, section, verdict, evidence };
}

/** Check whether a DOES bullet corresponds to observable code. */
function verifyDoes(req, projectRoot, evidence) {
  // Look for keywords from the requirement text in source
  const words = extractKeywords(req);
  if (words.length === 0) {
    evidence.push('No keywords extracted');
    return 'partial';
  }

  const searchDirs = ['bin', 'lib', 'src', 'apps', 'packages'].map(d => path.join(projectRoot, d)).filter(d => fs.existsSync(d));
  const hits = searchDirs.flatMap(dir => grepDir(dir, words.join('|')).slice(0, 3));

  // Also check test files
  const testDirs = ['tests', '__tests__'].map(d => path.join(projectRoot, d)).filter(d => fs.existsSync(d));
  const testHits = testDirs.flatMap(dir => grepDir(dir, words.join('|')).slice(0, 2));

  if (hits.length > 0 || testHits.length > 0) {
    evidence.push(...hits.map(f => `code: ${f}`));
    evidence.push(...testHits.map(f => `test: ${f}`));
    return 'met';
  }

  evidence.push(`No matching code for keywords: ${words.join(', ')}`);
  return 'missing';
}

/** Check whether an EXPOSES bullet's interface is discoverable. */
function verifyExposes(req, projectRoot, evidence) {
  // CLI command pattern: `gad <name>`
  const cliMatch = req.match(/`gad\s+([\w-]+)`/);
  if (cliMatch) {
    const cmd = cliMatch[1];
    const cmdFile = path.join(projectRoot, 'bin', 'commands', `${cmd}.cjs`);
    if (fs.existsSync(cmdFile)) {
      evidence.push(`bin/commands/${cmd}.cjs exists`);
      return 'met';
    }
    // Check manifest or loader entry
    const manifestContent = safeRead(path.join(projectRoot, 'bin', 'commands', '_manifest.cjs'));
    if (manifestContent && manifestContent.includes(`"${cmd}"`)) {
      evidence.push(`listed in bin/commands/_manifest.cjs`);
      return 'met';
    }
    evidence.push(`bin/commands/${cmd}.cjs not found`);
    return 'missing';
  }

  // Library module pattern: lib/<file>
  const libMatch = req.match(/lib\/([\w/.-]+)/);
  if (libMatch) {
    const libFile = path.join(projectRoot, 'lib', libMatch[1]);
    if (fs.existsSync(libFile)) {
      evidence.push(`${libMatch[0]} exists`);
      return 'met';
    }
    evidence.push(`${libMatch[0]} not found`);
    return 'missing';
  }

  // Binary / entry point
  const binMatch = req.match(/(?:CLI binary|CJS entry|ESM\/CJS export|Export)[^`]*`([^`]+)`/);
  if (binMatch) {
    const target = binMatch[1];
    // Could be relative path
    const fullPath = path.resolve(projectRoot, target);
    if (fs.existsSync(fullPath)) {
      evidence.push(`${target} exists`);
      return 'met';
    }
    evidence.push(`${target} not found`);
    return 'partial'; // package.json declared it; file just might be built
  }

  // Skill pattern
  const skillMatch = req.match(/Provides skill:\s*([\w-]+)/);
  if (skillMatch) {
    const skillDir = path.join(projectRoot, 'skills', skillMatch[1]);
    if (fs.existsSync(skillDir)) {
      evidence.push(`skills/${skillMatch[1]} exists`);
      return 'met';
    }
    evidence.push(`skills/${skillMatch[1]} not found`);
    return 'missing';
  }

  // Workflow pattern
  const wfMatch = req.match(/Workflow:\s*([\w-]+)/);
  if (wfMatch) {
    const wfFile = path.join(projectRoot, 'workflows', `${wfMatch[1]}.md`);
    if (fs.existsSync(wfFile)) {
      evidence.push(`workflows/${wfMatch[1]}.md exists`);
      return 'met';
    }
    evidence.push(`workflows/${wfMatch[1]}.md not found`);
    return 'missing';
  }

  // Generic keyword search
  const words = extractKeywords(req);
  if (words.length > 0) {
    const hits = grepDir(projectRoot, words.join('|'), ['.cjs', '.js', '.mjs', '.ts', '.json']).slice(0, 3);
    if (hits.length > 0) {
      evidence.push(...hits.map(f => `match: ${f}`));
      return 'partial';
    }
  }

  evidence.push('Could not verify — no matching pattern');
  return 'partial';
}

/** Check whether a CONSTRAINS bullet has corresponding test/lint/assertion. */
function verifyConstrains(req, projectRoot, evidence) {
  const words = extractKeywords(req);
  if (words.length === 0) {
    evidence.push('No keywords extracted');
    return 'partial';
  }

  // Check test files first
  const testDirs = ['tests', '__tests__', 'test'].map(d => path.join(projectRoot, d)).filter(d => fs.existsSync(d));
  const testHits = testDirs.flatMap(dir => grepDir(dir, words.join('|')).slice(0, 3));

  if (testHits.length > 0) {
    evidence.push(...testHits.map(f => `test: ${f}`));
    return 'met';
  }

  // Check for eslint / lint configs
  const lintFiles = ['.eslintrc', '.eslintrc.js', '.eslintrc.json', 'eslint.config.js', '.eslintrc.cjs'];
  for (const lf of lintFiles) {
    const p = path.join(projectRoot, lf);
    if (fs.existsSync(p)) {
      const content = safeRead(p);
      if (content && words.some(w => content.toLowerCase().includes(w.toLowerCase()))) {
        evidence.push(`lint rule in ${lf}`);
        return 'met';
      }
    }
  }

  // Broad source search
  const searchDirs = ['lib', 'bin', 'src'].map(d => path.join(projectRoot, d)).filter(d => fs.existsSync(d));
  const hits = searchDirs.flatMap(dir => grepDir(dir, words.join('|')).slice(0, 2));
  if (hits.length > 0) {
    evidence.push(...hits.map(f => `code: ${f}`));
    return 'partial';
  }

  evidence.push(`No test/lint found for: ${words.join(', ')}`);
  return 'missing';
}

/** Extract meaningful keywords from a requirement string. */
function extractKeywords(req) {
  // Remove common stop words and extract meaningful tokens
  const stopWords = new Set([
    'a', 'an', 'the', 'is', 'are', 'was', 'for', 'in', 'of', 'on', 'at', 'to',
    'and', 'or', 'with', 'by', 'from', 'as', 'that', 'this', 'be', 'been',
    'it', 'its', 'via', 'per', 'each', 'all', 'any', 'no', 'not', 'has',
    'have', 'will', 'can', 'may', 'must', 'should', 'run', 'runs', 'use',
    'uses', 'used', 'into', 'out', 'up', 'down', 'e.g', 'i.e',
  ]);

  return req
    .toLowerCase()
    .replace(/[`'"()[\]{}<>:,./\\]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length >= 4 && !stopWords.has(w))
    .slice(0, 4);
}

// ---------------------------------------------------------------------------
// driftPercentage
// ---------------------------------------------------------------------------

/**
 * Computes drift percentage from verify results.
 * Formula: (missing + 0.5 * partial) / total * 100
 * Lower = better.
 * @param {VerifyResult[]} verifyResult
 * @returns {number}
 */
function driftPercentage(verifyResult) {
  if (!verifyResult || verifyResult.length === 0) return 0;
  const total = verifyResult.length;
  let missing = 0;
  let partial = 0;
  for (const r of verifyResult) {
    if (r.verdict === 'missing') missing++;
    else if (r.verdict === 'partial') partial++;
  }
  return Math.round(((missing + 0.5 * partial) / total) * 100 * 10) / 10;
}

module.exports = { distillRequirements, verifyRequirements, driftPercentage };
