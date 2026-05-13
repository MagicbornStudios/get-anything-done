'use strict';

const fs = require('fs');
const path = require('path');
const { defineCommand } = require('citty');
const { loadState, saveState, acquirePidLock, releasePidLock, writeHeartbeat } = require('../../../lib/delta-train/state.cjs');

/**
 * Persistent daemon for the delta-training loop.
 */
module.exports = defineCommand({
  meta: {
    name: 'daemon',
    description: 'Start the persistent delta-training daemon.',
  },
  args: {
    interval: { type: 'string', description: 'Poll interval (e.g. 30s, 5m, 1h). Default 30m.', default: '30m' },
    'max-ticks': { type: 'string', description: 'Optional limit on number of ticks to run' },
    projectid: { type: 'string', description: 'Project to run for', default: 'global' },
  },
  async run({ args }) {
    const baseDir = process.cwd();
    
    // 1. Acquire PID lock
    const lock = acquirePidLock(baseDir);
    if (!lock.success) {
      console.error(`[delta-train] Daemon already running with PID ${lock.pid}`);
      process.exit(1);
    }

    console.log(`[delta-train] Daemon started with PID ${process.pid}`);

    function parseInterval(s) {
      const m = s.match(/^(\d+)([smh])$/);
      if (!m) return 1800000; // 30m default
      const val = parseInt(m[1], 10);
      const unit = m[2];
      if (unit === 's') return val * 1000;
      if (unit === 'm') return val * 60 * 1000;
      if (unit === 'h') return val * 60 * 60 * 1000;
      return 1800000;
    }

    const intervalMs = parseInterval(args.interval);
    const maxTicks = args['max-ticks'] ? parseInt(args['max-ticks'], 10) : null;
    let tickCount = 0;
    let running = true;

    // 2. Setup signal handlers
    process.on('SIGTERM', () => {
      console.log('[delta-train] Received SIGTERM. Shutting down gracefully...');
      running = false;
    });
    process.on('SIGINT', () => {
      console.log('[delta-train] Received SIGINT. Shutting down gracefully...');
      running = false;
    });

    // 3. Main loop
    const { run: runTick } = require('./tick.cjs');

    while (running) {
      const state = loadState(baseDir);
      state.loop_started_at = state.loop_started_at || new Date().toISOString();
      state.interval_seconds = intervalMs / 1000;
      saveState(baseDir, state);

      try {
        await runTick({ args: { 'dry-run': false, projectid: args.projectid } });
      } catch (e) {
        console.error(`[delta-train] Tick failed: ${e.message}`);
      }

      tickCount += 1;
      if (maxTicks && tickCount >= maxTicks) {
        console.log(`[delta-train] Reached max-ticks (${maxTicks}). Stopping.`);
        break;
      }

      if (!running) break;

      const nextTickAt = new Date(Date.now() + intervalMs).toISOString();
      const s = loadState(baseDir);
      s.next_tick_at = nextTickAt;
      saveState(baseDir, s);

      console.log(`[delta-train] Sleeping for ${intervalMs / 1000}s. Next tick at ${nextTickAt}`);
      
      // Heartbeat during sleep
      const sleepStart = Date.now();
      while (Date.now() - sleepStart < intervalMs && running) {
        writeHeartbeat(baseDir, { phase: 'sleeping' });
        await new Promise((res) => setTimeout(res, 30000));
      }
    }

    releasePidLock(baseDir);
    console.log('[delta-train] Daemon stopped.');
  },
});
