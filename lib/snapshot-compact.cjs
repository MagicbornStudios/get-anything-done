'use strict';
/**
 * snapshot-compact.cjs — compact presentations of planning data for `gad snapshot`.
 *
 * The legacy snapshot emits raw XML files verbatim. Every `<reference>...</reference>`
 * wrapper costs ~23 chars per item on a ~60-char path, and the `<?xml?>` prolog +
 * outer element tags are pure presentation. This module produces compact equivalents
 * that preserve the same information density per token.
 *
 * Contract: the compact form is loss-less relative to what the agent needs to act on.
 * It strips only structural XML tokens (prolog, outer element wrappers, per-item
 * tag pairs on scalar arrays), never content.
 *
 * Decision: gad-241 / phase 57.
 */

/**
 * Compact an entire STATE.xml string.
 *
 * Input:
 *   <?xml ...?>
 *   <state>
 *     <current-phase>42.4</current-phase>
 *     <milestone>gad-v1.1</milestone>
 *     <status>active</status>
 *     <next-action>...</next-action>
 *     <references>
 *       <reference>path1</reference>
 *       <reference>path2</reference>
 *     </references>
 *     <last-updated>...</last-updated>
 *   </state>
 *
 * Output:
 *   phase: 42.4
 *   milestone: gad-v1.1
 *   status: active
 *   last-updated: ...
 *   next-action: |
 *     ...multi-line next-action text...
 *   refs:
 *   - path1
 *   - path2
 *
 * @param {string} xml
 * @returns {string}
 */
function compactStateXml(xml) {
  if (!xml || typeof xml !== 'string') return '';

  const getText = (tag) => {
    const m = xml.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`));
    return m ? m[1].trim() : '';
  };

  const phase = getText('current-phase');
  const plan = getText('current-plan');
  const milestone = getText('milestone');
  const status = getText('status');
  const lastUpdated = getText('last-updated');
  const nextAction = getText('next-action');

  // <references><reference>...</reference>...</references> → flat array
  const refs = [];
  const refsBlock = xml.match(/<references>([\s\S]*?)<\/references>/);
  if (refsBlock) {
    const refRe = /<reference[^>]*>([\s\S]*?)<\/reference>/g;
    let m;
    while ((m = refRe.exec(refsBlock[1])) !== null) {
      refs.push(m[1].trim());
    }
  }

  // <sink-compiled sink="..." at="..." />
  const sinkMatch = xml.match(/<sink-compiled\s+([^/]+?)\/>/);
  let sinkLine = '';
  if (sinkMatch) {
    const attrs = sinkMatch[1];
    const sinkAttr = attrs.match(/sink="([^"]*)"/);
    const atAttr = attrs.match(/at="([^"]*)"/);
    if (sinkAttr && atAttr) sinkLine = `sink: ${sinkAttr[1]} @ ${atAttr[1]}`;
  }

  const lines = [];
  if (phase) lines.push(`phase: ${phase}`);
  if (plan) lines.push(`plan: ${plan}`);
  if (milestone) lines.push(`milestone: ${milestone}`);
  if (status) lines.push(`status: ${status}`);
  if (lastUpdated) lines.push(`last-updated: ${lastUpdated}`);
  if (sinkLine) lines.push(sinkLine);

  if (nextAction) {
    // Preserve full text; if multi-line, prefix each subsequent line with 2 spaces
    const decoded = decodeEntities(nextAction);
    if (decoded.includes('\n')) {
      lines.push('next-action: |');
      for (const l of decoded.split('\n')) lines.push(`  ${l}`);
    } else {
      lines.push(`next-action: ${decoded}`);
    }
  }

  if (refs.length > 0) {
    lines.push('refs:');
    for (const r of refs) lines.push(`- ${r}`);
  }

  return lines.join('\n');
}

/**
 * Compact a per-phase XML line like
 *   <phase id="X" status="Y" depends="Z">Title: Goal...</phase>
 * into
 *   X [Y, depends:Z] Title: Goal...
 *
 * Preserves full title + goal text. Strips only the XML wrappers.
 *
 * @param {string} xmlLine one <phase...>...</phase> line
 * @returns {string}
 */
function compactPhaseLine(xmlLine) {
  const m = xmlLine.match(/^<phase\s+([^>]*)>([\s\S]*?)<\/phase>\s*$/);
  if (!m) return xmlLine;
  const attrs = m[1];
  const body = m[2];
  const idMatch = attrs.match(/id="([^"]*)"/);
  const statusMatch = attrs.match(/status="([^"]*)"/);
  const dependsMatch = attrs.match(/depends="([^"]*)"/);
  const id = idMatch ? idMatch[1] : '';
  const parts = [];
  if (statusMatch) parts.push(statusMatch[1]);
  if (dependsMatch && dependsMatch[1]) parts.push(`deps:${dependsMatch[1]}`);
  const meta = parts.length > 0 ? ` [${parts.join(', ')}]` : '';
  return `${id}${meta} ${body}`;
}

/**
 * Compact a multi-phase roadmap section.
 * Each non-blank, non-parenthetical line is expected to be a <phase> XML line.
 *
 * @param {string} content
 * @returns {string}
 */
function compactRoadmapSection(content) {
  if (!content) return content;
  return content
    .split('\n')
    .map(line => line.startsWith('<phase ') ? compactPhaseLine(line) : line)
    .join('\n');
}

/**
 * Compact a tasks section that contains embedded <phase id="XX"> + <task ...> XML.
 *
 * Input lines:
 *   <phase id="22">
 *     <task id="22-06" status="cancelled" type="task">text</task>
 *
 * Output:
 *   phase 22:
 *     22-06 [cancelled] text
 *
 * @param {string} content
 * @returns {string}
 */
function compactTasksSection(content) {
  if (!content) return content;
  return content
    .split('\n')
    .map(line => {
      const phaseOpen = line.match(/^\s*<phase\s+id="([^"]*)"\s*>\s*$/);
      if (phaseOpen) return `phase ${phaseOpen[1]}:`;
      const taskMatch = line.match(/^\s*<task\s+([^>]*)>([\s\S]*?)<\/task>\s*$/);
      if (taskMatch) {
        const attrs = taskMatch[1];
        const body = taskMatch[2];
        const idMatch = attrs.match(/id="([^"]*)"/);
        const statusMatch = attrs.match(/status="([^"]*)"/);
        const skillMatch = attrs.match(/skill="([^"]*)"/);
        const typeMatch = attrs.match(/type="([^"]*)"/);
        const agentMatch = attrs.match(/agent-id="([^"]*)"/);
        const id = idMatch ? idMatch[1] : '';
        const parts = [];
        if (statusMatch) parts.push(statusMatch[1]);
        if (typeMatch && typeMatch[1] !== 'task') parts.push(typeMatch[1]);
        if (skillMatch) parts.push(`skill:${skillMatch[1]}`);
        if (agentMatch) parts.push(`agent:${agentMatch[1]}`);
        const meta = parts.length > 0 ? ` [${parts.join(', ')}]` : '';
        return `  ${id}${meta} ${body.trim()}`;
      }
      return line;
    })
    .join('\n');
}

function decodeEntities(s) {
  return String(s)
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
}

module.exports = {
  compactStateXml,
  compactPhaseLine,
  compactRoadmapSection,
  compactTasksSection,
};
