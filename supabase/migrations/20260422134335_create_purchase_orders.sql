/*
  # Purchase Orders

  ## New Tables
  - `purchase_orders`
    - `id` (uuid, primary key)
    - `po_number` (varchar, unique) — e.g. PO-0001
    - `vendor_name` (text)
    - `vendor_email` (text, nullable)
    - `order_date` (date)
    - `expected_date` (date, nullable)
    - `status` (varchar) — draft, sent, received, cancelled
    - `notes` (text, nullable)

  - `purchase_order_lines`
    - `id` (uuid, primary key)
    - `purchase_order_id` (uuid, FK)
    - `part_id` (uuid, FK, nullable) — optional link to parts master
    - `description` (text)
    - `quantity` (numeric)
    - `unit_price` (numeric)
    - `quantity_received` (numeric, default 0)

  ## Security
  - RLS enabled, anon full access (matches existing pattern)
*/

CREATE TABLE IF NOT EXISTS purchase_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  po_number varchar NOT NULL UNIQUE,
  vendor_name text NOT NULL,
  vendor_email text,
  order_date date NOT NULL DEFAULT CURRENT_DATE,
  expected_date date,
  status varchar NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','sent','received','partial','cancelled')),
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS purchase_order_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_order_id uuid NOT NULL REFERENCES purchase_orders(id),
  part_id uuid REFERENCES parts(id),
  description text NOT NULL,
  quantity numeric NOT NULL DEFAULT 1,
  unit_price numeric NOT NULL DEFAULT 0,
  quantity_received numeric NOT NULL DEFAULT 0,
  sort_order int DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE purchase_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_order_lines ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'purchase_orders' AND policyname = 'anon can select purchase_orders') THEN
    CREATE POLICY "anon can select purchase_orders" ON purchase_orders FOR SELECT TO anon USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'purchase_orders' AND policyname = 'anon can insert purchase_orders') THEN
    CREATE POLICY "anon can insert purchase_orders" ON purchase_orders FOR INSERT TO anon WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'purchase_orders' AND policyname = 'anon can update purchase_orders') THEN
    CREATE POLICY "anon can update purchase_orders" ON purchase_orders FOR UPDATE TO anon USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'purchase_orders' AND policyname = 'anon can delete purchase_orders') THEN
    CREATE POLICY "anon can delete purchase_orders" ON purchase_orders FOR DELETE TO anon USING (true);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'purchase_order_lines' AND policyname = 'anon can select purchase_order_lines') THEN
    CREATE POLICY "anon can select purchase_order_lines" ON purchase_order_lines FOR SELECT TO anon USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'purchase_order_lines' AND policyname = 'anon can insert purchase_order_lines') THEN
    CREATE POLICY "anon can insert purchase_order_lines" ON purchase_order_lines FOR INSERT TO anon WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'purchase_order_lines' AND policyname = 'anon can update purchase_order_lines') THEN
    CREATE POLICY "anon can update purchase_order_lines" ON purchase_order_lines FOR UPDATE TO anon USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'purchase_order_lines' AND policyname = 'anon can delete purchase_order_lines') THEN
    CREATE POLICY "anon can delete purchase_order_lines" ON purchase_order_lines FOR DELETE TO anon USING (true);
  END IF;
END $$;
