/*
  # Ceramics Production Tracking Schema

  ## Overview
  Full production tracking system for a ceramics business with the following
  part number conventions:
    - 1xxx: Drawings and designs
    - 2xxx: Jigger blades
    - 3xxx: Plaster molds
    - 5xxx: Clay types
    - 6xxx: Bisqueware (intermediate fired inventory)
    - 7xxx: Glazes
    - 8xxx: Finished parts

  ## New Tables
  1. `parts` - Master parts list for all part numbers
  2. `inventory` - Current on-hand quantities per part
  3. `sales_orders` - Customer sales order headers
  4. `sales_order_lines` - Line items on each sales order
  5. `bill_of_materials` - Component relationships (e.g., clay per finished part)
  6. `production_runs` - Daily production tracking records
  7. `clay_receipts` - Incoming clay purchase records

  ## Security
  - RLS enabled on all tables
  - Policies allow authenticated users full access to their data
*/

CREATE TABLE IF NOT EXISTS parts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  part_number varchar(10) UNIQUE NOT NULL,
  description text NOT NULL,
  unit varchar(20) DEFAULT 'ea',
  active boolean DEFAULT true,
  notes text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE parts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read parts"
  ON parts FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert parts"
  ON parts FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update parts"
  ON parts FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS inventory (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  part_id uuid NOT NULL REFERENCES parts(id) ON DELETE CASCADE,
  quantity_on_hand decimal(12,2) DEFAULT 0,
  reorder_point decimal(12,2) DEFAULT 0,
  reorder_quantity decimal(12,2) DEFAULT 0,
  location varchar(50),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(part_id)
);

ALTER TABLE inventory ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read inventory"
  ON inventory FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert inventory"
  ON inventory FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update inventory"
  ON inventory FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS sales_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number varchar(20) UNIQUE NOT NULL,
  customer_name text NOT NULL,
  order_date date NOT NULL DEFAULT CURRENT_DATE,
  required_ship_date date,
  status varchar(20) DEFAULT 'open' CHECK (status IN ('open','in_progress','shipped','cancelled')),
  notes text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE sales_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read sales_orders"
  ON sales_orders FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert sales_orders"
  ON sales_orders FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update sales_orders"
  ON sales_orders FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS sales_order_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sales_order_id uuid NOT NULL REFERENCES sales_orders(id) ON DELETE CASCADE,
  part_id uuid NOT NULL REFERENCES parts(id),
  quantity_ordered decimal(10,2) NOT NULL,
  quantity_completed decimal(10,2) DEFAULT 0,
  quantity_shipped decimal(10,2) DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE sales_order_lines ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read sales_order_lines"
  ON sales_order_lines FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert sales_order_lines"
  ON sales_order_lines FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update sales_order_lines"
  ON sales_order_lines FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS bill_of_materials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_part_id uuid NOT NULL REFERENCES parts(id) ON DELETE CASCADE,
  component_part_id uuid NOT NULL REFERENCES parts(id),
  quantity decimal(10,4) NOT NULL,
  unit varchar(20) DEFAULT 'ea',
  notes text,
  created_at timestamptz DEFAULT now(),
  UNIQUE(parent_part_id, component_part_id)
);

ALTER TABLE bill_of_materials ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read bill_of_materials"
  ON bill_of_materials FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert bill_of_materials"
  ON bill_of_materials FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update bill_of_materials"
  ON bill_of_materials FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS production_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_date date NOT NULL DEFAULT CURRENT_DATE,
  part_id uuid NOT NULL REFERENCES parts(id),
  quantity_planned decimal(10,2) DEFAULT 0,
  quantity_completed decimal(10,2) DEFAULT 0,
  clay_part_id uuid REFERENCES parts(id),
  clay_used_lbs decimal(10,2) DEFAULT 0,
  mold_part_id uuid REFERENCES parts(id),
  blade_part_id uuid REFERENCES parts(id),
  notes text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE production_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read production_runs"
  ON production_runs FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert production_runs"
  ON production_runs FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update production_runs"
  ON production_runs FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS clay_receipts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clay_part_id uuid NOT NULL REFERENCES parts(id),
  receipt_date date NOT NULL DEFAULT CURRENT_DATE,
  quantity_lbs decimal(10,2) NOT NULL,
  supplier text,
  purchase_order varchar(30),
  unit_cost decimal(10,4),
  notes text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE clay_receipts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read clay_receipts"
  ON clay_receipts FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert clay_receipts"
  ON clay_receipts FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update clay_receipts"
  ON clay_receipts FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
