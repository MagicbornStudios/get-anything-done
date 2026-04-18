---
id: gad-framework-next-rsc-cjs-externals-01
title: Loading CJS externals from RSC in Next 16 / Turbopack — the getBuiltinModule dance
category: gad-framework
difficulty: advanced
tags: [nextjs, turbopack, rsc, createRequire, cjs, esm]
source: static
date: 2026-04-17
implementation: apps/planning-app/lib/planning-data.ts
decisions: gad-261, gad-267
phases: get-anything-done:59
related: gad-framework-testable-cli-01
---

# Loading CJS externals from RSC in Next 16 / Turbopack — the getBuiltinModule dance

You have a Next 16 app using the App Router (RSC server components). A server component needs to `require()` some plain old CommonJS code that lives **outside the app directory** — maybe shared library code from a sibling workspace, maybe a CLI lib you're wrapping. In our case: the planning-app reads CJS planning-XML readers from `vendor/get-anything-done/lib/*-reader.cjs`.

The canonical Node way is `createRequire`:

```ts
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const reader = require('../../../vendor/get-anything-done/lib/task-registry-reader.cjs');
```

In vanilla Node this Just Works. In Next 16 + Turbopack, it doesn't — and the failure modes are subtle.

## Why the canonical form breaks

Turbopack is an aggressive bundler. Its static-analysis pass tries to identify every `require()` call at build time and either (a) inline the module, (b) mark it external, or (c) stub it out. When it sees `createRequire(import.meta.url)`, it rewrites the expression into an unusable placeholder — it can't know at build time what file `import.meta.url` will resolve to at runtime, so it bails. The bail produces a module that looks like `createRequire` but throws or returns `{}` on call.

Tried workarounds that ALSO fail:

- `(0, eval)("require")` — the ESM wrapper Turbopack generates has no `require` in scope.
- `new Function("return require")()` — same reason.
- Relative paths like `./foo.cjs` — even if you reached a valid `require`, Turbopack interprets the STRING as a static module id and replaces the call with a stub.

## The dance that works

```ts
// apps/planning-app/lib/planning-data.ts
import path from 'node:path';

function dynamicRequire(absPath: string) {
  // process.getBuiltinModule is NOT rewritten by Turbopack.
  const mod = (process as any).getBuiltinModule('node:module');
  const createRequire = mod.createRequire;
  const requireFn = createRequire(import.meta.url);
  return requireFn(absPath);
}

const repoRoot = findRepoRoot();  // walk up for gad-config.toml
const taskReaderPath = path.resolve(
  repoRoot,
  'vendor',
  'get-anything-done',
  'lib',
  'task-registry-reader.cjs'
);
const reader = dynamicRequire(taskReaderPath);
```

Two tricks stacked:

1. **`process.getBuiltinModule('node:module')`** — a runtime API Turbopack doesn't know about, so it leaves the call alone. Returns the real `module` builtin.
2. **Absolute path to `dynamicRequire`** — never pass a relative string literal. Turbopack scans string literals in `require()` positions; an absolute path computed at runtime from `path.resolve` is opaque to the scanner. The require proceeds at actual require-time.

## When to use this

Only when you HAVE to. Proper solutions in order of preference:

1. **Port the CJS to ESM.** If you own it, just convert.
2. **Publish it as a workspace package** with a proper `"exports"` field in its `package.json` — Next handles first-party workspace CJS cleanly when it's a real package.
3. **serverExternalPackages in next.config.mjs** — mark the package as external so Next skips bundling and uses runtime resolution. Works when (2) is set up.
4. **The getBuiltinModule dance** — absolute last resort, for CJS files that DON'T live in a proper package tree (like our scripts-that-double-as-libs in `vendor/get-anything-done/lib/`).

## Tell in next.config.mjs

If you go the external-package route, you also need:

```js
// next.config.mjs
const nextConfig = {
  serverExternalPackages: ['get-anything-done-lib'],  // if using approach 3
  outputFileTracingRoot: process.cwd(),
};
```

`outputFileTracingRoot` specifically — without it, Next's bundler won't trace file-system access outside the app root, and your standalone build won't include the CJS files when deployed.

## Takeaway

Turbopack's static analysis is smart about most things, naive about dynamic imports. If you must bridge to CJS code outside your app tree from a server component, `process.getBuiltinModule('node:module').createRequire(import.meta.url)` called with absolute paths is the escape hatch. Know the escape hatch; don't reach for it first.
