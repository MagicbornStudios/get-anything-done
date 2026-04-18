/**
 * `@vc-dom` — DOM-level Visual Context adapter. Framework-agnostic: any HTML
 * page or canvas-based app with a DOM overlay can scan, highlight, and link
 * to source via these helpers. React bindings live in `vc-react/`.
 */

export {
  collectScopedEntries,
  escapeCidSelector,
  queryByCid,
  readEntryFromElement,
} from "./scan";
