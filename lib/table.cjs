#!/usr/bin/env node
'use strict';
/**
 * Lightweight table formatter for the gad CLI.
 * Inline implementation — gad is self-contained, does not depend on mb-cli-framework at runtime.
 */

const ansi = {
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  reset: '\x1b[0m',
};

const useAnsi = Boolean(process.stdout?.isTTY);

/**
 * @param {Record<string, unknown>[]} rows
 * @param {{ title?: string, format?: 'table'|'json'|'md'|'plain', headers?: string[] }} opts
 */
function render(rows, opts = {}) {
  const format = opts.format || 'table';

  if (format === 'json') {
    return JSON.stringify(rows, null, 2);
  }

  const keys = opts.headers || (rows.length > 0 ? Object.keys(rows[0]) : []);

  if (format === 'md') {
    return renderMarkdown(rows, keys, opts.title);
  }

  return renderTable(rows, keys, opts.title);
}

function renderTable(rows, keys, title) {
  const widths = keys.map(k => k.length);
  for (const row of rows) {
    keys.forEach((k, i) => {
      const val = row[k] == null ? '' : String(row[k]);
      widths[i] = Math.max(widths[i], val.length);
    });
  }

  const pad = (s, len) => String(s == null ? '' : s).padEnd(len);
  const sep = widths.map(w => '─'.repeat(w)).join('  ');
  const header = keys.map((k, i) => pad(k.toUpperCase(), widths[i])).join('  ');

  const lines = [];
  if (title) {
    lines.push(useAnsi ? `${ansi.bold}${title}${ansi.reset}` : title);
    lines.push('');
  }
  lines.push(useAnsi ? `${ansi.bold}${header}${ansi.reset}` : header);
  lines.push(useAnsi ? `${ansi.dim}${sep}${ansi.reset}` : sep);

  for (const row of rows) {
    lines.push(keys.map((k, i) => pad(row[k], widths[i])).join('  '));
  }
  return lines.join('\n');
}

function renderMarkdown(rows, keys, title) {
  const lines = [];
  if (title) { lines.push(`## ${title}`, ''); }
  lines.push(`| ${keys.join(' | ')} |`);
  lines.push(`| ${keys.map(() => '---').join(' | ')} |`);
  for (const row of rows) {
    lines.push(`| ${keys.map(k => row[k] == null ? '' : String(row[k])).join(' | ')} |`);
  }
  return lines.join('\n');
}

/** Returns true if --json flag present. */
function shouldUseJson(argv) {
  argv = argv || process.argv;
  if (argv.includes('--json')) return true;
  if (argv.some(a => a.startsWith('--format=json'))) return true;
  return false;
}

module.exports = { render, shouldUseJson };
