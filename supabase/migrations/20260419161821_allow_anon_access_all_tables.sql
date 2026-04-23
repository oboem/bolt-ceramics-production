/*
  # Allow Anonymous Access for Internal Production Tool

  This is an internal production tracking application that does not require
  user authentication. Update all RLS policies to allow anonymous (anon) role
  access in addition to authenticated users.

  ## Changes
  - Drop existing authenticated-only policies on all tables
  - Add new policies allowing both anon and authenticated roles full CRUD access
  - Tables affected: parts, inventory, sales_orders, sales_order_lines,
    bill_of_materials, production_runs, clay_receipts
*/

-- parts
DROP POLICY IF EXISTS "Authenticated users can read parts" ON parts;
DROP POLICY IF EXISTS "Authenticated users can insert parts" ON parts;
DROP POLICY IF EXISTS "Authenticated users can update parts" ON parts;

CREATE POLICY "Allow all read parts" ON parts FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Allow all insert parts" ON parts FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "Allow all update parts" ON parts FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow all delete parts" ON parts FOR DELETE TO anon, authenticated USING (true);

-- inventory
DROP POLICY IF EXISTS "Authenticated users can read inventory" ON inventory;
DROP POLICY IF EXISTS "Authenticated users can insert inventory" ON inventory;
DROP POLICY IF EXISTS "Authenticated users can update inventory" ON inventory;

CREATE POLICY "Allow all read inventory" ON inventory FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Allow all insert inventory" ON inventory FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "Allow all update inventory" ON inventory FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow all delete inventory" ON inventory FOR DELETE TO anon, authenticated USING (true);

-- sales_orders
DROP POLICY IF EXISTS "Authenticated users can read sales_orders" ON sales_orders;
DROP POLICY IF EXISTS "Authenticated users can insert sales_orders" ON sales_orders;
DROP POLICY IF EXISTS "Authenticated users can update sales_orders" ON sales_orders;

CREATE POLICY "Allow all read sales_orders" ON sales_orders FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Allow all insert sales_orders" ON sales_orders FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "Allow all update sales_orders" ON sales_orders FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow all delete sales_orders" ON sales_orders FOR DELETE TO anon, authenticated USING (true);

-- sales_order_lines
DROP POLICY IF EXISTS "Authenticated users can read sales_order_lines" ON sales_order_lines;
DROP POLICY IF EXISTS "Authenticated users can insert sales_order_lines" ON sales_order_lines;
DROP POLICY IF EXISTS "Authenticated users can update sales_order_lines" ON sales_order_lines;

CREATE POLICY "Allow all read sales_order_lines" ON sales_order_lines FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Allow all insert sales_order_lines" ON sales_order_lines FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "Allow all update sales_order_lines" ON sales_order_lines FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow all delete sales_order_lines" ON sales_order_lines FOR DELETE TO anon, authenticated USING (true);

-- bill_of_materials
DROP POLICY IF EXISTS "Authenticated users can read bill_of_materials" ON bill_of_materials;
DROP POLICY IF EXISTS "Authenticated users can insert bill_of_materials" ON bill_of_materials;
DROP POLICY IF EXISTS "Authenticated users can update bill_of_materials" ON bill_of_materials;

CREATE POLICY "Allow all read bill_of_materials" ON bill_of_materials FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Allow all insert bill_of_materials" ON bill_of_materials FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "Allow all update bill_of_materials" ON bill_of_materials FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow all delete bill_of_materials" ON bill_of_materials FOR DELETE TO anon, authenticated USING (true);

-- production_runs
DROP POLICY IF EXISTS "Authenticated users can read production_runs" ON production_runs;
DROP POLICY IF EXISTS "Authenticated users can insert production_runs" ON production_runs;
DROP POLICY IF EXISTS "Authenticated users can update production_runs" ON production_runs;

CREATE POLICY "Allow all read production_runs" ON production_runs FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Allow all insert production_runs" ON production_runs FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "Allow all update production_runs" ON production_runs FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow all delete production_runs" ON production_runs FOR DELETE TO anon, authenticated USING (true);

-- clay_receipts
DROP POLICY IF EXISTS "Authenticated users can read clay_receipts" ON clay_receipts;
DROP POLICY IF EXISTS "Authenticated users can insert clay_receipts" ON clay_receipts;
DROP POLICY IF EXISTS "Authenticated users can update clay_receipts" ON clay_receipts;

CREATE POLICY "Allow all read clay_receipts" ON clay_receipts FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Allow all insert clay_receipts" ON clay_receipts FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "Allow all update clay_receipts" ON clay_receipts FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow all delete clay_receipts" ON clay_receipts FOR DELETE TO anon, authenticated USING (true);
