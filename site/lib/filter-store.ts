/**
 * Shared filter-related types for catalog / project-market UIs.
 * Filter state lives in component hooks (e.g. `useProjectMarket`), not a global store.
 */

export type ReviewState = "reviewed" | "needs-review" | "excluded";

export interface FilterState {
  roundFilter: string | null;
  domainFilter: string | null;
  statusFilter: "all" | ReviewState;
  hypothesisFilter: string | null;
  searchQuery: string;
  selectedRunKey: string | null;
}
