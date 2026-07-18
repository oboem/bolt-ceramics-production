/*
  # Fix RLS Security Audit Findings

  This is an internal production tracking application with NO user
  authentication — the frontend uses only the anon key. Per RLS policy
  requirements for a no-auth app, every policy on every table MUST list
  BOTH `anon` AND `authenticated` roles so the data is accessible
  regardless of which role a request runs under.

  ## Audit Findings
  1. Ten tables had policies scoped to `anon` ONLY (missing
     `authenticated`): invoices, invoice_lines, payments, quotes,
     quote_lines, purchase_orders, purchase_order_lines,
     replenishment_orders, inventory_adjustments, workers.
  2. Eleven tables carried duplicate SELECT policies (an "Allow all read"
     policy plus an older "anon full access ... select" policy) left
     behind by overlapping migrations. Redundant policies are confusing
     to audit and can mask intent.

  ## Changes
  - For every table below, drop ALL existing policies and recreate a
    clean set of four CRUD policies (select/insert/update/delete), each
    scoped `TO anon, authenticated`. This normalizes role coverage and
    removes the duplicate SELECT policies in one pass.
  - No schema (column/type) changes — data is untouched.
  - All policies use `USING (true)` / `WITH CHECK (true)` because the
    data is intentionally shared across this single-tenant internal tool
    (no sign-in screen, no per-user isolation). This is the documented
    acceptable use of `true` predicates for a no-auth shared-data app.

  ## Tables Affected (all in `public` schema)
  parts, inventory, sales_orders, sales_order_lines, bill_of_materials,
  production_runs, clay_receipts, clay_purchase_orders, shipments,
  shipment_lines, invoices, invoice_lines, payments, quotes,
  quote_lines, purchase_orders, purchase_order_lines,
  replenishment_orders, inventory_adjustments, workers, tasks.

  ## Notes
  1. Drop-and-recreate is used because `CREATE POLICY` does not support
     `IF NOT EXISTS` reliably and several tables already had conflicting
     policy names from prior migrations. Dropping first guarantees an
     idempotent, consistent end state.
  2. RLS remains enabled on all tables throughout — no table is ever
     left without policies, since each DROP+CREATE block is atomic per
     table and the four policies are recreated together.
*/

-- ===========================================================================
-- Helper: apply clean anon+authenticated CRUD policies to one table.
-- Drops every existing policy on the table first, then recreates four.
-- ===========================================================================
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
    -- Drop all existing policies on this table
    FOR pol IN
      SELECT polname FROM pg_policy
      WHERE polrelid = t::regclass
    LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON %I;', pol.polname, t);
    END LOOP;
  END LOOP;
END $$;

-- ===========================================================================
-- Recreate four clean CRUD policies per table (anon + authenticated)
-- ===========================================================================

-- parts
CREATE POLICY "anon_auth_select_parts" ON parts FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "anon_auth_insert_parts" ON parts FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "anon_auth_update_parts" ON parts FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "anon_auth_delete_parts" ON parts FOR DELETE TO anon, authenticated USING (true);

-- inventory
CREATE POLICY "anon_auth_select_inventory" ON inventory FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "anon_auth_insert_inventory" ON inventory FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "anon_auth_update_inventory" ON inventory FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "anon_auth_delete_inventory" ON inventory FOR DELETE TO anon, authenticated USING (true);

-- sales_orders
CREATE POLICY "anon_auth_select_sales_orders" ON sales_orders FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "anon_auth_insert_sales_orders" ON sales_orders FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "anon_auth_update_sales_orders" ON sales_orders FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "anon_auth_delete_sales_orders" ON sales_orders FOR DELETE TO anon, authenticated USING (true);

-- sales_order_lines
CREATE POLICY "anon_auth_select_sales_order_lines" ON sales_order_lines FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "anon_auth_insert_sales_order_lines" ON sales_order_lines FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "anon_auth_update_sales_order_lines" ON sales_order_lines FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "anon_auth_delete_sales_order_lines" ON sales_order_lines FOR DELETE TO anon, authenticated USING (true);

-- bill_of_materials
CREATE POLICY "anon_auth_select_bill_of_materials" ON bill_of_materials FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "anon_auth_insert_bill_of_materials" ON bill_of_materials FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "anon_auth_update_bill_of_materials" ON bill_of_materials FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "anon_auth_delete_bill_of_materials" ON bill_of_materials FOR DELETE TO anon, authenticated USING (true);

-- production_runs
CREATE POLICY "anon_auth_select_production_runs" ON production_runs FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "anon_auth_insert_production_runs" ON production_runs FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "anon_auth_update_production_runs" ON production_runs FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "anon_auth_delete_production_runs" ON production_runs FOR DELETE TO anon, authenticated USING (true);

-- clay_receipts
CREATE POLICY "anon_auth_select_clay_receipts" ON clay_receipts FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "anon_auth_insert_clay_receipts" ON clay_receipts FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "anon_auth_update_clay_receipts" ON clay_receipts FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "anon_auth_delete_clay_receipts" ON clay_receipts FOR DELETE TO anon, authenticated USING (true);

-- clay_purchase_orders
CREATE POLICY "anon_auth_select_clay_purchase_orders" ON clay_purchase_orders FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "anon_auth_insert_clay_purchase_orders" ON clay_purchase_orders FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "anon_auth_update_clay_purchase_orders" ON clay_purchase_orders FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "anon_auth_delete_clay_purchase_orders" ON clay_purchase_orders FOR DELETE TO anon, authenticated USING (true);

-- shipments
CREATE POLICY "anon_auth_select_shipments" ON shipments FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "anon_auth_insert_shipments" ON shipments FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "anon_auth_update_shipments" ON shipments FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "anon_auth_delete_shipments" ON shipments FOR DELETE TO anon, authenticated USING (true);

-- shipment_lines
CREATE POLICY "anon_auth_select_shipment_lines" ON shipment_lines FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "anon_auth_insert_shipment_lines" ON shipment_lines FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "anon_auth_update_shipment_lines" ON shipment_lines FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "anon_auth_delete_shipment_lines" ON shipment_lines FOR DELETE TO anon, authenticated USING (true);

-- invoices
CREATE POLICY "anon_auth_select_invoices" ON invoices FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "anon_auth_insert_invoices" ON invoices FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "anon_auth_update_invoices" ON invoices FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "anon_auth_delete_invoices" ON invoices FOR DELETE TO anon, authenticated USING (true);

-- invoice_lines
CREATE POLICY "anon_auth_select_invoice_lines" ON invoice_lines FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "anon_auth_insert_invoice_lines" ON invoice_lines FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "anon_auth_update_invoice_lines" ON invoice_lines FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "anon_auth_delete_invoice_lines" ON invoice_lines FOR DELETE TO anon, authenticated USING (true);

-- payments
CREATE POLICY "anon_auth_select_payments" ON payments FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "anon_auth_insert_payments" ON payments FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "anon_auth_update_payments" ON payments FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "anon_auth_delete_payments" ON payments FOR DELETE TO anon, authenticated USING (true);

-- quotes
CREATE POLICY "anon_auth_select_quotes" ON quotes FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "anon_auth_insert_quotes" ON quotes FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "anon_auth_update_quotes" ON quotes FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "anon_auth_delete_quotes" ON quotes FOR DELETE TO anon, authenticated USING (true);

-- quote_lines
CREATE POLICY "anon_auth_select_quote_lines" ON quote_lines FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "anon_auth_insert_quote_lines" ON quote_lines FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "anon_auth_update_quote_lines" ON quote_lines FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "anon_auth_delete_quote_lines" ON quote_lines FOR DELETE TO anon, authenticated USING (true);

-- purchase_orders
CREATE POLICY "anon_auth_select_purchase_orders" ON purchase_orders FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "anon_auth_insert_purchase_orders" ON purchase_orders FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "anon_auth_update_purchase_orders" ON purchase_orders FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "anon_auth_delete_purchase_orders" ON purchase_orders FOR DELETE TO anon, authenticated USING (true);

-- purchase_order_lines
CREATE POLICY "anon_auth_select_purchase_order_lines" ON purchase_order_lines FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "anon_auth_insert_purchase_order_lines" ON purchase_order_lines FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "anon_auth_update_purchase_order_lines" ON purchase_order_lines FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "anon_auth_delete_purchase_order_lines" ON purchase_order_lines FOR DELETE TO anon, authenticated USING (true);

-- replenishment_orders
CREATE POLICY "anon_auth_select_replenishment_orders" ON replenishment_orders FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "anon_auth_insert_replenishment_orders" ON replenishment_orders FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "anon_auth_update_replenishment_orders" ON replenishment_orders FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "anon_auth_delete_replenishment_orders" ON replenishment_orders FOR DELETE TO anon, authenticated USING (true);

-- inventory_adjustments
CREATE POLICY "anon_auth_select_inventory_adjustments" ON inventory_adjustments FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "anon_auth_insert_inventory_adjustments" ON inventory_adjustments FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "anon_auth_update_inventory_adjustments" ON inventory_adjustments FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "anon_auth_delete_inventory_adjustments" ON inventory_adjustments FOR DELETE TO anon, authenticated USING (true);

-- workers
CREATE POLICY "anon_auth_select_workers" ON workers FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "anon_auth_insert_workers" ON workers FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "anon_auth_update_workers" ON workers FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "anon_auth_delete_workers" ON workers FOR DELETE TO anon, authenticated USING (true);

-- tasks
CREATE POLICY "anon_auth_select_tasks" ON tasks FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "anon_auth_insert_tasks" ON tasks FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "anon_auth_update_tasks" ON tasks FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "anon_auth_delete_tasks" ON tasks FOR DELETE TO anon, authenticated USING (true);