# Conventions — Reader Workspace

## File naming

- **React components:** PascalCase files (`ReaderWorkspace.tsx`, `EpubViewer.tsx`, `ReaderShelfCard.tsx`)
- **Modules/stores/utilities:** kebab-case files (`reader-reading-store.ts`, `reader-chrome-theme.ts`, `epub-annotations.ts`)
- **Types:** single `types.ts` file at the module root for shared type definitions
- **UI primitives:** flat directory `ui/` with one file per primitive (`button.tsx`, `card.tsx`, `badge.tsx`)
- **Lazy wrappers:** `ComponentLazy.tsx` naming pattern (e.g., `EpubViewerLazy.tsx`)

## Component patterns

- All client components begin with the `'use client'` directive
- Components are exported as named exports, except the main workspace and EpubViewer which use `export default`
- Props are defined as inline type literals or exported type aliases (e.g., `ReaderWorkspaceProps`, `EpubViewerProps`)
- Components accept a `className` prop for external styling when appropriate
- Conditional rendering uses ternary with `null` return: `{condition ? <Component /> : null}`
- No `&&` short-circuit rendering — always explicit ternary

## Store patterns

- All zustand stores use `create<StateType>()(persist(immer(...), {...}))` — always persist + immer together for persisted stores
- Non-persisted stores (modal store) use `create<StateType>()(immer(...))`
- Store names follow the pattern: `portfolio-reader-<purpose>` (e.g., `portfolio-reader-epub-reading`)
- Each persisted store includes a `partialize` function to select only the data fields (not actions)
- Legacy migration is handled in a custom storage adapter's `getItem` — reads old keys, consolidates, removes them
- A `noopStorage()` factory provides SSR-safe storage fallback
- Stores export a `use<Name>Store` hook (e.g., `useReaderReadingStore`)
- Non-hook access uses `useStore.getState()` for imperative reads/writes outside React

## Type conventions

- Types use the `type` keyword (not `interface`) for all data shapes
- Discriminated unions for state variants: `{ mode: 'library' } | { mode: 'built-in-reading' } | { mode: 'local-reading' }`
- Source kind uses string literal unions: `'built-in' | 'uploaded' | 'local'`
- Nullable fields use `string | null` (not optional `?:`) when the field is always present but may be null
- Optional fields use `?:` when the field may be entirely absent
- Status types are union objects with a `kind` discriminant: `{ kind: 'new'; label: 'New'; progress: 0 }`

## Import patterns

- React imports: `import React, { useCallback, useEffect, ... } from 'react'`
- Icons: individual named imports from `lucide-react` (`import { BookOpen, ChevronLeft } from 'lucide-react'`)
- Internal imports: relative paths with `./` prefix, no barrel re-imports within the module
- Type-only imports: `import type { ... }` for pure type references
- UI primitives: `import { Button } from './ui/button'`
- The public `index.ts` re-exports everything — consumers import from the package path, not internal paths

## Styling patterns

- Tailwind utility classes everywhere, no CSS modules or CSS-in-JS
- Semantic tokens from shadcn convention: `bg-background`, `text-foreground`, `border-border`, `text-muted-foreground`
- Chrome theme object provides class strings per slot — components use `const t = readerChrome` and apply `t.pillButton`, `t.shell`, etc.
- Rounded corners: `rounded-full` for pill buttons, `rounded-2xl` for cards and panels, `rounded-[2rem]` for the main content inset
- Responsive prefixes: `md:` for desktop overrides, `sm:` for tablet grid, `xl:` for wide grid
- Transition utilities: `transition-colors`, `transition-[width]`, `transition-opacity`
- The `cn()` utility is a minimal string joiner (no tailwind-merge) — just filters falsy values and joins with space

## Animation patterns

- framer-motion `AnimatePresence` wraps conditionally rendered panels (TOC, notes, planning strip links)
- Consistent transition config: `duration: 0.24, ease: [0.22, 1, 0.36, 1]` for slide-in panels
- Panels animate x-offset + opacity (left panels: x: -28 to 0; right panels: x: 28 to 0)
- Height-based collapse: `initial={{ height: 0, opacity: 0 }}` for expandable rows

## Error handling

- Empty catch blocks with `/* ignore */` comments for non-critical failures (quota errors, private mode)
- Graceful degradation: if IndexedDB is unavailable, return empty arrays; if localStorage fails, use noop storage
- EPUB fetch errors shown inline in the viewer area, not thrown
- AbortController for EPUB URL fetches with cleanup on unmount

## Testing

- Test files co-located with source: `epub-annotations.test.ts`, `reader-ui-primitives.test.ts`
- Uses vitest as the test runner
