'use strict';
/**
 * lib/context-pack/index.cjs — injectable context builder for coding agents.
 *
 * Decision GLOBAL-D-446. Phase 284, task 284-01.
 *
 * Given a cid (e.g. "desk.teams.machine-capacity") or a task-id
 * (e.g. "281-05"), produces a compact markdown block that lets a coding
 * agent start with ZERO warm-up questions:
 *
 *   - Source file + line range of the cid region
 *   - Component imports
 *   - Tauri/IPC commands invoked (resolved via apps/desk/src/lib/tauri-commands.ts)
 *   - Data/planning files read
 *   - Related planning artifacts (decisions/tasks/notes mentioning the target)
 *   - 1-3 short code snippets
 *
 * Dependencies: node built-ins only (fs, path, child_process).
 * No heavy deps — keeping this portable and fast.
 */

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

// ---------------------------------------------------------------------------
// git grep helpers
// Uses execFileSync (args array) to avoid shell quoting issues on Windows.
// ---------------------------------------------------------------------------

/**
 * Run git grep safely; return lines or [] on failure.
 * @param {string} repoRoot
 * @param {string} pattern  — grep pattern (literal string, no shell interpolation)
 * @param {string[]} [extraArgs]  — additional flags before '--'
 * @returns {string[]}
 */
function gitGrep(repoRoot, pattern, extraArgs = []) {
  try {
    const result = execFileSync(
      'git',
      ['grep', '-n', '-F', ...extraArgs, '--', pattern],
      { cwd: repoRoot, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }
    );
    return result.split('\n').filter(Boolean);
  } catch (err) {
    // exit-code 1 = no matches (not a real error)
    if (err.status === 1) return [];
    // real error — silence but continue
    return [];
  }
}

/**
 * Run git grep and return only the file paths (deduplicated).
 */
function gitGrepFiles(repoRoot, pattern) {
  try {
    const result = execFileSync(
      'git',
      ['grep', '-l', '-F', '--', pattern],
      { cwd: repoRoot, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }
    );
    return [...new Set(result.split('\n').filter(Boolean))];
  } catch (err) {
    if (err.status === 1) return [];
    return [];
  }
}

/**
 * Search the .planning/ directory tree for files that mention `term`.
 * Falls back to fs.readdirSync walk + string search when git grep
 * doesn't find anything in the planning dir.
 */
function planningGrep(repoRoot, term) {
  const planningDir = path.join(repoRoot, '.planning');
  if (!fs.existsSync(planningDir)) return [];

  // Try git grep scoped to .planning/
  try {
    const result = execFileSync(
      'git',
      ['grep', '-l', '-i', '-F', '--', term, '.planning/'],
      { cwd: repoRoot, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }
    );
    return result.split('\n').filter(Boolean);
  } catch (err) {
    if (err.status !== 1) {
      // Fall back to recursive walk for non-git-indexed planning dirs
      return walkGrep(planningDir, term, repoRoot);
    }
    return [];
  }
}

/**
 * Recursive walk-and-grep for text files under `dir`.
 */
function walkGrep(dir, term, repoRoot) {
  const hits = [];
  const termLc = term.toLowerCase();
  function walk(d) {
    let entries;
    try { entries = fs.readdirSync(d, { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      const full = path.join(d, e.name);
      if (e.isDirectory()) {
        // skip node_modules / .git / large binary dirs
        if (['node_modules', '.git', 'dist', 'build'].includes(e.name)) continue;
        walk(full);
      } else if (e.isFile() && /\.(md|json|xml|txt|toml|cjs|ts|tsx|js)$/.test(e.name)) {
        try {
          const content = fs.readFileSync(full, 'utf8');
          if (content.toLowerCase().includes(termLc)) {
            hits.push(path.relative(repoRoot, full));
          }
        } catch { /* skip unreadable */ }
      }
    }
  }
  walk(dir);
  return hits;
}

// ---------------------------------------------------------------------------
// Source-file helpers
// ---------------------------------------------------------------------------

/**
 * Read lines startLine..endLine (1-based, inclusive) from a file.
 * Returns '' if file doesn't exist or range is out-of-bounds.
 */
function readLines(filePath, startLine, endLine) {
  try {
    const lines = fs.readFileSync(filePath, 'utf8').split('\n');
    const from = Math.max(0, startLine - 1);
    const to = Math.min(lines.length, endLine);
    return lines.slice(from, to).join('\n');
  } catch {
    return '';
  }
}

/**
 * Extract import statements from a source file.
 * Returns an array of strings (deduplicated).
 */
function extractImports(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n');
    const imports = [];
    for (const line of lines) {
      const t = line.trim();
      if (t.startsWith('import ') || t.startsWith('const {') || t.match(/^const .+ = require\(/)) {
        imports.push(t);
      }
      // Stop after first non-import/non-blank line past the preamble
      // (allow a generous preamble of 50 lines for license headers)
      if (imports.length > 0 && !t.startsWith('import') && !t.startsWith('const') && !t.startsWith('/') && !t.startsWith('*') && t !== '') {
        if (imports.length >= 3) break;
      }
    }
    return [...new Set(imports)].slice(0, 20);
  } catch {
    return [];
  }
}

/**
 * Find invoke() calls in a source file that reference Tauri commands.
 * Looks for: invoke("command_name", ...) or invokeGadJson / invokeGadText.
 */
function extractInvokeCalls(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const invocations = new Set();

    // Direct invoke("command_name", ...) — Tauri IPC
    const directRe = /invoke[<(]\s*["'`]([a-z_][a-z0-9_]*)["'`]/g;
    let m;
    while ((m = directRe.exec(content)) !== null) {
      invocations.add(`invoke("${m[1]}")`);
    }

    // invokeGadJson / invokeGadText calls
    const gadRe = /(invokeGadJson|invokeGadText)\s*\(\s*\[([^\]]*)\]/g;
    while ((m = gadRe.exec(content)) !== null) {
      const argsRaw = m[2].replace(/['"` ]/g, '').replace(/,/g, ' ');
      invocations.add(`${m[1]}([${argsRaw.trim()}])`);
    }

    return [...invocations];
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// CID resolution
// ---------------------------------------------------------------------------

/**
 * Given a cid string, find the source file and line range.
 * Returns { file, startLine, endLine, snippet } or null.
 */
function resolveCid(cid, repoRoot) {
  // Search for data-cid="<cid>" or cid="<cid>" in src files
  const patterns = [
    `data-cid="${cid}"`,
    `cid="${cid}"`,
    `data-cid={"${cid}"}`,
    `cid={"${cid}"}`,
  ];

  for (const pattern of patterns) {
    const lines = gitGrep(repoRoot, pattern);
    if (lines.length === 0) continue;

    // Pick the first match — format is "filepath:linenum:content"
    const first = lines[0];
    const colonIdx = first.indexOf(':');
    const secondColon = first.indexOf(':', colonIdx + 1);
    if (colonIdx < 0 || secondColon < 0) continue;

    const file = first.substring(0, colonIdx);
    const lineNum = parseInt(first.substring(colonIdx + 1, secondColon), 10);
    if (isNaN(lineNum)) continue;

    // git grep returns forward slashes on all platforms; normalize for fs access
    const absFile = path.join(repoRoot, file.replace(/\//g, path.sep));

    // Extract a meaningful region: 5 lines before, up to 40 lines after
    const startLine = Math.max(1, lineNum - 5);
    const endLine = lineNum + 40;
    const snippet = readLines(absFile, startLine, endLine);

    return {
      file,
      absFile,
      startLine,
      endLine: lineNum + 40,
      hitLine: lineNum,
      snippet,
      allMatches: lines,
    };
  }
  return null;
}

// ---------------------------------------------------------------------------
// Task-ID resolution
// ---------------------------------------------------------------------------

/**
 * Resolve a task-id to its JSON file given a list of candidate planning dirs.
 * Returns the parsed task object or null.
 */
function resolveTask(taskId, planningDirs) {
  for (const planDir of planningDirs) {
    const candidate = path.join(planDir, 'tasks', `${taskId}.json`);
    if (fs.existsSync(candidate)) {
      try {
        return { task: JSON.parse(fs.readFileSync(candidate, 'utf8')), planDir };
      } catch {
        return null;
      }
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Planning reference resolution
// ---------------------------------------------------------------------------

/**
 * Find planning artifacts that reference the given term.
 * Returns up to 10 relevant file paths relative to repoRoot.
 */
function findPlanningRefs(term, repoRoot) {
  const files = planningGrep(repoRoot, term);
  // Limit to 10, sort by recency-proxy (filename date prefix) descending
  return files.sort().reverse().slice(0, 10);
}

/**
 * Extract a 2-line summary from a planning file (first non-empty line after
 * the opening, or the "goal" field of a JSON task).
 */
function planningFileSummary(relPath, repoRoot) {
  const absPath = path.join(repoRoot, relPath);
  try {
    if (relPath.endsWith('.json')) {
      const obj = JSON.parse(fs.readFileSync(absPath, 'utf8'));
      return obj.goal || obj.summary || obj.title || '';
    }
    const lines = fs.readFileSync(absPath, 'utf8').split('\n');
    for (const l of lines) {
      const t = l.replace(/^#+\s*/, '').trim();
      if (t && !t.startsWith('<') && t.length > 10) return t.slice(0, 120);
    }
    return '';
  } catch {
    return '';
  }
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

/**
 * Build a context pack for a cid or task-id.
 *
 * @param {object} opts
 * @param {string} [opts.cid]         — visual component id (e.g. "desk.teams.machine-capacity")
 * @param {string} [opts.taskId]      — task id (e.g. "281-05")
 * @param {string} opts.repoRoot      — absolute path to the repository root
 * @param {string[]} [opts.planningDirs] — absolute paths to .planning/ dirs to search.
 *   Defaults to [repoRoot + '/.planning'].
 *
 * @returns {string}  markdown context block
 */
function buildContextPack({ cid, taskId, repoRoot, planningDirs }) {
  if (!repoRoot) throw new Error('buildContextPack: repoRoot is required');
  if (!cid && !taskId) throw new Error('buildContextPack: cid or taskId is required');

  const resolvedPlanningDirs = planningDirs || [path.join(repoRoot, '.planning')];
  const target = cid || taskId;
  const lines = [];

  lines.push(`## Context pack for ${target}`);
  lines.push('');

  // ── CID path ──────────────────────────────────────────────────────────────
  if (cid) {
    lines.push('### Source location');
    const cidResult = resolveCid(cid, repoRoot);
    if (!cidResult) {
      lines.push(`_No source file found for cid \`${cid}\`._`);
      lines.push('');
    } else {
      lines.push(`**File:** \`${cidResult.file}\``);
      lines.push(`**Hit line:** ${cidResult.hitLine}  (region: ${cidResult.startLine}–${cidResult.endLine})`);
      if (cidResult.allMatches.length > 1) {
        lines.push(`**All occurrences (${cidResult.allMatches.length}):**`);
        for (const m of cidResult.allMatches.slice(0, 5)) {
          lines.push(`  - \`${m}\``);
        }
      }
      lines.push('');

      // Imports
      const imports = extractImports(cidResult.absFile);
      if (imports.length > 0) {
        lines.push('### Imports');
        lines.push('```typescript');
        lines.push(imports.join('\n'));
        lines.push('```');
        lines.push('');
      }

      // Tauri/IPC commands
      const invokeCalls = extractInvokeCalls(cidResult.absFile);
      if (invokeCalls.length > 0) {
        lines.push('### Tauri / IPC commands invoked');
        for (const call of invokeCalls) {
          lines.push(`- \`${call}\``);
        }
        // Also note the typed wrapper location
        const tauriCommandsRel = 'apps/desk/src/lib/tauri-commands.ts';
        const tauriCommandsAbs = path.join(repoRoot, tauriCommandsRel);
        if (fs.existsSync(tauriCommandsAbs)) {
          lines.push('');
          lines.push(`Typed wrappers: \`${tauriCommandsRel}\``);
        }
        lines.push('');
      }

      // Code snippet
      if (cidResult.snippet) {
        lines.push('### Code snippet');
        lines.push('```typescript');
        lines.push(cidResult.snippet);
        lines.push('```');
        lines.push('');
      }
    }
  }

  // ── Task-ID path ──────────────────────────────────────────────────────────
  if (taskId) {
    lines.push('### Task');
    const result = resolveTask(taskId, resolvedPlanningDirs);
    if (!result) {
      lines.push(`_Task \`${taskId}\` not found in planning dirs._`);
      lines.push('');
    } else {
      const { task } = result;
      lines.push(`**ID:** ${task.id}  **Phase:** ${task.phase}  **Status:** ${task.status}`);
      lines.push(`**Goal:** ${task.goal}`);
      if (task.depends && task.depends.length > 0) {
        lines.push(`**Depends on:** ${task.depends.join(', ')}`);
      }
      lines.push('');

      // Files
      const taskFiles = (task.files || []).filter(Boolean);
      if (taskFiles.length > 0) {
        lines.push('### Files');
        for (const f of taskFiles) {
          const absF = path.join(repoRoot, f);
          const exists = fs.existsSync(absF);
          lines.push(`- \`${f}\` ${exists ? '' : '_(not yet created)_'}`);

          if (exists) {
            const imports = extractImports(absF);
            if (imports.length > 0) {
              lines.push('  ```typescript');
              lines.push('  ' + imports.slice(0, 5).join('\n  '));
              lines.push('  ```');
            }
            // Short head excerpt (first 8 non-blank lines)
            try {
              const fileLines = fs.readFileSync(absF, 'utf8').split('\n');
              const head = fileLines.filter(l => l.trim()).slice(0, 8).join('\n');
              if (head) {
                lines.push('  ```');
                lines.push('  ' + head.split('\n').join('\n  '));
                lines.push('  ```');
              }
            } catch { /* skip */ }
          }
        }
        lines.push('');
      }
    }
  }

  // ── Related planning artifacts ─────────────────────────────────────────────
  lines.push('### Related planning artifacts');
  const refs = findPlanningRefs(target, repoRoot);
  if (refs.length === 0) {
    lines.push('_None found._');
  } else {
    for (const ref of refs) {
      const summary = planningFileSummary(ref, repoRoot);
      lines.push(`- \`${ref}\`${summary ? ` — ${summary}` : ''}`);
    }
  }
  lines.push('');

  return lines.join('\n');
}

module.exports = { buildContextPack };
