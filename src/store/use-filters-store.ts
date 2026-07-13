import { create } from "zustand";

export type ViewMode = "kanban" | "table" | "calendar" | "tasks" | "bi";

interface FiltersState {
  search: string;
  repFilter: string | "all";
  sourceFilter: string | "all";
  dateFrom: string | null;
  dateTo: string | null;
  setSearch: (v: string) => void;
  setRepFilter: (v: string) => void;
  setSourceFilter: (v: string) => void;
  setDateRange: (from: string | null, to: string | null) => void;
  reset: () => void;
}

export const useFiltersStore = create<FiltersState>((set) => ({
  search: "",
  repFilter: "all",
  sourceFilter: "all",
  dateFrom: null,
  dateTo: null,
  setSearch: (v) => set({ search: v }),
  setRepFilter: (v) => set({ repFilter: v }),
  setSourceFilter: (v) => set({ sourceFilter: v }),
  setDateRange: (from, to) => set({ dateFrom: from, dateTo: to }),
  reset: () =>
    set({ search: "", repFilter: "all", sourceFilter: "all", dateFrom: null, dateTo: null }),
}));
