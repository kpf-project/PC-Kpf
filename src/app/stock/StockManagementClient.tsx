"use client";

import SiteNav from "@/components/SiteNav";
import { StockInventoryCard, StockInventoryTable } from "@/components/StockInventoryCard";
import StockProductBottomSheet from "./StockProductBottomSheet";
import { useState, useEffect, useMemo, useCallback, useRef, type FormEvent, lazy, Suspense } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { haversineDistance } from "@/lib/geo";
import { useGeoPermission } from "@/lib/useGeoPermission";
import { useAuth } from "@/contexts/AuthContext";
import { useModal } from "@/contexts/ModalContext";
import clsx from "clsx";
import Image from "next/image";
import type { ProductBatchData } from '@/components/stock/ProductBatchModal';
import dayjs from 'dayjs';
import 'dayjs/locale/th';
import NotificationPopup, { type NotificationType } from "@/components/NotificationPopup";

// Lazy load modal components for better performance (reduces initial bundle size ~15-20%)
const StockElderlyModal = lazy(() => import('./StockElderlyModal'));
const BatchDetailModal = lazy(() => import('@/components/stock/BatchDetailModal'));
const ProductBatchModal = lazy(() => import('@/components/stock/ProductBatchModal'));
const BatchSelectionModal = lazy(() => import('@/components/stock/BatchSelectionModal'));
import {
  PackagePlus,
  PackageMinus,
  Package,
  PackageCheck,
  Settings,
  User,
  Building2,
  MapPin,
  Layers,
  Clock,
  Calendar,
  CheckCircle,
  XCircle,
  AlertTriangle,
  RefreshCw,
  ChevronRight,
  Info,
  Save,
  X,
  Trash2,
  ShoppingCart,
  Search,
  ChevronLeft,
  Edit3,
} from "lucide-react";

// Types
type Employee = {
  id: string;
  name: string;
  employee_code?: string | null;
  default_store_id?: string | null;
};

type Store = {
  id: string;
  name: string;
  province?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  radius?: number | null;
};

type ProductUnit = {
  unitId: string;
  unitName: string;
  assignmentUnitId: string;
  multiplierToBase: number;
};

type Product = {
  productId: string;
  productCode: string;
  productName: string;
  companyId: string | null;
  companyName: string | null;
  companyLogoUrl: string | null;
  assignmentId: string;
  units: ProductUnit[];
};

type InventoryItem = {
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
  // Batch expiry tracking
  nearestExpiry: {
    expiryDate: string | null;  // ✅ Allow NULL for FIFO items
    daysUntilExpiry: number | null;
    lotNumber: string;
    expiryStatus: 'ok' | 'warning' | 'critical' | 'expired' | 'no_expiry';  // ✅ Add 'no_expiry'
  } | null;
  totalBatches: number;
  criticalCount: number;
  warningCount: number;
};

type TabType = "receive" | "return" | "initial" | "balance";

type TransactionType = "receive" | "sale" | "return" | "initial" | "adjustment";

type RecentTransaction = {
  id: string;
  transactionType: TransactionType;
  productId: string;
  productName: string;
  unitId: string;
  unitName: string;
  quantity: number;
  note?: string;
  createdAt: string;
  submissionId?: string;  // ✅ Group transactions from same form submission
};

const KNOWN_TRANSACTION_TYPES: TransactionType[] = [
  "receive",
  "sale",
  "return",
  "initial",
  "adjustment",
];

type SubmitState =
  | { status: "idle" }
  | { status: "submitting" }
  | { status: "success"; message: string }
  | { status: "error"; message: string };

type LocationState =
  | { status: "idle" }
  | { status: "locating" }
  | { status: "error"; message: string }
  | { status: "resolved"; coords: GeolocationCoordinates };

type CartItem = {
  productId: string;
  productCode: string;
  productName: string;
  unitId: string;
  unitName: string;
  quantity: number;
  note?: string;
  companyId?: string | null;
  companyName?: string | null;
  companyLogoUrl?: string | null;
  assignmentId: string;  // ✅ Added: เก็บ assignmentId เพื่อให้ edit ได้ถูกต้อง
  // ❌ Removed per-item batchData - now uses productBatches state (Product-Level)
  // Return-specific: Selected batch for warehouse returns
  selectedBatch?: {
    batchId: string;
    lotNumber: string;
    expiryDate: string | null;
    daysUntilExpiry: number | null;
    expiryStatus: 'ok' | 'warning' | 'critical' | 'expired' | 'no_expiry';
    remainingQuantity: number | null;  // ✅ NEW: Track remaining stock for validation
  };
};

const LAST_EMPLOYEE_STORAGE_KEY = "stock:last-employee-id";
const LAST_STORE_STORAGE_KEY = "stock:last-store-id";
const RECORDING_MODE_STORAGE_KEY = "stock:recording-mode";

type RecordingMode = "quick" | "elderly";

export default function StockManagementClient() {
  const { user } = useAuth();
  const { openModal, closeModal } = useModal();
  const isReadOnly = user?.role === 'sales';
  const queryClient = useQueryClient();

  // 🔍 DEBUG: Find overflowing elements
  useEffect(() => {
    const checkOverflow = () => {
      const viewport = window.innerWidth;
      const elements = document.querySelectorAll('*');
      const overflowing: Array<{ tag: string, class: string, width: number }> = [];

      elements.forEach((el) => {
        const rect = el.getBoundingClientRect();
        if (rect.width > viewport) {
          overflowing.push({
            tag: el.tagName,
            class: el.className.toString().substring(0, 50),
            width: Math.round(rect.width)
          });
        }
      });

      if (overflowing.length > 0) {
        console.log('🚨 OVERFLOW DETECTED! Viewport:', viewport);
        console.table(overflowing);
      }
    };

    const timer = setTimeout(checkOverflow, 2000);
    return () => clearTimeout(timer);
  }, []);

  // Selection state
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>("");
  const [selectedStoreId, setSelectedStoreId] = useState<string>("");
  const [activeTab, setActiveTab] = useState<TabType>(isReadOnly ? "balance" : "receive");

  // Location state
  const [locationState, setLocationState] = useState<LocationState>({ status: "idle" });
  const locationStateRef = useRef<LocationState>(locationState);
  const [allowStoreOverride, setAllowStoreOverride] = useState(false);
  const [allowAllEmployees, setAllowAllEmployees] = useState(false);
  const { status: permissionStatus, requestPermission } = useGeoPermission();

  // Form state for Receive tab
  const [receiveProductId, setReceiveProductId] = useState<string>("");
  const [receiveUnitQuantities, setReceiveUnitQuantities] = useState<Record<string, string>>({});
  const [receiveNote, setReceiveNote] = useState<string>("");
  const [_receiveProductSearch, _setReceiveProductSearch] = useState<string>("");

  // Form state for Return tab
  const [returnProductId, setReturnProductId] = useState<string>("");
  const [returnUnitQuantities, setReturnUnitQuantities] = useState<Record<string, string>>({});
  const [returnNote, setReturnNote] = useState<string>("");
  const [_returnProductSearch, _setReturnProductSearch] = useState<string>("");

  // Form state for Initial Stock tab
  const [initialProductId, setInitialProductId] = useState<string>("");
  const [initialUnitQuantities, setInitialUnitQuantities] = useState<Record<string, string>>({});
  const [initialNote, setInitialNote] = useState<string>("");
  const [_initialProductSearch, _setInitialProductSearch] = useState<string>("");

  // Submit state
  const [submitState, setSubmitState] = useState<SubmitState>({ status: "idle" });

  // Notification popup state
  const [showNotification, setShowNotification] = useState(false);
  const [notificationType, setNotificationType] = useState<NotificationType>('success');
  const [notificationTitle, setNotificationTitle] = useState('');
  const [notificationMessage, setNotificationMessage] = useState('');

  // Modal and Cart state for Receive
  const [isReceiveModalOpen, setIsReceiveModalOpen] = useState(false);
  const [receiveCart, setReceiveCart] = useState<CartItem[]>([]);
  const [receiveGlobalNote, setReceiveGlobalNote] = useState<string>("");

  // ✅ Product-Level Batch state (one batch per product)
  const [productBatches, setProductBatches] = useState<Record<string, ProductBatchData>>({});

  // Product batch editing state (for receive items)
  const [editingBatchProductId, setEditingBatchProductId] = useState<string | null>(null);

  // ✅ State for editing cart item
  const [editingCartItemIndex, setEditingCartItemIndex] = useState<number | null>(null);
  const [editingCartItemData, setEditingCartItemData] = useState<{
    assignmentId: string;
    unitQuantities: Record<string, number>;
    productId?: string;  // ✅ Added to identify which product's items to replace
  } | null>(null);

  // ✅ State for delete confirmation modal
  const [deleteConfirmation, setDeleteConfirmation] = useState<{
    productCode: string;
    productName: string;
    items: CartItem[];
  } | null>(null);

  // Batch selection state for return items
  const [editingReturnBatchIndex, setEditingReturnBatchIndex] = useState<number | null>(null);
  const [isBatchSelectionModalOpen, setIsBatchSelectionModalOpen] = useState(false);
  const [batchSelectionProduct, setBatchSelectionProduct] = useState<{
    productId: string;
    productName: string;
    productCode: string;
    displayUnits: Array<{
      unitId: string;
      unitName: string;
      count: number;
      multiplier: number;
    }>;
  } | null>(null);
  const [availableReturnBatches, setAvailableReturnBatches] = useState<Array<{
    id: string;
    lotNumber: string;
    mfgDate: string | null;
    expiryDate: string | null;
    initialQuantity: number | null;
    remainingQuantity: number | null;  // ✅ NEW: Track remaining stock
    utilizationPercentage: number | null;  // ✅ NEW: Track usage percentage
    note: string | null;
    createdAt: string;
    daysUntilExpiry: number | null;
    expiryStatus: 'ok' | 'warning' | 'critical' | 'expired' | 'no_expiry';
  }>>([]);
  const [loadingReturnBatches, setLoadingReturnBatches] = useState(false);

  // Modal and Cart state for Return
  const [isReturnModalOpen, setIsReturnModalOpen] = useState(false);
  const [returnCart, setReturnCart] = useState<CartItem[]>([]);
  const [returnGlobalNote, setReturnGlobalNote] = useState<string>("");

  // Modal and Cart state for Initial/Adjustment
  const [isInitialModalOpen, setIsInitialModalOpen] = useState(false);
  const [adjustmentCart, setAdjustmentCart] = useState<CartItem[]>([]);
  const [adjustmentGlobalNote, setAdjustmentGlobalNote] = useState<string>("");

  // Recording mode state
  const [recordingMode, setRecordingMode] = useState<RecordingMode>("quick");

  // Elderly mode modal states
  const [isReceiveElderlyModalOpen, setIsReceiveElderlyModalOpen] = useState(false);
  const [isReturnElderlyModalOpen, setIsReturnElderlyModalOpen] = useState(false);
  const [isInitialElderlyModalOpen, setIsInitialElderlyModalOpen] = useState(false);

  // Balance tab: Search and Pagination
  const [balanceSearchInput, setBalanceSearchInput] = useState<string>("");
  const [balanceCurrentPage, setBalanceCurrentPage] = useState(1);
  const [balanceItemsPerPage, setBalanceItemsPerPage] = useState(20);
  const [selectedCompanyFilter, setSelectedCompanyFilter] = useState<string>("");

  // Batch detail modal state
  const [selectedBatchProduct, setSelectedBatchProduct] = useState<{
    productId: string;
    productCode: string;
    productName: string;
  } | null>(null);

  // Initial Stock History: Show more state
  const [showAllInitialHistory, setShowAllInitialHistory] = useState(false);

  // Sync modal state with ModalContext
  useEffect(() => {
    const RECEIVE_ID = 'stock-receive';
    const RETURN_ID = 'stock-return';
    const INITIAL_ID = 'stock-initial';

    if (isReceiveModalOpen) {
      openModal(RECEIVE_ID);
    } else {
      closeModal(RECEIVE_ID);
    }

    if (isReturnModalOpen) {
      openModal(RETURN_ID);
    } else {
      closeModal(RETURN_ID);
    }

    if (isInitialModalOpen) {
      openModal(INITIAL_ID);
    } else {
      closeModal(INITIAL_ID);
    }

    return () => {
      // Cleanup: always close all modals on unmount
      closeModal(RECEIVE_ID);
      closeModal(RETURN_ID);
      closeModal(INITIAL_ID);
    };
  }, [isReceiveModalOpen, isReturnModalOpen, isInitialModalOpen, openModal, closeModal]);

  // Sync locationStateRef
  useEffect(() => {
    locationStateRef.current = locationState;
  }, [locationState]);

  // Fetch employees
  const { data: employeesData, isLoading: isLoadingEmployees } = useQuery({
    queryKey: ["employees"],
    queryFn: async () => {
      const response = await fetch("/api/admin/employees");
      if (!response.ok) throw new Error("ไม่สามารถโหลดรายชื่อพนักงานได้");
      const data = await response.json();
      return data.employees as Employee[];
    },
  });

  // Fetch stores
  const { data: storesData, isLoading: isLoadingStores } = useQuery({
    queryKey: ["stores"],
    queryFn: async () => {
      const response = await fetch("/api/admin/stores");
      if (!response.ok) throw new Error("ไม่สามารถโหลดรายชื่อร้านได้");
      const data = await response.json();
      return data.stores as Store[];
    },
  });

  // Fetch employee-store assignments
  const { data: assignmentsData } = useQuery({
    queryKey: ["stock-employee-assignments"],
    queryFn: async () => {
      const response = await fetch("/api/stock/employee-assignments");
      if (!response.ok) return [];
      const data = await response.json();
      return data.assignments as Array<{
        employeeId: string;
        storeId: string;
        isPrimary: boolean;
      }>;
    },
  });

  // Fetch products for selected employee and store
  const { data: productsData, isLoading: isLoadingProducts } = useQuery({
    queryKey: ["stock-products", selectedEmployeeId, selectedStoreId],
    queryFn: async () => {
      if (!selectedEmployeeId) return [];
      const params = new URLSearchParams({
        employeeId: selectedEmployeeId,
        onlyActive: "true",
      });
      if (selectedStoreId) {
        params.set("storeId", selectedStoreId);
      }
      const response = await fetch(`/api/stock/products?${params.toString()}`);
      if (!response.ok) throw new Error("ไม่สามารถโหลดข้อมูลสินค้าได้");
      const data = await response.json();
      return data.products as Product[];
    },
    enabled: !!selectedEmployeeId,
  });

  // Fetch inventory balance
  const { data: inventoryData, isLoading: isLoadingInventory, refetch: refetchInventory } = useQuery({
    queryKey: ["stock-inventory", selectedEmployeeId, selectedStoreId],
    queryFn: async () => {
      if (!selectedEmployeeId || !selectedStoreId) return [];
      const params = new URLSearchParams({
        employeeId: selectedEmployeeId,
        storeId: selectedStoreId
      });
      const response = await fetch(`/api/stock/inventory?${params.toString()}`);
      if (!response.ok) throw new Error("ไม่สามารถโหลดข้อมูลคงเหลือได้");
      const data = await response.json();
      return data.inventory as InventoryItem[];
    },
    enabled: !!selectedEmployeeId && !!selectedStoreId,
    staleTime: 60000, // Cache for 1 minute (instead of auto-refresh every 30 seconds)
  });

  // ✅ Batch data now included directly in inventory response (no separate API call needed)
  // This fixes 401 Unauthorized errors by keeping everything server-side

  // Fetch recent transactions (increased limit for better summary metrics)
  const { data: transactionsData } = useQuery({
    queryKey: ["stock-transactions", selectedEmployeeId, selectedStoreId],
    queryFn: async () => {
      if (!selectedEmployeeId || !selectedStoreId) return [];
      const params = new URLSearchParams({
        employee_id: selectedEmployeeId,  // Fixed: use snake_case to match API
        store_id: selectedStoreId,        // Fixed: use snake_case to match API
        limit: "10", // ✅ Performance: Only need 5 for display, fetch 10 for buffer
      });
      const response = await fetch(`/api/stock/transactions?${params.toString()}`);
      if (!response.ok) return [];
      const data = await response.json();
      const rawTransactions = Array.isArray(data.transactions) ? data.transactions : [];
      return rawTransactions.map((txn: Record<string, unknown>) => {
        const candidateType = [txn.transaction_type, txn.transactionType].find(
          (value): value is string =>
            typeof value === "string" && KNOWN_TRANSACTION_TYPES.includes(value as TransactionType)
        );
        const transactionType = (candidateType ?? "receive") as TransactionType;

        const productId =
          typeof txn.product_id === "string"
            ? txn.product_id
            : typeof txn.productId === "string"
              ? txn.productId
              : "";

        const productName =
          typeof txn.product_name === "string"
            ? txn.product_name
            : typeof txn.productName === "string"
              ? txn.productName
              : "";

        // ✅ ใช้ original_unit_id ถ้ามี (หน่วยที่บันทึกจริง)
        const unitId =
          typeof txn.original_unit_id === "string" && txn.original_unit_id
            ? txn.original_unit_id
            : typeof txn.unit_id === "string"
            ? txn.unit_id
            : typeof txn.unitId === "string"
              ? txn.unitId
              : "";

        // ✅ ใช้ original_unit.name ถ้ามี (ชื่อหน่วยที่บันทึกจริง)
        const unitName = (() => {
          // Check original_unit from JOIN
          if (txn.original_unit && typeof txn.original_unit === 'object') {
            const ou = txn.original_unit as { name?: string };
            if (typeof ou.name === 'string') return ou.name;
          }
          // Fallback to unit_name (base unit)
          if (typeof txn.unit_name === 'string') return txn.unit_name;
          if (typeof txn.unitName === 'string') return txn.unitName;
          return "";
        })();

        // ✅ ใช้ original_quantity ถ้ามี (จำนวนที่บันทึกจริง ไม่ใช่ base unit)
        // ⚠️ IMPORTANT: Must use original_quantity to display what user actually entered
        const quantityValue = typeof txn.original_quantity === 'number' && txn.original_quantity !== 0
          ? Math.abs(Number(txn.original_quantity))  // ✅ ใช้ค่าจริงที่บันทึก (เอา abs เพราะ return/sale อาจเป็น negative)
          : Math.abs(Number(txn.quantity));  // Fallback to base unit quantity
        const quantity = Number.isFinite(quantityValue) ? quantityValue : 0;

        const createdAt =
          typeof txn.created_at === "string"
            ? txn.created_at
            : typeof txn.createdAt === "string"
              ? txn.createdAt
              : new Date().toISOString();

        const note = typeof txn.note === "string" && txn.note.trim().length > 0 ? txn.note : undefined;

        // ✅ Extract submission_id for grouping
        const submissionId =
          typeof txn.submission_id === "string" && txn.submission_id.trim().length > 0
            ? txn.submission_id
            : typeof txn.submissionId === "string" && txn.submissionId.trim().length > 0
              ? txn.submissionId
              : undefined;

        return {
          id: typeof txn.id === "string" ? txn.id : String(txn.id ?? ""),
          transactionType,
          productId,
          productName,
          unitId,
          unitName,
          quantity,
          note,
          createdAt,
          submissionId,  // ✅ Add submission_id for grouping
        } satisfies RecentTransaction;
      });
    },
    enabled: !!selectedEmployeeId && !!selectedStoreId,
    staleTime: 30000, // ✅ Performance: Cache for 30s (transactions change less frequently)
    refetchOnWindowFocus: false, // ✅ Performance: Don't refetch on window focus
  });

  // Mutation for submitting transaction
  const transactionMutation = useMutation({
    mutationFn: async (payload: {
      transactionType: TransactionType;
      employeeId: string;
      storeId: string;
      productId: string;
      unitId: string;
      quantity: number;
      note?: string;
      adjustmentType?: "add" | "subtract" | "set";
      reason?: string;
      batchId?: string;  // ✅ NEW: Batch ID for return transactions
      submissionId?: string;  // ✅ NEW: Submission ID to group transactions from same form submit
      batchData?: {
        lot_number?: string;  // ✅ Lot/Batch number
        mfg_date?: string;
        exp_date?: string;
        ocr_photo_data_url?: string;
        ocr_confidence?: { mfg: number; exp: number };
        ocr_raw_text?: string;
      };
    }) => {
      // Convert camelCase to snake_case for API
      const apiPayload = {
        transaction_type: payload.transactionType,
        employee_id: payload.employeeId,
        store_id: payload.storeId,
        product_id: payload.productId,
        unit_id: payload.unitId,
        quantity: payload.quantity,
        note: payload.note,
        batch_data: payload.batchData, // ✅ รองรับ batch data
        batch_id: payload.batchId, // ✅ ส่ง batch_id สำหรับ return transactions
        submission_id: payload.submissionId, // ✅ ส่ง submission_id สำหรับ grouping transactions
      };

      const response = await fetch("/api/stock/transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(apiPayload),
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        console.error('[Stock Transaction] Error:', {
          status: response.status,
          statusText: response.statusText,
          error: errorData?.error,
          payload: apiPayload,
        });
        throw new Error(errorData?.error ?? "ไม่สามารถบันทึกรายการได้");
      }
      return response.json();
    },
    onSuccess: (data, variables) => {
      // ✅ Performance: Only invalidate queries for specific employee+store
      // Instead of invalidating ALL inventory/transaction queries globally
      queryClient.invalidateQueries({
        queryKey: ["stock-inventory", variables.employeeId, variables.storeId]
      });
      queryClient.invalidateQueries({
        queryKey: ["stock-transactions", variables.employeeId, variables.storeId]
      });
    },
  });

  // These variables are derived from React Query data (wrapped in useMemo to stabilize references)
  const employees = useMemo(() => employeesData ?? [], [employeesData]);
  const stores = useMemo(() => storesData ?? [], [storesData]);
  const products = useMemo(() => productsData ?? [], [productsData]);
  const inventory = useMemo(() => inventoryData ?? [], [inventoryData]);
  const recentTransactions = useMemo<RecentTransaction[]>(() => transactionsData ?? [], [transactionsData]);
  const assignments = useMemo(() => assignmentsData ?? [], [assignmentsData]);

  // Filter initial stock transactions for history display
  const initialStockHistory = useMemo(() => {
    return recentTransactions
      .filter((t) => t.transactionType === "initial")
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [recentTransactions]);

  // Debounced search for balance tab
  const [debouncedBalanceSearch, setDebouncedBalanceSearch] = useState("");

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedBalanceSearch(balanceSearchInput);
    }, 300);
    return () => clearTimeout(timer);
  }, [balanceSearchInput]);

  // Responsive items per page for balance tab
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 768) {
        setBalanceItemsPerPage(10); // Mobile: 10
      } else {
        setBalanceItemsPerPage(20); // Desktop: 20
      }
    };
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Reset page when search changes
  useEffect(() => {
    setBalanceCurrentPage(1);
  }, [debouncedBalanceSearch]);

  // Merged inventory: Inventory now includes batch data from API
  const mergedInventory = useMemo(() => {
    if (!selectedEmployeeId || !selectedStoreId) return [];

    // Inventory already has smart display + batch data from API
    // Just add company info
    return inventory.map((item) => {
      const product = products.find((p) => p.productId === item.productId);

      return {
        ...item,
        companyId: product?.companyId || null,
        companyName: product?.companyName || null,
        companyLogoUrl: product?.companyLogoUrl || null,
        // Batch data already included in item from API:
        // nearestExpiry, totalBatches, criticalCount, warningCount
      };
    });
  }, [products, inventory, selectedEmployeeId, selectedStoreId]);

  // Get unique companies from products
  const availableCompanies = useMemo(() => {
    const companyMap = new Map<string, { id: string; name: string; logoUrl: string | null }>();

    products.forEach((product) => {
      if (product.companyId && product.companyName && !companyMap.has(product.companyId)) {
        companyMap.set(product.companyId, {
          id: product.companyId,
          name: product.companyName,
          logoUrl: product.companyLogoUrl,
        });
      }
    });

    return Array.from(companyMap.values()).sort((a, b) => a.name.localeCompare(b.name, 'th'));
  }, [products]);

  // Filtered inventory based on search and company
  const filteredMergedInventory = useMemo(() => {
    let filtered = mergedInventory;

    // Filter by company
    if (selectedCompanyFilter) {
      filtered = filtered.filter((item) => item.companyId === selectedCompanyFilter);
    }

    // Filter by search
    if (debouncedBalanceSearch.trim()) {
      const query = debouncedBalanceSearch.trim().toLowerCase();
      filtered = filtered.filter(
        (item) =>
          item.productName.toLowerCase().includes(query) ||
          item.productCode.toLowerCase().includes(query)
      );
    }

    return filtered;
  }, [mergedInventory, debouncedBalanceSearch, selectedCompanyFilter]);

  // Pagination for balance tab
  const balanceTotalPages = Math.ceil(filteredMergedInventory.length / balanceItemsPerPage);
  const balanceStartIndex = (balanceCurrentPage - 1) * balanceItemsPerPage;
  const balanceEndIndex = balanceStartIndex + balanceItemsPerPage;
  const paginatedMergedInventory = filteredMergedInventory.slice(balanceStartIndex, balanceEndIndex);

  // Ensure current page is valid
  useEffect(() => {
    if (balanceCurrentPage > balanceTotalPages && balanceTotalPages > 0) {
      setBalanceCurrentPage(balanceTotalPages);
    }
  }, [balanceCurrentPage, balanceTotalPages]);

  // GPS Location Logic
  const ensureLocation = useCallback(
    async (options?: { force?: boolean }) => {
      const shouldForce = options?.force === true;
      const currentState = locationStateRef.current;
      if (!shouldForce && currentState.status === "resolved") {
        return currentState.coords;
      }
      if (typeof navigator === "undefined" || !("geolocation" in navigator)) {
        const message = "อุปกรณ์ของคุณไม่รองรับการขอพิกัด";
        setLocationState({ status: "error", message });
        throw new Error(message);
      }
      setLocationState((prev) => {
        if (shouldForce) {
          if (prev.status === "locating") {
            return prev;
          }
          return { status: "locating" };
        }
        if (prev.status === "resolved" || prev.status === "locating") {
          return prev;
        }
        return { status: "locating" };
      });
      try {
        const position = await new Promise<GeolocationPosition>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: true,
            timeout: 20000,
            maximumAge: 0,
          });
        });
        setLocationState({ status: "resolved", coords: position.coords });
        return position.coords;
      } catch (error) {
        let message = "ไม่สามารถดึงพิกัดได้";
        if (error instanceof GeolocationPositionError) {
          if (error.code === error.PERMISSION_DENIED) {
            message = "กรุณาอนุญาตการเข้าถึงตำแหน่งเพื่อใช้งานฟอร์ม";
          } else if (error.message) {
            message = error.message;
          }
        }
        setLocationState({ status: "error", message });
        throw new Error(message);
      }
    },
    []
  );

  useEffect(() => {
    void ensureLocation().catch(() => undefined);
  }, [ensureLocation]);

  const handleRefreshLocation = useCallback(() => {
    void ensureLocation({ force: true });
  }, [ensureLocation]);

  // Detect nearest store based on GPS
  const detectedStoreMatch = useMemo(() => {
    if (locationState.status !== "resolved") return null;
    const { latitude, longitude } = locationState.coords;
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
    const candidates = stores
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
          typeof store.radius === "number" && Number.isFinite(store.radius) ? store.radius : 100;
        const distance = haversineDistance(
          { latitude, longitude },
          { latitude: store.latitude, longitude: store.longitude }
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
          candidate
        ): candidate is {
          store: Store;
          distance: number;
          radius: number;
          withinRadius: boolean;
        } => candidate !== null
      );
    if (candidates.length === 0) return null;
    const sorted = [...candidates].sort((a, b) => a.distance - b.distance);
    const withinRadius = sorted.find((candidate) => candidate.withinRadius);
    return withinRadius ?? sorted[0] ?? null;
  }, [locationState, stores]);

  const detectedStore = detectedStoreMatch?.store ?? null;
  const nearestDistanceMeters = detectedStoreMatch ? Math.round(detectedStoreMatch.distance) : null;

  // Restrict employees to detected store based on assignments
  const restrictedEmployees = useMemo(() => {
    if (!detectedStore) return [];
    // Find all employees assigned to the detected store
    const assignedEmployeeIds = assignments
      .filter((a) => a.storeId === detectedStore.id)
      .map((a) => a.employeeId);
    return employees.filter((employee) => assignedEmployeeIds.includes(employee.id));
  }, [detectedStore, employees, assignments]);

  const restrictedEmployeeIds = useMemo(
    () => restrictedEmployees.map((employee) => employee.id),
    [restrictedEmployees]
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
    detectedStore && restrictedEmployees.length > 0 && !allowAllEmployees
  );

  const isOutOfAreaSelection = Boolean(
    detectedStore &&
    restrictedEmployeeIds.length > 0 &&
    selectedEmployeeId &&
    !restrictedEmployeeIds.includes(selectedEmployeeId)
  );

  // Get stores assigned to the selected employee (must be before useEffect that depends on it)
  const selectedEmployeeStores = useMemo(() => {
    if (!selectedEmployeeId) return [];
    const employeeAssignments = assignments.filter((a) => a.employeeId === selectedEmployeeId);
    const assignedStoreIds = employeeAssignments.map((a) => a.storeId);
    return stores.filter((store) => assignedStoreIds.includes(store.id));
  }, [selectedEmployeeId, assignments, stores]);

  const selectedEmployeePrimaryStoreId = useMemo(() => {
    if (!selectedEmployeeId) return null;
    const primaryAssignment = assignments.find(
      (a) => a.employeeId === selectedEmployeeId && a.isPrimary
    );
    return primaryAssignment?.storeId ?? null;
  }, [selectedEmployeeId, assignments]);

  // Auto-select store based on GPS and employee assignments
  useEffect(() => {
    // Don't auto-select if user has explicitly overridden or no GPS detection
    if (allowStoreOverride || !detectedStore) {
      return;
    }

    // If no employee selected, just use GPS detected store
    if (!selectedEmployeeId) {
      setSelectedStoreId((prev) => (prev === detectedStore.id ? prev : detectedStore.id));
      return;
    }

    // Check if the selected employee is assigned to the detected store
    const isEmployeeAssignedToDetectedStore = assignments.some(
      (a) => a.employeeId === selectedEmployeeId && a.storeId === detectedStore.id
    );

    if (isEmployeeAssignedToDetectedStore) {
      // Employee is assigned to GPS-detected store, auto-select it
      setSelectedStoreId((prev) => (prev === detectedStore.id ? prev : detectedStore.id));
    } else if (selectedEmployeeStores.length === 1) {
      // Employee has only one assigned store (not the detected one), use it
      setSelectedStoreId((prev) =>
        prev === selectedEmployeeStores[0].id ? prev : selectedEmployeeStores[0].id
      );
    } else if (selectedEmployeePrimaryStoreId) {
      // Employee has multiple stores, use primary store
      setSelectedStoreId((prev) =>
        prev === selectedEmployeePrimaryStoreId ? prev : selectedEmployeePrimaryStoreId
      );
    }
    // Otherwise, let user choose from dropdown
  }, [
    allowStoreOverride,
    detectedStore,
    selectedEmployeeId,
    assignments,
    selectedEmployeeStores,
    selectedEmployeePrimaryStoreId,
  ]);

  useEffect(() => {
    setAllowStoreOverride(false);
  }, [detectedStore?.id]);

  // Auto-select employee based on detected store
  useEffect(() => {
    if (!detectedStore || restrictedEmployeeIds.length === 0 || allowAllEmployees) {
      return;
    }
    setSelectedEmployeeId((prev) =>
      prev && restrictedEmployeeIds.includes(prev) ? prev : restrictedEmployeeIds[0] ?? ""
    );
  }, [allowAllEmployees, detectedStore, restrictedEmployeeIds]);

  useEffect(() => {
    setAllowAllEmployees(false);
  }, [detectedStore?.id]);

  // Restore last selected employee and store (only if GPS hasn't selected anyone yet)
  useEffect(() => {
    if (typeof window === "undefined" || selectedEmployeeId || employees.length === 0) return;

    // Wait for GPS to try auto-select first (give it 2 seconds)
    const timer = setTimeout(() => {
      // If still no selection after GPS had a chance, restore from localStorage
      if (!selectedEmployeeId) {
        const storedId = window.localStorage.getItem(LAST_EMPLOYEE_STORAGE_KEY);
        if (storedId && employees.some((emp) => emp.id === storedId)) {
          console.log('[Stock] Restoring employee from localStorage:', storedId);
          setSelectedEmployeeId(storedId);
        }
      }
    }, 2000);

    return () => clearTimeout(timer);
  }, [employees, selectedEmployeeId]);

  useEffect(() => {
    if (typeof window === "undefined" || selectedStoreId || stores.length === 0) return;
    const storedId = window.localStorage.getItem(LAST_STORE_STORAGE_KEY);
    if (storedId && stores.some((store) => store.id === storedId)) {
      setSelectedStoreId(storedId);
    }
  }, [stores, selectedStoreId]);

  // Save selected employee and store
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (selectedEmployeeId) {
      window.localStorage.setItem(LAST_EMPLOYEE_STORAGE_KEY, selectedEmployeeId);
    } else {
      window.localStorage.removeItem(LAST_EMPLOYEE_STORAGE_KEY);
    }
  }, [selectedEmployeeId]);

  useEffect(() => {
    if (typeof window === "undefined") return;
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

  // Auto-select employee based on GPS location (similar to attendance page)
  useEffect(() => {
    console.log('[Stock Auto-select] locationState:', locationState.status);
    console.log('[Stock Auto-select] selectedEmployeeId:', selectedEmployeeId);
    console.log('[Stock Auto-select] employees:', employees.length);
    console.log('[Stock Auto-select] stores:', stores.length);

    if (locationState.status !== "resolved") {
      console.log('[Stock Auto-select] Waiting for location...');
      return;
    }
    if (selectedEmployeeId) {
      console.log('[Stock Auto-select] Employee already selected');
      return; // Don't override if user already selected
    }
    if (employees.length === 0 || stores.length === 0) {
      console.log('[Stock Auto-select] No employees or stores yet');
      return;
    }

    const { latitude: userLat, longitude: userLng } = locationState.coords;
    console.log('[Stock Auto-select] User coords:', { userLat, userLng });

    // Find closest employee by their primary store
    let closestEmployee: Employee | null = null;
    let closestDistance = Infinity;

    for (const employee of employees) {
      const primaryStore = employee.default_store_id
        ? stores.find((s) => s.id === employee.default_store_id)
        : null;

      if (!primaryStore || !primaryStore.latitude || !primaryStore.longitude) {
        console.log(`[Stock Auto-select] Employee ${employee.name} has no valid store location`);
        continue;
      }

      const distance = haversineDistance(
        { latitude: userLat, longitude: userLng },
        { latitude: primaryStore.latitude, longitude: primaryStore.longitude }
      );

      console.log(`[Stock Auto-select] Distance to ${employee.name} (${primaryStore.name}): ${Math.round(distance)}m`);

      if (distance < closestDistance) {
        closestDistance = distance;
        closestEmployee = employee;
      }
    }

    console.log('[Stock Auto-select] Closest employee:', closestEmployee?.name, 'Distance:', Math.round(closestDistance), 'm');

    // Auto-select if found someone within reasonable range (5km)
    if (closestEmployee && closestDistance < 5000) {
      console.log(
        `[Stock Auto-select] ✅ Auto-selecting "${closestEmployee.name}" (${Math.round(closestDistance)}m)`
      );
      setSelectedEmployeeId(closestEmployee.id);
    } else {
      console.log('[Stock Auto-select] ❌ No employee within 5km range');
    }
  }, [
    locationState,
    employees,
    stores,
    selectedEmployeeId,
  ]);

  // Auto-select default store for employee
  useEffect(() => {
    const selectedEmployee = employees.find((emp) => emp.id === selectedEmployeeId);
    if (selectedEmployee?.default_store_id && !selectedStoreId) {
      setSelectedStoreId(selectedEmployee.default_store_id);
    }
  }, [selectedEmployeeId, employees, selectedStoreId]);

  // Computed values
  const selectedEmployee = useMemo(
    () => employees.find((emp) => emp.id === selectedEmployeeId),
    [employees, selectedEmployeeId]
  );

  const selectedStore = useMemo(
    () => stores.find((store) => store.id === selectedStoreId),
    [stores, selectedStoreId]
  );

  const _selectedReceiveProduct = useMemo(
    () => products.find((prod) => prod.productId === receiveProductId),
    [products, receiveProductId]
  );

  const _selectedReturnProduct = useMemo(
    () => products.find((prod) => prod.productId === returnProductId),
    [products, returnProductId]
  );

  const _selectedInitialProduct = useMemo(
    () => products.find((prod) => prod.productId === initialProductId),
    [products, initialProductId]
  );

  const locationSummary = useMemo(() => {
    if (locationState.status !== "resolved") return "";
    const { latitude, longitude, accuracy } = locationState.coords;
    const lat = latitude.toFixed(6);
    const lng = longitude.toFixed(6);
    const acc =
      typeof accuracy === "number" && Number.isFinite(accuracy) ? `±${Math.round(accuracy)}ม.` : "";
    return `ละติจูด ${lat}, ลองจิจูด ${lng}${acc ? ` (${acc})` : ""}`;
  }, [locationState]);

  // Summary metrics with unit breakdowns
  const _totalProducts = inventory.length;

  // Calculate totalIn by unit: group only "receive" type transactions by unit
  // This ensures only actual stock receipts are counted, not returns or adjustments
  const totalInByUnit = useMemo(() => {
    const unitMap = new Map<string, number>();
    recentTransactions
      .filter((t) => t.transactionType === "receive")
      .forEach((t) => {
        const current = unitMap.get(t.unitName) || 0;
        unitMap.set(t.unitName, current + t.quantity);
      });
    return unitMap;
  }, [recentTransactions]);

  // Calculate totalOut by unit: group only "sale" type transactions by unit
  // This ensures only actual sales are counted, not returns or adjustments
  const totalOutByUnit = useMemo(() => {
    const unitMap = new Map<string, number>();
    recentTransactions
      .filter((t) => t.transactionType === "sale")
      .forEach((t) => {
        const current = unitMap.get(t.unitName) || 0;
        unitMap.set(t.unitName, current + Math.abs(t.quantity));
      });
    return unitMap;
  }, [recentTransactions]);

  // Low stock calculation (using base units)
  const lowStockCount = inventory.filter((item) => item.quantityInBase > 0 && item.quantityInBase <= 10).length;

  // ✅ Group recent transactions by submission_id (transactions from the same form submit)
  const groupedRecentTransactions = useMemo(() => {
    if (recentTransactions.length === 0) return [];

    // Sort by created_at descending
    const sorted = [...recentTransactions].sort((a, b) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    const groups: Array<{
      groupKey: string;
      productId: string;
      productName: string;
      transactionType: TransactionType;
      createdAt: string;
      note?: string;
      units: Array<{ unitName: string; quantity: number }>;
    }> = [];

    for (const txn of sorted) {
      // ✅ Group by submission_id if available (transactions from same form submit)
      const submissionId = txn.submissionId;

      if (submissionId) {
        // Try to find existing group with same submission_id
        const existingGroup = groups.find((g) => g.groupKey === submissionId);

        if (existingGroup) {
          // ✅ Check if unit already exists in group (same unitName)
          const existingUnit = existingGroup.units.find((u) => u.unitName === txn.unitName);

          if (existingUnit) {
            // ✅ Unit exists - skip (already added, don't duplicate)
            // This handles deduct_stock_multi_batch creating multiple transactions
            // for the same original_quantity but different batches
          } else {
            // ✅ New unit - add to group
            existingGroup.units.push({ unitName: txn.unitName, quantity: txn.quantity });
          }
        } else {
          // Create new group with submission_id as key
          groups.push({
            groupKey: submissionId,
            productId: txn.productId,
            productName: txn.productName,
            transactionType: txn.transactionType,
            createdAt: txn.createdAt,
            note: txn.note,
            units: [{ unitName: txn.unitName, quantity: txn.quantity }],
          });
        }
      } else {
        // No submission_id - display as individual transaction (old data)
        groups.push({
          groupKey: txn.id,  // ✅ Use txn.id instead of txn.transactionId
          productId: txn.productId,
          productName: txn.productName,
          transactionType: txn.transactionType,
          createdAt: txn.createdAt,
          note: txn.note,
          units: [{ unitName: txn.unitName, quantity: txn.quantity }],
        });
      }
    }

    console.log('[Grouping] 📊 Total groups created:', groups.length);

    // Sort units within each group by size
    groups.forEach((group) => {
      const unitOrder = ["ลัง", "แพ็ค", "ซอง", "ปี๊บ", "กล่อง", "ชิ้น", "ขวด", "ถุง", "แกลลอน", "ถัง"];
      group.units.sort((a, b) => {
        const indexA = unitOrder.indexOf(a.unitName);
        const indexB = unitOrder.indexOf(b.unitName);
        if (indexA !== -1 && indexB !== -1) return indexA - indexB;
        if (indexA !== -1) return -1;
        if (indexB !== -1) return 1;
        return a.unitName.localeCompare(b.unitName, 'th');
      });
    });

    return groups;
  }, [recentTransactions]);

  // Helper function to highlight search match
  const _highlightMatch = useCallback((text: string, query: string): React.ReactNode => {
    if (!query.trim()) return text;

    const parts = text.split(new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'));
    return (
      <>
        {parts.map((part, i) =>
          part.toLowerCase() === query.toLowerCase() ? (
            <mark key={i} className="bg-yellow-200 font-semibold rounded px-0.5">
              {part}
            </mark>
          ) : (
            <span key={i}>{part}</span>
          )
        )}
      </>
    );
  }, []);

  // Filtered products for Receive modal
  const _filteredReceiveProducts = useMemo(() => {
    if (!_receiveProductSearch.trim()) return products;

    const query = _receiveProductSearch.trim().toLowerCase();
    return products.filter(
      (product) =>
        product.productName.toLowerCase().includes(query) ||
        product.productCode.toLowerCase().includes(query) ||
        product.companyName?.toLowerCase().includes(query)
    );
  }, [products, _receiveProductSearch]);

  // Filtered products for Return modal
  const _filteredReturnProducts = useMemo(() => {
    if (!_returnProductSearch.trim()) return products;

    const query = _returnProductSearch.trim().toLowerCase();
    return products.filter(
      (product) =>
        product.productName.toLowerCase().includes(query) ||
        product.productCode.toLowerCase().includes(query) ||
        product.companyName?.toLowerCase().includes(query)
    );
  }, [products, _returnProductSearch]);

  // Filtered products for Initial modal
  const _filteredInitialProducts = useMemo(() => {
    if (!_initialProductSearch.trim()) return products;

    const query = _initialProductSearch.trim().toLowerCase();
    return products.filter(
      (product) =>
        product.productName.toLowerCase().includes(query) ||
        product.productCode.toLowerCase().includes(query) ||
        product.companyName?.toLowerCase().includes(query)
    );
  }, [products, _initialProductSearch]);

  // Helper function to sort units by size (largest first)
  const sortUnitsBySize = useCallback((entries: Array<[string, number]>) => {
    const unitOrder = ["ลัง", "แพ็ค", "ซอง", "ปี๊บ", "กล่อง", "ชิ้น", "ขวด", "ถุง", "แกลลอน", "ถัง"];

    return entries.sort((a, b) => {
      const [unitA] = a;
      const [unitB] = b;

      const indexA = unitOrder.indexOf(unitA);
      const indexB = unitOrder.indexOf(unitB);

      // If both units are in the order list, sort by position
      if (indexA !== -1 && indexB !== -1) {
        return indexA - indexB;
      }

      // If only A is in the list, A comes first
      if (indexA !== -1) return -1;

      // If only B is in the list, B comes first
      if (indexB !== -1) return 1;

      // If neither is in the list, sort alphabetically
      return unitA.localeCompare(unitB, 'th');
    });
  }, []);

  // Helper function to format unit breakdown (e.g., "20 ลัง 20แพ็ค 10ซอง")
  const formatUnitBreakdown = useCallback((unitMap: Map<string, number>) => {
    if (unitMap.size === 0) return "0 หน่วย";

    const entries = Array.from(unitMap.entries())
      .filter(([_, qty]) => qty > 0);

    const sortedEntries = sortUnitsBySize(entries);

    const formatted = sortedEntries
      .map(([unitName, qty]) => `${qty.toLocaleString("th-TH")} ${unitName}`);

    return formatted.length > 0 ? formatted.join(" ") : "0 หน่วย";
  }, [sortUnitsBySize]);

  // Formatted breakdowns for display
  const totalInFormatted = formatUnitBreakdown(totalInByUnit);
  const totalOutFormatted = formatUnitBreakdown(totalOutByUnit);

  // Calculate total balance from inventory with unit breakdown
  const totalBalanceFormatted = useMemo(() => {
    if (inventory.length === 0) return "0 หน่วย";

    // Aggregate all units across all products
    const unitTotals = new Map<string, number>();

    inventory.forEach((item) => {
      item.displayUnits.forEach((unit) => {
        const current = unitTotals.get(unit.unitName) || 0;
        unitTotals.set(unit.unitName, current + unit.count);
      });
    });

    // Format as "X ลัง Y แพ็ค Z ชิ้น" with sorted units
    if (unitTotals.size === 0) {
      return `${inventory.reduce((sum, item) => sum + item.quantityInBase, 0).toLocaleString("th-TH")} หน่วยฐาน`;
    }

    // Sort units by size before formatting
    const entries = Array.from(unitTotals.entries())
      .filter(([_, count]) => count > 0);

    const sortedEntries = sortUnitsBySize(entries);

    const parts = sortedEntries
      .map(([unitName, count]) => `${count.toLocaleString("th-TH")} ${unitName}`);

    return parts.join(" ");
  }, [inventory, sortUnitsBySize]);

  // Handlers
  const handleEmployeeChange = useCallback((empId: string) => {
    setSelectedEmployeeId(empId);
    setSubmitState({ status: "idle" });
  }, []);

  const handleStoreChange = useCallback((storeId: string) => {
    setSelectedStoreId(storeId);
    setSubmitState({ status: "idle" });
  }, []);

  const resetReceiveForm = useCallback(() => {
    setReceiveProductId("");
    setReceiveUnitQuantities({});
    setReceiveNote("");
  }, []);

  const resetReturnForm = useCallback(() => {
    setReturnProductId("");
    setReturnUnitQuantities({});
    setReturnNote("");
  }, []);

  const resetInitialForm = useCallback(() => {
    setInitialProductId("");
    setInitialUnitQuantities({});
    setInitialNote("");
  }, []);

  const _addToCart = useCallback(() => {
    if (!receiveProductId) {
      setSubmitState({ status: "error", message: "กรุณาเลือกสินค้า" });
      return;
    }

    const selectedProduct = products.find((p) => p.productId === receiveProductId);
    if (!selectedProduct) {
      setSubmitState({ status: "error", message: "ไม่พบข้อมูลสินค้า" });
      return;
    }

    // Collect all units with quantity > 0
    const itemsToAdd: CartItem[] = [];

    for (const unit of selectedProduct.units) {
      const quantityStr = receiveUnitQuantities[unit.unitId];
      if (!quantityStr || !quantityStr.trim()) continue;

      const quantity = parseFloat(quantityStr);
      if (!Number.isFinite(quantity) || quantity <= 0) continue;

      itemsToAdd.push({
        productId: receiveProductId,
        productCode: selectedProduct.productCode,
        productName: selectedProduct.productName,
        unitId: unit.unitId,
        unitName: unit.unitName,
        quantity,
        note: receiveNote.trim() || undefined,
        assignmentId: selectedProduct.assignmentId,
      });
    }

    if (itemsToAdd.length === 0) {
      setSubmitState({ status: "error", message: "กรุณาระบุจำนวนอย่างน้อย 1 หน่วย" });
      return;
    }

    // ✅ Check if editing existing item
    if (editingCartItemIndex !== null) {
      // Replace the item at editingCartItemIndex
      setReceiveCart((prev) => {
        const newCart = [...prev];
        // Remove old item
        newCart.splice(editingCartItemIndex, 1);
        // Add new items at the same position
        newCart.splice(editingCartItemIndex, 0, ...itemsToAdd);
        return newCart;
      });
      // Clear editing state
      setEditingCartItemIndex(null);
      setEditingCartItemData(null);
    } else {
      // Normal add to cart
      setReceiveCart((prev) => [...prev, ...itemsToAdd]);
    }

    resetReceiveForm();
    setSubmitState({ status: "idle" });
  }, [receiveProductId, receiveUnitQuantities, receiveNote, products, resetReceiveForm, editingCartItemIndex]);

  // ✅ Remove from cart with confirmation
  const _removeFromCart = useCallback((index: number) => {
    const item = receiveCart[index];
    if (!item) return;

    const confirmed = window.confirm(
      `ต้องการลบรายการนี้ออกจากตะกร้าใช่หรือไม่?\n\n${item.productName}\n${item.unitName}: ${item.quantity.toLocaleString("th-TH")}`
    );

    if (confirmed) {
      setReceiveCart((prev) => prev.filter((_, i) => i !== index));
    }
  }, [receiveCart]);

  // ✅ Edit cart item - open form with existing data
  // ✅ FIX: Use assignmentId from cart item directly (not from products array)
  const editCartItem = useCallback((index: number, cartType: 'receive' | 'return' = 'receive') => {
    console.log('[editCartItem] Called with index:', index, 'cartType:', cartType);

    // Select the correct cart
    const cart = cartType === 'receive' ? receiveCart : returnCart;
    const item = cart[index];

    if (!item) {
      console.error('[editCartItem] Item not found at index:', index);
      return;
    }

    console.log('[editCartItem] Item:', item);

    // ✅ Find ALL cart items with the same assignmentId (same product-employee-store assignment)
    const allItemsOfProduct = cart.filter(cartItem => cartItem.assignmentId === item.assignmentId);
    console.log('[editCartItem] Found all items of this assignment:', allItemsOfProduct);

    // ✅ Build unitQuantities from ALL units of this product
    // We need to convert unitId → assignmentUnitId for the form
    const product = products.find(p => p.assignmentId === item.assignmentId);
    if (!product) {
      console.error('[editCartItem] Product not found for assignmentId:', item.assignmentId);
      console.log('[editCartItem] Available assignments:', products.map(p => ({ assignmentId: p.assignmentId, productCode: p.productCode })));
      alert('ไม่พบข้อมูลสินค้า กรุณาลองใหม่อีกครั้ง');
      return;
    }

    const unitQuantities: Record<string, number> = {};
    for (const cartItem of allItemsOfProduct) {
      const unit = product.units.find(u => u.unitId === cartItem.unitId);
      if (unit) {
        unitQuantities[unit.assignmentUnitId] = cartItem.quantity;
      }
    }

    console.log('[editCartItem] Combined unitQuantities:', unitQuantities);

    // Store editing state (store assignmentId to identify which items to replace)
    const editData = {
      assignmentId: item.assignmentId,  // ✅ Use assignmentId from cart item
      unitQuantities,
      productId: item.productId,  // ✅ Keep for backward compatibility
    };

    console.log('[editCartItem] Setting editing data:', editData);
    setEditingCartItemIndex(index);  // Keep for reference
    setEditingCartItemData(editData);

    // Open the correct modal based on cart type
    console.log('[editCartItem] Opening modal...');
    if (cartType === 'receive') {
      setIsReceiveModalOpen(true);
    } else {
      setIsReturnModalOpen(true);
    }
  }, [receiveCart, returnCart, products]);

  // ✅ Edit adjustment cart item (for Initial Stock)
  const editAdjustmentCartItem = useCallback((index: number) => {
    console.log('[editAdjustmentCartItem] Called with index:', index);

    const item = adjustmentCart[index];

    if (!item) {
      console.error('[editAdjustmentCartItem] Item not found at index:', index);
      return;
    }

    console.log('[editAdjustmentCartItem] Item:', item);

    // ✅ Find ALL cart items with the same assignmentId
    const allItemsOfProduct = adjustmentCart.filter(cartItem => cartItem.assignmentId === item.assignmentId);
    console.log('[editAdjustmentCartItem] Found all items of this assignment:', allItemsOfProduct);

    // ✅ Build unitQuantities from ALL units of this product
    const product = products.find(p => p.assignmentId === item.assignmentId);
    if (!product) {
      console.error('[editAdjustmentCartItem] Product not found for assignmentId:', item.assignmentId);
      alert('ไม่พบข้อมูลสินค้า กรุณาลองใหม่อีกครั้ง');
      return;
    }

    const unitQuantities: Record<string, number> = {};
    for (const cartItem of allItemsOfProduct) {
      const unit = product.units.find(u => u.unitId === cartItem.unitId);
      if (unit) {
        unitQuantities[unit.assignmentUnitId] = cartItem.quantity;
      }
    }

    console.log('[editAdjustmentCartItem] Combined unitQuantities:', unitQuantities);

    // Store editing state
    const editData = {
      assignmentId: item.assignmentId,
      unitQuantities,
      productId: item.productId,
    };

    console.log('[editAdjustmentCartItem] Setting editing data:', editData);
    setEditingCartItemIndex(index);
    setEditingCartItemData(editData);

    // Open Initial Stock modal
    console.log('[editAdjustmentCartItem] Opening Initial modal...');
    setIsInitialModalOpen(true);
  }, [adjustmentCart, products]);

  const clearCart = useCallback(() => {
    setReceiveCart([]);
    setReceiveGlobalNote("");
    setProductBatches({});  // ✅ Clear all product batches
    setEditingBatchProductId(null);  // ✅ Close batch modal if open
  }, []);

  // Update batch data for a specific cart item
  // ✅ Update batch data for a specific product (shared across all units)
  const updateProductBatch = useCallback((productId: string, batchData: ProductBatchData) => {
    setProductBatches((prev) => ({
      ...prev,
      [productId]: batchData,
    }));
    setEditingBatchProductId(null); // Close modal
  }, []);

  // ✅ Group cart items by product (for Product-Level Batch UI)
  const groupedReceiveCart = useMemo(() => {
    const grouped: Record<string, {
      productId: string;
      productCode: string;
      productName: string;
      companyId: string | null;
      companyName: string | null;
      companyLogoUrl: string | null;
      items: CartItem[];
    }> = {};

    receiveCart.forEach((item) => {
      if (!grouped[item.productId]) {
        grouped[item.productId] = {
          productId: item.productId,
          productCode: item.productCode,
          productName: item.productName,
          companyId: item.companyId ?? null,
          companyName: item.companyName ?? null,
          companyLogoUrl: item.companyLogoUrl ?? null,
          items: [],
        };
      }
      grouped[item.productId].items.push(item);
    });

    return Object.values(grouped);
  }, [receiveCart]);

  // ✅ Grouped Return Cart (same structure as receive)
  const groupedReturnCart = useMemo(() => {
    const grouped: Record<string, {
      productId: string;
      productCode: string;
      productName: string;
      companyId: string | null;
      companyName: string | null;
      companyLogoUrl: string | null;
      items: CartItem[];
    }> = {};

    returnCart.forEach((item) => {
      if (!grouped[item.productId]) {
        grouped[item.productId] = {
          productId: item.productId,
          productCode: item.productCode,
          productName: item.productName,
          companyId: item.companyId ?? null,
          companyName: item.companyName ?? null,
          companyLogoUrl: item.companyLogoUrl ?? null,
          items: [],
        };
      }
      grouped[item.productId].items.push(item);
    });

    return Object.values(grouped);
  }, [returnCart]);

  // ✅ Grouped Adjustment Cart (for Initial Stock - same structure as receive)
  const groupedAdjustmentCart = useMemo(() => {
    const grouped: Record<string, {
      productId: string;
      productCode: string;
      productName: string;
      companyId: string | null;
      companyName: string | null;
      companyLogoUrl: string | null;
      items: CartItem[];
    }> = {};

    adjustmentCart.forEach((item) => {
      if (!grouped[item.productId]) {
        grouped[item.productId] = {
          productId: item.productId,
          productCode: item.productCode,
          productName: item.productName,
          companyId: item.companyId ?? null,
          companyName: item.companyName ?? null,
          companyLogoUrl: item.companyLogoUrl ?? null,
          items: [],
        };
      }
      grouped[item.productId].items.push(item);
    });

    return Object.values(grouped);
  }, [adjustmentCart]);

  // Return cart functions
  const _addToReturnCart = useCallback(() => {
    if (!returnProductId) {
      setSubmitState({ status: "error", message: "กรุณาเลือกสินค้า" });
      return;
    }

    const selectedProduct = products.find((p) => p.productId === returnProductId);
    if (!selectedProduct) {
      setSubmitState({ status: "error", message: "ไม่พบข้อมูลสินค้า" });
      return;
    }

    // Collect all units with quantity > 0
    const itemsToAdd: CartItem[] = [];

    for (const unit of selectedProduct.units) {
      const quantityStr = returnUnitQuantities[unit.unitId];
      if (!quantityStr || !quantityStr.trim()) continue;

      const quantity = parseFloat(quantityStr);
      if (!Number.isFinite(quantity) || quantity <= 0) continue;

      // Check balance in base units
      const inventoryItem = inventory.find((item) => item.productId === returnProductId);

      if (!inventoryItem || inventoryItem.quantityInBase === 0) {
        setSubmitState({
          status: "error",
          message: `${unit.unitName}: ไม่มีสต็อกคงเหลือให้คืน`,
        });
        return;
      }

      // Convert requested quantity to base units and check
      const requestedInBase = quantity * unit.multiplierToBase;
      if (requestedInBase > inventoryItem.quantityInBase) {
        // Calculate max available in this unit for friendly error message
        const maxInThisUnit = Math.floor(inventoryItem.quantityInBase / unit.multiplierToBase);
        setSubmitState({
          status: "error",
          message: `${unit.unitName}: จำนวนเกินคงเหลือ (มีเพียง ${maxInThisUnit.toLocaleString("th-TH")} ${unit.unitName})`,
        });
        return;
      }

      itemsToAdd.push({
        productId: returnProductId,
        productCode: selectedProduct.productCode,
        productName: selectedProduct.productName,
        unitId: unit.unitId,
        unitName: unit.unitName,
        quantity,
        note: returnNote.trim() || undefined,
        assignmentId: selectedProduct.assignmentId,
      });
    }

    if (itemsToAdd.length === 0) {
      setSubmitState({ status: "error", message: "กรุณาระบุจำนวนอย่างน้อย 1 หน่วย" });
      return;
    }

    setReturnCart((prev) => [...prev, ...itemsToAdd]);
    resetReturnForm();
    setSubmitState({ status: "idle" });
  }, [returnProductId, returnUnitQuantities, returnNote, products, inventory, resetReturnForm]);

  const _removeFromReturnCart = useCallback((index: number) => {
    setReturnCart((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const clearReturnCart = useCallback(() => {
    setReturnCart([]);
    setReturnGlobalNote("");
    setEditingReturnBatchIndex(null);
    setAvailableReturnBatches([]);
  }, []);

  // Fetch available batches for return item
  const fetchReturnBatches = useCallback(async (productId: string) => {
    if (!selectedEmployeeId || !selectedStoreId) return;

    setLoadingReturnBatches(true);
    try {
      const params = new URLSearchParams({
        productId,
        employeeId: selectedEmployeeId,
        storeId: selectedStoreId,
      });

      const response = await fetch(`/api/stock/batches/by-product?${params}`);
      const data = await response.json();

      if (data.success) {
        setAvailableReturnBatches(data.data.batches);
      } else {
        console.error('[Return Batches] API error:', data.error);
        setAvailableReturnBatches([]);
      }
    } catch (error) {
      console.error('[Return Batches] Error fetching batches:', error);
      setAvailableReturnBatches([]);
    } finally {
      setLoadingReturnBatches(false);
    }
  }, [selectedEmployeeId, selectedStoreId]);

  // Select batch for return item
  const selectReturnBatch = useCallback((index: number, batch: {
    id: string;
    lotNumber: string;
    expiryDate: string | null;
    daysUntilExpiry: number | null;
    expiryStatus: 'ok' | 'warning' | 'critical' | 'expired' | 'no_expiry';
    remainingQuantity: number | null;  // ✅ NEW: Include remaining quantity
  }) => {
    setReturnCart((prev) =>
      prev.map((item, i) =>
        i === index
          ? {
            ...item,
            selectedBatch: {
              batchId: batch.id,
              lotNumber: batch.lotNumber,
              expiryDate: batch.expiryDate,
              daysUntilExpiry: batch.daysUntilExpiry,
              expiryStatus: batch.expiryStatus,
              remainingQuantity: batch.remainingQuantity,  // ✅ NEW: Store remaining quantity
            },
          }
          : item
      )
    );
    setEditingReturnBatchIndex(null);
  }, []);

  // Adjustment cart functions
  const _addToAdjustmentCart = useCallback(() => {
    if (!initialProductId) {
      setSubmitState({ status: "error", message: "กรุณาเลือกสินค้า" });
      return;
    }

    const selectedProduct = products.find((p) => p.productId === initialProductId);
    if (!selectedProduct) {
      setSubmitState({ status: "error", message: "ไม่พบข้อมูลสินค้า" });
      return;
    }

    // Collect all units with quantity >= 0
    const itemsToAdd: CartItem[] = [];

    for (const unit of selectedProduct.units) {
      const quantityStr = initialUnitQuantities[unit.unitId];
      if (!quantityStr || !quantityStr.trim()) continue;

      const quantity = parseFloat(quantityStr);
      if (!Number.isFinite(quantity) || quantity < 0) continue;

      // ✅ Duplicate Check: Check if initial stock already exists for this product+unit
      const existingInitial = initialStockHistory.find(
        (h) => h.productId === initialProductId && h.unitId === unit.unitId
      );

      if (existingInitial) {
        setSubmitState({
          status: "error",
          message: `${selectedProduct.productName} (${unit.unitName}) มีการตั้งค่าสต็อกเริ่มต้นแล้ว: ${existingInitial.quantity.toLocaleString('th-TH')} ${existingInitial.unitName}`,
        });
        return;
      }

      itemsToAdd.push({
        productId: initialProductId,
        productCode: selectedProduct.productCode,
        productName: selectedProduct.productName,
        unitId: unit.unitId,
        unitName: unit.unitName,
        quantity,
        note: initialNote.trim() || undefined,
        assignmentId: selectedProduct.assignmentId,
      });
    }

    if (itemsToAdd.length === 0) {
      setSubmitState({ status: "error", message: "กรุณาระบุจำนวนอย่างน้อย 1 หน่วย" });
      return;
    }

    setAdjustmentCart((prev) => [...prev, ...itemsToAdd]);
    resetInitialForm();
    setSubmitState({ status: "idle" });
  }, [initialProductId, initialUnitQuantities, initialNote, products, initialStockHistory, resetInitialForm]);

  const removeFromAdjustmentCart = useCallback((index: number) => {
    setAdjustmentCart((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const clearAdjustmentCart = useCallback(() => {
    setAdjustmentCart([]);
    setAdjustmentGlobalNote("");
  }, []);

  // Multi-product handlers for StockProductBottomSheet
  const handleReceiveAdd = useCallback(
    (items: Array<{ assignmentId: string; unitQuantities: Record<string, number> }>) => {
      const cartItems: CartItem[] = [];

      for (const item of items) {
        const product = products.find((p) => p.assignmentId === item.assignmentId);
        if (!product) continue;

        for (const [assignmentUnitId, quantity] of Object.entries(item.unitQuantities)) {
          const unit = product.units.find((u) => u.assignmentUnitId === assignmentUnitId);
          if (!unit || quantity <= 0) continue;

          cartItems.push({
            productId: product.productId,
            productCode: product.productCode,
            productName: product.productName,
            unitId: unit.unitId,
            unitName: unit.unitName,
            quantity,
            companyId: product.companyId,
            companyName: product.companyName,
            companyLogoUrl: product.companyLogoUrl,
            assignmentId: product.assignmentId,  // ✅ เก็บ assignmentId ไว้ใน cart
          });
        }
      }

      if (cartItems.length > 0) {
        // ✅ Check if editing existing item
        if (editingCartItemIndex !== null && editingCartItemData) {
          // ✅ Remove ALL items of the same product (not just one)
          const productIdToReplace = editingCartItemData.productId;
          setReceiveCart((prev) => {
            // Filter out all items of the same product
            const otherItems = prev.filter(item => item.productId !== productIdToReplace);
            // Add new items
            return [...otherItems, ...cartItems];
          });
          // Clear editing state
          setEditingCartItemIndex(null);
          setEditingCartItemData(null);
        } else {
          // Normal add to cart
          setReceiveCart((prev) => [...prev, ...cartItems]);
        }
        setSubmitState({ status: "idle" });
      }
    },
    [products, editingCartItemIndex, editingCartItemData]
  );

  const handleReturnAdd = useCallback(
    (items: Array<{ assignmentId: string; unitQuantities: Record<string, number> }>) => {
      const cartItems: CartItem[] = [];

      for (const item of items) {
        const product = products.find((p) => p.assignmentId === item.assignmentId);
        if (!product) continue;

        for (const [assignmentUnitId, quantity] of Object.entries(item.unitQuantities)) {
          const unit = product.units.find((u) => u.assignmentUnitId === assignmentUnitId);
          if (!unit || quantity <= 0) continue;

          // Check stock balance
          const inventoryItem = inventory.find((inv) => inv.productId === product.productId);
          if (!inventoryItem || inventoryItem.quantityInBase === 0) {
            setSubmitState({
              status: "error",
              message: `${unit.unitName}: ไม่มีสต็อกคงเหลือให้คืน`,
            });
            return;
          }

          const requestedInBase = quantity * unit.multiplierToBase;
          if (requestedInBase > inventoryItem.quantityInBase) {
            const maxInThisUnit = Math.floor(inventoryItem.quantityInBase / unit.multiplierToBase);
            setSubmitState({
              status: "error",
              message: `${unit.unitName}: จำนวนเกินคงเหลือ (มีเพียง ${maxInThisUnit.toLocaleString("th-TH")} ${unit.unitName})`,
            });
            return;
          }

          cartItems.push({
            productId: product.productId,
            productCode: product.productCode,
            productName: product.productName,
            unitId: unit.unitId,
            unitName: unit.unitName,
            quantity,
            companyId: product.companyId,
            companyName: product.companyName,
            companyLogoUrl: product.companyLogoUrl,
            assignmentId: product.assignmentId,  // ✅ เก็บ assignmentId ไว้ใน cart
          });
        }
      }

      if (cartItems.length > 0) {
        setReturnCart((prev) => [...prev, ...cartItems]);
        setSubmitState({ status: "idle" });
      }
    },
    [products, inventory]
  );

  const handleInitialAdd = useCallback(
    (items: Array<{ assignmentId: string; unitQuantities: Record<string, number> }>) => {
      const cartItems: CartItem[] = [];

      for (const item of items) {
        const product = products.find((p) => p.assignmentId === item.assignmentId);
        if (!product) continue;

        for (const [assignmentUnitId, quantity] of Object.entries(item.unitQuantities)) {
          const unit = product.units.find((u) => u.assignmentUnitId === assignmentUnitId);
          if (!unit || quantity < 0) continue;

          // Check for duplicate initial stock
          const existingInitial = initialStockHistory.find(
            (h) => h.productId === product.productId && h.unitId === unit.unitId
          );

          if (existingInitial) {
            setSubmitState({
              status: "error",
              message: `${unit.unitName}: มีการตั้งสต็อกต้นแล้ว`,
            });
            return;
          }

          cartItems.push({
            productId: product.productId,
            productCode: product.productCode,
            productName: product.productName,
            unitId: unit.unitId,
            unitName: unit.unitName,
            quantity,
            companyId: product.companyId,
            companyName: product.companyName,
            companyLogoUrl: product.companyLogoUrl,
            assignmentId: product.assignmentId,  // ✅ เก็บ assignmentId ไว้ใน cart
          });
        }
      }

      if (cartItems.length > 0) {
        setAdjustmentCart((prev) => [...prev, ...cartItems]);
        setSubmitState({ status: "idle" });
      }
    },
    [products, initialStockHistory]
  );

  // Handlers for elderly modal (convert string quantities to numbers)
  const handleReceiveElderlyAdd = useCallback(
    (items: Array<{ assignmentId: string; unitQuantities: Record<string, string> }>) => {
      const convertedItems = items.map((item) => ({
        assignmentId: item.assignmentId,
        unitQuantities: Object.fromEntries(
          Object.entries(item.unitQuantities).map(([key, value]) => [key, Number.parseFloat(value) || 0])
        ),
      }));
      handleReceiveAdd(convertedItems);
    },
    [handleReceiveAdd]
  );

  const handleReturnElderlyAdd = useCallback(
    (items: Array<{ assignmentId: string; unitQuantities: Record<string, string> }>) => {
      const convertedItems = items.map((item) => ({
        assignmentId: item.assignmentId,
        unitQuantities: Object.fromEntries(
          Object.entries(item.unitQuantities).map(([key, value]) => [key, Number.parseFloat(value) || 0])
        ),
      }));
      handleReturnAdd(convertedItems);
    },
    [handleReturnAdd]
  );

  const handleInitialElderlyAdd = useCallback(
    (items: Array<{ assignmentId: string; unitQuantities: Record<string, string> }>) => {
      const convertedItems = items.map((item) => ({
        assignmentId: item.assignmentId,
        unitQuantities: Object.fromEntries(
          Object.entries(item.unitQuantities).map(([key, value]) => [key, Number.parseFloat(value) || 0])
        ),
      }));
      handleInitialAdd(convertedItems);
    },
    [handleInitialAdd]
  );

  const handleReceiveSubmit = useCallback(
    async (e: FormEvent<HTMLFormElement>) => {
      e.preventDefault();

      if (!selectedEmployeeId) {
        setSubmitState({ status: "error", message: "กรุณาเลือกพนักงาน" });
        return;
      }

      if (!selectedStoreId) {
        setSubmitState({ status: "error", message: "กรุณาเลือกร้านค้า" });
        return;
      }

      if (receiveCart.length === 0) {
        setSubmitState({ status: "error", message: "กรุณาเพิ่มสินค้าอย่างน้อย 1 รายการ" });
        return;
      }

      setSubmitState({ status: "submitting" });

      try {
        // ✅ Generate submission_id to group all transactions from this submit
        const submissionId = crypto.randomUUID();

        // ✅ Generate auto lot_number ONCE (outside loop) - use submission_id for uniqueness
        const autoLotNumberBase = `AUTO-${new Date().toISOString().split('T')[0]}-${submissionId.substring(0, 8)}`;

        // Submit all items in cart
        for (const item of receiveCart) {
          const note = receiveGlobalNote.trim()
            ? `${receiveGlobalNote}${item.note ? ` | ${item.note}` : ""}`
            : item.note;

          // ✅ Get Product-Level Batch data (FDA/GMP compliant: 1 product = 1 batch)
          const productBatch = productBatches[item.productId] || {};

          // ✅ Use product-specific lot_number with autoLotNumberBase (same for all units of same product)
          const autoLotNumber = `${autoLotNumberBase}-${item.productCode}`;

          const batchData = {
            lot_number: productBatch.lotNumber?.trim() || autoLotNumber,  // ✅ Auto-generate ถ้าไม่กรอก
            mfg_date: productBatch.mfgDate?.trim() || undefined,
            exp_date: productBatch.expDate?.trim() || undefined,
          };

          console.log('[Stock Submit] Batch data:', {
            productId: item.productId,
            productName: item.productName,
            unitName: item.unitName,
            quantity: item.quantity,
            lotNumber: batchData.lot_number,
            isAutoGenerated: !productBatch.lotNumber,
            batchData: batchData
          });

          await transactionMutation.mutateAsync({
            transactionType: "receive",
            employeeId: selectedEmployeeId,
            storeId: selectedStoreId,
            productId: item.productId,
            unitId: item.unitId,
            quantity: Math.round(item.quantity), // Ensure integer
            note: note || undefined,
            batchData: batchData, // ✅ Product-Level batch (same for all units)
            submissionId: submissionId,  // ✅ Group transactions from same submit
          });
        }

        clearCart();
        setIsReceiveModalOpen(false);
        setSubmitState({ status: "idle" });

        // Show success notification
        setNotificationType('success');
        setNotificationTitle('บันทึกรับเข้าสำเร็จ');
        setNotificationMessage(`บันทึกรายการรับเข้าเรียบร้อยแล้ว (${receiveCart.length} รายการ)`);
        setShowNotification(true);
      } catch (error) {
        const message = error instanceof Error ? error.message : "เกิดข้อผิดพลาด";
        setSubmitState({ status: "idle" });

        // Show error notification
        setNotificationType('error');
        setNotificationTitle('เกิดข้อผิดพลาด');
        setNotificationMessage(message);
        setShowNotification(true);
      }
    },
    [
      selectedEmployeeId,
      selectedStoreId,
      receiveCart,
      receiveGlobalNote,
      productBatches,
      transactionMutation,
      clearCart,
    ]
  );

  const handleReturnSubmit = useCallback(
    async (e: FormEvent<HTMLFormElement>) => {
      e.preventDefault();

      if (!selectedEmployeeId) {
        setSubmitState({ status: "error", message: "กรุณาเลือกพนักงาน" });
        return;
      }

      if (!selectedStoreId) {
        setSubmitState({ status: "error", message: "กรุณาเลือกร้านค้า" });
        return;
      }

      if (returnCart.length === 0) {
        setSubmitState({ status: "error", message: "กรุณาเพิ่มสินค้าอย่างน้อย 1 รายการ" });
        return;
      }

      setSubmitState({ status: "submitting" });

      try {
        // ✅ Generate submission_id to group all transactions from this submit
        const submissionId = crypto.randomUUID();

        // Submit all items in cart
        for (const item of returnCart) {
          const note = returnGlobalNote.trim()
            ? `${returnGlobalNote}${item.note ? ` | ${item.note}` : ""}`
            : item.note;

          // ✅ Validate batch remaining quantity before submit
          if (item.selectedBatch) {
            // Check if remainingQuantity is available (new batches have it, old ones don't)
            if (item.selectedBatch.remainingQuantity == null) {
              setSubmitState({
                status: "error",
                message: `${item.productName}: กรุณาเลือก Batch ใหม่อีกครั้ง (ข้อมูลเก่าไม่มีจำนวนคงเหลือ)`,
              });
              return;
            }

            const selectedUnit = products
              .find(p => p.productId === item.productId)
              ?.units.find(u => u.unitId === item.unitId);

            if (selectedUnit) {
              const quantityInBase = item.quantity * selectedUnit.multiplierToBase;

              if (quantityInBase > item.selectedBatch.remainingQuantity) {
                const maxInThisUnit = Math.floor(
                  item.selectedBatch.remainingQuantity / selectedUnit.multiplierToBase
                );
                setSubmitState({
                  status: "error",
                  message: `${item.productName}: Batch ${item.selectedBatch.lotNumber} คงเหลือเพียง ${maxInThisUnit} ${item.unitName} ไม่สามารถคืน ${item.quantity} ${item.unitName} ได้\n\n💡 แนะนำ: แบ่งคืนเป็นหลายรายการ หรือเลือก batch อื่นที่มีจำนวนมากกว่า`,
                });
                return;
              }
            }
          }

          // Prepare transaction data
          const transactionData: {
            transactionType: TransactionType;
            employeeId: string;
            storeId: string;
            productId: string;
            unitId: string;
            quantity: number;
            note?: string;
            batchId?: string;
            submissionId?: string;  // ✅ Add submission_id
          } = {
            transactionType: "return" as TransactionType,
            employeeId: selectedEmployeeId,
            storeId: selectedStoreId,
            productId: item.productId,
            unitId: item.unitId,
            quantity: Math.round(item.quantity), // Ensure integer
            note: note || undefined,
            submissionId: submissionId,  // ✅ Group transactions from same submit
          };

          // Include batch_id if selected
          if (item.selectedBatch) {
            transactionData.batchId = item.selectedBatch.batchId;
          }

          await transactionMutation.mutateAsync(transactionData);
        }

        clearReturnCart();
        setIsReturnModalOpen(false);
        setSubmitState({ status: "idle" });

        // Show success notification
        setNotificationType('success');
        setNotificationTitle('บันทึกคืนสินค้าสำเร็จ');
        setNotificationMessage(`บันทึกรายการคืนสินค้าเรียบร้อยแล้ว (${returnCart.length} รายการ)`);
        setShowNotification(true);
      } catch (error) {
        const message = error instanceof Error ? error.message : "เกิดข้อผิดพลาด";
        setSubmitState({ status: "idle" });

        // Show error notification
        setNotificationType('error');
        setNotificationTitle('เกิดข้อผิดพลาด');
        setNotificationMessage(message);
        setShowNotification(true);
      }
    },
    [
      selectedEmployeeId,
      selectedStoreId,
      returnCart,
      returnGlobalNote,
      products,
      transactionMutation,
      clearReturnCart,
    ]
  );

  const handleInitialSubmit = useCallback(
    async (e: FormEvent<HTMLFormElement>) => {
      e.preventDefault();

      if (!selectedEmployeeId) {
        setSubmitState({ status: "error", message: "กรุณาเลือกพนักงาน" });
        return;
      }

      if (!selectedStoreId) {
        setSubmitState({ status: "error", message: "กรุณาเลือกร้านค้า" });
        return;
      }

      if (adjustmentCart.length === 0) {
        setSubmitState({ status: "error", message: "กรุณาเพิ่มสินค้าอย่างน้อย 1 รายการ" });
        return;
      }

      setSubmitState({ status: "submitting" });

      try {
        // ✅ Generate submission_id to group all transactions from this submit
        const submissionId = crypto.randomUUID();

        // Submit all items in cart
        for (const item of adjustmentCart) {
          const globalNote = adjustmentGlobalNote.trim();
          const itemNote = item.note;
          const noteText = globalNote
            ? `ตั้งค่าสต็อกเริ่มต้น: ${globalNote}${itemNote ? ` | ${itemNote}` : ""}`
            : itemNote
              ? `ตั้งค่าสต็อกเริ่มต้น: ${itemNote}`
              : "ตั้งค่าสต็อกเริ่มต้น";

          // ✅ Auto-generate batch data (เหมือน receive)
          const productBatch = productBatches[item.productId] || {};
          const autoLotNumber = `INIT-${new Date().toISOString().split('T')[0]}-${item.productCode}-${Date.now()}`;

          const batchData = {
            lot_number: productBatch.lotNumber?.trim() || autoLotNumber,
            mfg_date: productBatch.mfgDate?.trim() || undefined,
            exp_date: productBatch.expDate?.trim() || undefined,
          };

          await transactionMutation.mutateAsync({
            transactionType: "initial",
            employeeId: selectedEmployeeId,
            storeId: selectedStoreId,
            productId: item.productId,
            unitId: item.unitId,
            quantity: Math.round(item.quantity), // Ensure integer
            note: noteText,
            batchData: batchData,  // ✅ ส่ง batch data ไปด้วย
            submissionId: submissionId,  // ✅ Group transactions from same submit
          });
        }

        clearAdjustmentCart();
        setIsInitialModalOpen(false);
        setSubmitState({ status: "idle" });

        // Show success notification
        setNotificationType('success');
        setNotificationTitle('ตั้งค่าสต็อกเริ่มต้นสำเร็จ');
        setNotificationMessage(`บันทึกสต็อกเริ่มต้นเรียบร้อยแล้ว (${adjustmentCart.length} รายการ)`);
        setShowNotification(true);
      } catch (error) {
        const message = error instanceof Error ? error.message : "เกิดข้อผิดพลาด";
        setSubmitState({ status: "idle" });

        // Show error notification
        setNotificationType('error');
        setNotificationTitle('เกิดข้อผิดพลาด');
        setNotificationMessage(message);
        setShowNotification(true);
      }
    },
    [
      selectedEmployeeId,
      selectedStoreId,
      adjustmentCart,
      adjustmentGlobalNote,
      transactionMutation,
      clearAdjustmentCart,
    ]
  );


  // Display labels
  const employeeLabel = selectedEmployee
    ? `${selectedEmployee.name}${selectedEmployee.employee_code ? ` (${selectedEmployee.employee_code})` : ""}`
    : "ยังไม่เลือก";

  const storeLabel = selectedStore ? selectedStore.name : "ยังไม่เลือก";

  // Transaction icons and colors
  const transactionIcons: Record<TransactionType, React.ReactElement> = {
    receive: <PackagePlus className="h-4 w-4" />,
    sale: <ShoppingCart className="h-4 w-4" />,
    return: <PackageMinus className="h-4 w-4" />,
    initial: <PackageCheck className="h-4 w-4" />,
    adjustment: <Settings className="h-4 w-4" />, // Still needed for transaction list display
  };

  const transactionColors: Record<TransactionType, string> = {
    receive: "from-blue-500 to-cyan-500",
    sale: "from-orange-500 to-amber-500",
    return: "from-indigo-500 to-purple-500",
    initial: "from-sky-500 to-blue-500",
    adjustment: "from-slate-500 to-gray-500", // Still needed for transaction list display
  };

  return (
    <div className="relative min-h-screen bg-gradient-to-br from-blue-50/80 via-white to-sky-50/60 overflow-x-hidden w-screen max-w-full">
      {/* Background decorations */}
      <div className="pointer-events-none absolute inset-0 hidden lg:block" aria-hidden>
        <div
          className="absolute inset-0"
          style={{
            background: `
              radial-gradient(60% 55% at 52% -5%, rgba(59, 130, 246, 0.16), transparent),
              radial-gradient(55% 60% at 92% 88%, rgba(56, 189, 248, 0.18), transparent),
              radial-gradient(50% 55% at -5% 38%, rgba(129, 140, 248, 0.22), transparent)
            `,
          }}
        />
      </div>

      <SiteNav />

      {/* ✅ FIX: เพิ่ม pt สำหรับ fixed header บนมือถือ */}
      <main className="relative z-10 mx-auto flex w-full max-w-full sm:max-w-[1600px] flex-col gap-6 px-4 pt-20 pb-10 sm:px-6 lg:px-8 lg:pt-[120px] overflow-x-hidden">

        {/* Header */}
        <header className="space-y-6 rounded-3xl border border-blue-100 bg-white/95 p-6 shadow-[0_20px_60px_-45px_rgba(37,99,235,0.35)] lg:backdrop-blur-sm sm:p-10 max-w-full overflow-hidden">
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-600 via-sky-500 to-indigo-500 shadow-lg">
                <Package className="h-7 w-7 text-white" />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.28em] text-blue-400">
                  Stock Management
                </p>
                <h1 className="text-3xl font-bold text-blue-900">จัดการสต็อกสินค้า</h1>
              </div>
            </div>
            <p className="text-sm text-slate-500">
              บันทึกการรับเข้า-คืนสินค้า ตั้งค่าสต็อกเริ่มต้น และปรับปรุงยอดคงเหลือ
            </p>
            <div className="flex flex-wrap gap-2">
              <span className="inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50/80 px-3.5 py-1.5 text-xs font-medium text-blue-700">
                <User className="h-3.5 w-3.5" />
                {employeeLabel}
              </span>
              <span className="inline-flex items-center gap-2 rounded-full border border-sky-200 bg-sky-50/80 px-3.5 py-1.5 text-xs font-medium text-sky-700">
                <Building2 className="h-3.5 w-3.5" />
                {storeLabel}
              </span>
            </div>
          </div>

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

          {/* Employee and Store Selection with GPS */}
          <div className="grid gap-6 md:grid-cols-2">
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm font-semibold text-blue-700" htmlFor="employee-select">
                <User className="h-4 w-4 text-blue-600" />
                พนักงาน
              </label>
              {isLoadingEmployees ? (
                <div className="form-input flex h-[52px] items-center justify-center text-xs text-slate-400">
                  <span className="inline-flex h-4 w-4 animate-spin rounded-full border-2 border-slate-400 border-b-transparent mr-2" />
                  กำลังโหลด...
                </div>
              ) : (
                <div className="space-y-2">
                  <select
                    id="employee-select"
                    value={selectedEmployeeId}
                    onChange={(e) => handleEmployeeChange(e.target.value)}
                    className="form-input"
                    required
                  >
                    <option value="">เลือกพนักงาน</option>
                    {visibleEmployees.map((emp) => {
                      const assignedStore = emp.default_store_id
                        ? stores.find((store) => store.id === emp.default_store_id)
                        : null;
                      const label = assignedStore ? `${emp.name} - ${assignedStore.name}` : emp.name;
                      const isEmployeeOutOfArea =
                        detectedStore &&
                        restrictedEmployeeIds.length > 0 &&
                        emp.default_store_id !== detectedStore.id;
                      const displayLabel = isEmployeeOutOfArea
                        ? `${label} (นอกพื้นที่ที่ตรวจจับได้)`
                        : label;
                      return (
                        <option key={emp.id} value={emp.id}>
                          {displayLabel}
                          {emp.employee_code ? ` (${emp.employee_code})` : ""}
                        </option>
                      );
                    })}
                  </select>
                  {isRestrictingEmployees && detectedStore && (
                    <p className="text-xs text-blue-600">
                      แสดงเฉพาะพนักงานของสาขา {detectedStore.name} ตามพิกัดปัจจุบัน{" "}
                      <button
                        type="button"
                        onClick={() => setAllowAllEmployees(true)}
                        className="font-semibold hover:underline"
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
                        onClick={() => setAllowAllEmployees(false)}
                        className="font-semibold text-blue-600 hover:underline"
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
              )}
            </div>

            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm font-semibold text-blue-700" htmlFor="store-select">
                <Building2 className="h-4 w-4 text-blue-600" />
                ร้านค้า / หน่วยงาน
              </label>
              {isLoadingStores ? (
                <div className="form-input flex h-[52px] items-center justify-center text-xs text-slate-400">
                  <span className="inline-flex h-4 w-4 animate-spin rounded-full border-2 border-slate-400 border-b-transparent mr-2" />
                  กำลังโหลด...
                </div>
              ) : (
                <div className="space-y-2">
                  <select
                    id="store-select"
                    value={selectedStoreId}
                    onChange={(e) => handleStoreChange(e.target.value)}
                    className="form-input disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500"
                    disabled={!!detectedStore && !allowStoreOverride}
                    required
                  >
                    <option value="">เลือกร้านค้า</option>
                    {/* Show only assigned stores if employee is selected, otherwise show all */}
                    {(selectedEmployeeId && selectedEmployeeStores.length > 0
                      ? selectedEmployeeStores
                      : stores
                    ).map((store) => (
                      <option key={store.id} value={store.id}>
                        {store.name}
                        {store.province ? ` (${store.province})` : ""}
                      </option>
                    ))}
                  </select>
                  {detectedStore && (
                    <div className="space-y-2 text-xs">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-3 py-1.5 text-xs font-medium text-emerald-700">
                          <MapPin className="h-3.5 w-3.5" />
                          ใกล้ {detectedStore.name}
                          {nearestDistanceMeters !== null && ` (${nearestDistanceMeters} ม.)`}
                        </span>
                        <div className="flex flex-wrap gap-2">
                          {!allowStoreOverride && (
                            <button
                              type="button"
                              onClick={() => setAllowStoreOverride(true)}
                              className="inline-flex items-center gap-1.5 rounded-full border border-blue-300 bg-white px-3 py-1.5 text-xs font-semibold text-blue-600 shadow-sm transition hover:border-blue-400 hover:bg-blue-50 hover:shadow active:scale-95"
                            >
                              <ChevronRight className="h-3.5 w-3.5" />
                              เลือกสาขาอื่น
                            </button>
                          )}
                          {allowStoreOverride && (
                            <button
                              type="button"
                              onClick={() => setAllowStoreOverride(false)}
                              className="inline-flex items-center gap-1.5 rounded-full border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 shadow-sm transition hover:bg-emerald-100 hover:shadow active:scale-95"
                            >
                              <MapPin className="h-3.5 w-3.5" />
                              กลับไปใช้พิกัด
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={handleRefreshLocation}
                            className="inline-flex items-center gap-1.5 rounded-full border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 shadow-sm transition hover:border-slate-400 hover:bg-slate-50 hover:shadow active:scale-95"
                          >
                            <RefreshCw className="h-3.5 w-3.5" />
                            รีเฟรช
                          </button>
                        </div>
                      </div>
                      {locationState.status === "locating" && (
                        <div className="flex items-center gap-2 rounded-xl border border-blue-200 bg-blue-50/70 px-3 py-2 text-blue-700">
                          <RefreshCw className="h-4 w-4 animate-spin" />
                          <span>กำลังตรวจจับตำแหน่ง...</span>
                        </div>
                      )}
                      {locationState.status === "resolved" && (
                        <div className="flex items-start gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-slate-600">
                          <MapPin className="mt-0.5 h-4 w-4 flex-shrink-0 text-slate-500" />
                          <span className="text-xs">{locationSummary}</span>
                        </div>
                      )}
                      {locationState.status === "error" && (
                        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-red-600">
                          <div className="flex items-start gap-2">
                            <XCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
                            <div className="flex-1">
                              <p className="text-sm font-medium">{locationState.message}</p>
                              <div className="mt-2 flex flex-wrap gap-2">
                                {permissionStatus === "prompt" && (
                                  <button
                                    type="button"
                                    onClick={() => void requestPermission()}
                                    className="rounded-lg bg-white px-3 py-1.5 text-xs font-medium text-red-600 shadow-sm transition hover:bg-red-100"
                                  >
                                    อนุญาตตำแหน่ง
                                  </button>
                                )}
                                <button
                                  type="button"
                                  onClick={handleRefreshLocation}
                                  className="inline-flex items-center gap-1 rounded-lg bg-white px-3 py-1.5 text-xs font-medium text-red-600 shadow-sm transition hover:bg-red-100"
                                >
                                  <RefreshCw className="h-3 w-3" />
                                  ลองอีกครั้ง
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Summary Cards - 2x2 Grid on Mobile */}
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <div className="group rounded-3xl border border-white/70 bg-white/95 p-4 sm:p-6 shadow-lg transition-all duration-200 hover:scale-105 hover:shadow-xl lg:backdrop-blur-sm">
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  รับเข้า
                </p>
                <div className="flex h-12 w-12 sm:h-14 sm:w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 via-sky-500 to-cyan-500 shadow-lg transition-all duration-200 group-hover:scale-110">
                  <div className="flex h-8 w-8 sm:h-10 sm:w-10 items-center justify-center rounded-xl bg-white/20 border border-white/40">
                    <PackagePlus className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
                  </div>
                </div>
              </div>
              <div className="min-w-0 w-full">
                <p className="text-xs sm:text-sm md:text-base font-bold text-blue-900 break-words leading-snug">
                  {totalInFormatted}
                </p>
              </div>
            </div>
          </div>

          <div className="group rounded-3xl border border-white/70 bg-white/95 p-4 sm:p-6 shadow-lg transition-all duration-200 hover:scale-105 hover:shadow-xl lg:backdrop-blur-sm">
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  จ่ายออก
                </p>
                <div className="flex h-12 w-12 sm:h-14 sm:w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 via-blue-500 to-purple-500 shadow-lg transition-all duration-200 group-hover:scale-110">
                  <div className="flex h-8 w-8 sm:h-10 sm:w-10 items-center justify-center rounded-xl bg-white/20 border border-white/40">
                    <PackageMinus className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
                  </div>
                </div>
              </div>
              <div className="min-w-0 w-full">
                <p className="text-xs sm:text-sm md:text-base font-bold text-blue-900 break-words leading-snug">
                  {totalOutFormatted}
                </p>
              </div>
            </div>
          </div>

          <div className="group rounded-3xl border border-white/70 bg-white/95 p-4 sm:p-6 shadow-lg transition-all duration-200 hover:scale-105 hover:shadow-xl lg:backdrop-blur-sm">
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  คงเหลือ
                </p>
                <div className="flex h-12 w-12 sm:h-14 sm:w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-sky-500 via-blue-400 to-indigo-400 shadow-lg transition-all duration-200 group-hover:scale-110">
                  <div className="flex h-8 w-8 sm:h-10 sm:w-10 items-center justify-center rounded-xl bg-white/20 border border-white/40">
                    <Package className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
                  </div>
                </div>
              </div>
              <div className="min-w-0 w-full">
                <p className="text-xs sm:text-sm md:text-base font-bold text-blue-900 break-words leading-snug">
                  {totalBalanceFormatted}
                </p>
              </div>
            </div>
          </div>

          <div className="group rounded-3xl border border-white/70 bg-white/95 p-4 sm:p-6 shadow-lg transition-all duration-200 hover:scale-105 hover:shadow-xl lg:backdrop-blur-sm">
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  สต็อกต่ำ
                </p>
                <div className="flex h-12 w-12 sm:h-14 sm:w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-500 via-orange-400 to-red-500 shadow-lg transition-all duration-200 group-hover:scale-110">
                  <div className="flex h-8 w-8 sm:h-10 sm:w-10 items-center justify-center rounded-xl bg-white/20 border border-white/40">
                    <AlertTriangle className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
                  </div>
                </div>
              </div>
              <div className="min-w-0 w-full">
                <p className="text-xs sm:text-sm md:text-base font-bold text-amber-600 break-words leading-snug">
                  {lowStockCount.toLocaleString("th-TH")} รายการ
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Tabs Section */}
        <div className="rounded-2xl sm:rounded-3xl border border-blue-100 bg-white/95 px-4 py-6 shadow-[0_20px_60px_-45px_rgba(37,99,235,0.35)] lg:backdrop-blur-sm sm:px-6 sm:py-10 w-full max-w-full">

          {/* Tab Navigation */}
          <div className="mb-8 flex flex-wrap gap-2">
            {!isReadOnly && (
              <button
                type="button"
                onClick={() => {
                  setActiveTab("receive");
                  setSubmitState({ status: "idle" });
                }}
                className={`flex items-center gap-2 rounded-2xl px-5 py-3.5 text-sm font-semibold transition-all duration-200 ${activeTab === "receive"
                  ? "bg-gradient-to-r from-blue-600 via-sky-500 to-indigo-500 text-white shadow-[0_20px_60px_-45px_rgba(37,99,235,0.9)]"
                  : "border border-blue-100 bg-white/90 text-blue-600 hover:border-blue-300 hover:bg-blue-50/50"
                  }`}
              >
                <PackagePlus className="h-5 w-5" />
                รับเข้า
              </button>
            )}
            {!isReadOnly && (
              <button
                type="button"
                onClick={() => {
                  setActiveTab("return");
                  setSubmitState({ status: "idle" });
                }}
                className={`flex items-center gap-2 rounded-2xl px-5 py-3.5 text-sm font-semibold transition-all duration-200 ${activeTab === "return"
                  ? "bg-gradient-to-r from-blue-600 via-sky-500 to-indigo-500 text-white shadow-[0_20px_60px_-45px_rgba(37,99,235,0.9)]"
                  : "border border-blue-100 bg-white/90 text-blue-600 hover:border-blue-300 hover:bg-blue-50/50"
                  }`}
              >
                <PackageMinus className="h-5 w-5" />
                คืนสินค้า
              </button>
            )}
            {!isReadOnly && (
              <button
                type="button"
                onClick={() => {
                  setActiveTab("initial");
                  setSubmitState({ status: "idle" });
                }}
                className={`flex items-center gap-2 rounded-2xl px-5 py-3.5 text-sm font-semibold transition-all duration-200 ${activeTab === "initial"
                  ? "bg-gradient-to-r from-blue-600 via-sky-500 to-indigo-500 text-white shadow-[0_20px_60px_-45px_rgba(37,99,235,0.9)]"
                  : "border border-blue-100 bg-white/90 text-blue-600 hover:border-blue-300 hover:bg-blue-50/50"
                  }`}
              >
                <PackageCheck className="h-5 w-5" />
                ตั้งค่าสต็อกเริ่มต้น
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                setActiveTab("balance");
                setSubmitState({ status: "idle" });
              }}
              className={`flex items-center gap-2 rounded-2xl px-5 py-3.5 text-sm font-semibold transition-all duration-200 ${activeTab === "balance"
                ? "bg-gradient-to-r from-blue-600 via-sky-500 to-indigo-500 text-white shadow-[0_20px_60px_-45px_rgba(37,99,235,0.9)]"
                : "border border-blue-100 bg-white/90 text-blue-600 hover:border-blue-300 hover:bg-blue-50/50"
                }`}
            >
              <Package className="h-5 w-5" />
              สต็อกคงเหลือ
            </button>
          </div>


          {/* Tab Content Container */}
          <div className="grid gap-6 lg:grid-cols-[2fr_1fr] w-full max-w-full">
            {/* Main Form Section */}
            <div>
              {/* Tab: Receive */}
              {activeTab === "receive" && (
                <div className="space-y-6">
                  {/* Add to Cart Button */}
                  <button
                    type="button"
                    onClick={() => setIsReceiveModalOpen(true)}
                    disabled={!selectedEmployeeId || !selectedStoreId || isReadOnly}
                    className={`inline-flex w-full items-center justify-center gap-2 rounded-[26px] border-2 border-dashed border-blue-400 bg-blue-50/50 px-6 py-4 text-base font-semibold text-blue-700 transition-all duration-200 hover:border-blue-500 hover:bg-blue-100/50 focus:outline-none focus:ring-2 focus:ring-blue-200 focus:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-50 ${isReadOnly ? 'opacity-50' : ''}`}
                  >
                    <PackagePlus className="h-5 w-5" />
                    เพิ่มรายการรับเข้า
                  </button>

                  {/* Cart Items Display */}
                  {receiveCart.length > 0 && (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <h3 className="flex items-center gap-2 text-sm font-semibold text-blue-700">
                          <ShoppingCart className="h-4 w-4" />
                          รายการในตะกร้า ({receiveCart.length})
                        </h3>
                        <button
                          type="button"
                          onClick={clearCart}
                          className="text-xs font-medium text-red-600 transition hover:text-red-700"
                        >
                          ล้างทั้งหมด
                        </button>
                      </div>

                      <div className="space-y-4 w-full">
                        {/* ✅ Group by Product (FDA/GMP Compliant) */}
                        {groupedReceiveCart.map((group) => {
                          const batch = productBatches[group.productId];

                          return (
                            <div
                              key={group.productId}
                              className="relative overflow-hidden rounded-2xl border-2 border-blue-200 bg-white shadow-md"
                            >
                              {/* Product Header */}
                              <div className="bg-gradient-to-r from-blue-50 to-sky-50 p-4 border-b-2 border-blue-100">
                                <div className="flex flex-col md:flex-row items-start gap-3">
                                  {/* Left Section: Logo + Product Info */}
                                  <div className="flex items-start gap-3 flex-1 min-w-0">
                                    {/* Company Logo */}
                                    {group.companyLogoUrl ? (
                                      <div className="relative h-12 w-12 overflow-hidden bg-transparent flex-shrink-0">
                                        <Image
                                          src={group.companyLogoUrl}
                                          alt={group.companyName || 'Company'}
                                          fill
                                          className="object-contain mix-blend-multiply"
                                          sizes="48px"
                                          loading="lazy"
                                          placeholder="empty"
                                        />
                                      </div>
                                    ) : (
                                      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-sky-400 shadow-md flex-shrink-0">
                                        <Package className="h-6 w-6 text-white" />
                                      </div>
                                    )}

                                    {/* Product Info */}
                                    <div className="flex-1 min-w-0">
                                      <h4 className="font-bold text-blue-900 break-words leading-tight">
                                        {group.productCode} - {group.productName}
                                      </h4>
                                      <p className="text-xs text-slate-600 mt-0.5">
                                        {group.items.length} หน่วยในสินค้านี้
                                      </p>

                                      {/* Batch Button/Badge */}
                                      <div className="mt-2">
                                        {batch ? (
                                          <button
                                            type="button"
                                            onClick={() => setEditingBatchProductId(group.productId)}
                                            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-gradient-to-r from-emerald-50 to-green-50 border-2 border-emerald-200 hover:from-emerald-100 hover:to-green-100 transition"
                                          >
                                            <CheckCircle className="h-4 w-4 text-emerald-600" />
                                            <div className="text-left">
                                              <p className="text-xs font-semibold text-emerald-900">
                                                Lot: <span className="font-mono">{batch.lotNumber}</span>
                                              </p>
                                              {batch.expDate && (
                                                <p className="text-xs text-emerald-700">
                                                  EXP: {dayjs(batch.expDate).locale('th').format('D MMM')} {dayjs(batch.expDate).year() + 543}
                                                </p>
                                              )}
                                            </div>
                                            <ChevronRight className="h-3 w-3 text-emerald-600" />
                                          </button>
                                        ) : (
                                          <button
                                            type="button"
                                            onClick={() => setEditingBatchProductId(group.productId)}
                                            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border-2 border-dashed border-orange-300 bg-orange-50/50 hover:bg-orange-100/50 text-orange-700 font-medium text-sm transition"
                                          >
                                            <Edit3 className="h-4 w-4" />
                                            กรอกวันที่ผลิต-หมดอายุ
                                          </button>
                                        )}
                                      </div>
                                    </div>
                                  </div>

                                  {/* Right Section (Desktop) / Below Logo (Mobile): Action Buttons */}
                                  <div className="flex gap-2 md:flex-shrink-0">
                                    {/* Edit Button */}
                                    <button
                                      type="button"
                                      onClick={() => {
                                        const firstItemIndex = receiveCart.indexOf(group.items[0]);
                                        editCartItem(firstItemIndex);
                                      }}
                                      className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-100 text-amber-600 transition hover:bg-amber-200 hover:scale-110 active:scale-95"
                                      title="แก้ไขสินค้า"
                                    >
                                      <Edit3 className="h-4 w-4" />
                                    </button>

                                    {/* Delete Button */}
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setDeleteConfirmation({
                                          productCode: group.productCode,
                                          productName: group.productName,
                                          items: group.items,
                                        });
                                      }}
                                      className="flex h-8 w-8 items-center justify-center rounded-lg bg-red-100 text-red-600 transition hover:bg-red-200 hover:scale-110 active:scale-95"
                                      title="ลบสินค้า"
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </button>
                                  </div>
                                </div>
                              </div>

                              {/* Items List (All units of this product) - Horizontal Layout */}
                              <div className="p-3">
                                <div className="flex flex-wrap gap-2">
                                  {group.items.map((item, itemIndex) => (
                                    <div
                                      key={itemIndex}
                                      className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-50 border border-slate-200"
                                    >
                                      <span className="text-sm font-semibold text-slate-900">
                                        {item.unitName}
                                      </span>
                                      <span className="text-xs text-slate-400">•</span>
                                      <span className="text-sm font-bold text-blue-600">
                                        {item.quantity.toLocaleString("th-TH")}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {/* ProductBatchModal - Shared between Receive and Initial */}
                      {editingBatchProductId && (() => {
                        const product = groupedReceiveCart.find(g => g.productId === editingBatchProductId) ||
                                       groupedAdjustmentCart.find(g => g.productId === editingBatchProductId);
                        if (!product) return null;

                        return (
                          <Suspense fallback={null}>
                            <ProductBatchModal
                              isOpen={true}
                              onClose={() => setEditingBatchProductId(null)}
                              onSave={(data) => updateProductBatch(editingBatchProductId, data)}
                              productCode={product.productCode}
                              productName={product.productName}
                              initialData={productBatches[editingBatchProductId] || null}
                            />
                          </Suspense>
                        );
                      })()}

                      {/* Global Note for All Items */}
                      <div className="space-y-2">
                        <label className="flex items-center gap-2 text-sm font-semibold text-blue-700" htmlFor="global-note">
                          <Info className="h-4 w-4 text-blue-600" />
                          หมายเหตุสำหรับทั้งหมด (ไม่บังคับ)
                        </label>
                        <textarea
                          id="global-note"
                          value={receiveGlobalNote}
                          onChange={(e) => setReceiveGlobalNote(e.target.value)}
                          className="form-input min-h-[80px] resize-y"
                          placeholder="ระบุหมายเหตุที่ใช้ร่วมกันสำหรับทุกรายการ..."
                        />
                      </div>

                      {/* Submit All Button */}
                      <form onSubmit={handleReceiveSubmit}>
                        <button
                          type="submit"
                          disabled={submitState.status === "submitting" || isReadOnly}
                          className={`inline-flex w-full items-center justify-center gap-2 rounded-[26px] bg-gradient-to-r from-blue-600 via-sky-500 to-indigo-500 px-6 py-4 text-base font-semibold text-white shadow-[0_25px_80px_-50px_rgba(37,99,235,0.75)] transition-all duration-200 hover:shadow-[0_30px_90px_-55px_rgba(37,99,235,0.85)] focus:outline-none focus:ring-2 focus:ring-blue-200 focus:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-60 ${isReadOnly ? 'opacity-50' : ''}`}
                        >
                          {submitState.status === "submitting" ? (
                            <>
                              <RefreshCw className="h-5 w-5 animate-spin" />
                              กำลังบันทึก...
                            </>
                          ) : (
                            <>
                              <Save className="h-5 w-5" />
                              บันทึกทั้งหมด ({receiveCart.length} รายการ)
                            </>
                          )}
                        </button>
                      </form>
                    </div>
                  )}

                  {/* Empty State */}
                  {receiveCart.length === 0 && (
                    <div className="flex flex-col items-center justify-center rounded-2xl border border-blue-200 bg-blue-50/30 px-6 py-12 text-center">
                      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 to-sky-400 shadow-lg">
                        <ShoppingCart className="h-8 w-8 text-white" />
                      </div>
                      <p className="text-sm font-medium text-blue-700">
                        ยังไม่มีรายการในตะกร้า
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        กดปุ่ม &quot;เพิ่มรายการรับเข้า&quot; เพื่อเริ่มเพิ่มสินค้า
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Tab: Return */}
              {activeTab === "return" && (
                <div className="space-y-6">
                  {/* Add to Cart Button */}
                  <button
                    type="button"
                    onClick={() => setIsReturnModalOpen(true)}
                    disabled={!selectedEmployeeId || !selectedStoreId || isReadOnly}
                    className={`inline-flex w-full items-center justify-center gap-2 rounded-[26px] border-2 border-dashed border-indigo-400 bg-indigo-50/50 px-6 py-4 text-base font-semibold text-indigo-700 transition-all duration-200 hover:border-indigo-500 hover:bg-indigo-100/50 focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-50 ${isReadOnly ? 'opacity-50' : ''}`}
                  >
                    <PackageMinus className="h-5 w-5" />
                    เพิ่มรายการคืนสินค้า
                  </button>

                  {/* Cart Items Display */}
                  {returnCart.length > 0 && (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <h3 className="flex items-center gap-2 text-sm font-semibold text-blue-700">
                          <ShoppingCart className="h-4 w-4" />
                          รายการในตะกร้า ({returnCart.length})
                        </h3>
                        <button
                          type="button"
                          onClick={clearReturnCart}
                          className="text-xs font-medium text-red-600 transition hover:text-red-700"
                        >
                          ล้างทั้งหมด
                        </button>
                      </div>

                      <div className="space-y-4 w-full">
                        {/* ✅ Group by Product (same as receive) */}
                        {groupedReturnCart.map((group) => {
                          // Find if any item in this group has a selected batch
                          const itemWithBatch = group.items.find(item => item.selectedBatch);
                          const selectedBatch = itemWithBatch?.selectedBatch;

                          return (
                            <div
                              key={group.productId}
                              className="relative overflow-hidden rounded-2xl border-2 border-indigo-200 bg-white shadow-md"
                            >
                              {/* Product Header */}
                              <div className="bg-gradient-to-r from-indigo-50 to-purple-50 p-4 border-b-2 border-indigo-100">
                                <div className="flex flex-col md:flex-row items-start gap-3">
                                  {/* Left Section: Logo + Product Info */}
                                  <div className="flex items-start gap-3 flex-1 min-w-0">
                                    {/* Company Logo */}
                                    {group.companyLogoUrl ? (
                                      <div className="relative h-12 w-12 overflow-hidden bg-transparent flex-shrink-0">
                                        <Image
                                          src={group.companyLogoUrl}
                                          alt={group.companyName || 'Company'}
                                          fill
                                          className="object-contain mix-blend-multiply"
                                          sizes="48px"
                                          loading="lazy"
                                          placeholder="empty"
                                        />
                                      </div>
                                    ) : (
                                      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-purple-400 shadow-md flex-shrink-0">
                                        <Package className="h-6 w-6 text-white" />
                                      </div>
                                    )}

                                    {/* Product Info */}
                                    <div className="flex-1 min-w-0">
                                      <h4 className="font-bold text-blue-900 break-words leading-tight">
                                        {group.productCode} - {group.productName}
                                      </h4>
                                      <p className="text-xs text-slate-600 mt-0.5">
                                        {group.items.length} หน่วยในสินค้านี้
                                      </p>

                                      {/* ✅ Batch Selection Button (ฟีเจอร์พิเศษของ Return) */}
                                      <div className="mt-2">
                                        {selectedBatch ? (
                                          <button
                                            type="button"
                                            onClick={() => {
                                              const productInventory = inventory.find(inv => inv.productId === group.productId);
                                              setBatchSelectionProduct({
                                                productId: group.productId,
                                                productName: group.productName,
                                                productCode: group.productCode,
                                                displayUnits: productInventory?.displayUnits || [],
                                              });
                                              const firstItemIndex = returnCart.indexOf(group.items[0]);
                                              setEditingReturnBatchIndex(firstItemIndex);
                                              void fetchReturnBatches(group.productId).then(() => {
                                                setIsBatchSelectionModalOpen(true);
                                              });
                                            }}
                                            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-gradient-to-r from-indigo-100 to-purple-100 hover:from-indigo-200 hover:to-purple-200 border-2 border-indigo-200 text-indigo-700 text-sm font-medium transition"
                                          >
                                            <Package className="h-4 w-4" />
                                            <div className="text-left">
                                              <p className="text-xs font-semibold">
                                                Lot: <span className="font-mono">{selectedBatch.lotNumber}</span>
                                              </p>
                                              {selectedBatch.expiryDate && (
                                                <p className="text-xs">
                                                  EXP: {dayjs(selectedBatch.expiryDate).locale('th').format('D MMM')} {dayjs(selectedBatch.expiryDate).year() + 543}
                                                </p>
                                              )}
                                            </div>
                                            <ChevronRight className="h-3 w-3" />
                                          </button>
                                        ) : (
                                          <button
                                            type="button"
                                            onClick={() => {
                                              const productInventory = inventory.find(inv => inv.productId === group.productId);
                                              setBatchSelectionProduct({
                                                productId: group.productId,
                                                productName: group.productName,
                                                productCode: group.productCode,
                                                displayUnits: productInventory?.displayUnits || [],
                                              });
                                              const firstItemIndex = returnCart.indexOf(group.items[0]);
                                              setEditingReturnBatchIndex(firstItemIndex);
                                              void fetchReturnBatches(group.productId).then(() => {
                                                setIsBatchSelectionModalOpen(true);
                                              });
                                            }}
                                            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border-2 border-dashed border-indigo-300 bg-indigo-50/50 hover:bg-indigo-100/50 text-indigo-700 font-medium text-sm transition"
                                          >
                                            <Package className="h-4 w-4" />
                                            + เลือก Lot คืนคลัง (ไม่บังคับ)
                                          </button>
                                        )}
                                      </div>
                                    </div>
                                  </div>

                                  {/* Right Section (Desktop) / Below Logo (Mobile): Action Buttons */}
                                  <div className="flex gap-2 md:flex-shrink-0">
                                    {/* Edit Button */}
                                    <button
                                      type="button"
                                      onClick={() => {
                                        const firstItemIndex = returnCart.indexOf(group.items[0]);
                                        editCartItem(firstItemIndex, 'return');
                                      }}
                                      className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-100 text-amber-600 transition hover:bg-amber-200 hover:scale-110 active:scale-95"
                                      title="แก้ไขสินค้า"
                                    >
                                      <Edit3 className="h-4 w-4" />
                                    </button>

                                    {/* Delete Button */}
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setDeleteConfirmation({
                                          productCode: group.productCode,
                                          productName: group.productName,
                                          items: group.items,
                                        });
                                      }}
                                      className="flex h-8 w-8 items-center justify-center rounded-lg bg-red-100 text-red-600 transition hover:bg-red-200 hover:scale-110 active:scale-95"
                                      title="ลบสินค้า"
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </button>
                                  </div>
                                </div>
                              </div>

                              {/* Items List (All units of this product) - Horizontal Layout */}
                              <div className="p-3">
                                <div className="flex flex-wrap gap-2">
                                  {group.items.map((item, itemIndex) => (
                                    <div
                                      key={itemIndex}
                                      className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-50 border border-slate-200"
                                    >
                                      <span className="text-sm font-semibold text-slate-900">
                                        {item.unitName}
                                      </span>
                                      <span className="text-xs text-slate-400">•</span>
                                      <span className="text-sm font-bold text-indigo-600">
                                        {item.quantity.toLocaleString("th-TH")}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {/* Global Note for All Items */}
                      <div className="space-y-2">
                        <label className="flex items-center gap-2 text-sm font-semibold text-blue-700" htmlFor="return-global-note">
                          <Info className="h-4 w-4 text-blue-600" />
                          หมายเหตุสำหรับทั้งหมด (ไม่บังคับ)
                        </label>
                        <textarea
                          id="return-global-note"
                          value={returnGlobalNote}
                          onChange={(e) => setReturnGlobalNote(e.target.value)}
                          className="form-input min-h-[80px] resize-y"
                          placeholder="ระบุหมายเหตุที่ใช้ร่วมกันสำหรับทุกรายการ..."
                        />
                      </div>

                      {/* Submit All Button */}
                      <form onSubmit={handleReturnSubmit}>
                        <button
                          type="submit"
                          disabled={submitState.status === "submitting" || isReadOnly}
                          className={`inline-flex w-full items-center justify-center gap-2 rounded-[26px] bg-gradient-to-r from-indigo-600 via-purple-500 to-blue-500 px-6 py-4 text-base font-semibold text-white shadow-[0_25px_80px_-50px_rgba(99,102,241,0.75)] transition-all duration-200 hover:shadow-[0_30px_90px_-55px_rgba(99,102,241,0.85)] focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-60 ${isReadOnly ? 'opacity-50' : ''}`}
                        >
                          {submitState.status === "submitting" ? (
                            <>
                              <RefreshCw className="h-5 w-5 animate-spin" />
                              กำลังบันทึก...
                            </>
                          ) : (
                            <>
                              <Save className="h-5 w-5" />
                              บันทึกทั้งหมด ({returnCart.length} รายการ)
                            </>
                          )}
                        </button>
                      </form>
                    </div>
                  )}

                  {/* Empty State */}
                  {returnCart.length === 0 && (
                    <div className="flex flex-col items-center justify-center rounded-2xl border border-indigo-200 bg-indigo-50/30 px-6 py-12 text-center">
                      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-400 shadow-lg">
                        <ShoppingCart className="h-8 w-8 text-white" />
                      </div>
                      <p className="text-sm font-medium text-indigo-700">
                        ยังไม่มีรายการในตะกร้า
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        กดปุ่ม &quot;เพิ่มรายการคืนสินค้า&quot; เพื่อเริ่มเพิ่มสินค้า
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Tab: Initial Stock */}
              {activeTab === "initial" && (
                <div className="space-y-6">
                  {/* Initial Stock History Section */}
                  {initialStockHistory.length > 0 && (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <h3 className="flex items-center gap-2 text-base font-bold text-blue-900">
                          <PackageCheck className="h-5 w-5 text-blue-600" />
                          รายการที่ตั้งค่าแล้ว
                          <span className="rounded-full bg-blue-100 px-2.5 py-0.5 text-sm font-semibold text-blue-700">
                            {initialStockHistory.length}
                          </span>
                        </h3>
                      </div>

                      {/* History Cards - Responsive Grid */}
                      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
                        {(showAllInitialHistory ? initialStockHistory : initialStockHistory.slice(0, 5)).map((item) => {
                          const product = products.find((p) => p.productId === item.productId);
                          const employee = employees.find((e) => e.id === selectedEmployeeId);
                          const store = stores.find((s) => s.id === selectedStoreId);

                          return (
                            <div
                              key={item.id}
                              className="group relative overflow-hidden rounded-2xl border-2 border-sky-100 bg-gradient-to-br from-white to-sky-50/30 p-4 shadow-sm transition-all duration-200 hover:border-sky-300 hover:shadow-md"
                            >
                              {/* Product Header */}
                              <div className="mb-3 flex items-start gap-3">
                                {/* Company Logo */}
                                <div className="flex-shrink-0">
                                  {product?.companyLogoUrl ? (
                                    <div className="relative h-14 w-14 overflow-hidden bg-transparent">
                                      <Image
                                        src={product.companyLogoUrl}
                                        alt={product.companyName || 'Company'}
                                        fill
                                        className="object-contain mix-blend-multiply"
                                        sizes="56px"
                                        loading="lazy"
                                        placeholder="empty"
                                      />
                                    </div>
                                  ) : (
                                    <div className="flex h-14 w-14 items-center justify-center rounded-xl border-2 border-sky-200 bg-sky-100">
                                      <Package className="h-7 w-7 text-sky-600" />
                                    </div>
                                  )}
                                </div>

                                {/* Product Info */}
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-bold text-blue-900 leading-tight">
                                    {item.productName}
                                  </p>
                                  {product?.companyName && (
                                    <p className="mt-0.5 text-xs font-medium text-sky-600">
                                      {product.companyName}
                                    </p>
                                  )}
                                  {/* Quantity Badge */}
                                  <div className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-sky-500 to-blue-500 px-3 py-1 text-white shadow-md">
                                    <Layers className="h-3.5 w-3.5" />
                                    <span className="text-sm font-bold">
                                      {item.quantity.toLocaleString('th-TH')} {item.unitName}
                                    </span>
                                  </div>
                                </div>
                              </div>

                              {/* Details Grid */}
                              <div className="space-y-2 rounded-xl bg-white/60 p-3 text-xs">
                                {/* Employee & Store */}
                                <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                                  <div className="flex items-center gap-1.5 text-slate-700">
                                    <User className="h-3.5 w-3.5 text-blue-600" />
                                    <span className="font-medium">{employee?.name || 'N/A'}</span>
                                  </div>
                                  <div className="flex items-center gap-1.5 text-slate-700">
                                    <Building2 className="h-3.5 w-3.5 text-sky-600" />
                                    <span className="font-medium">{store?.name || 'N/A'}</span>
                                  </div>
                                </div>

                                {/* Timestamp */}
                                <div className="flex items-center gap-1.5 text-slate-600">
                                  <Calendar className="h-3.5 w-3.5 text-slate-400" />
                                  <time>
                                    {new Date(item.createdAt).toLocaleDateString('th-TH', {
                                      year: '2-digit',
                                      month: 'short',
                                      day: 'numeric',
                                      hour: '2-digit',
                                      minute: '2-digit',
                                    })}
                                  </time>
                                </div>

                                {/* Note */}
                                {item.note && (
                                  <div className="flex items-start gap-1.5 text-slate-600">
                                    <Info className="h-3.5 w-3.5 flex-shrink-0 text-slate-400 mt-0.5" />
                                    <p className="flex-1 line-clamp-2">{item.note}</p>
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {/* Show More/Less Button */}
                      {initialStockHistory.length > 5 && (
                        <button
                          type="button"
                          onClick={() => setShowAllInitialHistory(!showAllInitialHistory)}
                          className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-sky-200 bg-white px-4 py-2.5 text-sm font-semibold text-sky-700 transition hover:border-sky-300 hover:bg-sky-50"
                        >
                          <ChevronRight className={`h-4 w-4 transition-transform ${showAllInitialHistory ? 'rotate-90' : ''}`} />
                          {showAllInitialHistory
                            ? 'ซ่อนรายการ'
                            : `ดูเพิ่มเติม (${initialStockHistory.length - 5} รายการ)`}
                        </button>
                      )}
                    </div>
                  )}

                  {/* Info Banner */}
                  <div className="rounded-xl border border-blue-100 bg-blue-50/50 p-4">
                    <div className="flex items-start gap-2">
                      <Info className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
                      <p className="text-sm text-blue-700">
                        ใช้สำหรับกรอกจำนวนสินค้าที่มีอยู่เดิม เมื่อเริ่มใช้ระบบครั้งแรก
                      </p>
                    </div>
                  </div>

                  {/* Add to Cart Button */}
                  <button
                    type="button"
                    onClick={() => setIsInitialModalOpen(true)}
                    disabled={!selectedEmployeeId || !selectedStoreId || isReadOnly}
                    className={`inline-flex w-full items-center justify-center gap-2 rounded-[26px] border-2 border-dashed border-sky-400 bg-sky-50/50 px-6 py-4 text-base font-semibold text-sky-700 transition-all duration-200 hover:border-sky-500 hover:bg-sky-100/50 focus:outline-none focus:ring-2 focus:ring-sky-200 focus:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-50 ${isReadOnly ? 'opacity-50' : ''}`}
                  >
                    <PackageCheck className="h-5 w-5" />
                    เพิ่มรายการตั้งค่าสต็อก
                  </button>

                  {/* Cart Items Display */}
                  {adjustmentCart.length > 0 && (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <h3 className="flex items-center gap-2 text-sm font-semibold text-blue-700">
                          <ShoppingCart className="h-4 w-4" />
                          รายการในตะกร้า ({adjustmentCart.length})
                        </h3>
                        <button
                          type="button"
                          onClick={clearAdjustmentCart}
                          className="text-xs font-medium text-red-600 transition hover:text-red-700"
                        >
                          ล้างทั้งหมด
                        </button>
                      </div>

                      <div className="space-y-4 w-full">
                        {/* ✅ Group by Product (FDA/GMP Compliant) - Same as Receive */}
                        {groupedAdjustmentCart.map((group) => {
                          const batch = productBatches[group.productId];

                          return (
                            <div
                              key={group.productId}
                              className="relative overflow-hidden rounded-2xl border-2 border-blue-200 bg-white shadow-md"
                            >
                              {/* Product Header */}
                              <div className="bg-gradient-to-r from-blue-50 to-sky-50 p-4 border-b-2 border-blue-100">
                                <div className="flex flex-col md:flex-row items-start gap-3">
                                  {/* Left Section: Logo + Product Info */}
                                  <div className="flex items-start gap-3 flex-1 min-w-0">
                                    {/* Company Logo */}
                                    {group.companyLogoUrl ? (
                                      <div className="relative h-12 w-12 overflow-hidden bg-transparent flex-shrink-0">
                                        <Image
                                          src={group.companyLogoUrl}
                                          alt={group.companyName || 'Company'}
                                          fill
                                          className="object-contain mix-blend-multiply"
                                          sizes="48px"
                                          loading="lazy"
                                          placeholder="empty"
                                        />
                                      </div>
                                    ) : (
                                      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-sky-500 to-blue-400 shadow-md flex-shrink-0">
                                        <Package className="h-6 w-6 text-white" />
                                      </div>
                                    )}

                                    {/* Product Info */}
                                    <div className="flex-1 min-w-0">
                                      <h4 className="font-bold text-blue-900 break-words leading-tight">
                                        {group.productCode} - {group.productName}
                                      </h4>
                                      <p className="text-xs text-slate-600 mt-0.5">
                                        {group.items.length} หน่วยในสินค้านี้
                                      </p>

                                      {/* Batch Button/Badge */}
                                      <div className="mt-2">
                                        {batch ? (
                                          <button
                                            type="button"
                                            onClick={() => setEditingBatchProductId(group.productId)}
                                            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-gradient-to-r from-emerald-50 to-green-50 border-2 border-emerald-200 hover:from-emerald-100 hover:to-green-100 transition"
                                          >
                                            <CheckCircle className="h-4 w-4 text-emerald-600" />
                                            <div className="text-left">
                                              <p className="text-xs font-semibold text-emerald-900">
                                                Lot: <span className="font-mono">{batch.lotNumber}</span>
                                              </p>
                                              {batch.expDate && (
                                                <p className="text-xs text-emerald-700">
                                                  EXP: {dayjs(batch.expDate).locale('th').format('D MMM')} {dayjs(batch.expDate).year() + 543}
                                                </p>
                                              )}
                                            </div>
                                            <ChevronRight className="h-3 w-3 text-emerald-600" />
                                          </button>
                                        ) : (
                                          <button
                                            type="button"
                                            onClick={() => setEditingBatchProductId(group.productId)}
                                            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border-2 border-dashed border-orange-300 bg-orange-50/50 hover:bg-orange-100/50 text-orange-700 font-medium text-sm transition"
                                          >
                                            <Edit3 className="h-4 w-4" />
                                            กรอกวันที่ผลิต-หมดอายุ
                                          </button>
                                        )}
                                      </div>
                                    </div>
                                  </div>

                                  {/* Right Section (Desktop) / Below Logo (Mobile): Action Buttons */}
                                  <div className="flex gap-2 md:flex-shrink-0">
                                    {/* Edit Button */}
                                    <button
                                      type="button"
                                      onClick={() => {
                                        const firstItemIndex = adjustmentCart.indexOf(group.items[0]);
                                        editAdjustmentCartItem(firstItemIndex);
                                      }}
                                      className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-100 text-amber-600 transition hover:bg-amber-200 hover:scale-110 active:scale-95"
                                      title="แก้ไขสินค้า"
                                    >
                                      <Edit3 className="h-4 w-4" />
                                    </button>

                                    {/* Delete Button */}
                                    <button
                                      type="button"
                                      onClick={() => {
                                        // Remove all items of this product
                                        group.items.forEach(() => {
                                          const index = adjustmentCart.indexOf(group.items[0]);
                                          if (index !== -1) {
                                            removeFromAdjustmentCart(index);
                                          }
                                        });
                                      }}
                                      className="flex h-8 w-8 items-center justify-center rounded-lg bg-red-100 text-red-600 transition hover:bg-red-200 hover:scale-110 active:scale-95"
                                      title="ลบสินค้า"
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </button>
                                  </div>
                                </div>
                              </div>

                              {/* Items List (All units of this product) - Horizontal Layout */}
                              <div className="p-3">
                                <div className="flex flex-wrap gap-2">
                                  {group.items.map((item, itemIndex) => (
                                    <div
                                      key={itemIndex}
                                      className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-50 border border-slate-200"
                                    >
                                      <span className="text-sm font-semibold text-slate-900">
                                        {item.unitName}
                                      </span>
                                      <span className="text-xs text-slate-400">•</span>
                                      <span className="text-sm font-bold text-blue-600">
                                        {item.quantity.toLocaleString("th-TH")}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {/* ProductBatchModal - For Initial Stock */}
                      {editingBatchProductId && (() => {
                        const product = groupedAdjustmentCart.find(g => g.productId === editingBatchProductId);
                        if (!product) return null;

                        return (
                          <Suspense fallback={null}>
                            <ProductBatchModal
                              isOpen={true}
                              onClose={() => setEditingBatchProductId(null)}
                              onSave={(data) => updateProductBatch(editingBatchProductId, data)}
                              productCode={product.productCode}
                              productName={product.productName}
                              initialData={productBatches[editingBatchProductId] || null}
                            />
                          </Suspense>
                        );
                      })()}

                      {/* Global Note for All Items */}
                      <div className="space-y-2">
                        <label className="flex items-center gap-2 text-sm font-semibold text-blue-700" htmlFor="adjustment-global-note">
                          <Info className="h-4 w-4 text-blue-600" />
                          หมายเหตุสำหรับทั้งหมด (ไม่บังคับ)
                        </label>
                        <textarea
                          id="adjustment-global-note"
                          value={adjustmentGlobalNote}
                          onChange={(e) => setAdjustmentGlobalNote(e.target.value)}
                          className="form-input min-h-[80px] resize-y"
                          placeholder="ระบุหมายเหตุที่ใช้ร่วมกันสำหรับทุกรายการ..."
                        />
                      </div>

                      {/* Submit All Button */}
                      <form onSubmit={handleInitialSubmit}>
                        <button
                          type="submit"
                          disabled={submitState.status === "submitting" || isReadOnly}
                          className={`inline-flex w-full items-center justify-center gap-2 rounded-[26px] bg-gradient-to-r from-sky-600 via-blue-500 to-indigo-500 px-6 py-4 text-base font-semibold text-white shadow-[0_25px_80px_-50px_rgba(14,165,233,0.75)] transition-all duration-200 hover:shadow-[0_30px_90px_-55px_rgba(14,165,233,0.85)] focus:outline-none focus:ring-2 focus:ring-sky-200 focus:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-60 ${isReadOnly ? 'opacity-50' : ''}`}
                        >
                          {submitState.status === "submitting" ? (
                            <>
                              <RefreshCw className="h-5 w-5 animate-spin" />
                              กำลังบันทึก...
                            </>
                          ) : (
                            <>
                              <Save className="h-5 w-5" />
                              บันทึกทั้งหมด ({adjustmentCart.length} รายการ)
                            </>
                          )}
                        </button>
                      </form>
                    </div>
                  )}

                  {/* Empty State */}
                  {adjustmentCart.length === 0 && (
                    <div className="flex flex-col items-center justify-center rounded-2xl border border-sky-200 bg-sky-50/30 px-6 py-12 text-center">
                      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-sky-500 to-blue-400 shadow-lg">
                        <ShoppingCart className="h-8 w-8 text-white" />
                      </div>
                      <p className="text-sm font-medium text-sky-700">
                        ยังไม่มีรายการในตะกร้า
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        กดปุ่ม &quot;เพิ่มรายการตั้งค่าสต็อก&quot; เพื่อเริ่มเพิ่มสินค้า
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Tab: Adjust Stock */}
              {/* Tab: Balance */}
              {activeTab === "balance" && (
                <div className="space-y-4 w-full max-w-full overflow-hidden">
                  {/* Filters: Company + Search + Refresh */}
                  <div className="flex flex-col gap-3 sm:flex-row w-full max-w-full">
                    {/* Company Filter */}
                    {availableCompanies.length > 0 && (
                      <div className="relative sm:w-64">
                        <select
                          value={selectedCompanyFilter}
                          onChange={(e) => {
                            setSelectedCompanyFilter(e.target.value);
                            setBalanceCurrentPage(1);
                          }}
                          className="w-full appearance-none rounded-2xl border-2 border-blue-200 bg-white/80 py-3 pl-4 pr-10 text-sm transition-all focus:border-blue-500 focus:outline-none focus:ring-4 focus:ring-blue-500/20"
                        >
                          <option value="">ทุกบริษัท</option>
                          {availableCompanies.map((company) => (
                            <option key={company.id} value={company.id}>
                              {company.name}
                            </option>
                          ))}
                        </select>
                        <Building2 className="pointer-events-none absolute right-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
                      </div>
                    )}

                    {/* Search Input */}
                    <div className="relative flex-1 max-w-full">
                      <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
                      <input
                        type="text"
                        value={balanceSearchInput}
                        onChange={(e) => setBalanceSearchInput(e.target.value)}
                        placeholder="ค้นหาสินค้า รหัส หรือหน่วย..."
                        className="w-full max-w-full rounded-2xl border-2 border-blue-200 bg-white/80 py-3 pl-12 pr-4 text-sm transition-all focus:border-blue-500 focus:outline-none focus:ring-4 focus:ring-blue-500/20"
                      />
                      {balanceSearchInput && (
                        <button
                          type="button"
                          onClick={() => setBalanceSearchInput("")}
                          className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                        >
                          <X className="h-5 w-5" />
                        </button>
                      )}
                    </div>

                    {/* Refresh Button */}
                    <button
                      type="button"
                      onClick={() => refetchInventory()}
                      disabled={isLoadingInventory || !selectedEmployeeId || !selectedStoreId}
                      className={clsx(
                        "inline-flex items-center justify-center gap-2 rounded-2xl border-2 px-4 py-3 text-sm font-semibold transition-all sm:w-auto",
                        isLoadingInventory || !selectedEmployeeId || !selectedStoreId
                          ? "cursor-not-allowed border-slate-200 bg-slate-50 text-slate-400"
                          : "border-blue-200 bg-gradient-to-r from-blue-500 to-sky-500 text-white hover:from-blue-600 hover:to-sky-600 active:scale-95 shadow-md hover:shadow-lg"
                      )}
                    >
                      <RefreshCw className={clsx("h-4 w-4", isLoadingInventory && "animate-spin")} />
                      <span className="hidden sm:inline">รีเฟรช</span>
                    </button>
                  </div>

                  {/* Active Filters Display */}
                  {(selectedCompanyFilter || balanceSearchInput) && (
                    <div className="flex flex-wrap items-center gap-2 max-w-full">
                      <span className="text-xs font-medium text-slate-500">กรองโดย:</span>
                      {selectedCompanyFilter && (
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedCompanyFilter("");
                            setBalanceCurrentPage(1);
                          }}
                          className="inline-flex items-center gap-1.5 rounded-full border-2 border-blue-200 bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700 transition hover:bg-blue-100"
                        >
                          {(() => {
                            const company = availableCompanies.find((c) => c.id === selectedCompanyFilter);
                            return company?.logoUrl ? (
                              <div className="relative h-4 w-4 overflow-hidden rounded">
                                <Image
                                  src={company.logoUrl}
                                  alt={company.name}
                                  fill
                                  className="object-contain"
                                  sizes="16px"
                                />
                              </div>
                            ) : (
                              <Building2 className="h-3.5 w-3.5" />
                            );
                          })()}
                          <span>
                            {availableCompanies.find((c) => c.id === selectedCompanyFilter)?.name}
                          </span>
                          <X className="h-3.5 w-3.5" />
                        </button>
                      )}
                      {balanceSearchInput && (
                        <button
                          type="button"
                          onClick={() => setBalanceSearchInput("")}
                          className="inline-flex items-center gap-1.5 rounded-full border-2 border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700 transition hover:bg-emerald-100"
                        >
                          <Search className="h-3.5 w-3.5" />
                          <span>&quot;{balanceSearchInput}&quot;</span>
                          <X className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  )}

                  {/* Results Count */}
                  {filteredMergedInventory.length > 0 && (
                    <p className="text-sm text-slate-600">
                      แสดง {filteredMergedInventory.length.toLocaleString("th-TH")} รายการ
                      {balanceSearchInput && ` (ค้นหา: "${balanceSearchInput}")`}
                    </p>
                  )}

                  {isLoadingInventory || isLoadingProducts ? (
                    <div className="flex h-64 items-center justify-center text-slate-400">
                      <div className="flex items-center gap-3">
                        <RefreshCw className="h-6 w-6 animate-spin text-blue-500" />
                        <span className="text-sm font-medium">กำลังโหลดข้อมูล...</span>
                      </div>
                    </div>
                  ) : !selectedEmployeeId || !selectedStoreId ? (
                    <div className="flex flex-col items-center justify-center rounded-2xl border border-blue-200 bg-blue-50 px-6 py-12 text-center">
                      <Package className="mb-3 h-12 w-12 text-blue-400" />
                      <p className="text-sm font-medium text-blue-700">
                        กรุณาเลือกพนักงานและร้านค้าเพื่อดูข้อมูลคงเหลือ
                      </p>
                    </div>
                  ) : filteredMergedInventory.length === 0 ? (
                    <div className="flex flex-col items-center justify-center rounded-2xl border border-blue-200 bg-blue-50 px-6 py-12 text-center">
                      <Package className="mb-3 h-12 w-12 text-blue-400" />
                      <p className="text-sm font-medium text-blue-700">
                        {balanceSearchInput
                          ? `ไม่พบสินค้าที่ค้นหา "${balanceSearchInput}"`
                          : "ยังไม่มีสินค้าที่ผูกกับพนักงานและร้านค้านี้"}
                      </p>
                    </div>
                  ) : (
                    <>
                      {/* Mobile: Card View */}
                      <div className="space-y-3 lg:hidden">
                        {paginatedMergedInventory.map((item, idx) => (
                          <StockInventoryCard
                            key={idx}
                            productCode={item.productCode}
                            productName={item.productName}
                            companyName={item.companyName}
                            companyLogoUrl={item.companyLogoUrl}
                            displayText={item.displayText}
                            displayUnits={item.displayUnits}
                            quantityInBase={item.quantityInBase}
                            updatedAt={item.updatedAt}
                            nearestExpiry={item.nearestExpiry}
                            totalBatches={item.totalBatches}
                            onViewBatch={() => {
                              setSelectedBatchProduct({
                                productId: item.productId,
                                productCode: item.productCode,
                                productName: item.productName,
                              });
                            }}
                          />
                        ))}
                      </div>

                      {/* Desktop: Table View */}
                      <div className="hidden lg:block">
                        <StockInventoryTable
                          items={paginatedMergedInventory}
                          onViewBatch={(productId) => {
                            const product = paginatedMergedInventory.find(p => p.productId === productId);
                            if (product) {
                              setSelectedBatchProduct({
                                productId: product.productId,
                                productCode: product.productCode,
                                productName: product.productName,
                              });
                            }
                          }}
                        />
                      </div>

                      {/* Pagination Controls */}
                      {balanceTotalPages > 1 && (
                        <div className="mt-6 flex flex-col items-center justify-between gap-4 rounded-2xl border-2 border-blue-200 bg-white/60 px-4 py-4 backdrop-blur-sm sm:flex-row">
                          <p className="text-sm font-medium text-slate-600">
                            แสดง {balanceStartIndex + 1}-{Math.min(balanceEndIndex, filteredMergedInventory.length)} จาก{" "}
                            {filteredMergedInventory.length} รายการ
                          </p>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => setBalanceCurrentPage((prev) => Math.max(1, prev - 1))}
                              disabled={balanceCurrentPage === 1}
                              className="inline-flex h-10 w-10 items-center justify-center rounded-xl border-2 border-blue-200 bg-white text-slate-700 transition-all hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              <ChevronLeft className="h-5 w-5" />
                            </button>

                            <div className="flex items-center gap-1">
                              {Array.from({ length: Math.min(5, balanceTotalPages) }, (_, i) => {
                                let pageNum: number;
                                if (balanceTotalPages <= 5) {
                                  pageNum = i + 1;
                                } else if (balanceCurrentPage <= 3) {
                                  pageNum = i + 1;
                                } else if (balanceCurrentPage >= balanceTotalPages - 2) {
                                  pageNum = balanceTotalPages - 4 + i;
                                } else {
                                  pageNum = balanceCurrentPage - 2 + i;
                                }

                                return (
                                  <button
                                    key={pageNum}
                                    onClick={() => setBalanceCurrentPage(pageNum)}
                                    className={clsx(
                                      "inline-flex h-10 w-10 items-center justify-center rounded-xl text-sm font-bold transition-all",
                                      balanceCurrentPage === pageNum
                                        ? "bg-gradient-to-r from-blue-500 to-sky-600 text-white shadow-lg shadow-blue-500/30"
                                        : "border-2 border-blue-200 bg-white text-slate-700 hover:bg-blue-50"
                                    )}
                                  >
                                    {pageNum}
                                  </button>
                                );
                              })}
                            </div>

                            <button
                              onClick={() => setBalanceCurrentPage((prev) => Math.min(balanceTotalPages, prev + 1))}
                              disabled={balanceCurrentPage === balanceTotalPages}
                              className="inline-flex h-10 w-10 items-center justify-center rounded-xl border-2 border-blue-200 bg-white text-slate-700 transition-all hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              <ChevronRight className="h-5 w-5" />
                            </button>
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>

            {/* Sidebar: GPS Status & Recent Transactions */}
            <div className="space-y-6 w-full overflow-hidden">
              {/* GPS Status Card */}
              <div className="rounded-2xl border border-blue-100 bg-white/95 p-4 shadow-sm lg:backdrop-blur-sm w-full overflow-hidden">
                <div className="mb-3 flex items-center gap-2">
                  <MapPin className="h-5 w-5 text-blue-600" />
                  <h3 className="text-sm font-semibold text-blue-700">สถานะตำแหน่ง</h3>
                </div>
                {locationState.status === "resolved" ? (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-xs text-emerald-600">
                      <CheckCircle className="h-4 w-4" />
                      <span className="font-medium">ตรวจพบตำแหน่ง</span>
                    </div>
                    <p className="text-xs text-slate-600">{locationSummary}</p>
                  </div>
                ) : locationState.status === "locating" ? (
                  <div className="flex items-center gap-2 text-xs text-blue-600">
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    <span>กำลังตรวจจับ...</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-xs text-red-600">
                    <XCircle className="h-4 w-4" />
                    <span>ไม่พบตำแหน่ง</span>
                  </div>
                )}
              </div>

              {/* Recent Transactions */}
              {groupedRecentTransactions.length > 0 && (
                <div className="rounded-2xl border border-blue-100 bg-white/95 p-4 shadow-sm lg:backdrop-blur-sm w-full overflow-hidden">
                  <div className="mb-3 flex items-center gap-2">
                    <Clock className="h-5 w-5 text-blue-600" />
                    <h3 className="text-sm font-semibold text-blue-700">รายการล่าสุด</h3>
                  </div>
                  <div className="space-y-2 w-full">
                    {groupedRecentTransactions.slice(0, 5).map((group) => {
                      const IconComponent = transactionIcons[group.transactionType] ?? transactionIcons.receive;
                      const gradientColor = transactionColors[group.transactionType] ?? transactionColors.receive;

                      // Format units display: "9 ลัง 10 แพ็ค 15 ซอง"
                      const unitsDisplay = group.units
                        .map((u) => `${u.quantity.toLocaleString("th-TH")} ${u.unitName}`)
                        .join(" ");

                      return (
                        <div
                          key={group.groupKey}
                          className="group flex items-start gap-2 rounded-xl border border-blue-100 bg-white p-3 text-xs transition hover:shadow-sm w-full overflow-hidden"
                        >
                          <div
                            className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-gradient-to-br ${gradientColor}`}
                          >
                            <div className="flex h-6 w-6 items-center justify-center text-white">
                              {IconComponent}
                            </div>
                          </div>
                          <div className="flex-1 min-w-0 overflow-hidden">
                            <p className="font-semibold text-blue-900 truncate">
                              {group.productName}
                            </p>
                            <p className="text-xs text-slate-600 break-words">
                              <span className="font-medium">
                                {unitsDisplay}
                              </span>
                            </p>
                            {group.note && (
                              <p className="mt-0.5 text-xs text-slate-500 truncate">{group.note}</p>
                            )}
                            <time className="mt-1 flex items-center gap-1 text-xs text-slate-400">
                              <Calendar className="h-3 w-3 flex-shrink-0" />
                              <span className="truncate">
                                {new Date(group.createdAt).toLocaleDateString("th-TH", {
                                  month: "short",
                                  day: "numeric",
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })}
                              </span>
                            </time>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>

      {/* Unified Modal for Receive Transactions */}
      {(isReceiveModalOpen || isReceiveElderlyModalOpen) && (
        <div className="fixed inset-0 z-[120]">
          <div
            className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            onClick={() => {
              setIsReceiveModalOpen(false);
              setIsReceiveElderlyModalOpen(false);
            }}
          />
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="relative w-full h-full pointer-events-auto overflow-hidden">
              {/* Quick Mode - slides from left */}
              <div
                className={`absolute inset-0 transition-transform duration-500 ease-in-out ${recordingMode === "quick" ? "translate-x-0" : "-translate-x-full"
                  }`}
              >
                <StockProductBottomSheet
                  isOpen={true}
                  onClose={() => {
                    setIsReceiveModalOpen(false);
                    setIsReceiveElderlyModalOpen(false);
                    // ✅ Clear editing state when closed
                    setEditingCartItemIndex(null);
                    setEditingCartItemData(null);
                  }}
                  products={products}
                  stockInventory={inventory}
                  transactionType="receive"
                  onAdd={handleReceiveAdd}
                  title="เพิ่มรายการรับเข้า"
                  actionLabel="เพิ่มในตะกร้า"
                  recordingMode={recordingMode}
                  onModeChange={(newMode) => {
                    setRecordingMode(newMode);
                  }}
                  editingData={
                    editingCartItemData
                      ? {
                        assignmentId: editingCartItemData.assignmentId,
                        unitQuantities: editingCartItemData.unitQuantities,
                      }
                      : null
                  }
                />
              </div>

              {/* Elderly Mode - slides from right */}
              <div
                className={`absolute inset-0 transition-transform duration-500 ease-in-out ${recordingMode === "elderly" ? "translate-x-0" : "translate-x-full"
                  }`}
              >
                <Suspense fallback={null}>
                  <StockElderlyModal
                    isOpen={true}
                    onClose={() => {
                      setIsReceiveModalOpen(false);
                      setIsReceiveElderlyModalOpen(false);
                      // ✅ Clear editing state when closed
                      setEditingCartItemIndex(null);
                      setEditingCartItemData(null);
                    }}
                    products={products}
                    stockInventory={inventory}
                    onSaveCart={handleReceiveElderlyAdd}
                    transactionType="receive"
                    recordingMode={recordingMode}
                    onModeChange={(newMode) => {
                      setRecordingMode(newMode);
                    }}
                    editingData={
                      editingCartItemData
                        ? {
                            assignmentId: editingCartItemData.assignmentId,
                            unitQuantities: Object.fromEntries(
                              Object.entries(editingCartItemData.unitQuantities).map(([k, v]) => [k, String(v)])
                            ),
                          }
                        : null
                    }
                  />
                </Suspense>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Unified Modal for Return Transactions */}
      {(isReturnModalOpen || isReturnElderlyModalOpen) && (
        <div className="fixed inset-0 z-[120]">
          <div
            className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            onClick={() => {
              setIsReturnModalOpen(false);
              setIsReturnElderlyModalOpen(false);
            }}
          />
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="relative w-full h-full pointer-events-auto overflow-hidden">
              {/* Quick Mode - slides from left */}
              <div
                className={`absolute inset-0 transition-transform duration-500 ease-in-out ${recordingMode === "quick" ? "translate-x-0" : "-translate-x-full"
                  }`}
              >
                <StockProductBottomSheet
                  isOpen={true}
                  onClose={() => {
                    setIsReturnModalOpen(false);
                    setIsReturnElderlyModalOpen(false);
                  }}
                  products={products}
                  stockInventory={inventory}
                  transactionType="return"
                  onAdd={handleReturnAdd}
                  title="เพิ่มรายการคืนสินค้า"
                  actionLabel="เพิ่มในตะกร้า"
                  recordingMode={recordingMode}
                  onModeChange={(newMode) => {
                    setRecordingMode(newMode);
                  }}
                />
              </div>

              {/* Elderly Mode - slides from right */}
              <div
                className={`absolute inset-0 transition-transform duration-500 ease-in-out ${recordingMode === "elderly" ? "translate-x-0" : "translate-x-full"
                  }`}
              >
                <Suspense fallback={null}>
                  <StockElderlyModal
                    isOpen={true}
                    onClose={() => {
                      setIsReturnModalOpen(false);
                      setIsReturnElderlyModalOpen(false);
                      // ✅ Clear editing state when closed
                      setEditingCartItemIndex(null);
                      setEditingCartItemData(null);
                    }}
                    products={products}
                    stockInventory={inventory}
                    onSaveCart={handleReturnElderlyAdd}
                    transactionType="return"
                    recordingMode={recordingMode}
                    onModeChange={(newMode) => {
                      setRecordingMode(newMode);
                    }}
                    editingData={
                      editingCartItemData
                        ? {
                            assignmentId: editingCartItemData.assignmentId,
                            unitQuantities: Object.fromEntries(
                              Object.entries(editingCartItemData.unitQuantities).map(([k, v]) => [k, String(v)])
                            ),
                          }
                        : null
                    }
                  />
                </Suspense>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Unified Modal for Initial/Adjustment Transactions */}
      {(isInitialModalOpen || isInitialElderlyModalOpen) && (
        <div className="fixed inset-0 z-[120]">
          <div
            className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            onClick={() => {
              setIsInitialModalOpen(false);
              setIsInitialElderlyModalOpen(false);
            }}
          />
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="relative w-full h-full pointer-events-auto overflow-hidden">
              {/* Quick Mode - slides from left */}
              <div
                className={`absolute inset-0 transition-transform duration-500 ease-in-out ${recordingMode === "quick" ? "translate-x-0" : "-translate-x-full"
                  }`}
              >
                <StockProductBottomSheet
                  isOpen={true}
                  onClose={() => {
                    setIsInitialModalOpen(false);
                    setIsInitialElderlyModalOpen(false);
                  }}
                  products={products}
                  stockInventory={inventory}
                  transactionType="initial"
                  onAdd={handleInitialAdd}
                  title="เพิ่มรายการตั้งค่าสต็อก"
                  actionLabel="เพิ่มในตะกร้า"
                  recordingMode={recordingMode}
                  onModeChange={(newMode) => {
                    setRecordingMode(newMode);
                  }}
                />
              </div>

              {/* Elderly Mode - slides from right */}
              <div
                className={`absolute inset-0 transition-transform duration-500 ease-in-out ${recordingMode === "elderly" ? "translate-x-0" : "translate-x-full"
                  }`}
              >
                <Suspense fallback={null}>
                  <StockElderlyModal
                    isOpen={true}
                    onClose={() => {
                      setIsInitialModalOpen(false);
                      setIsInitialElderlyModalOpen(false);
                      // ✅ Clear editing state when closed
                      setEditingCartItemIndex(null);
                      setEditingCartItemData(null);
                    }}
                    products={products}
                    stockInventory={inventory}
                    onSaveCart={handleInitialElderlyAdd}
                    transactionType="initial"
                    recordingMode={recordingMode}
                    onModeChange={(newMode) => {
                      setRecordingMode(newMode);
                    }}
                    editingData={
                      editingCartItemData
                        ? {
                            assignmentId: editingCartItemData.assignmentId,
                            unitQuantities: Object.fromEntries(
                              Object.entries(editingCartItemData.unitQuantities).map(([k, v]) => [k, String(v)])
                            ),
                          }
                      : null
                  }
                />
                </Suspense>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Batch Selection Modal (for return transactions) */}
      {isBatchSelectionModalOpen && batchSelectionProduct && (
        <Suspense fallback={null}>
          <BatchSelectionModal
            isOpen={isBatchSelectionModalOpen}
            onClose={() => {
              setIsBatchSelectionModalOpen(false);
              setEditingReturnBatchIndex(null);
            }}
            onSelect={(batch) => {
              if (editingReturnBatchIndex !== null) {
                selectReturnBatch(editingReturnBatchIndex, batch);
              }
              setIsBatchSelectionModalOpen(false);
              setEditingReturnBatchIndex(null);
            }}
            batches={availableReturnBatches}
            isLoading={loadingReturnBatches}
            productName={batchSelectionProduct.productName}
            productCode={batchSelectionProduct.productCode}
            displayUnits={batchSelectionProduct.displayUnits}
          />
        </Suspense>
      )}

      {/* Batch Detail Modal */}
      {selectedBatchProduct && (
        <Suspense fallback={null}>
          <BatchDetailModal
            isOpen={!!selectedBatchProduct}
            onClose={() => setSelectedBatchProduct(null)}
            productId={selectedBatchProduct.productId}
          productCode={selectedBatchProduct.productCode}
          productName={selectedBatchProduct.productName}
          employeeId={selectedEmployeeId || ''}
          storeId={selectedStoreId || ''}
          productUnits={
            products
              .find(p => p.productId === selectedBatchProduct.productId)
              ?.units.map(u => ({
                id: u.unitId,
                name: u.unitName,
                product_id: selectedBatchProduct.productId,
                multiplier_to_base: u.multiplierToBase,
                is_base: u.multiplierToBase === 1,  // ถ้า multiplier = 1 แสดงว่าเป็น base unit
                sku: undefined,
              })) || []
          }
        />
        </Suspense>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirmation && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[9998]"
            onClick={() => setDeleteConfirmation(null)}
          />

          {/* Modal */}
          <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
            <div
              className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl border border-red-100 overflow-hidden animate-in fade-in zoom-in-95 duration-200"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="bg-gradient-to-r from-red-500 to-rose-500 px-6 py-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white/20">
                    <AlertTriangle className="h-6 w-6 text-white" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-white">ยืนยันการลบ</h3>
                    <p className="text-sm text-white/90">กรุณาตรวจสอบก่อนลบ</p>
                  </div>
                </div>
              </div>

              {/* Body */}
              <div className="p-6">
                <p className="text-base font-semibold text-slate-900 mb-2">
                  คุณแน่ใจหรือไม่ที่ต้องการลบสินค้านี้?
                </p>

                {/* Product Info */}
                <div className="rounded-xl bg-slate-50 border border-slate-200 p-4 mb-4">
                  <p className="text-sm font-bold text-blue-900 mb-1">
                    {deleteConfirmation.productCode}
                  </p>
                  <p className="text-sm text-slate-700 mb-3">
                    {deleteConfirmation.productName}
                  </p>

                  {/* Units */}
                  <div className="flex flex-wrap gap-2">
                    {deleteConfirmation.items.map((item, idx) => (
                      <div
                        key={idx}
                        className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white border border-slate-200"
                      >
                        <span className="text-xs font-semibold text-slate-900">
                          {item.unitName}
                        </span>
                        <span className="text-xs text-slate-400">•</span>
                        <span className="text-xs font-bold text-red-600">
                          {item.quantity.toLocaleString("th-TH")}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                <p className="text-sm text-slate-600">
                  การดำเนินการนี้จะลบสินค้าทั้งหมดออกจากตะกร้า
                </p>
              </div>

              {/* Footer */}
              <div className="bg-slate-50 px-6 py-4 flex gap-3">
                <button
                  type="button"
                  onClick={() => setDeleteConfirmation(null)}
                  className="flex-1 px-4 py-3 rounded-xl border-2 border-slate-300 bg-white font-semibold text-slate-700 transition-all hover:bg-slate-50 hover:border-slate-400 active:scale-95"
                >
                  ยกเลิก
                </button>
                <button
                  type="button"
                  onClick={() => {
                    // Remove all items of this product from the correct cart
                    const firstItem = deleteConfirmation.items[0];

                    // Check which cart contains this item
                    if (receiveCart.includes(firstItem)) {
                      const indicesToRemove = deleteConfirmation.items.map(item => receiveCart.indexOf(item));
                      setReceiveCart(prev => prev.filter((_, idx) => !indicesToRemove.includes(idx)));
                    } else if (returnCart.includes(firstItem)) {
                      const indicesToRemove = deleteConfirmation.items.map(item => returnCart.indexOf(item));
                      setReturnCart(prev => prev.filter((_, idx) => !indicesToRemove.includes(idx)));
                    }

                    setDeleteConfirmation(null);
                  }}
                  className="flex-1 px-4 py-3 rounded-xl bg-gradient-to-r from-red-500 to-rose-500 font-bold text-white shadow-lg transition-all hover:shadow-xl hover:scale-105 active:scale-95"
                >
                  ยืนยันลบ
                </button>
              </div>
            </div>
          </div>
        </>
      )}

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
