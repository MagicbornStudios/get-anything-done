'use strict';

const { describe, test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');

const { runGadCli, createTempDir, cleanup } = require('./helpers.cjs');
const { _private } = require('../bin/commands/self.cjs');

function waitFor(condition, timeoutMs = 5000, intervalMs = 50) {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const tick = () => {
      if (condition()) return resolve();
      if ((Date.now() - start) > timeoutMs) return reject(new Error('Timed out waiting for condition'));
      setTimeout(tick, intervalMs);
    };
    tick();
  });
}

describe('gad self install helpers', () => {
  test('cleanupOldBinaries removes only stale .old copies', () => {
    const tmpDir = createTempDir('gad-self-cleanup-');
    try {
      const oldFile = path.join(tmpDir, 'gad.exe.old-1');
      const freshFile = path.join(tmpDir, 'gad.exe.old-2');
      const otherFile = path.join(tmpDir, 'gad-tui.exe.old-1');
      fs.writeFileSync(oldFile, 'old');
      fs.writeFileSync(freshFile, 'fresh');
      fs.writeFileSync(otherFile, 'other');
      const now = Date.now();
      fs.utimesSync(oldFile, new Date(now - (9 * 24 * 60 * 60 * 1000)), new Date(now - (9 * 24 * 60 * 60 * 1000)));
      fs.utimesSync(freshFile, new Date(now - (2 * 24 * 60 * 60 * 1000)), new Date(now - (2 * 24 * 60 * 60 * 1000)));

      _private.cleanupOldBinaries(tmpDir, 'gad.exe', 7 * 24 * 60 * 60 * 1000, now);

      assert.equal(fs.existsSync(oldFile), false);
      assert.equal(fs.existsSync(freshFile), true);
      assert.equal(fs.existsSync(otherFile), true);
    } finally {
      cleanup(tmpDir);
    }
  });

  test('installBinaryWithRenameSwap replaces a running gad.exe via rename-swap on Windows', { timeout: 20000 }, async (t) => {
    if (process.platform !== 'win32') {
      t.skip('Windows-only rename-over-running-exe behavior');
      return;
    }

    const tmpDir = createTempDir('gad-self-rename-swap-');
    const srcExe = path.join(tmpDir, 'src', 'gad-vtest-windows-x64.exe');
    const installDir = path.join(tmpDir, 'Programs', 'gad', 'bin');
    const installExe = path.join(installDir, 'gad.exe');
    const holdScript = path.join(tmpDir, 'hold-open.js');

    fs.mkdirSync(path.dirname(srcExe), { recursive: true });
    fs.mkdirSync(installDir, { recursive: true });
    fs.copyFileSync(process.execPath, srcExe);
    fs.copyFileSync(process.execPath, installExe);
    fs.writeFileSync(holdScript, 'setInterval(() => {}, 1000);\n');

    const child = spawn(installExe, [holdScript], {
      stdio: 'ignore',
      windowsHide: true,
    });

    t.after(() => {
      if (!child.killed) child.kill();
      cleanup(tmpDir);
    });

    await waitFor(() => child.pid && child.exitCode === null);
    const oldMtime = fs.statSync(installExe).mtimeMs;

    _private.installBinaryWithRenameSwap(srcExe, installExe, { label: 'gad.exe' });

    const oldCopies = fs.readdirSync(installDir).filter((name) => /^gad\.exe\.old-\d+$/.test(name));
    assert.equal(oldCopies.length, 1);
    assert.equal(fs.existsSync(path.join(installDir, oldCopies[0])), true);
    assert.equal(fs.existsSync(installExe), true);
    assert.equal(child.exitCode, null);
    assert.ok(fs.statSync(installExe).mtimeMs >= oldMtime);
  });
});

describe('gad self install command', () => {
  test('installs gad.exe and gad-tui.exe into LOCALAPPDATA bin', () => {
    const localAppData = createTempDir('gad-self-install-');
    try {
      const result = runGadCli(['self', 'install'], path.join(__dirname, '..'), { LOCALAPPDATA: localAppData });
      assert.equal(result.success, true, result.error);
      assert.match(result.output, /Installed: .*gad\.exe/);
      assert.match(result.output, /Installed: .*gad-tui\.exe/);

      const installDir = path.join(localAppData, 'Programs', 'gad', 'bin');
      assert.equal(fs.existsSync(path.join(installDir, 'gad.exe')), true);
      assert.equal(fs.existsSync(path.join(installDir, 'gad-tui.exe')), true);
    } finally {
      cleanup(localAppData);
    }
  });
});
