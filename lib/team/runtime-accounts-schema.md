# Runtime Accounts Schema

The file `.planning/team/runtime-accounts.json` stores credential information for each runtime provider.

## New Rich Schema
```json
{
  "<runtime>": {
    "provider": "<provider>",
    "accounts": [
      {
        "label": "string",               // Human‑readable identifier
        "type": "oauth-file" | "env-var", // Credential type
        "credential_ref": {
          "kind": "file" | "env_var",
          "path": "string",                // Path to stored credential file (if kind=file)
          "canonical_filename": "string"    // Expected filename in the home directory
        },
        "status": "active" | "paused" | "rate-limited" | "error",
        "current_quota": null | { "used": number, "limit": number, "reset": "ISO8601" },
        "last_used_at": null | "ISO8601",
        "added_at": "ISO8601",
        "last_error": null | "string",
        "canonical_path": "string",      // Path where the runtime expects the credential
        "stored_path": "string" | null    // Path inside the GAD credential registry
      }
    ]
  },
  ...
}
```

* `runtime` keys correspond to the runtime name used by GAD (e.g. `codex-cli`).
* `provider` is the logical provider name (`codex`, `gemini`, `claude`, `opencode`).
* `accounts` is an **array** – even when only a single account exists. This enables multi‑account rotation.
* New fields (`status`, `current_quota`, `last_used_at`, `added_at`, `last_error`) allow the system to track credential state and quota usage.
* Legacy shape (where the value was either an array of plain account objects or an object with `provider` and `accounts`) is **automatically migrated** on first load by `normalizeRuntimeRegistry`.

## Backward Compatibility
When loading the file via `loadRuntimeRegistry(baseDir)`, any of the following legacy formats are accepted:

1. `{ "codex-cli": [ {...}, {...} ] }`
2. `{ "codex-cli": { "provider": "codex", "accounts": [ {...} ] } }`

The loader will:
* Infer the provider name from `RUNTIME_PROVIDER_DEFAULTS` if missing.
* Wrap a plain array into the `{ provider, accounts }` structure.
* Normalise each account record, adding missing fields with sensible defaults (`status: "active"`, timestamps set to the current time, etc.).

## Usage
```js
const { loadRuntimeRegistry } = require('./accounts-registry.cjs');
const baseDir = '/path/to/project'; // contains .planning/team/runtime-accounts.json
const registry = loadRuntimeRegistry(baseDir);
```