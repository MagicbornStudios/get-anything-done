import { strict as assert } from 'assert';
import { promises as fs } from 'fs';
import path from 'path';
import { loadRuntimeRegistry } from '../accounts-registry.cjs';

// Helper to create a temporary project directory
async function withTempDir(fn) {
  const os = await import('os');
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'gad-runtime-test-'));
  try {
    await fn(tmpDir);
  } finally {
    // cleanup
    await fs.rm(tmpDir, { recursive: true, force: true });
  }
}

(async () => {
  await withTempDir(async (dir) => {
    const legacy = {
      "codex-cli": [
        {
          "label": "primary",
          "type": "oauth-file",
          "credential_ref": { "kind": "file", "path": "~/.codex/auth.json", "canonical_filename": "auth.json" }
        }
      ],
      "gemini-cli": {
        "provider": "gemini",
        "accounts": [
          {
            "label": "primary",
            "type": "oauth-file",
            "credential_ref": { "kind": "file", "path": "~/.gemini/oauth_creds.json", "canonical_filename": "oauth_creds.json" }
          }
        ]
      }
    };
    const planningDir = path.join(dir, '.planning', 'team');
    await fs.mkdir(planningDir, { recursive: true });
    await fs.writeFile(path.join(planningDir, 'runtime-accounts.json'), JSON.stringify(legacy, null, 2));

    const registry = loadRuntimeRegistry(dir);
    // Expect both runtimes present with normalized structure
    assert.ok(registry['codex-cli'], 'codex-cli entry exists');
    assert.ok(registry['gemini-cli'], 'gemini-cli entry exists');
    const codex = registry['codex-cli'];
    assert.equal(codex.provider, 'codex');
    assert.equal(codex.accounts.length, 1);
    const acct = codex.accounts[0];
    assert.equal(acct.label, 'primary');
    assert.equal(acct.status, 'active');
    assert.ok(acct.added_at, 'added_at timestamp set');
    // Gemini similarly normalized
    const gemini = registry['gemini-cli'];
    assert.equal(gemini.provider, 'gemini');
    assert.equal(gemini.accounts[0].label, 'primary');
    console.log('✅ Runtime accounts migration test passed');
  });
})();
