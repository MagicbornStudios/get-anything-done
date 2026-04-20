'use strict';

const fs = require('fs');
const path = require('path');
const { defineCommand } = require('citty');

function globToRegex(pattern) {
  let re = '';
  let i = 0;
  while (i < pattern.length) {
    const ch = pattern[i];
    if (ch === '*') {
      if (pattern[i + 1] === '*') {
        re += '.*';
        i += 2;
        if (pattern[i] === '/' || pattern[i] === '\\') i++;
        continue;
      }
      re += '[^/\\\\]*';
    } else if (ch === '?') {
      re += '[^/\\\\]';
    } else if ('.+^${}()|[]\\'.includes(ch)) {
      re += '\\' + ch;
    } else {
      re += ch;
    }
    i++;
  }
  return new RegExp('^' + re + '$', 'i');
}

function walkFiles(dir, base) {
  base = base || dir;
  const results = [];
  if (!fs.existsSync(dir)) return results;
  const skipDirs = new Set(['node_modules', '.git', '.planning', 'dist', 'build', '.next', 'out']);
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (skipDirs.has(entry.name)) continue;
      results.push(...walkFiles(fullPath, base));
    } else if (entry.isFile()) {
      results.push(path.relative(base, fullPath).replace(/\\/g, '/'));
    }
  }
  return results;
}

function createGenerationSalvageCommand({ outputError, evalDataAccess }) {
  return defineCommand({
    meta: { name: 'salvage', description: 'Extract reusable data assets from a completed generation run' },
    args: {
      project: { type: 'string', description: 'Project id', required: true },
      species: { type: 'string', description: 'Species name', required: true },
      version: { type: 'string', description: 'Generation version (e.g. v12)', required: true },
      patterns: { type: 'string', description: 'Comma-separated glob patterns (default: **/*.json)', default: '**/*.json' },
      'dry-run': { type: 'boolean', description: 'Preview without copying', default: false },
      json: { type: 'boolean', description: 'JSON output', default: false },
    },
    run({ args }) {
      const da = evalDataAccess();
      const species = da.getSpecies(args.project, args.species);
      if (!species) {
        outputError(`Species "${args.species}" not found in project "${args.project}".`);
        return;
      }

      const gen = da.getGeneration(args.project, args.species, args.version);
      if (!gen) {
        outputError(`Generation "${args.version}" not found for species "${args.species}" in project "${args.project}".`);
        return;
      }

      const runDir = path.join(gen.dir, 'run');
      if (!fs.existsSync(runDir)) {
        outputError(
          `No run/ directory found at ${gen.dir}.\n` +
          '  Has this generation been preserved? Run `gad generation preserve` first.',
        );
        return;
      }

      const patternStrings = args.patterns.split(',').map((p) => p.trim()).filter(Boolean);
      if (species.salvagePatterns && Array.isArray(species.salvagePatterns)) {
        for (const salvagePattern of species.salvagePatterns) {
          if (!patternStrings.includes(salvagePattern)) patternStrings.push(salvagePattern);
        }
      }
      const regexes = patternStrings.map((pattern) => ({ pattern, re: globToRegex(pattern) }));

      const searchDirs = ['public/data', 'src/data', 'game/data', 'data'];
      const candidates = [];

      for (const sub of searchDirs) {
        const searchRoot = path.join(runDir, sub);
        if (!fs.existsSync(searchRoot)) continue;
        const files = walkFiles(searchRoot);
        for (const rel of files) {
          if (regexes.some((regex) => regex.re.test(rel))) {
            candidates.push({ source: sub, relativePath: rel });
          }
        }
      }

      if (species.salvagePatterns && Array.isArray(species.salvagePatterns) && species.salvagePatterns.length > 0) {
        const speciesRegexes = species.salvagePatterns.map((pattern) => ({ pattern, re: globToRegex(pattern) }));
        const allFiles = walkFiles(runDir);
        const alreadyFound = new Set(candidates.map((candidate) => path.join(candidate.source, candidate.relativePath)));
        for (const rel of allFiles) {
          if (speciesRegexes.some((regex) => regex.re.test(rel))) {
            const firstSeg = rel.split('/')[0];
            const source = searchDirs.find((dir) => dir.startsWith(firstSeg)) || '.';
            const key = rel;
            if (!alreadyFound.has(key)) {
              candidates.push({ source, relativePath: rel });
            }
          }
        }
      }

      if (candidates.length === 0) {
        const message = `No files matched patterns [${patternStrings.join(', ')}] in ${runDir}`;
        if (args.json) {
          console.log(JSON.stringify({ salvaged: [], message }));
        } else {
          console.log(message);
          console.log(`  Searched: ${searchDirs.map((dir) => `run/${dir}`).join(', ')}`);
          if (species.salvagePatterns) console.log('  Also searched entire run/ with species salvagePatterns');
        }
        return;
      }

      const resolved = da.resolveProject(args.project);
      const speciesDir = path.join(resolved.projectDir, 'species', args.species);
      const salvageDir = path.join(speciesDir, 'assets', 'data', 'salvaged', args.version);

      const results = [];
      for (const candidate of candidates) {
        const srcFull = candidate.source === '.'
          ? path.join(runDir, candidate.relativePath)
          : path.join(runDir, candidate.source, candidate.relativePath);
        const dstFull = path.join(
          salvageDir,
          candidate.source === '.' ? candidate.relativePath : path.join(candidate.source, candidate.relativePath),
        );
        const dstRel = path.relative(speciesDir, dstFull).replace(/\\/g, '/');

        results.push({
          from: `run/${candidate.source === '.' ? '' : `${candidate.source}/`}${candidate.relativePath}`,
          to: dstRel,
          size: fs.existsSync(srcFull) ? fs.statSync(srcFull).size : 0,
        });

        if (!args['dry-run']) {
          fs.mkdirSync(path.dirname(dstFull), { recursive: true });
          fs.copyFileSync(srcFull, dstFull);
        }
      }

      if (args.json) {
        console.log(JSON.stringify({
          dryRun: args['dry-run'],
          project: args.project,
          species: args.species,
          version: args.version,
          patterns: patternStrings,
          salvageDir,
          salvaged: results,
        }, null, 2));
        return;
      }

      const label = args['dry-run'] ? 'DRY RUN - would salvage' : 'Salvaged';
      console.log(`${label} ${results.length} file(s) from ${args.project}/${args.species}/${args.version}\n`);
      console.log('  Source                                    -> Destination');
      console.log(`  ${'-'.repeat(70)}`);
      for (const result of results) {
        const sizeStr = result.size > 1024 ? `${(result.size / 1024).toFixed(1)}KB` : `${result.size}B`;
        console.log(`  ${result.from.padEnd(40)} -> ${result.to}  (${sizeStr})`);
      }
      console.log('');
      if (args['dry-run']) {
        console.log(`  Target: ${salvageDir}`);
        console.log('  Re-run without --dry-run to copy.');
      } else {
        console.log(`  Written to: ${salvageDir}`);
      }
    },
  });
}

module.exports = { createGenerationSalvageCommand };
