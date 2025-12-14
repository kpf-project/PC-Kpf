"use client";

import { useCallback, useEffect, useState } from "react";

type PermissionState = "granted" | "denied" | "prompt" | "unsupported" | "unknown";

export function useGeoPermission() {
  const [status, setStatus] = useState<PermissionState>("unknown");

  useEffect(() => {
    let isMounted = true;

    const updateStatus = (state: PermissionState) => {
      if (isMounted) {
        setStatus(state);
      }
    };

    if (typeof navigator === "undefined" || !navigator.permissions?.query) {
      updateStatus("unsupported");
      return () => {
        isMounted = false;
      };
    }

    navigator.permissions
      .query({ name: "geolocation" })
      .then((permission) => {
        const mapPermission = () => {
          if (!isMounted) return;
          switch (permission.state) {
            case "granted":
            case "denied":
            case "prompt":
              updateStatus(permission.state);
              break;
            default:
              updateStatus("unknown");
              break;
          }
        };
        mapPermission();
        permission.onchange = mapPermission;
      })
      .catch(() => {
        updateStatus("unsupported");
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const requestPermission = useCallback(async () => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setStatus("unsupported");
      return { ok: false, status: "unsupported" as PermissionState };
    }

    try {
      await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0,
        });
      });
      setStatus("granted");
      return { ok: true, status: "granted" as PermissionState };
    } catch (error) {
      if (error instanceof GeolocationPositionError) {
        if (error.code === error.PERMISSION_DENIED) {
          setStatus("denied");
          return { ok: false, status: "denied" as PermissionState };
        }
      }
      return { ok: false, status };
    }
  }, [status]);

  return {
    status,
    requestPermission,
  };
}
