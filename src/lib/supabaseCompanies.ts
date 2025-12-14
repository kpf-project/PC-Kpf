/**
 * Supabase Companies Operations
 *
 * CRUD operations for companies table with type safety and performance optimization
 */

import { getSupabaseServiceClient } from "@/lib/supabaseClient";
import type { Database } from "@/types/supabase";

// Workaround for Supabase client type inference issue
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const getTypedClient = () => getSupabaseServiceClient() as any;

export type Company = {
  id: string;
  name: string;
  code: string | null;
  logoUrl: string | null;
  description: string | null;
  primaryColor: string;
  secondaryColor: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type CompanyInsert = {
  name: string;
  code?: string | null;
  logoUrl?: string | null;
  description?: string | null;
  primaryColor?: string;
  secondaryColor?: string;
  isActive?: boolean;
};

export type CompanyUpdate = {
  name?: string;
  code?: string | null;
  logoUrl?: string | null;
  description?: string | null;
  primaryColor?: string;
  secondaryColor?: string;
  isActive?: boolean;
};

type CompanyRow = Database["public"]["Tables"]["companies"]["Row"];

/**
 * List all companies with optional filters
 */
export async function listCompanies(options?: {
  activeOnly?: boolean;
}): Promise<Company[]> {
  const supabase = getTypedClient();

  let query = supabase
    .from("companies")
    .select("*")
    .order("name", { ascending: true });

  if (options?.activeOnly) {
    query = query.eq("is_active", true);
  }

  const { data, error } = await query;

  if (error) {
    console.error("[supabaseCompanies] List error:", error);
    throw new Error(`ไม่สามารถดึงรายการบริษัทได้: ${error.message}`);
  }

  const rows: CompanyRow[] = data ?? [];

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    code: row.code ?? null,
    logoUrl: row.logo_url ?? null,
    description: row.description ?? null,
    primaryColor: row.primary_color ?? "#3b82f6",
    secondaryColor: row.secondary_color ?? "#0ea5e9",
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
}

/**
 * Get single company by ID
 */
export async function getCompanyById(id: string): Promise<Company | null> {
  const supabase = getTypedClient();

  const { data, error } = await supabase
    .from("companies")
    .select("*")
    .eq("id", id)
    .single();

  if (error) {
    console.error("[supabaseCompanies] Get by ID error:", error);
    return null;
  }

  if (!data) return null;

  const row = data as CompanyRow;

  return {
    id: row.id,
    name: row.name,
    code: row.code ?? null,
    logoUrl: row.logo_url ?? null,
    description: row.description ?? null,
    primaryColor: row.primary_color ?? "#3b82f6",
    secondaryColor: row.secondary_color ?? "#0ea5e9",
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * Create a new company
 */
export async function createCompany(input: CompanyInsert): Promise<Company> {
  const supabase = getTypedClient();

  const now = new Date().toISOString();

  const payload = {
    name: input.name.trim(),
    code: input.code?.trim() || null,
    logo_url: input.logoUrl || null,
    description: input.description?.trim() || null,
    primary_color: input.primaryColor || "#3b82f6",
    secondary_color: input.secondaryColor || "#0ea5e9",
    is_active: input.isActive ?? true,
    created_at: now,
    updated_at: now,
  };

  const { data, error } = await supabase
    .from("companies")
    .insert(payload)
    .select()
    .single();

  if (error) {
    console.error("[supabaseCompanies] Create error:", error);

    // Check for unique constraint violations
    if (error.code === "23505") {
      if (error.message.includes("companies_name_key")) {
        throw new Error("ชื่อบริษัทนี้มีอยู่แล้ว กรุณาใช้ชื่ออื่น");
      }
      if (error.message.includes("companies_code_key")) {
        throw new Error("รหัสบริษัทนี้มีอยู่แล้ว กรุณาใช้รหัสอื่น");
      }
    }

    throw new Error(`ไม่สามารถสร้างบริษัทได้: ${error.message}`);
  }

  const row = data as CompanyRow;

  return {
    id: row.id,
    name: row.name,
    code: row.code ?? null,
    logoUrl: row.logo_url ?? null,
    description: row.description ?? null,
    primaryColor: row.primary_color ?? "#3b82f6",
    secondaryColor: row.secondary_color ?? "#0ea5e9",
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * Update an existing company
 */
export async function updateCompany(
  id: string,
  input: CompanyUpdate
): Promise<Company> {
  const supabase = getTypedClient();

  const payload: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  if (input.name !== undefined) {
    payload.name = input.name.trim();
  }
  if (input.code !== undefined) {
    payload.code = input.code?.trim() || null;
  }
  if (input.logoUrl !== undefined) {
    payload.logo_url = input.logoUrl || null;
  }
  if (input.description !== undefined) {
    payload.description = input.description?.trim() || null;
  }
  if (input.primaryColor !== undefined) {
    payload.primary_color = input.primaryColor;
  }
  if (input.secondaryColor !== undefined) {
    payload.secondary_color = input.secondaryColor;
  }
  if (input.isActive !== undefined) {
    payload.is_active = input.isActive;
  }

  const { data, error } = await supabase
    .from("companies")
    .update(payload)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    console.error("[supabaseCompanies] Update error:", error);

    // Check for unique constraint violations
    if (error.code === "23505") {
      if (error.message.includes("companies_name_key")) {
        throw new Error("ชื่อบริษัทนี้มีอยู่แล้ว กรุณาใช้ชื่ออื่น");
      }
      if (error.message.includes("companies_code_key")) {
        throw new Error("รหัสบริษัทนี้มีอยู่แล้ว กรุณาใช้รหัสอื่น");
      }
    }

    throw new Error(`ไม่สามารถอัปเดตบริษัทได้: ${error.message}`);
  }

  const row = data as CompanyRow;

  return {
    id: row.id,
    name: row.name,
    code: row.code ?? null,
    logoUrl: row.logo_url ?? null,
    description: row.description ?? null,
    primaryColor: row.primary_color ?? "#3b82f6",
    secondaryColor: row.secondary_color ?? "#0ea5e9",
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * Delete a company (only if no products reference it)
 */
export async function deleteCompany(id: string): Promise<void> {
  const supabase = getTypedClient();

  // Check if any products reference this company
  const { data: products, error: checkError } = await supabase
    .from("products")
    .select("id")
    .eq("company_id", id)
    .limit(1);

  if (checkError) {
    console.error("[supabaseCompanies] Delete check error:", checkError);
    throw new Error("ไม่สามารถตรวจสอบสินค้าที่เชื่อมโยงได้");
  }

  if (products && products.length > 0) {
    throw new Error(
      "ไม่สามารถลบบริษัทนี้ได้ เนื่องจากมีสินค้าที่เชื่อมโยงอยู่ กรุณาลบหรือย้ายสินค้าก่อน"
    );
  }

  const { error } = await supabase
    .from("companies")
    .delete()
    .eq("id", id);

  if (error) {
    console.error("[supabaseCompanies] Delete error:", error);
    throw new Error(`ไม่สามารถลบบริษัทได้: ${error.message}`);
  }
}

/**
 * Get count of products per company
 */
export async function getCompanyProductCounts(): Promise<
  Map<string, number>
> {
  const supabase = getTypedClient();

  const { data, error } = await supabase
    .from("products")
    .select("company_id");

  if (error) {
    console.error("[supabaseCompanies] Product count error:", error);
    return new Map();
  }

  const counts = new Map<string, number>();

  for (const row of data ?? []) {
    const companyId = (row as { company_id: string | null }).company_id;
    if (companyId) {
      counts.set(companyId, (counts.get(companyId) || 0) + 1);
    }
  }

  return counts;
}

/**
 * Toggle company active status
 */
export async function toggleCompanyActive(
  id: string,
  isActive: boolean
): Promise<Company> {
  return updateCompany(id, { isActive });
}
