import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Location State Types
 */
export type LocationState =
  | { status: "idle" }
  | { status: "locating" }
  | { status: "error"; message: string }
  | { status: "resolved"; coords: GeolocationCoordinates };

export type EnsureLocationOptions = {
  /** Force refresh location even if already resolved */
  force?: boolean;
};

export type UseEnsureLocationOptions = {
  /** Custom error message when permission is denied */
  permissionDeniedMessage?: string;
  /** Whether GPS is required (will auto-fetch on mount if true) */
  gpsRequired?: boolean;
};

/**
 * Custom hook to manage geolocation with caching and error handling
 *
 * Features:
 * - ✅ Automatic caching (won't refetch if already resolved)
 * - ✅ Force refresh option
 * - ✅ Type-safe error handling
 * - ✅ SSR-safe (checks for navigator)
 * - ✅ High accuracy GPS with 20s timeout
 *
 * Benefits:
 * - Eliminates code duplication (~100 lines)
 * - Consistent geolocation behavior across app
 * - Easier to maintain and test
 *
 * @example
 * ```tsx
 * const { locationState, ensureLocation, refreshLocation } = useEnsureLocation({
 *   permissionDeniedMessage: "กรุณาอนุญาตการเข้าถึงตำแหน่งเพื่อบันทึกเวลา",
 *   gpsRequired: true
 * });
 *
 * // In submit handler:
 * const coords = await ensureLocation();
 * console.log(coords.latitude, coords.longitude);
 *
 * // Or force refresh:
 * const newCoords = await refreshLocation();
 * ```
 */
export function useEnsureLocation(options?: UseEnsureLocationOptions) {
  const {
    permissionDeniedMessage = "กรุณาอนุญาตการเข้าถึงตำแหน่ง",
    gpsRequired = false,
  } = options ?? {};

  const [locationState, setLocationState] = useState<LocationState>({ status: "idle" });
  const locationStateRef = useRef<LocationState>(locationState);

  // Keep ref in sync with state for callback access
  useEffect(() => {
    locationStateRef.current = locationState;
  }, [locationState]);

  /**
   * Main function to get current location
   * Returns cached coords if already resolved (unless force=true)
   */
  const ensureLocation = useCallback(
    async (opts?: EnsureLocationOptions): Promise<GeolocationCoordinates> => {
      const shouldForce = opts?.force === true;
      const currentState = locationStateRef.current;

      // Return cached location if available
      if (!shouldForce && currentState.status === "resolved") {
        return currentState.coords;
      }

      // Check if geolocation API is available
      if (typeof navigator === "undefined" || !("geolocation" in navigator)) {
        const message = "อุปกรณ์ของคุณไม่รองรับการขอพิกัด";
        setLocationState({ status: "error", message });
        throw new Error(message);
      }

      // Update state to "locating"
      setLocationState((prev) => {
        if (shouldForce) {
          // Force refresh: set to locating unless already locating
          if (prev.status === "locating") {
            return prev;
          }
          return { status: "locating" };
        }
        // Normal flow: only set to locating if not already resolved/locating
        if (prev.status === "resolved" || prev.status === "locating") {
          return prev;
        }
        return { status: "locating" };
      });

      try {
        // Request high-accuracy location
        const position = await new Promise<GeolocationPosition>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: true,
            timeout: 20000, // 20 seconds
            maximumAge: 0, // Don't use cached position
          });
        });

        // Success: update state and return coords
        setLocationState({ status: "resolved", coords: position.coords });
        return position.coords;
      } catch (error) {
        // Handle errors
        let message = "ไม่สามารถดึงพิกัดได้";
        if (error instanceof GeolocationPositionError) {
          if (error.code === error.PERMISSION_DENIED) {
            message = permissionDeniedMessage;
          } else if (error.message) {
            message = error.message;
          }
        }
        setLocationState({ status: "error", message });
        throw new Error(message);
      }
    },
    [permissionDeniedMessage],
  );

  /**
   * Convenience function to force refresh location
   * Equivalent to ensureLocation({ force: true })
   */
  const refreshLocation = useCallback(() => ensureLocation({ force: true }), [ensureLocation]);

  // Auto-fetch location on mount if GPS is required
  useEffect(() => {
    if (gpsRequired) {
      void ensureLocation().catch(() => {
        // Ignore error - user can grant permission later
        // Error is stored in locationState
      });
    }
  }, [ensureLocation, gpsRequired]);

  return {
    locationState,
    ensureLocation,
    refreshLocation,
  };
}
