---
id: gad-framework-tailwind-v4-theme-tokens-01
title: Tailwind v4 @theme tokens silently no-op unless bound to :root
category: gad-framework
difficulty: beginner
tags: [tailwindcss, tailwind-v4, theme, css-variables]
source: static
date: 2026-04-17
implementation: apps/planning-app/app/globals.css
decisions: gad-267
phases: get-anything-done:59
related: gad-framework-next-rsc-cjs-externals-01
---

# Tailwind v4 @theme tokens silently no-op unless bound to :root

Tailwind v4 moves theme configuration from `tailwind.config.ts` to a CSS-first `@theme` block. You declare your design tokens as CSS variables in CSS, and Tailwind generates utility classes that reference them.

It looks like this:

```css
/* globals.css */
@import "tailwindcss";

@theme inline {
  --color-primary: var(--primary);
  --color-accent: var(--accent);
  --color-card: var(--card);
}
```

Write `bg-primary`, `text-accent`, `border-card` in your markup — Tailwind emits classes that pull from those variables. Clean.

**The trap:** if the `--primary` / `--accent` / `--card` vars aren't defined in `:root` (or another high-priority selector), Tailwind **silently drops** the utility. No build error. No warning. Just `bg-accent` doesn't exist. Your element has no background. You spend 20 minutes thinking you typo'd the class name.

## The correct pattern

```css
/* globals.css */
@import "tailwindcss";

:root {
  --background: oklch(0.14 0.006 41);
  --foreground: oklch(0.89 0.013 56);
  --primary:    oklch(0.70 0.079 64);
  --accent:     oklch(0.72 0.102 71);
  --card:       oklch(0.18 0.005 39);
  --muted:      oklch(0.22 0.010 39);
  --border:     oklch(0.25 0.010 39);
}

@theme inline {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --color-primary:    var(--primary);
  --color-accent:     var(--accent);
  --color-card:       var(--card);
  --color-muted:      var(--muted);
  --color-border:     var(--border);
}
```

Three rules:

1. **Declare the raw value in `:root`** — `oklch(...)`, `rgb(...)`, whatever. One source of truth.
2. **Map to `--color-<name>` in `@theme inline`** — this is the Tailwind alias. `inline` (vs no modifier) means "resolve the var() expression at compile time" which is what you want for token aliases.
3. **Every `--color-X` in `@theme` must have a corresponding `--X` in `:root`.** If you add `--color-accent-foreground: var(--accent-foreground)` but forget to add `--accent-foreground: oklch(...)` in `:root`, the `text-accent-foreground` class silently disappears.

## How to spot the trap

When a Tailwind class you just added doesn't apply:

1. Open devtools, inspect the element, look at "computed" styles. If the Tailwind class isn't there at all (not just overridden), the class wasn't generated.
2. Grep your `globals.css` for the underlying token. `grep -n "primary" globals.css`. If the `--primary` var doesn't exist in `:root`, that's your bug.
3. If you added a new `@theme` line recently, add the matching `:root` line.

## Why the silent failure

Tailwind v4's compiler resolves `var()` expressions inside `@theme inline` at build time. If the resolution fails (no matching `:root` var), it drops the utility rather than emit a broken rule. This is technically correct (don't emit CSS that references undefined vars) but user-hostile for dev-time feedback.

## One more gotcha

Dark mode via `@custom-variant dark (&:where(.dark, .dark *))` — you still need the `:root` var declared. The dark variant just conditionally overrides the var value:

```css
:root {
  --background: oklch(0.14 0.006 41);   /* dark default */
}

/* If you want a light mode: */
:where(.light, .light *) {
  --background: oklch(0.98 0.005 60);
}
```

## Takeaway

In Tailwind v4, every utility class that uses a theme token needs BOTH the `@theme` alias AND the `:root` CSS variable. When a class silently fails, check for the `:root` declaration first. The compiler's "drop silently if unresolved" policy is the single most common footgun in v4 migrations.
