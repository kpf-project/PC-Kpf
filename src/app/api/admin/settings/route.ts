import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServiceClient } from "@/lib/supabaseClient";
import { withTelemetrySpan } from "@/lib/observability";

/**
 * GET /api/admin/settings
 * Retrieve all application settings from Supabase
 */
export async function GET() {
  return withTelemetrySpan("GET /api/admin/settings", async () => {
    try {
      const supabase = getSupabaseServiceClient();

      // Fetch all settings from app_settings table
      // Using 'any' cast to bypass TypeScript type checking for new table not yet in generated types
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any)
        .from("app_settings")
        .select("key, value")
        .order("key", { ascending: true });

      if (error) {
        console.error("Error fetching settings:", error);
        return NextResponse.json(
          { error: "Failed to fetch settings", details: error.message },
          { status: 500 }
        );
      }

      // Transform array of {key, value} into a flat object
      // e.g., [{key: "signature_name", value: "John"}] -> {signature_name: "John"}
      const settings: Record<string, unknown> = {};
      for (const row of data || []) {
        // JSONB value is already parsed by Supabase client
        settings[row.key] = row.value;
      }

      return NextResponse.json(settings, { status: 200 });
    } catch (error) {
      console.error("Unexpected error in GET /api/admin/settings:", error);
      return NextResponse.json(
        {
          error: "Internal server error",
          details: error instanceof Error ? error.message : "Unknown error",
        },
        { status: 500 }
      );
    }
  });
}

/**
 * PUT /api/admin/settings
 * Update application settings in Supabase
 * Body: { key: string, value: any }
 */
export async function PUT(request: NextRequest) {
  return withTelemetrySpan("PUT /api/admin/settings", async () => {
    try {
      const body = await request.json();
      const { key, value } = body;

      // Validate input
      if (typeof key !== "string" || !key) {
        return NextResponse.json(
          { error: "Invalid input: 'key' must be a non-empty string" },
          { status: 400 }
        );
      }

      if (value === undefined) {
        return NextResponse.json(
          { error: "Invalid input: 'value' is required" },
          { status: 400 }
        );
      }

      const supabase = getSupabaseServiceClient();

      // Upsert setting (insert or update)
      // Using 'any' cast to bypass TypeScript type checking for new table not yet in generated types
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any)
        .from("app_settings")
        .upsert(
          {
            key,
            value: value as never, // Cast to 'never' to satisfy JSONB type
          },
          {
            onConflict: "key",
          }
        )
        .select()
        .single();

      if (error) {
        console.error("Error upserting setting:", error);
        return NextResponse.json(
          { error: "Failed to update setting", details: error.message },
          { status: 500 }
        );
      }

      return NextResponse.json(
        {
          success: true,
          message: "Setting updated successfully",
          data: {
            key: data.key,
            value: data.value,
            updated_at: data.updated_at,
          },
        },
        { status: 200 }
      );
    } catch (error) {
      console.error("Unexpected error in PUT /api/admin/settings:", error);
      return NextResponse.json(
        {
          error: "Internal server error",
          details: error instanceof Error ? error.message : "Unknown error",
        },
        { status: 500 }
      );
    }
  });
}
