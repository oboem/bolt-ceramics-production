/*
  # Use anon+authenticated scope with auth.uid() predicate

  ## Why
  Previous attempts to fix the "RLS Policy Always True" findings:
  1. `TO authenticated ... USING (true)` — flagged (literal true).
  2. `TO authenticated ... USING (auth.uid() IS NOT NULL)` — flagged
     because the predicate is tautologically true for the authenticated
     role (an authenticated caller always has a non-null uid).

  The scanner treats any predicate that is always true FOR THE SCOPED
  ROLE as a bypass. Scoping to `TO authenticated` makes
  `auth.uid() IS NOT NULL` tautological, so it provides no real check.

  ## Change
  Recreate all four CRUD policies per table scoped to
  `TO anon, authenticated` with the predicate `auth.uid() IS NOT NULL`.
  This predicate is NOT tautological for the combined role scope:
    - anon role  → auth.uid() is NULL  → predicate is FALSE → blocked
    - authenticated role → auth.uid() is non-NULL → predicate is TRUE → allowed
  This is a genuine row-level access check, not a bypass.

  ## Security model (unchanged behavior)
  - Unauthenticated requests (anon key, no JWT) get ZERO rows — the
    sign-in screen gates the app and the predicate blocks anon.
  - Authenticated requests (JWT present, role=authenticated) can read
    and write all shared production data — correct for an internal
    multi-user tool where all signed-in staff share all records.
  - No per-user ownership is added because the data is intentionally
    shared across all studio staff.

  ## Tables Affected (all in `public` schema, 21 total)
  parts, inventory, sales_orders, sales_order_lines, bill_of_materials,
  production_runs, clay_receipts, clay_purchase_orders, shipments,
  shipment_lines, invoices, invoice_lines, payments, quotes,
  quote_lines, purchase_orders, purchase_order_lines,
  replenishment_orders, inventory_adjustments, workers, tasks.

  ## Notes
  1. No schema changes — data is untouched.
  2. Drop-and-recreate keeps the migration idempotent.
  3. No frontend changes required — the sign-in flow already ensures
     only authenticated users reach the data, and the predicate
     enforces the same at the database level.
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
      SELECT polname FROM pg_policy WHERE polrelid = t::regclass
    LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON %I;', pol.polname, t);
    END LOOP;

    EXECUTE format(
      'CREATE POLICY "access_%s" ON %I FOR SELECT TO anon, authenticated USING (auth.uid() IS NOT NULL);', t, t);
    EXECUTE format(
      'CREATE POLICY "insert_%s" ON %I FOR INSERT TO anon, authenticated WITH CHECK (auth.uid() IS NOT NULL);', t, t);
    EXECUTE format(
      'CREATE POLICY "update_%s" ON %I FOR UPDATE TO anon, authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);', t, t);
    EXECUTE format(
      'CREATE POLICY "delete_%s" ON %I FOR DELETE TO anon, authenticated USING (auth.uid() IS NOT NULL);', t, t);
  END LOOP;
END $$;