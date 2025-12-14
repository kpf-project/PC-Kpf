"use client";

import { useState, useMemo, useCallback } from "react";

export type SortDirection = "asc" | "desc" | null;

export type SortConfig<T> = {
  key: keyof T | null;
  direction: SortDirection;
};

export function useTableSort<T>(data: T[], defaultSort?: SortConfig<T>) {
  const [sortConfig, setSortConfig] = useState<SortConfig<T>>(
    defaultSort || { key: null, direction: null }
  );

  const handleSort = useCallback((key: keyof T) => {
    setSortConfig((prevConfig) => {
      // If clicking the same column
      if (prevConfig.key === key) {
        // Cycle through: asc -> desc -> null
        if (prevConfig.direction === "asc") {
          return { key, direction: "desc" };
        } else if (prevConfig.direction === "desc") {
          return { key: null, direction: null };
        }
      }
      // New column clicked
      return { key, direction: "asc" };
    });
  }, []);

  const sortedData = useMemo(() => {
    if (!sortConfig.key || !sortConfig.direction) {
      return data;
    }

    const sorted = [...data].sort((a, b) => {
      const aValue = a[sortConfig.key!];
      const bValue = b[sortConfig.key!];

      // Handle null/undefined values
      if (aValue == null) return 1;
      if (bValue == null) return -1;

      // Handle different types
      if (typeof aValue === "string" && typeof bValue === "string") {
        // String comparison (case-insensitive)
        const comparison = aValue.localeCompare(bValue, "th", {
          sensitivity: "base",
          numeric: true
        });
        return sortConfig.direction === "asc" ? comparison : -comparison;
      } else if (typeof aValue === "number" && typeof bValue === "number") {
        // Number comparison
        return sortConfig.direction === "asc" ? aValue - bValue : bValue - aValue;
      } else if (aValue instanceof Date && bValue instanceof Date) {
        // Date comparison
        const comparison = aValue.getTime() - bValue.getTime();
        return sortConfig.direction === "asc" ? comparison : -comparison;
      }

      // Default comparison
      const aStr = String(aValue);
      const bStr = String(bValue);
      const comparison = aStr.localeCompare(bStr, "th", {
        sensitivity: "base",
        numeric: true
      });
      return sortConfig.direction === "asc" ? comparison : -comparison;
    });

    return sorted;
  }, [data, sortConfig]);

  const getSortIcon = useCallback((key: keyof T) => {
    if (sortConfig.key !== key) {
      return "↕"; // Both arrows (sortable)
    }
    if (sortConfig.direction === "asc") {
      return "↑"; // Up arrow
    }
    if (sortConfig.direction === "desc") {
      return "↓"; // Down arrow
    }
    return "↕";
  }, [sortConfig]);

  const clearSort = useCallback(() => {
    setSortConfig({ key: null, direction: null });
  }, []);

  return {
    sortedData,
    sortConfig,
    handleSort,
    getSortIcon,
    clearSort,
  };
}