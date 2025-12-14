-- Migration 030: Add submission_id to stock_transactions
-- Description: Group transactions from the same form submission together
-- Date: 2025-01-26

-- Add submission_id column to stock_transactions
ALTER TABLE public.stock_transactions
ADD COLUMN IF NOT EXISTS submission_id TEXT;

-- Add index for faster grouping queries
CREATE INDEX IF NOT EXISTS idx_stock_transactions_submission_id
ON public.stock_transactions(submission_id)
WHERE submission_id IS NOT NULL;

-- Add comment
COMMENT ON COLUMN public.stock_transactions.submission_id IS
'UUID to group multiple transactions from the same form submission (e.g., 100 box + 100 pack + 100 piece in one submit)';
