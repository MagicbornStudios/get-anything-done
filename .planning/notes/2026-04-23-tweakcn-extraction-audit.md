# TweakCN-OpenAI Extraction Audit

Date: 2026-04-23
Task: 47-01
Worker: codex w1

## Source Summary

- Audited repo: `https://github.com/B2Gdevs/TweakCN-OpenAI.git`
- Fresh clone: `vendor/get-anything-done/tmp/tweakcn-openai-fresh/`
- Commit audited: `4b1f5f91aed4d8841bd1b6c001125ee8948e8215`
- Commit date: 2026-04-17T13:38:53-05:00
- Commit subject: `docs: rewrite README for OpenAI fork`
- Existing reference clone checked: `vendor/get-anything-done/tmp/tweakcn/`
  - Remote: `https://github.com/jnsahaj/tweakcn.git`
  - Commit: `9fb9c4c77f75449bba391c844a9d554f51adaafa`
  - Conclusion: stale for this work because it targets upstream, not the operator fork.

LOC by area from the fresh fork:

| Area | Files | LOC | Extraction relevance |
|---|---:|---:|---|
| `config/` | 1 | 126 | Keep. Default theme state and common-token list. |
| `types/` | 9 | 436 | Keep a reduced subset: theme/editor/AI/font/errors. |
| `utils/` | 26 | 6,128 | Keep theme/color/font/AI helpers; drop registry/site-only helpers unless needed. |
| `store/` | 10 | 603 | Keep editor, preferences, presets, AI chat/draft, color focus. Drop auth/pro/website preview unless UI keeps those actions. |
| `hooks/` | 37 | 2,318 | Keep editor, AI, copy, dialog, responsive hooks; rewrite Next/URL/auth hooks. |
| `components/editor/` | 63 | 6,908 | Keep main extraction surface. |
| `components/ui/` | 51 | 5,518 | Do not blindly bundle all. Prefer package-private minimal shadcn primitives or import from app design system. |
| `components/examples/` | 63 | 7,851 | Optional preview examples; too large for first extraction. |
| `components/ai-elements/` | 3 | 178 | Keep if chat/code rendering stays embedded. |
| `lib/ai/` | 5 | 222 | Split into client-safe parser + server provider/route adapter. |
| `app/api/` | 3 | 137 | Rewrite as framework adapter, not package runtime code. |
| `app/editor/` | 3 | ~19 | Drop route shell; use only as mounting reference. |
| `app/ai/` | 10 | 533 | Drop marketing/standalone AI page. |
| `actions/` | 1 | 79 | Drop or replace with local persistence adapter; current file is a Next server-action stub. |
| `lib/` | 19 | 671 | Keep only generic utilities/constants/query helper as needed. |
| `public/r/v0/` | 42 | 1,008 | Drop from package unless registry export is explicitly reintroduced. |

## Extraction Map

### Keep: theme engine and serializers

Move into `packages/tweakcn-openai/src/theme/`:

- `types/theme.ts` -> `src/theme/types.ts`
  - Defines `themeStylePropsSchema`, `themeStylesSchema`, `ThemeStyleProps`, `ThemeStyles`, `ThemePreset`, and `Theme`.
  - Hard dependency: `zod`.
- `types/editor.ts` -> `src/theme/editor-types.ts`
  - Defines `ThemeEditorState` and editor prop shapes.
- `config/theme.ts` -> `src/theme/defaults.ts`
  - Defines `COMMON_STYLES`, default fonts, light/dark defaults, and `defaultThemeState`.
- `utils/theme-style-generator.ts` -> `src/theme/serialize.ts`
  - Hard requirement for copy-paste export. Generates `index.css`, Tailwind v3 config, and a Next-style `layout.tsx` snippet.
  - Rewrite note: make generated `layout.tsx` optional/example-oriented; the serializer itself should not import Next at runtime because those Next imports are inside string templates only.
- `utils/theme-styles.ts` -> `src/theme/merge.ts`
- `utils/theme-preset-helper.ts` and `utils/theme-presets.ts` -> `src/theme/presets.ts`
  - The built-in preset payload is large but self-contained. Consider a lazy `presets` export if bundle size matters.
- `utils/color-converter.ts`, `utils/contrast-checker.ts`, `utils/shadows.ts`, `utils/theme-fonts.ts`, `utils/fonts/*`, `utils/apply-theme.ts`, `utils/apply-style-to-element.ts`, `utils/parse-css-input.ts`, `utils/debounce.ts`, `utils/format.ts` -> `src/theme/` or `src/utils/`.

### Keep: Zustand stores

Move into `packages/tweakcn-openai/src/stores/`:

- `store/editor-store.ts`
  - Core theme state.
  - Includes undo/redo stacks: `history`, `future`, `undo`, `redo`, `canUndo`, `canRedo`.
  - Uses `zustand/middleware` persist with localStorage key `editor-storage`.
- `store/preferences-store.ts`
  - Tailwind version, color format, package manager, color selector tab, chat suggestion state.
  - Uses localStorage key `preferences-storage`.
- `store/theme-preset-store.ts`
  - Built-in plus saved preset registry.
  - Rewrite note: remove direct import from `actions/themes`; accept an injected `savedThemesLoader` or expose `loadSavedPresets(savedThemes)`.
- `store/ai-chat-store.ts`, `store/ai-local-draft-store.ts`, `store/idb-storage.ts`
  - Needed for chat history and draft persistence.
  - Uses `idb-keyval`.
- `store/color-control-focus-store.ts`
  - Needed for inspector/control highlighting.

Drop or stub:

- `store/auth-store.ts`, `store/get-pro-dialog-store.ts`
  - Auth/subscription is out of scope for desktop Settings.
- `store/website-preview-store.ts`
  - Only needed for external website preview, not the initial Settings editor.

### Keep: editor UI components

Move into `packages/tweakcn-openai/src/components/` with imports rewritten from `@/` to package-relative aliases:

- Main mount:
  - `components/editor/editor.tsx`
  - `components/editor/theme-control-panel.tsx`
  - `components/editor/theme-preview-panel.tsx`
  - `components/editor/action-bar/action-bar.tsx`
  - `components/editor/action-bar/components/*`
- Controls:
  - `components/editor/colors-tab-content.tsx`
  - `components/editor/color-picker.tsx`
  - `components/editor/color-selector-popover.tsx`
  - `components/editor/slider-with-input.tsx`
  - `components/editor/shadow-control.tsx`
  - `components/editor/hsl-adjustment-controls.tsx`
  - `components/editor/hsl-preset-button.tsx`
  - `components/editor/font-picker.tsx`
  - `components/editor/theme-preset-select.tsx`
  - `components/editor/control-section.tsx`
  - `components/editor/section-context.tsx`
- Import/export dialogs:
  - `components/editor/css-import-dialog.tsx`
  - `components/editor/code-panel.tsx`
  - `components/editor/code-panel-dialog.tsx`
  - `components/editor/share-dialog.tsx` only if share URL remains useful; otherwise drop.
- Preview:
  - `components/editor/theme-preview/*`
  - A reduced subset of `components/examples/*` if Settings wants the original live preview. Otherwise provide a `previewSlot` prop so `apps/desktop` can render its own themed sample.
- AI tab:
  - `components/editor/ai/*`
  - `components/ai-elements/*`
  - `components/copy-button.tsx`
  - `components/tooltip-wrapper.tsx`
  - `components/horizontal-scroll-area.tsx`

Rewrite/drop inside editor UI:

- `components/editor/editor.tsx`
  - Current prop is `themePromise: Promise<Theme | null>` and uses React `use(themePromise)`, which was built for the Next route. For package use, replace with `initialTheme?: Theme | null` or `initialThemeStyles?: ThemeStyles`.
- `hooks/use-controls-tab-from-url.ts`
  - Current dependency: `nuqs`.
  - Replace with local state or an injected URL-state adapter. Desktop Settings should not require a Next/URL query adapter.
- `hooks/use-dialog-actions.tsx`
  - Currently couples save/share/v0/auth/PostHog/server actions. Split into:
    - local CSS import/code dialog state,
    - optional save adapter,
    - optional analytics callbacks.
- `components/editor/action-bar/components/publish-button.tsx`, `save-button.tsx`, `share-button.tsx`
  - Publish/share/cloud save are not required for copy-paste Settings integration. Keep code/export/import/reset/undo/theme-toggle. Save can become local preset save if desired.
- `components/editor/theme-preset-select.tsx`
  - Replace `next/link` settings link with either no link or a package callback.
- `components/editor/theme-preview-panel.tsx`
  - Replace `next/link` with `<a>` or remove external promo/v0 links. Keep preview core.
- AI image components:
  - Replace `next/image` in `components/editor/ai/chat-image-preview.tsx` and `uploaded-image-preview.tsx` with normal `<img>`.
- Dynamic imports:
  - Replace `next/dynamic` in `components/editor/ai/chat-interface.tsx` and `ai-chat-form-body.tsx` with `React.lazy`, direct imports, or consumer-controlled lazy loading.

### Keep: OpenAI integration, but split server adapter

Keep client package pieces:

- `hooks/use-chat-context.tsx`
  - Uses `@ai-sdk/react` and `ai` `DefaultChatTransport`.
  - Rewrite hardcoded `api: "/api/generate-theme"` to a prop/provider option such as `apiEndpoint`.
- `hooks/use-ai-theme-generation-core.ts`
- `hooks/use-ai-chat-form.ts`
- `hooks/use-ai-enhance-prompt.ts`
- `utils/ai/*`
- `types/ai.ts`
- `lib/ai/parse-ai-sdk-transport-error.ts`
- `lib/ai/prompts.ts`
- `lib/ai/generate-theme/index.ts`
- `lib/ai/generate-theme/tools.ts`

Keep as framework examples or adapter exports, not default browser package code:

- `lib/ai/providers.ts`
  - Imports `server-only`, reads `process.env.OPENAI_API_KEY`, and creates OpenAI models.
  - Move to `src/server/openai-provider.ts` or `src/adapters/next/openai-provider.ts`.
- `app/api/generate-theme/route.ts`
  - Next route. Convert logic into a framework-agnostic handler like `createGenerateThemeHandler({ provider })`, then let apps/desktop call it through its own bridge/API.
- `app/api/enhance-prompt/route.ts`
  - Same treatment as generate-theme.
- `app/api/google-fonts/route.ts`
  - Next cache/response specific. For desktop, use a plain `fetchGoogleFonts` helper plus app-level caching.

### Drop: route/app shell and site scaffolding

Do not move these into `packages/tweakcn-openai/`:

- `app/layout.tsx`, `app/page.tsx`, `app/not-found.tsx`, `app/sitemap.ts`, `app/globals.css`, `app/loaders.css`, favicon/apple-touch assets.
- `app/editor/theme/[[...themeId]]/*`
  - Use as reference only. Package should expose a mountable editor, not a route.
- `app/ai/*`
  - Standalone marketing/AI page; Settings will mount the editor directly.
- `components/home/*`, `components/header.tsx`, `components/footer.tsx`, `components/user-profile-dropdown.tsx`, `components/get-pro-*`, `components/figma-*`, `components/dynamic-website-preview.tsx`.
- `actions/themes.ts`
  - Current file is a Next server-action stub. It should not cross into a framework-agnostic package.
- `lib/auth*`, `lib/subscription.ts`, `lib/shared.ts`, `lib/posthog.ts`
  - Auth/billing/analytics are not package concerns.
- `scripts/*`, `next.config.ts`, `postcss.config.mjs`, app-level `components.json`, app-level `tsconfig.json`.
- `public/live-preview*`, `public/r/*`, `assets/*` unless a specific preview/export feature needs them.

## Dependency Graph

### Package peer dependencies

Declare these as peers for `packages/tweakcn-openai`:

- `react >=19`
- `react-dom >=19`
- `zustand ^5`
- `@ai-sdk/react ^2`
- `ai ^5`
- `@ai-sdk/openai ^2` only for server/adapter entry points; keep it optional if the browser editor can run without AI.

### Likely package dependencies to bundle

These are used by the reusable editor itself:

- `zod`
- `culori`
- `idb-keyval`
- `lucide-react`
- `clsx`
- `tailwind-merge`
- `class-variance-authority`
- `@base-ui-components/react`
- `radix-ui`
- `cmdk`
- `sonner` or replace with host toast adapter
- `react-resizable-panels`
- `@tiptap/react`, `@tiptap/starter-kit`, `@tiptap/extension-*`, `@tiptap/suggestion`, `lexical`, `@lexical/react`, `tippy.js`
- `react-dropzone`
- `react-syntax-highlighter`
- `streamdown`
- `use-stick-to-bottom`
- `@tanstack/react-query` if the package keeps chat/save/preset data hooks internally. Prefer peer or optional provider if the desktop app already owns QueryClient.
- `screenfull` only if fullscreen preview remains.

### Dependencies to avoid in package runtime

These are Next/site/cloud specific and should not be package runtime deps:

- `next`
- `next-themes`
- `nuqs` and `nuqs/adapters/next/app`
- `server-only`
- `@vercel/og`
- `posthog-js`
- `swr` if only used by site surfaces
- `shadcn` CLI dependency
- `dotenv`
- `isbot`

### Framework-specific replacements

- `next/link` -> `<a>` or app-provided link component.
- `next/image` -> `<img>` or app-provided image component.
- `next/dynamic` -> direct import, `React.lazy`, or app-level code splitting.
- `NextRequest`/`NextResponse` route handlers -> plain `Request`/`Response` handlers or desktop IPC bridge handlers.
- `next/cache` -> app-level cache.
- `nuqs` URL state -> local state or injected query-state adapter.
- Next server actions -> package callbacks/adapters.

## Copy-Paste Export Flow

Confirmed. The native export/copy flow exists and should be preserved intact.

Key component path:

- `components/editor/code-panel.tsx`
  - Builds:
    - `code = generateThemeCode(themeEditorState, colorFormat, tailwindVersion)`
    - `configCode = generateTailwindConfigCode(themeEditorState, colorFormat, tailwindVersion)`
    - `layoutCode = generateLayoutCode(themeEditorState)`
  - Renders tabs:
    - `index.css`
    - `tailwind.config.ts` for Tailwind v3
    - `layout.tsx (Next.js)`
  - Copies active tab through `navigator.clipboard.writeText(...)`.
  - Also copies a shadcn registry install command through `copyRegistryCommand`.
- `components/editor/code-panel-dialog.tsx`
  - Wraps `CodePanel` in a responsive dialog.
- `components/editor/action-bar/components/code-button.tsx`
  - Button that opens the code/export panel.
- `components/editor/action-bar/action-bar.tsx`
  - Wires `onCodeClick={() => setCodePanelOpen(true)}`.
- `hooks/use-dialog-actions.tsx`
  - Owns `codePanelOpen` state and mounts `CodePanelDialog`.
- `utils/theme-style-generator.ts`
  - Hard serializer dependency. This is the core copy-paste output engine.

Extraction requirement for 47-03/47-04:

- Preserve `CodePanel` and `generateThemeCode` behavior before touching AI or preview polish.
- Registry command copying can be hidden or made optional because Settings users primarily need raw CSS/JSON copy-paste, but raw `index.css` copy must remain always available.
- The `layout.tsx` tab emits Next-specific sample code. Keep it as an optional tab or rename to clarify it is a Next example; do not make Next a runtime dependency.

## Proposed Package Shape

Directory:

```text
packages/tweakcn-openai/
  package.json
  tsconfig.json
  src/
    index.ts
    editor/
      TweakCNThemeEditor.tsx
      TweakCNThemeEditorProvider.tsx
      dialogs/
      controls/
      preview/
      ai/
    theme/
      types.ts
      defaults.ts
      presets.ts
      serialize.ts
      parse-css.ts
      apply.ts
      colors.ts
      shadows.ts
      fonts.ts
    stores/
      editor-store.ts
      preferences-store.ts
      theme-preset-store.ts
      ai-chat-store.ts
      ai-local-draft-store.ts
      color-control-focus-store.ts
    server/
      create-generate-theme-handler.ts
      create-enhance-prompt-handler.ts
      openai-provider.ts
```

Public exports:

```ts
export { TweakCNThemeEditor } from "./editor/TweakCNThemeEditor";
export { TweakCNThemeEditorProvider } from "./editor/TweakCNThemeEditorProvider";
export { useEditorStore, usePreferencesStore, useThemePresetStore } from "./stores";
export {
  generateThemeCode,
  generateTailwindConfigCode,
  generateLayoutCode,
  parseCssInput,
  applyThemeToElement,
  defaultThemeState,
  defaultPresets,
} from "./theme";
export type {
  Theme,
  ThemeEditorState,
  ThemeStyles,
  ThemeStyleProps,
  ThemePreset,
} from "./theme";
```

Optional subpath exports:

```json
{
  "./theme": "./src/theme/index.ts",
  "./stores": "./src/stores/index.ts",
  "./server/openai": "./src/server/openai-provider.ts",
  "./server/handlers": "./src/server/index.ts"
}
```

Recommended mount component API:

```ts
type TweakCNThemeEditorProps = {
  initialTheme?: Theme | null;
  initialStyles?: ThemeStyles;
  aiEndpoint?: string;
  enhancePromptEndpoint?: string;
  previewSlot?: React.ReactNode | ((state: ThemeEditorState) => React.ReactNode);
  onThemeChange?: (state: ThemeEditorState) => void;
  onCopy?: (payload: { kind: "css" | "tailwind-config" | "layout"; text: string }) => void;
  enableAI?: boolean;
  enableRegistryCommand?: boolean;
};
```

Desktop Settings integration expectation:

- `apps/desktop` mounts `TweakCNThemeEditor` inside Settings.
- Users customize the shadcn theme.
- Users open the code panel and copy `index.css` or other export text elsewhere.
- No package route, no Next app shell, no cloud save requirement.

## Risks

- The reusable editor currently assumes app-global shadcn UI primitives and Tailwind classes. Extraction may either bundle many `components/ui/*` files or require `apps/desktop` to provide a compatible design system.
- The AI UI currently spans TipTap, image upload, chat persistence, `@ai-sdk/react`, and a hardcoded `/api/generate-theme` transport. This is more coupled than the theme editor core.
- `use-dialog-actions.tsx` is the highest-coupling file: auth, save, share, v0, PostHog, CSS import, and code dialog all sit together.
- `theme-preset-store.ts` imports `actions/themes`; this must be inverted before packaging.
- Some previews and AI components use `next/link`, `next/image`, and `next/dynamic`. These must be replaced to avoid dragging in Next.
- Current route/API implementation reads `OPENAI_API_KEY` in a Next/server-only module. Desktop needs an explicit server/IPC or local backend boundary so the key never enters browser code.
- Built-in presets are large. Bundle size may be high if all presets and preview examples ship in the main entry.
- Copy panel includes a Next-specific `layout.tsx` output. This is useful as an example but should not imply the package is Next-only.

## Open Questions

- Should `packages/tweakcn-openai` own shadcn UI primitives internally, or should it consume primitives from `apps/desktop`?
- Does desktop Settings need the full AI chat UI, or only a simpler prompt-to-theme generator panel?
- Should OpenAI calls run through an existing desktop backend/IPC layer, or should this package provide framework-agnostic `Request -> Response` handlers for the host app to mount?
- Should saved presets persist only in localStorage/IndexedDB, or should `apps/desktop` provide a project/profile persistence adapter?
- Should the export panel keep registry-command copy, or hide it by default and focus on raw CSS/Tailwind config copy?
- Should preview examples be bundled or replaced with a desktop-specific preview surface?

## Suggested 47-02 Handoff

Scaffold the package with empty source entry points plus dependency policy only. Do not move code yet. Make the package ready for 47-03 extraction with peers for React 19, `@ai-sdk/react`, `ai`, and `zustand`, and with subpath export placeholders matching the proposed shape above.
