'use strict';
/**
 * lib/team/paths.cjs — path helpers for the .planning/team/ layout.
 * Every other team module derives its paths from here. No writes.
 *
 * Layout (rooted at baseDir):
 *   .planning/team/
 *     config.json
 *     supervisor.log.jsonl
 *     dispatch.seq
 *     workers/<id>/
 *       status.json
 *       mailbox/
 *       out/
 *       log.jsonl
 *       stop.flag
 *     profiles/<name>.json
 *     locks/
 */

const path = require('path');

const TEAM_DIR = path.join('.planning', 'team');
const WORKERS_DIR = path.join(TEAM_DIR, 'workers');
const PROFILES_DIR = path.join(TEAM_DIR, 'profiles');
const LOCKS_DIR = path.join(TEAM_DIR, 'locks');

function teamRoot(baseDir) { return path.join(baseDir, TEAM_DIR); }
function workersRoot(baseDir) { return path.join(baseDir, WORKERS_DIR); }
function profilesRoot(baseDir) { return path.join(baseDir, PROFILES_DIR); }
function locksRoot(baseDir) { return path.join(baseDir, LOCKS_DIR); }

function workerDir(baseDir, id) { return path.join(baseDir, WORKERS_DIR, id); }
function configPath(baseDir) { return path.join(teamRoot(baseDir), 'config.json'); }
function supervisorLog(baseDir) { return path.join(teamRoot(baseDir), 'supervisor.log.jsonl'); }
function dispatchSeqPath(baseDir) { return path.join(teamRoot(baseDir), 'dispatch.seq'); }
function stopFlagPath(baseDir, id) { return path.join(workerDir(baseDir, id), 'stop.flag'); }
function workerLog(baseDir, id) { return path.join(workerDir(baseDir, id), 'log.jsonl'); }
function workerStatus(baseDir, id) { return path.join(workerDir(baseDir, id), 'status.json'); }
function workerMailbox(baseDir, id) { return path.join(workerDir(baseDir, id), 'mailbox'); }
function workerOutDir(baseDir, id) { return path.join(workerDir(baseDir, id), 'out'); }
function profilePath(baseDir, name) { return path.join(profilesRoot(baseDir), `${name}.json`); }

module.exports = {
  TEAM_DIR, WORKERS_DIR, PROFILES_DIR, LOCKS_DIR,
  teamRoot, workersRoot, profilesRoot, locksRoot,
  workerDir, configPath, supervisorLog, dispatchSeqPath,
  stopFlagPath, workerLog, workerStatus, workerMailbox, workerOutDir,
  profilePath,
};
