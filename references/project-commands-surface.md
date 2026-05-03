# Project Commands Surface

`gad` can load project-scoped commands from any planning root registered in
repo-root `gad-config.toml`.

## Location

For each `[[planning.roots]]` entry, `gad` scans:

`<root>/<planningDir>/commands/*.cjs`

`planningDir` defaults to `.planning` and respects per-root overrides in
`gad-config.toml`.

## Module contract

Each file becomes one top-level command. The command name comes from the file
basename:

- `.planning/commands/echo.cjs` -> `gad echo`
- `.planning/commands/foo-bar.cjs` -> `gad foo-bar`

Each module must export a factory named like:

`module.exports = { createEchoCommand(deps) }`

The factory must return a `defineCommand(...)` object from `citty`.

If the expected export name is missing, `gad` will accept a single exported
`create<Name>Command`-style factory, but multiple matching factories are an
error.

## Deps passed to factories

Project command factories receive the normal `gad` shared dependency bag plus
project-local context:

- `projectRoot` — absolute path to the planning root
- `project` — the resolved `[[planning.roots]]` entry
- `commandName` — basename of the command file without `.cjs`
- `commandPath` — absolute path to the command module
- `commandsDir` — absolute path to the containing commands directory

This means project commands can reuse the same helpers used by built-in command
modules, including `findRepoRoot`, `gadConfig`, `resolveRoots`, and render /
error utilities. `defineCommand` is also injected so project modules do not
need their own local `citty` install.

## Startup behavior

- Commands are discovered at `gad` startup.
- Files are loaded in config-root order, then alphabetically within each
  commands directory.
- Duplicate command names fail fast, including collisions with built-in
  commands.

## Minimal example

```js
'use strict';

function createEchoCommand({ defineCommand }) {
  return defineCommand({
    meta: { name: 'echo', description: 'Echo a message' },
    args: {
      message: { type: 'positional', required: true },
    },
    run({ args }) {
      console.log(String(args.message || ''));
    },
  });
}

module.exports = { createEchoCommand };
```
