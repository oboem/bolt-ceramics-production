/*
  # Create clay_purchase_orders table

  Tracks clay purchase orders from placement through receipt.

  ## New Table
  - `clay_purchase_orders`
    - `id` (uuid, primary key)
    - `clay_part_id` (uuid, FK to parts)
    - `order_date` (date)
    - `quantity_lbs` (decimal)
    - `supplier` (text, optional)
    - `purchase_order` (varchar, optional PO number)
    - `status` (varchar) — 'pending', 'ordered', 'received'
    - `notes` (text, optional)
    - `created_at` (timestamptz)

  ## Security
  - RLS enabled with anon + authenticated full access (internal tool)
*/

CREATE TABLE IF NOT EXISTS clay_purchase_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clay_part_id uuid NOT NULL REFERENCES parts(id),
  order_date date NOT NULL DEFAULT CURRENT_DATE,
  quantity_lbs decimal(10,2) NOT NULL,
  supplier text,
  purchase_order varchar(30),
  status varchar(20) DEFAULT 'ordered' CHECK (status IN ('pending','ordered','received')),
  notes text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE clay_purchase_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all read clay_purchase_orders"
  ON clay_purchase_orders FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "Allow all insert clay_purchase_orders"
  ON clay_purchase_orders FOR INSERT TO anon, authenticated WITH CHECK (true);

CREATE POLICY "Allow all update clay_purchase_orders"
  ON clay_purchase_orders FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Allow all delete clay_purchase_orders"
  ON clay_purchase_orders FOR DELETE TO anon, authenticated USING (true);
