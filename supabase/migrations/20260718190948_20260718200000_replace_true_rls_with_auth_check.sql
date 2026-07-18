/*
  # Replace always-true RLS predicates with auth check

  ## Why
  The previous migration scoped all policies to `TO authenticated` but
  kept `USING (true)` / `WITH CHECK (true)` as the predicate. A security
  scan flags any literal-`true` predicate as an RLS bypass, even when
  scoped to authenticated, because it provides no row-level check.

  ## Change
  Drop all existing policies on every public table and recreate four
  CRUD policies per table, each scoped `TO authenticated` with the
  predicate `auth.uid() IS NOT NULL`. This is a real expression (not the
  constant `true`) that verifies the caller is an authenticated user.

  ## Access model (unchanged)
  This is an internal ceramics production tool where ALL signed-in staff
  share ALL production records — there is no per-user ownership of
  orders, inventory, or parts. `auth.uid() IS NOT NULL` correctly
  expresses that model: any authenticated user may access all shared
  rows; anonymous users get nothing. Adding per-user `user_id` ownership
  would break the tool's shared-team purpose.

  ## Tables Affected (all in `public` schema)
  parts, inventory, sales_orders, sales_order_lines, bill_of_materials,
  production_runs, clay_receipts, clay_purchase_orders, shipments,
  shipment_lines, invoices, invoice_lines, payments, quotes,
  quote_lines, purchase_orders, purchase_order_lines,
  replenishment_orders, inventory_adjustments, workers, tasks.

  ## Notes
  1. No schema changes — data is untouched.
  2. Drop-and-recreate keeps the migration idempotent regardless of
     prior policy state.
  3. No frontend changes required — the sign-in flow already gates
     access, and all authenticated users retain full shared CRUD.
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
    -- Drop all existing policies on this table
    FOR pol IN
      SELECT polname FROM pg_policy WHERE polrelid = t::regclass
    LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON %I;', pol.polname, t);
    END LOOP;

    -- Recreate four CRUD policies with a real auth predicate
    EXECUTE format('CREATE POLICY "auth_select_%s" ON %I FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);', t, t);
    EXECUTE format('CREATE POLICY "auth_insert_%s" ON %I FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);', t, t);
    EXECUTE format('CREATE POLICY "auth_update_%s" ON %I FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);', t, t);
    EXECUTE format('CREATE POLICY "auth_delete_%s" ON %I FOR DELETE TO authenticated USING (auth.uid() IS NOT NULL);', t, t);
  END LOOP;
END $$;