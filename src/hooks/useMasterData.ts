import { useQuery } from "@tanstack/react-query";

/**
 * Master Data Types
 */
export type EmployeeOption = {
  id: string;
  name: string;
  defaultStoreId?: string | null;
};

export type StoreOption = {
  id: string;
  name: string;
  province?: string | null;
  address?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  radius?: number | null;
};

/**
 * Fetch employees from API
 */
async function fetchEmployees(): Promise<EmployeeOption[]> {
  const response = await fetch("/api/admin/employees");
  if (!response.ok) {
    throw new Error("ไม่สามารถโหลดรายชื่อพนักงานได้");
  }
  const data = (await response.json()) as { employees?: EmployeeOption[] };
  return Array.isArray(data.employees) ? data.employees : [];
}

/**
 * Fetch stores from API
 */
async function fetchStores(): Promise<StoreOption[]> {
  const response = await fetch("/api/admin/stores");
  if (!response.ok) {
    throw new Error("ไม่สามารถโหลดรายชื่อร้าน/หน่วยงานได้");
  }
  const data = (await response.json()) as { stores?: StoreOption[] };
  return Array.isArray(data.stores) ? data.stores : [];
}

/**
 * Custom hook to fetch employees with React Query
 *
 * Benefits:
 * - Automatic caching (5 minutes staleTime)
 * - Automatic retry on failure
 * - Shared data across components (no duplicate fetches)
 * - Loading and error states built-in
 */
export function useEmployees() {
  return useQuery({
    queryKey: ["employees"],
    queryFn: fetchEmployees,
    staleTime: 5 * 60 * 1000, // 5 minutes - data stays fresh
    // After 5 min, refetch in background while showing cached data
  });
}

/**
 * Custom hook to fetch stores with React Query
 *
 * Benefits: Same as useEmployees
 */
export function useStores() {
  return useQuery({
    queryKey: ["stores"],
    queryFn: fetchStores,
    staleTime: 5 * 60 * 1000, // 5 minutes - data stays fresh
  });
}
