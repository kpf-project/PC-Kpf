"use client";

import SiteNav from "@/components/SiteNav";
import CompactProductCard from "./CompactProductCard";
import {
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
  lazy,
  Suspense,
} from "react";

// Lazy load modal components for better performance (reduces initial bundle size ~15-20%)
const AddProductBottomSheet = lazy(() => import('./AddProductBottomSheet'));
const ElderlyFriendlyModal = lazy(() => import('./ElderlyFriendlyModal'));
import { haversineDistance } from "@/lib/geo";
import { useGeoPermission } from "@/lib/useGeoPermission";
import { useGPSRequired } from "@/hooks/useGPSRequired";
import { useAuth } from "@/contexts/AuthContext";
import { useModal } from "@/contexts/ModalContext";
import type { ProductAssignment } from "@/lib/supabaseProducts";
import { Plus, Info, AlertTriangle } from "lucide-react";
import { useEmployees, useStores, type EmployeeOption, type StoreOption } from "@/hooks/useMasterData";
import { useEnsureLocation } from "@/hooks/useEnsureLocation";
import NotificationPopup, { type NotificationType } from "@/components/NotificationPopup";

type SubmitState =
  | { status: "idle" }
  | { status: "submitting" }
  | { status: "error"; message: string }
  | { status: "success"; total: number };

type ProductUnitOption = {
  assignmentUnitId: string;
  unitId: string;
  unitName: string;
  pricePc: number;
  multiplierToBase: number;
};

type ProductOption = {
  assignmentId: string;
  productId: string;
  productCode: string;
  productName: string;
  companyName?: string | null;
  companyLogoUrl?: string | null;
  units: ProductUnitOption[];
};

type SalesLineItem = {
  id: string;
  assignmentId: string;
  unitQuantities: Record<string, string>;
};

type LineUnitDetail = {
  option: ProductUnitOption;
  quantityString: string;
  quantityNumber: number;
  subtotal: number;
  stockBalance: number | null;
  exceedsStock: boolean;
};

type LineItemDetail = SalesLineItem & {
  product: ProductOption | null;
  units: LineUnitDetail[];
  lineSubtotal: number;
  hasSelectedUnit: boolean;
  totalUnitQuantity: number;
  hasStockError: boolean;
};

// ✅ EmployeeOption, StoreOption, and LocationState imported from hooks

type StockInventoryItem = {
  productId: string;
  productCode: string;
  productName: string;
  quantityInBase: number;
  displayText: string;
  displayUnits: Array<{
    unitId: string;
    unitName: string;
    count: number;
    multiplier: number;
  }>;
  updatedAt: string;
};

const LAST_EMPLOYEE_STORAGE_KEY = "sales:last-employee-id";
const LAST_STORE_STORAGE_KEY = "sales:last-store-id";
const RECORDING_MODE_STORAGE_KEY = "sales:recording-mode";

type RecordingMode = "quick" | "elderly";

function createLineItem(): SalesLineItem {
  const id =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2);
  return {
    id,
    assignmentId: "",
    unitQuantities: {},
  };
}
export default function SalesPage() {
  const { user } = useAuth();
  const { openModal, closeModal } = useModal();
  const isReadOnly = user?.role === 'sales';

  const [formState, setFormState] = useState({
    storeName: "",
    employeeName: "",
  });
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>("");
  const [selectedStoreId, setSelectedStoreId] = useState<string>("");
  const [products, setProducts] = useState<ProductOption[]>([]);

  // ✅ React Query: Replace useEffect fetch with hooks (cached, shared data)
  const { data: employees = [], isLoading: isLoadingEmployees, error: employeeErrorObj } = useEmployees();
  const { data: stores = [], isLoading: isLoadingStores, error: storeErrorObj } = useStores();

  // Convert Error objects to string for components (same format as before)
  const employeeError = employeeErrorObj?.message ?? null;
  const storeError = storeErrorObj?.message ?? null;

  const [isLoadingProducts, setIsLoadingProducts] = useState(true);
  const [productError, setProductError] = useState<string | null>(null);
  const [submitState, setSubmitState] = useState<SubmitState>({
    status: "idle",
  });

  // Notification popup state
  const [showNotification, setShowNotification] = useState(false);
  const [notificationType, setNotificationType] = useState<NotificationType>('success');
  const [notificationTitle, setNotificationTitle] = useState('');
  const [notificationMessage, setNotificationMessage] = useState('');

  const [allowStoreOverride, setAllowStoreOverride] = useState(false);
  const [allowAllEmployees, setAllowAllEmployees] = useState(false);
  const { status: permissionStatus, requestPermission } = useGeoPermission();
  const [lineItems, setLineItems] = useState<SalesLineItem[]>(() => [createLineItem()]);
  const [assignedStores, setAssignedStores] = useState<StoreOption[]>([]);
  const [isLoadingAssignedStores, setIsLoadingAssignedStores] = useState(false);
  const { gpsRequired, isLoading: _isLoadingGPSSettings } = useGPSRequired();
  const [stockInventory, setStockInventory] = useState<StockInventoryItem[]>([]);
  const [_isLoadingStockInventory, setIsLoadingStockInventory] = useState(false);

  // ✅ Geolocation Hook: Extracted logic to reusable hook (eliminates ~80 lines duplication)
  // Must be declared after gpsRequired to avoid hoisting issues
  const { locationState, ensureLocation: _ensureLocation, refreshLocation } = useEnsureLocation({
    permissionDeniedMessage: "กรุณาอนุญาตการเข้าถึงตำแหน่งเพื่อใช้งานฟอร์มขาย",
    gpsRequired,
  });

  // Mobile bottom sheet state
  const [editingLineId, setEditingLineId] = useState<string | null>(null);

  // Recording mode state
  const [recordingMode, setRecordingMode] = useState<RecordingMode>("quick");

  // Unified modal state (instead of separate modals)
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);

  const resetSubmitState = useCallback(() => {
    setSubmitState((prev) =>
      prev.status === "error" || prev.status === "success" ? { status: "idle" } : prev,
    );
  }, []);

  // Sync modal state with ModalContext
  useEffect(() => {
    const MODAL_ID = 'sales-add-product';
    if (isProductModalOpen) {
      openModal(MODAL_ID);
    } else {
      closeModal(MODAL_ID);
    }

    return () => {
      // Cleanup: always close modal on unmount
      closeModal(MODAL_ID);
    };
  }, [isProductModalOpen, openModal, closeModal]);

  // ✅ ensureLocation and auto-fetch logic moved to useEnsureLocation hook

  // Auto-select employee based on GPS location
  useEffect(() => {
    console.log('[Auto-select Debug]', {
      gpsRequired,
      locationStatus: locationState.status,
      selectedEmployeeId,
      employeesCount: employees.length,
      storesCount: stores.length
    });

    if (!gpsRequired) {
      console.log('[Auto-select] GPS not required, skipping auto-select');
      return;
    }
    if (locationState.status !== "resolved") {
      console.log('[Auto-select] Location not resolved yet:', locationState.status);
      return;
    }
    if (selectedEmployeeId) {
      console.log('[Auto-select] Employee already selected, skipping');
      return;
    }
    if (employees.length === 0 || stores.length === 0) {
      console.log('[Auto-select] No employees or stores available');
      return;
    }

    const { latitude: userLat, longitude: userLng } = locationState.coords;
    console.log('[Auto-select] User location:', { userLat, userLng });

    // Find closest employee by their primary store
    let closestEmployee: EmployeeOption | null = null;
    let closestDistance = Infinity;

    for (const employee of employees) {
      // Get employee's primary store
      const primaryStore = employee.defaultStoreId
        ? stores.find((s) => s.id === employee.defaultStoreId)
        : null;

      if (!primaryStore || !primaryStore.latitude || !primaryStore.longitude) {
        console.log(`[Auto-select] Employee "${employee.name}" has no valid store GPS`);
        continue;
      }

      const distance = haversineDistance(
        { latitude: userLat, longitude: userLng },
        { latitude: primaryStore.latitude, longitude: primaryStore.longitude }
      );

      console.log(`[Auto-select] Employee "${employee.name}" distance: ${Math.round(distance)}m`);

      if (distance < closestDistance) {
        closestDistance = distance;
        closestEmployee = employee;
      }
    }

    // Auto-select if found someone within reasonable range (5km)
    if (closestEmployee && closestDistance < 5000) {
      console.log(
        `[Auto-select Sales] ✅ พบพนักงาน "${closestEmployee.name}" ใกล้ที่สุด (${Math.round(closestDistance)}m) - Auto-selecting`
      );
      setSelectedEmployeeId(closestEmployee.id);
      setFormState((prev) => ({
        ...prev,
        employeeName: closestEmployee.name,
      }));
    } else if (closestEmployee) {
      console.log(
        `[Auto-select Sales] ❌ พบพนักงาน "${closestEmployee.name}" แต่ห่างเกินไป (${Math.round(closestDistance)}m > 5000m)`
      );
    } else {
      console.log('[Auto-select Sales] ❌ ไม่พบพนักงานที่มี GPS store');
    }
  }, [
    locationState,
    employees,
    stores,
    selectedEmployeeId,
    gpsRequired,
  ]);

  // Fetch assigned stores for the selected employee (both GPS and manual mode)
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
          success: boolean;
          assignments?: Array<{ storeId: string; storeName: string; isPrimary: boolean }>;
        };
        if (!active) return;

        // Transform assignments to StoreOption format
        const list: StoreOption[] = (data.assignments ?? []).map((assignment) => {
          // Find full store details from stores list (use current stores from closure)
          const fullStore = stores.find(s => s.id === assignment.storeId);
          return {
            id: assignment.storeId,
            name: assignment.storeName,
            province: fullStore?.province,
            latitude: fullStore?.latitude,
            longitude: fullStore?.longitude,
            radius: fullStore?.radius,
          };
        });
        setAssignedStores(list);
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

  const handleRefreshLocation = useCallback(() => {
    void refreshLocation();
  }, [refreshLocation]);

  // ✅ useEffect removed: Now using React Query hooks above (useEmployees, useStores)
  // Data fetching, caching, and error handling are automatic

  useEffect(() => {
    let isActive = true;
    const loadProducts = async () => {
      if (!selectedEmployeeId) {
        setProducts([]);
        setIsLoadingProducts(false);
        return;
      }
      setIsLoadingProducts(true);
      setProductError(null);
      try {
        const params = new URLSearchParams({ employeeId: selectedEmployeeId, onlyActive: "true" });
        if (selectedStoreId) {
          params.set("storeId", selectedStoreId);
        }
        const response = await fetch("/api/admin/products/assignments?" + params.toString());
        if (!response.ok) {
          const payload = await response.json().catch(() => null);
          throw new Error(payload?.message ?? "ไม่สามารถโหลดข้อมูลสินค้าได้");
        }
        const data = (await response.json()) as { assignments?: ProductAssignment[] };
        if (!isActive) return;
        const assignmentMap = new Map<string, ProductOption>();
        for (const assignment of data.assignments ?? []) {
          const activeUnits = assignment.units.filter((unit) => unit.isActive);
          if (activeUnits.length === 0) continue;
          const sortedUnits = [...activeUnits].sort(
            (a, b) => a.multiplierToBase - b.multiplierToBase,
          );
          assignmentMap.set(assignment.assignmentId, {
            assignmentId: assignment.assignmentId,
            productId: assignment.productId,
            productCode: assignment.productCode,
            productName: assignment.productName,
            companyName: assignment.companyName ?? null,
            companyLogoUrl: assignment.companyLogoUrl ?? null,
            units: sortedUnits.map((unit) => ({
              assignmentUnitId: unit.assignmentUnitId,
              unitId: unit.unitId,
              unitName: unit.unitName,
              pricePc: unit.pricePc,
              multiplierToBase: unit.multiplierToBase,
            })),
          });
        }
        const list = Array.from(assignmentMap.values()).sort((a, b) =>
          a.productCode.localeCompare(b.productCode, "th"),
        );

        // Debug: Check company data
        console.log('[SalesPage] Products loaded:', list.length);
        const withLogo = list.filter(p => p.companyLogoUrl);
        console.log('[SalesPage] Products with logo:', withLogo.length);
        if (withLogo.length > 0) {
          console.log('[SalesPage] Sample product with logo:', {
            code: withLogo[0].productCode,
            name: withLogo[0].productName,
            companyName: withLogo[0].companyName,
            logoUrl: withLogo[0].companyLogoUrl
          });
        }

        setProducts(list);
      } catch (error) {
        if (!isActive) return;
        const message =
          error instanceof Error
            ? error.message
            : "ไม่สามารถโหลดข้อมูลสินค้าได้";
        setProducts([]);
        setProductError(message);
      } finally {
        if (isActive) {
          setIsLoadingProducts(false);
        }
      }
    };
    void loadProducts();
    return () => {
      isActive = false;
    };
  }, [selectedEmployeeId, selectedStoreId]);

  // Function to fetch stock inventory
  const fetchStockInventory = useCallback(async () => {
    if (!selectedEmployeeId || !selectedStoreId) {
      setStockInventory([]);
      setIsLoadingStockInventory(false);
      return;
    }
    setIsLoadingStockInventory(true);
    try {
      const params = new URLSearchParams({
        employeeId: selectedEmployeeId,
        storeId: selectedStoreId,
      });
      const response = await fetch(`/api/stock/inventory?${params.toString()}`);
      if (!response.ok) {
        console.error("Failed to fetch stock inventory:", response.statusText);
        setStockInventory([]);
        return;
      }
      const data = (await response.json()) as {
        success: boolean;
        inventory?: StockInventoryItem[];
      };
      setStockInventory(data.inventory || []);
    } catch (error) {
      console.error("Failed to fetch stock inventory:", error);
      setStockInventory([]);
    } finally {
      setIsLoadingStockInventory(false);
    }
  }, [selectedEmployeeId, selectedStoreId]);

  // Fetch stock inventory for selected employee and store
  useEffect(() => {
    void fetchStockInventory();
  }, [fetchStockInventory]);

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
    if (typeof window === "undefined" || selectedEmployeeId) {
      return;
    }
    const storedId = window.localStorage.getItem(LAST_EMPLOYEE_STORAGE_KEY);
    if (storedId && employees.some((employee) => employee.id === storedId)) {
      setSelectedEmployeeId(storedId);
    }
  }, [employees, selectedEmployeeId]);

  useEffect(() => {
    if (typeof window === "undefined" || selectedStoreId) {
      return;
    }
    const storedId = window.localStorage.getItem(LAST_STORE_STORAGE_KEY);
    if (storedId && stores.some((store) => store.id === storedId)) {
      setSelectedStoreId(storedId);
    }
  }, [selectedStoreId, stores]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    if (selectedEmployeeId) {
      window.localStorage.setItem(LAST_EMPLOYEE_STORAGE_KEY, selectedEmployeeId);
    } else {
      window.localStorage.removeItem(LAST_EMPLOYEE_STORAGE_KEY);
    }
  }, [selectedEmployeeId]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    if (selectedStoreId) {
      window.localStorage.setItem(LAST_STORE_STORAGE_KEY, selectedStoreId);
    } else {
      window.localStorage.removeItem(LAST_STORE_STORAGE_KEY);
    }
  }, [selectedStoreId]);

  // Load recording mode from localStorage
  useEffect(() => {
    if (typeof window === "undefined") return;
    const storedMode = window.localStorage.getItem(RECORDING_MODE_STORAGE_KEY);
    if (storedMode === "quick" || storedMode === "elderly") {
      setRecordingMode(storedMode);
    }
  }, []);

  // Save recording mode to localStorage
  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(RECORDING_MODE_STORAGE_KEY, recordingMode);
  }, [recordingMode]);

  const selectedEmployee = useMemo(() => {
    if (!selectedEmployeeId) return null;
    return employees.find((employee) => employee.id === selectedEmployeeId) ?? null;
  }, [selectedEmployeeId, employees]);

  // Check if employee has multiple assigned stores
  const hasMultipleAssignedStores = assignedStores.length > 1;

  // If employee has only 1 assigned store, lock it. Otherwise allow selection.
  const lockedStoreId = (!hasMultipleAssignedStores && assignedStores.length === 1)
    ? assignedStores[0].id
    : null;

  const lockedStore = useMemo(() => {
    if (!lockedStoreId) return null;
    return stores.find((store) => store.id === lockedStoreId) ?? null;
  }, [lockedStoreId, stores]);

  const selectedStore = useMemo(() => {
    if (!selectedStoreId) return null;
    return stores.find((store) => store.id === selectedStoreId) ?? null;
  }, [selectedStoreId, stores]);

  const isStoreLocked = Boolean(lockedStoreId && lockedStore);

  const productMap = useMemo(() => new Map(products.map((product) => [product.assignmentId, product])), [products]);

  // Helper function to get stock balance for a product unit
  const getStockBalance = useCallback(
    (productId: string, unitId: string): number | null => {
      const inventoryItem = stockInventory.find((item) => item.productId === productId);
      if (!inventoryItem) return null;

      // Find the unit's multiplier from product data
      const product = products.find((p) => p.productId === productId);
      if (!product) return null;

      const unit = product.units.find((u) => u.unitId === unitId);
      if (!unit) return null;

      // Convert base quantity to this unit
      const balanceInUnit = Math.floor(inventoryItem.quantityInBase / unit.multiplierToBase);
      return balanceInUnit;
    },
    [stockInventory, products]
  );

  useEffect(() => {
    setLineItems((prev) =>
      prev.map((line) => {
        if (!line.assignmentId) {
          return line;
        }
        const product = productMap.get(line.assignmentId);
        if (!product) {
          return { ...line, assignmentId: "", unitQuantities: {} };
        }
        const nextQuantities: Record<string, string> = {};
        for (const unit of product.units) {
          nextQuantities[unit.assignmentUnitId] = line.unitQuantities[unit.assignmentUnitId] ?? "";
        }
        return { ...line, unitQuantities: nextQuantities };
      }),
    );
  }, [productMap]);

  useEffect(() => {
    setLineItems([createLineItem()]);
  }, [selectedEmployeeId, selectedStoreId]);

  const lineItemsDetailed = useMemo<LineItemDetail[]>(() => {
    return lineItems.map((line) => {
      const product = line.assignmentId ? productMap.get(line.assignmentId) ?? null : null;
      const units = product
        ? product.units.map((unit) => {
            const quantityString = line.unitQuantities[unit.assignmentUnitId] ?? "";
            const quantityNumber = Number.parseFloat(quantityString);
            const validQuantity = Number.isFinite(quantityNumber) ? quantityNumber : 0;
            const subtotal = validQuantity > 0 && unit.pricePc > 0 ? validQuantity * unit.pricePc : 0;

            // Check stock availability
            const stockBalance = product ? getStockBalance(product.productId, unit.unitId) : null;
            const exceedsStock = stockBalance !== null && validQuantity > stockBalance;

            return {
              option: unit,
              quantityString,
              quantityNumber: validQuantity,
              subtotal,
              stockBalance,
              exceedsStock,
            };
          })
        : [];
      const lineSubtotal = units.reduce((sum, unit) => sum + unit.subtotal, 0);
      const hasSelectedUnit = units.some((unit) => unit.quantityNumber > 0);
      const totalUnitQuantity = units.reduce((sum, unit) => sum + unit.quantityNumber, 0);
      const hasStockError = units.some((unit) => unit.exceedsStock);

      return {
        ...line,
        product,
        units,
        lineSubtotal,
        hasSelectedUnit,
        totalUnitQuantity,
        hasStockError,
      };
    });
  }, [lineItems, productMap, getStockBalance]);

  const selectedLines = useMemo(() => lineItemsDetailed.filter((line) => line.product && line.hasSelectedUnit), [lineItemsDetailed]);

  const totalAmount = useMemo(() => lineItemsDetailed.reduce((sum, line) => sum + line.lineSubtotal, 0), [lineItemsDetailed]);

  const totalQuantity = useMemo(
    () => lineItemsDetailed.reduce((sum, line) => sum + line.totalUnitQuantity, 0),
    [lineItemsDetailed],
  );

  const selectedSkuCount = selectedLines.length;

  const hasProducts = products.length > 0;
  const hasEmployees = employees.length > 0;
  const hasStores = stores.length > 0;

  const activeStoreLabel = useMemo(() => {
    if (lockedStore) return lockedStore.name;
    if (selectedStore) return selectedStore.name;
    return hasStores ? "ยังไม่เลือก" : "ไม่มีข้อมูล";
  }, [hasStores, lockedStore, selectedStore]);

  const activeEmployeeLabel = useMemo(() => {
    if (selectedEmployee) return selectedEmployee.name;
    return hasEmployees ? "ยังไม่เลือก" : "ไม่มีข้อมูล";
  }, [hasEmployees, selectedEmployee]);

  const hasAnyStockError = useMemo(
    () => lineItemsDetailed.some((line) => line.hasStockError),
    [lineItemsDetailed]
  );

  const canSubmit = selectedLines.length > 0 && hasEmployees && hasStores && !hasAnyStockError;

  const _handleSelectProduct = useCallback(
    (lineId: string, assignmentId: string) => {
      setLineItems((prev) =>
        prev.map((line) => {
          if (line.id !== lineId) {
            return line;
          }
          if (!assignmentId) {
            return { ...line, assignmentId: "", unitQuantities: {} };
          }
          const product = productMap.get(assignmentId);
          const nextQuantities: Record<string, string> = {};
          if (product) {
            for (const unit of product.units) {
              nextQuantities[unit.assignmentUnitId] = line.unitQuantities[unit.assignmentUnitId] ?? "";
            }
          }
          return {
            ...line,
            assignmentId,
            unitQuantities: nextQuantities,
          };
        }),
      );
    },
    [productMap],
  );

  const _handleUnitQuantityChange = useCallback(
    (lineId: string, assignmentUnitId: string, quantity: string) => {
      setLineItems((prev) =>
        prev.map((line) =>
          line.id === lineId
            ? {
                ...line,
                unitQuantities: { ...line.unitQuantities, [assignmentUnitId]: quantity },
              }
            : line,
        ),
      );
    },
    [],
  );

  const _handleAddLineItem = useCallback(() => {
    setLineItems((prev) => [...prev, createLineItem()]);
  }, []);

  const handleRemoveLineItem = useCallback((id: string) => {
    setLineItems((prev) => (prev.length <= 1 ? prev : prev.filter((item) => item.id !== id)));
  }, []);

  // Handler for adding/editing product from mobile bottom sheet
  const handleAddProductFromBottomSheet = useCallback(
    (assignmentId: string, unitQuantities: Record<string, string>) => {
      if (editingLineId) {
        // Edit mode: Update existing line item
        setLineItems((prev) =>
          prev.map((item) =>
            item.id === editingLineId
              ? { ...item, assignmentId, unitQuantities }
              : item
          )
        );
        setEditingLineId(null);
      } else {
        // Add mode: Create a new line item
        const newLineItem: SalesLineItem = {
          ...createLineItem(),
          assignmentId,
          unitQuantities,
        };
        setLineItems((prev) => [...prev, newLineItem]);
      }
      resetSubmitState();
    },
    [editingLineId, resetSubmitState],
  );

  // Handler for saving cart from elderly-friendly modal
  const handleSaveCartFromElderlyModal = useCallback(
    (items: Array<{ assignmentId: string; unitQuantities: Record<string, string> }>) => {
      if (editingLineId) {
        // Edit mode: Update existing line item
        setLineItems((prev) =>
          prev.map((line) => {
            if (line.id === editingLineId && items.length > 0) {
              // Update with first item (should only be one in edit mode)
              return {
                ...line,
                assignmentId: items[0].assignmentId,
                unitQuantities: items[0].unitQuantities,
              };
            }
            return line;
          })
        );
        setEditingLineId(null);
      } else {
        // Normal mode: Replace all line items with cart
        setLineItems([]);

        const newLineItems = items.map((item) => ({
          ...createLineItem(),
          assignmentId: item.assignmentId,
          unitQuantities: item.unitQuantities,
        }));

        setLineItems(newLineItems);
      }
      resetSubmitState();
    },
    [editingLineId, resetSubmitState],
  );

  // Handler for opening the unified modal
  const handleOpenProductModal = useCallback(() => {
    setIsProductModalOpen(true);
  }, []);

  const locationSummary = useMemo(() => {
    if (locationState.status !== "resolved") return "";
    const { latitude, longitude, accuracy } = locationState.coords;
    const lat = latitude.toFixed(6);
    const lng = longitude.toFixed(6);
    const acc =
      typeof accuracy === "number" && Number.isFinite(accuracy)
        ? `±${Math.round(accuracy)}ม.`
        : "";
    return `ละติจูด ${lat}, ลองจิจูด ${lng}${acc ? ` (${acc})` : ""}`;
  }, [locationState]);

  const detectedStoreMatch = useMemo(() => {
    // Only detect store via GPS if GPS is required
    if (!gpsRequired) return null;
    if (locationState.status !== "resolved") return null;
    const { latitude, longitude } = locationState.coords;
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;

    // Use assigned stores if available (for employees with store assignments)
    // Otherwise use all stores (for backward compatibility)
    const storesToSearch = assignedStores.length > 0 ? assignedStores : stores;

    const candidates = storesToSearch
      .map((store) => {
        if (
          typeof store.latitude !== "number" ||
          !Number.isFinite(store.latitude) ||
          typeof store.longitude !== "number" ||
          !Number.isFinite(store.longitude)
        ) {
          return null;
        }
        const radius =
          typeof store.radius === "number" && Number.isFinite(store.radius)
            ? store.radius
            : 100;
        const distance = haversineDistance(
          { latitude, longitude },
          { latitude: store.latitude, longitude: store.longitude },
        );
        return {
          store,
          distance,
          radius,
          withinRadius: distance <= radius,
        };
      })
      .filter(
        (
          candidate,
        ): candidate is {
          store: StoreOption;
          distance: number;
          radius: number;
          withinRadius: boolean;
        } => candidate !== null,
      );
    if (candidates.length === 0) return null;
    const sorted = [...candidates].sort((a, b) => a.distance - b.distance);
    const withinRadius = sorted.find((candidate) => candidate.withinRadius);
    return withinRadius ?? sorted[0] ?? null;
  }, [locationState, stores, gpsRequired, assignedStores]);

  const detectedStore = detectedStoreMatch?.store ?? null;
  const restrictedEmployees = useMemo(() => {
    if (!detectedStore) return [];
    return employees.filter((employee) => employee.defaultStoreId === detectedStore.id);
  }, [detectedStore, employees]);
  const restrictedEmployeeIds = useMemo(
    () => restrictedEmployees.map((employee) => employee.id),
    [restrictedEmployees],
  );
  const visibleEmployees = useMemo(() => {
    if (!detectedStore || restrictedEmployees.length === 0) {
      return employees;
    }
    if (allowAllEmployees) {
      const set = new Set(restrictedEmployeeIds);
      const outOfArea = employees.filter((employee) => !set.has(employee.id));
      return [...restrictedEmployees, ...outOfArea];
    }
    return restrictedEmployees;
  }, [allowAllEmployees, detectedStore, employees, restrictedEmployeeIds, restrictedEmployees]);
  const isRestrictingEmployees = Boolean(
    detectedStore && restrictedEmployees.length > 0 && !allowAllEmployees,
  );
  const isOutOfAreaSelection = Boolean(
    detectedStore &&
      restrictedEmployeeIds.length > 0 &&
      selectedEmployeeId &&
      !restrictedEmployeeIds.includes(selectedEmployeeId),
  );
  const nearestDistanceMeters = detectedStoreMatch
    ? Math.round(detectedStoreMatch.distance)
    : null;
  useEffect(() => {
    // Auto-select detected store only if:
    // 1. Store is not locked
    // 2. User hasn't chosen to override
    // 3. GPS detected a store
    // 4. Employee doesn't have multiple assigned stores (if they do, let them choose)
    if (isStoreLocked || allowStoreOverride || !detectedStore || hasMultipleAssignedStores) {
      return;
    }
    setSelectedStoreId((prev) => (prev === detectedStore.id ? prev : detectedStore.id));
  }, [allowStoreOverride, detectedStore, isStoreLocked, hasMultipleAssignedStores]);

  useEffect(() => {
    setAllowStoreOverride(false);
  }, [detectedStore?.id, isStoreLocked]);

  useEffect(() => {
    if (!detectedStore || restrictedEmployeeIds.length === 0 || allowAllEmployees) {
      return;
    }
    setSelectedEmployeeId((prev) =>
      prev && restrictedEmployeeIds.includes(prev) ? prev : restrictedEmployeeIds[0] ?? "",
    );
  }, [allowAllEmployees, detectedStore, restrictedEmployeeIds]);

  useEffect(() => {
    setAllowAllEmployees(false);
  }, [detectedStore?.id]);

  useEffect(() => {
    if (!selectedEmployee) {
      setFormState((prev) => ({
        ...prev,
        employeeName: "",
      }));
      return;
    }
    resetSubmitState();
    setFormState((prev) => ({
      ...prev,
      employeeName: selectedEmployee.name,
    }));
    if (lockedStoreId) {
      setSelectedStoreId((prev) => (prev === lockedStoreId ? prev : lockedStoreId));
    }
  }, [selectedEmployee, lockedStoreId, resetSubmitState]);

  useEffect(() => {
    const effectiveStore = lockedStore ?? selectedStore;
    if (!effectiveStore) {
      setFormState((prev) => ({
        ...prev,
        storeName: "",
      }));
      return;
    }
    resetSubmitState();
    setFormState((prev) => ({
      ...prev,
      storeName: effectiveStore.name,
    }));
  }, [lockedStore, selectedStore, resetSubmitState]);

  const handleSubmit = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (!formState.storeName) {
        setSubmitState({
          status: "error",
          message: "กรุณาเลือกร้าน/หน่วยงาน",
        });
        return;
      }
      if (!formState.employeeName) {
        setSubmitState({
          status: "error",
          message: "กรุณาเลือกพนักงานผู้บันทึก",
        });
        return;
      }
      type PreparedErrorLine = { index: number; error: string };
      type PreparedSuccessLine = {
        index: number;
        assignmentId: string;
        units: Array<{ assignmentUnitId: string; quantity: number }>;
        subtotal: number;
      };
      type PreparedLine = PreparedErrorLine | PreparedSuccessLine | null;

      const preparedLines: PreparedLine[] = lineItemsDetailed.map((line, index) => {
        if (!line.product) {
          const hasQuantity = Object.values(line.unitQuantities).some((value) => {
            const amount = Number.parseFloat(value);
            return Number.isFinite(amount) && amount > 0;
          });
          if (hasQuantity) {
            return { index, error: `กรุณาเลือกสินค้าในรายการที่ ${index + 1}` };
          }
          return null;
        }

        const unitsToSubmit = line.units
          .filter((unit) => unit.quantityNumber > 0)
          .map((unit) => ({
            assignmentUnitId: unit.option.assignmentUnitId,
            quantity: unit.quantityNumber,
          }));

        if (unitsToSubmit.length === 0) {
          return { index, error: `กรุณาระบุจำนวนสินค้าในรายการที่ ${index + 1}` };
        }

        return {
          index,
          assignmentId: line.assignmentId,
          units: unitsToSubmit,
          subtotal: line.lineSubtotal,
        };
      });

      const firstError = preparedLines.find(
        (entry): entry is PreparedErrorLine => Boolean(entry && 'error' in entry),
      );
      if (firstError) {
        setSubmitState({ status: "error", message: firstError.error });
        return;
      }

      const validLines = preparedLines.filter(
        (entry): entry is PreparedSuccessLine => Boolean(entry && 'units' in entry && entry.units.length > 0),
      );

      if (validLines.length === 0) {
        setSubmitState({
          status: "error",
          message: "กรุณาเพิ่มสินค้าอย่างน้อย 1 รายการ",
        });
        return;
      }

      const groupedAssignments = new Map<
        string,
        { assignmentId: string; units: Array<{ assignmentUnitId: string; quantity: number }> }
      >();
      for (const line of validLines) {
        const group = groupedAssignments.get(line.assignmentId) ?? {
          assignmentId: line.assignmentId,
          units: [],
        };
        group.units.push(...line.units);
        groupedAssignments.set(line.assignmentId, group);
      }

      setSubmitState({ status: "submitting" });
      try {
        const response = await fetch("/api/sales", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            storeName: formState.storeName.trim(),
            employeeName: formState.employeeName.trim(),
            storeId: lockedStore?.id ?? selectedStore?.id ?? null,
            employeeId: selectedEmployeeId || null,
            items: Array.from(groupedAssignments.values()),
          }),
        });
        if (!response.ok) {
          const data = await response.json().catch(() => null);
          throw new Error(data?.message ?? "ไม่สามารถส่งยอดขายได้");
        }
        const data = (await response.json()) as { total?: number };
        const fallbackTotal = validLines.reduce((sum, line) => sum + line.subtotal, 0);
        const totalAmount = data.total ?? fallbackTotal;

        setSubmitState({ status: "idle" });
        setLineItems([createLineItem()]);

        // Show success notification
        setNotificationType('success');
        setNotificationTitle('บันทึกยอดขายสำเร็จ');
        setNotificationMessage(`ยอดรวมทั้งหมด ${totalAmount.toLocaleString('th-TH', {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })} บาท`);
        setShowNotification(true);

        // Refresh stock inventory to show updated balances in real-time
        void fetchStockInventory();
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "ไม่สามารถบันทึกยอดขายได้";

        setSubmitState({ status: "idle" });

        // Show error notification
        setNotificationType('error');
        setNotificationTitle('เกิดข้อผิดพลาด');
        setNotificationMessage(message);
        setShowNotification(true);
      }
    },
    [
      formState.storeName,
      formState.employeeName,
      lineItemsDetailed,
      lockedStore,
      selectedEmployeeId,
      selectedStore,
      fetchStockInventory,
    ],
  );

  const isSubmitting = submitState.status === "submitting";

  return (
    <div className="relative min-h-screen bg-gradient-to-br from-[#e9f0ff] via-white to-[#f3f6ff]">
      <div className="pointer-events-none absolute inset-0 hidden lg:block" aria-hidden>
        <div
          className="absolute inset-0"
          style={{
            background: `
              radial-gradient(60% 55% at 50% -5%, rgba(59, 130, 246, 0.18), transparent),
              radial-gradient(55% 60% at 90% 85%, rgba(99, 102, 241, 0.18), transparent),
              radial-gradient(50% 60% at -10% 40%, rgba(165, 243, 252, 0.35), transparent)
            `,
          }}
        />
      </div>

      <SiteNav />

      {/* ✅ FIX: เพิ่ม pt สำหรับ fixed header บนมือถือ + pb สำหรับ bottom bar */}
      <main className="relative z-10 mx-auto flex w-full max-w-none sm:max-w-6xl flex-col gap-10 pt-28 pb-32 sm:px-4 sm:px-6 lg:pt-[120px] lg:px-8 md:pb-10">

        <div className="grid gap-8 lg:grid-cols-[2fr_1fr]">
          <form
            id="sales-form"
            onSubmit={handleSubmit}
            className="space-y-8 rounded-[32px] border border-white/70 bg-white/90 p-6 shadow-[0_45px_160px_-100px_rgba(37,99,235,0.45)] lg:backdrop-blur-sm sm:p-10"
          >
            <header className="flex flex-col gap-4">
              <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-400">Sales Console</p>
                  <h1 className="text-3xl font-semibold text-slate-900">บันทึกยอดขาย</h1>
                  <div className="flex flex-wrap gap-2 text-xs text-slate-500">
                    <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1">
                      <span className="h-2 w-2 rounded-full bg-emerald-500" />
                      {activeEmployeeLabel}
                    </span>
                    <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1">
                      <span className="h-2 w-2 rounded-full bg-blue-500" />
                      {activeStoreLabel}
                    </span>
                    <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1">
                      <span className="font-semibold text-slate-600">{selectedSkuCount}</span>
                      รายการสินค้า
                    </span>
                  </div>
                </div>
                <div className="flex flex-col items-start gap-1 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-left text-sm text-slate-600 shadow-sm md:items-end md:text-right">
                  <span className="text-xs uppercase tracking-[0.35em] text-slate-400">ยอดรวมปัจจุบัน</span>
                  <span className="text-3xl font-semibold text-slate-900">
                    {totalAmount.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} บาท
                  </span>
                  <span className="text-xs text-slate-500">
                    {totalQuantity.toLocaleString("th-TH")} ชิ้น · {selectedSkuCount} SKU
                  </span>
                </div>
              </div>

            </header>

            {isReadOnly && (
              <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3">
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


            <section className="space-y-6">
              <div className="grid gap-6 md:grid-cols-2">
                <Field
                  label="ชื่อพนักงานผู้บันทึก"
                  htmlFor="employeeName"
                  helper="เลือกจากรายชื่อพนักงาน"
                >
                  {isLoadingEmployees ? (
                    <div className="form-input flex h-[52px] items-center justify-center text-xs text-slate-400">
                      กำลังโหลดรายชื่อพนักงาน...
                    </div>
                  ) : hasEmployees ? (
                    <div className="space-y-2">
                      <select
                        id="employeeName"
                        value={selectedEmployeeId}
                        onChange={(event) => {
                          resetSubmitState();
                          setSelectedEmployeeId(event.target.value);
                        }}
                        className={`form-input ${isReadOnly ? 'cursor-not-allowed opacity-60' : ''}`}
                        disabled={isReadOnly}
                        required
                      >
                        <option value="">เลือกพนักงาน</option>
                        {visibleEmployees.map((employee) => {
                          const assignedStore = employee.defaultStoreId
                            ? stores.find((store) => store.id === employee.defaultStoreId)
                            : null;
                          const label = assignedStore
                            ? `${employee.name} - ${assignedStore.name}`
                            : employee.name;
                          const isEmployeeOutOfArea =
                            detectedStore &&
                            restrictedEmployeeIds.length > 0 &&
                            employee.defaultStoreId !== detectedStore.id;
                          const displayLabel = isEmployeeOutOfArea
                            ? `${label} (นอกพื้นที่ที่ตรวจจับได้)`
                            : label;
                          return (
                            <option key={employee.id} value={employee.id}>
                              {displayLabel}
                            </option>
                          );
                        })}
                      </select>
                      {isRestrictingEmployees && detectedStore && (
                        <p className="text-xs text-blue-600">
                          แสดงเฉพาะพนักงานของสาขา {detectedStore.name} ตามพิกัดปัจจุบัน{" "}
                          <button
                            type="button"
                            onClick={() => {
                              resetSubmitState();
                              setAllowAllEmployees(true);
                            }}
                            className="text-xs font-semibold text-blue-600 hover:underline"
                          >
                            เลือกชื่ออื่น
                          </button>
                        </p>
                      )}
                      {allowAllEmployees && detectedStore && restrictedEmployeeIds.length > 0 && (
                        <div className="space-y-1 text-xs text-amber-600">
                          <p>มีรายชื่อที่ไม่ตรงกับสาขาที่ตรวจจับได้ ตรวจสอบก่อนบันทึก</p>
                          <button
                            type="button"
                            onClick={() => {
                              resetSubmitState();
                              setAllowAllEmployees(false);
                            }}
                            className="text-xs font-semibold text-blue-600 hover:underline"
                          >
                            กลับไปกรองตามพิกัด
                          </button>
                        </div>
                      )}
                      {isOutOfAreaSelection && (
                        <p className="text-xs text-amber-600">
                          ตรวจสอบอีกครั้ง: คุณเลือกพนักงานที่อยู่นอกสาขาที่ตรวจจับได้
                        </p>
                      )}
                    </div>
                  ) : (
                    <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-600">
                      ยังไม่มีรายชื่อพนักงาน กรุณาเพิ่มที่หน้า Admin
                    </div>
                  )}
                  {employeeError && (
                    <p className="mt-2 text-xs text-red-500">{employeeError}</p>
                  )}
                </Field>

                <Field
                  label="ชื่อร้านค้า / หน่วยงาน"
                  htmlFor="storeName"
                  helper="ข้อมูลจากระบบหลังบ้าน"
                >
                  {isLoadingStores ? (
                    <div className="form-input flex h-[52px] items-center justify-center text-xs text-slate-400">
                      กำลังโหลดข้อมูลสาขา...
                    </div>
                  ) : hasStores ? (
                    <div className="space-y-2">
                      {!gpsRequired && (
                        <div className="rounded-2xl border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-600">
                          โหมดเลือกร้านด้วยตนเอง (GPS ถูกปิดโดยผู้ดูแลระบบ)
                        </div>
                      )}
                      {!gpsRequired && assignedStores.length === 0 && !isLoadingAssignedStores && (
                        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-600">
                          พนักงานคนนี้ยังไม่ได้รับมอบหมายร้านค้า กรุณาติดต่อผู้ดูแลระบบ
                        </div>
                      )}
                      <select
                        id="storeName"
                        value={selectedStoreId}
                        onChange={(event) => {
                          resetSubmitState();
                          setSelectedStoreId(event.target.value);
                        }}
                        className={`form-input disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500 ${isReadOnly ? 'opacity-60' : ''}`}
                        disabled={
                          isReadOnly ||
                          isStoreLocked ||
                          (gpsRequired && !!detectedStore && !allowStoreOverride && !hasMultipleAssignedStores) ||
                          (!gpsRequired && assignedStores.length === 0)
                        }
                        required
                      >
                        <option value="">เลือกสาขา / จุดขาย</option>
                        {(assignedStores.length > 0
                          ? assignedStores
                          : stores
                        ).map((store) => (
                          <option key={store.id} value={store.id}>
                            {store.province ? `${store.name} (${store.province})` : store.name}
                          </option>
                        ))}
                      </select>
                      {isStoreLocked && (
                        <p className="text-xs text-slate-500">
                          พนักงานคนนี้มีร้านที่รับผิดชอบเพียง 1 ร้าน (ล็อกอัตโนมัติ)
                        </p>
                      )}
                      {hasMultipleAssignedStores && !isStoreLocked && (
                        <p className="text-xs text-blue-600">
                          พนักงานคนนี้มีหลายร้านที่รับผิดชอบ — เลือกร้านที่ต้องการได้เลย
                        </p>
                      )}
                      {!isStoreLocked && detectedStore && (
                        <div className="space-y-1 text-xs">
                          <div className="flex flex-wrap items-center gap-2 text-slate-500">
                            <span className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-2 py-1 text-[11px] text-slate-600">
                              ใกล้ {detectedStore.name}
                              {nearestDistanceMeters !== null && ` (${nearestDistanceMeters} ม.)`}
                            </span>
                            <div className="flex gap-3">
                              {!allowStoreOverride && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    resetSubmitState();
                                    setAllowStoreOverride(true);
                                  }}
                                  className="text-xs font-semibold text-blue-600 hover:underline"
                                >
                                  เลือกสาขาอื่น
                                </button>
                              )}
                              {allowStoreOverride && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    resetSubmitState();
                                    setAllowStoreOverride(false);
                                  }}
                                  className="text-xs font-semibold text-blue-600 hover:underline"
                                >
                                  กลับไปใช้พิกัด
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => {
                                  resetSubmitState();
                                  handleRefreshLocation();
                                }}
                                className="text-xs font-semibold text-blue-600 hover:underline"
                              >
                                รีเฟรชพิกัด
                              </button>
                            </div>
                          </div>
                          {locationState.status === "locating" && (
                            <p className="text-xs text-slate-500">กำลังตรวจจับตำแหน่ง...</p>
                          )}
                          {locationState.status === "resolved" && (
                            <p className="text-xs text-slate-400">
                              พิกัดปัจจุบัน: {locationSummary}
                            </p>
                          )}
                          {locationState.status === "error" && (
                            <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-600">
                              <p>{locationState.message}</p>
                              <div className="mt-2 flex flex-wrap gap-2">
                                {permissionStatus === "prompt" && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      resetSubmitState();
                                      void requestPermission();
                                    }}
                                    className="rounded-lg bg-white px-3 py-1 text-red-600 shadow hover:bg-red-100"
                                  >
                                    อนุญาตตำแหน่ง
                                  </button>
                                )}
                                <button
                                  type="button"
                                  onClick={() => {
                                    resetSubmitState();
                                    handleRefreshLocation();
                                  }}
                                  className="rounded-lg bg-white px-3 py-1 text-red-600 shadow hover:bg-red-100"
                                >
                                  ลองอีกครั้ง
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-600">
                      ยังไม่มีข้อมูลสาขา กรุณาติดต่อผู้ดูแลระบบ
                    </div>
                  )}
                  {storeError && (
                    <p className="mt-2 text-xs text-red-500">{storeError}</p>
                  )}
                </Field>
              </div>
            </section>

            <section className="space-y-4">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-semibold text-slate-800">รายการสินค้า</p>
                  <p className="text-xs text-slate-500">
                    บันทึกได้หลาย SKU ในการส่งครั้งเดียว ระบบจะจำกัดรายการตามพนักงานที่เลือก
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleOpenProductModal}
                  disabled={!hasProducts || isReadOnly}
                  className={`hidden items-center gap-2 rounded-full border border-blue-200 bg-white px-4 py-1.5 text-xs font-semibold text-blue-600 shadow-sm transition hover:border-blue-300 hover:text-blue-700 disabled:cursor-not-allowed disabled:opacity-60 md:inline-flex ${isReadOnly ? 'opacity-50' : ''}`}
                >
                  + เพิ่มสินค้า
                </button>
              </div>

              {isLoadingProducts ? (
                <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-8 text-center text-xs text-slate-400">
                  กำลังดึงข้อมูลสินค้า...
                </div>
              ) : !hasProducts ? (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-6 text-sm text-amber-700">
                  ยังไม่มีสินค้าที่ผูกกับพนักงานคนนี้ กรุณาติดต่อผู้ดูแลระบบ
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Show selected products as compact cards */}
                  {selectedLines.map((line) => (
                    <CompactProductCard
                      key={line.id}
                      product={line.product!}
                      unitQuantities={line.unitQuantities}
                      onEdit={() => {
                        resetSubmitState();
                        setEditingLineId(line.id);
                        // Open unified modal
                        setIsProductModalOpen(true);
                      }}
                      onRemove={() => {
                        resetSubmitState();
                        handleRemoveLineItem(line.id);
                      }}
                    />
                  ))}

                  {/* Show empty state if no products selected */}
                  {selectedLines.length === 0 && (
                    <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-6 py-12 text-center">
                      <p className="text-sm text-slate-500">
                        ยังไม่มีสินค้าในรายการ<br />
                        กดปุ่ม + เพื่อเพิ่มสินค้า
                      </p>
                    </div>
                  )}
                </div>
              )}

              {productError && (
                <p className="rounded-2xl border border-red-200 bg-red-50 px-4 py-2 text-xs text-red-600">
                  {productError}
                </p>
              )}
            </section>

            <div className="space-y-3 text-center text-xs text-slate-500">
              {hasAnyStockError && (
                <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600 text-left">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="h-5 w-5 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold">ไม่สามารถบันทึกยอดขายได้</p>
                      <p className="mt-1">มีสินค้าบางรายการที่กรอกจำนวนเกินสต็อกที่มีอยู่ กรุณาแก้ไขจำนวนก่อนบันทึก</p>
                    </div>
                  </div>
                </div>
              )}
              {!hasProducts && !isLoadingProducts && (
                <p className="text-amber-600">ต้องเพิ่มข้อมูลสินค้าในหน้า Admin ก่อนจึงจะบันทึกยอดขายได้</p>
              )}
              {!hasStores && !isLoadingStores && (
                <p className="text-amber-600">ต้องเพิ่มร้าน/หน่วยงานในหน้า Admin ก่อนจึงจะเลือกได้</p>
              )}
              {!hasEmployees && !isLoadingEmployees && (
                <p className="text-amber-600">ต้องเพิ่มรายชื่อพนักงานในหน้า Admin ก่อนจึงจะเลือกได้</p>
              )}
            </div>

            <button
              type="submit"
              disabled={isSubmitting || !canSubmit || isReadOnly}
              className={`hidden md:inline-flex w-full items-center justify-center gap-3 rounded-[26px] bg-gradient-to-r from-indigo-600 via-sky-500 to-blue-500 px-6 py-4 text-base font-semibold text-white shadow-[0_25px_80px_-50px_rgba(37,99,235,0.75)] transition hover:shadow-[0_30px_90px_-55px_rgba(30,64,175,0.85)] focus:outline-none focus:ring-2 focus:ring-blue-200 focus:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-60 ${isReadOnly ? 'opacity-50' : ''}`}
            >
              {isSubmitting ? (
                <>
                  <span className="inline-flex h-3 w-3 animate-spin rounded-full border-2 border-white border-b-transparent" />
                  กำลังบันทึก...
                </>
              ) : (
                <>บันทึกข้อมูล</>
              )}
            </button>
          </form>

          <aside className="space-y-6">
            <div className="rounded-[28px] border border-white/70 bg-gradient-to-br from-white via-blue-50/20 to-white p-6 shadow-[0_35px_120px_-90px_rgba(37,99,235,0.45)]">
              <h2 className="text-sm font-semibold text-slate-800">ภาพรวมการขาย</h2>
              <dl className="mt-4 space-y-3 text-sm text-slate-600">
                <div className="flex items-center justify-between">
                  <dt className="text-slate-500">พนักงาน</dt>
                  <dd className="font-semibold text-slate-900">{activeEmployeeLabel}</dd>
                </div>
                <div className="flex items-center justify-between">
                  <dt className="text-slate-500">สาขา</dt>
                  <dd className="font-semibold text-slate-900">{activeStoreLabel}</dd>
                </div>
                <div className="flex items-center justify-between">
                  <dt className="text-slate-500">ยอดรวม</dt>
                  <dd className="font-semibold text-slate-900">{totalAmount.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} บาท</dd>
                </div>
                <div className="flex items-center justify-between">
                  <dt className="text-slate-500">จำนวนสินค้า</dt>
                  <dd className="font-semibold text-slate-900">{totalQuantity.toLocaleString("th-TH")} ชิ้น</dd>
                </div>
              </dl>
            </div>

            <div className="rounded-[28px] border border-white/70 bg-gradient-to-br from-white via-blue-50/15 to-white p-6 shadow-[0_30px_100px_-80px_rgba(37,99,235,0.35)] lg:backdrop-blur-sm">
              <h2 className="text-sm font-semibold text-slate-800">สินค้าที่เลือก</h2>
              {selectedLines.length === 0 ? (
                <p className="mt-3 text-xs text-slate-500">ยังไม่มีการเลือกสินค้า</p>
              ) : (
                <div className="mt-4 space-y-3">
                  {selectedLines.map((line, index) => (
                    <div
                      key={line.id}
                      className="flex flex-col gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600"
                    >
                      <div className="flex items-center justify-between gap-2 min-w-0">
                        <span className="font-semibold text-slate-800 truncate">
                          {index + 1}. {line.product?.productCode}
                        </span>
                        <span className="text-slate-500 flex-shrink-0 whitespace-nowrap">
                          {line.lineSubtotal.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} บาท
                        </span>
                      </div>
                      <span className="text-xs text-slate-500 line-clamp-2">{line.product?.productName}</span>
                      <div className="space-y-1 text-xs text-slate-500">
                        {line.units
                          .filter((unit) => unit.quantityNumber > 0)
                          .map((unit) => (
                            <div
                              key={unit.option.assignmentUnitId}
                              className="flex items-center justify-between gap-2 min-w-0"
                            >
                              <span className="truncate flex-shrink-0 max-w-[80px]">{unit.option.unitName}</span>
                              <span className="flex-shrink-0 whitespace-nowrap text-right">
                                {unit.quantityNumber.toLocaleString('th-TH')} ×{' '}
                                {unit.option.pricePc.toLocaleString('th-TH', {
                                  minimumFractionDigits: 2,
                                  maximumFractionDigits: 2,
                                })}{' '}
                                ={' '}
                                {unit.subtotal.toLocaleString('th-TH', {
                                  minimumFractionDigits: 2,
                                  maximumFractionDigits: 2,
                                })}{' '}
                                บาท
                              </span>
                            </div>
                          ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="rounded-[28px] border border-white/70 bg-gradient-to-br from-white via-blue-50/20 to-white p-6 shadow-[0_25px_80px_-60px_rgba(37,99,235,0.35)]">
              <h2 className="text-sm font-semibold text-slate-800">สถานะพิกัด</h2>
              <div className="mt-3 space-y-2 text-xs text-slate-500">
                {!gpsRequired ? (
                  <p className="text-blue-600 font-semibold">โหมดเลือกร้านด้วยตนเอง (GPS ปิด)</p>
                ) : (
                  <>
                    {locationState.status === "locating" && <p>กำลังตรวจจับตำแหน่ง...</p>}
                    {locationState.status === "resolved" && (
                      <p className="font-semibold text-slate-700">{locationSummary}</p>
                    )}
                    {locationState.status === "idle" && (
                      <p>ระบบพร้อมใช้งาน รอระบุพิกัด</p>
                    )}
                    {locationState.status === "error" && (
                      <p className="text-red-500">{locationState.message}</p>
                    )}
                  </>
                )}
              </div>
            </div>
          </aside>
        </div>

        {/* Mobile FAB (Floating Action Button) - Only visible on mobile */}
        {!isReadOnly && (
          <button
            type="button"
            onClick={handleOpenProductModal}
            disabled={!hasProducts || !selectedEmployeeId || !selectedStoreId}
            className="fixed bottom-28 right-6 z-50 flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-r from-blue-600 via-sky-500 to-indigo-500 text-white shadow-[0_20px_60px_-20px_rgba(37,99,235,0.8)] transition-all duration-200 hover:scale-110 hover:shadow-[0_25px_70px_-25px_rgba(37,99,235,0.9)] active:scale-95 disabled:cursor-not-allowed disabled:opacity-50 md:hidden"
            aria-label="เพิ่มสินค้า"
          >
            <Plus className="h-8 w-8" />
          </button>
        )}

        {/* Mobile Sticky Bottom Bar - Only visible on mobile */}
        {selectedLines.length > 0 && (
          <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-blue-200 bg-gradient-to-r from-blue-50/95 via-sky-50/95 to-indigo-50/95 px-4 py-3 backdrop-blur-sm md:hidden">
            <div className="flex items-center justify-between gap-4">
              <div className="flex-1">
                <p className="text-xs text-slate-500">ยอดรวมทั้งหมด</p>
                <p className="text-xl font-bold text-blue-700">
                  {totalAmount.toLocaleString("th-TH", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}{" "}
                  <span className="text-sm">บาท</span>
                </p>
                <p className="text-xs text-slate-500">
                  {selectedSkuCount} รายการ · {totalQuantity.toLocaleString("th-TH")} ชิ้น
                </p>
              </div>
              <button
                type="submit"
                form="sales-form"
                disabled={isSubmitting || !canSubmit}
                className="flex h-14 items-center justify-center rounded-2xl bg-gradient-to-r from-blue-600 via-sky-500 to-indigo-500 px-8 text-base font-semibold text-white shadow-lg transition-all duration-200 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isSubmitting ? (
                  <span className="inline-flex h-4 w-4 animate-spin rounded-full border-2 border-white border-b-transparent" />
                ) : (
                  "บันทึก"
                )}
              </button>
            </div>
          </div>
        )}

        {/* Unified Modal with Mode Switching - Optimized: Only render active modal */}
        {isProductModalOpen && (
          <div className="fixed inset-0 z-[120]">
            {/* Backdrop */}
            <div
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
              onClick={() => {
                setIsProductModalOpen(false);
                setEditingLineId(null);
              }}
            />

            {/* Modal Container - Only render active modal for better performance */}
            <Suspense fallback={null}>
              {recordingMode === "quick" ? (
                <AddProductBottomSheet
                  isOpen={true}
                  onClose={() => {
                    setIsProductModalOpen(false);
                    setEditingLineId(null);
                  }}
                  products={products}
                  stockInventory={stockInventory}
                  onAdd={handleAddProductFromBottomSheet}
                  recordingMode={recordingMode}
                  onModeChange={(newMode) => setRecordingMode(newMode)}
                  editingData={
                    editingLineId
                      ? (() => {
                          const line = lineItems.find((l) => l.id === editingLineId);
                          return line
                            ? {
                                assignmentId: line.assignmentId,
                                unitQuantities: line.unitQuantities,
                              }
                            : null;
                        })()
                      : null
                  }
                />
              ) : (
                <ElderlyFriendlyModal
                  isOpen={true}
                  onClose={() => {
                    setIsProductModalOpen(false);
                    setEditingLineId(null);
                  }}
                  products={products}
                  stockInventory={stockInventory}
                  onSaveCart={handleSaveCartFromElderlyModal}
                  recordingMode={recordingMode}
                  onModeChange={(newMode) => setRecordingMode(newMode)}
                  editingData={
                    editingLineId
                      ? (() => {
                          const line = lineItems.find((l) => l.id === editingLineId);
                          return line
                            ? {
                                assignmentId: line.assignmentId,
                                unitQuantities: line.unitQuantities,
                              }
                            : null;
                        })()
                      : null
                  }
                />
              )}
            </Suspense>
          </div>
        )}

      </main>

      {/* Notification Popup */}
      <NotificationPopup
        isOpen={showNotification}
        type={notificationType}
        title={notificationTitle}
        message={notificationMessage}
        onClose={() => setShowNotification(false)}
      />
    </div>
  );
}

type FieldProps = {
  label: string;
  htmlFor: string;
  helper?: string;
  children: ReactNode;
};

function Field({ label, htmlFor, helper, children }: FieldProps) {
  return (
    <label htmlFor={htmlFor} className="flex w-full flex-col gap-2">
      <span className="flex items-center justify-between text-sm font-medium text-slate-600">
        {label}
        {helper && (
          <span className="text-xs text-slate-400">{helper}</span>
        )}
      </span>
      {children}
    </label>
  );
}

