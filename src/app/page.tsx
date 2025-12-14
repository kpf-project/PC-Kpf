"use client";

import Image from "next/image";
import Link from "next/link";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
} from "react";
import SiteNav from "@/components/SiteNav";
import GeofenceGuide from "@/components/attendance/GeofenceGuide";
import TransferTimeModal from "@/components/TransferTimeModal";
import { haversineDistance } from "@/lib/geo";
import { useGeoPermission } from "@/lib/useGeoPermission";
import { useGPSRequired } from "@/hooks/useGPSRequired";
import { useAuth } from "@/contexts/AuthContext";
import { CalendarCheck2, Info, SwitchCamera } from "lucide-react";
import { useEmployees, useStores, type EmployeeOption, type StoreOption } from "@/hooks/useMasterData";
import { useEnsureLocation, type LocationState } from "@/hooks/useEnsureLocation";
import NotificationPopup, { type NotificationType } from "@/components/NotificationPopup";

type AttendanceStatus = "check-in" | "check-out";

type SubmitState =
  | { status: "idle" }
  | { status: "submitting" }
  | { status: "error"; message: string }
  | { status: "success" };

const STATUS_META: Record<AttendanceStatus, { label: string; description: string; gradient: string }> = {
  "check-in": {
    label: "เข้างาน",
    description: "เริ่มปฏิบัติงาน",
    gradient: "from-blue-600 via-sky-500 to-cyan-400",
  },
  "check-out": {
    label: "ออกงาน",
    description: "สิ้นสุดภารกิจ",
    gradient: "from-indigo-600 via-blue-500 to-sky-400",
  },
};

const MAX_PHOTO_SIZE_MB = 5;

const today = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = `${now.getMonth() + 1}`.padStart(2, "0");
  const day = `${now.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const currentTime = () => {
  const now = new Date();
  const hour = `${now.getHours()}`.padStart(2, "0");
  const minute = `${now.getMinutes()}`.padStart(2, "0");
  return `${hour}:${minute}`;
};

export default function Home() {
  const { user } = useAuth();
  const isReadOnly = user?.role === 'sales';

  const [formState, setFormState] = useState({
    date: today(),
    time: currentTime(),
    status: "check-in" as AttendanceStatus,
    employeeName: "",
    storeName: "",
    note: "",
  });
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [photoTimestamp, setPhotoTimestamp] = useState<string | null>(null);
  const [submitState, setSubmitState] = useState<SubmitState>({ status: "idle" });

  // Notification popup state
  const [showNotification, setShowNotification] = useState(false);
  const [notificationType, setNotificationType] = useState<NotificationType>('success');
  const [notificationTitle, setNotificationTitle] = useState('');
  const [notificationMessage, setNotificationMessage] = useState('');

  // ✅ React Query: Replace useEffect fetch with hooks (cached, shared data)
  const { data: employees = [], isLoading: isLoadingEmployees, error: employeeErrorObj } = useEmployees();
  const { data: stores = [], isLoading: isLoadingStores, error: storeErrorObj } = useStores();

  // Convert Error objects to string for components (same format as before)
  const employeeError = employeeErrorObj?.message ?? null;
  const storeError = storeErrorObj?.message ?? null;

  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>("");
  const [selectedStoreId, setSelectedStoreId] = useState<string>("");
  const [isGuideOpen, setIsGuideOpen] = useState(false);

  useEffect(() => {
    console.log('[Page] isGuideOpen changed to:', isGuideOpen);
  }, [isGuideOpen]);
  const { status: permissionStatus, requestPermission } = useGeoPermission();
  const [isPermissionModalOpen, setIsPermissionModalOpen] = useState(false);
  const [assignedStores, setAssignedStores] = useState<StoreOption[]>([]);
  const [isLoadingAssignedStores, setIsLoadingAssignedStores] = useState(false);
  const { gpsRequired, isLoading: _isLoadingGPSSettings } = useGPSRequired();

  // ✅ Geolocation Hook: Extracted logic to reusable hook (eliminates ~80 lines duplication)
  const { locationState, ensureLocation: _ensureLocation, refreshLocation } = useEnsureLocation({
    permissionDeniedMessage: "กรุณาอนุญาตการเข้าถึงตำแหน่งเพื่อบันทึกเวลา",
    gpsRequired,
  });

  // Transfer modal state
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [transferData, setTransferData] = useState<{
    oldStore: string;
    newStore: string;
    checkInTime: string;
    checkInDate: string;
  } | null>(null);

  const selectedEmployee = useMemo(() => {
    if (!selectedEmployeeId) return null;
    return employees.find((employee) => employee.id === selectedEmployeeId) ?? null;
  }, [selectedEmployeeId, employees]);

  // Lock store only if employee has exactly 1 assigned store
  const isStoreLocked = assignedStores.length === 1;

  const lockedStore = useMemo(() => {
    if (!isStoreLocked || assignedStores.length !== 1) return null;
    return assignedStores[0] ?? null;
  }, [isStoreLocked, assignedStores]);

  const selectedStore = useMemo(() => {
    if (!selectedStoreId) return null;
    return stores.find((store) => store.id === selectedStoreId) ?? null;
  }, [selectedStoreId, stores]);

  const activeStore = useMemo(() => {
    if (lockedStore) return lockedStore;
    if (selectedStore) return selectedStore;
    if (formState.storeName) {
      return stores.find((store) => store.name === formState.storeName) ?? null;
    }
    return null;
  }, [lockedStore, selectedStore, formState.storeName, stores]);

  const locationSummary = useMemo(() => {
    if (locationState.status !== "resolved") return "";
    const { latitude, longitude, accuracy } = locationState.coords;
    const lat = latitude.toFixed(6);
    const lng = longitude.toFixed(6);
    const acc =
      typeof accuracy === "number" && Number.isFinite(accuracy)
        ? `±${Math.round(accuracy)}m`
        : "";
    return `Lat ${lat}, Lng ${lng} ${acc}`.trim();
  }, [locationState]);

  const updateField = useCallback(<K extends keyof typeof formState>(key: K, value: (typeof formState)[K]) => {
    setFormState((prev) => ({ ...prev, [key]: value }));
    setSubmitState((prev) => (prev.status === "idle" ? prev : { status: "idle" }));
  }, []);

  const convertFileToDataUrl = useCallback((file: File) =>
    new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve((reader.result as string) ?? "");
      reader.onerror = () =>
        reject(new Error("ไม่สามารถอ่านไฟล์รูปภาพได้ กรุณาลองใหม่อีกครั้ง"));
      reader.readAsDataURL(file);
    }),
  []);

  const applyPhotoFile = useCallback(
    (file: File | null): boolean => {
      if (!file) {
        if (photoPreview) {
          URL.revokeObjectURL(photoPreview);
        }
        setPhotoFile(null);
        setPhotoPreview(null);
        setPhotoTimestamp(null);
        return false;
      }
      const megabytes = file.size / (1024 * 1024);
      if (megabytes > MAX_PHOTO_SIZE_MB) {
        setSubmitState({
          status: "error",
          message: `ขนาดรูปใหญ่เกินไป (จำกัด ${MAX_PHOTO_SIZE_MB}MB)`,
        });
        return false;
      }
      setSubmitState((prev) => (prev.status === "idle" ? prev : { status: "idle" }));
      if (photoPreview) {
        URL.revokeObjectURL(photoPreview);
      }
      setPhotoFile(file);
      const url = URL.createObjectURL(file);
      setPhotoPreview(url);
      let timestampLabel = "";
      try {
        timestampLabel = new Intl.DateTimeFormat("th-TH", {
          dateStyle: "short",
          timeStyle: "medium",
        }).format(new Date());
      } catch {
        const now = new Date();
        timestampLabel = `${now.toLocaleDateString("th-TH")} ${now.toLocaleTimeString("th-TH")}`.trim();
      }
      setPhotoTimestamp(timestampLabel);
      return true;
    },
    [photoPreview, setSubmitState],
  );

  const handlePhotoChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0] ?? null;
      void applyPhotoFile(file);
      event.target.value = "";
    },
    [applyPhotoFile],
  );

  const handleCameraCapture = useCallback(
    (blob: Blob) => {
      const mime = blob.type && blob.type.startsWith("image/") ? blob.type : "image/jpeg";
      let file: File;
      try {
        file = new File([blob], `camera-${Date.now()}.jpg`, { type: mime });
      } catch {
        file = blob as File;
      }
      void applyPhotoFile(file);
    },
    [applyPhotoFile],
  );

  // ✅ ensureLocation and auto-fetch logic moved to useEnsureLocation hook

  // Auto-select employee based on GPS location - Memoized for performance
  const closestEmployeeData = useMemo(() => {
    if (!gpsRequired) return null;
    if (locationState.status !== "resolved") return null;
    if (selectedEmployeeId) return null; // Don't override if user already selected
    if (employees.length === 0 || stores.length === 0) return null;

    const { latitude: userLat, longitude: userLng } = locationState.coords;

    // Find closest employee by their primary store
    let closestEmployee: EmployeeOption | null = null;
    let closestDistance = Infinity;

    for (const employee of employees) {
      // Get employee's primary store
      const primaryStore = employee.defaultStoreId
        ? stores.find((s) => s.id === employee.defaultStoreId)
        : null;

      if (!primaryStore || !primaryStore.latitude || !primaryStore.longitude) {
        continue;
      }

      const distance = haversineDistance(
        { latitude: userLat, longitude: userLng },
        { latitude: primaryStore.latitude, longitude: primaryStore.longitude }
      );

      if (distance < closestDistance) {
        closestDistance = distance;
        closestEmployee = employee;
      }
    }

    // Return if found someone within reasonable range (5km)
    if (closestEmployee && closestDistance < 5000) {
      return { employee: closestEmployee, distance: closestDistance };
    }

    return null;
  }, [
    locationState.status,
    locationState.status === 'resolved' ? locationState.coords.latitude : null,
    locationState.status === 'resolved' ? locationState.coords.longitude : null,
    employees,
    stores,
    selectedEmployeeId,
    gpsRequired
  ]);

  // Apply auto-selection when closestEmployeeData changes
  useEffect(() => {
    if (closestEmployeeData) {
      console.log(
        `[Auto-select] พบพนักงาน "${closestEmployeeData.employee.name}" ใกล้ที่สุด (${Math.round(closestEmployeeData.distance)}m)`
      );
      setSelectedEmployeeId(closestEmployeeData.employee.id);
    }
  }, [closestEmployeeData]);

  // Fetch assigned stores (always fetch, regardless of GPS mode)
  useEffect(() => {
    if (!selectedEmployeeId) {
      setAssignedStores([]);
      return;
    }

    let active = true;
    const fetchAssignedStores = async () => {
      setIsLoadingAssignedStores(true);
      try {
        const response = await fetch(`/api/admin/employees/${selectedEmployeeId}/stores`);
        if (!response.ok) {
          throw new Error("ไม่สามารถโหลดรายการร้านที่ได้รับมอบหมายได้");
        }
        const data = (await response.json()) as {
          assignments?: Array<{
            storeId: string;
            storeName?: string;
            is_primary?: boolean;
          }>;
        };
        if (!active) return;
        const storeMap = new Map(stores.map((store) => [store.id, store]));
        const list = Array.isArray(data.assignments) ? data.assignments : [];

        // Find primary store
        const primaryAssignment = list.find((a) => a.is_primary);

        const mappedStores = list
          .map((assignment) => {
            const store = storeMap.get(assignment.storeId);
            if (store) {
              return store;
            }
            return {
              id: assignment.storeId,
              name: assignment.storeName ?? "ไม่ทราบชื่อร้าน",
            } as StoreOption;
          })
          .filter((storeOption, index, array) =>
            array.findIndex((item) => item.id === storeOption.id) === index,
          );

        // Sort: primary store first
        const sortedStores = primaryAssignment
          ? [
              ...mappedStores.filter((s) => s.id === primaryAssignment.storeId),
              ...mappedStores.filter((s) => s.id !== primaryAssignment.storeId),
            ]
          : mappedStores;

        setAssignedStores(sortedStores);

        // Auto-select first store (primary store for 2+, only store for 1)
        if (sortedStores.length > 0) {
          const autoSelectStore = sortedStores[0];
          setSelectedStoreId(autoSelectStore.id);
          updateField("storeName", autoSelectStore.name);
        } else {
          // Clear selection if no stores assigned
          setSelectedStoreId("");
          updateField("storeName", "");
        }
      } catch (error) {
        if (!active) return;
        console.error("Failed to fetch assigned stores:", error);
        setAssignedStores([]);
      } finally {
        if (active) setIsLoadingAssignedStores(false);
      }
    };

    void fetchAssignedStores();
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedEmployeeId]);

  const handleSubmit = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (!photoFile) {
        setSubmitState({
          status: "error",
          message: "กรุณาเลือกรูปภาพก่อนส่งแบบฟอร์ม",
        });
        return;
      }

      // Check if store is selected (required in both modes)
      if (!activeStore) {
        setSubmitState({
          status: "error",
          message: "กรุณาเลือกร้านค้า/หน่วยงานก่อนส่งแบบฟอร์ม",
        });
        return;
      }

      try {
        let coords: GeolocationCoordinates | undefined;

        // GPS Mode: get location and validate geofence (force refresh)
        if (gpsRequired) {
          coords = await refreshLocation();

          if (activeStore && coords) {
            const { latitude, longitude } = activeStore;
            if (
              typeof latitude === "number" &&
              Number.isFinite(latitude) &&
              typeof longitude === "number" &&
              Number.isFinite(longitude)
            ) {
              const radius = activeStore.radius ?? 100;
              const distance = haversineDistance(
                { latitude: coords.latitude, longitude: coords.longitude },
                { latitude, longitude },
              );
              if (distance > radius) {
                setSubmitState({
                  status: "error",
                  message: `ตำแหน่งปัจจุบันอยู่นอกพื้นที่ที่กำหนด (ห่าง ${Math.round(
                    distance,
                  )} ม. เกินรัศมี ${radius} ม.)`,
                });
                return;
              }
            }
          }
        }
        // Manual Mode: no GPS required, coords will be undefined

        setSubmitState({ status: "submitting" });
        const photoDataUrl = await convertFileToDataUrl(photoFile);
        const response = await fetch("/api/attendance", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...formState,
            photo: photoDataUrl,
            location: coords
              ? {
                  latitude: coords.latitude,
                  longitude: coords.longitude,
                  accuracy: coords.accuracy,
                }
              : undefined,
          }),
        });
        if (!response.ok) {
          const data = await response.json().catch(() => null);
          throw new Error(data?.message ?? "ไม่สามารถส่งข้อมูลได้");
        }

        // Check for transfer detection
        const data = await response.json();
        if (data.transferDetected && data.transferData) {
          // Show transfer modal
          setTransferData(data.transferData);
          setIsTransferModalOpen(true);
          setSubmitState({ status: "idle" });
          return;
        }

        if (photoPreview) URL.revokeObjectURL(photoPreview);
        setPhotoPreview(null);
        setPhotoFile(null);
        setPhotoTimestamp(null);
        // ✅ No need to reset locationState - location is still valid and cached
        setFormState((prev) => ({
          ...prev,
          time: currentTime(),
          note: "",
        }));
        (event.target as HTMLFormElement).reset();
        setSubmitState({ status: "idle" });

        // Show success notification
        setNotificationType('success');
        setNotificationTitle('บันทึกเวลาสำเร็จ');
        setNotificationMessage('ข้อมูลการลงเวลาได้รับการบันทึกเรียบร้อยแล้ว ตรวจสอบได้ในแดชบอร์ดทันที');
        setShowNotification(true);
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : gpsRequired
            ? "กรุณาอนุญาตการเข้าถึงตำแหน่งเพื่อบันทึกเวลา"
            : "ไม่สามารถบันทึกข้อมูลได้";
        setSubmitState({ status: "idle" });

        // Show error notification
        setNotificationType('error');
        setNotificationTitle('เกิดข้อผิดพลาด');
        setNotificationMessage(message);
        setShowNotification(true);
      }
    },
    [convertFileToDataUrl, refreshLocation, formState, photoFile, photoPreview, activeStore, gpsRequired],
  );


  // Transfer modal handlers
  const handleTransferConfirm = useCallback(
    async (info: {
      checkOutTime: string;
      checkOutPhoto: string;
      checkInTime: string;
      checkInPhoto: string;
    }) => {
      if (!transferData) return;

      try {
        // Get current GPS coordinates (force refresh)
        let coords: GeolocationCoordinates | undefined;
        if (gpsRequired) {
          coords = await refreshLocation();
        }

        const response = await fetch("/api/attendance/bulk", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            employeeName: formState.employeeName,
            checkInDate: transferData.checkInDate,
            checkInTime: transferData.checkInTime,
            oldStoreName: transferData.oldStore,
            checkOutTime: info.checkOutTime,
            checkOutPhoto: info.checkOutPhoto,
            newCheckInTime: info.checkInTime,
            newStoreName: activeStore?.name ?? "",
            newCheckInPhoto: info.checkInPhoto,
            currentCheckOutTime: formState.time,
            currentCheckOutStore: activeStore?.name ?? "",
            currentCheckOutPhoto: photoPreview!,
            currentLatitude: coords?.latitude ?? 0,
            currentLongitude: coords?.longitude ?? 0,
            currentSubdistrict: undefined,
            currentDistrict: undefined,
            currentProvince: undefined,
          }),
        });

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error ?? "ไม่สามารถบันทึกข้อมูลได้");
        }

        // Close modal and reset
        setIsTransferModalOpen(false);
        setTransferData(null);
        setSubmitState({ status: "idle" });

        // Clean up form
        if (photoPreview) URL.revokeObjectURL(photoPreview);
        setPhotoPreview(null);
        setPhotoFile(null);
        setPhotoTimestamp(null);
        // ✅ No need to reset locationState - location is still valid
        setFormState((prev) => ({
          ...prev,
          time: currentTime(),
          note: "",
        }));

        // Show success notification
        setNotificationType('success');
        setNotificationTitle('บันทึกการโอนย้ายสำเร็จ');
        setNotificationMessage('บันทึกการเข้า-ออกงานพร้อมการโอนย้ายสาขาเรียบร้อยแล้ว');
        setShowNotification(true);
      } catch (error) {
        console.error("[Transfer] Error:", error);
        throw error;
      }
    },
    [
      transferData,
      formState.employeeName,
      formState.time,
      activeStore,
      photoPreview,
      gpsRequired,
      refreshLocation,
    ]
  );

  const handleTransferSkip = useCallback(() => {
    // Just close modal and show success (original record was already saved)
    setIsTransferModalOpen(false);
    setTransferData(null);
    setSubmitState({ status: "idle" });

    // Clean up form
    if (photoPreview) URL.revokeObjectURL(photoPreview);
    setPhotoPreview(null);
    setPhotoFile(null);
    setPhotoTimestamp(null);
    // ✅ No need to reset locationState - location is still valid
    setFormState((prev) => ({
      ...prev,
      time: currentTime(),
      note: "",
    }));

    // Show success notification
    setNotificationType('success');
    setNotificationTitle('บันทึกเวลาสำเร็จ');
    setNotificationMessage('ข้อมูลการลงเวลาได้รับการบันทึกเรียบร้อยแล้ว ตรวจสอบได้ในแดชบอร์ดทันที');
    setShowNotification(true);
  }, [photoPreview]);

  const handleTransferClose = useCallback(() => {
    setIsTransferModalOpen(false);
    setTransferData(null);
  }, []);

  // ✅ useEffect removed: Now using React Query hooks above (useEmployees, useStores)
  // Data fetching, caching, and error handling are automatic

  useEffect(() => {
    setSelectedEmployeeId((prev) =>
      prev && employees.some((employee) => employee.id === prev) ? prev : "",
    );
  }, [employees]);

  useEffect(() => {
    setSelectedStoreId((prev) =>
      prev && stores.some((store) => store.id === prev) ? prev : "",
    );
  }, [stores]);

  useEffect(() => {
    if (!selectedEmployee) {
      setFormState((prev) =>
        prev.employeeName === ""
          ? prev
          : {
              ...prev,
              employeeName: "",
            },
      );
      return;
    }
    setFormState((prev) =>
      prev.employeeName === selectedEmployee.name
        ? prev
        : {
            ...prev,
            employeeName: selectedEmployee.name,
          },
    );

    // Auto-select store if employee has exactly 1 assigned store
    if (isStoreLocked && lockedStore) {
      setSelectedStoreId(lockedStore.id);
    }
  }, [selectedEmployee, isStoreLocked, lockedStore]);

  useEffect(() => {
    const effectiveStore = lockedStore ?? selectedStore;
    if (!effectiveStore) {
      setFormState((prev) =>
        prev.storeName === ""
          ? prev
          : {
              ...prev,
              storeName: "",
            },
      );
      if (!isStoreLocked) {
        setSelectedStoreId((prev) => prev);
      }
      return;
    }
    setFormState((prev) =>
      prev.storeName === effectiveStore.name
        ? prev
        : {
            ...prev,
            storeName: effectiveStore.name,
          },
    );
    if (!isStoreLocked && selectedStoreId !== effectiveStore.id) {
      setSelectedStoreId(effectiveStore.id);
    }
  }, [lockedStore, selectedStore, isStoreLocked, selectedStoreId]);

  useEffect(() => () => {
    if (photoPreview) URL.revokeObjectURL(photoPreview);
  }, [photoPreview]);

  const isSubmitting = submitState.status === "submitting";
  const hasEmployees = employees.length > 0;
  const hasStores = stores.length > 0;
  const disableSubmit =
    isSubmitting ||
    !hasEmployees ||
    !hasStores ||
    (gpsRequired && locationState.status === "locating") ||
    (!gpsRequired && !selectedStoreId);

  return (
    <>
      <div className="relative bg-gradient-to-br from-[#eef4ff] via-[#e4ecff] to-[#f8fbff]">
        <BackgroundGlow />

        <SiteNav />

        {/* ✅ FIX: เพิ่ม pt สำหรับ fixed header บนมือถือ */}
        <div className="relative z-10 pt-28 pb-10 sm:px-4 sm:px-6 lg:pt-[120px] lg:px-8">
          <div className="mx-auto flex w-full max-w-none sm:max-w-5xl flex-col gap-0 sm:gap-6">

        <section className="relative overflow-hidden bg-white/95 sm:rounded-[36px] sm:border sm:border-white/70 backdrop-blur-none lg:backdrop-blur-sm">
          <CardGlow />

          <form onSubmit={handleSubmit} className="relative z-10 space-y-10 p-4 sm:p-8 sm:p-10">
            <header className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.35em] text-blue-500">ATTENDANCE</p>
                <h1 className="mt-2 text-2xl font-semibold text-slate-900">ฟอร์มลงเวลาหน้างาน</h1>
                <p className="mt-2 text-sm text-slate-500">
                  บันทึกเวลา สถานะ รูป และพิกัด ส่งตรงเข้าแดชบอร์ดทันที
                </p>
                <Link
                  href="/admin/settings?section=leaves"
                  className="mt-3 inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-4 py-2 text-xs font-semibold text-blue-600 shadow-sm transition hover:border-blue-300 hover:bg-blue-100 hover:text-blue-700"
                >
                  <CalendarCheck2 className="h-3.5 w-3.5" />
                  <span>จัดการการลา</span>
                </Link>
              </div>
              <StatusSelector
                status={formState.status}
                onChange={(value) => updateField("status", value)}
                disabled={isReadOnly}
              />
            </header>

            {isReadOnly && (
              <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">
                <div className="flex items-start gap-3">
                  <Info className="h-5 w-5 flex-shrink-0 text-blue-600" />
                  <div>
                    <p className="text-sm font-semibold text-blue-900">
                      โหมดดูอย่างเดียว (Read-Only)
                    </p>
                    <p className="mt-1 text-xs text-blue-700">
                      คุณสามารถดูข้อมูลได้เท่านั้น ไม่สามารถแก้ไขหรือบันทึกข้อมูลใหม่ได้
                    </p>
                  </div>
                </div>
              </div>
            )}
            <div className="grid gap-8 lg:grid-cols-[1.15fr_0.85fr]">
              <div className="space-y-6">
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="วันที่" htmlFor="date" helper="เลือกวันที่ปฏิบัติงาน">
                    <input
                      id="date"
                      type="date"
                      value={formState.date}
                      onChange={(event) => updateField("date", event.target.value)}
                      className={`form-input ${isReadOnly ? 'cursor-not-allowed opacity-60' : ''}`}
                      disabled={isReadOnly}
                      required
                    />
                  </Field>
                  <Field label="เวลา" htmlFor="time">
                    <div className="flex gap-2">
                      <select
                        value={formState.time.split(':')[0] || '00'}
                        onChange={(e) => {
                          const hour = e.target.value;
                          const minute = formState.time.split(':')[1] || '00';
                          updateField("time", `${hour}:${minute}`);
                        }}
                        className={`form-input flex-1 ${isReadOnly ? 'cursor-not-allowed opacity-60' : ''}`}
                        disabled={isReadOnly}
                        required
                      >
                        {Array.from({ length: 24 }, (_, i) => {
                          const hour = i.toString().padStart(2, '0');
                          return (
                            <option key={i} value={hour}>
                              {hour}
                            </option>
                          );
                        })}
                      </select>
                      <span className="flex items-center text-xl font-bold">:</span>
                      <select
                        value={formState.time.split(':')[1] || '00'}
                        onChange={(e) => {
                          const hour = formState.time.split(':')[0] || '00';
                          const minute = e.target.value;
                          updateField("time", `${hour}:${minute}`);
                        }}
                        className={`form-input flex-1 ${isReadOnly ? 'cursor-not-allowed opacity-60' : ''}`}
                        disabled={isReadOnly}
                        required
                      >
                        {Array.from({ length: 60 }, (_, i) => {
                          const minute = i.toString().padStart(2, '0');
                          return (
                            <option key={i} value={minute}>
                              {minute}
                            </option>
                          );
                        })}
                      </select>
                    </div>
                  </Field>
                </div>

                <EmployeeField
                  employees={employees}
                  isLoading={isLoadingEmployees}
                  error={employeeError}
                  value={selectedEmployeeId}
                  onChange={setSelectedEmployeeId}
                  stores={stores}
                  disabled={isReadOnly}
                />

                <StoreField
                  stores={stores}
                  isLoading={isLoadingStores}
                  error={storeError}
                  value={selectedStoreId}
                  onChange={setSelectedStoreId}
                  disabled={isStoreLocked || isReadOnly}
                  gpsRequired={gpsRequired}
                  assignedStores={assignedStores}
                  isLoadingAssignedStores={isLoadingAssignedStores}
                />

                {activeStore && activeStore.latitude && activeStore.longitude && (
                  <button
                    type="button"
                    onClick={() => {
                      console.log('[DEBUG] Opening map guide for store:', {
                        name: activeStore.name,
                        lat: activeStore.latitude,
                        lng: activeStore.longitude,
                        radius: activeStore.radius,
                      });
                      setIsGuideOpen(true);
                    }}
                    className="inline-flex items-center justify-center gap-2 rounded-2xl border border-blue-200 bg-white px-4 py-3 text-xs font-semibold text-blue-600 shadow-inner hover:bg-blue-50"
                  >
                    🗺️ ดูตำแหน่งบนแผนที่นำทาง
                  </button>
                )}
                {activeStore && !activeStore.latitude && !activeStore.longitude && (
                  <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-600">
                    ⚠️ ร้านนี้ยังไม่ได้ตั้งค่าพิกัด ไม่สามารถแสดงแผนที่ได้
                  </div>
                )}

                <Field label="หมายเหตุ" htmlFor="note" helper="เพิ่มเติม (ถ้ามี)">
                  <input
                    id="note"
                    type="text"
                    value={formState.note}
                    onChange={(event) => updateField("note", event.target.value)}
                    className={`form-input ${isReadOnly ? 'cursor-not-allowed opacity-60' : ''}`}
                    placeholder="แจ้งภารกิจหรือรายละเอียดเพิ่มเติม"
                    disabled={isReadOnly}
                  />
                </Field>
              </div>

              <aside className="space-y-6">
                <PhotoUploader
                  photoPreview={photoPreview}
                  photoFile={photoFile}
                  photoTimestamp={photoTimestamp}
                  onChange={handlePhotoChange}
                  onCapture={handleCameraCapture}
                  disabled={isReadOnly}
                />
                {gpsRequired ? (
                  <LocationCard
                    locationState={locationState}
                    locationSummary={locationSummary}
                    permissionStatus={permissionStatus}
                    onRequestPermission={requestPermission}
                    onShowPermissionHelp={() => setIsPermissionModalOpen(true)}
                  />
                ) : (
                  <div className="rounded-3xl border border-blue-100 bg-white/80 p-5 shadow-inner shadow-blue-100/50">
                    <div className="flex items-start gap-4">
                      <svg className="mt-1 h-5 w-5 text-blue-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="10" />
                        <path d="M12 16v-4" />
                        <path d="M12 8h.01" />
                      </svg>
                      <div>
                        <p className="text-sm font-semibold text-slate-800">โหมดเลือกร้านด้วยตนเอง</p>
                        <p className="text-xs text-slate-500 mt-1">
                          GPS ถูกปิดโดยผู้ดูแลระบบ กรุณาเลือกร้านค้าจาก dropdown ด้านซ้าย
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </aside>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <span className="text-xs text-slate-500">
                <span className="font-semibold text-slate-700">เวลาปัจจุบัน:</span>{" "}
                {formState.time} •{" "}
                <span className="font-semibold text-slate-700">สถานะ:</span>{" "}
                {STATUS_META[formState.status].label}
              </span>
              <span className="text-xs text-slate-400">
                ระบบจะเพิ่มข้อมูลลงแดชบอร์ดพร้อมลิงก์รูปให้ตรวจสอบย้อนกลับได้
              </span>
            </div>

            <button
              type="submit"
              disabled={disableSubmit || isReadOnly}
              className={`relative flex w-full items-center justify-center gap-3 overflow-hidden rounded-[28px] bg-gradient-to-r from-blue-600 via-sky-500 to-indigo-500 px-6 py-4 text-base font-semibold text-white shadow-[0_35px_100px_-70px_rgba(37,99,235,1)] transition hover:shadow-[0_40px_115px_-75px_rgba(37,99,235,1)] focus:outline-none focus:ring-2 focus:ring-blue-200 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-70 ${isReadOnly ? 'opacity-50' : ''}`}
            >
              {isSubmitting ? (
                <>
                  <span className="inline-flex h-3 w-3 animate-spin rounded-full border-2 border-white border-b-transparent" />
                  กำลังบันทึก...
                </>
              ) : (
                <>
                  <CloudIcon className="h-5 w-5" /> บันทึกข้อมูล
                </>
              )}
            </button>

            {!hasEmployees && !isLoadingEmployees && (
              <p className="text-center text-xs text-amber-600">
                ต้องเพิ่มรายชื่อพนักงานในหน้า Admin ก่อนจึงจะบันทึกได้
              </p>
            )}
            {!hasStores && !isLoadingStores && (
              <p className="text-center text-xs text-amber-600">
                ต้องเพิ่มข้อมูลร้าน/หน่วยงานในหน้า Admin ก่อนจึงจะบันทึกได้
              </p>
            )}

            <p className="text-center text-xs text-slate-400">
              ระบบจะรีเฟรชเวลาปัจจุบันอัตโนมัติหลังบันทึกสำเร็จ
            </p>
          </form>
        </section>
          </div>
        </div>
      </div>
      {/* Notification Popup */}
      <NotificationPopup
        isOpen={showNotification}
        type={notificationType}
        title={notificationTitle}
        message={notificationMessage}
        onClose={() => setShowNotification(false)}
      />
      {activeStore && (
        <GeofenceGuide
          isOpen={isGuideOpen}
          onClose={() => {
            console.log('[Page] Closing guide...');
            setIsGuideOpen(false);
          }}
          store={{
            name: activeStore.name,
            address: activeStore.address ?? null,
            latitude: activeStore.latitude ?? null,
            longitude: activeStore.longitude ?? null,
            radius: activeStore.radius ?? null,
          }}
        />
      )}
      <PermissionHelpModal
        isOpen={isPermissionModalOpen}
        onClose={() => setIsPermissionModalOpen(false)}
      />
      {transferData && (
        <TransferTimeModal
          isOpen={isTransferModalOpen}
          transferData={{
            oldStore: transferData.oldStore,
            newStore: activeStore?.name ?? "",
            checkInTime: transferData.checkInTime,
            checkInDate: transferData.checkInDate,
          }}
          onConfirm={handleTransferConfirm}
          onSkip={handleTransferSkip}
          onClose={handleTransferClose}
        />
      )}
    </>
  );
}

function BackgroundGlow() {
  return (
    <div className="pointer-events-none absolute inset-0 hidden lg:block" aria-hidden>
      <div
        className="absolute inset-0"
        style={{
          background: `
            radial-gradient(60% 55% at 50% 0%, rgba(59, 130, 246, 0.18), transparent),
            radial-gradient(55% 60% at 85% 85%, rgba(56, 189, 248, 0.16), transparent),
            radial-gradient(45% 55% at 0% 40%, rgba(255, 255, 255, 0.45), transparent)
          `,
        }}
      />
    </div>
  );
}

function CardGlow() {
  return (
    <div className="pointer-events-none absolute inset-0 hidden lg:block" aria-hidden>
      <div
        className="absolute inset-0"
        style={{
          background: `
            radial-gradient(40% 55% at 90% 5%, rgba(191, 219, 254, 0.35), transparent),
            radial-gradient(40% 55% at 20% 100%, rgba(125, 211, 252, 0.28), transparent)
          `,
        }}
      />
    </div>
  );
}

function StatusSelector({
  status,
  onChange,
  disabled,
}: {
  status: AttendanceStatus;
  onChange: (value: AttendanceStatus) => void;
  disabled?: boolean;
}) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:w-auto">
      {(Object.keys(STATUS_META) as AttendanceStatus[]).map((current) => {
        const meta = STATUS_META[current];
        const isActive = current === status;
        return (
          <button
            key={current}
            type="button"
            onClick={() => onChange(current)}
            disabled={disabled}
            className={`relative overflow-hidden rounded-3xl border px-4 py-3 text-left transition-all duration-300 ${
              isActive
                ? `border-transparent bg-gradient-to-br ${meta.gradient} text-white shadow-[0_30px_80px_-55px_rgba(59,130,246,1)]`
                : "border-blue-100/80 bg-white/80 text-slate-600 hover:border-blue-200 hover:bg-white"
            } ${disabled ? 'cursor-not-allowed opacity-60' : ''}`}
          >
            <div className="absolute inset-0 opacity-50">
              <div className="absolute -top-10 left-1/2 h-20 w-20 -translate-x-1/2 rounded-full bg-white/40 blur-2xl" />
            </div>
            <div className="relative z-10 flex items-start gap-3">
              <span
                className={`flex h-10 w-10 items-center justify-center rounded-2xl border text-sm font-semibold ${
                  isActive ? "border-white/40 bg-white/10 text-white" : "border-blue-100 bg-white text-blue-500"
                }`}
              >
                {current === "check-in" ? (
                  <CheckInIcon className={isActive ? "h-5 w-5 text-white" : "h-5 w-5 text-blue-500"} />
                ) : (
                  <CheckOutIcon className={isActive ? "h-5 w-5 text-white" : "h-5 w-5 text-indigo-500"} />
                )}
              </span>
              <div>
                <p className={`text-sm font-semibold ${isActive ? "text-white" : "text-slate-800"}`}>{meta.label}</p>
                <p className={`mt-1 text-xs ${isActive ? "text-white/80" : "text-slate-500"}`}>{meta.description}</p>
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}

function EmployeeField({
  employees,
  stores,
  isLoading,
  error,
  value,
  onChange,
  disabled,
}: {
  employees: EmployeeOption[];
  stores: StoreOption[];
  isLoading: boolean;
  error: string | null;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  const hasEmployees = employees.length > 0;
  return (
    <Field label="ชื่อพนักงาน" htmlFor="employeeName" helper="เลือกจากรายชื่อที่ตั้งค่าไว้">
      {isLoading ? (
        <div className="form-input flex h-[52px] items-center justify-center text-xs text-slate-400">
          กำลังโหลดรายชื่อพนักงาน...
        </div>
      ) : hasEmployees ? (
        <select
          id="employeeName"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className={`form-input ${disabled ? 'cursor-not-allowed opacity-60' : ''}`}
          disabled={disabled}
          required
        >
          <option value="">เลือกพนักงาน</option>
          {employees.map((employee) => {
            const assignedStore = employee.defaultStoreId
              ? stores.find((store) => store.id === employee.defaultStoreId)
              : null;
            const label = assignedStore
              ? `${employee.name} — ${assignedStore.name}`
              : employee.name;
            return (
              <option key={employee.id} value={employee.id}>
                {label}
              </option>
            );
          })}
        </select>
      ) : (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-600">
          ยังไม่มีรายชื่อพนักงาน กรุณาเพิ่มผ่านหน้า Admin ก่อนใช้งาน
        </div>
      )}
      {error && <p className="text-xs text-red-500">{error}</p>}
    </Field>
  );
}

function StoreField({
  stores,
  isLoading,
  error,
  value,
  onChange,
  disabled,
  gpsRequired,
  assignedStores,
  isLoadingAssignedStores,
}: {
  stores: StoreOption[];
  isLoading: boolean;
  error: string | null;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  gpsRequired: boolean;
  assignedStores: StoreOption[];
  isLoadingAssignedStores: boolean;
}) {
  const hasStores = stores.length > 0;
  const hasAssignedStores = assignedStores.length > 0;

  // Always use assigned stores if available (regardless of GPS mode)
  const storeOptions = hasAssignedStores ? assignedStores : stores;
  const isManualMode = !gpsRequired;

  return (
    <Field label="ชื่อร้านค้า / หน่วยงาน" htmlFor="storeName" helper="สถานที่ปฏิบัติงาน">
      {isLoading || (isManualMode && isLoadingAssignedStores) ? (
        <div className="form-input flex h-[52px] items-center justify-center text-xs text-slate-400">
          กำลังโหลดรายชื่อร้าน/หน่วยงาน...
        </div>
      ) : hasStores ? (
        <div className="space-y-1">
          {isManualMode && !hasAssignedStores && (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-600 mb-2">
              พนักงานคนนี้ยังไม่ได้รับมอบหมายร้านค้า กรุณาติดต่อผู้ดูแลระบบ
            </div>
          )}
          {isManualMode && (
            <div className="rounded-2xl border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-600 mb-2">
              โหมดเลือกร้านด้วยตนเอง (GPS ถูกปิดโดยผู้ดูแลระบบ)
            </div>
          )}
          <select
            id="storeName"
            value={value}
            onChange={(event) => onChange(event.target.value)}
            className={`form-input disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500 ${disabled ? 'opacity-60' : ''}`}
            disabled={disabled || (isManualMode && !hasAssignedStores)}
            required
          >
            <option value="">เลือกร้าน / หน่วยงาน</option>
            {storeOptions.map((store) => {
              const label = store.province ? `${store.name} (${store.province})` : store.name;
              return (
                <option key={store.id} value={store.id}>
                  {label}
                </option>
              );
            })}
          </select>
          {disabled && (
            <p className="text-xs text-slate-500">
              ร้าน/หน่วยงานถูกกำหนดตามพื้นที่รับผิดชอบของพนักงาน
            </p>
          )}
        </div>
      ) : (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-600">
          ยังไม่มีข้อมูลร้าน/หน่วยงาน กรุณาเพิ่มผ่านหน้า Admin ก่อนใช้งาน
        </div>
      )}
      {error && <p className="text-xs text-red-500">{error}</p>}
    </Field>
  );
}

function PhotoUploader({
  photoPreview,
  photoFile,
  photoTimestamp,
  onChange,
  onCapture,
  disabled,
}: {
  photoPreview: string | null;
  photoFile: File | null;
  photoTimestamp: string | null;
  onChange: (event: ChangeEvent<HTMLInputElement>) => void;
  onCapture: (blob: Blob) => void;
  disabled?: boolean;
}) {
  const [canUseCamera, setCanUseCamera] = useState(false);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [isRequestingCamera, setIsRequestingCamera] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('environment');
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    setCanUseCamera(typeof navigator !== "undefined" && Boolean(navigator.mediaDevices?.getUserMedia));
  }, []);

  const stopCameraStream = useCallback(() => {
    const stream = streamRef.current;
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setIsCameraActive(false);
  }, []);

  useEffect(
    () => () => {
      stopCameraStream();
    },
    [stopCameraStream],
  );

  useEffect(() => {
    if (!isCameraActive) return;
    const video = videoRef.current;
    const stream = streamRef.current;
    if (video && stream) {
      video.srcObject = stream;
      const playPromise = video.play();
      if (playPromise) {
        void playPromise.catch(() => undefined);
      }
    }
  }, [isCameraActive]);

  const openCamera = useCallback(async (mode: 'user' | 'environment' = facingMode) => {
    if (!canUseCamera || isRequestingCamera) return;
    setCameraError(null);
    setIsRequestingCamera(true);

    // Stop existing stream first
    stopCameraStream();

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: mode } },
      });
      streamRef.current = stream;
      setIsCameraActive(true);
      setFacingMode(mode);
    } catch (error) {
      const raw = error instanceof Error ? error.message : "ไม่สามารถเปิดกล้องได้";
      const message =
        raw.toLowerCase().includes("denied") || raw.toLowerCase().includes("permission")
          ? "กรุณาอนุญาตให้เข้าถึงกล้องก่อนถ่ายรูป"
          : "ไม่สามารถเปิดกล้องได้";
      setCameraError(message);
      stopCameraStream();
    } finally {
      setIsRequestingCamera(false);
    }
  }, [canUseCamera, isRequestingCamera, stopCameraStream, facingMode]);

  const handleCaptureClick = useCallback(async () => {
    const video = videoRef.current;
    if (!video) {
      setCameraError("ไม่พบกล้องสำหรับถ่ายรูป");
      return;
    }
    const width = video.videoWidth || 1280;
    const height = video.videoHeight || 720;
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) {
      setCameraError("ไม่สามารถถ่ายรูปได้");
      return;
    }
    context.drawImage(video, 0, 0, width, height);
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", 0.9),
    );
    if (!blob) {
      setCameraError("ไม่สามารถสร้างไฟล์รูปภาพได้");
      return;
    }
    onCapture(blob);
    setCameraError(null);
    stopCameraStream();
  }, [onCapture, stopCameraStream]);

  const handleCloseCamera = useCallback(() => {
    stopCameraStream();
    setCameraError(null);
  }, [stopCameraStream]);

  const handleSwitchCamera = useCallback(async () => {
    const newMode = facingMode === 'environment' ? 'user' : 'environment';
    await openCamera(newMode);
  }, [facingMode, openCamera]);

  return (
    <div className="rounded-3xl border border-blue-100 bg-white/80 p-5 shadow-inner shadow-blue-100/50">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-slate-800">รูปยืนยันหน้างาน</p>
          <p className="text-xs text-slate-500">จำกัด {MAX_PHOTO_SIZE_MB}MB • รองรับ JPG / PNG</p>
        </div>
        <span className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-blue-500">
          {MAX_PHOTO_SIZE_MB}MB
        </span>
      </div>

      <label
        htmlFor="photo"
        className={`mt-4 flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-blue-200 bg-white/85 px-5 py-6 text-center transition hover:border-blue-300 hover:bg-white ${disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'}`}
      >
        <input id="photo" type="file" accept="image/*" capture="environment" className="sr-only" onChange={onChange} disabled={disabled} />
        {photoPreview ? (
          <div className="relative w-full overflow-hidden rounded-2xl border border-blue-100 shadow-lg">
            <Image
              src={photoPreview}
              alt="พรีวิวรูปถ่าย"
              width={360}
              height={220}
              unoptimized
              className="h-44 w-full object-cover"
            />
            {photoTimestamp && (
              <span className="absolute bottom-3 right-3 rounded-full bg-slate-900/70 px-3 py-1 text-[11px] font-semibold text-white shadow">
                {photoTimestamp}
              </span>
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2 text-sm text-blue-500">
            <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-500">
              แตะเพื่อถ่ายหรือเลือกรูป
            </span>
            <span className="text-xs text-blue-400">แนะนำให้ใช้กล้องหลังเพื่อความคมชัด</span>
          </div>
        )}
      </label>

      {photoFile && (
        <p className="mt-3 rounded-2xl border border-emerald-100 bg-emerald-50/70 px-3 py-2 text-xs text-emerald-600">
          รูปถูกเลือกแล้ว ตรวจสอบก่อนส่งข้อมูล
        </p>
      )}

      {canUseCamera && !disabled && (
        <div className="mt-4 space-y-3">
          <button
            type="button"
            onClick={isCameraActive ? handleCloseCamera : () => openCamera()}
            disabled={isRequestingCamera}
            className="inline-flex w-full items-center justify-center rounded-2xl border border-blue-200 bg-white px-4 py-2 text-xs font-semibold text-blue-600 shadow-sm transition hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {isCameraActive ? "ปิดกล้อง" : isRequestingCamera ? "กำลังเปิดกล้อง..." : "เปิดกล้องเพื่อถ่ายรูป"}
          </button>
          {cameraError && <p className="text-xs text-red-500">{cameraError}</p>}
          {isCameraActive && (
            <div className="space-y-3 rounded-2xl border border-blue-200 bg-blue-50/40 p-3">
              <div className="relative">
                <video
                  ref={videoRef}
                  className="aspect-video w-full rounded-xl bg-black/70"
                  autoPlay
                  playsInline
                  muted
                />
                <button
                  type="button"
                  onClick={handleSwitchCamera}
                  disabled={isRequestingCamera}
                  className="absolute right-3 top-3 rounded-full border border-white/30 bg-black/50 p-2 text-white shadow-lg backdrop-blur-sm transition hover:bg-black/70 disabled:cursor-not-allowed disabled:opacity-50"
                  title="สลับกล้อง"
                >
                  <SwitchCamera className="h-5 w-5" />
                </button>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleCaptureClick}
                  className="flex-1 rounded-full bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-blue-700"
                >
                  ถ่ายภาพ
                </button>
                <button
                  type="button"
                  onClick={handleSwitchCamera}
                  disabled={isRequestingCamera}
                  className="inline-flex items-center gap-1.5 rounded-full border border-blue-300 bg-white px-3 py-2 text-xs font-semibold text-blue-600 hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-50"
                  title="สลับกล้อง"
                >
                  <SwitchCamera className="h-4 w-4" />
                  <span className="hidden sm:inline">สลับ</span>
                </button>
                <button
                  type="button"
                  onClick={handleCloseCamera}
                  className="rounded-full border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100"
                >
                  ยกเลิก
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function LocationCard({
  locationState,
  locationSummary,
  permissionStatus,
  onRequestPermission,
  onShowPermissionHelp,
}: {
  locationState: LocationState;
  locationSummary: string;
  permissionStatus: ReturnType<typeof useGeoPermission>["status"];
  onRequestPermission: () => Promise<{ ok: boolean; status: string }>;
  onShowPermissionHelp: () => void;
}) {
  const isDenied = permissionStatus === "denied";
  const isUnsupported = permissionStatus === "unsupported";

  return (
    <div className="rounded-3xl border border-blue-100 bg-white/80 p-5 shadow-inner shadow-blue-100/50">
      <div className="flex items-start gap-4">
        <LocationIcon className="mt-1 h-5 w-5 text-blue-500" />
        <div>
          <p className="text-sm font-semibold text-slate-800">ตำแหน่งปัจจุบัน</p>
          <p className="text-xs text-slate-500">
            ระบบจะร้องขอพิกัดอัตโนมัติ หากมีการปฏิเสธกรุณาเปิดใช้งานตำแหน่งแล้วกดบันทึกอีกครั้ง
          </p>
        </div>
      </div>
      <div className="mt-4 space-y-3 rounded-2xl border border-blue-100 bg-white px-4 py-4 text-sm text-slate-600">
        {isUnsupported && (
          <div className="space-y-2 text-amber-600">
            <span>อุปกรณ์หรือเบราว์เซอร์นี้ไม่รองรับการแชร์ตำแหน่งอัตโนมัติ</span>
            <span className="block text-xs text-slate-500">
              กรุณาระบุข้อมูลตำแหน่งด้วยวิธีอื่น หรือใช้เบราว์เซอร์ที่รองรับ
            </span>
          </div>
        )}
        {!isUnsupported && (
          <>
            {isDenied && (
              <div className="space-y-2 text-red-500">
                <span>ระบบถูกปฏิเสธสิทธิ์ตำแหน่ง</span>
                <span className="block text-xs text-slate-500">
                  {typeof navigator !== 'undefined' && /iPhone|iPad|iPod/.test(navigator.userAgent) ? (
                    <>iOS: ไปที่ <strong>Settings → Safari → Location</strong> เลือก &quot;Ask&quot; หรือ &quot;Allow&quot; แล้วกด &quot;เปิดคู่มือการอนุญาต&quot; ด้านล่าง</>
                  ) : (
                    <>เปิดการอนุญาตตำแหน่งในการตั้งค่าเบราว์เซอร์ / แอป แล้วกด &quot;ขอสิทธิ์ตำแหน่ง&quot; อีกครั้ง</>
                  )}
                </span>
              </div>
            )}

            {!isDenied && locationState.status === "idle" && (
              <span className="flex items-center gap-2 text-slate-500">
                <span className="inline-flex h-2.5 w-2.5 rounded-full bg-slate-300" />
                รอการเปิดการเข้าถึงตำแหน่งจากระบบ
              </span>
            )}
            {locationState.status === "locating" && (
              <span className="flex items-center gap-2 text-blue-600">
                <span className="inline-flex h-2.5 w-2.5 animate-ping rounded-full bg-blue-500" />
                กำลังดึงพิกัด กรุณารอสักครู่...
              </span>
            )}
            {locationState.status === "error" && (
              <div className="space-y-2 text-red-500">
                <span>ไม่สามารถดึงพิกัดได้: {locationState.message}</span>
                <span className="block text-xs text-slate-500">
                  {typeof navigator !== 'undefined' && /iPhone|iPad|iPod/.test(navigator.userAgent) ? (
                    <>iOS: ตรวจสอบ <strong>Settings → Safari → Location</strong> แล้วกด &quot;เปิดคู่มือการอนุญาต&quot; ด้านล่าง</>
                  ) : (
                    <>เปิด Location Services แล้วกด &quot;ขอสิทธิ์ตำแหน่ง&quot; หรือปุ่มบันทึกอีกครั้ง</>
                  )}
                </span>
              </div>
            )}
            {locationState.status === "resolved" && (
              <div className="flex flex-col gap-2 text-sm text-emerald-600">
                <span className="font-semibold">พิกัดถูกบันทึกแล้ว</span>
                <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs text-emerald-600">
                  {locationSummary}
                </span>
              </div>
            )}
          </>
        )}

        {!isUnsupported && (
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => {
                void onRequestPermission();
              }}
              className="inline-flex flex-1 min-w-[160px] items-center justify-center gap-2 rounded-2xl border border-blue-200 bg-white px-3 py-2 text-xs font-semibold text-blue-600 shadow-inner hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-65"
              disabled={locationState.status === "locating"}
            >
              ขอสิทธิ์ตำแหน่งอีกครั้ง
            </button>
            <button
              type="button"
              onClick={onShowPermissionHelp}
              className="inline-flex flex-1 min-w-[160px] items-center justify-center gap-2 rounded-2xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100"
            >
              เปิดคู่มือการอนุญาต
            </button>
            <button
              type="button"
              onClick={() => {
                void navigator.geolocation?.getCurrentPosition(
                  () => undefined,
                  () => undefined,
                  { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 },
                );
              }}
              className="inline-flex flex-1 min-w-[160px] items-center justify-center gap-2 rounded-2xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-65"
              disabled={locationState.status === "locating" || isDenied}
            >
              ดึงตำแหน่งปัจจุบัน
            </button>
          </div>
        )}
      </div>
    </div>
  );
}


type PermissionHelpModalProps = {
  isOpen: boolean;
  onClose: () => void;
};

function PermissionHelpModal({ isOpen, onClose }: PermissionHelpModalProps) {
  if (!isOpen) return null;

  const steps = [
    {
      title: "Android / Chrome / PWA",
      items: [
        "แตะไอคอนตัว i หรือกุญแจข้าง URL",
        "เลือก Permissions > Location > Allow",
        "หากติดตั้งเป็นแอป ให้ไปที่ Settings > Apps > [ชื่อแอป] > Permissions > Location > Allow",
        "กลับมาที่หน้านี้แล้วกด ‘ขอสิทธิ์ตำแหน่งอีกครั้ง’",
      ],
    },
    {
      title: "🍎 iPhone / iPad / iPod (iOS ทุกเวอร์ชัน)",
      items: [
        "⚠️ สำคัญ: Location permission ของ PWA ผูกกับ Safari (ไม่แยกออกมา)",
        "📱 วิธีเปิด: Settings → Safari → Location → เลือก 'Ask' หรือ 'Allow'",
        "💡 หมายเหตุ: มีเฉพาะ Notifications เท่านั้นที่แยก entry ออกมา (iOS 16.4+)",
        "🔄 หลังตั้งค่า: รีเฟรชหน้านี้ (ปัดลงแล้วปล่อย) หรือปิดเปิดแอปใหม่",
        "✅ กด 'ขอสิทธิ์ตำแหน่งอีกครั้ง' ด้านล่างเพื่อทดสอบ",
      ],
    },
  ];

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/60 backdrop-blur-sm sm:items-center">
      <div className="relative w-full max-w-lg rounded-t-[28px] bg-white shadow-2xl sm:rounded-[28px] sm:p-6">
        {/* ปุ่มปิด X มุมขวาบน */}
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-600 hover:bg-slate-200 active:scale-95 transition-all sm:right-6 sm:top-6"
          aria-label="ปิด"
        >
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        <div className="border-b border-slate-200 px-6 py-4 sm:px-0 pr-12">
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-blue-500">
            Permission Help
          </p>
          <h3 className="mt-1 text-lg font-semibold text-slate-900">
            วิธีเปิดอนุญาตตำแหน่ง
          </h3>
          <p className="mt-1 text-xs text-slate-500">
            ทำตามขั้นตอนตามระบบปฏิบัติการของคุณ แล้วกลับมากดขอสิทธิ์อีกครั้ง
          </p>
        </div>
        <div className="space-y-5 px-6 py-5 sm:px-0">
          {steps.map((section) => {
            const isIOS = section.title.includes('iPhone');
            return (
              <div
                key={section.title}
                className={`space-y-3 rounded-2xl border p-4 ${
                  isIOS
                    ? 'border-orange-200 bg-gradient-to-br from-orange-50 to-amber-50'
                    : 'border-blue-100 bg-blue-50/60'
                }`}
              >
                <p className={`text-sm font-semibold ${isIOS ? 'text-orange-700' : 'text-blue-700'}`}>
                  {section.title}
                </p>
                <ol className="list-decimal space-y-2 pl-5 text-xs text-slate-600">
                  {section.items.map((item, index) => (
                    <li key={`${section.title}-${index}`}>{item}</li>
                  ))}
                </ol>
              </div>
            );
          })}
          <div className="space-y-2 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-700">
            <p className="font-semibold">💡 เคล็ดลับสำหรับ iOS:</p>
            <ul className="list-disc space-y-1 pl-4 text-amber-600">
              <li><strong>Location permission ผูกกับ Safari</strong> (ไม่มี entry แยก)</li>
              <li>ตั้งค่าที่: <strong>Settings → Safari → Location → Allow</strong></li>
              <li>หมายเหตุ: มีเฉพาะ Notifications เท่านั้นที่มี entry แยก (iOS 16.4+)</li>
              <li>หากยังไม่เห็นป๊อปอัป ให้ปิดเปิดแอป/Safari ใหม่ก่อนลองอีกครั้ง</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

type FieldProps = {
  label: string;
  htmlFor: string;
  helper?: string;
  children: React.ReactNode;
};

function Field({ label, htmlFor, helper, children }: FieldProps) {
  return (
    <label htmlFor={htmlFor} className="flex w-full flex-col gap-2">
      <span className="flex items-center justify-between text-sm font-semibold text-slate-700">
        {label}
        {helper && <span className="text-xs font-normal text-slate-400">{helper}</span>}
      </span>
      {children}
    </label>
  );
}

type IconProps = {
  className?: string;
};

function LocationIcon({ className }: IconProps) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 21s6-4.35 6-10a6 6 0 1 0-12 0c0 5.65 6 10 6 10z" />
      <circle cx="12" cy="11" r="1.8" />
    </svg>
  );
}

function CloudIcon({ className }: IconProps) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M17.5 19a4.5 4.5 0 0 0 0-9 5.5 5.5 0 0 0-10.5 2A4.5 4.5 0 0 0 7 19h10.5z" />
    </svg>
  );
}

function CheckInIcon({ className }: IconProps) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M3 12h13" />
      <path d="M13 6l6 6-6 6" />
    </svg>
  );
}

function CheckOutIcon({ className }: IconProps) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M21 12H8" />
      <path d="M11 18l-6-6 6-6" />
    </svg>
  );
}
