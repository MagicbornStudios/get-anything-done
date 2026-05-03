'use strict';

const { describe, test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { createTempDir, cleanup, runGadCli } = require('./helpers.cjs');

function writeFile(filePath, content) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content);
}

describe('project-scoped .planning/commands discovery', () => {
  test('loads a command from a planning root and exposes it by filename', () => {
    const tmpDir = createTempDir('gad-project-command-');
    try {
      writeFile(path.join(tmpDir, 'gad-config.toml'), [
        '[planning]',
        '',
        '[[planning.roots]]',
        'id = "global"',
        'path = "."',
        '',
      ].join('\n'));

      writeFile(path.join(tmpDir, '.planning', 'commands', 'echo.cjs'), [
        "'use strict';",
        '',
        'function createEchoCommand({ defineCommand }) {',
        '  return defineCommand({',
        "    meta: { name: 'echo', description: 'Echo a message' },",
        '    args: {',
        "      message: { type: 'positional', required: true },",
        '    },',
        '    run({ args }) {',
        '      console.log(String(args.message || \'\'));',
        '    },',
        '  });',
        '}',
        '',
        'module.exports = { createEchoCommand };',
        '',
      ].join('\n'));

      const result = runGadCli(['echo', 'hello'], tmpDir);
      assert.equal(result.success, true, result.error);
      assert.equal(result.output, 'hello');
    } finally {
      cleanup(tmpDir);
    }
  });
});
