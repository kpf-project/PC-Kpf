# 🔄 คู่มือกู้คืนข้อมูล Supabase

## สถานการณ์: ข้อมูลถูกลบ แต่ Schema (ตาราง) ยังอยู่

✅ **ตารางที่ยังมีอยู่:**
- employees
- stores
- products
- product_units
- categories
- sales_records
- attendance_records
- user_pins (ยังมีข้อมูล 10 rows)
- stock_batches
- stock_inventory
- stock_transactions
- companies

⚠️ **ตารางที่ข้อมูลถูกลบหมด:**
- employees (0 rows)
- stores (0 rows)
- products (0 rows)
- sales_records (0 rows)
- attendance_records (0 rows)
- stock_batches (0 rows)

---

## 📋 วิธีกู้คืน (เรียงตามลำดับความง่าย)

### วิธีที่ 1: Supabase Daily Backups ⭐ (แนะนำ!)

#### 1.1. เข้า Supabase Dashboard

```
https://supabase.com/dashboard/project/[YOUR_PROJECT_ID]
```

#### 1.2. ไปที่หน้า Database Backups

```
Settings → Database → Backups
```

หรือ URL ตรง:
```
https://supabase.com/dashboard/project/[YOUR_PROJECT_ID]/settings/database
```

#### 1.3. ดู Backup ที่มี

**Free Plan:**
- เก็บ Daily Backup 7 วันล่าสุด
- Backup ทุกวันเวลา 00:00 UTC (07:00 น. ไทย)

**Pro Plan:**
- Point-in-Time Recovery (PITR)
- ย้อนหลังได้ทุกนาที ถึง 7 วัน

#### 1.4. เลือกวันที่ต้องการกู้คืน

เลือกวันก่อนที่จะลบข้อมูล เช่น:
- ถ้าลบวันนี้ → เลือก backup เมื่อวาน
- ถ้าลบเมื่อวาน → เลือก backup เมื่อ 2 วันก่อน

#### 1.5. Download Backup

1. คลิก "Download" ข้างวันที่ต้องการ
2. ได้ไฟล์ `.sql` หรือ `.dump`
3. บันทึกไฟล์ลง computer

---

### วิธีที่ 2: Restore จาก Backup File

#### 2.1. Restore ผ่าน SQL Editor (ง่ายที่สุด)

**ขั้นตอน:**

1. **เปิดไฟล์ backup ที่ download มา**
   - ใช้ Text Editor (VS Code, Notepad++, etc.)
   - ดูเนื้อหาว่าเป็น SQL statements

2. **ไปที่ Supabase SQL Editor**
   ```
   Dashboard → SQL Editor → New query
   ```

3. **Copy SQL จากไฟล์ backup**
   - เลือกทั้งหมด (Ctrl+A)
   - Copy (Ctrl+C)

4. **Paste ใน SQL Editor**
   - Paste (Ctrl+V)

5. **Review SQL ก่อน Run**
   - ⚠️ ตรวจสอบว่ามี DROP TABLE หรือไม่ (ถ้ามีให้ลบออก)
   - ✅ ควรมีแต่ INSERT statements

6. **Run SQL**
   - คลิก "Run" หรือ Ctrl+Enter
   - รอจนเสร็จ (อาจใช้เวลานาน ถ้าข้อมูลเยอะ)

7. **ตรวจสอบผลลัพธ์**
   ```bash
   node scripts/restore-from-backup.mjs --check-backups
   ```

#### 2.2. Restore ผ่าน Command Line (สำหรับไฟล์ใหญ่)

**ถ้าไฟล์ backup ใหญ่เกิน 10MB:**

```bash
# ติดตั้ง Supabase CLI (ถ้ายังไม่มี)
npm install -g supabase

# Login
supabase login

# Link project
supabase link --project-ref [YOUR_PROJECT_REF]

# Restore database
supabase db restore --file path/to/backup.sql
```

---

### วิธีที่ 3: ถ้าไม่มี Backup เลย 😢

#### 3.1. ตรวจสอบ Supabase Backup History

บางทีอาจมี backup ที่ซ่อนอยู่:

1. ไปที่ Supabase Dashboard
2. Settings → Database → Backups
3. ดูที่ "Backup History" (scroll ลงไป)

#### 3.2. ถ้าจริง ๆ ไม่มี Backup

ต้องเริ่มต้นใหม่:

**A. Re-seed Master Data:**

1. **Employees (พนักงาน)**
   - ต้องใส่ข้อมูลใหม่ทาง Admin Panel
   - หรือ import จาก CSV

2. **Stores (ร้านค้า)**
   - ต้องใส่ข้อมูลใหม่

3. **Products (สินค้า)**
   - ต้องใส่ข้อมูลใหม่
   - ตั้งค่า units และ prices

**B. Transaction Data (ไม่สามารถกู้คืนได้):**
- sales_records (ยอดขาย) → สูญหาย
- attendance_records (บันทึกเวลา) → สูญหาย
- stock_batches (สต็อก) → ต้องนับใหม่

---

## 🔐 ป้องกันไม่ให้เกิดซ้ำ

### 1. เปิด Row Level Security (RLS)

ทำให้ไม่สามารถลบข้อมูลได้ง่าย ๆ:

```sql
-- Run in SQL Editor
ALTER TABLE employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE stores ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;

-- Create policies (ตัวอย่าง)
CREATE POLICY "Prevent accidental deletes"
  ON employees
  FOR DELETE
  USING (false); -- ห้าม DELETE ผ่าน client
```

### 2. สร้าง Backup Schedule

```bash
# Cron job (ทุกวัน 2:00 น.)
0 2 * * * cd /path/to/project && node scripts/create-backup.mjs
```

### 3. Export ข้อมูลสำคัญเป็น CSV

```bash
# Export from Supabase Table Editor
Dashboard → Table Editor → เลือกตาราง → Export → CSV
```

### 4. Upgrade to Pro Plan

- Point-in-Time Recovery (ย้อนหลังทุกนาที)
- Longer backup retention (เก็บนานกว่า 7 วัน)

---

## 📞 ติดปัญหา?

1. **ดู logs ใน Supabase:**
   ```
   Dashboard → Logs → Database Logs
   ```

2. **ตรวจสอบ RLS Policies:**
   ```
   Dashboard → Authentication → Policies
   ```

3. **Contact Supabase Support:**
   - ถ้าเป็น Paid Plan สามารถขอความช่วยเหลือได้
   - อาจมี backup ที่ซ่อนอยู่

---

## ✅ Checklist

- [ ] ไปหา Backup ใน Supabase Dashboard
- [ ] Download backup file (.sql)
- [ ] Review SQL statements
- [ ] Restore ผ่าน SQL Editor หรือ CLI
- [ ] ตรวจสอบว่าข้อมูลกลับมาครบ
- [ ] ตั้งค่า RLS เพื่อป้องกัน
- [ ] สร้าง backup schedule

---

**สร้างโดย:** Restore script v1.0
**วันที่:** 2025-01-14
