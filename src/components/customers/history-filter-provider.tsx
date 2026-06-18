"use client";

import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import { filterHistoryRows, isHistoryFiltered, type HistoryFilter } from "@/src/lib/customers/filter-history";
import type { CustomerPurchaseHistoryRow } from "@/src/lib/customers/purchase-history";

type HistoryFilterContextValue = {
  filter: HistoryFilter;
  setFilter: (filter: HistoryFilter) => void;
  filteredRows: CustomerPurchaseHistoryRow[];
  filteredTotal: number;
  isFiltered: boolean;
};

const HistoryFilterContext = createContext<HistoryFilterContextValue | null>(null);

export function HistoryFilterProvider({
  children,
  rows,
}: Readonly<{
  children: ReactNode;
  rows: CustomerPurchaseHistoryRow[];
}>) {
  const [filter, setFilter] = useState<HistoryFilter>({
    fromDate: null,
    toDate: null,
    productNames: null,
  });

  const contextValue = useMemo(() => {
    const { rows: filteredRows, total: filteredTotal } = filterHistoryRows(rows, filter);
    const filtered = isHistoryFiltered(filter);

    return {
      filter,
      setFilter,
      filteredRows,
      filteredTotal,
      isFiltered: filtered,
    };
  }, [rows, filter]);

  return (
    <HistoryFilterContext.Provider value={contextValue}>
      {children}
    </HistoryFilterContext.Provider>
  );
}

export function useHistoryFilter() {
  const context = useContext(HistoryFilterContext);
  if (!context) {
    throw new Error("useHistoryFilter must be used within a HistoryFilterProvider");
  }
  return context;
}
