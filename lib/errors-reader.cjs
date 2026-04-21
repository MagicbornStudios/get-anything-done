'use strict';
/**
 * errors-reader.cjs — parse ERRORS-AND-ATTEMPTS.xml into structured attempt objects.
 *
 * Supported schemas:
 *   1. Legacy attempt records
 *      <attempt id="..." phase="..." task="..." status="resolved|open|partial">
 *        <title>...</title>
 *        <symptom>...</symptom>
 *        <cause>...</cause>
 *        <attempted-fix>...</attempted-fix>
 *        <verification>
 *          <command>...</command>
 *        </verification>
 *      </attempt>
 *
 *   2. Current entry records
 *      <entry id="..." date="..." phase="..." status="open|resolved" blocks="05-07">
 *        <summary>...</summary>
 *        <context>...</context>
 *        <failure>...</failure>
 *        <rule>...</rule>
 *      </entry>
 */

const fs = require('fs');
const path = require('path');

/**
 * @typedef {{ id: string, phase: string, task: string, status: string, title: string, summary: string, symptom: string, cause: string, fix: string, commands: string[], date: string, blocks: string }} ErrorAttempt
 */

/**
 * Read error attempts for a single root.
 * @param {{ id: string, path: string, planningDir: string }} root
 * @param {string} baseDir
 * @param {{ status?: string, phase?: string, task?: string }} [filter]
 * @returns {ErrorAttempt[]}
 */
function readErrors(root, baseDir, filter = {}) {
  const xmlFile = path.join(baseDir, root.path, root.planningDir, 'ERRORS-AND-ATTEMPTS.xml');
  if (!fs.existsSync(xmlFile)) return [];
  return parseErrorsXml(fs.readFileSync(xmlFile, 'utf8'), filter);
}

function parseAttemptXml(content, filter) {
  const attempts = [];
  const attemptRe = /<attempt\s([^>]*)>([\s\S]*?)<\/attempt>/g;
  let m;
  while ((m = attemptRe.exec(content)) !== null) {
    const attrs = m[1];
    const body = m[2];

    const idMatch = attrs.match(/(?<![a-z-])id="([^"]*)"/);
    const phaseMatch = attrs.match(/\bphase="([^"]*)"/);
    const taskMatch = attrs.match(/\btask="([^"]*)"/);
    const statusMatch = attrs.match(/\bstatus="([^"]*)"/);

    const id = idMatch ? idMatch[1] : '';
    const phase = phaseMatch ? phaseMatch[1] : '';
    const task = taskMatch ? taskMatch[1] : '';
    const status = statusMatch ? statusMatch[1].toLowerCase() : 'open';

    if (!id) continue;
    if (filter.status && status !== filter.status.toLowerCase()) continue;
    if (filter.phase && phase !== filter.phase) continue;
    if (filter.task && task !== filter.task) continue;

    const titleMatch = body.match(/<title>([\s\S]*?)<\/title>/);
    const symptomMatch = body.match(/<symptom>([\s\S]*?)<\/symptom>/);
    const causeMatch = body.match(/<cause>([\s\S]*?)<\/cause>/);
    const fixMatch = body.match(/<attempted-fix>([\s\S]*?)<\/attempted-fix>/);

    const title = titleMatch ? titleMatch[1].trim() : '';
    const symptom = symptomMatch ? symptomMatch[1].trim() : '';
    const cause = causeMatch ? causeMatch[1].trim() : '';
    const fix = fixMatch ? fixMatch[1].trim() : '';

    const commands = [];
    const verifyMatch = body.match(/<verification>([\s\S]*?)<\/verification>/);
    if (verifyMatch) {
      const cmdRe = /<command>([\s\S]*?)<\/command>/g;
      let c;
      while ((c = cmdRe.exec(verifyMatch[1])) !== null) {
        const cmd = c[1].trim();
        if (cmd) commands.push(cmd);
      }
    }

    attempts.push({
      id,
      phase,
      task,
      status,
      title,
      summary: title,
      symptom,
      cause,
      fix,
      commands,
      date: '',
      blocks: '',
    });
  }
  return attempts;
}

function parseEntryXml(content, filter) {
  const entries = [];
  const entryRe = /<entry\s([^>]*)>([\s\S]*?)<\/entry>/g;
  let m;
  while ((m = entryRe.exec(content)) !== null) {
    const attrs = m[1];
    const body = m[2];

    const idMatch = attrs.match(/(?<![a-z-])id="([^"]*)"/);
    const dateMatch = attrs.match(/\bdate="([^"]*)"/);
    const phaseMatch = attrs.match(/\bphase="([^"]*)"/);
    const taskMatch = attrs.match(/\btask="([^"]*)"/);
    const statusMatch = attrs.match(/\bstatus="([^"]*)"/);
    const blocksMatch = attrs.match(/\bblocks="([^"]*)"/);

    const id = idMatch ? idMatch[1] : '';
    const date = dateMatch ? dateMatch[1] : '';
    const phase = phaseMatch ? phaseMatch[1] : '';
    const task = taskMatch ? taskMatch[1] : '';
    const status = statusMatch ? statusMatch[1].toLowerCase() : '';
    const blocks = blocksMatch ? blocksMatch[1] : '';

    if (!id) continue;
    if (filter.status && status !== filter.status.toLowerCase()) continue;
    if (filter.phase && phase !== filter.phase) continue;
    if (filter.task && task !== filter.task) continue;

    const summaryMatch = body.match(/<summary>([\s\S]*?)<\/summary>/);
    const contextMatch = body.match(/<context>([\s\S]*?)<\/context>/);
    const failureMatch = body.match(/<failure>([\s\S]*?)<\/failure>/);
    const ruleMatch = body.match(/<rule>([\s\S]*?)<\/rule>/);

    const summary = summaryMatch ? summaryMatch[1].trim() : '';
    const context = contextMatch ? contextMatch[1].trim() : '';
    const failure = failureMatch ? failureMatch[1].trim() : '';
    const rule = ruleMatch ? ruleMatch[1].trim() : '';

    entries.push({
      id,
      phase,
      task,
      status,
      title: summary,
      summary,
      symptom: context,
      cause: failure,
      fix: rule,
      commands: [],
      date,
      blocks,
    });
  }
  return entries;
}

function parseErrorsXml(content, filter = {}) {
  return [
    ...parseAttemptXml(content, filter),
    ...parseEntryXml(content, filter),
  ];
}

module.exports = { readErrors, parseErrorsXml };
