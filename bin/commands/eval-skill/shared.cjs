'use strict';

const fs = require('fs');
const path = require('path');

function createSharedHelpers(skillsRoot) {
  function resolveSkillDir(name) {
    const skillDir = path.join(skillsRoot, name);
    const emergentDir = path.join(skillsRoot, 'emergent', name);
    if (fs.existsSync(path.join(skillDir, 'SKILL.md'))) return skillDir;
    if (fs.existsSync(path.join(emergentDir, 'SKILL.md'))) return emergentDir;
    return null;
  }

  function walkSkills() {
    const skills = [];

    function walk(dir, prefix = '') {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        if (!entry.isDirectory()) continue;
        const skillDir = path.join(dir, entry.name);
        const skillMd = path.join(skillDir, 'SKILL.md');
        if (!fs.existsSync(skillMd)) {
          walk(skillDir, prefix ? `${prefix}/${entry.name}` : entry.name);
          continue;
        }

        const id = prefix ? `${prefix}/${entry.name}` : entry.name;
        const evalsJson = path.join(skillDir, 'evals', 'evals.json');
        const hasEvals = fs.existsSync(evalsJson);
        let testCount = 0;
        let benchmarkExists = false;
        if (hasEvals) {
          try {
            const parsed = JSON.parse(fs.readFileSync(evalsJson, 'utf8'));
            testCount = parsed.evals?.length ?? 0;
          } catch {}
          const evalsDir = path.join(skillDir, 'evals');
          for (const file of fs.readdirSync(evalsDir)) {
            if (file.startsWith('benchmark') && file.endsWith('.json')) {
              benchmarkExists = true;
              break;
            }
          }
        }

        const content = fs.readFileSync(skillMd, 'utf8');
        const statusMatch = content.match(/^status:\s*(.+)$/m);
        const originMatch = content.match(/^origin:\s*(.+)$/m);
        const status = statusMatch ? statusMatch[1].trim() : 'experimental';
        const origin = originMatch ? originMatch[1].trim() : 'human-authored';

        skills.push({ id, status, origin, hasEvals, testCount, benchmarkExists });
      }
    }

    walk(skillsRoot);
    return skills;
  }

  function avg(arr) {
    return arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
  }

  function stddev(arr) {
    if (arr.length < 2) return 0;
    const mean = avg(arr);
    return Math.sqrt(arr.reduce((sum, value) => sum + (value - mean) ** 2, 0) / (arr.length - 1));
  }

  return { resolveSkillDir, walkSkills, avg, stddev };
}

module.exports = { createSharedHelpers };
