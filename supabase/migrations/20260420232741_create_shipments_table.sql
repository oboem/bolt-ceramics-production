/*
  # Create shipments table for order fulfillment tracking

  Records each shipment event against a sales order, allowing partial
  and full fulfillment. Each shipment line references a sales order line
  and records the quantity shipped. When a shipment is recorded, the
  application updates:
    - sales_order_lines.quantity_shipped (incremented)
    - inventory.quantity_on_hand (decremented)

  ## New Tables
  1. `shipments` - Header for each shipment event
    - `id` (uuid, primary key)
    - `sales_order_id` (uuid, FK to sales_orders)
    - `ship_date` (date, defaults to today)
    - `shipping_method` (text, optional - e.g. UPS, FedEx, pickup)
    - `tracking_number` (text, optional)
    - `notes` (text, optional)
    - `created_at` (timestamptz)

  2. `shipment_lines` - Individual line items within a shipment
    - `id` (uuid, primary key)
    - `shipment_id` (uuid, FK to shipments)
    - `sales_order_line_id` (uuid, FK to sales_order_lines)
    - `part_id` (uuid, FK to parts)
    - `quantity_shipped` (decimal)
    - `created_at` (timestamptz)

  ## Security
  - RLS enabled on both tables
  - Anon and authenticated access (internal production tool)
*/

CREATE TABLE IF NOT EXISTS shipments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sales_order_id uuid NOT NULL REFERENCES sales_orders(id),
  ship_date date NOT NULL DEFAULT CURRENT_DATE,
  shipping_method text,
  tracking_number text,
  notes text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE shipments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow read shipments"
  ON shipments FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "Allow insert shipments"
  ON shipments FOR INSERT TO anon, authenticated WITH CHECK (true);

CREATE POLICY "Allow update shipments"
  ON shipments FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Allow delete shipments"
  ON shipments FOR DELETE TO anon, authenticated USING (true);


CREATE TABLE IF NOT EXISTS shipment_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shipment_id uuid NOT NULL REFERENCES shipments(id) ON DELETE CASCADE,
  sales_order_line_id uuid NOT NULL REFERENCES sales_order_lines(id),
  part_id uuid NOT NULL REFERENCES parts(id),
  quantity_shipped decimal(10,2) NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE shipment_lines ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow read shipment_lines"
  ON shipment_lines FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "Allow insert shipment_lines"
  ON shipment_lines FOR INSERT TO anon, authenticated WITH CHECK (true);

CREATE POLICY "Allow update shipment_lines"
  ON shipment_lines FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Allow delete shipment_lines"
  ON shipment_lines FOR DELETE TO anon, authenticated USING (true);
