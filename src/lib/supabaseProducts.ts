import { getSupabaseServiceClient } from "@/lib/supabaseClient";
import type { Database } from "@/types/supabase";

// Workaround for Supabase client type inference issue - .from() incorrectly infers 'never' in build context
// Using 'any' as intermediate type to bypass the type inference problem
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const getTypedClient = () => getSupabaseServiceClient() as any;

export type ProductUnit = {
  id: string;
  name: string;
  sku: string | null;
  isBase: boolean;
  multiplierToBase: number;
  createdAt: string;
};

export type ProductCatalogItem = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  companyId: string | null;
  companyName: string | null;
  companyLogoUrl: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  units: ProductUnit[];
};

export type AssignmentUnit = {
  assignmentUnitId: string;
  unitId: string;
  unitName: string;
  multiplierToBase: number;
  pricePc: number;
  isActive: boolean;
};

export type ProductAssignment = {
  assignmentId: string;
  productId: string;
  productCode: string;
  productName: string;
  companyId: string | null;
  companyName: string | null;
  companyLogoUrl: string | null;
  employeeId: string;
  storeId: string | null;
  units: AssignmentUnit[];
};

type ProductRow = Database["public"]["Tables"]["products"]["Row"];
type ProductInsert = Database["public"]["Tables"]["products"]["Insert"];
type ProductUpdate = Database["public"]["Tables"]["products"]["Update"];

type ProductUnitRow = Database["public"]["Tables"]["product_units"]["Row"];
type ProductUnitInsert = Database["public"]["Tables"]["product_units"]["Insert"];
type ProductUnitUpdate = Database["public"]["Tables"]["product_units"]["Update"];

type ProductAssignmentInsert = Database["public"]["Tables"]["product_assignments"]["Insert"];

type ProductAssignmentUnitRow = Database["public"]["Tables"]["product_assignment_units"]["Row"];
type ProductAssignmentUnitInsert = Database["public"]["Tables"]["product_assignment_units"]["Insert"];
type ProductAssignmentUnitUpdate = Database["public"]["Tables"]["product_assignment_units"]["Update"];

const nowIsoString = (): string => new Date().toISOString();

function assertSingleBaseUnit(units: Array<{ isBase?: boolean }>): void {
  const baseCount = units.filter((unit) => unit.isBase).length;
  if (baseCount !== 1) {
    throw new Error("กรุณากำหนดหน่วยฐานสินค้าให้มีเพียงหนึ่งหน่วย");
  }
}

export async function listProductCatalog(): Promise<ProductCatalogItem[]> {
  const supabase = getTypedClient();
  const { data: productRows, error: productsError } = await supabase
    .from("products")
    .select("*")
    .order("created_at", { ascending: true });

  if (productsError) {
    console.error("[products] list catalog error", productsError);
    return [];
  }

  const rows: ProductRow[] = productRows ?? [];
  const productIds = rows.map((item) => item.id);
  if (productIds.length === 0) {
    return [];
  }

  // Fetch companies for products that have company_id
  const companyIds = Array.from(new Set(rows.filter((r) => r.company_id).map((r) => r.company_id as string)));
  const companiesById = new Map<string, { name: string; logoUrl: string | null }>();

  if (companyIds.length > 0) {
    const { data: companyRows } = await supabase
      .from("companies")
      .select("id, name, logo_url")
      .in("id", companyIds);

    if (companyRows) {
      for (const company of companyRows) {
        companiesById.set(company.id, { name: company.name, logoUrl: company.logo_url ?? null });
      }
    }
  }

  const { data: unitRows, error: unitsError } = await supabase
    .from("product_units")
    .select("*")
    .in("product_id", productIds);

  if (unitsError) {
    console.error("[products] list units error", unitsError);
    return [];
  }

  const unitsByProduct = new Map<string, ProductUnit[]>();
  const units: ProductUnitRow[] = unitRows ?? [];
  for (const row of units) {
    const list = unitsByProduct.get(row.product_id) ?? [];
    list.push({
      id: row.id,
      name: row.name,
      sku: row.sku ?? null,
      isBase: row.is_base,
      multiplierToBase: row.multiplier_to_base,
      createdAt: row.created_at,
    });
    unitsByProduct.set(row.product_id, list);
  }

  return rows.map((row) => {
    const company = row.company_id ? companiesById.get(row.company_id) : null;
    return {
      id: row.id,
      code: row.code,
      name: row.name,
      description: row.description,
      companyId: row.company_id,
      companyName: company?.name ?? null,
      companyLogoUrl: company?.logoUrl ?? null,
      isActive: row.is_active,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      units: (unitsByProduct.get(row.id) ?? []).sort((a, b) => {
        if (a.isBase && !b.isBase) return -1;
        if (!a.isBase && b.isBase) return 1;
        return a.multiplierToBase - b.multiplierToBase;
      }),
    };
  });
}

export type UpsertProductCatalogInput = {
  id?: string;
  code: string;
  name: string;
  description?: string | null;
  companyId?: string | null;
  isActive?: boolean;
  units: Array<{
    id?: string;
    name: string;
    sku?: string | null;
    isBase?: boolean;
    multiplierToBase: number;
  }>;
};

export async function upsertProductCatalogItem(input: UpsertProductCatalogInput): Promise<ProductCatalogItem> {
  const supabase = getTypedClient();
  const isUpdating = Boolean(input.id);

  assertSingleBaseUnit(input.units);

  const now = nowIsoString();

  let productId: string | null = input.id ?? null;
  if (isUpdating) {
    const updatePayload: ProductUpdate = {
      code: input.code.trim(),
      name: input.name.trim(),
      description: input.description?.trim() ?? null,
      company_id: input.companyId ?? null,
      is_active: input.isActive ?? true,
      updated_at: now,
    };

    const { error } = await supabase
      .from("products")
      .update(updatePayload)
      .eq("id", input.id!);

    if (error) {
      throw new Error("ไม่สามารถอัปเดตข้อมูลสินค้าได้ กรุณาลองใหม่อีกครั้ง");
    }
  } else {
    const insertPayload: ProductInsert = {
      code: input.code.trim(),
      name: input.name.trim(),
      description: input.description?.trim() ?? null,
      company_id: input.companyId ?? null,
      is_active: input.isActive ?? true,
      created_at: now,
      updated_at: now,
    };

    const { data, error } = await supabase
      .from("products")
      .insert(insertPayload)
      .select("id")
      .single();

    if (error || !data) {
      throw new Error("ไม่สามารถสร้างสินค้าใหม่ได้ กรุณาลองใหม่อีกครั้ง");
    }
    productId = data.id;
  }

  if (!productId) {
    throw new Error("ไม่สามารถบันทึกข้อมูลสินค้าได้");
  }

  // Fetch existing units with full details
  const { data: existingUnits } = await supabase
    .from("product_units")
    .select("id, name, sku")
    .eq("product_id", productId);

  const existingUnitsList: Array<{ id: string; name: string; sku: string | null }> = existingUnits ?? [];

  // Build maps for matching
  const existingByName = new Map(existingUnitsList.map((u) => [u.name.toLowerCase().trim(), u]));
  const incomingNames = new Set(input.units.map((u) => u.name.toLowerCase().trim()));

  // Find units to delete (not in incoming list)
  const unitsToDelete = existingUnitsList.filter((u) => !incomingNames.has(u.name.toLowerCase().trim()));

  if (unitsToDelete.length > 0) {
    const obsoleteIds = unitsToDelete.map((u) => u.id);
    // Delete assignments for obsolete units
    await supabase.from("product_assignment_units").delete().in("unit_id", obsoleteIds);
    await supabase.from("product_units").delete().in("id", obsoleteIds);
  }

  // Upsert units: Update if name matches, insert if new
  for (const unit of input.units) {
    const unitNameKey = unit.name.toLowerCase().trim();
    const existingUnit = existingByName.get(unitNameKey);

    if (existingUnit) {
      // Update existing unit (matched by name)
      const updatePayload: ProductUnitUpdate = {
        name: unit.name.trim(),
        sku: unit.sku?.trim() || null,
        is_base: Boolean(unit.isBase),
        multiplier_to_base: unit.multiplierToBase,
      };

      await supabase
        .from("product_units")
        .update(updatePayload)
        .eq("id", existingUnit.id)
        .eq("product_id", productId);
    } else {
      // Insert new unit
      const insertPayload: ProductUnitInsert = {
        product_id: productId,
        name: unit.name.trim(),
        sku: unit.sku?.trim() || null,
        is_base: Boolean(unit.isBase),
        multiplier_to_base: unit.multiplierToBase,
        created_at: now,
      };

      await supabase
        .from("product_units")
        .insert(insertPayload);
    }
  }

  const catalog = await listProductCatalog();
  const product = catalog.find((item) => item.id === productId);
  if (!product) {
    throw new Error("ไม่สามารถโหลดข้อมูลสินค้าหลังบันทึกได้");
  }
  return product;
}

export async function deleteProductCatalogItem(productId: string): Promise<void> {
  const supabase = getTypedClient();

  const { data: assignments } = await supabase
    .from("product_assignments")
    .select("id")
    .eq("product_id", productId);

  const assignmentIds = (assignments ?? []).map((item: { id: string }) => item.id);
  if (assignmentIds.length > 0) {
    await supabase.from("product_assignment_units").delete().in("assignment_id", assignmentIds);
    await supabase.from("product_assignments").delete().in("id", assignmentIds);
  }

  await supabase.from("product_units").delete().eq("product_id", productId);
  await supabase.from("products").delete().eq("id", productId);
}

export type AssignmentQueryParams = {
  employeeId?: string;
  storeId?: string | null;
  onlyActiveUnits?: boolean;
};

export async function listProductAssignments({
  employeeId,
  storeId,
  onlyActiveUnits = false,
}: AssignmentQueryParams): Promise<ProductAssignment[]> {
  const supabase = getTypedClient();

  let query = supabase.from("product_assignments").select("*");
  if (employeeId) {
    query = query.eq("employee_id", employeeId);
  }
  if (typeof storeId === "string" && storeId.length > 0) {
    query = query.eq("store_id", storeId);
  }

  const { data: assignmentRows, error } = await query;
  if (error) {
    console.error("[products] list assignments error", error);
    return [];
  }

  if (!assignmentRows || assignmentRows.length === 0) {
    return [];
  }

  const productIds = Array.from(new Set(assignmentRows.map((row: { product_id: string }) => row.product_id)));
  const assignmentIds = assignmentRows.map((row: { id: string }) => row.id);

  const [{ data: productRows }, { data: unitRows }, { data: assignmentUnitRows }, { data: companyRows }] = await Promise.all([
    supabase.from("products").select("*").in("id", productIds),
    supabase.from("product_units").select("*").in("product_id", productIds),
    supabase
      .from("product_assignment_units")
      .select("*")
      .in("assignment_id", assignmentIds),
    supabase.from("companies").select("id, name, logo_url"),
  ]);

  // Debug logging
  console.log("[listProductAssignments] Debug:");
  console.log("- Assignment IDs count:", assignmentIds.length);
  console.log("- Product rows count:", productRows?.length ?? 0);
  console.log("- Unit rows count:", unitRows?.length ?? 0);
  console.log("- Assignment unit rows count:", assignmentUnitRows?.length ?? 0);
  if (assignmentUnitRows && assignmentUnitRows.length > 0) {
    console.log("- First assignment unit sample:", assignmentUnitRows[0]);
  }

  const productsById = new Map<string, ProductRow>(
    (productRows ?? []).map((row: ProductRow) => [row.id, row])
  );
  const unitsById = new Map<string, ProductUnitRow>(
    (unitRows ?? []).map((row: ProductUnitRow) => [row.id, row])
  );
  const companiesById = new Map<string, { name: string; logoUrl: string | null }>(
    (companyRows ?? []).map((row: { id: string; name: string; logo_url: string | null }) => [
      row.id,
      { name: row.name, logoUrl: row.logo_url }
    ])
  );

  const assignmentUnitsByAssignment = new Map<string, AssignmentUnit[]>();
  const assignmentUnits: ProductAssignmentUnitRow[] = assignmentUnitRows ?? [];

  for (const entry of assignmentUnits) {
    if (onlyActiveUnits && !entry.is_active) {
      console.log(`[listProductAssignments] Skipping inactive unit: ${entry.id}`);
      continue;
    }
    const unitRow = unitsById.get(entry.unit_id);
    if (!unitRow) {
      console.warn(`[listProductAssignments] Unit not found in unitsById: ${entry.unit_id}`);
      continue;
    }
    const list = assignmentUnitsByAssignment.get(entry.assignment_id) ?? [];
    list.push({
      assignmentUnitId: entry.id,
      unitId: entry.unit_id,
      unitName: unitRow.name,
      multiplierToBase: unitRow.multiplier_to_base,
      pricePc: entry.price_pc,
      isActive: entry.is_active,
    });
    assignmentUnitsByAssignment.set(entry.assignment_id, list);
  }

  console.log("[listProductAssignments] Assignment units map size:", assignmentUnitsByAssignment.size);

  return assignmentRows.map((assignment: { id: string; product_id: string; employee_id: string; store_id: string | null }) => {
    const product = productsById.get(assignment.product_id);
    const companyId = product?.company_id ?? null;
    const company = companyId ? companiesById.get(companyId) : null;

    return {
      assignmentId: assignment.id,
      productId: assignment.product_id,
      productCode: product?.code ?? "",
      productName: product?.name ?? "",
      companyId,
      companyName: company?.name ?? null,
      companyLogoUrl: company?.logoUrl ?? null,
      employeeId: assignment.employee_id,
      storeId: assignment.store_id,
      units: (assignmentUnitsByAssignment.get(assignment.id) ?? []).sort((a, b) =>
        a.multiplierToBase - b.multiplierToBase,
      ),
    };
  });
}

export type UpsertAssignmentInput = {
  productId: string;
  employeeId: string;
  storeId: string | null;
  units: Array<{
    unitId: string;
    pricePc: number;
    enabled: boolean;
  }>;
};

export async function upsertProductAssignment(input: UpsertAssignmentInput): Promise<void> {
  const supabase = getTypedClient();

  if (input.units.length === 0) {
    throw new Error("กรุณาเลือกหน่วยสินค้าก่อนบันทึก");
  }

  const enabledUnits = input.units.filter((unit) => unit.enabled && unit.pricePc > 0);
  if (enabledUnits.length === 0) {
    throw new Error("กรุณากำหนดราคาอย่างน้อย 1 หน่วยสินค้า");
  }

  let assignmentQuery = supabase
    .from("product_assignments")
    .select("id")
    .eq("product_id", input.productId)
    .eq("employee_id", input.employeeId);

  if (input.storeId === null) {
    assignmentQuery = assignmentQuery.is("store_id", null);
  } else {
    assignmentQuery = assignmentQuery.eq("store_id", input.storeId);
  }

  const { data: existingAssignment } = await assignmentQuery.maybeSingle();

  let assignmentId: string | null = existingAssignment?.id ?? null;

  if (!assignmentId) {
    const insertPayload: ProductAssignmentInsert = {
      product_id: input.productId,
      employee_id: input.employeeId,
      store_id: input.storeId ?? null,
      created_at: nowIsoString(),
    };

    const { data, error } = await supabase
      .from("product_assignments")
      .insert(insertPayload)
      .select("id")
      .single();

    if (error || !data) {
      throw new Error("ไม่สามารถสร้างการผูกสินค้ากับพนักงานได้");
    }
    assignmentId = data.id;
  }

  // At this point, assignmentId is guaranteed to be a string
  if (!assignmentId) {
    throw new Error("ไม่สามารถรับ ID ของการผูกสินค้าได้");
  }

  const { data: existingUnits } = await supabase
    .from("product_assignment_units")
    .select("id, unit_id")
    .eq("assignment_id", assignmentId);

  const existingUnitsList: Array<{ id: string; unit_id: string }> = existingUnits ?? [];
  const unitsToDisable = new Set(existingUnitsList.map((entry) => entry.unit_id));

  for (const unit of enabledUnits) {
    unitsToDisable.delete(unit.unitId);
    const existing = existingUnitsList.find((entry) => entry.unit_id === unit.unitId);
    if (existing) {
      const updatePayload: ProductAssignmentUnitUpdate = {
        price_pc: unit.pricePc,
        is_active: true,
      };

      const { error: updateError } = await supabase
        .from("product_assignment_units")
        .update(updatePayload)
        .eq("id", existing.id);

      if (updateError) {
        throw new Error(`ไม่สามารถอัปเดตหน่วยสินค้าได้: ${updateError.message}`);
      }
    } else {
      const insertPayload: ProductAssignmentUnitInsert = {
        assignment_id: assignmentId,
        unit_id: unit.unitId,
        price_pc: unit.pricePc,
        is_active: true,
        created_at: nowIsoString(),
      };

      const { error: insertError } = await supabase
        .from("product_assignment_units")
        .insert(insertPayload);

      if (insertError) {
        throw new Error(`ไม่สามารถเพิ่มหน่วยสินค้าได้: ${insertError.message}`);
      }
    }
  }

  if (unitsToDisable.size > 0) {
    const disablePayload: ProductAssignmentUnitUpdate = {
      is_active: false,
    };

    const { error: disableError } = await supabase
      .from("product_assignment_units")
      .update(disablePayload)
      .in("unit_id", Array.from(unitsToDisable))
      .eq("assignment_id", assignmentId);

    if (disableError) {
      throw new Error(`ไม่สามารถปิดการใช้งานหน่วยสินค้าได้: ${disableError.message}`);
    }
  }
}

export async function deleteProductAssignment(assignmentId: string): Promise<void> {
  const supabase = getTypedClient();
  await supabase.from("product_assignment_units").delete().eq("assignment_id", assignmentId);
  await supabase.from("product_assignments").delete().eq("id", assignmentId);
}

export async function updateProductAssignmentUnit(
  unitId: string,
  pricePc: number,
  isActive: boolean
): Promise<void> {
  const supabase = getTypedClient();

  const updatePayload: ProductAssignmentUnitUpdate = {
    price_pc: pricePc,
    is_active: isActive,
  };

  const { error: updateError } = await supabase
    .from("product_assignment_units")
    .update(updatePayload)
    .eq("id", unitId);

  if (updateError) {
    throw new Error(`ไม่สามารถอัปเดตหน่วยสินค้าได้: ${updateError.message}`);
  }
}

export async function insertProductAssignmentUnit(
  assignmentId: string,
  unitId: string,
  pricePc: number,
  createdAt: string
): Promise<void> {
  const supabase = getTypedClient();

  const insertPayload: ProductAssignmentUnitInsert = {
    assignment_id: assignmentId,
    unit_id: unitId,
    price_pc: pricePc,
    is_active: true,
    created_at: createdAt,
  };

  const { error: insertError } = await supabase
    .from("product_assignment_units")
    .insert(insertPayload);

  if (insertError) {
    throw new Error(`ไม่สามารถเพิ่มหน่วยสินค้าได้: ${insertError.message}`);
  }
}
