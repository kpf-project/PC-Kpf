# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is an **Attendance Tracker PWA** - a comprehensive employee management system for sales teams in Thailand. It combines attendance tracking, sales recording, inventory management, and analytics in a Progressive Web App built with Next.js 15, TypeScript, and Supabase.

**Core Features:**
- PIN-based authentication with role-based access control (employee/sales/admin/super_admin)
- Attendance tracking with GPS coordinates and mandatory photo capture
- Sales recording with multi-unit support (box/pack/piece/drum/sachet)
- Stock/inventory management with FIFO tracking
- PC Daily reports (customer activity, shelf photos, promotions)
- Comprehensive admin dashboard with real-time KPIs and analytics
- PWA with auto-update notifications showing Thai changelog

**Tech Stack:**
- Next.js 15 (App Router) with Turbopack
- TypeScript (strict mode)
- Supabase (PostgreSQL database + storage + realtime)
- Tailwind CSS v4
- TanStack React Query v5
- bcryptjs for PIN hashing
- Recharts for data visualization
- Leaflet + React-Leaflet for maps
- Discord Webhooks for support notifications
- next-pwa for PWA capabilities
- Framer Motion for animations
- ExcelJS for report exports

## Development Commands

**Prerequisites:**
- Node.js v20.x or v22.x (tested with v22.19.0)
- npm v9+ or v10+

```bash
# Development
npm run dev              # Start dev server with Turbopack (http://localhost:3000)

# Build & Production
npm run build            # Production build with Turbopack (~3-5 min in WSL, ~30s native)
npm run start            # Serve production bundle

# Type Checking
npx tsc --noEmit        # Type check without emitting files (must pass with 0 errors)

# Linting
npm run lint            # Run ESLint (must pass before commits)

# Supabase Type Generation
npm run gen:types       # Generate TypeScript types from Supabase schema
                        # Output: src/types/supabase.ts
                        # Run after any database migration

# Dependency Management
npm install              # Install/update dependencies
npm install --force      # Force reinstall (use when native modules fail)
npm rebuild lightningcss # Rebuild native module after WSL issues
```

## Critical Architecture Patterns

### 1. Data Storage Migration Strategy (IMPORTANT!)

**✅ Migration to Supabase is COMPLETE!** All primary data is now stored in Supabase.

- **Historical Context:** Originally used `data/app-data.json` for all data storage
- **Current State:** **All data now persists in Supabase** (Netlify has read-only filesystem)
- **Legacy Support:** `configStore.ts` still reads from JSON for backward compatibility but returns empty arrays for migrated data types

**Migration Status:**

| Data Type | Storage | API Module | Status |
|-----------|---------|------------|---------|
| Employees | Supabase | `supabaseDirectory.ts` | ✅ Complete |
| Stores | Supabase | `supabaseDirectory.ts` | ✅ Complete |
| Products | Supabase | `supabaseProducts.ts` | ✅ Complete |
| Product Units | Supabase | `supabaseProducts.ts` | ✅ Complete |
| Product Assignments | Supabase | `supabaseProducts.ts` | ✅ Complete |
| Categories | Supabase | `supabaseCategories.ts` | ✅ Complete |
| Leaves | Supabase | `supabaseLeaves.ts` | ✅ Complete |
| Day Off Swaps | Supabase | `supabaseDayOffSwaps.ts` | ✅ Complete |
| Branding | Supabase | `supabaseBranding.ts` | ✅ Complete |
| Logs | Supabase | `supabaseLogs.ts` | ✅ Complete |
| Attendance | Supabase | Direct API calls | ✅ Complete |
| Sales | Supabase | Direct API calls | ✅ Complete |
| Photos | Supabase | `supabasePhotos.ts` | ✅ Complete |
| Companies | Supabase | `supabaseCompanies.ts` | ✅ Complete |

**Latest Migrations:** 001-032 (see `migrations/` directory or database directly)
- Migration 032: Performance indexes for batch queries and reports
- Migration 031: Stock-to-batches migration - CRITICAL architectural change (see below)
- Migration 030: Add submission_id for form tracking
- Migration 029: Batch management improvements - FEFO system and status tracking
- Migration 028: Fix NULL balance_after in stock transactions
- Migration 024: Server-side session system - replaces cookie-only auth for security
- Migration 022: Stock base unit system - critical architectural change
- Migration 020: Performance indexes for reports
- Migration 019: Initial stock transaction type
- Migration 018: Multi-company management

**Key Files:**
- `src/lib/configStore.ts` - Legacy data store (deprecated for most operations)
- `src/lib/supabaseClient.ts` - Supabase client factory (service role)
- `src/lib/authSessions.ts` - Server-side session management (Migration 024)
- `src/lib/pinAuth.ts` - PIN authentication and verification
- `src/lib/supabaseDirectory.ts` - Employee/store Supabase operations
- `src/lib/supabase*.ts` - Domain-specific Supabase modules:
  - `supabaseProducts.ts` - Products, units, and assignments CRUD
  - `supabaseCategories.ts` - Product categories CRUD
  - `supabaseBranding.ts` - Company branding settings
  - `supabaseExpenses.ts` - Expense baseline management
  - `supabaseLeaves.ts` - Leave request operations
  - `supabaseDayOffSwaps.ts` - Day off swap request operations
  - `supabaseEmployeeStores.ts` - Employee-store assignments
  - `supabaseLogs.ts` - Application logging to database
  - `supabaseBackup.ts` - Automated backup and snapshot management
  - `supabasePhotos.ts` - Photo gallery and attendance photo operations
  - `supabaseCompanies.ts` - Multi-company management with branding
- `src/lib/apiAuth.ts` - API authentication helpers for route protection
- `src/lib/apiResponse.ts` - Standardized API response formatting
- `src/lib/batchGrouping.ts` - Batch management grouping and sorting logic
- `src/lib/lotNumberGenerator.ts` - LOT number generation for batch tracking
- `src/lib/ocrDateExtractor.ts` - OCR-based expiry date extraction from photos
- `src/lib/queryCache.ts` - Query result caching for performance optimization

**When adding new features:**
1. **Always** store data in Supabase tables (create migrations first)
2. Use `getSupabaseServiceClient()` for server-side operations
3. **Never** use JSON files (`data/app-data.json`) for data persistence
4. Use domain-specific modules (`supabase*.ts`) instead of `configStore.ts`
5. Use logging via `src/lib/supabaseLogs.ts` instead of local files

### 2. Authentication Architecture

**PIN-Based System with Server-Side Sessions (Migration 024):**
- 4-6 digit numeric PINs (bcrypt hashed, 10 rounds)
- Rate limiting: 5 failed attempts → 15 minute lockout
- Roles: `employee` | `sales` | `admin` | `super_admin`
- **Security:** Database-backed sessions prevent role forgery (replaced cookie-only auth)
- Session tokens: 64-char cryptographic random strings (HTTP-only cookies, 24h duration)

**Key Tables:**
- `user_pins` - PIN hashes, roles, employee associations
- `auth_sessions` - Server-side session storage (single source of truth)
- `auth_audit_logs` - All login attempts (success/failure)
- `auth_rate_limits` - Failed attempt tracking and lockout state

**Auth Flow:**
1. User enters PIN → `/api/auth/login`
2. Check rate limit in `auth_rate_limits`
3. Verify PIN via `src/lib/pinAuth.ts` (bcrypt.compare)
4. Log attempt in `auth_audit_logs`
5. **Create session in database** via `src/lib/authSessions.ts`
6. Set session token in HTTP-only cookie
7. Redirect based on role

**Session Management:**
```typescript
import * as authSessions from '@/lib/authSessions';

// Create session (login)
const session = await authSessions.createSession({
  userId: user.id,
  role: user.role,
  employeeId: user.employeeId
}, { ipAddress, userAgent });

// Verify session (on every API request)
const sessionData = await authSessions.verifySession(sessionToken);
if (!sessionData) {
  // Invalid or expired - require re-login
}

// Delete session (logout)
await authSessions.deleteSession(sessionToken);

// Cleanup expired sessions (cron job)
await authSessions.cleanupExpiredSessions();
```

**Database RPC Functions:**
- `verify_session(p_session_token)` - Atomic verification + activity update + auto-cleanup
- `cleanup_expired_sessions()` - Delete all expired sessions (run periodically)

**Context & Hooks:**
- `src/contexts/AuthContext.tsx` - Client-side auth state
- `src/contexts/ModalContext.tsx` - Global modal state (controls header positioning)
- `src/hooks/useSupabaseRealtime.ts` - Real-time dashboard updates hook
- Server-side auth verification in API routes via `authSessions.verifySession()`

### 3. Database Schema Fundamentals

**Primary Entities:**

```sql
-- Attendance tracking
attendance_records (recorded_date, recorded_time, status, employee_id, store_id, photo_public_url, latitude, longitude, subdistrict, district, province)

-- Sales recording
sales_records (recorded_date, recorded_time, employee_id, store_id, product_id, unit_id, quantity, unit_price, total_price, price_type)

-- Inventory management (Migration 022: Base Unit System)
stock_inventory (employee_id, store_id, product_id, quantity)  -- quantity always in base unit (legacy, see batch system)
stock_transactions (type, quantity, balance_after, sale_record_id, unit_id)  -- unit_id kept for audit

-- Batch management (Migration 029, 031: FEFO System - CURRENT PRIMARY SYSTEM)
stock_batches (employee_id, store_id, product_id, lot_number, expiry_date, initial_quantity, remaining_quantity, notes, created_at, updated_at)
stock_batches_with_status (VIEW) -- Computed batch_status, days_until_expiry, expiry_status, utilization_percentage
-- Migration 031 migrated all stock_inventory data to stock_batches with auto-generated LOT numbers

-- Master data
employees (name, employee_code, phone, province, region, regular_day_off, active_status)
stores (name, code, province, latitude, longitude, radius)
products (name, code, category_id, active_status)
product_units (product_id, name, sku, is_base_unit, base_unit_multiplier)

-- Product assignment (which employees can sell which products at which stores)
product_assignments (employee_id, product_id, store_id, is_global)
product_assignment_units (assignment_id, unit_id, price_pc, price_company)

-- PC Daily reports
pc_daily_reports (employee_id, store_id, report_date, customer_activity, notes)
pc_shelf_photos (report_id, photo_url, photo_path, notes)
pc_stock_usage (report_id, product_id, quantity_used)

-- Monthly targets
monthly_sales_targets (employee_id, year, month, target_amount, notes)

-- Support system
support_messages (type, message, user_name, user_id, user_role, context_url, status, admin_notes)

-- Leave management
leave_requests (employee_id, leave_type, start_date, end_date, reason, status, reviewed_by)

-- Day off swaps (swap regular day-off or holidays with working days)
day_off_swaps (employee_id, work_on_date, off_on_date, swap_type, reason, status, reviewed_by)

-- Branding & customization
branding_settings (company_name, logo_url, primary_color, secondary_color, dark_mode_enabled)

-- Multi-company management (added in migration 018)
companies (name, code, logo_url, description, primary_color, secondary_color, is_active)
-- products.company_id links to companies for multi-company product catalog

-- Server-side sessions (added in migration 024)
auth_sessions (session_token, user_id, user_role, employee_id, created_at, expires_at, last_activity_at, ip_address, user_agent)
-- Replaces client-side cookies with database-backed sessions for security
```

**Critical Constraints:**
- `stock_inventory.quantity` has CHECK (quantity >= 0) - cannot go negative
- Foreign keys everywhere with CASCADE deletes where appropriate
- Timestamps: use `recorded_date` (YYYY-MM-DD) + `recorded_time` (HH:MM:SS) for business records

### 4. API Route Patterns

**File Locations:**
- `src/app/api/attendance/route.ts` - POST attendance records
- `src/app/api/sales/route.ts` - POST sales records
- `src/app/api/stock/route.ts` - POST stock transactions
- `src/app/api/auth/[action]/route.ts` - Authentication endpoints
- `src/app/api/admin/*` - Admin-only operations (branding, reports, data management)

**Standard Pattern:**
```typescript
import { cookies } from 'next/headers';
import * as authSessions from '@/lib/authSessions';
import * as supabaseLogs from '@/lib/supabaseLogs';
import { getSupabaseServiceClient } from '@/lib/supabaseClient';

export async function POST(request: Request) {
  try {
    // 1. Verify authentication (for protected routes)
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get('session')?.value;

    if (!sessionToken) {
      return Response.json(
        { success: false, error: 'ไม่พบ session' },
        { status: 401 }
      );
    }

    const session = await authSessions.verifySession(sessionToken);
    if (!session) {
      return Response.json(
        { success: false, error: 'Session หมดอายุ' },
        { status: 401 }
      );
    }

    // 2. Parse and validate input
    const body = await request.json();

    // 3. Get Supabase client
    const supabase = getSupabaseServiceClient();

    // 4. Insert/update data
    const { data, error } = await supabase
      .from('table_name')
      .insert(payload)
      .select()
      .single();

    if (error) throw error;

    // 5. Log the action
    await supabaseLogs.addLog({
      timestamp: new Date().toISOString(),
      scope: 'attendance',
      action: 'create',
      details: 'บันทึกเวลาเข้างาน',
      metadata: { recordId: data.id, userId: session.userId }
    });

    // 6. Return success
    return Response.json({ success: true, data });

  } catch (error) {
    console.error('[API] error:', error);
    return Response.json(
      { success: false, error: 'เกิดข้อผิดพลาด' },
      { status: 500 }
    );
  }
}
```

### 5. Frontend Component Organization

**App Router Structure:**
```
src/app/
├── page.tsx                    # Landing/attendance tracking
├── sales/page.tsx              # Sales recording form
├── stock/page.tsx              # Stock management
├── pc-report/page.tsx          # PC Daily report form
├── login/page.tsx              # PIN authentication
└── admin/                      # Admin dashboard & CMS
    ├── page.tsx                # Main dashboard with KPIs
    ├── reports/                # All analytics reports
    │   ├── attendance/
    │   ├── sales/
    │   ├── sales-comparison/
    │   ├── products/
    │   ├── individual/
    │   ├── roi/
    │   ├── pc-daily/
    │   ├── photos/             # Photo gallery report
    │   └── stock-movement/
    ├── employees/              # Employee management
    ├── stores/                 # Store management
    ├── products/               # Product management
    ├── categories/             # Category management
    ├── leaves/                 # Leave request management
    ├── day-off-swaps/          # Day off swap management
    ├── user-pins/              # PIN & role management
    ├── logs/                   # Activity logs
    └── settings/               # System settings
        └── companies/          # Multi-company management
```

**Component Naming Conventions:**
- Page files: `page.tsx` (Next.js convention)
- Client components: `*Client.tsx` (e.g., `SalesReportPageClient.tsx`)
- Sections: `*Section.tsx` (e.g., `EmployeesSection.tsx`)
- Shared components: `src/components/*` (e.g., `UpdatePopup.tsx`, `PINKeypad.tsx`)

**Page Architecture Pattern:**
```typescript
// page.tsx (Server Component)
import ClientComponent from './ClientComponent';

export default function Page() {
  // Can fetch data server-side if needed
  return <ClientComponent />;
}

// ClientComponent.tsx (Client Component)
'use client';

import { useQuery } from '@tanstack/react-query';

export default function ClientComponent() {
  // All interactivity, state, and data fetching happens here
  const { data } = useQuery({
    queryKey: ['key'],
    queryFn: async () => {
      const res = await fetch('/api/endpoint');
      return res.json();
    }
  });

  return <div>...</div>;
}
```

**Data Fetching Pattern:**
- Use TanStack React Query for all API calls
- Query keys should be descriptive: `['sales', employeeId, dateRange]`
- Server Components only when truly static or SEO-critical
- Most pages use Client Components due to interactivity requirements

### 6. Type Safety & Supabase Types

**Generated Types:**
- `types/supabase.ts` - Auto-generated from Supabase schema
- `src/types/auth.ts` - Custom auth types and role helpers
- Regenerate after schema changes: `npm run gen:types`

**Usage Pattern:**
```typescript
import type { Database } from '@/types/supabase';

// Table row type
type SalesRecord = Database['public']['Tables']['sales_records']['Row'];

// Insert type
type SalesRecordInsert = Database['public']['Tables']['sales_records']['Insert'];

// Typed client
const supabase = getSupabaseServiceClient();
const { data, error } = await supabase
  .from('sales_records')
  .select('*')
  .returns<SalesRecord[]>();
```

**Never use `any` types.** If types are complex, define them explicitly in the relevant module.

**Role-Based Type Checking:**
```typescript
import { hasRequiredRole } from '@/types/auth';

// Check if user has admin access
if (!hasRequiredRole(user.role, 'admin')) {
  return Response.json({ error: 'Unauthorized' }, { status: 403 });
}
```

### 7. Timezone Handling

**Critical:** All business logic uses `Asia/Bangkok` timezone.

```typescript
const DASHBOARD_TIME_ZONE =
  process.env.APP_TIMEZONE?.trim() || 'Asia/Bangkok';

// Use Intl.DateTimeFormat for timezone-aware formatting
const formatter = new Intl.DateTimeFormat('th-TH', {
  timeZone: DASHBOARD_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit'
});

// Store dates as YYYY-MM-DD strings in database
// Store times as HH:MM:SS strings in database
// Use ISO strings for timestamps
```

### 8. Reverse Geocoding & Address Display

**Address Resolution:**
- `src/lib/geocoding.ts` - Reverse geocoding utilities using OpenStreetMap Nominatim API
- `src/lib/timestampFormat.ts` - Timestamp formatting with address display
- Automatically converts GPS coordinates to Thai addresses (ตำบล, อำเภอ, จังหวัด)
- Rate limit: 1 request/second (handled gracefully)

**Database Storage:**
```sql
-- attendance_records now includes address fields
subdistrict TEXT  -- ตำบล/แขวง
district TEXT     -- อำเภอ/เขต
province TEXT     -- จังหวัด
```

**Usage Pattern:**
```typescript
import { reverseGeocode } from '@/lib/geocoding';
import { formatTimestampWithAddress } from '@/lib/timestampFormat';

// During attendance recording
const address = await reverseGeocode(latitude, longitude);
// Returns: { subdistrict, district, province, fullAddress }

// When displaying photos
const timestamp = formatTimestampWithAddress({
  date: '2025-01-04',
  time: '09:30:00',
  subdistrict: 'หนองจ๊อม',
  district: 'สันทราย',
  province: 'เชียงใหม่'
});
// Output: "4 ม.ค. 68 09:30\nต.หนองจ๊อม อ.สันทราย จ.เชียงใหม่"
```

**Important Notes:**
- Geocoding happens at recording time (snapshot, not real-time query)
- Graceful fallback: if geocoding fails, attendance still records without address
- Backward compatible: old records without addresses display date/time only
- See `GEOCODING_USAGE.md` for detailed documentation

### 9. PWA Auto-Update System

**Version Management:**
- `public/version.json` - Current version, build date, Thai release notes
- `src/lib/serviceWorkerManager.ts` - Service worker registration & update detection
- `src/components/UpdatePopup.tsx` - Update notification UI

**Update Flow:**
1. Service worker checks `version.json` every 60 seconds
2. On version mismatch, shows Thai changelog popup
3. User clicks "อัปเดตเลย" → `window.location.reload()`
4. Service worker updates cache automatically

**Deployment:**
```bash
# 1. Update public/version.json with new version & Thai release notes
# 2. Commit & push to main branch
# 3. Netlify auto-deploys
# 4. Users see update popup within 60 seconds
```

### 10. iOS PWA Permissions (Verified 2025)

**Location Permission Behavior (Tested on Real Devices):**
- **Location permission is SHARED with Safari** (not separate)
- PWA does NOT have its own entry in Settings → Privacy & Security → Location Services
- All PWAs use the same location permission as Safari

**Permission Settings:**
```
Settings → Safari → Location → Allow/Ask
```

**What IS Separate in iOS 16.4+:**
- ✅ **Notifications** - PWAs get their own entry in Settings → Notifications
- ✅ **Badge** - Managed per PWA
- ❌ **Location** - Still uses Safari's permission (verified)
- ❌ **Camera/Microphone** - Still uses Safari's permission

**Permission Flow:**
1. **Location Request**: App requests → iOS shows Safari permission prompt
2. **If Denied**: Go to Settings → Safari → Location → Allow/Ask
3. **After Changing**: Refresh page or restart app to trigger new request

**Implementation:**
- Permission request handled by `src/lib/useGeoPermission.ts`
- User guidance provided by `PermissionHelpModal` in `src/app/page.tsx`
- iOS detection: `/iPhone|iPad|iPod/.test(navigator.userAgent)`
- Help modal shows correct path: Settings → Safari → Location

**Key Differences by Permission Type:**
```
Permission Type    iOS Behavior                    Settings Location
─────────────────  ─────────────────────────────  ─────────────────────────
Location           Uses Safari permission (shared) Settings → Safari
Notifications      Separate per PWA (iOS 16.4+)   Settings → Notifications → [App Name]
Camera/Mic         Uses Safari permission (shared) Settings → Safari
Storage/IndexedDB  Per-origin (separate)          Not in Settings
```

**User Instructions (Thai):**
- Implemented in `PermissionHelpModal` component
- iOS section highlighted with orange gradient background
- Provides correct path: Settings → Safari → Location
- Includes note that only Notifications has separate entry

## Common Development Patterns

### Adding a New Migration

```bash
# 1. Create migration file (next number in sequence)
touch migrations/025_add_feature_name.sql

# 2. Write SQL with header
-- Migration 025: Add feature_name
-- Description: What this migration does
-- Date: YYYY-MM-DD

CREATE TABLE IF NOT EXISTS public.feature_name (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- columns here
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add RLS policies
ALTER TABLE public.feature_name ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read their own data"
  ON public.feature_name FOR SELECT
  USING (employee_id = auth.uid()::text);

-- Add indexes for performance
CREATE INDEX idx_feature_name_lookup ON public.feature_name(employee_id);

-- Add comments for documentation
COMMENT ON TABLE public.feature_name IS 'Description of table purpose';

# 3. Run in Supabase SQL Editor
# 4. Regenerate types: npm run gen:types
# 5. Test queries and verify RLS policies work correctly
```

### Adding a New Report

```typescript
// 1. Create page: src/app/admin/reports/new-report/page.tsx
import NewReportPageClient from './NewReportPageClient';

export default function NewReportPage() {
  return <NewReportPageClient />;
}

// 2. Create client component: NewReportPageClient.tsx
'use client';

import { useQuery } from '@tanstack/react-query';

export default function NewReportPageClient() {
  const { data, isLoading } = useQuery({
    queryKey: ['new-report'],
    queryFn: async () => {
      const res = await fetch('/api/admin/reports/new-report');
      if (!res.ok) throw new Error('Failed to fetch');
      return res.json();
    }
  });

  // Render report UI
}

// 3. Create API route: src/app/api/admin/reports/new-report/route.ts
export async function GET(request: Request) {
  const supabase = getSupabaseServiceClient();

  // Query data
  const { data, error } = await supabase
    .from('sales_records')
    .select('*');

  if (error) throw error;

  return Response.json({ data });
}

// 4. Add to nav: src/app/admin/_components/AdminNav.tsx
```

### Working with Product Units

**Multi-unit System:**
- Each product can have multiple units (e.g., กล่อง, แพ็ค, ชิ้น)
- Each unit has a base multiplier (e.g., 1 กล่อง = 12 แพ็ค)
- Prices vary by unit and price type (PC vs Company)

**Example:**
```typescript
// Product: "น้ำดื่ม"
// Units:
// - กล่อง (box): base_unit_multiplier = 1, is_base_unit = true
// - แพ็ค (pack): base_unit_multiplier = 12, is_base_unit = false
// - ขวด (piece): base_unit_multiplier = 144, is_base_unit = false

// When recording sales:
// 1. User selects product + unit + quantity
// 2. Price looked up from product_assignment_units
// 3. Total = quantity * unit_price
// 4. Stock reduced by (quantity * base_unit_multiplier)
```

### Stock Management with Base Unit System

**Critical Architectural Change (Migration 022):**

The stock system uses a **Base Unit System** where all inventory is stored in a single base unit, enabling seamless cross-unit operations.

```typescript
// ❌ OLD: Stock stored per unit (caused cross-unit checking issues)
stock_inventory {
  employee_id, store_id, product_id,
  unit_id,    // ← Separated by unit
  quantity
}

// ✅ NEW: Stock stored in base unit only
stock_inventory {
  employee_id, store_id, product_id,
  quantity    // ← Always in base unit
}
```

**How it works:**
```typescript
// Product: "น้ำดื่ม" with units:
// - ลัง (box): multiplier_to_base = 24, is_base = false
// - แพ็ค (pack): multiplier_to_base = 3, is_base = false
// - ซอง (sachet): multiplier_to_base = 1, is_base = true

// 1. Receive 2 boxes
await supabase.rpc('add_stock_transaction', {
  p_unit_id: boxUnitId,
  p_quantity: 2,
  p_transaction_type: 'receive'
});
// Converts: 2 × 24 = 48 sachets
// stock_inventory.quantity = 48

// 2. Sell 2 packs (different unit!)
await supabase.rpc('add_stock_transaction', {
  p_unit_id: packUnitId,
  p_quantity: 2,
  p_transaction_type: 'sale'
});
// Converts: 2 × 3 = 6 sachets
// stock_inventory.quantity = 48 - 6 = 42

// 3. Display in human-readable format
import { smartDisplayStock } from '@/lib/stockUnitConversion';
const displayUnits = smartDisplayStock(42, productUnits);
// Returns: [{ unitName: "ลัง", count: 1 }, { unitName: "แพ็ค", count: 6 }]
// Display: "1 ลัง 6 แพ็ค"
```

**Key Utilities:**
- `src/lib/stockUnitConversion.ts` - Base unit conversion and smart display
- `src/hooks/useSmartStockDisplay.ts` - React hook for displaying stock
- Database RPC: `add_stock_transaction()` - Handles all conversions atomically
- Database RPC: `smart_display_stock()` - Server-side display formatting

**Benefits:**
✅ Cross-unit stock checking works correctly
✅ Automatic stock deduction when selling in any unit
✅ Human-readable display with smart unit breakdown
✅ Atomic operations via RPC functions
✅ Type-safe with generated Supabase types

**Important Notes:**
- Every product MUST have exactly one base unit (`is_base = true`)
- Stock transactions still record original `unit_id` for audit purposes
- `stock_inventory_backup_20250108` table exists as pre-migration backup
- See `docs/STOCK_BASE_UNIT_SYSTEM.md` for detailed documentation

**Batch Tracking (Migration 031):**

Starting with Migration 031, the system has migrated to a **batch-based inventory system** with FEFO (First Expired, First Out) tracking.

```typescript
// ✅ NEW: Batch-based inventory
stock_batches {
  id, employee_id, store_id, product_id,
  lot_number,           // Auto-generated or manual
  expiry_date,          // Product expiration date
  initial_quantity,     // Starting quantity in base unit
  remaining_quantity,   // Current quantity in base unit
  notes, created_at, updated_at
}

// View with computed fields
stock_batches_with_status {
  ...all stock_batches columns,
  batch_status,         // 'active' | 'depleted' | 'expired'
  days_until_expiry,    // Calculated days remaining
  expiry_status,        // 'good' | 'near_expiry' | 'expired'
  utilization_percentage // % used of initial quantity
}
```

**How Batch System Works:**
1. **Stock receives** create new batches with LOT numbers
2. **Sales deduct** from earliest-expiring active batches automatically (FEFO)
3. **Stock adjustments** can modify batch quantities
4. **Batch status** computed in real-time via database view

**Key Functions:**
- `get_available_stock_by_fefo()` - Returns batches ordered by expiry
- `deduct_stock_from_batches()` - Atomic FEFO deduction
- `generate_lot_number()` - Auto-generates unique LOT numbers

See `docs/BATCH_MANAGEMENT_STANDARDS.md` for detailed implementation guide.

### Working with Batch Management (Migration 031)

**Batch-Based Inventory Operations:**

```typescript
// 1. Receive stock with batch (creates new batch)
const supabase = getSupabaseServiceClient();

const { data: newBatch, error } = await supabase
  .from('stock_batches')
  .insert({
    employee_id: employeeId,
    store_id: storeId,
    product_id: productId,
    lot_number: generateLotNumber(), // or manual entry
    expiry_date: '2025-12-31',
    initial_quantity: 100,  // in base unit
    remaining_quantity: 100,
    notes: 'Initial stock'
  })
  .select()
  .single();

// 2. Query available stock (FEFO order)
const { data: batches } = await supabase
  .rpc('get_available_stock_by_fefo', {
    p_employee_id: employeeId,
    p_store_id: storeId,
    p_product_id: productId
  });
// Returns batches ordered by expiry_date ASC, filtered by active status

// 3. Deduct stock from batches (automatic FEFO)
const { data, error } = await supabase
  .rpc('deduct_stock_from_batches', {
    p_employee_id: employeeId,
    p_store_id: storeId,
    p_product_id: productId,
    p_quantity: 50  // in base unit - deducts from earliest-expiring batches
  });

// 4. Query batch status with computed fields
const { data: statusBatches } = await supabase
  .from('stock_batches_with_status')
  .select('*')
  .eq('employee_id', employeeId)
  .eq('store_id', storeId);
// Returns: batch_status, days_until_expiry, expiry_status, utilization_percentage
```

**Batch Status Logic:**
- `batch_status`: `'active'` (remaining > 0, not expired), `'depleted'` (remaining = 0), `'expired'` (past expiry_date)
- `expiry_status`: `'good'` (>30 days), `'near_expiry'` (7-30 days), `'expired'` (<7 days or past date)
- `days_until_expiry`: Calculated as `(expiry_date - CURRENT_DATE)`
- `utilization_percentage`: `((initial_quantity - remaining_quantity) / initial_quantity * 100)`

**Key Principles:**
1. All batch quantities are in **base unit** (consistent with Migration 022)
2. FEFO logic is **automatic** via database RPC functions
3. Batch status is **computed in real-time** via database view
4. LOT numbers are **unique per product-employee-store combination**
5. Manual adjustments can create "adjustment" batches with special LOT numbers

## Utility Scripts

**Data Migration Script:**
```bash
node scripts/sync-directory-to-supabase.mjs
```
- Syncs employees and stores from `data/app-data.json` to Supabase
- Useful during initial migration or for bulk data updates
- Requires `.env.local` with Supabase credentials
- Automatically handles timestamp normalization

**Observability & Local Logging:**
- `src/lib/observability.ts` - Local file-based telemetry system
- Logs written to `data/logs/` directory (app.log, metrics.log, traces.log)
- Used for debugging and monitoring in development
- Provides span-based tracing with `createSpan()`
- **Note:** In production, most logging should use `supabaseLogs.addLog()` instead

**Import/Export Utilities:**
- `src/lib/productImportExport.ts` - Product CSV import/export
- `src/lib/assignmentImportExport.ts` - Product assignment bulk operations
- `src/lib/csvUtils.ts` - CSV parsing helpers
- `src/lib/dashboardExport.ts` - Dashboard data Excel export

**Geography Utilities:**
- `src/lib/thaiGeography.ts` - Thai provinces and regions data
- `src/lib/geo.ts` - Geofencing and distance calculations
- `src/lib/useGeoPermission.ts` - GPS permission management hook
- `src/lib/geocoding.ts` - Reverse geocoding (GPS → address)
- `src/lib/timestampFormat.ts` - Timestamp formatting with address display

## Testing & Quality

**Type Checking Before Commits:**
```bash
npx tsc --noEmit  # Must pass with zero errors
npm run lint      # Must pass
```

**No Test Framework Yet** - Manual testing required. Key test scenarios:
1. PIN authentication (success, failure, lockout)
2. Attendance recording with photo upload
3. Sales recording with multiple units
4. Stock operations (receive, sell, return)
5. Admin reports with various filters
6. PWA update notification flow

## Environment Variables

Required in `.env.local`:
```bash
# Supabase Configuration
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJxxx...
SUPABASE_ANON_KEY=eyJxxx...
SUPABASE_ATTENDANCE_BUCKET=attendance-photos

# Public Supabase Configuration (for client-side Realtime)
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJxxx...

# Application Configuration
APP_TIMEZONE=Asia/Bangkok

# Discord Webhook (for support notifications)
DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/xxx/xxx
```

**Security Note:** `SUPABASE_SERVICE_ROLE_KEY` bypasses RLS. Only use server-side.

## Logging Strategy

**All actions should be logged:**
```typescript
import * as supabaseLogs from '@/lib/supabaseLogs';

await supabaseLogs.addLog({
  timestamp: new Date().toISOString(),
  scope: 'sales', // 'employee' | 'store' | 'product' | 'attendance' | 'sales' | 'leave' | 'system'
  action: 'create', // 'create' | 'update' | 'delete' | 'assign' | etc.
  details: 'บันทึกยอดขาย: น้ำดื่ม 10 กล่อง',
  metadata: {
    saleId: data.id,
    employeeId: input.employeeId,
    productId: input.productId,
    quantity: input.quantity
  }
});
```

Logs stored in Supabase `app_logs` table, queryable from admin panel at `/admin/logs`.

## Deployment (Netlify)

**Build Configuration:**
- Build command: `npm run build`
- Publish directory: `.next`
- Node version: 20.x or 22.x
- Build time: ~3-5 minutes (varies by environment)

**Expected Build Output:**
```
✓ Compiled successfully in 3-4 min
✓ Generating static pages (34/34)
✓ Finalizing page optimization

Route (app)                               Size  First Load JS
├ ○ /                                  23.7 kB       165 kB
├ ○ /admin (and 22 other admin pages)  Various       ~150-274 kB
├ ƒ 86 API routes                      0 B           0 B
└ ○ /login, /sales, /stock             Various       ~136-165 kB

Total: 34 pages (23 static ○, 11 dynamic ƒ), 86 API routes
First Load JS shared by all: 163 kB
```

**Build Warnings (Expected & Safe to Ignore):**

1. **`⚠ Webpack is configured while Turbopack is not`**
   - Cause: next-pwa uses Webpack config, but we're using Turbopack for builds
   - Impact: None - PWA features still work correctly
   - Action: Ignore - waiting for next-pwa to support Turbopack natively

2. **`⚠ Slow filesystem detected. The benchmark took XXXms`**
   - Cause: Project on Windows drive (/mnt/d, /mnt/c) accessed via WSL
   - Impact: 5-10x slower builds and file watching
   - Action: Move project to WSL native filesystem (~/projects/) for 10x speedup
   - Command: `cp -r /mnt/d/... ~/projects/...`

3. **`⚠ Found lockfile missing swc dependencies, patching...`**
   - Cause: Next.js detecting missing platform-specific SWC binaries
   - Impact: None - Next.js auto-patches and downloads missing binaries
   - Action: Run `npm install` after first build to ensure all dependencies downloaded

**Post-Deploy Checklist:**
1. Verify `/api/health` responds 200
2. Test authentication flow (PIN login)
3. Check service worker registration in DevTools
4. Verify photo uploads to Supabase Storage
5. Test PWA install and update notification

## Common Gotchas

1. **Don't use `data/app-data.json` for new features** - it's read-only on Netlify
2. **Always use server-side Supabase client in API routes** - never expose service role key to client
3. **File name case sensitivity** - Import paths must match exact file names (e.g., `RoiReportPageClient.tsx` not `ROIReportPageClient`) - this affects Turbopack builds
4. **Dates stored as strings** - `recorded_date: "2025-10-31"`, `recorded_time: "14:30:00"`
5. **Thai language strings** - Most UI text is in Thai, keep it consistent
6. **Photo uploads** - Use Supabase Storage, store both `photo_public_url` and `storage_path`
7. **GPS coordinates** - Store as `latitude` (number), `longitude` (number), `accuracy` (number in meters)
8. **Price types** - Sales records have `price_type: 'pc' | 'company'` for different pricing
9. **Stock system uses base units AND batches** - All stock quantities stored in base unit only (see Migration 022). Starting with Migration 031, inventory is tracked via `stock_batches` table with FEFO (First Expired, First Out) logic
10. **Product units require base unit** - Every product MUST have exactly one unit with `is_base = true`
11. **Batch system is now primary** - Use `deduct_stock_from_batches()` RPC for sales, `get_available_stock_by_fefo()` for stock queries. See `BATCH_MANAGEMENT_STANDARDS.md`
12. **Expenses system** - Currently uses `data/expenses.json` for baseline data, managed via `src/lib/supabaseExpenses.ts`
13. **Auto-backup system** - `src/lib/autoBackup.ts` creates periodic JSON backups in `data/backups/` for disaster recovery

## File Import Aliases

Uses `@/*` alias for `src/*`:
```typescript
import { getSupabaseServiceClient } from '@/lib/supabaseClient';
import type { Database } from '@/types/supabase';
```

Configured in `tsconfig.json` paths.

## Language & Localization

**Primary Language:** Thai (ไทย)
- All UI strings in Thai
- Error messages in Thai
- Database columns in English (snake_case)
- Code comments in English
- Git commit messages can be English or Thai

**Date/Time Formatting:**
```typescript
// Use th-TH locale for display
new Intl.DateTimeFormat('th-TH', {
  timeZone: 'Asia/Bangkok',
  year: 'numeric',
  month: 'long',
  day: 'numeric'
}).format(date);
```

## Client-Side Supabase & Realtime

**For realtime features (dashboard updates):**
```typescript
import { createClient } from '@supabase/supabase-js';

// Use NEXT_PUBLIC_ env vars for client-side
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// Subscribe to realtime changes
const channel = supabase
  .channel('sales-changes')
  .on(
    'postgres_changes',
    { event: 'INSERT', schema: 'public', table: 'sales_records' },
    (payload) => {
      console.log('New sale:', payload.new);
      // Update UI
    }
  )
  .subscribe();
```

**Example Hook:**
```typescript
// src/hooks/useSupabaseRealtime.ts
export function useSupabaseRealtime(table: string, onUpdate: () => void) {
  // Subscribes to table changes and triggers callback
}
```

## Photo Gallery Report

**Admin Photo Management:**
- `src/app/admin/reports/photos/` - Photo gallery report with advanced filtering
- `src/lib/supabasePhotos.ts` - Photo query utilities
- Features:
  - Gallery view with lightbox
  - Timeline view (grouped by date)
  - Side-by-side comparison mode
  - Filters: employee, store, date range, status
  - Photo detail modal with full metadata (GPS, address, timestamp)
  - Batch operations support

**Components:**
```typescript
// Main page structure
- PhotoReportPageClient.tsx - Main container with state management
- PhotoFilters.tsx - Filter controls
- PhotoGallery.tsx - Grid layout with lightbox
- PhotoTimeline.tsx - Timeline grouped view
- PhotoComparison.tsx - Side-by-side comparison
- PhotoDetailModal.tsx - Full-screen photo with metadata overlay
```

**Key Features:**
- Displays attendance photos with timestamp overlays
- Shows address (ตำบล, อำเภอ, จังหวัด) from reverse geocoding
- Filter by employee, store, date range, check-in/out status
- Switch between gallery, timeline, and comparison views
- Click to view full resolution with metadata
- Export-ready for reporting

## Multi-Company Management

**Company-Based Product Catalog:**
- `src/app/admin/settings/companies/` - Company management interface
- `src/lib/supabaseCompanies.ts` - Company CRUD operations
- `src/components/company/CompanySelector.tsx` - Reusable company selector component

**Key Features:**
- Multiple companies with separate branding (logo, colors)
- Products can be assigned to specific companies via `company_id`
- Filter products by company in product management
- Bulk assign products to companies
- Company-specific reporting and analytics

**Database Structure:**
```sql
-- Companies table (migration 018)
CREATE TABLE companies (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  code TEXT UNIQUE,
  logo_url TEXT,  -- Supabase Storage URL
  description TEXT,
  primary_color TEXT DEFAULT '#3b82f6',
  secondary_color TEXT DEFAULT '#0ea5e9',
  is_active BOOLEAN DEFAULT true
);

-- Products reference companies
ALTER TABLE products
  ADD COLUMN company_id UUID REFERENCES companies(id);
```

**Usage Pattern:**
```typescript
import * as supabaseCompanies from '@/lib/supabaseCompanies';

// Get all companies
const companies = await supabaseCompanies.getAllCompanies();

// Get active companies only
const active = companies.filter(c => c.isActive);

// Filter products by company
const { data } = await supabase
  .from('products')
  .select('*')
  .eq('company_id', companyId);
```

**Component Integration:**
```typescript
import CompanySelector from '@/components/company/CompanySelector';

<CompanySelector
  value={selectedCompanyId}
  onChange={setSelectedCompanyId}
  label="เลือกบริษัท"
  includeAllOption={true}
  activeOnly={true}
/>
```

## Support System Integration

**Floating Chat Button & Discord Webhooks:**
- `src/components/FloatingChatButton.tsx` - Floating button on all pages
- `src/components/SupportChatModal.tsx` - Support ticket modal
- `src/app/api/support/send/route.ts` - API that stores in DB + sends to Discord
- `support_messages` table - Tracks all support requests
- Discord webhook sends formatted embed with user context (URL, user agent, role)

**Modal Context Pattern:**
```typescript
// src/contexts/ModalContext.tsx
// Global state for modal open/close
// Controls header positioning when modal is open
// Used by support chat and other modals
```

## Key Custom Hooks

- `useAuth()` - Access authentication context (from AuthContext)
- `useSupabaseRealtime(table, callback)` - Subscribe to database changes
- `useReportFilters()` - Shared state management for report filters
- `useTableSort()` - Client-side table sorting logic
- `useGPSRequired()` - GPS permission and coordinate capture
- `useEnsureLocation()` - Ensure location permissions are granted before proceeding
- `useMasterData()` - Centralized hook for loading employees, stores, products
- `useSmartStockDisplay()` - Display stock quantities in human-readable units

## Next.js Configuration Notes

**PWA Setup (next.config.ts):**
```typescript
import withPWAInit from "next-pwa";

const withPWA = withPWAInit({
  dest: "public",
  disable: process.env.NODE_ENV === "development", // PWA disabled in dev
  register: true,
  skipWaiting: true,
});
```

**Image Optimization:**
- Supabase Storage images are allowed via `remotePatterns`
- Pattern: `https://*.supabase.co/storage/v1/object/public/**`

## Error Handling & Error Boundaries

**ErrorBoundary Component:**
```typescript
// src/components/ErrorBoundary.tsx
// React Error Boundary for catching client-side errors
// Wraps the entire app in src/app/layout.tsx
```

**Pattern:**
- All API routes return `{ success: boolean, error?: string, data?: any }`
- Client components check `success` field before accessing `data`
- Thai error messages for user-facing errors

## Debugging & Troubleshooting

**Check Application Logs:**
```bash
# View local development logs
tail -f data/logs/app.log
tail -f data/logs/metrics.log
tail -f data/logs/traces.log

# View Supabase logs (admin panel)
# Navigate to: /admin/logs
```

**Common Issues:**

1. **"Permission denied" errors on Netlify**
   - Cause: Trying to write to JSON files
   - Solution: Ensure all writes go to Supabase, not local files

2. **Type errors after schema changes**
   - Run: `npm run gen:types`
   - Then: `npx tsc --noEmit` to verify

3. **Photo upload fails**
   - Check `SUPABASE_ATTENDANCE_BUCKET` env var
   - Verify bucket exists and has correct RLS policies
   - Check Supabase Storage size limits

4. **GPS not working**
   - Ensure HTTPS (required for geolocation API)
   - Check browser permissions
   - Use `src/lib/useGeoPermission.ts` hook

5. **Service Worker not updating**
   - Clear browser cache
   - Check `public/version.json` was updated
   - Unregister service worker in DevTools → Application

6. **Rate limit lockout in development**
   - Reset via: Direct database query to `auth_rate_limits`
   - Or use: Admin panel → User PINs → Reset Lockout

7. **Session expired errors after migration 024**
   - Cause: Old cookie-based sessions incompatible with new database sessions
   - Solution: Users must log in again after migration
   - Run cleanup: `SELECT cleanup_expired_sessions();` in Supabase SQL Editor

8. **Build fails with "Cannot find module 'lightningcss'" (WSL)**
   - Cause: Native module (lightningcss for Tailwind CSS v4) not compiled correctly in WSL environment
   - Solution:
     ```bash
     # Method 1: Rebuild specific module
     npm rebuild lightningcss
     npm run build

     # Method 2: Force reinstall dependencies
     npm install --force
     npm run build
     ```
   - Note: This is common when project is on Windows drive (/mnt/d, /mnt/c) in WSL
   - Alternative: Move project to native Linux filesystem (~/projects/) for better performance

9. **Slow build times in WSL (5+ minutes)**
   - Cause: Project on Windows filesystem accessed through WSL (/mnt/d/)
   - Symptoms: "Slow filesystem detected. The benchmark took 305ms+"
   - Solution: Move project to native WSL filesystem for 10x faster builds
     ```bash
     # Move to WSL home directory
     cp -r /mnt/d/Desktop/DEV/webapp-KPF-main ~/projects/webapp-KPF-main
     cd ~/projects/webapp-KPF-main
     npm install
     ```

**Performance Profiling:**
- Use `observability.createSpan()` for timing critical operations
- Check `data/logs/metrics.log` for performance metrics
- Monitor Supabase dashboard for slow queries

## Coding Style & Conventions

**From AGENTS.md - Repository Guidelines:**

### Component & File Naming
- React components: PascalCase (e.g., `UserPinsClient.tsx`)
- Utilities: camelCase (e.g., `salesComparisonQuery.ts`)
- Components should be arrow functions with explicit prop types
- Use `"use client"` directive where required for client components

### TypeScript Standards
- Use TypeScript everywhere with strict mode
- Never use `any` types - define explicit types
- Regenerate Supabase types after schema changes: `npm run gen:types`

### Styling Conventions
- TailwindCSS for all styling
- Group utilities in order: layout → spacing → color → effects
- Avoid deep wrapper stacks
- Comment only when behavior is not obvious

### Code Organization
- Reuse context hooks (`useAuth`, `useModal`) instead of duplicating
- Use React Query for data fetching, not manual fetch
- Use Supabase helper modules instead of direct queries in components

### Commit Style
- Use imperative mood (e.g., "Update", "Add", "Fix")
- Keep subject ≤60 characters
- Optionally scope commits (e.g., "update admin/UserPins responsive layout")

## Related Documentation

### Core Documentation
- **README.md** - Project overview, installation, features (Thai)
- **AGENTS.md** - Coding style, testing guidelines, PR conventions
- **CLAUDE.md** - This file - comprehensive developer guide
- **migrations/** - Database schema evolution (numbered 001-022)
- **types/supabase.ts** - Auto-generated database types
- **.env.example** - Template for environment variables

### Feature-Specific Documentation (docs/ folder)
- **BATCH_MANAGEMENT_STANDARDS.md** - Batch-based inventory with FEFO tracking (Migration 031)
- **STOCK_BASE_UNIT_SYSTEM.md** - Stock base unit architecture and migration guide (Migration 022)
- **LAZY_LOADING_GUIDE.md** - Performance optimization strategies
- **QUERY_OPTIMIZATION_GUIDE.md** - Database query optimization patterns
- **DATABASE_INDEX_ANALYSIS.md** - Index strategy and performance analysis
- **QUICK_INDEX_GUIDE.md** - Quick reference for database indexes
- **REPORT_INDEX_COVERAGE.md** - Index coverage for report queries
- **GEOCODING_USAGE.md** - Reverse geocoding and address display
- **PHOTO_TIMESTAMP_GPS_STRATEGY.md** - Photo metadata architecture
- **TRANSFER_MODAL_FLOW.md** - Stock transfer UI/UX flow
- **MULTI_STORE_ATTENDANCE_ANALYSIS.md** - Multi-store attendance patterns
- **AUTO_CHECKINOUT_REPORT_DESIGN.md** - Attendance report design
- **PROFESSIONAL_ATTENDANCE_SOLUTIONS.md** - Advanced attendance features
- **OPTIMIZATION_IMPLEMENTATION_SUMMARY.md** - Performance optimization summary

**Tip:** Check the `docs/` folder for detailed design documents when working on specific features.
