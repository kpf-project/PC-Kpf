# 📦 Batch Management System - มาตรฐานสากล (FDA/GMP/ISO 22000)

## 🌐 มาตรฐานที่ใช้

- **FDA 21 CFR Part 11** - Electronic Records และ Audit Trail
- **WHO GDP Guidelines** - Good Distribution Practice
- **ISO 22000** - Food Safety Management System
- **FEFO Principle** - First Expired First Out (ขายของใกล้หมดอายุก่อน)

---

## 🔄 Batch Lifecycle & Status

### Batch Status Types

```typescript
type BatchStatus =
  | 'active'      // ✅ พร้อมขาย (มีของเหลือ + ยังไม่หมดอายุ)
  | 'depleted'    // 🏁 ขายหมดแล้ว (remaining = 0) แต่ยังไม่หมดอายุ
  | 'expired'     // ❌ หมดอายุแล้ว (ห้ามขาย แต่เก็บไว้ audit)
  | 'quarantine'; // ⚠️ กักกัน (ตรวจสอบคุณภาพ - optional)
```

### Status Transition Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                    Batch Lifecycle                           │
└─────────────────────────────────────────────────────────────┘

  [รับเข้า]
      ↓
  ✅ ACTIVE (พร้อมขาย)
      │
      ├── เมื่อขายหมด (remaining = 0)
      │   → 🏁 DEPLETED (เก็บใน History)
      │
      ├── เมื่อหมดอายุ (expiry_date < today)
      │   → ❌ EXPIRED (ห้ามขาย แต่เก็บไว้)
      │
      └── ขายหมด + หมดอายุ
          → ❌ EXPIRED + DEPLETED
```

---

## 🎯 FEFO (First Expired First Out) System

### หลักการ FEFO

**ขายของที่ใกล้หมดอายุก่อนเสมอ** เพื่อลดของเสียและเพิ่มความปลอดภัย

### FEFO Visual Indicators

```
┌───────────────────────────────────────────────────┐
│ 🔥 FEFO Badge (ใกล้หมดอายุที่สุด) - สีส้ม/แดง   │ ← Rank #1
├───────────────────────────────────────────────────┤
│ ⚠️ Warning (30-90 วัน) - สีเหลือง               │
├───────────────────────────────────────────────────┤
│ ✅ OK (> 90 วัน) - สีเขียว                      │
├───────────────────────────────────────────────────┤
│ ───────────── Separator ───────────────          │
├───────────────────────────────────────────────────┤
│ 🏁 Depleted (ขายหมด) - Collapsible             │
├───────────────────────────────────────────────────┤
│ ❌ Expired (หมดอายุ) - แยกแสดงด้านล่าง          │
└───────────────────────────────────────────────────┘
```

### Auto FEFO Selection

ระบบจะเลือก batch ที่ใกล้หมดอายุที่สุดโดยอัตโนมัติเมื่อ:
- ✅ ขายสินค้า (sale transaction)
- ✅ คืนสินค้า (return transaction)
- ❌ รับเข้าสินค้า (receive) - ไม่ต้อง auto select

**Sorting Priority:**
1. Exclude expired batches
2. Exclude depleted batches (remaining = 0)
3. Sort by `expiry_date ASC NULLS LAST`
4. Tie-breaker: `created_at ASC` (เก่าก่อน)

---

## 📊 Batch Display Strategy

### Display Sections

```typescript
interface BatchDisplayGroups {
  active: Batch[];      // แสดงก่อน (FEFO order)
  depleted: Batch[];    // Collapsible section
  expired: Batch[];     // แยกแสดงด้านล่าง พร้อม warning
}
```

### Smart Quantity Display

แสดง batch quantity ในหลายหน่วย (เหมือนในรายการคงเหลือ):

```
Example Product: "น้ำดื่ม"
Units: ลัง (288 ชิ้น), แพ็ค (24 ชิ้น), ซอง (1 ชิ้น - base)

Batch #1:
- Initial: 2,880 ชิ้น → "10 ลัง"
- Remaining: 1,728 ชิ้น → "6 ลัง"
- Used: 1,152 ชิ้น (40% utilization)

Batch #2:
- Initial: 864 ชิ้น → "3 ลัง"
- Remaining: 627 ชิ้น → "2 ลัง 2 แพ็ค 3 ซอง"
- Used: 237 ชิ้น (27% utilization)
```

**Implementation:**
```typescript
import { smartDisplayStock } from '@/lib/stockUnitConversion';

const displayText = smartDisplayStock(remainingQuantity, productUnits);
// Returns: [{ unitName: "ลัง", count: 2 }, { unitName: "แพ็ค", count: 2 }, ...]
```

---

## 🔧 Technical Implementation

### Database Views (Migration 029)

```sql
-- View with computed status
CREATE VIEW stock_batches_with_status AS
SELECT
  sb.*,
  CASE
    WHEN sb.remaining_quantity = 0 THEN 'depleted'
    WHEN sb.expiry_date < CURRENT_DATE THEN 'expired'
    WHEN sb.remaining_quantity > 0 AND sb.expiry_date >= CURRENT_DATE THEN 'active'
  END AS batch_status,

  (sb.expiry_date - CURRENT_DATE) AS days_until_expiry,

  CASE
    WHEN sb.expiry_date IS NULL THEN 'no_expiry'
    WHEN sb.expiry_date < CURRENT_DATE THEN 'expired'
    WHEN (sb.expiry_date - CURRENT_DATE) <= 7 THEN 'critical'
    WHEN (sb.expiry_date - CURRENT_DATE) <= 30 THEN 'warning'
    ELSE 'ok'
  END AS expiry_status,

  ROUND(((sb.initial_quantity - sb.remaining_quantity) / sb.initial_quantity) * 100, 2)
    AS utilization_percentage
FROM stock_batches sb;
```

### RPC Functions

#### 1. Get Available Batches for Sale (Auto FEFO)

```sql
SELECT * FROM get_available_batches_for_sale(
  p_product_id,
  p_employee_id,
  p_store_id
);

-- Returns: Only active batches (not expired/depleted) in FEFO order
```

#### 2. Get All Batches (Including History)

```sql
SELECT * FROM get_all_batches_for_product(
  p_product_id,
  p_employee_id,
  p_store_id,
  p_include_depleted := TRUE,   -- Show sold out batches
  p_include_expired := TRUE     -- Show expired batches
);

-- Returns: All batches grouped by status (active → depleted → expired)
```

### API Integration

**✅ Fixed: Batch Quantity Reduction**

```typescript
// ✅ NEW: Send batch_id to RPC for automatic remaining_quantity reduction
const rpcArgs = {
  p_employee_id,
  p_store_id,
  p_product_id,
  p_unit_id,
  p_transaction_type,
  p_quantity,
  p_batch_id,  // ✅ CRITICAL: Must be sent for sale/return
};

// RPC will:
// 1. Validate batch has enough quantity
// 2. Reduce remaining_quantity by quantity_in_base
// 3. Link transaction to batch_id
```

---

## 📱 UI/UX Guidelines

### Batch Detail Modal

**Layout:**
```
┌─────────────────────────────────────────────────────┐
│ 📦 Batch Details: น้ำดื่ม (BL01006)                 │
├─────────────────────────────────────────────────────┤
│                                                      │
│ ✅ Active Batches (2)                               │
│ ┌──────────────────────────────────────────┐       │
│ │ 🔥 FEFO │ LOT-001 │ EXP: 15 ม.ค. 68     │       │
│ │ Remaining: 6 ลัง (1,728 ชิ้น)            │       │
│ │ Utilization: 40% used                    │       │
│ └──────────────────────────────────────────┘       │
│                                                      │
│ ┌──────────────────────────────────────────┐       │
│ │ ⚠️ WARNING │ LOT-002 │ EXP: 25 ก.พ. 68  │       │
│ │ Remaining: 2 ลัง 2 แพ็ค 3 ซอง (627 ชิ้น)│       │
│ │ Utilization: 27% used                    │       │
│ └──────────────────────────────────────────┘       │
│                                                      │
│ ▼ Sold Out Batches (1)    [Click to expand]        │
│                                                      │
│ ▼ Expired Batches (0)                               │
│                                                      │
└─────────────────────────────────────────────────────┘
```

### Color Coding

```typescript
const STATUS_COLORS = {
  critical: 'from-red-500 to-orange-500',    // < 7 วัน
  warning: 'from-yellow-400 to-orange-400',  // 7-30 วัน
  ok: 'from-green-400 to-emerald-500',       // > 30 วัน
  depleted: 'from-gray-300 to-gray-400',     // ขายหมด
  expired: 'from-red-500 to-red-600',        // หมดอายุ
};
```

### FEFO Badge Animation

```css
/* Critical batches (< 7 days) should pulse */
.fefo-critical {
  @apply animate-pulse;
  background: linear-gradient(135deg, #f97316, #dc2626);
}
```

---

## 🔒 Data Retention Policy

**FDA/GMP Compliance:**

| Batch Status | Retention Policy | Reason |
|--------------|------------------|---------|
| Active | ✅ Keep always | พร้อมขาย |
| Depleted | ✅ Keep forever | Audit trail (ต้องรู้ว่าขายไปเมื่อไหร่) |
| Expired | ✅ Keep forever | Regulatory compliance (ต้องมีประวัติ) |

**❌ ห้ามลบ batch ใดๆ** - เก็บไว้ทั้งหมดเพื่อ traceability

---

## 🧪 Testing Checklist

### Unit Tests

- [ ] Batch status computation (active/depleted/expired)
- [ ] FEFO sorting excludes expired batches
- [ ] Smart quantity display works for all units
- [ ] Utilization percentage calculation

### Integration Tests

- [ ] Sale transaction reduces remaining_quantity
- [ ] Return transaction reduces remaining_quantity
- [ ] Auto FEFO selects correct batch
- [ ] Depleted batch (remaining = 0) excluded from sale
- [ ] Expired batch excluded from sale

### UI Tests

- [ ] FEFO badge appears on first batch
- [ ] FEFO badge moves to next batch when first is depleted
- [ ] Depleted batches shown in collapsible section
- [ ] Expired batches shown separately with warning
- [ ] Smart display shows multiple units correctly

---

## 📝 Migration Steps

### 1. Run Migration 028 (Fix NULL balance_after)

```bash
# In Supabase SQL Editor
-- Run: migrations/028_fix_add_stock_transaction_null_balance.sql
```

### 2. Run Migration 029 (Batch Management Improvements)

```bash
# In Supabase SQL Editor
-- Run: migrations/029_batch_management_improvements.sql
```

### 3. Verify API Changes

```bash
# Type check
npx tsc --noEmit

# Test batch quantity reduction
# - Receive product with batch
# - Sell/return product
# - Check remaining_quantity in database
```

### 4. Update UI Components

- [ ] Update `BatchDetailModal.tsx` to use new view
- [ ] Add batch status filtering
- [ ] Implement FEFO visual indicators
- [ ] Add collapsible sections for depleted/expired

---

## 🚀 Production Deployment

### Pre-Deployment Checklist

- [ ] Run migrations 028 + 029
- [ ] Verify RPC functions work correctly
- [ ] Test batch quantity reduction
- [ ] Verify FEFO auto-selection
- [ ] Test UI on mobile devices
- [ ] Check performance with large datasets

### Post-Deployment Monitoring

```sql
-- Monitor batch status distribution
SELECT
  batch_status,
  COUNT(*) as count,
  SUM(remaining_quantity) as total_remaining
FROM stock_batches_with_status
GROUP BY batch_status;

-- Find batches with remaining_quantity inconsistencies
SELECT *
FROM stock_batches
WHERE remaining_quantity < 0 OR remaining_quantity > initial_quantity;

-- Check FEFO order
SELECT * FROM get_available_batches_for_sale(
  'product-uuid',
  'employee-uuid',
  'store-uuid'
);
```

---

## 📚 References

- [FDA 21 CFR Part 11](https://www.fda.gov/regulatory-information/search-fda-guidance-documents/part-11-electronic-records-electronic-signatures-scope-and-application)
- [WHO GDP Guidelines](https://www.who.int/publications/m/item/trs-961-annex-5)
- [ISO 22000:2018](https://www.iso.org/standard/65464.html)
- [FEFO Best Practices](https://www.fda.gov/food/guidances-documents/guidance-industry-good-manufacturing-practice-requirements-food-safety-plan)

---

## ❓ FAQ

**Q: ทำไมไม่ลบ batch ที่หมดอายุ?**
A: เพื่อ regulatory compliance และ audit trail ต้องเก็บประวัติไว้ทั้งหมด

**Q: FEFO badge จะเปลี่ยนอัตโนมัติเมื่อ batch แรกหมดหรือไม่?**
A: ใช่ เพราะ query เรียงตาม expiry_date ใหม่ทุกครั้ง

**Q: ถ้า batch ไม่มี expiry_date จะเกิดอะไรขึ้น?**
A: จะไปอยู่ท้ายสุด (NULLS LAST) และขายได้ปกติ

**Q: สามารถขาย batch ที่หมดอายุได้หรือไม่?**
A: ❌ ไม่ได้ - ระบบจะกรองออกโดยอัตโนมัติ (ตาม WHO GDP guidelines)

**Q: ถ้าต้องการขายของหมดอายุ (ฉุกเฉิน) ทำอย่างไร?**
A: ต้องเพิ่ม admin override permission และ log reason (future feature)

---

**สรุป:** ระบบ Batch Management นี้ออกแบบตามมาตรฐานสากล FDA/GMP/ISO 22000 เพื่อความปลอดภัยสูงสุดและ compliance ที่ถูกต้อง ✅
