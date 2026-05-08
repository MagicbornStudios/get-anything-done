'use strict';
/**
 * lib/snapshot-agent-presence-section.cjs — AGENT PRESENCE snapshot section.
 *
 * Reads .planning/.presence/*.json (cross-root scan) and renders a table
 * of live and recently-idle agents. Live = last_heartbeat within 5 min.
 *
 * GLOBAL-D-323 Phase B.
 */

const { scan, ageLabel, LIVE_THRESHOLD_S } = require('./agent-presence.cjs');

/**
 * Build the AGENT PRESENCE snapshot section.
 *
 * @param {object} opts
 * @param {string}  opts.baseDir  - repo root
 * @param {object} [opts.config]  - parsed gad-config (for multi-root scan)
 * @returns {{ title: string, content: string } | null}
 */
function buildAgentPresenceSection({ baseDir, config }) {
  let entries;
  try {
    entries = scan(baseDir, config);
  } catch {
    return null;
  }

  if (entries.length === 0) return null;

  const liveCount = entries.filter((e) => e.live).length;
  const idleCount = entries.length - liveCount;

  // Column widths (fixed) — keep under ~100 chars total
  const COL = {
    slug:      24,
    project:   18,
    runtime:   13,
    model:     22,
    lastSeen:  10,
    focus:     0,   // remainder
  };

  function pad(str, len) {
    const s = String(str || '');
    return s.length > len ? s.slice(0, len - 1) + '…' : s.padEnd(len);
  }

  const header = [
    pad('AGENT_SLUG',   COL.slug),
    pad('PROJECT',      COL.project),
    pad('RUNTIME',      COL.runtime),
    pad('MODEL',        COL.model),
    pad('LAST_SEEN',    COL.lastSeen),
    'FOCUS',
  ].join('  ');

  const rows = entries.map((e) => {
    const r = e.record;
    const focus = r.current_focus_route || r.current_focus_cid || r.active_skill || '';
    return [
      pad(r.agent_slug,  COL.slug),
      pad(r.projectid,   COL.project),
      pad(r.runtime,     COL.runtime),
      pad(r.model,       COL.model),
      pad(ageLabel(e.ageSeconds), COL.lastSeen),
      focus,
    ].join('  ').trimEnd();
  });

  const content = [header, ...rows].join('\n');
  const title   = `AGENT PRESENCE (${liveCount} live, ${idleCount} idle)`;

  return { title, content };
}

module.exports = { buildAgentPresenceSection };
