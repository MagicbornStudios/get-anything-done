// Snapshot/sprint/pause-work/startup section helpers extracted from
// bin/gad.cjs. printSection emits the bordered title + content block.
// resolveDetectedRuntimeId folds the runtime detector with the GAD_AGENT
// env override. buildHandoffsSection renders the open-handoffs block
// shown at the top of `gad snapshot`.

const { detectRuntimeIdentity } = require('./runtime-detect.cjs');
const handoffs = require('./handoffs.cjs');

function resolveDetectedRuntimeId() {
  const detected = detectRuntimeIdentity();
  if (detected.id && detected.id !== 'unknown') return detected.id;
  const fallback = String(process.env.GAD_AGENT || '').trim();
  return fallback || 'unknown';
}

function printSection(section) {
  console.log(`-- ${section.title} ${'-'.repeat(Math.max(0, 60 - section.title.length))}`);
  console.log(section.content);
  console.log('');
}

function buildHandoffsSection({ baseDir, projectid, runtime, mineFirst = false, limit = 5 } = {}, { render }) {
  const total = handoffs.countHandoffs({ baseDir, bucket: 'open', projectid, runtime });
  if (total <= 0) return null;
  const list = handoffs.listHandoffs({ baseDir, bucket: 'open', projectid, mineFirst, runtime });
  const visible = list.slice(0, limit);
  const rows = visible.map((handoff) => ({
    id: handoff.id,
    phase: handoff.frontmatter.phase || '',
    priority: handoff.frontmatter.priority || '',
    context: handoff.frontmatter.estimated_context || '',
    runtime: handoff.frontmatter.runtime_preference || '',
  }));
  let content = render(rows, { format: 'table', headers: ['id', 'phase', 'priority', 'context', 'runtime'] });
  if (total > visible.length) content += `\n+${total - visible.length} more`;
  const runtimeMatches = runtime && runtime !== 'unknown'
    ? list.filter((handoff) => handoff.frontmatter.runtime_preference === runtime)
    : [];
  if (runtimeMatches.length === 1) {
    content += `\nAuto-claim candidate: ${runtimeMatches[0].id} - run: gad handoffs claim ${runtimeMatches[0].id}`;
  }
  return {
    title: `HANDOFFS (${total} unclaimed)`,
    content,
    total,
    autoClaimId: runtimeMatches.length === 1 ? runtimeMatches[0].id : null,
  };
}

module.exports = {
  resolveDetectedRuntimeId,
  printSection,
  buildHandoffsSection,
};
