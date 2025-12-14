-- Migration 031: Migrate existing stock_inventory to stock_batches (FORCE CREATE)
-- Description: Create batch records for ALL stock_inventory (force create even if batches exist)
-- Date: 2025-01-26
--
-- Problem: Stock without batches cannot be sold/returned because deduct_stock_multi_batch
--          requires batches for FEFO/FIFO selection
--
-- Solution: Create "MIGRATED" batches for ALL stock_inventory records with quantity > 0
--           This ensures every stock has at least one batch available

DO $$
DECLARE
  stock_record RECORD;
  product_record RECORD;
  batch_total_qty NUMERIC;
  stock_inventory_qty NUMERIC;
  missing_qty NUMERIC;
  new_lot_number TEXT;
  batch_count INT := 0;
BEGIN
  RAISE NOTICE '=== Starting FORCE Stock Batch Migration ===';

  -- Loop through ALL stock_inventory with quantity > 0
  FOR stock_record IN
    SELECT
      si.id,
      si.employee_id,
      si.store_id,
      si.product_id,
      si.quantity,
      si.created_at
    FROM stock_inventory si
    WHERE si.quantity > 0
    ORDER BY si.created_at
  LOOP
    -- Get product info for lot_number generation
    SELECT code INTO product_record
    FROM products
    WHERE id = stock_record.product_id;

    -- Calculate total batch quantity vs stock_inventory quantity
    SELECT COALESCE(SUM(remaining_quantity), 0) INTO batch_total_qty
    FROM stock_batches
    WHERE employee_id = stock_record.employee_id
      AND store_id = stock_record.store_id
      AND product_id = stock_record.product_id;

    stock_inventory_qty := stock_record.quantity;
    missing_qty := stock_inventory_qty - batch_total_qty;

    RAISE NOTICE 'Stock Check: employee=%, store=%, product=%, stock_inventory=%, batch_total=%, missing=%',
      stock_record.employee_id, stock_record.store_id, stock_record.product_id,
      stock_inventory_qty, batch_total_qty, missing_qty;

    -- If missing quantity > 0, create MIGRATED batch for the missing amount
    IF missing_qty > 0 THEN
      -- Generate unique lot_number with timestamp to avoid conflicts
      new_lot_number := 'MIGRATED-' || COALESCE(product_record.code, 'UNKNOWN') || '-' ||
                        TO_CHAR(stock_record.created_at, 'YYYYMMDD-HH24MISS') || '-' ||
                        SUBSTRING(MD5(stock_record.id::TEXT), 1, 8);

      RAISE NOTICE '✅ Creating batch: qty=%, lot=%', missing_qty, new_lot_number;

      -- Insert batch record (no ON CONFLICT - let it fail if duplicate)
      BEGIN
        INSERT INTO stock_batches (
          employee_id,
          store_id,
          product_id,
          lot_number,
          mfg_date,
          expiry_date,  -- NULL = FIFO (use mfg_date for sorting)
          initial_quantity,
          remaining_quantity,
          note,
          created_at,
          updated_at
        ) VALUES (
          stock_record.employee_id,
          stock_record.store_id,
          stock_record.product_id,
          new_lot_number,
          DATE(stock_record.created_at),  -- Use stock created_at as mfg_date
          NULL,  -- No expiry date = use FIFO
          missing_qty,
          missing_qty,
          'Auto-migrated from stock_inventory (Migration 031) - Missing quantity: ' || missing_qty::TEXT,
          stock_record.created_at,
          NOW()
        );

        batch_count := batch_count + 1;

      EXCEPTION WHEN OTHERS THEN
        RAISE WARNING '⚠️ Failed to create batch: %', SQLERRM;
      END;
    ELSE
      RAISE NOTICE 'ℹ️ Stock already has sufficient batches (no missing quantity)';
    END IF;
  END LOOP;

  RAISE NOTICE '=== Stock Batch Migration Complete ===';
  RAISE NOTICE 'Batches created: %', batch_count;
  RAISE NOTICE 'Total stock_inventory records with quantity > 0: %',
    (SELECT COUNT(*) FROM stock_inventory WHERE quantity > 0);
  RAISE NOTICE 'Total stock_batches records: %',
    (SELECT COUNT(*) FROM stock_batches);
  RAISE NOTICE 'Total MIGRATED batches: %',
    (SELECT COUNT(*) FROM stock_batches WHERE lot_number LIKE 'MIGRATED-%');

  -- Show summary of mismatches (should be 0 after migration)
  RAISE NOTICE 'Stock/Batch Mismatches (should be 0):';
  FOR stock_record IN
    SELECT
      si.employee_id,
      si.store_id,
      si.product_id,
      p.code,
      si.quantity AS stock_qty,
      COALESCE(SUM(sb.remaining_quantity), 0) AS batch_qty,
      si.quantity - COALESCE(SUM(sb.remaining_quantity), 0) AS diff
    FROM stock_inventory si
    JOIN products p ON si.product_id = p.id
    LEFT JOIN stock_batches sb ON
      si.employee_id = sb.employee_id AND
      si.store_id = sb.store_id AND
      si.product_id = sb.product_id
    WHERE si.quantity > 0
    GROUP BY si.employee_id, si.store_id, si.product_id, p.code, si.quantity
    HAVING si.quantity != COALESCE(SUM(sb.remaining_quantity), 0)
  LOOP
    RAISE WARNING '⚠️ Mismatch: product=%, stock=%, batch=%, diff=%',
      stock_record.code, stock_record.stock_qty, stock_record.batch_qty, stock_record.diff;
  END LOOP;

END $$;

-- Add index for faster batch lookup during sales
CREATE INDEX IF NOT EXISTS idx_stock_batches_lookup
ON stock_batches(employee_id, store_id, product_id, remaining_quantity)
WHERE remaining_quantity > 0;

-- Add comment
COMMENT ON INDEX idx_stock_batches_lookup IS
'Fast lookup for available batches during FEFO/FIFO stock deduction';
