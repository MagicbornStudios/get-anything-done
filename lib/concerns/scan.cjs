'use strict';
/**
 * lib/concerns/scan.cjs — Code-VCS landmark scanner.
 *
 * Phase 155 (operator standing rule 2026-05-07): mirror the UI Visual
 * Context System for code. Every component / concern gets a stable id
 * via a magic comment:
 *
 *   // @concern stripe.checkout
 *   // @concern-summary Stripe checkout integration with operator BYOK + retry guard
 *
 * The comment is the source of truth. Renames don't break it (the
 * scanner re-discovers it on the next build). The sidecar manifest at
 * .planning/concerns.json is a derived index for fast lookup.
 *
 * Operator + agents now have stable handles: "the stripe.checkout concern"
 * unambiguously points at the file. PreToolUse hook (deferred) can
 * warn when an Edit lands a second @concern marker in a file that
 * already has one — the one-file-per-concern discipline.
 */

const fs = require('node:fs');
const path = require('node:path');

const DEFAULT_INCLUDE_GLOBS = [
  // common code locations
  '**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx',
  '**/*.cjs', '**/*.mjs', '**/*.py', '**/*.go',
  '**/*.rs', '**/*.cs', '**/*.java',
];

const DEFAULT_EXCLUDE_DIR_PATTERNS = [
  /[/\\]node_modules[/\\]/,
  /[/\\]\.git[/\\]/,
  /[/\\]\.next[/\\]/,
  /[/\\]\.turbo[/\\]/,
  /[/\\]dist[/\\]/,
  /[/\\]build[/\\]/,
  /[/\\]\.cache[/\\]/,
  /[/\\]\.venv[/\\]/,
  /[/\\]__pycache__[/\\]/,
  /[/\\]\.planning[/\\]/,
  /[/\\]vendor[/\\]get-anything-done[/\\]node_modules[/\\]/,
];

const CODE_EXTENSIONS = new Set([
  '.ts', '.tsx', '.js', '.jsx', '.cjs', '.mjs',
  '.py', '.go', '.rs', '.cs', '.java',
]);

function shouldSkipDir(filePath) {
  return DEFAULT_EXCLUDE_DIR_PATTERNS.some((re) => re.test(filePath));
}

/**
 * Walk a tree, yielding code files (filtered by extension + ignore list).
 */
function* walkCodeFiles(rootPath) {
  const stack = [rootPath];
  while (stack.length) {
    const dir = stack.pop();
    let entries;
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { continue; }
    for (const ent of entries) {
      const full = path.join(dir, ent.name);
      if (shouldSkipDir(full)) continue;
      if (ent.isDirectory()) {
        stack.push(full);
      } else if (ent.isFile()) {
        const ext = path.extname(ent.name);
        if (CODE_EXTENSIONS.has(ext)) yield full;
      }
    }
  }
}

/**
 * Parse @concern markers out of a single file.
 *
 * Supported forms (line-comment only — no block-comment parsing in v1):
 *   // @concern <id>
 *   // @concern <id>  -- <inline-summary>
 *   // @concern-summary <multi-word summary line>
 *   # @concern <id>           (Python/Bash style)
 *
 * Returns array of { id, summary, line, col } per concern marker found.
 */
function parseConcernMarkers(content, filePath) {
  const lines = content.split(/\r?\n/);
  const markers = [];
  // We allow at most one summary that follows immediately after a concern id.
  // Trailing lines start fresh.
  let pendingMarker = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    // Match // @concern <id> or # @concern <id>
    const concernMatch = trimmed.match(/^(?:\/\/|#|\/\*|\*)\s*@concern\s+([A-Za-z0-9._\-/]+)\s*(?:--\s*(.+?))?\s*$/);
    if (concernMatch) {
      if (pendingMarker) markers.push(pendingMarker);
      pendingMarker = {
        id: concernMatch[1],
        summary: concernMatch[2] ? concernMatch[2].trim() : '',
        line: i + 1,
        col: line.indexOf('@concern') + 1,
        file_path: filePath,
      };
      continue;
    }
    // Match // @concern-summary <text>
    const summaryMatch = trimmed.match(/^(?:\/\/|#|\/\*|\*)\s*@concern-summary\s+(.+?)\s*$/);
    if (summaryMatch && pendingMarker && !pendingMarker.summary) {
      pendingMarker.summary = summaryMatch[1].trim();
      continue;
    }
    // Anything else flushes the pending marker to the list (so multiple
    // markers can stack with summary lines between, but stay paired).
    if (pendingMarker && trimmed && !trimmed.startsWith('//') && !trimmed.startsWith('#') && !trimmed.startsWith('*') && !trimmed.startsWith('/*')) {
      markers.push(pendingMarker);
      pendingMarker = null;
    }
  }
  if (pendingMarker) markers.push(pendingMarker);
  return markers;
}

/**
 * Scan a project root, collect all @concern markers, return as array.
 */
function scanProject(rootPath) {
  const markers = [];
  const fileCount = { scanned: 0, with_concerns: 0 };
  for (const filePath of walkCodeFiles(rootPath)) {
    fileCount.scanned++;
    let content;
    try { content = fs.readFileSync(filePath, 'utf8'); } catch { continue; }
    if (!content.includes('@concern')) continue;  // fast-path check
    const found = parseConcernMarkers(content, filePath);
    if (found.length > 0) {
      fileCount.with_concerns++;
      markers.push(...found);
    }
  }
  return { markers, file_count: fileCount };
}

/**
 * Build the sidecar manifest at <planningDir>/concerns.json.
 * Idempotent overwrite. Per-project — caller decides scope.
 */
function buildManifest({ rootPath, planningDir }) {
  const result = scanProject(rootPath);
  const manifest = {
    generated_at: new Date().toISOString(),
    root_path: rootPath,
    file_count: result.file_count,
    concerns: result.markers.reduce((acc, m) => {
      const rel = path.relative(rootPath, m.file_path).replace(/\\/g, '/');
      if (!acc[m.id]) acc[m.id] = [];
      acc[m.id].push({
        file: rel,
        line: m.line,
        col: m.col,
        summary: m.summary,
      });
      return acc;
    }, {}),
  };
  manifest.concern_count = Object.keys(manifest.concerns).length;
  manifest.violations = [];
  for (const [id, locations] of Object.entries(manifest.concerns)) {
    if (locations.length > 1) {
      manifest.violations.push({
        kind: 'duplicate_concern_id',
        id,
        locations,
      });
    }
  }
  // Files with multiple concerns (one-file-per-concern violation)
  const fileToIds = {};
  for (const [id, locations] of Object.entries(manifest.concerns)) {
    for (const loc of locations) {
      if (!fileToIds[loc.file]) fileToIds[loc.file] = [];
      fileToIds[loc.file].push(id);
    }
  }
  for (const [file, ids] of Object.entries(fileToIds)) {
    if (ids.length > 1) {
      manifest.violations.push({
        kind: 'multiple_concerns_in_file',
        file,
        ids,
      });
    }
  }
  if (!fs.existsSync(planningDir)) fs.mkdirSync(planningDir, { recursive: true });
  const outPath = path.join(planningDir, 'concerns.json');
  fs.writeFileSync(outPath, JSON.stringify(manifest, null, 2));
  return { manifest, out_path: outPath };
}

module.exports = { scanProject, buildManifest, parseConcernMarkers, walkCodeFiles };
