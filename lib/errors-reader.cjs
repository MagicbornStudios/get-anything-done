'use strict';
/**
 * errors-reader.cjs — parse ERRORS-AND-ATTEMPTS.xml into structured attempt objects.
 *
 * Schema (grime-time / canonical GAD format):
 *   <attempt id="..." phase="..." task="..." status="resolved|open|partial">
 *     <title>...</title>
 *     <symptom>...</symptom>
 *     <cause>...</cause>
 *     <attempted-fix>...</attempted-fix>
 *     <verification>
 *       <command>...</command>
 *     </verification>
 *   </attempt>
 *
 * Parsed fields per attempt:
 *   id           string   — attempt id (e.g. "04-10-a1")
 *   phase        string   — phase id
 *   task         string   — task id this attempt is for
 *   status       string   — "resolved" | "open" | "partial"
 *   title        string
 *   symptom      string
 *   cause        string
 *   fix          string   — attempted-fix text
 *   commands     string[] — verification commands
 */

const fs = require('fs');
const path = require('path');

/**
 * @typedef {{ id: string, phase: string, task: string, status: string, title: string, symptom: string, cause: string, fix: string, commands: string[] }} ErrorAttempt
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
  return parseXml(fs.readFileSync(xmlFile, 'utf8'), filter);
}

function parseXml(content, filter) {
  const attempts = [];
  const attemptRe = /<attempt\s([^>]*)>([\s\S]*?)<\/attempt>/g;
  let m;
  while ((m = attemptRe.exec(content)) !== null) {
    const attrs = m[1];
    const body  = m[2];

    const idMatch     = attrs.match(/(?<![a-z-])id="([^"]*)"/);
    const phaseMatch  = attrs.match(/\bphase="([^"]*)"/);
    const taskMatch   = attrs.match(/\btask="([^"]*)"/);
    const statusMatch = attrs.match(/\bstatus="([^"]*)"/);

    const id     = idMatch     ? idMatch[1]     : '';
    const phase  = phaseMatch  ? phaseMatch[1]  : '';
    const task   = taskMatch   ? taskMatch[1]   : '';
    const status = statusMatch ? statusMatch[1].toLowerCase() : 'open';

    if (!id) continue;
    if (filter.status && status !== filter.status.toLowerCase()) continue;
    if (filter.phase  && phase  !== filter.phase)  continue;
    if (filter.task   && task   !== filter.task)   continue;

    const titleMatch   = body.match(/<title>([\s\S]*?)<\/title>/);
    const symptomMatch = body.match(/<symptom>([\s\S]*?)<\/symptom>/);
    const causeMatch   = body.match(/<cause>([\s\S]*?)<\/cause>/);
    const fixMatch     = body.match(/<attempted-fix>([\s\S]*?)<\/attempted-fix>/);

    const title   = titleMatch   ? titleMatch[1].trim()   : '';
    const symptom = symptomMatch ? symptomMatch[1].trim() : '';
    const cause   = causeMatch   ? causeMatch[1].trim()   : '';
    const fix     = fixMatch     ? fixMatch[1].trim()     : '';

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

    attempts.push({ id, phase, task, status, title, symptom, cause, fix, commands });
  }
  return attempts;
}

module.exports = { readErrors };
