'use strict';
/**
 * gad migrate-schema — convert RP XML planning files to GAD Markdown.
 * Self-contained except for findRepoRoot (injected).
 */

const fs = require('fs');
const path = require('path');
const { defineCommand } = require('citty');

function convertXmlToMd(filename, xml) {
  const basename = filename.replace('.xml', '');

  if (filename === 'STATE.xml') {
    const currentPhase = (xml.match(/<current-phase[^>]*>(.*?)<\/current-phase>/s) || [])[1] || '';
    const milestone = (xml.match(/<milestone[^>]*>(.*?)<\/milestone>/s) || [])[1] || '';
    const status = (xml.match(/<status[^>]*>(.*?)<\/status>/s) || [])[1] || 'active';
    return [
      `# Planning State`,
      '',
      `## Current Position`,
      '',
      `Phase: ${currentPhase.trim()}`,
      `Milestone: ${milestone.trim()}`,
      `Status: ${status.trim()}`,
      '',
      `> Migrated from STATE.xml on ${new Date().toISOString().split('T')[0]}`,
    ].join('\n') + '\n';
  }

  if (filename === 'ROADMAP.xml') {
    const phases = [];
    const phaseRe = /<phase id="([^"]+)">([\s\S]*?)<\/phase>/g;
    let m;
    while ((m = phaseRe.exec(xml)) !== null) {
      const id = m[1];
      const body = m[2];
      const goal = (body.match(/<goal>([\s\S]*?)<\/goal>/) || [])[1] || '';
      const status = (body.match(/<status>([\s\S]*?)<\/status>/) || [])[1] || 'planned';
      const done = status === 'done';
      phases.push(`- [${done ? 'x' : ' '}] **Phase ${id}:** ${goal.replace(/<[^>]+>/g, '').trim()}`);
    }
    return [
      `# Roadmap`,
      '',
      `## Milestone`,
      '',
      ...phases,
      '',
      `> Migrated from ROADMAP.xml on ${new Date().toISOString().split('T')[0]}`,
    ].join('\n') + '\n';
  }

  if (filename === 'REQUIREMENTS.xml') {
    const text = xml.replace(/<\?[^>]+\?>/g, '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    return `# Requirements\n\n${text}\n\n> Migrated from REQUIREMENTS.xml on ${new Date().toISOString().split('T')[0]}\n`;
  }

  const text = xml.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  return `# ${basename}\n\n${text}\n\n> Migrated from ${filename}\n`;
}

function createMigrateSchemaCommand(deps) {
  const { findRepoRoot } = deps;

  return defineCommand({
    meta: { name: 'migrate-schema', description: 'Convert RP XML planning files to GAD Markdown' },
    args: {
      path: { type: 'string', description: 'Planning directory (default: .planning/)', default: '' },
      yes: { type: 'boolean', alias: 'y', description: 'Apply without prompting', default: false },
    },
    run({ args }) {
      const baseDir = findRepoRoot();
      const planDir = args.path
        ? path.resolve(args.path)
        : path.join(baseDir, '.planning');

      const xmlFiles = fs.existsSync(planDir)
        ? fs.readdirSync(planDir).filter((f) => f.endsWith('.xml'))
        : [];

      if (xmlFiles.length === 0) {
        console.log(`No XML files found in ${planDir} — nothing to migrate.`);
        return;
      }

      console.log(`\nMigration plan for ${planDir}\n`);
      const mapping = {
        'STATE.xml': 'STATE.md',
        'ROADMAP.xml': 'ROADMAP.md',
        'TASK-REGISTRY.xml': '(merged into STATE.md)',
        'REQUIREMENTS.xml': 'REQUIREMENTS.md',
      };
      for (const xml of xmlFiles) {
        const dest = mapping[xml] || xml.replace('.xml', '.md');
        console.log(`  ${xml}  →  ${dest}`);
      }
      console.log(`\n  Archive: ${planDir}/archive/xml/`);

      if (!args.yes) {
        console.log('\nRun with --yes to apply.');
        return;
      }

      const archiveDir = path.join(planDir, 'archive', 'xml');
      fs.mkdirSync(archiveDir, { recursive: true });

      let migrated = 0;
      for (const xml of xmlFiles) {
        const src = path.join(planDir, xml);
        const destName = mapping[xml] || xml.replace('.xml', '.md');
        if (!destName.startsWith('(')) {
          const dest = path.join(planDir, destName);
          if (!fs.existsSync(dest)) {
            const content = fs.readFileSync(src, 'utf8');
            fs.writeFileSync(dest, convertXmlToMd(xml, content));
            console.log(`  ✓ Created ${destName}`);
            migrated++;
          } else {
            console.log(`  ⚠ ${destName} already exists — created ${destName.replace('.md', '-migrated.md')}`);
            const content = fs.readFileSync(src, 'utf8');
            fs.writeFileSync(dest.replace('.md', '-migrated.md'), convertXmlToMd(xml, content));
          }
        }
        fs.renameSync(src, path.join(archiveDir, xml));
      }

      console.log(`\n✓ Migration complete — ${migrated} files created, ${xmlFiles.length} archived`);
    },
  });
}

module.exports = { createMigrateSchemaCommand };
