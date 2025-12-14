# 🎯 Attendance Tracker PWA

**ระบบบันทึกเวลาเข้า-ออกงาน พร้อมบันทึกยอดขายและระบบจัดการครบวงจร**

Progressive Web App (PWA) ที่ออกแบบมาสำหรับพนักงานขายและทีมบริหาร สามารถใช้งานได้บนมือถือและติดตั้งเป็นแอปพลิเคชัน พร้อมระบบจัดการแบบ CMS ครบวงจร

---

## ✨ คุณสมบัติหลัก

### 📱 สำหรับพนักงาน
- **บันทึกเวลาเข้า-ออก** - ถ่ายรูปบังคับ + บันทึก GPS อัตโนมัติ
- **บันทึกยอดขาย** - รองรับหลายหน่วยนับ (กล่อง/แพ็ค/ปี๊บ/ซอง) พร้อมคำนวณอัตโนมัติ
- **รายงาน PC Daily** - บันทึกกิจกรรมลูกค้า, ภาพชั้นวาง, โปรโมชั่น
- **จัดการสต็อก** - รับ-ส่งคืน-ปรับยอด พร้อม FIFO tracking
- **PIN Authentication** - ปลอดภัย รองรับบทบาทหลายระดับ

### 👔 สำหรับผู้บริหาร
- **Dashboard แบบ Real-time** - KPIs, กราฟ, แนวโน้ม 7 วัน
- **รายงานครบวงจร** - เวลาทำงาน, ยอดขาย, เปรียบเทียบ, ROI, สต็อก
- **จัดการพนักงาน/ร้านค้า** - CRUD + มอบหมายสินค้า + GPS geofencing
- **ตั้งเป้าหมาย** - รายเดือน ติดตามความสำเร็จ
- **ระบบสิทธิ์** - Role-based access (employee/sales/admin/super_admin)

### 🚀 PWA Features
- **ติดตั้งเป็นแอป** - Add to Home Screen
- **Auto-Update** - แจ้งเตือนเวอร์ชันใหม่พร้อม Changelog
- **Offline-Ready** - Service Worker caching
- **Fast Loading** - Turbopack + Next.js 15

---

## 🛠️ Tech Stack

- **Framework:** Next.js 15 (App Router) + React 19
- **Language:** TypeScript (Strict Mode)
- **Styling:** Tailwind CSS v4
- **Database:** Supabase (PostgreSQL)
- **Storage:** Supabase Storage (Photos)
- **Auth:** PIN-based (bcrypt hashing)
- **State:** TanStack React Query
- **Charts:** Recharts
- **Maps:** Leaflet + React-Leaflet
- **PWA:** next-pwa

---

## 🚀 Quick Start

### 1. ติดตั้ง Dependencies

```bash
npm install
```

### 2. ตั้งค่า Environment

```bash
cp .env.example .env.local
```

แก้ไข `.env.local`:

```env
# Supabase Configuration
SUPABASE_URL=your-project-url
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
SUPABASE_ATTENDANCE_BUCKET=attendance-photos

# Application Settings
APP_TIMEZONE=Asia/Bangkok
```

### 3. ตั้งค่า Supabase Database

รันไฟล์ migrations ทั้งหมดใน `migrations/` ผ่าน Supabase SQL Editor (เรียงตามลำดับ 001, 002, 003...)

**สำคัญ:** รัน migrations ทีละไฟล์ตามลำดับหมายเลข

### 4. สร้าง Storage Bucket

1. ไปที่ Supabase Dashboard → Storage
2. Create bucket ชื่อ `attendance-photos`
3. ตั้งเป็น Public bucket หรือกำหนด RLS policies

### 5. เริ่มพัฒนา

```bash
npm run dev
```

เปิด [http://localhost:3000](http://localhost:3000)

---

## 📂 โครงสร้างโปรเจ็กต์

```
attendance-pwa/
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── page.tsx           # หน้าบันทึกเวลาเข้า-ออก
│   │   ├── sales/             # หน้าบันทึกยอดขาย
│   │   ├── stock/             # หน้าจัดการสต็อก
│   │   ├── login/             # หน้า Login (PIN)
│   │   ├── admin/             # Admin Dashboard + CMS
│   │   │   ├── reports/       # รายงานทั้งหมด
│   │   │   ├── employees/     # จัดการพนักงาน
│   │   │   ├── stores/        # จัดการร้านค้า
│   │   │   ├── products/      # จัดการสินค้า
│   │   │   └── settings/      # ตั้งค่าระบบ
│   │   └── api/               # API Routes
│   │       ├── attendance/    # API บันทึกเวลา
│   │       ├── sales/         # API บันทึกยอดขาย
│   │       ├── stock/         # API จัดการสต็อก
│   │       ├── auth/          # API Authentication
│   │       └── admin/         # API สำหรับ Admin
│   ├── components/            # Shared UI Components
│   │   ├── UpdatePopup.tsx   # PWA Update Notification
│   │   └── PINKeypad.tsx     # PIN Input Component
│   ├── lib/                   # Business Logic & Utilities
│   │   ├── configStore.ts    # Main data store
│   │   ├── supabaseClient.ts # Supabase client factory
│   │   ├── supabaseData.ts   # Query helpers
│   │   ├── pinAuth.ts        # PIN authentication
│   │   ├── authSecurity.ts   # Security & audit logs
│   │   ├── serviceWorkerManager.ts  # PWA updates
│   │   └── ...               # Other utilities
│   ├── contexts/             # React Contexts
│   │   └── AuthContext.tsx   # Authentication state
│   └── types/                # TypeScript types
│       └── supabase.ts       # Supabase schema types
├── public/
│   ├── version.json          # Version tracking for PWA
│   ├── manifest.json         # PWA manifest
│   └── icons/                # App icons
├── migrations/               # Supabase SQL migrations
│   ├── 001_*.sql
│   ├── 002_*.sql
│   └── ...
├── data/                     # Local data (development only)
│   ├── app-data.json        # Config data (legacy)
│   ├── expenses.json        # Expense baselines
│   └── logs/                # Application logs
└── next.config.ts           # Next.js + PWA configuration
```

---

## 🔐 ระบบ Authentication

### PIN-based Authentication
- **4-6 หลักตัวเลข** - bcrypt hashing
- **Rate Limiting** - ล็อคบัญชีหลัง 5 ครั้งผิด
- **Audit Logs** - บันทึกทุก login attempt
- **Role-based Access:**
  - `employee` - บันทึกเวลา, ดูข้อมูลตัวเอง
  - `sales` - + บันทึกยอดขาย, รายงาน PC
  - `admin` - + Dashboard, รายงานทั้งหมด
  - `super_admin` - + จัดการผู้ใช้, ตั้งค่าระบบ

### การจัดการ User PINs
```
/admin/user-pins
```
- สร้าง/แก้ไข/ลบ PIN
- กำหนดบทบาท (role)
- รีเซ็ต rate limit

---

## 📊 Database Schema

### ตารางหลัก

**attendance_records** - บันทึกเวลาเข้า-ออก
- `recorded_date`, `recorded_time`, `status` (check-in/check-out)
- `employee_id`, `store_id`, `note`
- `latitude`, `longitude`, `accuracy`
- `photo_public_url`, `storage_path`

**sales_records** - บันทึกยอดขาย
- `recorded_date`, `recorded_time`
- `employee_id`, `store_id`
- `product_id`, `unit_id`
- `quantity`, `unit_price`, `total_price`
- `price_type` (pc/company)

**employees** - ข้อมูลพนักงาน
- `name`, `employee_code`, `phone`
- `province`, `region`
- `regular_day_off`, `active_status`

**stores** - ข้อมูลร้านค้า
- `name`, `code`, `province`
- `latitude`, `longitude`, `radius` (geofencing)

**products** - สินค้า
- `name`, `code`, `active_status`
- `category_id`

**product_units** - หน่วยนับสินค้า
- `product_id`, `name`, `sku`
- `is_base_unit`, `base_unit_multiplier`

**product_assignments** - มอบหมายสินค้าให้พนักงาน
- `employee_id`, `product_id`, `store_id`
- `is_global` (ใช้ได้ทุกร้าน)

**product_assignment_units** - ราคาต่อหน่วย
- `assignment_id`, `unit_id`
- `price_pc`, `price_company`

**stock_inventory** - สต็อกปัจจุบัน
- `employee_id`, `store_id`, `product_id`, `unit_id`
- `quantity` (non-negative constraint)

**stock_transactions** - ประวัติการเคลื่อนไหวสต็อก
- `type` (receive/sale/return/adjustment)
- `quantity`, `balance_after`
- `sale_record_id` (link to sales)

**user_pins** - PIN Authentication
- `employee_id`, `pin_hash`, `role`

**auth_audit_logs** - Audit trail
- `employee_id`, `success`, `ip_address`, `user_agent`

**auth_rate_limits** - Failed login tracking
- `employee_id`, `failed_attempts`, `locked_until`

---

## 📱 PWA Auto-Update System

### การทำงาน
1. **ตรวจจับอัตโนมัติ** - Service Worker เช็คทุก 60 วินาที
2. **แสดง Popup** - แจ้งเตือนพร้อม Changelog ภาษาไทย
3. **Update ทันที** - กดปุ่ม "อัปเดตเลย" → Reload
4. **ไม่ต้องติดตั้งใหม่** - PWA icon ยังอยู่ที่เดิม

### การอัปเดต Version
แก้ไข `public/version.json`:

```json
{
  "version": "2.1.0",
  "buildDate": "2025-02-01T10:00:00+07:00",
  "releaseNotes": {
    "th": {
      "title": "อัปเดตใหม่ล่าสุด",
      "highlights": [
        {
          "icon": "🆕",
          "title": "ฟีเจอร์ใหม่",
          "description": "รายละเอียดฟีเจอร์"
        }
      ]
    }
  }
}
```

Git push → Netlify deploy → User เห็น popup ทันที!

---

## 🎨 การใช้งานฟีเจอร์หลัก

### บันทึกเวลาเข้า-ออก
```
/ (หน้าหลัก)
1. เลือกพนักงาน
2. เลือกร้านค้า (optional)
3. เลือกสถานะ (เข้างาน/ออกงาน)
4. ถ่ายรูป (บังคับ)
5. GPS บันทึกอัตโนมัติ
6. กดบันทึก
```

### บันทึกยอดขาย
```
/sales
1. เลือกพนักงาน + ร้านค้า
2. เลือกสินค้า (filter ตาม assignment)
3. เลือกหน่วยนับ + ใส่จำนวน
4. เลือก price type (PC/Company)
5. คำนวณยอดรวมอัตโนมัติ
6. ถ่ายรูป + GPS
7. กดบันทึก
```

### Dashboard & Reports
```
/admin
- KPI cards (ยอดขาย, จำนวนครั้ง, กำไร)
- กราฟแนวโน้ม 7 วัน
- Top products/employees/stores
- Performance analytics

/admin/reports/*
- attendance - รายงานเวลาทำงาน
- sales - รายงานยอดขาย
- sales-comparison - เปรียบเทียบยอดขายรายเดือน
- products - รายงานสินค้า + ranking
- individual - ประเมินผลรายบุคคล
- roi - คำนวณ ROI พนักงาน
- pc-daily - รายงาน PC Daily
- stock-movement - รายงานสต็อก
```

---

## 🔧 การ Build & Deploy

### Development
```bash
npm run dev          # Turbopack dev server
```

### Production Build
```bash
npm run build        # Next.js production build
npm run start        # Serve production bundle
```

### TypeScript Check
```bash
npx tsc --noEmit     # Type checking only
```

### Linting
```bash
npm run lint         # ESLint check
```

### Generate Supabase Types
```bash
npm run gen:types    # Output to src/types/supabase.ts
```

### Deploy to Netlify
1. Connect GitHub repository
2. Set environment variables:
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `SUPABASE_ATTENDANCE_BUCKET`
   - `APP_TIMEZONE`
3. Deploy automatically on push to main

---

## 🔐 ความปลอดภัย

### Data Security
- ✅ PIN hashing ด้วย bcrypt (10 rounds)
- ✅ Rate limiting + account lockout
- ✅ Audit logs ทุก authentication attempt
- ✅ Service role key ใช้เฉพาะฝั่ง server
- ✅ Input validation ทุก API endpoint

### Supabase RLS (Row Level Security)
- เปิดใช้งาน RLS policies บนทุกตาราง
- แยกสิทธิ์ตาม employee_id และ role
- ดูตัวอย่างใน migrations files

### Environment Variables
- ⚠️ **ห้าม** commit `.env.local`
- ⚠️ **ห้าม** expose `SERVICE_ROLE_KEY` ให้ client
- ✅ ใช้ `.env.example` เป็น template

---

## 📖 Additional Resources

### Documentation
- `CLAUDE.md` - คู่มือสำหรับ AI/Developer
- `AGENTS.md` - AI Agent specifications
- `migrations/` - Database schema evolution

### API Reference
```
/api/attendance        # POST - บันทึกเวลา
/api/sales             # POST - บันทึกยอดขาย
/api/auth/login        # POST - PIN login
/api/admin/*           # Admin endpoints
/api/changelog         # GET - ข้อมูล version
```

### Key Libraries
- `src/lib/configStore.ts` - Main data operations
- `src/lib/supabaseClient.ts` - Supabase client factory
- `src/lib/supabaseData.ts` - Query helpers
- `src/lib/pinAuth.ts` - PIN authentication
- `src/lib/serviceWorkerManager.ts` - PWA updates

---

## 🚀 Feature Roadmap

- [ ] Multi-language support (EN/TH switching)
- [ ] Push notifications (Supabase Realtime)
- [ ] Offline mode with sync queue
- [ ] Advanced geofencing alerts
- [ ] Integration with LINE OA
- [ ] Export to Google Sheets/Excel
- [ ] Mobile app (React Native)

---

## 📝 License

Private project - All rights reserved

---

## 👥 Support

For issues or questions:
1. Check `CLAUDE.md` for development guidelines
2. Review `migrations/` for schema reference
3. Check Supabase logs for debugging

---

**Made with ❤️ using Next.js 15 + Supabase**
