/**
 * Supabase Categories Operations
 *
 * This module handles all category operations via Supabase categories table
 * Replaces filesystem-based storage from data/app-data.json
 */

import { getSupabaseServiceClient } from "./supabaseClient";
import type { Database } from "@/types/supabase";

type CategoryInsert = Database["public"]["Tables"]["categories"]["Insert"];
type CategoryUpdate = Database["public"]["Tables"]["categories"]["Update"];

export interface Category {
  id: string;
  name: string;
  color: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Get all categories
 */
export async function getCategories(): Promise<Category[]> {
  const supabase = getSupabaseServiceClient();

  const { data, error } = await supabase
    .from("categories")
    .select("*")
    .order("name", { ascending: true });

  if (error) {
    console.error("[supabaseCategories] Failed to fetch categories:", error);
    throw new Error(`ไม่สามารถโหลดหมวดหมู่ได้: ${error.message}`);
  }

  return (data ?? []).map((row) => ({
    id: row.id,
    name: row.name,
    color: row.color,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
}

/**
 * Get a single category by ID
 */
export async function getCategory(id: string): Promise<Category | null> {
  const supabase = getSupabaseServiceClient();

  const { data, error } = await supabase
    .from("categories")
    .select("*")
    .eq("id", id)
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      return null; // Not found
    }
    console.error("[supabaseCategories] Failed to fetch category:", error);
    throw new Error(`ไม่สามารถโหลดหมวดหมู่ได้: ${error.message}`);
  }

  return {
    id: data.id,
    name: data.name,
    color: data.color,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  };
}

/**
 * Create a new category
 */
export async function createCategory(input: {
  name: string;
  color: string;
}): Promise<Category> {
  const supabase = getSupabaseServiceClient();

  // Validate name is unique
  const existing = await supabase
    .from("categories")
    .select("id")
    .eq("name", input.name)
    .single();

  if (existing.data) {
    throw new Error(`หมวดหมู่ "${input.name}" มีอยู่แล้ว`);
  }

  const insertData: CategoryInsert = {
    name: input.name,
    color: input.color,
  };

  const { data, error } = await supabase
    .from("categories")
    .insert(insertData)
    .select()
    .single();

  if (error) {
    console.error("[supabaseCategories] Failed to create category:", error);
    throw new Error(`ไม่สามารถสร้างหมวดหมู่ได้: ${error.message}`);
  }

  return {
    id: data.id,
    name: data.name,
    color: data.color,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  };
}

/**
 * Update an existing category
 */
export async function updateCategory(
  id: string,
  input: Partial<{ name: string; color: string }>
): Promise<Category> {
  const supabase = getSupabaseServiceClient();

  // If name is being updated, check uniqueness
  if (input.name) {
    const existing = await supabase
      .from("categories")
      .select("id")
      .eq("name", input.name)
      .neq("id", id)
      .single();

    if (existing.data) {
      throw new Error(`หมวดหมู่ "${input.name}" มีอยู่แล้ว`);
    }
  }

  const updateData: CategoryUpdate = {
    ...(input.name && { name: input.name }),
    ...(input.color && { color: input.color }),
  };

  const { data, error } = await supabase
    .from("categories")
    .update(updateData)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    console.error("[supabaseCategories] Failed to update category:", error);
    throw new Error(`ไม่สามารถอัปเดตหมวดหมู่ได้: ${error.message}`);
  }

  return {
    id: data.id,
    name: data.name,
    color: data.color,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  };
}

/**
 * Delete a category
 */
export async function deleteCategory(id: string): Promise<void> {
  const supabase = getSupabaseServiceClient();

  const { error } = await supabase.from("categories").delete().eq("id", id);

  if (error) {
    console.error("[supabaseCategories] Failed to delete category:", error);
    throw new Error(`ไม่สามารถลบหมวดหมู่ได้: ${error.message}`);
  }
}
