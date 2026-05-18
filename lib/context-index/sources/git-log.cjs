'use strict';
/**
 * sources/git-log.cjs — parse git log into events
 */

const { spawnSync } = require('node:child_process');

/**
 * @param {string} projectRoot
 * @param {object} opts
 * @param {string|null} opts.since  ISO timestamp
 * @param {number} opts.limit  max commits (default 500)
 * @returns {Array<{id,text,source,ts,sessionId}>}
 */
function ingestGitLog(projectRoot, opts = {}) {
  const limit = opts.limit || 500;
  const args = [
    'log',
    `--pretty=format:%H|%ci|%s`,
    `-n`, String(limit),
  ];
  if (opts.since) {
    args.push(`--since=${opts.since}`);
  }

  const result = spawnSync('git', args, {
    cwd: projectRoot,
    encoding: 'utf8',
    windowsHide: true,
  });

  if (result.error || result.status !== 0) return [];

  const records = [];
  const lines = (result.stdout || '').split('\n').filter(l => l.trim());

  for (const line of lines) {
    const firstPipe = line.indexOf('|');
    const secondPipe = line.indexOf('|', firstPipe + 1);
    if (firstPipe < 0 || secondPipe < 0) continue;

    const hash = line.slice(0, firstPipe).trim();
    const ts = line.slice(firstPipe + 1, secondPipe).trim();
    const subject = line.slice(secondPipe + 1).trim();
    if (!subject) continue;

    records.push({
      id: `git-log:${hash}`,
      text: `commit ${hash.slice(0, 8)}: ${subject}`,
      source: 'git-log',
      ts: new Date(ts).toISOString(),
      sessionId: null,
    });
  }

  return records;
}

module.exports = { ingestGitLog };
