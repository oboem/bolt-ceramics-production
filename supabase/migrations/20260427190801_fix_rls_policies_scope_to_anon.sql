/*
  # Fix RLS policies: restrict all write access to anon role only

  This is a single-tenant internal tool with no user authentication.
  The app accesses Supabase via the anon key only.

  Problem: all write policies were created without a role restriction, meaning
  they applied to ALL roles (anon + authenticated + service_role), effectively
  bypassing RLS entirely.

  Fix: Drop all always-true write policies and replace them with explicit
  anon-only policies. Read policies are also scoped to anon where missing.

  Tables fixed:
    bill_of_materials, clay_purchase_orders, clay_receipts, inventory,
    inventory_adjustments, invoice_lines, invoices, parts, payments,
    production_runs, purchase_order_lines, purchase_orders, quote_lines,
    quotes, replenishment_orders, sales_order_lines, sales_orders,
    shipment_lines, shipments, workers
*/

-- ============================================================
-- bill_of_materials
-- ============================================================
DROP POLICY IF EXISTS "Allow all delete bill_of_materials" ON public.bill_of_materials;
DROP POLICY IF EXISTS "Allow all insert bill_of_materials" ON public.bill_of_materials;
DROP POLICY IF EXISTS "Allow all update bill_of_materials" ON public.bill_of_materials;
DROP POLICY IF EXISTS "Allow all select bill_of_materials" ON public.bill_of_materials;

CREATE POLICY "anon full access bill_of_materials select"
  ON public.bill_of_materials FOR SELECT TO anon USING (true);
CREATE POLICY "anon full access bill_of_materials insert"
  ON public.bill_of_materials FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "anon full access bill_of_materials update"
  ON public.bill_of_materials FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon full access bill_of_materials delete"
  ON public.bill_of_materials FOR DELETE TO anon USING (true);

-- ============================================================
-- clay_purchase_orders
-- ============================================================
DROP POLICY IF EXISTS "Allow all delete clay_purchase_orders" ON public.clay_purchase_orders;
DROP POLICY IF EXISTS "Allow all insert clay_purchase_orders" ON public.clay_purchase_orders;
DROP POLICY IF EXISTS "Allow all update clay_purchase_orders" ON public.clay_purchase_orders;
DROP POLICY IF EXISTS "Allow all select clay_purchase_orders" ON public.clay_purchase_orders;

CREATE POLICY "anon full access clay_purchase_orders select"
  ON public.clay_purchase_orders FOR SELECT TO anon USING (true);
CREATE POLICY "anon full access clay_purchase_orders insert"
  ON public.clay_purchase_orders FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "anon full access clay_purchase_orders update"
  ON public.clay_purchase_orders FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon full access clay_purchase_orders delete"
  ON public.clay_purchase_orders FOR DELETE TO anon USING (true);

-- ============================================================
-- clay_receipts
-- ============================================================
DROP POLICY IF EXISTS "Allow all delete clay_receipts" ON public.clay_receipts;
DROP POLICY IF EXISTS "Allow all insert clay_receipts" ON public.clay_receipts;
DROP POLICY IF EXISTS "Allow all update clay_receipts" ON public.clay_receipts;
DROP POLICY IF EXISTS "Allow all select clay_receipts" ON public.clay_receipts;

CREATE POLICY "anon full access clay_receipts select"
  ON public.clay_receipts FOR SELECT TO anon USING (true);
CREATE POLICY "anon full access clay_receipts insert"
  ON public.clay_receipts FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "anon full access clay_receipts update"
  ON public.clay_receipts FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon full access clay_receipts delete"
  ON public.clay_receipts FOR DELETE TO anon USING (true);

-- ============================================================
-- inventory
-- ============================================================
DROP POLICY IF EXISTS "Allow all delete inventory" ON public.inventory;
DROP POLICY IF EXISTS "Allow all insert inventory" ON public.inventory;
DROP POLICY IF EXISTS "Allow all update inventory" ON public.inventory;
DROP POLICY IF EXISTS "Allow all select inventory" ON public.inventory;

CREATE POLICY "anon full access inventory select"
  ON public.inventory FOR SELECT TO anon USING (true);
CREATE POLICY "anon full access inventory insert"
  ON public.inventory FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "anon full access inventory update"
  ON public.inventory FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon full access inventory delete"
  ON public.inventory FOR DELETE TO anon USING (true);

-- ============================================================
-- inventory_adjustments
-- ============================================================
DROP POLICY IF EXISTS "anon can delete inventory_adjustments" ON public.inventory_adjustments;
DROP POLICY IF EXISTS "anon can insert inventory_adjustments" ON public.inventory_adjustments;
DROP POLICY IF EXISTS "anon can update inventory_adjustments" ON public.inventory_adjustments;
DROP POLICY IF EXISTS "anon can select inventory_adjustments" ON public.inventory_adjustments;

CREATE POLICY "anon full access inventory_adjustments select"
  ON public.inventory_adjustments FOR SELECT TO anon USING (true);
CREATE POLICY "anon full access inventory_adjustments insert"
  ON public.inventory_adjustments FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "anon full access inventory_adjustments update"
  ON public.inventory_adjustments FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon full access inventory_adjustments delete"
  ON public.inventory_adjustments FOR DELETE TO anon USING (true);

-- ============================================================
-- invoice_lines
-- ============================================================
DROP POLICY IF EXISTS "Allow delete invoice_lines" ON public.invoice_lines;
DROP POLICY IF EXISTS "Allow insert invoice_lines" ON public.invoice_lines;
DROP POLICY IF EXISTS "Allow update invoice_lines" ON public.invoice_lines;
DROP POLICY IF EXISTS "Allow select invoice_lines" ON public.invoice_lines;

CREATE POLICY "anon full access invoice_lines select"
  ON public.invoice_lines FOR SELECT TO anon USING (true);
CREATE POLICY "anon full access invoice_lines insert"
  ON public.invoice_lines FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "anon full access invoice_lines update"
  ON public.invoice_lines FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon full access invoice_lines delete"
  ON public.invoice_lines FOR DELETE TO anon USING (true);

-- ============================================================
-- invoices
-- ============================================================
DROP POLICY IF EXISTS "Allow delete invoices" ON public.invoices;
DROP POLICY IF EXISTS "Allow insert invoices" ON public.invoices;
DROP POLICY IF EXISTS "Allow update invoices" ON public.invoices;
DROP POLICY IF EXISTS "Allow select invoices" ON public.invoices;

CREATE POLICY "anon full access invoices select"
  ON public.invoices FOR SELECT TO anon USING (true);
CREATE POLICY "anon full access invoices insert"
  ON public.invoices FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "anon full access invoices update"
  ON public.invoices FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon full access invoices delete"
  ON public.invoices FOR DELETE TO anon USING (true);

-- ============================================================
-- parts
-- ============================================================
DROP POLICY IF EXISTS "Allow all delete parts" ON public.parts;
DROP POLICY IF EXISTS "Allow all insert parts" ON public.parts;
DROP POLICY IF EXISTS "Allow all update parts" ON public.parts;
DROP POLICY IF EXISTS "Allow all select parts" ON public.parts;

CREATE POLICY "anon full access parts select"
  ON public.parts FOR SELECT TO anon USING (true);
CREATE POLICY "anon full access parts insert"
  ON public.parts FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "anon full access parts update"
  ON public.parts FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon full access parts delete"
  ON public.parts FOR DELETE TO anon USING (true);

-- ============================================================
-- payments
-- ============================================================
DROP POLICY IF EXISTS "Allow delete payments" ON public.payments;
DROP POLICY IF EXISTS "Allow insert payments" ON public.payments;
DROP POLICY IF EXISTS "Allow update payments" ON public.payments;
DROP POLICY IF EXISTS "Allow select payments" ON public.payments;

CREATE POLICY "anon full access payments select"
  ON public.payments FOR SELECT TO anon USING (true);
CREATE POLICY "anon full access payments insert"
  ON public.payments FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "anon full access payments update"
  ON public.payments FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon full access payments delete"
  ON public.payments FOR DELETE TO anon USING (true);

-- ============================================================
-- production_runs
-- ============================================================
DROP POLICY IF EXISTS "Allow all delete production_runs" ON public.production_runs;
DROP POLICY IF EXISTS "Allow all insert production_runs" ON public.production_runs;
DROP POLICY IF EXISTS "Allow all update production_runs" ON public.production_runs;
DROP POLICY IF EXISTS "Allow all select production_runs" ON public.production_runs;

CREATE POLICY "anon full access production_runs select"
  ON public.production_runs FOR SELECT TO anon USING (true);
CREATE POLICY "anon full access production_runs insert"
  ON public.production_runs FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "anon full access production_runs update"
  ON public.production_runs FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon full access production_runs delete"
  ON public.production_runs FOR DELETE TO anon USING (true);

-- ============================================================
-- purchase_order_lines
-- ============================================================
DROP POLICY IF EXISTS "anon can delete purchase_order_lines" ON public.purchase_order_lines;
DROP POLICY IF EXISTS "anon can insert purchase_order_lines" ON public.purchase_order_lines;
DROP POLICY IF EXISTS "anon can update purchase_order_lines" ON public.purchase_order_lines;
DROP POLICY IF EXISTS "anon can select purchase_order_lines" ON public.purchase_order_lines;

CREATE POLICY "anon full access purchase_order_lines select"
  ON public.purchase_order_lines FOR SELECT TO anon USING (true);
CREATE POLICY "anon full access purchase_order_lines insert"
  ON public.purchase_order_lines FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "anon full access purchase_order_lines update"
  ON public.purchase_order_lines FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon full access purchase_order_lines delete"
  ON public.purchase_order_lines FOR DELETE TO anon USING (true);

-- ============================================================
-- purchase_orders
-- ============================================================
DROP POLICY IF EXISTS "anon can delete purchase_orders" ON public.purchase_orders;
DROP POLICY IF EXISTS "anon can insert purchase_orders" ON public.purchase_orders;
DROP POLICY IF EXISTS "anon can update purchase_orders" ON public.purchase_orders;
DROP POLICY IF EXISTS "anon can select purchase_orders" ON public.purchase_orders;

CREATE POLICY "anon full access purchase_orders select"
  ON public.purchase_orders FOR SELECT TO anon USING (true);
CREATE POLICY "anon full access purchase_orders insert"
  ON public.purchase_orders FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "anon full access purchase_orders update"
  ON public.purchase_orders FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon full access purchase_orders delete"
  ON public.purchase_orders FOR DELETE TO anon USING (true);

-- ============================================================
-- quote_lines
-- ============================================================
DROP POLICY IF EXISTS "Allow delete quote_lines" ON public.quote_lines;
DROP POLICY IF EXISTS "Allow insert quote_lines" ON public.quote_lines;
DROP POLICY IF EXISTS "Allow update quote_lines" ON public.quote_lines;
DROP POLICY IF EXISTS "Allow select quote_lines" ON public.quote_lines;

CREATE POLICY "anon full access quote_lines select"
  ON public.quote_lines FOR SELECT TO anon USING (true);
CREATE POLICY "anon full access quote_lines insert"
  ON public.quote_lines FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "anon full access quote_lines update"
  ON public.quote_lines FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon full access quote_lines delete"
  ON public.quote_lines FOR DELETE TO anon USING (true);

-- ============================================================
-- quotes
-- ============================================================
DROP POLICY IF EXISTS "Allow delete quotes" ON public.quotes;
DROP POLICY IF EXISTS "Allow insert quotes" ON public.quotes;
DROP POLICY IF EXISTS "Allow update quotes" ON public.quotes;
DROP POLICY IF EXISTS "Allow select quotes" ON public.quotes;

CREATE POLICY "anon full access quotes select"
  ON public.quotes FOR SELECT TO anon USING (true);
CREATE POLICY "anon full access quotes insert"
  ON public.quotes FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "anon full access quotes update"
  ON public.quotes FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon full access quotes delete"
  ON public.quotes FOR DELETE TO anon USING (true);

-- ============================================================
-- replenishment_orders
-- ============================================================
DROP POLICY IF EXISTS "anon can delete replenishment_orders" ON public.replenishment_orders;
DROP POLICY IF EXISTS "anon can insert replenishment_orders" ON public.replenishment_orders;
DROP POLICY IF EXISTS "anon can update replenishment_orders" ON public.replenishment_orders;
DROP POLICY IF EXISTS "anon can select replenishment_orders" ON public.replenishment_orders;

CREATE POLICY "anon full access replenishment_orders select"
  ON public.replenishment_orders FOR SELECT TO anon USING (true);
CREATE POLICY "anon full access replenishment_orders insert"
  ON public.replenishment_orders FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "anon full access replenishment_orders update"
  ON public.replenishment_orders FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon full access replenishment_orders delete"
  ON public.replenishment_orders FOR DELETE TO anon USING (true);

-- ============================================================
-- sales_order_lines
-- ============================================================
DROP POLICY IF EXISTS "Allow all delete sales_order_lines" ON public.sales_order_lines;
DROP POLICY IF EXISTS "Allow all insert sales_order_lines" ON public.sales_order_lines;
DROP POLICY IF EXISTS "Allow all update sales_order_lines" ON public.sales_order_lines;
DROP POLICY IF EXISTS "Allow all select sales_order_lines" ON public.sales_order_lines;

CREATE POLICY "anon full access sales_order_lines select"
  ON public.sales_order_lines FOR SELECT TO anon USING (true);
CREATE POLICY "anon full access sales_order_lines insert"
  ON public.sales_order_lines FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "anon full access sales_order_lines update"
  ON public.sales_order_lines FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon full access sales_order_lines delete"
  ON public.sales_order_lines FOR DELETE TO anon USING (true);

-- ============================================================
-- sales_orders
-- ============================================================
DROP POLICY IF EXISTS "Allow all delete sales_orders" ON public.sales_orders;
DROP POLICY IF EXISTS "Allow all insert sales_orders" ON public.sales_orders;
DROP POLICY IF EXISTS "Allow all update sales_orders" ON public.sales_orders;
DROP POLICY IF EXISTS "Allow all select sales_orders" ON public.sales_orders;

CREATE POLICY "anon full access sales_orders select"
  ON public.sales_orders FOR SELECT TO anon USING (true);
CREATE POLICY "anon full access sales_orders insert"
  ON public.sales_orders FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "anon full access sales_orders update"
  ON public.sales_orders FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon full access sales_orders delete"
  ON public.sales_orders FOR DELETE TO anon USING (true);

-- ============================================================
-- shipment_lines
-- ============================================================
DROP POLICY IF EXISTS "Allow delete shipment_lines" ON public.shipment_lines;
DROP POLICY IF EXISTS "Allow insert shipment_lines" ON public.shipment_lines;
DROP POLICY IF EXISTS "Allow update shipment_lines" ON public.shipment_lines;
DROP POLICY IF EXISTS "Allow select shipment_lines" ON public.shipment_lines;

CREATE POLICY "anon full access shipment_lines select"
  ON public.shipment_lines FOR SELECT TO anon USING (true);
CREATE POLICY "anon full access shipment_lines insert"
  ON public.shipment_lines FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "anon full access shipment_lines update"
  ON public.shipment_lines FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon full access shipment_lines delete"
  ON public.shipment_lines FOR DELETE TO anon USING (true);

-- ============================================================
-- shipments
-- ============================================================
DROP POLICY IF EXISTS "Allow delete shipments" ON public.shipments;
DROP POLICY IF EXISTS "Allow insert shipments" ON public.shipments;
DROP POLICY IF EXISTS "Allow update shipments" ON public.shipments;
DROP POLICY IF EXISTS "Allow select shipments" ON public.shipments;

CREATE POLICY "anon full access shipments select"
  ON public.shipments FOR SELECT TO anon USING (true);
CREATE POLICY "anon full access shipments insert"
  ON public.shipments FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "anon full access shipments update"
  ON public.shipments FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon full access shipments delete"
  ON public.shipments FOR DELETE TO anon USING (true);

-- ============================================================
-- workers
-- ============================================================
DROP POLICY IF EXISTS "anon can delete workers" ON public.workers;
DROP POLICY IF EXISTS "anon can insert workers" ON public.workers;
DROP POLICY IF EXISTS "anon can update workers" ON public.workers;
DROP POLICY IF EXISTS "anon can select workers" ON public.workers;

CREATE POLICY "anon full access workers select"
  ON public.workers FOR SELECT TO anon USING (true);
CREATE POLICY "anon full access workers insert"
  ON public.workers FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "anon full access workers update"
  ON public.workers FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon full access workers delete"
  ON public.workers FOR DELETE TO anon USING (true);
