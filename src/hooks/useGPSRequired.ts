import { useQuery } from "@tanstack/react-query";

/**
 * Custom hook to check if GPS is required for attendance/sales forms
 * Fetches the gps_required setting from the app_settings table
 * Defaults to true (GPS required) if the setting is not found
 */
export function useGPSRequired() {
  const { data: settings, isLoading } = useQuery({
    queryKey: ["settings"],
    queryFn: async () => {
      const res = await fetch("/api/admin/settings");
      if (!res.ok) {
        console.warn("Failed to fetch GPS settings, defaulting to GPS required");
        return { gps_required: true };
      }
      return res.json() as Promise<{ gps_required?: boolean }>;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: 1, // Only retry once if it fails
  });

  // Default to GPS required if loading or setting not found
  const gpsRequired = settings?.gps_required !== false;

  return {
    gpsRequired,
    isLoading,
  };
}
