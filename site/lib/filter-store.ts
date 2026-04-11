import { create } from "zustand";
import { immer } from "zustand/middleware/immer";

export type ReviewState = "reviewed" | "needs-review" | "excluded";

export interface FilterState {
  roundFilter: string | null;
  domainFilter: string | null;
  statusFilter: "all" | ReviewState;
  hypothesisFilter: string | null;
  searchQuery: string;
  selectedRunKey: string | null;
}

interface FilterActions {
  setRoundFilter: (round: string | null) => void;
  setDomainFilter: (domain: string | null) => void;
  setStatusFilter: (status: "all" | ReviewState) => void;
  setHypothesisFilter: (hypothesis: string | null) => void;
  setSearchQuery: (query: string) => void;
  setSelectedRunKey: (key: string | null) => void;
  clearAll: () => void;
}

const INITIAL: FilterState = {
  roundFilter: null,
  domainFilter: null,
  statusFilter: "all",
  hypothesisFilter: null,
  searchQuery: "",
  selectedRunKey: null,
};

export const useFilterStore = create<FilterState & FilterActions>()(
  immer((set) => ({
    ...INITIAL,
    setRoundFilter: (round) =>
      set((s) => {
        s.roundFilter = round;
        s.selectedRunKey = null;
      }),
    setDomainFilter: (domain) =>
      set((s) => {
        s.domainFilter = domain;
        s.selectedRunKey = null;
      }),
    setStatusFilter: (status) =>
      set((s) => {
        s.statusFilter = status;
      }),
    setHypothesisFilter: (hypothesis) =>
      set((s) => {
        s.hypothesisFilter = hypothesis;
      }),
    setSearchQuery: (query) =>
      set((s) => {
        s.searchQuery = query;
      }),
    setSelectedRunKey: (key) =>
      set((s) => {
        s.selectedRunKey = key;
      }),
    clearAll: () =>
      set((s) => {
        Object.assign(s, INITIAL);
      }),
  }))
);
