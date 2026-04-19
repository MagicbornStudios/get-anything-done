'use strict';
/**
 * gad rounds — query experiment round data
 *
 * Required deps: outputError, resolveOrDefaultEvalProjectDir, defaultEvalsDir
 */

const path = require('path');
const fs = require('fs');
const { defineCommand } = require('citty');

function createRoundsCommand(deps) {
  const { outputError, resolveOrDefaultEvalProjectDir, defaultEvalsDir } = deps;

  return defineCommand({
    meta: { name: 'rounds', description: 'List and query experiment rounds from EXPERIMENT-LOG.md (or per-project from TRACE.json)' },
    args: {
      round: { type: 'string', description: 'Show a specific round (e.g. "3")', default: '' },
      project: { type: 'string', description: 'Show rounds for a specific eval project (derived from TRACE.json requirements_version changes)', default: '' },
      json: { type: 'boolean', description: 'Output as JSON', default: false },
    },
    run({ args }) {
      if (args.project) {
        const projectDir = resolveOrDefaultEvalProjectDir(args.project);
        if (!fs.existsSync(projectDir)) { outputError(`Eval project '${args.project}' not found.`); return; }
        const versions = fs.readdirSync(projectDir)
          .filter(n => /^v\d+$/.test(n))
          .sort((a, b) => parseInt(a.slice(1)) - parseInt(b.slice(1)));
        if (versions.length === 0) { outputError(`No runs found for project '${args.project}'.`); return; }

        const runs = [];
        for (const v of versions) {
          const tracePath = path.join(projectDir, v, 'TRACE.json');
          let trace = null;
          try { if (fs.existsSync(tracePath)) trace = JSON.parse(fs.readFileSync(tracePath, 'utf8')); } catch {}
          const reqVer = trace?.requirements_version || 'unknown';
          const date = trace?.date || null;
          const composite = trace?.scores?.composite ?? null;
          const humanReview = trace?.scores?.human_review ?? trace?.human_review?.score ?? null;
          const workflow = trace?.workflow || null;
          runs.push({ version: v, requirements_version: reqVer, date, composite, human_review: humanReview, workflow });
        }

        const rounds = [];
        let currentReqVer = null;
        let roundNum = 0;
        for (const run of runs) {
          if (run.requirements_version !== currentReqVer) {
            currentReqVer = run.requirements_version;
            roundNum++;
            rounds.push({ round: roundNum, requirements_version: currentReqVer, runs: [] });
          }
          rounds[rounds.length - 1].runs.push(run);
        }

        if (args.json) { console.log(JSON.stringify(rounds, null, 2)); return; }

        console.log(`Rounds for ${args.project} (${rounds.length} rounds, ${runs.length} runs)\n`);
        for (const r of rounds) {
          console.log(`Round ${r.round} — requirements ${r.requirements_version} (${r.runs.length} runs)`);
          const header = `  ${'VERSION'.padEnd(10)}${'DATE'.padEnd(14)}${'WORKFLOW'.padEnd(12)}${'COMPOSITE'.padEnd(12)}HUMAN`;
          console.log(header);
          console.log('  ' + '─'.repeat(header.length - 2));
          for (const run of r.runs) {
            const comp = run.composite != null ? run.composite.toFixed(3) : '—';
            const hr = run.human_review != null ? run.human_review.toFixed(2) : '—';
            console.log(`  ${run.version.padEnd(10)}${(run.date || '—').padEnd(14)}${(run.workflow || '—').padEnd(12)}${comp.padEnd(12)}${hr}`);
          }
          console.log('');
        }
        return;
      }

      const logFile = path.join(defaultEvalsDir(), 'EXPERIMENT-LOG.md');
      if (!fs.existsSync(logFile)) { outputError('No EXPERIMENT-LOG.md found in evals/'); return; }
      const content = fs.readFileSync(logFile, 'utf8');
      const roundRe = /^## (Round \d+)\s*—\s*(.+)$/gm;
      const rounds = [];
      let match;
      const indices = [];
      while ((match = roundRe.exec(content)) !== null) {
        indices.push({ start: match.index, label: match[1], title: match[2].trim() });
      }
      for (let i = 0; i < indices.length; i++) {
        const start = indices[i].start;
        const end = i + 1 < indices.length ? indices[i + 1].start : content.length;
        const body = content.slice(start, end).trim();
        const dateMatch = body.match(/\*\*Date:\*\*\s*(.+)/);
        const reqMatch = body.match(/\*\*Requirements version:\*\*\s*(.+)/);
        const condMatch = body.match(/\*\*Conditions?:\*\*\s*(.+)/);
        rounds.push({
          round: indices[i].label,
          number: parseInt(indices[i].label.replace('Round ', ''), 10),
          title: indices[i].title,
          date: dateMatch ? dateMatch[1].trim() : null,
          requirements: reqMatch ? reqMatch[1].trim() : null,
          conditions: condMatch ? condMatch[1].trim() : null,
          body: body,
        });
      }

      if (args.round) {
        const num = parseInt(args.round, 10);
        const r = rounds.find(r => r.number === num);
        if (!r) { outputError(`Round ${args.round} not found. Available: ${rounds.map(r => r.number).join(', ')}`); return; }
        if (args.json) console.log(JSON.stringify(r, null, 2));
        else console.log(r.body);
        return;
      }

      if (args.json) { console.log(JSON.stringify(rounds.map(({ body, ...r }) => r), null, 2)); return; }
      console.log(`Experiment Rounds (${rounds.length})\n`);
      const header = `${'ROUND'.padEnd(10)}${'TITLE'.padEnd(55)}${'DATE'.padEnd(25)}REQS`;
      console.log(header);
      console.log('─'.repeat(header.length));
      for (const r of rounds) {
        console.log(
          `${r.round.padEnd(10)}${(r.title || '').slice(0, 53).padEnd(55)}${(r.date || '—').slice(0, 23).padEnd(25)}${r.requirements || '—'}`
        );
      }
    },
  });
}

module.exports = { createRoundsCommand };
