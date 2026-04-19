'use strict';
/**
 * gad generation — preserved generations: salvage, preserve, verify, open.
 * Currently only `salvage` is wired here; preserve/verify/open/review/report
 * still live as `evalPreserve`/`evalVerify`/etc. and are wired separately.
 *
 * Required deps: outputError, evalDataAccess (factory returning data-access API).
 * Local-only helpers: globToRegex, walkFiles.
 */

const fs = require('fs');
const path = require('path');
const { defineCommand } = require('citty');

/**
 * Simple glob-to-regex converter for salvage patterns.
 * Supports *, **, and ? wildcards. No brace expansion.
 */
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

/**
 * Walk a directory recursively, returning relative paths of all files.
 * Skips node_modules, .git, .planning, and dist/build dirs.
 */
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

function createGenerationCommands(deps) {
  const { outputError, evalDataAccess } = deps;

  const generationSalvage = defineCommand({
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
          `  Has this generation been preserved? Run \`gad generation preserve\` first.`,
        );
        return;
      }

      const patternStrings = args.patterns.split(',').map((p) => p.trim()).filter(Boolean);
      if (species.salvagePatterns && Array.isArray(species.salvagePatterns)) {
        for (const sp of species.salvagePatterns) {
          if (!patternStrings.includes(sp)) patternStrings.push(sp);
        }
      }
      const regexes = patternStrings.map((p) => ({ pattern: p, re: globToRegex(p) }));

      const searchDirs = ['public/data', 'src/data', 'game/data', 'data'];
      const candidates = [];

      for (const sub of searchDirs) {
        const searchRoot = path.join(runDir, sub);
        if (!fs.existsSync(searchRoot)) continue;
        const files = walkFiles(searchRoot);
        for (const rel of files) {
          if (regexes.some((r) => r.re.test(rel))) {
            candidates.push({ source: sub, relativePath: rel });
          }
        }
      }

      if (species.salvagePatterns && Array.isArray(species.salvagePatterns) && species.salvagePatterns.length > 0) {
        const speciesRegexes = species.salvagePatterns.map((p) => ({ pattern: p, re: globToRegex(p) }));
        const allFiles = walkFiles(runDir);
        const alreadyFound = new Set(candidates.map((c) => path.join(c.source, c.relativePath)));
        for (const rel of allFiles) {
          if (speciesRegexes.some((r) => r.re.test(rel))) {
            const firstSeg = rel.split('/')[0];
            const source = searchDirs.find((d) => d.startsWith(firstSeg)) || '.';
            const key = source === '.' ? rel : rel;
            if (!alreadyFound.has(key)) {
              candidates.push({ source: '.', relativePath: rel });
            }
          }
        }
      }

      if (candidates.length === 0) {
        const msg = `No files matched patterns [${patternStrings.join(', ')}] in ${runDir}`;
        if (args.json) {
          console.log(JSON.stringify({ salvaged: [], message: msg }));
        } else {
          console.log(msg);
          console.log(`  Searched: ${searchDirs.map((d) => 'run/' + d).join(', ')}`);
          if (species.salvagePatterns) console.log(`  Also searched entire run/ with species salvagePatterns`);
        }
        return;
      }

      const resolved = da.resolveProject(args.project);
      const speciesDir = path.join(resolved.projectDir, 'species', args.species);
      const salvageDir = path.join(speciesDir, 'assets', 'data', 'salvaged', args.version);

      const results = [];
      for (const c of candidates) {
        const srcFull = c.source === '.'
          ? path.join(runDir, c.relativePath)
          : path.join(runDir, c.source, c.relativePath);
        const dstFull = path.join(salvageDir, c.source === '.' ? c.relativePath : path.join(c.source, c.relativePath));
        const dstRel = path.relative(speciesDir, dstFull).replace(/\\/g, '/');

        results.push({
          from: `run/${c.source === '.' ? '' : c.source + '/'}${c.relativePath}`,
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
      } else {
        const label = args['dry-run'] ? 'DRY RUN — would salvage' : 'Salvaged';
        console.log(`${label} ${results.length} file(s) from ${args.project}/${args.species}/${args.version}\n`);
        console.log('  Source                                    → Destination');
        console.log('  ' + '─'.repeat(70));
        for (const r of results) {
          const sizeStr = r.size > 1024 ? `${(r.size / 1024).toFixed(1)}KB` : `${r.size}B`;
          console.log(`  ${r.from.padEnd(40)} → ${r.to}  (${sizeStr})`);
        }
        console.log('');
        if (args['dry-run']) {
          console.log(`  Target: ${salvageDir}`);
          console.log('  Re-run without --dry-run to copy.');
        } else {
          console.log(`  Written to: ${salvageDir}`);
        }
      }
    },
  });

  const generationCmd = defineCommand({
    meta: {
      name: 'generation',
      description:
        'Preserved generations: salvage, preserve, verify, open (HTTP preview of **build artifact** — same as `gad play`), review, report. Not `gad site serve` (planning/marketing Next app).',
    },
    subCommands: {
      salvage: generationSalvage,
    },
  });

  return { generationSalvage, generationCmd };
}

module.exports = { createGenerationCommands };
