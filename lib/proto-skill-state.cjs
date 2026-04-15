/**
 * Proto-skill drafting state classifier.
 *
 * Per the create-proto-skill checkpoint protocol (decision gad-171):
 *   - `pending`     = candidate exists under .planning/candidates/<slug>/
 *                     with no matching .planning/proto-skills/<slug>/ dir
 *   - `in-progress` = proto-skill dir with PROVENANCE.md but no SKILL.md
 *                     (previous run crashed / compacted mid-draft, the
 *                     PROVENANCE lock marker is the resume signal)
 *   - `complete`    = proto-skill dir with SKILL.md (with or without
 *                     PROVENANCE.md — pre-gad-171 bundles may lack the
 *                     lock marker and we still count them complete)
 *
 * Used by `gad evolution status` to surface the drafting backlog, and
 * imported by create-proto-skill itself to know what to draft next.
 */

const fs = require('fs');
const path = require('path');

function classifyProtoSkillDraftingState(candidatesDir, protoSkillsDir) {
  const candidateSlugs = fs.existsSync(candidatesDir)
    ? fs
        .readdirSync(candidatesDir, { withFileTypes: true })
        .filter((e) => e.isDirectory())
        .map((e) => e.name)
    : [];
  const protoSkillSlugs = fs.existsSync(protoSkillsDir)
    ? fs
        .readdirSync(protoSkillsDir, { withFileTypes: true })
        .filter((e) => e.isDirectory())
        .map((e) => e.name)
    : [];

  const protoSet = new Set(protoSkillSlugs);
  const pending = candidateSlugs.filter((slug) => !protoSet.has(slug));

  const inProgress = [];
  const complete = [];
  for (const slug of protoSkillSlugs) {
    const dir = path.join(protoSkillsDir, slug);
    const hasProvenance = fs.existsSync(path.join(dir, 'PROVENANCE.md'));
    const hasSkill = fs.existsSync(path.join(dir, 'SKILL.md'));
    if (hasProvenance && !hasSkill) {
      inProgress.push(slug);
    } else {
      complete.push(slug);
    }
  }

  return { pending, inProgress, complete };
}

module.exports = { classifyProtoSkillDraftingState };
