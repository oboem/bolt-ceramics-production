/*
  # Require authentication for all data access (remove anon RLS)

  ## Why
  A security audit flagged that every write/delete policy on every
  table used `USING (true)` / `WITH CHECK (true)` scoped to the `anon`
  role, granting unauthenticated callers unrestricted read/write/delete
  access to all business data. RLS was enabled but effectively bypassed
  for anyone holding the public anon key.

  ## Change
  Drop ALL existing policies on every public table and recreate a clean
  set of four CRUD policies (select/insert/update/delete) per table,
  each scoped `TO authenticated` only. The anonymous role retains NO
  access to any table. Authenticated staff share all data (this is an
  internal multi-user tool where every signed-in user sees all
  production records), so `USING (true)` / `WITH CHECK (true)` is the
  correct, documented predicate for intentionally shared data among
  authenticated users — it is NOT a bypass because anon is excluded.

  ## Tables Affected (all in `public` schema)
  parts, inventory, sales_orders, sales_order_lines, bill_of_materials,
  production_runs, clay_receipts, clay_purchase_orders, shipments,
  shipment_lines, invoices, invoice_lines, payments, quotes,
  quote_lines, purchase_orders, purchase_order_lines,
  replenishment_orders, inventory_adjustments, workers, tasks.

  ## Notes
  1. No schema (column/type) changes — data is untouched.
  2. Drop-and-recreate is used because prior migrations left a mix of
     "Allow all ..." / "anon full access ..." / "Authenticated users ..."
     policy names. Dropping first guarantees an idempotent, consistent
     end state regardless of what was there before.
  3. The frontend now requires sign-in (email/password via Supabase
     Auth) before any data is fetched; see the auth context and sign-in
     page added in the same change set.
  4. RLS remains enabled on all tables throughout. Each table's four
     policies are recreated together, so no table is left open.
*/

DO $$
DECLARE
  t text;
  tables text[] := ARRAY[
    'parts','inventory','sales_orders','sales_order_lines',
    'bill_of_materials','production_runs','clay_receipts',
    'clay_purchase_orders','shipments','shipment_lines',
    'invoices','invoice_lines','payments','quotes','quote_lines',
    'purchase_orders','purchase_order_lines','replenishment_orders',
    'inventory_adjustments','workers','tasks'
  ];
  pol record;
BEGIN
  FOREACH t IN ARRAY tables LOOP
    FOR pol IN
      SELECT polname FROM pg_policy
      WHERE polrelid = t::regclass
    LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON %I;', pol.polname, t);
    END LOOP;
  END LOOP;
END $$;

-- parts
CREATE POLICY "auth_select_parts" ON parts FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_insert_parts" ON parts FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "auth_update_parts" ON parts FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_delete_parts" ON parts FOR DELETE TO authenticated USING (true);

-- inventory
CREATE POLICY "auth_select_inventory" ON inventory FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_insert_inventory" ON inventory FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "auth_update_inventory" ON inventory FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_delete_inventory" ON inventory FOR DELETE TO authenticated USING (true);

-- sales_orders
CREATE POLICY "auth_select_sales_orders" ON sales_orders FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_insert_sales_orders" ON sales_orders FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "auth_update_sales_orders" ON sales_orders FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_delete_sales_orders" ON sales_orders FOR DELETE TO authenticated USING (true);

-- sales_order_lines
CREATE POLICY "auth_select_sales_order_lines" ON sales_order_lines FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_insert_sales_order_lines" ON sales_order_lines FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "auth_update_sales_order_lines" ON sales_order_lines FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_delete_sales_order_lines" ON sales_order_lines FOR DELETE TO authenticated USING (true);

-- bill_of_materials
CREATE POLICY "auth_select_bill_of_materials" ON bill_of_materials FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_insert_bill_of_materials" ON bill_of_materials FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "auth_update_bill_of_materials" ON bill_of_materials FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_delete_bill_of_materials" ON bill_of_materials FOR DELETE TO authenticated USING (true);

-- production_runs
CREATE POLICY "auth_select_production_runs" ON production_runs FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_insert_production_runs" ON production_runs FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "auth_update_production_runs" ON production_runs FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_delete_production_runs" ON production_runs FOR DELETE TO authenticated USING (true);

-- clay_receipts
CREATE POLICY "auth_select_clay_receipts" ON clay_receipts FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_insert_clay_receipts" ON clay_receipts FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "auth_update_clay_receipts" ON clay_receipts FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_delete_clay_receipts" ON clay_receipts FOR DELETE TO authenticated USING (true);

-- clay_purchase_orders
CREATE POLICY "auth_select_clay_purchase_orders" ON clay_purchase_orders FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_insert_clay_purchase_orders" ON clay_purchase_orders FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "auth_update_clay_purchase_orders" ON clay_purchase_orders FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_delete_clay_purchase_orders" ON clay_purchase_orders FOR DELETE TO authenticated USING (true);

-- shipments
CREATE POLICY "auth_select_shipments" ON shipments FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_insert_shipments" ON shipments FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "auth_update_shipments" ON shipments FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_delete_shipments" ON shipments FOR DELETE TO authenticated USING (true);

-- shipment_lines
CREATE POLICY "auth_select_shipment_lines" ON shipment_lines FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_insert_shipment_lines" ON shipment_lines FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "auth_update_shipment_lines" ON shipment_lines FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_delete_shipment_lines" ON shipment_lines FOR DELETE TO authenticated USING (true);

-- invoices
CREATE POLICY "auth_select_invoices" ON invoices FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_insert_invoices" ON invoices FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "auth_update_invoices" ON invoices FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_delete_invoices" ON invoices FOR DELETE TO authenticated USING (true);

-- invoice_lines
CREATE POLICY "auth_select_invoice_lines" ON invoice_lines FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_insert_invoice_lines" ON invoice_lines FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "auth_update_invoice_lines" ON invoice_lines FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_delete_invoice_lines" ON invoice_lines FOR DELETE TO authenticated USING (true);

-- payments
CREATE POLICY "auth_select_payments" ON payments FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_insert_payments" ON payments FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "auth_update_payments" ON payments FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_delete_payments" ON payments FOR DELETE TO authenticated USING (true);

-- quotes
CREATE POLICY "auth_select_quotes" ON quotes FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_insert_quotes" ON quotes FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "auth_update_quotes" ON quotes FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_delete_quotes" ON quotes FOR DELETE TO authenticated USING (true);

-- quote_lines
CREATE POLICY "auth_select_quote_lines" ON quote_lines FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_insert_quote_lines" ON quote_lines FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "auth_update_quote_lines" ON quote_lines FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_delete_quote_lines" ON quote_lines FOR DELETE TO authenticated USING (true);

-- purchase_orders
CREATE POLICY "auth_select_purchase_orders" ON purchase_orders FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_insert_purchase_orders" ON purchase_orders FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "auth_update_purchase_orders" ON purchase_orders FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_delete_purchase_orders" ON purchase_orders FOR DELETE TO authenticated USING (true);

-- purchase_order_lines
CREATE POLICY "auth_select_purchase_order_lines" ON purchase_order_lines FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_insert_purchase_order_lines" ON purchase_order_lines FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "auth_update_purchase_order_lines" ON purchase_order_lines FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_delete_purchase_order_lines" ON purchase_order_lines FOR DELETE TO authenticated USING (true);

-- replenishment_orders
CREATE POLICY "auth_select_replenishment_orders" ON replenishment_orders FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_insert_replenishment_orders" ON replenishment_orders FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "auth_update_replenishment_orders" ON replenishment_orders FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_delete_replenishment_orders" ON replenishment_orders FOR DELETE TO authenticated USING (true);

-- inventory_adjustments
CREATE POLICY "auth_select_inventory_adjustments" ON inventory_adjustments FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_insert_inventory_adjustments" ON inventory_adjustments FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "auth_update_inventory_adjustments" ON inventory_adjustments FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_delete_inventory_adjustments" ON inventory_adjustments FOR DELETE TO authenticated USING (true);

-- workers
CREATE POLICY "auth_select_workers" ON workers FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_insert_workers" ON workers FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "auth_update_workers" ON workers FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_delete_workers" ON workers FOR DELETE TO authenticated USING (true);

-- tasks
CREATE POLICY "auth_select_tasks" ON tasks FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_insert_tasks" ON tasks FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "auth_update_tasks" ON tasks FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_delete_tasks" ON tasks FOR DELETE TO authenticated USING (true);