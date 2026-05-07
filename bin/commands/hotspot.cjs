'use strict';
/**
 * gad hotspot — codebase hotspot monitor (Phase 129).
 *
 * Subcommands:
 *   scan    — scan recent git commits for risk patterns
 *   summary — aggregate risk counts over a period
 *
 * Risk patterns detected:
 *   lost-features  — large deletions (>200 lines) outside a refactor phase
 *   cross-domain   — commit touches >2 distinct domain folders
 *   scope-creep    — commit references a phase but edits outside that phase's domain
 *   missing-cids   — new .tsx files in apps/ with >50 LOC and 0 cid declarations
 */

const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { defineCommand } = require('citty');

// ---------------------------------------------------------------------------
// Domain map — folder prefix → domain label. Order matters: most-specific first.
// ---------------------------------------------------------------------------
const DOMAIN_MAP = [
  { prefix: 'apps/platform/app/(operator)/', domain: 'operator-dashboard' },
  { prefix: 'apps/platform/app/(marketing)/', domain: 'marketing' },
  { prefix: 'apps/desktop/src/', domain: 'desktop' },
  { prefix: 'packages/visual-context/', domain: 'vcs' },
  { prefix: 'vendor/get-anything-done/lib/team/', domain: 'team-orchestration' },
  { prefix: 'vendor/get-anything-done/', domain: 'gad-framework' },
  { prefix: 'apps/platform/', domain: 'platform' },
  { prefix: 'apps/', domain: 'apps' },
  { prefix: 'sites/', domain: 'site' },
  { prefix: 'packages/', domain: 'packages' },
];

// Regex for surface packages: packages/<surface>-surface/
const SURFACE_PKG_RE = /^packages\/([^/]+)-surface\//;

function classifyFile(filePath) {
  // Normalize to forward slashes
  const fp = filePath.replace(/\\/g, '/');

  const surfaceMatch = fp.match(SURFACE_PKG_RE);
  if (surfaceMatch) return `surface-${surfaceMatch[1]}`;

  // Sites: sites/<name>/
  const siteMatch = fp.match(/^sites\/([^/]+)\//);
  if (siteMatch) return `site-${siteMatch[1]}`;

  for (const { prefix, domain } of DOMAIN_MAP) {
    if (fp.startsWith(prefix)) return domain;
  }
  return 'unknown';
}

// ---------------------------------------------------------------------------
// Git helpers — all use execFileSync to avoid shell quoting issues on Windows
// ---------------------------------------------------------------------------

function gitExecSync(repoRoot, args) {
  try {
    return execFileSync('git', args, {
      cwd: repoRoot,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
  } catch (err) {
    return err.stdout || '';
  }
}

/**
 * Returns an array of commit objects for the range. Each object:
 *   { sha, shortSha, date, author, title, ins, del, files: [{ path, ins, del }] }
 *
 * Parsing strategy:
 *   Use --format with a sentinel line BEFORE each commit's header so we can
 *   reliably split headers from the numstat block that follows. The sentinel
 *   is a unique string that won't appear in commit messages or file paths.
 */
const COMMIT_SENTINEL = '^^HOTSPOT_COMMIT_START^^';

function getCommits(repoRoot, { since, branch, commits }) {
  // Build git log arguments. We prepend the sentinel on its own line (%n),
  // then put the header fields separated by \x1f, all on one line.
  const formatLine = `%n${COMMIT_SENTINEL}%n%H%x1f%ai%x1f%an%x1f%s`;
  const logArgs = ['log', `--format=${formatLine}`, '--numstat'];
  if (branch) logArgs.push(branch);
  if (since) logArgs.push(`--after=${since}`);
  if (commits && commits > 0) logArgs.push(`-${commits}`);

  const raw = gitExecSync(repoRoot, logArgs);

  // Split on the sentinel to get one block per commit
  const blocks = raw.split(COMMIT_SENTINEL).filter((b) => b.trim());
  const result = [];

  for (const block of blocks) {
    const lines = block.split(/\r?\n/);
    // First non-empty line after the sentinel is the header
    let headerLine = '';
    let numstatStart = 0;
    for (let i = 0; i < lines.length; i++) {
      const l = lines[i].trim();
      if (l && !headerLine) {
        headerLine = l;
        numstatStart = i + 1;
        break;
      }
    }
    if (!headerLine) continue;

    const parts = headerLine.split('\x1f');
    if (parts.length < 4) continue;

    const [sha, date, author, ...titleParts] = parts;
    const title = titleParts.join('\x1f').trim();
    const shortSha = sha.slice(0, 8);

    let totalIns = 0;
    let totalDel = 0;
    const files = [];

    for (let i = numstatStart; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      // numstat format: <ins>\t<del>\t<path>  (binary files show - -)
      // Tab-separated
      const tabIdx1 = line.indexOf('\t');
      if (tabIdx1 === -1) continue;
      const tabIdx2 = line.indexOf('\t', tabIdx1 + 1);
      if (tabIdx2 === -1) continue;
      const insStr = line.slice(0, tabIdx1);
      const delStr = line.slice(tabIdx1 + 1, tabIdx2);
      const filePath = line.slice(tabIdx2 + 1);
      const ins = insStr === '-' ? 0 : parseInt(insStr, 10);
      const del = delStr === '-' ? 0 : parseInt(delStr, 10);
      if (Number.isNaN(ins) || Number.isNaN(del)) continue;
      totalIns += ins;
      totalDel += del;
      files.push({ path: filePath, ins, del });
    }

    result.push({ sha, shortSha, date: date.slice(0, 10), author, title, ins: totalIns, del: totalDel, files });
  }

  return result;
}

// ---------------------------------------------------------------------------
// Phase lookup — parse commit message for phase-<N> ref, then check phase title
// ---------------------------------------------------------------------------

const REFACTOR_KEYWORDS = ['refactor', 'split', 'consolidate', 'reorgani', 'restructure', 'clean', 'extract'];

function extractPhaseRef(commitTitle) {
  const m = String(commitTitle).match(/phase[-\s]?(\d+)/i);
  return m ? parseInt(m[1], 10) : null;
}

function isRefactorPhase(phaseNum, repoRoot) {
  if (!phaseNum) return false;
  try {
    // Try to load phases JSON directly from planning dir
    const gadCfgPath = path.join(repoRoot, '.gad.toml');
    if (!fs.existsSync(gadCfgPath)) return false;
    // Use node to call gad phases list --json — quickest path
    // Avoid circular: just read .planning/phases/*.json directly
    const planningDir = path.join(repoRoot, '.planning');
    const phasesDir = path.join(planningDir, 'phases');
    if (!fs.existsSync(phasesDir)) return false;

    // Try to find a file matching the phase number
    const phaseFile = path.join(phasesDir, `${phaseNum}.json`);
    if (fs.existsSync(phaseFile)) {
      const data = JSON.parse(fs.readFileSync(phaseFile, 'utf8'));
      const title = String(data.title || data.name || '').toLowerCase();
      return REFACTOR_KEYWORDS.some((kw) => title.includes(kw));
    }

    // Fallback: scan all phase files
    const files = fs.readdirSync(phasesDir).filter((f) => f.endsWith('.json'));
    for (const f of files) {
      try {
        const data = JSON.parse(fs.readFileSync(path.join(phasesDir, f), 'utf8'));
        if (data.phase === phaseNum || data.id === phaseNum || data.number === phaseNum || parseInt(f, 10) === phaseNum) {
          const title = String(data.title || data.name || '').toLowerCase();
          return REFACTOR_KEYWORDS.some((kw) => title.includes(kw));
        }
      } catch { /* skip */ }
    }
  } catch { /* skip */ }
  return false;
}

// ---------------------------------------------------------------------------
// CID coverage check for newly-added .tsx files
// ---------------------------------------------------------------------------

const CID_PATTERNS = [
  /<SiteSection\s[^>]*cid=/,
  /<Identified\s[^>]*cid=/,
];

function checkMissingCids(repoRoot, sha) {
  // Get the diff of added .tsx files in apps/
  const diffArgs = ['diff', '--diff-filter=A', '--name-only', `${sha}^`, sha, '--', 'apps/**/*.tsx'];
  const rawNames = gitExecSync(repoRoot, diffArgs).trim();
  if (!rawNames) return [];

  const flagged = [];
  const names = rawNames.split(/\r?\n/).filter((n) => n.endsWith('.tsx'));

  for (const name of names) {
    if (!name.startsWith('apps/')) continue;
    // Get the file content as of this commit
    try {
      const content = execFileSync('git', ['show', `${sha}:${name}`], {
        cwd: repoRoot,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
      });
      const lineCount = content.split(/\r?\n/).length;
      if (lineCount < 50) continue;
      const hasCid = CID_PATTERNS.some((re) => re.test(content));
      if (!hasCid) flagged.push(name);
    } catch { /* file may not exist in this context */ }
  }
  return flagged;
}

// ---------------------------------------------------------------------------
// Risk detection
// ---------------------------------------------------------------------------

function detectRisks(commit, repoRoot) {
  const risks = [];

  // 1. Large deletions outside a refactor phase
  if (commit.del > 200) {
    const phaseNum = extractPhaseRef(commit.title);
    if (!isRefactorPhase(phaseNum, repoRoot)) {
      risks.push('lost-features');
    }
  }

  // 2. Cross-domain spillover
  const domains = new Set(commit.files.map((f) => classifyFile(f.path)));
  if (domains.size > 2) {
    risks.push('cross-domain');
  }

  // 3. Scope creep — commit references a phase but touches unexpected domains
  const phaseNum = extractPhaseRef(commit.title);
  if (phaseNum && domains.size > 1) {
    // Heuristic: if more than 2 non-unknown domains touched, likely scope creep
    const knownDomains = [...domains].filter((d) => d !== 'unknown');
    if (knownDomains.length > 2) {
      risks.push('scope-creep');
    }
  }

  // 4. Missing CID coverage — for added .tsx files in apps/
  const hasTsxInApps = commit.files.some((f) => f.path.startsWith('apps/') && f.path.endsWith('.tsx'));
  if (hasTsxInApps) {
    const missingCidFiles = checkMissingCids(repoRoot, commit.sha);
    if (missingCidFiles.length > 0) {
      risks.push('missing-cids');
      commit._missingCidFiles = missingCidFiles;
    }
  }

  return { risks, domains: [...domains] };
}

// ---------------------------------------------------------------------------
// Table rendering helpers
// ---------------------------------------------------------------------------

function padEnd(str, len) {
  const s = String(str == null ? '' : str);
  if (s.length >= len) return s.slice(0, len);
  return s + ' '.repeat(len - s.length);
}

function truncate(str, len) {
  const s = String(str == null ? '' : str);
  if (s.length <= len) return s;
  return `${s.slice(0, len - 1)}…`;
}

function printScanTable(rows) {
  const COL = {
    sha: 8, date: 10, author: 14, ins: 6, del: 6,
    domains: 20, risks: 30, title: 40,
  };
  const header = [
    padEnd('SHA', COL.sha), padEnd('DATE', COL.date), padEnd('AUTHOR', COL.author),
    padEnd('+INS', COL.ins), padEnd('-DEL', COL.del),
    padEnd('DOMAINS', COL.domains), padEnd('RISKS', COL.risks), 'TITLE',
  ].join('  ');
  const sep = Object.values(COL).map((n) => '-'.repeat(n)).join('  ') + '  ' + '-'.repeat(40);
  console.log(header);
  console.log(sep);
  for (const row of rows) {
    const line = [
      padEnd(row.shortSha, COL.sha),
      padEnd(row.date, COL.date),
      padEnd(truncate(row.author, COL.author), COL.author),
      padEnd(String(row.ins), COL.ins),
      padEnd(String(row.del), COL.del),
      padEnd(truncate(row.domains.join(','), COL.domains), COL.domains),
      padEnd(row.risks.join(',') || '-', COL.risks),
      truncate(row.title, COL.title),
    ].join('  ');
    console.log(line);
  }
}

// ---------------------------------------------------------------------------
// Command factory
// ---------------------------------------------------------------------------

function createHotspotCommand(deps) {
  const { findRepoRoot, outputError } = deps;

  // -- scan subcommand --
  const scanCmd = defineCommand({
    meta: { name: 'scan', description: 'Scan recent git commits for risk patterns (lost-features, cross-domain, scope-creep, missing-cids)' },
    args: {
      since: { type: 'string', description: 'Only commits at-or-after this ISO timestamp', default: '' },
      branch: { type: 'string', description: 'Branch to scan (default: current)', default: '' },
      commits: { type: 'string', description: 'Limit to last N commits (default: 50)', default: '50' },
      projectid: { type: 'string', description: 'Scope context (informational)', default: '' },
      json: { type: 'boolean', description: 'JSON output', default: false },
    },
    run({ args }) {
      const repoRoot = findRepoRoot();
      const commitLimit = Math.max(1, parseInt(String(args.commits || '50'), 10) || 50);
      const branchArg = args.branch ? String(args.branch) : '';
      const sinceArg = args.since ? String(args.since) : '';

      const rawCommits = getCommits(repoRoot, {
        since: sinceArg,
        branch: branchArg,
        commits: commitLimit,
      });

      if (rawCommits.length === 0) {
        if (!args.json) console.log('No commits found in the specified range.');
        else console.log('[]');
        return;
      }

      const rows = rawCommits.map((commit) => {
        const { risks, domains } = detectRisks(commit, repoRoot);
        return {
          sha: commit.sha,
          shortSha: commit.shortSha,
          date: commit.date,
          author: commit.author,
          ins: commit.ins,
          del: commit.del,
          domains,
          risks,
          title: commit.title,
          files: commit.files.map((f) => f.path),
          missingCidFiles: commit._missingCidFiles || [],
        };
      });

      if (args.json) {
        console.log(JSON.stringify(rows, null, 2));
        return;
      }

      const sinceLabel = sinceArg ? ` since ${sinceArg}` : '';
      const branchLabel = branchArg ? ` on ${branchArg}` : '';
      console.log(`\nHOTSPOT SCAN${branchLabel}${sinceLabel} (${rows.length} commits)\n`);
      printScanTable(rows);

      // Summary of flagged items
      const flagged = rows.filter((r) => r.risks.length > 0);
      if (flagged.length > 0) {
        console.log(`\n${flagged.length}/${rows.length} commits flagged:`);
        for (const row of flagged) {
          console.log(`  ${row.shortSha}  [${row.risks.join(', ')}]  ${truncate(row.title, 60)}`);
          if (row.missingCidFiles.length > 0) {
            for (const f of row.missingCidFiles) {
              console.log(`         missing-cids: ${f}`);
            }
          }
        }
      } else {
        console.log('\nNo risk flags detected.');
      }
    },
  });

  // -- summary subcommand --
  const summaryCmd = defineCommand({
    meta: { name: 'summary', description: 'Aggregate risk counts over a period' },
    args: {
      since: { type: 'string', description: 'ISO timestamp lower bound', default: '' },
      commits: { type: 'string', description: 'Limit to last N commits (default: 200)', default: '200' },
      json: { type: 'boolean', description: 'JSON output', default: false },
    },
    run({ args }) {
      const repoRoot = findRepoRoot();
      const commitLimit = Math.max(1, parseInt(String(args.commits || '200'), 10) || 200);
      const sinceArg = args.since ? String(args.since) : '';

      const rawCommits = getCommits(repoRoot, {
        since: sinceArg,
        branch: '',
        commits: commitLimit,
      });

      const counts = {
        'lost-features': 0,
        'cross-domain': 0,
        'scope-creep': 0,
        'missing-cids': 0,
      };
      const allDomains = new Set();
      let missingCidFiles = 0;

      for (const commit of rawCommits) {
        const { risks, domains } = detectRisks(commit, repoRoot);
        for (const r of risks) {
          if (r in counts) counts[r]++;
        }
        for (const d of domains) allDomains.add(d);
        if (commit._missingCidFiles) missingCidFiles += commit._missingCidFiles.length;
      }
      // Override missing-cids count to file-level
      counts['missing-cids'] = missingCidFiles;

      if (args.json) {
        console.log(JSON.stringify({ since: sinceArg, totalCommits: rawCommits.length, counts, domainsDistinct: allDomains.size }, null, 2));
        return;
      }

      const sinceLabel = sinceArg ? ` since ${sinceArg}` : ` (last ${commitLimit} commits)`;
      console.log(`\nHOTSPOT SUMMARY${sinceLabel}`);
      console.log(`  lost-features    ${String(counts['lost-features']).padStart(4)} commits`);
      console.log(`  cross-domain     ${String(counts['cross-domain']).padStart(4)} commits`);
      console.log(`  scope-creep      ${String(counts['scope-creep']).padStart(4)} commit${counts['scope-creep'] === 1 ? '' : 's'}`);
      console.log(`  missing-cids     ${String(counts['missing-cids']).padStart(4)} files`);
      console.log(`  domains-touched  ${String(allDomains.size).padStart(4)} distinct`);
    },
  });

  return defineCommand({
    meta: {
      name: 'hotspot',
      description: 'Codebase hotspot monitor — scan git history for risk patterns (Phase 129)',
    },
    subCommands: {
      scan: scanCmd,
      summary: summaryCmd,
    },
  });
}

module.exports = { createHotspotCommand };
module.exports.register = (ctx) => ({
  hotspot: createHotspotCommand(ctx.common),
});
