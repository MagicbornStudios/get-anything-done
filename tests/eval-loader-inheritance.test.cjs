/**
 * Eval loader inheritance contract tests (task 42.4-15, decision gad-184).
 *
 * Covers:
 *  (a) empty species inherits all project fields
 *  (b) species overrides individual project fields cleanly
 *  (c) species-only fields do not back-propagate to the project defaults
 *  (d) `inherits_from` resolves a chain across species within one project
 *  (e) `inherits_from` cycles throw a clear error
 *
 * All fixtures are written to a hermetic temp dir — no dependency on live
 * eval data.
 */

'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const os = require('os');

const {
  loadProject,
  loadResolvedSpecies,
  loadAllResolvedSpecies,
  mergeProjectSpecies,
  loadAllSpeciesRaw,
} = require('../lib/eval-loader.cjs');

// --- fixture helpers -------------------------------------------------------

function mkTempProject(projectJson, speciesMap) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'gad-eval-loader-'));
  fs.writeFileSync(path.join(root, 'project.json'), JSON.stringify(projectJson, null, 2));
  const speciesRoot = path.join(root, 'species');
  fs.mkdirSync(speciesRoot, { recursive: true });
  for (const [name, cfg] of Object.entries(speciesMap)) {
    const dir = path.join(speciesRoot, name);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'species.json'), JSON.stringify(cfg, null, 2));
  }
  return root;
}

// --- (a) empty species inherits all project fields -------------------------

test('(a) empty species inherits all project fields', () => {
  const root = mkTempProject(
    {
      id: 'etd',
      techStack: 'kaplay',
      contextFramework: 'gad',
      installedSkills: ['plan-phase', 'execute-phase'],
      defaultContent: { template: 'template/' },
      domain: 'game',
    },
    {
      empty: {},
    }
  );

  const resolved = loadResolvedSpecies(root, 'empty');

  assert.strictEqual(resolved.techStack, 'kaplay');
  assert.strictEqual(resolved.contextFramework, 'gad');
  assert.deepStrictEqual(resolved.installedSkills, ['plan-phase', 'execute-phase']);
  assert.deepStrictEqual(resolved.defaultContent, { template: 'template/' });
  assert.strictEqual(resolved.domain, 'game');
  assert.strictEqual(resolved.project, 'etd');
  assert.strictEqual(resolved.species, 'empty');
});

// --- (b) species overrides individual fields cleanly -----------------------

test('(b) species overrides individual project fields cleanly', () => {
  const root = mkTempProject(
    {
      id: 'etd',
      techStack: 'kaplay',
      contextFramework: 'gad',
      installedSkills: ['plan-phase', 'execute-phase'],
      domain: 'game',
    },
    {
      bare: {
        contextFramework: 'bare',
        // installedSkills overrides — replaces, not merges
        installedSkills: ['debug'],
      },
    }
  );

  const resolved = loadResolvedSpecies(root, 'bare');

  // overridden
  assert.strictEqual(resolved.contextFramework, 'bare');
  assert.deepStrictEqual(resolved.installedSkills, ['debug'], 'arrays must REPLACE not merge');
  // inherited
  assert.strictEqual(resolved.techStack, 'kaplay');
  assert.strictEqual(resolved.domain, 'game');
});

// --- (c) species-only fields do not pollute project defaults ---------------

test('(c) species-only fields do not back-propagate to project defaults', () => {
  const root = mkTempProject(
    {
      id: 'etd',
      techStack: 'kaplay',
      contextFramework: 'gad',
    },
    {
      gad: {
        description: 'gad-framework greenfield run',
        dna: { workflow: 'gad', skills: ['plan-phase'] },
      },
      bare: {
        description: 'bare — no framework',
        dna: { workflow: 'bare' },
      },
    }
  );

  // Species-only fields appear on their owning resolved species...
  const gadResolved = loadResolvedSpecies(root, 'gad');
  assert.strictEqual(gadResolved.description, 'gad-framework greenfield run');
  assert.deepStrictEqual(gadResolved.dna, { workflow: 'gad', skills: ['plan-phase'] });

  // ...but not on the other species.
  const bareResolved = loadResolvedSpecies(root, 'bare');
  assert.strictEqual(bareResolved.description, 'bare — no framework');
  assert.deepStrictEqual(bareResolved.dna, { workflow: 'bare' });

  // The underlying project.json must not have been mutated in memory nor on disk.
  const reloadedProject = loadProject(root);
  assert.strictEqual(reloadedProject.description, undefined);
  assert.strictEqual(reloadedProject.dna, undefined);

  // And rawrough raw species load shows project.json is still clean on disk.
  const rawProjectJson = JSON.parse(
    fs.readFileSync(path.join(root, 'project.json'), 'utf8')
  );
  assert.strictEqual(rawProjectJson.description, undefined);
  assert.strictEqual(rawProjectJson.dna, undefined);
});

// --- (d) inherits_from resolves a chain ------------------------------------

test('(d) inherits_from resolves a chain across species within one project', () => {
  // gad (root, inherits project) -> emergent (inherits gad) -> experimental (inherits emergent)
  const root = mkTempProject(
    {
      id: 'etd',
      techStack: 'kaplay',
      contextFramework: 'gad',
      installedSkills: ['plan-phase'],
      domain: 'game',
    },
    {
      gad: {
        // inherits purely from project
        dna: { workflow: 'gad' },
      },
      emergent: {
        inherits_from: 'gad',
        // override contextFramework from gad -> custom
        contextFramework: 'custom',
        dna: { workflow: 'emergent' },
      },
      experimental: {
        inherits_from: 'emergent',
        // add a new field, preserve chain overrides
        installedSkills: ['debug', 'refactor'],
      },
    }
  );

  const experimental = loadResolvedSpecies(root, 'experimental');

  // from project
  assert.strictEqual(experimental.techStack, 'kaplay');
  assert.strictEqual(experimental.domain, 'game');
  // from emergent override
  assert.strictEqual(experimental.contextFramework, 'custom');
  // dna came from emergent (gad->emergent chain), not overridden on experimental
  assert.deepStrictEqual(experimental.dna, { workflow: 'emergent' });
  // own override
  assert.deepStrictEqual(experimental.installedSkills, ['debug', 'refactor']);
  // own identity
  assert.strictEqual(experimental.species, 'experimental');
});

// --- (e) cycle detection ---------------------------------------------------

test('(e) inherits_from cycle throws a clear error', () => {
  const root = mkTempProject(
    { id: 'cyc', techStack: 'kaplay' },
    {
      a: { inherits_from: 'b' },
      b: { inherits_from: 'a' },
    }
  );

  assert.throws(
    () => loadResolvedSpecies(root, 'a'),
    /inherits_from cycle detected/
  );
});

// --- loadAllResolvedSpecies smoke check ------------------------------------

test('loadAllResolvedSpecies returns every species merged and sorted', () => {
  const root = mkTempProject(
    { id: 'etd', techStack: 'kaplay' },
    {
      bare: { contextFramework: 'bare' },
      gad: { contextFramework: 'gad' },
    }
  );

  const all = loadAllResolvedSpecies(root);
  assert.strictEqual(all.length, 2);
  assert.deepStrictEqual(
    all.map((s) => s.species),
    ['bare', 'gad']
  );
  for (const s of all) {
    assert.strictEqual(s.techStack, 'kaplay');
  }
});

// --- mergeProjectSpecies pure-function spot check --------------------------

test('mergeProjectSpecies is a pure function over inputs', () => {
  const projectCfg = {
    id: 'x',
    techStack: 'a',
    installedSkills: ['p'],
  };
  const speciesCfg = {
    id: 'y',
    installedSkills: ['q'],
    dna: { workflow: 'gad' },
  };
  const merged = mergeProjectSpecies(projectCfg, speciesCfg, {
    allSpeciesInProject: { y: speciesCfg },
  });
  assert.strictEqual(merged.techStack, 'a');
  assert.deepStrictEqual(merged.installedSkills, ['q']);
  assert.deepStrictEqual(merged.dna, { workflow: 'gad' });
  // Inputs not mutated
  assert.deepStrictEqual(projectCfg.installedSkills, ['p']);
  assert.strictEqual(projectCfg.dna, undefined);
});
