'use strict';

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { defineCommand } = require('citty');

/**
 * gad kael — wrapper for slm-learning/scripts/kael/kael.py.
 * 
 * Part of Phase 145 (Kael MVP). Routes intents to the SLM training lab
 * and enforces local permission policies.
 */
function createKaelCommand(deps) {
  const { findRepoRoot, outputError, getLastActiveProjectid } = deps;

  const runKaelSubcommand = (subcmd, args, options = {}) => {
    const baseDir = findRepoRoot();
    const projectid = options.projectid || (getLastActiveProjectid ? getLastActiveProjectid() : 'global') || 'global';
    
    // C — Permission policy enforcement
    const homeDir = process.env.HOME || process.env.USERPROFILE || process.env.HOMEPATH;
    const permissionsPath = path.join(homeDir, '.gad', 'kael', 'permissions.json');
    let permissions = {};
    if (fs.existsSync(permissionsPath)) {
      try {
        permissions = JSON.parse(fs.readFileSync(permissionsPath, 'utf8'));
      } catch (e) {
        // Warning only, don't block
        console.warn(`Warning: Failed to parse permissions at ${permissionsPath}: ${e.message}`);
      }
    }

    // Refuse any non-interactive --yes for blast_radius=high actions
    // (High-level check, actual enforcement often happens in the script too)
    const isHighBlast = args.some(a => a.includes('blast_radius=high') || a.includes('--high-blast'));
    const isNonInteractive = args.includes('--yes') || args.includes('-y');
    if (isHighBlast && isNonInteractive) {
       outputError('Refusing non-interactive execution for high blast_radius action.');
       process.exit(1);
    }

    // Log approval prompt / invocation to .planning/.gad-log/<date>-kael.jsonl
    const logDir = path.join(baseDir, '.planning', '.gad-log');
    const today = new Date().toISOString().split('T')[0];
    const kaelLogPath = path.join(logDir, `${today}-kael.jsonl`);
    try {
      fs.mkdirSync(logDir, { recursive: true });
      const logEntry = {
        ts: new Date().toISOString(),
        kind: 'kael-invocation',
        subcommand: subcmd,
        args,
        projectid,
        cwd: process.cwd()
      };
      fs.appendFileSync(kaelLogPath, JSON.stringify(logEntry) + '\n');
    } catch (err) {
      // Don't block if logging fails
    }

    // Intent classifier vs router decision log
    try {
      const { logRoutingDecision } = require('../../lib/routing/decision-log.cjs');
      logRoutingDecision(baseDir, {
        task: `kael ${subcmd}`,
        task_shape: 'cli-translation', 
        chosen_runtime: 'local-slm',
        reason: ['kael-wrapper'],
        project_id: projectid,
        outcome: 'success'
      });
    } catch (err) {
      // lib not found or failed, continue
    }

    // Subprocess-call the slm-learning Python script
    const pythonScript = path.resolve(baseDir, '..', 'slm_learning', 'scripts', 'kael', 'kael.py');
    if (!fs.existsSync(pythonScript)) {
      outputError(`Kael script not found at ${pythonScript}. Ensure slm-learning is installed as a sibling.`);
      process.exit(1);
    }
    
    const pythonCmd = process.platform === 'win32' ? 'python' : 'python3';
    
    const result = spawnSync(pythonCmd, [pythonScript, subcmd, ...args], {
      stdio: 'inherit',
      env: {
        ...process.env,
        GAD_PROJECT_ID: projectid
      }
    });

    if (result.error) {
      outputError(`Failed to execute Kael script: ${result.error.message}`);
      process.exit(1);
    }
    
    process.exit(result.status ?? 0);
  };

  return defineCommand({
    meta: { name: 'kael', description: 'Kael SLM assistant — wrap slm-learning/scripts/kael/kael.py' },
    args: {
      projectid: { type: 'string', description: 'Project ID', default: '' }
    },
    subCommands: {
      ask: defineCommand({
        meta: { name: 'ask', description: 'Ask Kael a question' },
        args: { query: { type: 'positional', required: true } },
        run({ args }) { runKaelSubcommand('ask', [args.query], args); }
      }),
      note: defineCommand({
        meta: { name: 'note', description: 'Take a note with Kael' },
        args: { content: { type: 'positional', required: true } },
        run({ args }) { runKaelSubcommand('note', [args.content], args); }
      }),
      snapshot: defineCommand({
        meta: { name: 'snapshot', description: 'Take a Kael snapshot' },
        run({ args }) { runKaelSubcommand('snapshot', [], args); }
      }),
      queue: defineCommand({
        meta: { name: 'queue', description: 'Show Kael training queue' },
        run({ args }) { runKaelSubcommand('queue', [], args); }
      }),
      route: defineCommand({
        meta: { name: 'route', description: 'Route an intent with Kael' },
        args: { intent: { type: 'positional', required: true } },
        run({ args }) { runKaelSubcommand('route', [args.intent], args); }
      }),
      approve: defineCommand({
        meta: { name: 'approve', description: 'Approve a Kael action' },
        args: { actionId: { type: 'positional', required: true } },
        run({ args }) { runKaelSubcommand('approve', [args.actionId], args); }
      }),
      daemon: defineCommand({
        meta: { name: 'daemon', description: 'Manage Kael daemon (K4 placeholder)' },
        args: { action: { type: 'positional', required: true } },
        run({ args }) {
          outputError('Kael daemon (K4) is refused for now.');
          process.exit(1);
        }
      })
    }
  });
}

module.exports = { createKaelCommand };
module.exports.register = (ctx) => {
  const cmd = createKaelCommand(ctx.common);
  return { kael: cmd };
};
