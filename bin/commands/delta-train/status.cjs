'use strict';

const fs = require('fs');
const { defineCommand } = require('citty');
const { loadState } = require('../../../lib/delta-train/state.cjs');
const { heartbeatPath } = require('../../../lib/delta-train/paths.cjs');

module.exports = defineCommand({
  meta: {
    name: 'status',
    description: 'Show the current status of the delta-training daemon.',
  },
  args: {
    projectid: { type: 'string', description: 'Project to check', default: 'global' },
  },
  run({ args }) {
    const baseDir = process.cwd();
    const state = loadState(baseDir);
    const hbPath = heartbeatPath(baseDir);
    
    let heartbeat = null;
    if (fs.existsSync(hbPath)) {
      try {
        heartbeat = JSON.parse(fs.readFileSync(hbPath, 'utf8'));
      } catch (e) {}
    }

    const now = Date.now();
    const hbAge = heartbeat ? Math.round((now - Date.parse(heartbeat.wrote_at)) / 1000) : null;
    const isAlive = hbAge !== null && hbAge < (state.interval_seconds || 1800) * 2;

    console.log('\n=== Delta-Training Status ===\n');
    console.log(`Daemon:          ${isAlive ? 'ALIVE' : 'STOPPED'}${heartbeat ? ` (PID ${heartbeat.pid})` : ''}`);
    if (heartbeat) {
      console.log(`Phase:           ${heartbeat.phase}`);
      console.log(`Last Heartbeat:  ${heartbeat.wrote_at} (${hbAge}s ago)`);
    }
    console.log(`Loop Started:    ${state.loop_started_at || 'Never'}`);
    console.log(`Last Tick:       ${state.last_tick_at || 'Never'}`);
    console.log(`Next Tick:       ${state.next_tick_at || 'Never'}`);
    console.log(`Interval:        ${state.interval_seconds}s`);
    console.log(`Last Pull TS:    ${state.last_pull_ts || 'Never'}`);
    console.log(`Tick Count:      ${state.tick_count}`);
    console.log(`Promotions:      ${state.promotion_count}`);
    console.log(`Discards:        ${state.discard_count}`);
    console.log(`Skips:           ${state.skip_count}`);
    console.log(`Failures:        ${state.consecutive_failures}`);
    
    if (state.current_canonical) {
      console.log(`\nCanonical Model: ${state.current_canonical.model_id}`);
      console.log(`  Promoted:      ${state.current_canonical.promoted_at}`);
      console.log(`  Bench (SWE):   ${state.current_canonical.bench_score.swe}`);
    }
    console.log('');
  },
});
