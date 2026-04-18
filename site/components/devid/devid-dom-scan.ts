/**
 * Legacy module — kept as a thin re-export shim so existing callers keep
 * working. The implementations now live in framework-agnostic layers:
 *
 * - DOM scanning / queries → `./vc-dom`
 * - Stable sort → `./vc-core`
 *
 * Prefer importing from those barrels directly in new code.
 */

export {
  collectScopedEntries,
  escapeCidSelector,
  queryByCid,
  readEntryFromElement,
} from "./vc-dom";
export { sortRegistryEntries } from "./vc-core";
