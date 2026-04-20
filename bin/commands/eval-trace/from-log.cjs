'use strict';

const fs = require('fs');
const path = require('path');
const { defineCommand } = require('citty');

function createEvalTraceFromLogCommand({
  listEvalProjectsHint,
  resolveOrDefaultEvalProjectDir,
  outputError,
  summarizeAgentLineage,
  pkg,
}) {
  return defineCommand({
    meta: { name: 'from-log', description: 'Build TRACE.json from actual JSONL call logs (definitive, not git-reconstructed)' },
    args: {
      project: { type: 'string', description: 'Eval project name', default: '' },
      version: { type: 'string', description: 'Version (default: latest)', default: '' },
    },
    run({ args }) {
      if (!args.project) { listEvalProjectsHint(); return; }
      const projectDir = resolveOrDefaultEvalProjectDir(args.project);

      if (!fs.existsSync(projectDir)) outputError(`Eval project '${args.project}' not found.`);

      const versions = fs.readdirSync(projectDir)
        .filter((n) => /^v\d+$/.test(n))
        .sort((a, b) => parseInt(a.slice(1)) - parseInt(b.slice(1)));
      const version = args.version || versions[versions.length - 1];
      if (!version) outputError('No eval runs found.');

      const runDir = path.join(projectDir, version);
      const logDir = path.join(runDir, '.gad-log');

      if (!fs.existsSync(logDir)) {
        console.log(`No .gad-log/ directory in ${version}. Set GAD_LOG_DIR during eval runs.`);
        console.log(`Falling back to git-based reconstruction: gad eval trace reconstruct --project ${args.project}`);
        return;
      }

      const logFiles = fs.readdirSync(logDir).filter((f) => f.endsWith('.jsonl')).sort();
      const entries = [];
      for (const f of logFiles) {
        const lines = fs.readFileSync(path.join(logDir, f), 'utf8').trim().split('\n').filter(Boolean);
        for (const line of lines) {
          try { entries.push(JSON.parse(line)); } catch {}
        }
      }

      if (entries.length === 0) { console.log('Log files exist but contain no entries.'); return; }

      const gadCommands = entries.filter((e) => e.cmd || e.gad_command);
      const toolCalls = entries.filter((e) => e.type === 'tool_call');
      const skillTriggers = entries.filter((e) => e.skill);
      const agentSpawns = entries.filter((e) => e.tool === 'Agent');
      const bashCalls = entries.filter((e) => e.tool === 'Bash');
      const readCalls = entries.filter((e) => e.tool === 'Read');
      const writeCalls = entries.filter((e) => e.tool === 'Write');
      const editCalls = entries.filter((e) => e.tool === 'Edit');
      const runtimeCounts = new Map();
      for (const entry of entries) {
        const runtimeId = entry.runtime?.id || entry.runtime_id || 'unknown';
        runtimeCounts.set(runtimeId, (runtimeCounts.get(runtimeId) || 0) + 1);
      }
      const runtimeEntries = Array.from(runtimeCounts.entries()).sort((a, b) => b[1] - a[1]);
      const primaryRuntime = runtimeEntries[0]?.[0] || 'unknown';

      const timestamps = entries.map((e) => new Date(e.ts).getTime()).filter((t) => !isNaN(t));
      const startTime = timestamps.length > 0 ? new Date(Math.min(...timestamps)).toISOString() : null;
      const endTime = timestamps.length > 0 ? new Date(Math.max(...timestamps)).toISOString() : null;
      const durationMin = startTime && endTime ? Math.round((new Date(endTime) - new Date(startTime)) / 60000) : null;

      const gadCmdList = [];
      for (const e of entries) {
        const cmd = e.gad_command || e.cmd;
        if (cmd && (cmd.includes('snapshot') || cmd.includes('state') || cmd.includes('tasks')
            || cmd.includes('phases') || cmd.includes('decisions') || cmd.includes('eval')
            || cmd.includes('sprint') || cmd.includes('verify'))) {
          gadCmdList.push({ cmd, at: e.ts, duration_ms: e.duration_ms || 0 });
        }
      }

      const runtimeIdentity = {
        id: primaryRuntime,
        source: 'log-derived',
        model: entries.find((e) => e.runtime?.model)?.runtime?.model || null,
      };
      const runtimesInvolved = runtimeEntries.map(([id, count]) => ({ id, count }));
      const trace = {
        eval: args.project,
        version,
        date: new Date().toISOString().slice(0, 10),
        gad_version: pkg.version,
        source: 'call-log',
        trace_schema_version: 5,
        runtime_identity: runtimeIdentity,
        runtimes_involved: runtimesInvolved,
        agent_lineage: summarizeAgentLineage({ runtimeIdentity, runtimesInvolved }),
        timing: { started: startTime, ended: endTime, duration_minutes: durationMin },
        log_stats: {
          total_entries: entries.length,
          gad_cli_calls: gadCommands.length,
          tool_calls: toolCalls.length,
          skill_triggers: skillTriggers.length,
          agent_spawns: agentSpawns.length,
          bash_calls: bashCalls.length,
          read_calls: readCalls.length,
          write_calls: writeCalls.length,
          edit_calls: editCalls.length,
        },
        gad_commands: gadCmdList.slice(0, 50),
        skill_triggers: skillTriggers.map((e) => ({ skill: e.skill, args: e.skill_args || '', at: e.ts })),
        agent_spawns: agentSpawns.map((e) => ({
          type: e.agent_type,
          description: e.agent_description,
          background: e.agent_background,
          isolated: e.agent_isolated,
          at: e.ts,
        })),
      };

      const traceFile = path.join(runDir, 'TRACE.json');
      fs.writeFileSync(traceFile, JSON.stringify(trace, null, 2));

      console.log(`\nTrace built from logs: evals/${args.project}/${version}/TRACE.json`);
      console.log(`\n  Source:            call-log (${logFiles.length} file(s), ${entries.length} entries)`);
      console.log(`  Duration:          ${durationMin} min`);
      console.log(`  GAD CLI calls:     ${gadCommands.length}`);
      console.log(`  Tool calls:        ${toolCalls.length}`);
      console.log(`  Skill triggers:    ${skillTriggers.length}`);
      console.log(`  Agent spawns:      ${agentSpawns.length}`);
      console.log(`  Bash/Read/Write:   ${bashCalls.length}/${readCalls.length}/${writeCalls.length}`);
    },
  });
}

module.exports = { createEvalTraceFromLogCommand };
