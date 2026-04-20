'use strict';
/**
 * gad team tail — pretty-JSONL tail of a worker log, with follow.
 */

const fs = require('fs');
const { defineCommand } = require('citty');
const { workerLog } = require('../../../lib/team/paths.cjs');

function printLogLine(line) {
  try {
    const entry = JSON.parse(line);
    const ts = String(entry.ts || '').slice(11, 19);
    const kind = String(entry.kind || '?').padEnd(16);
    const ref = entry.ref ? ` ${entry.ref}` : '';
    const extra = entry.error ? ` ERROR=${entry.error}`
      : entry.exit_code != null ? ` exit=${entry.exit_code}`
      : entry.data ? ` ${String(entry.data).slice(0, 80).replace(/\n/g, '⏎')}`
      : '';
    console.log(`${ts} ${kind}${ref}${extra}`);
  } catch {
    console.log(line);
  }
}

function createTailCommand(deps) {
  const { findRepoRoot, outputError } = deps;
  return defineCommand({
    meta: { name: 'tail', description: 'Stream a worker log as pretty JSONL. Ctrl-C to stop.' },
    args: {
      'worker-id': { type: 'string', required: true },
      n: { type: 'string', default: '20', description: 'Last N lines to print before following' },
      follow: { type: 'boolean', default: true },
    },
    async run({ args }) {
      const baseDir = findRepoRoot();
      const id = String(args['worker-id']);
      const p = workerLog(baseDir, id);
      if (!fs.existsSync(p)) { outputError(`No log file yet: ${p}`); process.exit(1); }
      const buf = fs.readFileSync(p, 'utf8');
      const lines = buf.split(/\r?\n/).filter(Boolean);
      const n = Number.parseInt(String(args.n), 10) || 20;
      for (const line of lines.slice(-n)) printLogLine(line);
      if (!args.follow) return;
      let pos = Buffer.byteLength(buf, 'utf8');
      const watcher = fs.watch(p, { persistent: true }, () => {
        try {
          const stat = fs.statSync(p);
          if (stat.size <= pos) return;
          const fd = fs.openSync(p, 'r');
          const chunk = Buffer.alloc(stat.size - pos);
          fs.readSync(fd, chunk, 0, chunk.length, pos);
          fs.closeSync(fd);
          pos = stat.size;
          for (const line of chunk.toString('utf8').split(/\r?\n/).filter(Boolean)) printLogLine(line);
        } catch {}
      });
      await new Promise(resolve => {
        process.on('SIGINT', () => { try { watcher.close(); } catch {}; resolve(); });
      });
    },
  });
}

module.exports = { createTailCommand };
