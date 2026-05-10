# @gad/visual-context-web

Vanilla-JS ES module that drops `gad env web`'s VCS+chat UX into any `gad <X> web` surface in under 30 lines. No build step, no framework, no deps.

Extracted from `bin/commands/env-web.cjs`. Reference: phase 185, task 185-01, decision GLOBAL-D-335 (apps/desk = command-center).

## Patterns included

- **cid tokens** — `data-cid` attributes mark every visible region for agent addressability
- **Alt+I hover** — pressing Alt toggles a gold dashed border + label on whichever cid'd element is under cursor; releases cleanly with no persistent decoration
- **Alt+click voice tag** — Alt+clicking any cid'd element starts a `SpeechRecognition` recording; on finalize the transcript lands in the side panel bucketed by cid
- **Typewriter merge animation** — when a second recording targets the same cid, new text types out character-by-character into the existing bucket
- **Passive listening dot** — top-left indicator: ACTIVE (red, pulsing) on diction signal, PASSIVE (gold, dim) on silence
- **Ctrl+; UPDATE quick-prompt** — builds a structured `UPDATE: <cid> <body>` string from all accumulated tags and writes it to clipboard

## Usage

```html
<link rel="stylesheet" href="/visual-context-web/index.css">
<script type="module">
  import createVisualContextOverlay from "/visual-context-web/index.js";

  const vcs = createVisualContextOverlay({
    cidPrefix: "issues",
    onVoiceTag: ({ cid, ts, transcript }) => console.log("tagged", cid, transcript),
    onUpdate: (str) => console.log("copied:", str),
  });

  // later: vcs.dispose() to clean up
</script>
```

Add `data-cid="issues-<region>"` to your page elements. That's the full integration.

## Options

| Option | Type | Default | Description |
|---|---|---|---|
| `cidPrefix` | string | `"app"` | Namespace prefix for the UPDATE prompt and internal overlay cids |
| `onVoiceTag` | function | null | Called with `{ cid, ts, transcript }` when a recording finalizes |
| `onUpdate` | function | null | Called with the built UPDATE string when Ctrl+; fires |
| `container` | Element | `document.body` | Element the side panel is appended to |
| `showDevHint` | boolean | `true` | Show keyboard-hint bar at bottom-left |

## Return value

```js
const { dispose, dot, recordings, refreshCids } = createVisualContextOverlay(opts);
```

- `dispose()` — remove all listeners, DOM nodes, timers
- `dot` — the listening-dot `<div>` element
- `recordings()` — snapshot of current tag array
- `refreshCids()` — no-op seam; hover + click are CSS/event-delegated so no rescan needed

## Theming

All colours are CSS vars. Set them on `:root` to override:

```css
:root {
  --accent: #D4A017;
  --accent-bright: #FFD700;
  --accent-dark: #8C6E10;
  --red: #C92A2A;
  --bg: #0d0d0d;
  --bg2: #050505;
  --card: #1a1a1a;
  --fg: #e8e8e8;
  --fg-dim: #999;
  --border: #1f1f1f;
  --mono: ui-monospace, "JetBrains Mono", Menlo, Consolas, monospace;
}
```

## Custom events

Fire `voice-tag-recorded` on `document` to inject a tag programmatically:

```js
document.dispatchEvent(new CustomEvent("voice-tag-recorded", {
  detail: { cid: "issues-status-col", transcript: "needs triage" }
}));
```

## pnpm workspace

The submodule `pnpm-workspace.yaml` already includes `packages/*`, so this package is auto-picked up. Consumers inside the monorepo can reference it as `workspace:*`.
