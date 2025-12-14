import { NextResponse } from "next/server";
import * as supabaseCompanies from "@/lib/supabaseCompanies";
import * as supabaseLogs from "@/lib/supabaseLogs";
import { getSupabaseServiceClient } from "@/lib/supabaseClient";
import type { CompanyInsert, CompanyUpdate } from "@/lib/supabaseCompanies";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Helper: Upload logo to Supabase Storage
 */
async function uploadLogoToStorage(logoData: string): Promise<string> {
  const supabase = getSupabaseServiceClient();

  // Extract base64 data and mime type
  const matches = logoData.match(/^data:([^;]+);base64,(.+)$/);
  if (!matches) {
    throw new Error("Invalid logo data format");
  }

  const mimeType = matches[1];
  const base64Data = matches[2];
  const extension = mimeType.split("/")[1] || "png";

  // Generate unique filename
  const timestamp = Date.now();
  const filename = `company-logo-${timestamp}.${extension}`;

  // Convert base64 to Buffer
  const buffer = Buffer.from(base64Data, "base64");

  // Upload to Supabase Storage
  const { data, error } = await supabase.storage
    .from("company-logos")
    .upload(filename, buffer, {
      contentType: mimeType,
      cacheControl: "3600",
      upsert: false,
    });

  if (error) {
    console.error("[uploadLogo] Storage error:", error);
    throw new Error("ไม่สามารถอัปโหลดโลโก้ได้");
  }

  // Get public URL
  const { data: urlData } = supabase.storage
    .from("company-logos")
    .getPublicUrl(data.path);

  return urlData.publicUrl;
}

/**
 * GET /api/admin/companies
 * List all companies with optional filters
 */
export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const activeOnly = url.searchParams.get("activeOnly") === "true";

    const companies = await supabaseCompanies.listCompanies({ activeOnly });
    const productCounts = await supabaseCompanies.getCompanyProductCounts();

    // Enrich companies with product counts
    const enrichedCompanies = companies.map((company) => ({
      ...company,
      productCount: productCounts.get(company.id) || 0,
    }));

    return NextResponse.json({
      ok: true,
      companies: enrichedCompanies,
    });
  } catch (error) {
    console.error("[API] GET /api/admin/companies error:", error);
    return NextResponse.json(
      {
        ok: false,
        message: error instanceof Error ? error.message : "ไม่สามารถดึงรายการบริษัทได้",
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/companies
 * Create or update a company
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { id, logoData, ...data } = body as {
      id?: string;
      logoData?: string;
    } & (CompanyInsert | CompanyUpdate);

    // Upload new logo if provided
    if (logoData) {
      try {
        const uploadedUrl = await uploadLogoToStorage(logoData);
        data.logoUrl = uploadedUrl;
      } catch (uploadError) {
        console.error("[API] Logo upload failed:", uploadError);
        return NextResponse.json(
          {
            ok: false,
            message: uploadError instanceof Error ? uploadError.message : "ไม่สามารถอัปโหลดโลโก้ได้",
          },
          { status: 500 }
        );
      }
    }

    let company;
    let action: string;

    if (id) {
      // Update existing company
      company = await supabaseCompanies.updateCompany(id, data as CompanyUpdate);
      action = "update";

      await supabaseLogs.addLog({
        timestamp: new Date().toISOString(),
        scope: "system",
        action: "update",
        details: `อัปเดตบริษัท: ${company.name}`,
        metadata: {
          companyId: company.id,
          companyName: company.name,
        },
      });
    } else {
      // Create new company
      company = await supabaseCompanies.createCompany(data as CompanyInsert);
      action = "create";

      await supabaseLogs.addLog({
        timestamp: new Date().toISOString(),
        scope: "system",
        action: "create",
        details: `สร้างบริษัทใหม่: ${company.name}`,
        metadata: {
          companyId: company.id,
          companyName: company.name,
        },
      });
    }

    return NextResponse.json({
      ok: true,
      company,
      message: action === "create" ? "สร้างบริษัทสำเร็จ" : "อัปเดตบริษัทสำเร็จ",
    });
  } catch (error) {
    console.error("[API] POST /api/admin/companies error:", error);
    return NextResponse.json(
      {
        ok: false,
        message: error instanceof Error ? error.message : "ไม่สามารถบันทึกข้อมูลบริษัทได้",
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/admin/companies
 * Delete a company (only if no products reference it)
 */
export async function DELETE(request: Request) {
  try {
    const body = await request.json();
    const { id } = body as { id: string };

    if (!id) {
      return NextResponse.json(
        { ok: false, message: "กรุณาระบุ ID ของบริษัทที่ต้องการลบ" },
        { status: 400 }
      );
    }

    // Get company name before deletion
    const company = await supabaseCompanies.getCompanyById(id);
    const companyName = company?.name || "Unknown";

    await supabaseCompanies.deleteCompany(id);

    await supabaseLogs.addLog({
      timestamp: new Date().toISOString(),
      scope: "system",
      action: "delete",
      details: `ลบบริษัท: ${companyName}`,
      metadata: {
        companyId: id,
        companyName,
      },
    });

    return NextResponse.json({
      ok: true,
      message: "ลบบริษัทสำเร็จ",
    });
  } catch (error) {
    console.error("[API] DELETE /api/admin/companies error:", error);
    return NextResponse.json(
      {
        ok: false,
        message: error instanceof Error ? error.message : "ไม่สามารถลบบริษัทได้",
      },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/admin/companies
 * Toggle company active status
 */
export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const { id, isActive } = body as { id: string; isActive: boolean };

    if (!id) {
      return NextResponse.json(
        { ok: false, message: "กรุณาระบุ ID ของบริษัท" },
        { status: 400 }
      );
    }

    const company = await supabaseCompanies.toggleCompanyActive(id, isActive);

    await supabaseLogs.addLog({
      timestamp: new Date().toISOString(),
      scope: "system",
      action: "update",
      details: `${isActive ? "เปิด" : "ปิด"}การใช้งานบริษัท: ${company.name}`,
      metadata: {
        companyId: company.id,
        companyName: company.name,
        isActive,
      },
    });

    return NextResponse.json({
      ok: true,
      company,
      message: `${isActive ? "เปิด" : "ปิด"}การใช้งานบริษัทสำเร็จ`,
    });
  } catch (error) {
    console.error("[API] PATCH /api/admin/companies error:", error);
    return NextResponse.json(
      {
        ok: false,
        message: error instanceof Error ? error.message : "ไม่สามารถเปลี่ยนสถานะบริษัทได้",
      },
      { status: 500 }
    );
  }
}
