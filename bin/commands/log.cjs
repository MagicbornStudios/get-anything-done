'use strict';
/**
 * gad log — inspect CLI call logs
 *
 * Required deps: getLogDir, resolveOrDefaultEvalProjectDir
 */

const path = require('path');
const fs = require('fs');
const { defineCommand } = require('citty');

function createLogCommand(deps) {
  const { getLogDir, resolveOrDefaultEvalProjectDir } = deps;

  const show = defineCommand({
    meta: { name: 'show', description: 'Show recent CLI call log entries' },
    args: {
      n: { type: 'string', description: 'Number of entries to show (default: 20)', default: '20' },
      date: { type: 'string', description: 'Date to show (YYYY-MM-DD, default: today)', default: '' },
      eval: { type: 'string', description: 'Show logs from an eval run directory', default: '' },
      filter: { type: 'string', description: 'Filter: cli, tool, gad, skill, agent (default: all)', default: '' },
    },
    run({ args }) {
      let logDir;
      if (args.eval) {
        logDir = resolveOrDefaultEvalProjectDir(args.eval);
        if (fs.existsSync(logDir)) {
          const versions = fs.readdirSync(logDir).filter(n => /^v\d+$/.test(n)).sort();
          for (let i = versions.length - 1; i >= 0; i--) {
            const candidate = path.join(logDir, versions[i], '.gad-log');
            if (fs.existsSync(candidate)) { logDir = candidate; break; }
          }
        }
      } else {
        logDir = getLogDir();
      }

      if (!logDir || !fs.existsSync(logDir)) { console.log('No log directory found. CLI logging starts on first gad command.'); return; }

      const dateStr = args.date || new Date().toISOString().slice(0, 10);
      const logFile = path.join(logDir, `${dateStr}.jsonl`);

      if (!fs.existsSync(logFile)) {
        const files = fs.readdirSync(logDir).filter(f => f.endsWith('.jsonl')).sort();
        if (files.length === 0) { console.log('No log files found.'); return; }
        console.log(`No log for ${dateStr}. Available dates:`);
        for (const f of files) console.log(`  ${f.replace('.jsonl', '')}`);
        return;
      }

      const lines = fs.readFileSync(logFile, 'utf8').trim().split('\n').filter(Boolean);
      let allEntries = lines.map(l => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);

      const filter = args.filter;
      if (filter === 'cli') allEntries = allEntries.filter(e => e.cmd);
      else if (filter === 'tool') allEntries = allEntries.filter(e => e.type === 'tool_call');
      else if (filter === 'gad') allEntries = allEntries.filter(e => e.gad_command || (e.cmd && !e.type));
      else if (filter === 'skill') allEntries = allEntries.filter(e => e.skill);
      else if (filter === 'agent') allEntries = allEntries.filter(e => e.tool === 'Agent');

      const n = parseInt(args.n) || 20;
      const entries = allEntries.slice(-n);

      for (const e of entries) {
        const time = e.ts ? e.ts.slice(11, 19) : '?';
        if (e.type === 'tool_call') {
          const tool = (e.tool || '?').padEnd(6);
          const summary = e.gad_command ? `gad ${e.gad_command}` :
                          e.skill ? `skill:${e.skill}` :
                          e.agent_type ? `agent:${e.agent_type} ${e.agent_description || ''}` :
                          (e.input_summary || '').slice(0, 80);
          console.log(`  ◆ ${time}  ${tool}  ${summary}`);
        } else if (e.cmd) {
          const dur = e.duration_ms != null ? `${e.duration_ms}ms` : '?';
          const exit = e.exit || 0;
          const mark = exit === 0 ? '✓' : '✗';
          console.log(`  ${mark} ${time}  ${dur.padStart(7)}  gad ${e.cmd}`);
          if (e.summary) console.log(`    ${e.summary}`);
        }
      }

      const cliCalls = entries.filter(e => e.cmd);
      const toolCalls = entries.filter(e => e.type === 'tool_call');
      console.log(`\n${entries.length} entries (${cliCalls.length} CLI, ${toolCalls.length} tool) — ${logFile}`);
    },
  });

  const stats = defineCommand({
    meta: { name: 'stats', description: 'Show CLI usage statistics' },
    args: { days: { type: 'string', description: 'Number of days to analyze (default: 7)', default: '7' } },
    run({ args }) {
      const logDir = getLogDir();
      if (!logDir || !fs.existsSync(logDir)) { console.log('No log directory found.'); return; }

      const days = parseInt(args.days) || 7;
      const files = fs.readdirSync(logDir).filter(f => f.endsWith('.jsonl')).sort().slice(-days);

      const cmdCounts = {}; const toolCounts = {};
      let cliCalls = 0, toolCalls = 0, totalDuration = 0, failures = 0, skillTriggers = 0, agentSpawns = 0;

      for (const f of files) {
        const lines = fs.readFileSync(path.join(logDir, f), 'utf8').trim().split('\n').filter(Boolean);
        for (const line of lines) {
          try {
            const e = JSON.parse(line);
            if (e.type === 'tool_call') {
              toolCalls++;
              toolCounts[e.tool] = (toolCounts[e.tool] || 0) + 1;
              if (e.skill) skillTriggers++;
              if (e.tool === 'Agent') agentSpawns++;
            } else if (e.cmd) {
              cliCalls++;
              totalDuration += e.duration_ms || 0;
              if (e.exit && e.exit !== 0) failures++;
              const parts = (e.cmd || '').split(' ');
              const key = parts.slice(0, 2).join(' ');
              cmdCounts[key] = (cmdCounts[key] || 0) + 1;
            }
          } catch {}
        }
      }

      console.log(`\nGAD Usage (last ${files.length} day(s))\n`);
      console.log(`  CLI calls:      ${cliCalls}`);
      console.log(`  Tool calls:     ${toolCalls}`);
      console.log(`  Skill triggers: ${skillTriggers}`);
      console.log(`  Agent spawns:   ${agentSpawns}`);
      console.log(`  CLI failures:   ${failures}`);
      console.log(`  CLI duration:   ${(totalDuration / 1000).toFixed(1)}s (avg ${cliCalls > 0 ? Math.round(totalDuration / cliCalls) : 0}ms)`);

      const sortedCmd = Object.entries(cmdCounts).sort((a, b) => b[1] - a[1]);
      if (sortedCmd.length > 0) {
        console.log(`\n  Top GAD commands:`);
        for (const [cmd, count] of sortedCmd.slice(0, 10)) console.log(`    ${String(count).padStart(4)}×  gad ${cmd}`);
      }

      const sortedTool = Object.entries(toolCounts).sort((a, b) => b[1] - a[1]);
      if (sortedTool.length > 0) {
        console.log(`\n  Tool call breakdown:`);
        for (const [tool, count] of sortedTool) console.log(`    ${String(count).padStart(4)}×  ${tool}`);
      }
    },
  });

  const clear = defineCommand({
    meta: { name: 'clear', description: 'Clear old log files (keeps last 7 days)' },
    args: { keep: { type: 'string', description: 'Days to keep (default: 7)', default: '7' } },
    run({ args }) {
      const logDir = getLogDir();
      if (!logDir || !fs.existsSync(logDir)) { console.log('No log directory found.'); return; }

      const keep = parseInt(args.keep) || 7;
      const files = fs.readdirSync(logDir).filter(f => f.endsWith('.jsonl')).sort();
      const toDelete = files.slice(0, -keep);

      for (const f of toDelete) fs.unlinkSync(path.join(logDir, f));
      console.log(`Cleared ${toDelete.length} log file(s), kept ${Math.min(files.length, keep)}.`);
    },
  });

  return defineCommand({
    meta: { name: 'log', description: 'Inspect CLI call logs — usage stats, recent calls, eval logs' },
    subCommands: { show, stats, clear },
  });
}

module.exports = { createLogCommand };
