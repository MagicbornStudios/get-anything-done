'use strict';

const { defineCommand } = require('citty');

function createTryHelpCommand() {
  return defineCommand({
    meta: { name: 'help', description: 'Show gad try usage' },
    run() {
      console.log('gad try — temporary skill install flow');
      console.log('');
      console.log('Stages an external skill into .gad-try/<slug>/ in your current');
      console.log('directory — NOT in ~/.claude/skills/ or any global location.');
      console.log('The sandbox is always under <cwd>/.gad-try/, regardless of');
      console.log('whether the gad binary is installed globally or locally, so cd');
      console.log('into the project where you want the sandbox to live before');
      console.log('running gad try.');
      console.log('');
      console.log('Usage:');
      console.log('  gad try <slug|path|url>       Stage a skill into .gad-try/<slug>/');
      console.log('  gad try status                List staged sandboxes in cwd');
      console.log('  gad try cleanup <slug>        Remove one sandbox');
      console.log('  gad try cleanup --all         Remove all sandboxes in cwd');
      console.log('');
      console.log('Examples:');
      console.log('  cd ~/my-project');
      console.log('  gad try gad-help                                  # local slug from framework skills/');
      console.log('  gad try ./my-skill/                               # local path');
      console.log('  gad try https://github.com/safishamsi/graphify    # git url, any branch');
      console.log('');
      console.log('On stage: the handoff prompt is copied to your clipboard');
      console.log('(clip.exe / pbcopy / xclip / xsel / wl-copy depending on OS),');
      console.log('so you can immediately paste it into your coding agent.');
      console.log('Silent degradation if no clipboard tool is installed.');
    },
  });
}

module.exports = { createTryHelpCommand };
