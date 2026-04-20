'use strict';
/**
 * `gad eval trace …` subcommand family.
 * Subcommands: list, show, diff, report, write, init, log-cmd, log-skill,
 *   finalize, reconstruct, from-log
 *
 * Required deps: listAllEvalProjects, listEvalProjectsHint,
 *   resolveOrDefaultEvalProjectDir, outputError, output, shouldUseJson,
 *   summarizeAgentLineage, detectRuntimeIdentity, readXmlFile, findRepoRoot,
 *   pkg.
 */

const fs = require('fs');
const path = require('path');
const { defineCommand } = require('citty');
const {
  FIDELITY_SCORE,
  loadTrace,
  computeCompleteness,
} = require('../../lib/eval-trace-core.cjs');
const { createEvalTraceListCommand } = require('./eval-trace/list.cjs');
const { createEvalTraceShowCommand } = require('./eval-trace/show.cjs');
const { createEvalTraceDiffCommand } = require('./eval-trace/diff.cjs');
const { createEvalTraceReportCommand } = require('./eval-trace/report.cjs');
const {
  createEvalTraceWriteCommand,
  createEvalTraceInitCommand,
  createEvalTraceLogCmdCommand,
  createEvalTraceLogSkillCommand,
  createEvalTraceFinalizeCommand,
} = require('./eval-trace/lifecycle.cjs');
const { createEvalTraceReconstructCommand } = require('./eval-trace/reconstruct.cjs');
const { createEvalTraceFromLogCommand } = require('./eval-trace/from-log.cjs');

function createEvalTraceCommand(deps) {
  const {
    listAllEvalProjects,
    listEvalProjectsHint,
    resolveOrDefaultEvalProjectDir,
    outputError,
    output,
    shouldUseJson,
    summarizeAgentLineage,
    detectRuntimeIdentity,
    readXmlFile,
    findRepoRoot,
    pkg,
  } = deps;

  const evalTraceList = createEvalTraceListCommand({
    listAllEvalProjects,
    outputError,
    output,
  });
  const evalTraceShow = createEvalTraceShowCommand({
    listEvalProjectsHint,
    resolveOrDefaultEvalProjectDir,
    outputError,
    output,
    shouldUseJson,
  });
  const evalTraceDiff = createEvalTraceDiffCommand({
    listEvalProjectsHint,
    resolveOrDefaultEvalProjectDir,
    outputError,
    output,
  });
  const evalTraceReport = createEvalTraceReportCommand({
    listEvalProjectsHint,
    resolveOrDefaultEvalProjectDir,
    outputError,
    output,
    shouldUseJson,
  });
  const evalTraceWrite = createEvalTraceWriteCommand({
    listEvalProjectsHint,
    resolveOrDefaultEvalProjectDir,
    outputError,
  });

  const evalTraceInit = createEvalTraceInitCommand({
    listEvalProjectsHint,
    resolveOrDefaultEvalProjectDir,
    outputError,
    detectRuntimeIdentity,
    summarizeAgentLineage,
    pkg,
  });

  const evalTraceLogCmd = createEvalTraceLogCmdCommand({
    resolveOrDefaultEvalProjectDir,
    outputError,
  });

  const evalTraceLogSkill = createEvalTraceLogSkillCommand({
    resolveOrDefaultEvalProjectDir,
    outputError,
  });

  const evalTraceFinalize = createEvalTraceFinalizeCommand({
    listEvalProjectsHint,
    resolveOrDefaultEvalProjectDir,
    outputError,
  });
  const evalTraceReconstruct = createEvalTraceReconstructCommand({
    listEvalProjectsHint,
    resolveOrDefaultEvalProjectDir,
    outputError,
    readXmlFile,
    findRepoRoot,
  });
  const evalTraceFromLog = createEvalTraceFromLogCommand({
    listEvalProjectsHint,
    resolveOrDefaultEvalProjectDir,
    outputError,
    summarizeAgentLineage,
    pkg,
  });
  const evalTraceCmd = defineCommand({
    meta: { name: 'trace', description: 'Inspect and compare eval traces (TRACE.json)' },
    subCommands: {
      list: evalTraceList, show: evalTraceShow, diff: evalTraceDiff, report: evalTraceReport,
      write: evalTraceWrite, init: evalTraceInit, 'log-cmd': evalTraceLogCmd, 'log-skill': evalTraceLogSkill,
      finalize: evalTraceFinalize, reconstruct: evalTraceReconstruct, 'from-log': evalTraceFromLog,
    },
  });

  return { evalTraceCmd };
}

module.exports = { createEvalTraceCommand };
module.exports.provides = (ctx) => createEvalTraceCommand(ctx.common);
