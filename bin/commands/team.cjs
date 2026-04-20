'use strict';
/**
 * gad team — thin aggregator. One-concern-per-file discipline:
 * each subcommand lives in bin/commands/team/<name>.cjs, this file
 * only wires them into a single `team` defineCommand. Libraries are
 * under lib/team/.
 *
 * Design: .planning/notes/2026-04-20-gad-team-mailbox-design.md
 */

const { defineCommand } = require('citty');

const { createStartCommand }    = require('./team/start.cjs');
const { createStopCommand }     = require('./team/stop.cjs');
const { createStatusCommand }   = require('./team/status.cjs');
const { createEnqueueCommand }  = require('./team/enqueue.cjs');
const { createDispatchCommand } = require('./team/dispatch.cjs');
const { createWorkCommand }     = require('./team/work.cjs');
const { createTailCommand }     = require('./team/tail.cjs');
const { createRestartCommand }  = require('./team/restart.cjs');
const { createProfileCommand }  = require('./team/profile.cjs');

function createTeamCommands(deps) {
  return defineCommand({
    meta: { name: 'team', description: 'Multi-agent orchestration via mailbox queue. See .planning/notes/2026-04-20-gad-team-mailbox-design.md' },
    subCommands: {
      start:    createStartCommand(deps),
      stop:     createStopCommand(deps),
      status:   createStatusCommand(deps),
      enqueue:  createEnqueueCommand(deps),
      dispatch: createDispatchCommand(deps),
      work:     createWorkCommand(deps),
      tail:     createTailCommand(deps),
      restart:  createRestartCommand(deps),
      profile:  createProfileCommand(deps),
    },
  });
}

module.exports = { createTeamCommands };
module.exports.register = (ctx) => ({ team: createTeamCommands(ctx.common) });
