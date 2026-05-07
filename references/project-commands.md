# Per-project `.planning/commands/` extension surface

Shipped in phase 86. Loader: `lib/project-commands/index.cjs`.

## Pattern

Any GAD project can add `gad` subcommands by dropping CJS files under
`<project-root>/.planning/commands/`. The CLI discovers them on startup;
no framework edits required.

```
<project-root>/
  .planning/
    commands/
      eval-matrix.cjs   →  gad eval-matrix  (or gad <project-id>:eval-matrix)
      db-seed.cjs       →  gad db-seed
```

## File shapes

### Shape A — direct object export (simple scripts)

No factory wrapper, no citty import. Export a plain `{ meta, args?, run }` object.
`defineCommand` in citty is a passthrough — the shape is identical without it.

```js
'use strict';
module.exports = {
  meta: {
    name: 'my-tool',
    description: 'Short description shown in gad --help',
  },
  // args is optional; omit for commands with no flags
  args: {
    verbose: { type: 'boolean', default: false, description: 'Verbose output' },
  },
  run({ args }) {
    if (args.verbose) console.log('verbose mode');
    console.log('done');
  },
};
```

### Shape B — factory export (needs deps)

Use when the command needs access to GAD helpers (findRepoRoot, gadConfig, etc.).
The factory receives the full `common` dep bag plus extra fields:

| Field | Type | Contents |
|---|---|---|
| `defineCommand` | function | citty defineCommand |
| `projectRoot` | string | absolute path to the project root |
| `project` | object | root entry from gad-config (id, path, planningDir, ...) |
| `commandName` | string | basename without .cjs |
| `commandPath` | string | absolute path to the command file |
| `commandsDir` | string | absolute path to the .planning/commands/ dir |
| `findRepoRoot` | function | walks up from cwd to find repo root |
| `gadConfig` | object | config loader (gadConfig.load(root)) |
| `outputError` | function | print error and exit(1) |
| *(all common deps)* | various | readers, writers, render, etc. |

Named export convention: `create<PascalCaseName>Command`.

```js
'use strict';
module.exports.createEvalMatrixCommand = function createEvalMatrixCommand(deps) {
  const { defineCommand, projectRoot } = deps;
  return defineCommand({
    meta: {
      name: 'eval-matrix',
      description: 'Run the eval matrix for this project',
    },
    args: {
      model: { type: 'string', required: true, description: 'Model slug' },
    },
    run({ args }) {
      const { spawnSync } = require('node:child_process');
      const r = spawnSync('python', ['-m', 'eval', '--model', args.model], {
        cwd: projectRoot,
        stdio: 'inherit',
      });
      process.exit(r.status ?? 1);
    },
  });
};
```

The loader also accepts any single export matching `/^create[A-Z].*Command$/`.

## Invocation

```sh
gad <name>                  # bare name (if unique across projects)
gad <project-id>:<name>     # always works, even when bare is taken
```

## Collision policy

When two projects ship a command with the same name:

- Both are registered under `<project-id>:<name>` (always available)
- Neither gets the bare `<name>` slot
- A warning is printed to stderr at startup

The bare name is also denied if a **built-in** gad command already owns it;
the project command remains accessible as `gad <project-id>:<name>`.

## Fault tolerance

If a `.cjs` file fails to load (syntax error, missing dep), the CLI:

1. Prints `[gad-cli-ext] WARN: skipping <file>: <message>` to stderr
2. Continues loading the remaining commands
3. Never crashes the main CLI

Operators can fix the broken file and restart without any framework changes.

## How to test

```sh
gad <name> --help          # shows your command's help text
gad <project-id>:<name>    # always-namespaced invocation
node bin/gad.cjs <name>    # from submodule dir, tests local source
```

---

## Migration recipe for slm-learning

Stein's `scripts/eval/run_comparative_matrix.py` → `gad eval-matrix`.

Create `<slm_learning>/.planning/commands/eval-matrix.cjs`:

```js
'use strict';
const { spawnSync } = require('node:child_process');

module.exports.createEvalMatrixCommand = function createEvalMatrixCommand({ defineCommand, projectRoot }) {
  return defineCommand({
    meta: {
      name: 'eval-matrix',
      description: 'Run the SLM eval matrix on Modal — wraps modal_app/eval_adapter.py',
    },
    args: {
      adapter: {
        type: 'string',
        required: true,
        description: 'Adapter id, e.g. /models/r16-v1',
      },
      tasks: {
        type: 'string',
        default: 'humaneval,mbpp',
        description: 'Comma-separated task list',
      },
    },
    run({ args }) {
      const r = spawnSync(
        'python',
        [
          '-m', 'modal', 'run',
          'modal_app/eval_adapter.py::main',
          '--adapter-id', args.adapter,
          '--tasks', args.tasks,
        ],
        { cwd: projectRoot, stdio: 'inherit' },
      );
      process.exit(r.status ?? 1);
    },
  });
};
```

Invocation after adding `slm-learning` to `gad-config.toml` (or if it's
already a configured root):

```sh
gad eval-matrix --adapter /models/r16-v1 --tasks humaneval,mbpp
# or unambiguous:
gad slm-learning:eval-matrix --adapter /models/r16-v1
```

If slm-learning is not in the monorepo's `gad-config.toml` roots, add:

```toml
[[planning.roots]]
id = "slm-learning"
path = "../slm_learning"
planningDir = ".planning"
discover = false
```

### One-line-per-script migration guide

| Old invocation | New shape | File |
|---|---|---|
| `python -m modal run modal_app/eval_adapter.py` | factory with `spawnSync` | `.planning/commands/eval-matrix.cjs` |
| `python scripts/train.py --config ...` | factory with `spawnSync` | `.planning/commands/train.cjs` |
| `node scripts/seed-db.mjs` | Shape A (no factory needed) | `.planning/commands/seed-db.cjs` |

> Once migrated, `scripts/` entries become redundant. Drop them during the
> next evolution sweep — they'll be gone by the time the extension surface
> has full tab-complete + help-text support.
