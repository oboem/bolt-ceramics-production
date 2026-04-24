/*
  # Add source_quote_id to sales_orders

  Links a sales order back to the quote it was generated from.

  1. Modified Tables
    - `sales_orders` — adds `source_quote_id` (uuid, nullable FK to quotes.id)

  2. Notes
    - Nullable so existing orders and manually created orders are unaffected
    - ON DELETE SET NULL so deleting a quote doesn't delete the sales order
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sales_orders' AND column_name = 'source_quote_id'
  ) THEN
    ALTER TABLE sales_orders ADD COLUMN source_quote_id uuid REFERENCES quotes(id) ON DELETE SET NULL;
  END IF;
END $$;
