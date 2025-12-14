"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  CalendarDays,
  Download,
  PencilLine,
  Plus,
  ShieldCheck,
  Trash2,
  X,
} from "lucide-react";

type ExpenseItem = {
  id: string;
  label: string;
  amount: number;
  note?: string;
};

type EmployeeExpense = {
  id: string;
  employeeId: string;
  name: string;
  role: string;
  store: string;
  baseline: number;
  currency: string;
  items: ExpenseItem[];
  effectiveMonth: string;
  lastUpdated: string;
};

type EmployeeOption = {
  id: string;
  name: string;
  role?: string | null;
  storeId?: string | null;
  storeName?: string | null;
};

type StoreOption = {
  id: string;
  name: string;
  province?: string | null;
};

type ExpenseFormState = {
  employeeId: string;
  effectiveMonth: string;
  items: Array<{ id: string; label: string; amount: string; note: string }>;
};

const INITIAL_EXPENSES: EmployeeExpense[] = [];

const buildDefaultMonthOptions = (monthCount = 12) => {
  const now = new Date();
  const options: Array<{ value: string; label: string }> = [];
  for (let i = 0; i < monthCount; i += 1) {
    const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const value = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    const label = date.toLocaleDateString("th-TH", { year: "numeric", month: "long" });
    options.push({ value, label });
  }
  return options;
};

const DEFAULT_MONTH_OPTIONS = buildDefaultMonthOptions();

const getCurrentMonth = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
};

const createBlankItem = (): ExpenseFormState["items"][number] => ({
  id: crypto.randomUUID(),
  label: "",
  amount: "",
  note: "",
});

const createInitialFormState = (month?: string): ExpenseFormState => ({
  employeeId: "",
  effectiveMonth: month ?? getCurrentMonth(),
  items: [createBlankItem()],
});

const currencyFormatter = new Intl.NumberFormat("th-TH", {
  style: "currency",
  currency: "THB",
  maximumFractionDigits: 0,
});

export default function ExpensesSection() {
  const [employees, setEmployees] = useState<EmployeeOption[]>([]);
  const [isLoadingEmployees, setIsLoadingEmployees] = useState(true);
  const [employeeError, setEmployeeError] = useState<string | null>(null);
  const [stores, setStores] = useState<StoreOption[]>([]);
  const [isLoadingStores, setIsLoadingStores] = useState(true);
  const [storeError, setStoreError] = useState<string | null>(null);
  const [expenses, setExpenses] = useState<EmployeeExpense[]>(INITIAL_EXPENSES);
  const [selectedMonth, setSelectedMonth] = useState<string>(getCurrentMonth());
  const [showForm, setShowForm] = useState(false);
  const [formMode, setFormMode] = useState<"create" | "edit">("create");
  const [editingExpenseId, setEditingExpenseId] = useState<string | null>(null);
  const [formState, setFormState] = useState<ExpenseFormState>(() => createInitialFormState(getCurrentMonth()));
  const [formError, setFormError] = useState<string | null>(null);
  const [isLoadingExpenses, setIsLoadingExpenses] = useState(true);
  const [expensesError, setExpensesError] = useState<string | null>(null);
  const [isSavingExpense, setIsSavingExpense] = useState(false);

  useEffect(() => {
    let active = true;
    const loadExpenses = async () => {
      setIsLoadingExpenses(true);
      setExpensesError(null);
      try {
        const response = await fetch("/api/admin/expenses", { cache: "no-store" });
        if (!response.ok) {
          throw new Error("ไม่สามารถโหลดรายการค่าใช้จ่ายได้");
        }
        const payload = (await response.json()) as { expenses?: EmployeeExpense[] };
        if (!active) return;
        const list = Array.isArray(payload.expenses) ? payload.expenses : [];
        setExpenses(
          list.map((expense: EmployeeExpense) => ({
            ...expense,
            items: Array.isArray(expense.items)
              ? expense.items.map((item) => ({
                  ...item,
                  id: item.id ?? crypto.randomUUID(),
                }))
              : [],
          })),
        );
        if (list.length > 0) {
          setSelectedMonth(list[0]!.effectiveMonth);
        } else {
          setSelectedMonth(getCurrentMonth());
        }
      } catch (error) {
        if (!active) return;
        setExpenses([]);
        setExpensesError(
          error instanceof Error ? error.message : "ไม่สามารถโหลดรายการค่าใช้จ่ายได้",
        );
      } finally {
        if (active) setIsLoadingExpenses(false);
      }
    };
    void loadExpenses();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    const loadEmployees = async () => {
      setIsLoadingEmployees(true);
      setEmployeeError(null);
      try {
        const response = await fetch("/api/admin/employees");
        if (!response.ok) {
          throw new Error("ไม่สามารถโหลดรายชื่อพนักงานได้");
        }
        const payload = (await response.json()) as {
          employees?: Array<{
            id?: string;
            name?: string | null;
            role?: string | null;
            defaultStoreId?: string | null;
          }>;
        };
        if (!active) return;
        const list = Array.isArray(payload.employees) ? payload.employees : [];
        setEmployees(
          list
            .filter((item) => typeof item?.id === "string" && item.id)
            .map((item) => ({
              id: item.id as string,
              name: (item.name ?? "").trim() || "ไม่ระบุชื่อ",
              role: item.role ?? null,
              storeId: item.defaultStoreId ?? null,
            })),
        );
      } catch (error) {
        if (!active) return;
        setEmployees([]);
        setEmployeeError(
          error instanceof Error ? error.message : "ไม่สามารถโหลดรายชื่อพนักงานได้",
        );
      } finally {
        if (active) {
          setIsLoadingEmployees(false);
        }
      }
    };
    void loadEmployees();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    const loadStores = async () => {
      setIsLoadingStores(true);
      setStoreError(null);
      try {
        const response = await fetch("/api/admin/stores");
        if (!response.ok) {
          throw new Error("ไม่สามารถโหลดข้อมูลร้าน/หน่วยงานได้");
        }
        const payload = (await response.json()) as {
          stores?: Array<{
            id?: string;
            name?: string | null;
            province?: string | null;
          }>;
        };
        if (!active) return;
        const list = Array.isArray(payload.stores) ? payload.stores : [];
        setStores(
          list
            .filter((item) => typeof item?.id === "string" && item.id)
            .map((item) => ({
              id: item.id as string,
              name: (item.name ?? "").trim() || "ไม่ระบุสาขา",
              province: item.province ?? null,
            })),
        );
      } catch (error) {
        if (!active) return;
        setStores([]);
        setStoreError(
          error instanceof Error ? error.message : "ไม่สามารถโหลดข้อมูลร้าน/หน่วยงานได้",
        );
      } finally {
        if (active) {
          setIsLoadingStores(false);
        }
      }
    };
    void loadStores();
    return () => {
      active = false;
    };
  }, []);

  const storeMap = useMemo(() => {
    return new Map(stores.map((store) => [store.id, store]));
  }, [stores]);

  const employeeOptions = useMemo(() => {
    return employees.map((employee) => ({
      ...employee,
      storeName: employee.storeId ? storeMap.get(employee.storeId)?.name ?? employee.storeName ?? null : employee.storeName ?? null,
    }));
  }, [employees, storeMap]);

const employeeLookup = useMemo(
  () => new Map(employeeOptions.map((employee) => [employee.id, employee])),
  [employeeOptions],
);

const isLoadingData = isLoadingEmployees || isLoadingStores || isLoadingExpenses;
const canManageExpenses = !isLoadingData && employeeOptions.length > 0;

 const filteredExpenses = useMemo(
    () => expenses.filter((item) => item.effectiveMonth === selectedMonth),
    [expenses, selectedMonth],
  );

  const handleDeleteExpense = async (expenseId: string) => {
    setIsSavingExpense(true);
    setFormError(null);
    try {
      const response = await fetch("/api/admin/expenses", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: expenseId }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload?.message ?? "ไม่สามารถลบค่าใช้จ่ายได้");
      }
      const list = Array.isArray(payload.expenses) ? payload.expenses : [];
      setExpenses(list);
      const monthExists = list.some((expense: EmployeeExpense) => expense.effectiveMonth === selectedMonth);
      if (!monthExists && list.length > 0) {
        setSelectedMonth(list[0]!.effectiveMonth);
      }
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "ไม่สามารถลบค่าใช้จ่ายได้");
    } finally {
      setIsSavingExpense(false);
    }
  };

  const monthOptions = useMemo(() => {
    const existing = new Set(DEFAULT_MONTH_OPTIONS.map((option) => option.value));
    const fromData = new Set(expenses.map((expense) => expense.effectiveMonth));
    const merged = new Set([...existing, ...fromData]);
    return Array.from(merged)
      .sort()
      .reverse()
      .map((value) => ({
        value,
        label:
          DEFAULT_MONTH_OPTIONS.find((option) => option.value === value)?.label ??
          new Date(`${value}-01`).toLocaleDateString("th-TH", {
            year: "numeric",
            month: "long",
          }),
      }));
  }, [expenses]);

  const totalBaseline = useMemo(
    () => filteredExpenses.reduce((sum, item) => sum + item.baseline, 0),
    [filteredExpenses],
  );

  const highestExpense = useMemo(() => {
    if (filteredExpenses.length === 0) return null;
    return filteredExpenses.reduce((prev, current) =>
      current.baseline > prev.baseline ? current : prev,
    );
  }, [filteredExpenses]);

  const openCreateForm = () => {
    if (!canManageExpenses) {
      return;
    }
    setFormMode("create");
    setEditingExpenseId(null);
    setFormState(createInitialFormState(selectedMonth));
    setFormError(null);
    setShowForm(true);
  };

  const openEditForm = (expense: EmployeeExpense) => {
    setFormMode("edit");
    setEditingExpenseId(expense.id);
    setFormState({
      employeeId: expense.employeeId,
      effectiveMonth: expense.effectiveMonth,
      items:
        expense.items.length > 0
          ? expense.items.map((item) => ({
              id: item.id || crypto.randomUUID(),
              label: item.label,
              amount: item.amount.toString(),
              note: item.note ?? "",
            }))
          : [createBlankItem()],
    });
    setFormError(null);
    setShowForm(true);
  };

  const handleFormItemChange = (
    itemId: string,
    field: "label" | "amount" | "note",
    value: string,
  ) => {
    setFormState((prev) => ({
      ...prev,
      items: prev.items.map((item) =>
        item.id === itemId ? { ...item, [field]: value } : item,
      ),
    }));
  };

  const handleAddItemRow = () => {
    setFormState((prev) => ({
      ...prev,
      items: [
        ...prev.items,
        createBlankItem(),
      ],
    }));
  };

  const handleRemoveItemRow = (itemId: string) => {
    setFormState((prev) => ({
      ...prev,
      items: prev.items.length > 1 ? prev.items.filter((item) => item.id !== itemId) : prev.items,
    }));
  };

  const resetForm = () => {
    setShowForm(false);
    setFormError(null);
    setEditingExpenseId(null);
  };

  const handleFormSubmit = async () => {
    const employee = formState.employeeId ? employeeLookup.get(formState.employeeId) : undefined;
    if (!employee) {
      setFormError("กรุณาเลือกพนักงาน");
      return;
    }
    if (!formState.effectiveMonth) {
      setFormError("กรุณาเลือกเดือนที่ต้องการบันทึก");
      return;
    }
    const normalizedItems = formState.items
      .map((item) => ({
        id: item.id,
        label: item.label.trim(),
        amount: Number(item.amount),
        note: item.note.trim() || undefined,
      }))
      .filter((item) => item.label && Number.isFinite(item.amount) && item.amount > 0);
    if (normalizedItems.length === 0) {
      setFormError("กรุณาเพิ่มรายการค่าใช้จ่ายอย่างน้อย 1 รายการ");
      return;
    }
    const baseline = normalizedItems.reduce((sum, item) => sum + item.amount, 0);
    const roleLabel = employee.role?.trim() || "ไม่ระบุบทบาท";
    const storeLabel = employee.storeName?.trim() || "ไม่ระบุสาขา";
    const entryId =
      formMode === "edit" && editingExpenseId
        ? editingExpenseId
        : `${employee.id}-${formState.effectiveMonth}`;
    const nextExpense: EmployeeExpense = {
      id: entryId,
      employeeId: employee.id,
      name: employee.name,
      role: roleLabel,
      store: storeLabel,
      baseline,
      currency: "THB",
      items: normalizedItems,
      effectiveMonth: formState.effectiveMonth,
      lastUpdated: new Date().toISOString(),
    };

    setIsSavingExpense(true);
    setFormError(null);
    try {
      const response = await fetch("/api/admin/expenses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ expense: nextExpense }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload?.message ?? "ไม่สามารถบันทึกค่าใช้จ่ายได้");
      }
      const list = Array.isArray(payload.expenses) ? payload.expenses : [];
      setExpenses(
        list.map((expense: EmployeeExpense) => ({
          ...expense,
          items: Array.isArray(expense.items)
            ? expense.items.map((item) => ({
                ...item,
                id: item.id ?? crypto.randomUUID(),
              }))
            : [],
        })),
      );
      setSelectedMonth(nextExpense.effectiveMonth);
      resetForm();
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "ไม่สามารถบันทึกค่าใช้จ่ายได้");
    } finally {
      setIsSavingExpense(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard
          title="งบประมาณประจำเดือน"
          value={currencyFormatter.format(totalBaseline)}
          subtext="เฉพาะค่าใช้จ่ายคงที่ของทีม"
        />
        <SummaryCard
          title="พนักงานที่ใช้งบสูงสุด"
          value={highestExpense ? highestExpense.name : "—"}
          subtext={highestExpense ? currencyFormatter.format(highestExpense.baseline) : "ไม่มีข้อมูล"}
        />
        <SummaryCard
          title="จำนวนพนักงาน"
          value={`${filteredExpenses.length} คน`}
          subtext="มีค่าใช้จ่ายบันทึกไว้"
        />
        <SummaryCard
          title="สถานะการอนุมัติ"
          value="อนุมัติครบ"
          subtext="ปรับปรุงล่าสุด 3 พ.ค. 2024"
          icon={<ShieldCheck className="h-4 w-4 text-emerald-500" />}
        />
      </div>

      {isLoadingData && (
        <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-500">
          กำลังโหลดรายชื่อพนักงานและข้อมูลร้าน/หน่วยงาน...
        </div>
      )}
      {employeeError && (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-600">
          {employeeError}
        </div>
      )}
      {expensesError && (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-600">
          {expensesError}
        </div>
      )}
      {storeError && (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-600">
          {storeError}
        </div>
      )}
      {!isLoadingData && !employeeError && employeeOptions.length === 0 && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-700">
          ยังไม่มีรายชื่อพนักงานในระบบ กรุณาเพิ่มพนักงานก่อนบันทึกค่าใช้จ่าย
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
        <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
          <CalendarDays className="h-4 w-4 text-blue-500" />
          เลือกเดือนที่ต้องการดู
        </label>
        <select
          value={selectedMonth}
          onChange={(event) => setSelectedMonth(event.target.value)}
          className="form-input max-w-xs"
        >
          {monthOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <div className="flex-1" />
        <button
          type="button"
          className="inline-flex items-center gap-2 rounded-xl border border-blue-200 bg-white px-3 py-2 text-xs font-semibold text-blue-600 shadow-sm transition hover:bg-blue-50"
        >
          <Download className="h-4 w-4" />
          ดาวน์โหลด Excel
        </button>
        <button
          type="button"
          onClick={openCreateForm}
          disabled={!canManageExpenses}
          className={`inline-flex items-center gap-2 rounded-xl bg-blue-600 px-3 py-2 text-xs font-semibold text-white shadow-sm transition ${
            canManageExpenses ? "hover:bg-blue-700" : "cursor-not-allowed opacity-60"
          }`}
        >
          <Plus className="h-4 w-4" />
          เพิ่มค่าใช้จ่ายใหม่
        </button>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200">
        <table className="min-w-full divide-y divide-slate-200">
          <thead className="bg-slate-50/80 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th scope="col" className="px-4 py-3 text-left">
                พนักงาน
              </th>
              <th scope="col" className="px-4 py-3 text-left">
                รายการค่าใช้จ่าย
              </th>
              <th scope="col" className="px-4 py-3 text-right">
                ยอดรวมต่อเดือน
              </th>
              <th scope="col" className="px-4 py-3 text-left">
                ร้าน/พื้นที่ดูแล
              </th>
              <th scope="col" className="px-4 py-3 text-left">
                ปรับปรุงล่าสุด
              </th>
              <th scope="col" className="px-4 py-3 text-left">
                จัดการ
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white">
            {filteredExpenses.map((expense) => (
              <tr key={expense.id} className="align-top">
                <td className="px-4 py-4 text-sm text-slate-700">
                  <p className="font-semibold text-slate-900">{expense.name}</p>
                  <p className="text-xs text-slate-500">{expense.role}</p>
                </td>
                <td className="px-4 py-4 text-sm text-slate-600">
                  <ul className="space-y-1 text-xs text-slate-500">
                    {expense.items.map((item) => (
                      <li
                        key={item.id}
                        className="flex items-center justify-between gap-2 rounded-xl border border-slate-200/70 bg-slate-50/60 px-3 py-2"
                      >
                        <span className="font-medium text-slate-600">{item.label}</span>
                        <span className="text-slate-900">{currencyFormatter.format(item.amount)}</span>
                      </li>
                    ))}
                  </ul>
                </td>
                <td className="px-4 py-4 text-right text-sm font-semibold text-slate-900">
                  {currencyFormatter.format(expense.baseline)}
                </td>
                <td className="px-4 py-4 text-sm text-slate-600">{expense.store}</td>
                <td className="px-4 py-4 text-xs text-slate-500">
                  {new Date(expense.lastUpdated).toLocaleString("th-TH", {
                    dateStyle: "medium",
                    timeStyle: "short",
                  })}
                </td>
                <td className="px-4 py-4 text-xs">
                  <button
                    type="button"
                    onClick={() => openEditForm(expense)}
                    className="inline-flex items-center gap-1 rounded-xl border border-slate-200 px-3 py-1.5 font-semibold text-slate-600 hover:border-blue-200 hover:text-blue-600"
                  >
                    <PencilLine className="h-3.5 w-3.5" />
                    แก้ไข
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteExpense(expense.id)}
                    disabled={isSavingExpense}
                    className="ml-2 inline-flex items-center gap-1 rounded-xl border border-red-200 px-3 py-1.5 font-semibold text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    ลบ
                  </button>
                </td>
              </tr>
            ))}
            {filteredExpenses.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-sm text-slate-500">
                  ยังไม่มีข้อมูลค่าใช้จ่ายสำหรับเดือนนี้
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {showForm && (
        <FormOverlay
          mode={formMode}
          employees={employeeOptions}
          isLoadingEmployees={isLoadingEmployees}
          isSaving={isSavingExpense}
          monthOptions={monthOptions}
          selectedMonth={selectedMonth}
          formState={formState}
          error={formError}
          onClose={resetForm}
          onChangeFormState={setFormState}
          onSubmit={handleFormSubmit}
          onAddItem={handleAddItemRow}
          onRemoveItem={handleRemoveItemRow}
          onChangeItemField={handleFormItemChange}
        />
      )}
    </div>
  );
}

function SummaryCard({
  title,
  value,
  subtext,
  icon,
}: {
  title: string;
  value: string;
  subtext: string;
  icon?: ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white/90 px-4 py-5 shadow-[0_20px_60px_-45px_rgba(37,99,235,0.15)]">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-blue-500">
            {title}
          </p>
          <p className="mt-2 text-xl font-semibold text-slate-900">{value}</p>
        </div>
        {icon}
      </div>
      <p className="mt-3 text-xs text-slate-500">{subtext}</p>
    </div>
  );
}

function FormOverlay({
  mode,
  employees,
  isLoadingEmployees,
  isSaving,
  monthOptions,
  formState,
  selectedMonth,
  error,
  onClose,
  onChangeFormState,
  onSubmit,
  onAddItem,
  onRemoveItem,
  onChangeItemField,
}: {
  mode: "create" | "edit";
  employees: EmployeeOption[];
  isLoadingEmployees: boolean;
  isSaving: boolean;
  monthOptions: Array<{ value: string; label: string }>;
  formState: ExpenseFormState;
  selectedMonth: string;
  error: string | null;
  onClose: () => void;
  onChangeFormState: (value: ExpenseFormState) => void;
  onSubmit: () => void;
  onAddItem: () => void;
  onRemoveItem: (itemId: string) => void;
  onChangeItemField: (itemId: string, field: "label" | "amount" | "note", value: string) => void;
}) {
  const title = mode === "create" ? "เพิ่มค่าใช้จ่ายประจำเดือน" : "แก้ไขค่าใช้จ่าย";
  const submitLabel = mode === "create" ? "บันทึกค่าใช้จ่าย" : "อัปเดตค่าใช้จ่าย";
  const employeeSelectDisabled = isLoadingEmployees || employees.length === 0;
  const selectedEmployee =
    employees.find((employee) => employee.id === formState.employeeId) ?? null;

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-900/60 px-4 py-6">
      <div className="w-full max-w-3xl overflow-hidden rounded-3xl border border-white/20 bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-blue-500">
              Expenses Manager
            </p>
            <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 text-slate-500 hover:bg-slate-100"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="max-h-[70vh] overflow-y-auto px-6 py-6">
          <div className="grid gap-6 md:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">
                เลือกพนักงาน
                <select
                  value={formState.employeeId}
                  onChange={(event) =>
                    onChangeFormState({ ...formState, employeeId: event.target.value })
                  }
                  disabled={employeeSelectDisabled}
                  className="mt-1 form-input disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <option value="">เลือกชื่อพนักงาน</option>
                  {employees.map((employee) => (
                    <option key={employee.id} value={employee.id}>
                      {employee.name}
                      {employee.role ? ` — ${employee.role}` : ""}
                    </option>
                  ))}
                </select>
              </label>
              {employeeSelectDisabled && (
                <p className="text-xs text-slate-400">
                  {isLoadingEmployees
                    ? "กำลังโหลดรายชื่อพนักงาน..."
                    : "ยังไม่มีรายชื่อพนักงานในระบบ"}
                </p>
              )}
              {selectedEmployee && (
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
                  <p>
                    บทบาท:{" "}
                    <span className="font-semibold">
                      {selectedEmployee.role?.trim() || "ไม่ระบุ"}
                    </span>
                  </p>
                  <p>
                    ร้าน/พื้นที่รับผิดชอบ:{" "}
                    <span className="font-semibold">
                      {selectedEmployee.storeName?.trim() || "ไม่ระบุ"}
                    </span>
                  </p>
                </div>
              )}
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">
                เดือนที่บันทึกค่าใช้จ่าย
                <select
                  value={formState.effectiveMonth}
                  onChange={(event) =>
                    onChangeFormState({ ...formState, effectiveMonth: event.target.value })
                  }
                  className="mt-1 form-input"
                >
                  {monthOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                  {!monthOptions.some((option) => option.value === formState.effectiveMonth) && (
                    <option value={formState.effectiveMonth}>{formState.effectiveMonth}</option>
                  )}
                </select>
              </label>
              {mode === "create" && selectedMonth !== formState.effectiveMonth && (
                <p className="text-xs text-slate-400">
                  * ระบบจะสลับไปยังเดือน {formState.effectiveMonth} หลังบันทึกสำเร็จ
                </p>
              )}
            </div>
          </div>

          <div className="mt-6 space-y-4 rounded-2xl border border-slate-200 bg-slate-50/70 p-5">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-700">รายละเอียดค่าใช้จ่าย</h3>
              <button
                type="button"
                onClick={onAddItem}
                className="inline-flex items-center gap-2 rounded-xl border border-blue-200 bg-white px-3 py-1.5 text-xs font-semibold text-blue-600 hover:bg-blue-50"
              >
                <Plus className="h-3.5 w-3.5" />
                เพิ่มรายการ
              </button>
            </div>
            <div className="space-y-3">
              {formState.items.map((item) => (
                <div
                  key={item.id}
                  className="grid gap-3 rounded-xl border border-white bg-white/90 p-4 shadow-sm md:grid-cols-[2fr_1fr_1fr_auto]"
                >
                  <label className="flex flex-col text-xs font-semibold text-slate-600">
                    หมวดค่าใช้จ่าย
                    <input
                      value={item.label}
                      onChange={(event) =>
                        onChangeItemField(item.id, "label", event.target.value)
                      }
                      placeholder="เช่น ค่าเดินทาง / ค่าโทรศัพท์"
                      className="mt-1 form-input"
                    />
                  </label>
                  <label className="flex flex-col text-xs font-semibold text-slate-600">
                    จำนวนเงิน (บาท)
                    <input
                      value={item.amount}
                      onChange={(event) =>
                        onChangeItemField(item.id, "amount", event.target.value.replace(/[^\d.]/g, ""))
                      }
                      inputMode="decimal"
                      placeholder="0"
                      className="mt-1 form-input"
                    />
                  </label>
                  <label className="flex flex-col text-xs font-semibold text-slate-600">
                    หมายเหตุ (ถ้ามี)
                    <input
                      value={item.note}
                      onChange={(event) =>
                        onChangeItemField(item.id, "note", event.target.value)
                      }
                      placeholder="ระบุเพิ่มเติม"
                      className="mt-1 form-input"
                    />
                  </label>
                  <div className="flex items-end justify-end">
                    <button
                      type="button"
                      onClick={() => onRemoveItem(item.id)}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-500 hover:border-red-200 hover:text-red-500"
                      disabled={formState.items.length === 1}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      ลบ
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {error && (
            <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-xs font-semibold text-red-600">
              {error}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50 px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100"
          >
            ยกเลิก
          </button>
          <button
            type="button"
            onClick={onSubmit}
            disabled={isSaving}
            className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold text-white ${
              isSaving ? "cursor-not-allowed bg-blue-400" : "bg-blue-600 hover:bg-blue-700"
            }`}
          >
            {isSaving ? (
              <>
                <span className="inline-flex h-4 w-4 animate-spin rounded-full border-2 border-white border-b-transparent" />
                กำลังบันทึก...
              </>
            ) : (
              <>
                <PencilLine className="h-4 w-4" />
                {submitLabel}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
