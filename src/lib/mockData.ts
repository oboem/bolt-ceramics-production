// Realistic mock data for a ceramics production ERP.
// Generated once at module load; mutations during the session are applied
// to the in-memory store so the UI behaves exactly like the real backend.

function rid(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().split('T')[0];
}
function daysAhead(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().split('T')[0];
}
function tsDaysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString();
}

// ── Parts ────────────────────────────────────────────────────────────────
// Part number convention:
//   1xxx drawing, 2xxx blade, 3xxx mold, 5xxx clay,
//   6xxx bisqueware, 7xxx glaze, 8xxx finished

interface PartRow {
  id: string; part_number: string; description: string; unit: string;
  active: boolean; notes: string | null; created_at: string;
  unit_price: number | null; cost_price: number | null; minutes_per_piece: number;
}

const partDefs: [string, string, string, number, number, number][] = [
  // part_number, description, unit, unit_price, cost_price, minutes_per_piece
  // Clay
  ['5001', 'Stoneware Clay – Brown', 'lbs', 0.85, 0.45, 0],
  ['5002', 'Stoneware Clay – White', 'lbs', 0.92, 0.52, 0],
  ['5003', 'Porcelain Clay', 'lbs', 1.15, 0.68, 0],
  ['5004', 'Earthenware Clay – Red', 'lbs', 0.78, 0.40, 0],
  // Bisqueware (intermediate)
  ['6001', 'Bisque Mug 12oz', 'ea', 4.50, 2.10, 3],
  ['6002', 'Bisque Bowl 8in', 'ea', 5.25, 2.40, 4],
  ['6003', 'Bisque Plate 10in', 'ea', 6.00, 2.80, 5],
  ['6004', 'Bisque Vase 6in', 'ea', 8.50, 3.90, 7],
  ['6005', 'Bisque Pitcher', 'ea', 12.00, 5.50, 12],
  // Glaze
  ['7001', 'Glaze – Gloss Clear', 'gal', 28.00, 16.00, 0],
  ['7002', 'Glaze – Matte White', 'gal', 32.00, 18.50, 0],
  ['7003', 'Glaze – Speckled Blue', 'gal', 35.00, 20.00, 0],
  ['7004', 'Glaze – Rust Iron', 'gal', 30.00, 17.00, 0],
  // Molds
  ['3001', 'Plaster Mold – Mug', 'ea', 0, 0, 0],
  ['3002', 'Plaster Mold – Bowl', 'ea', 0, 0, 0],
  ['3003', 'Plaster Mold – Plate', 'ea', 0, 0, 0],
  // Blades
  ['2001', 'Jigger Blade – Mug', 'ea', 0, 0, 0],
  ['2002', 'Jigger Blade – Bowl', 'ea', 0, 0, 0],
  // Drawings
  ['1001', 'Drawing – Mug Profile', 'ea', 0, 0, 0],
  ['1002', 'Drawing – Bowl Profile', 'ea', 0, 0, 0],
  // Finished goods
  ['8001', 'Mug 12oz – Speckled Blue', 'ea', 18.00, 6.80, 8],
  ['8002', 'Mug 12oz – Matte White', 'ea', 18.00, 6.80, 8],
  ['8003', 'Bowl 8in – Gloss Clear', 'ea', 24.00, 8.20, 10],
  ['8004', 'Bowl 8in – Speckled Blue', 'ea', 26.00, 8.50, 10],
  ['8005', 'Plate 10in – Rust Iron', 'ea', 32.00, 10.50, 12],
  ['8006', 'Vase 6in – Matte White', 'ea', 45.00, 14.00, 15],
  ['8007', 'Pitcher – Gloss Clear', 'ea', 65.00, 22.00, 20],
  ['8008', 'Mug 12oz – Rust Iron', 'ea', 20.00, 7.20, 8],
];

const parts: PartRow[] = partDefs.map(([pn, desc, unit, price, cost, mpp]) => ({
  id: rid(), part_number: pn, description: desc, unit,
  active: true, notes: null, created_at: tsDaysAgo(120),
  unit_price: price, cost_price: cost, minutes_per_piece: mpp,
}));

const partById: Record<string, PartRow> = Object.fromEntries(parts.map(p => [p.id, p]));
const partByNumber: Record<string, PartRow> = Object.fromEntries(parts.map(p => [p.part_number, p]));

// ── Inventory ──────────────────────────────────────────────────────────────
interface InvRow {
  id: string; part_id: string; quantity_on_hand: number; reorder_point: number;
  reorder_quantity: number; location: string | null; updated_at: string;
}

const invSpec: [string, number, number, number, string][] = [
  // part_number, qty_on_hand, reorder_point, reorder_qty, location
  ['5001', 340, 200, 500, 'Clay Storage A'],
  ['5002', 180, 200, 500, 'Clay Storage A'],
  ['5003', 95, 100, 300, 'Clay Storage B'],
  ['5004', 420, 150, 400, 'Clay Storage A'],
  ['6001', 48, 30, 100, 'Bisque Shelf 1'],
  ['6002', 72, 40, 120, 'Bisque Shelf 2'],
  ['6003', 35, 30, 100, 'Bisque Shelf 3'],
  ['6004', 18, 20, 60, 'Bisque Shelf 4'],
  ['6005', 8, 10, 30, 'Bisque Shelf 4'],
  ['7001', 12, 5, 20, 'Glaze Cabinet 1'],
  ['7002', 8, 5, 20, 'Glaze Cabinet 1'],
  ['7003', 4, 5, 15, 'Glaze Cabinet 2'],
  ['7004', 9, 5, 15, 'Glaze Cabinet 2'],
  ['8001', 65, 40, 150, 'Finished A1'],
  ['8002', 32, 40, 150, 'Finished A1'],
  ['8003', 48, 30, 100, 'Finished A2'],
  ['8004', 22, 30, 100, 'Finished A2'],
  ['8005', 14, 20, 80, 'Finished B1'],
  ['8006', 9, 15, 60, 'Finished B2'],
  ['8007', 6, 10, 40, 'Finished B3'],
  ['8008', 41, 30, 100, 'Finished A1'],
];

const inventory: InvRow[] = invSpec.map(([pn, qoh, rp, rq, loc]) => ({
  id: rid(), part_id: partByNumber[pn].id,
  quantity_on_hand: qoh, reorder_point: rp, reorder_quantity: rq,
  location: loc, updated_at: tsDaysAgo(1),
}));

// ── Workers ────────────────────────────────────────────────────────────────
interface WorkerRow { id: string; name: string; active: boolean; created_at: string; capacity_minutes_per_day: number }

const workerNames = ['Maria Gonzalez', 'Tom Parker', 'Jenny Liu', 'Carlos Ramirez', 'Diane Foster'];
const workers: WorkerRow[] = workerNames.map((name, i) => ({
  id: rid(), name, active: true, created_at: tsDaysAgo(90),
  capacity_minutes_per_day: [480, 480, 420, 360, 480][i],
}));

// ── Customers ──────────────────────────────────────────────────────────────
const customers = [
  { name: 'Heath Ceramics', email: 'orders@heathceramics.com' },
  { name: 'Crate & Barrel', email: 'purchasing@crateandbarrel.com' },
  { name: 'West Elm', email: 'buying@westelm.com' },
  { name: 'Local Art Co-op', email: 'hello@localartcoop.com' },
  { name: 'Blue Door Gallery', email: 'sales@bluedoorgallery.com' },
  { name: 'Riverside Cafe', email: 'owner@riversidecafe.com' },
  { name: 'Mountain Lodge Gifts', email: 'buyer@mtnlodgegifts.com' },
];

// ── Sales Orders ───────────────────────────────────────────────────────────
interface SORow {
  id: string; order_number: string; customer_name: string; customer_email: string | null;
  order_date: string; required_ship_date: string | null; status: string;
  notes: string | null; created_at: string; source_quote_id: string | null;
}
interface SOLRow {
  id: string; sales_order_id: string; part_id: string;
  quantity_ordered: number; quantity_completed: number; quantity_shipped: number;
  created_at: string; unit_price: number; discount_pct: number; assigned_worker_id: string | null;
}

const salesOrders: SORow[] = [];
const salesOrderLines: SOLRow[] = [];

const finishedParts = parts.filter(p => p.part_number.startsWith('8'));
let soCounter = 1000;

function makeOrder(custIdx: number, dayOffset: number, shipOffset: number, lineCount: number, status: string, progress: 'none' | 'partial' | 'done' | 'shipped') {
  soCounter++;
  const soId = rid();
  const cust = customers[custIdx % customers.length];
  const orderNum = `SO-${soCounter}`;
  salesOrders.push({
    id: soId, order_number: orderNum, customer_name: cust.name, customer_email: cust.email,
    order_date: daysAgo(dayOffset), required_ship_date: shipOffset < 0 ? null : daysAhead(shipOffset),
    status, notes: null, created_at: tsDaysAgo(dayOffset), source_quote_id: null,
  });

  for (let i = 0; i < lineCount; i++) {
    const part = finishedParts[(soCounter + i) % finishedParts.length];
    const qty = [24, 48, 12, 36, 60, 18, 30][i % 7];
    let completed = 0, shipped = 0;
    if (progress === 'partial') completed = Math.floor(qty * 0.4);
    if (progress === 'done') completed = qty;
    if (progress === 'shipped') { completed = qty; shipped = qty; }
    salesOrderLines.push({
      id: rid(), sales_order_id: soId, part_id: part.id,
      quantity_ordered: qty, quantity_completed: completed, quantity_shipped: shipped,
      created_at: tsDaysAgo(dayOffset),
      unit_price: part.unit_price ?? 0, discount_pct: [0, 0, 5, 0, 10][i % 5],
      assigned_worker_id: progress === 'none' || progress === 'partial' ? workers[(soCounter + i) % workers.length].id : null,
    });
  }
}

// Open orders – overdue
makeOrder(0, 20, -3, 2, 'in_progress', 'partial');
makeOrder(1, 18, -1, 3, 'open', 'none');
// Due this week
makeOrder(2, 12, 3, 2, 'in_progress', 'partial');
makeOrder(3, 10, 5, 1, 'open', 'none');
makeOrder(4, 8, 6, 3, 'open', 'none');
// Upcoming
makeOrder(5, 5, 14, 2, 'open', 'none');
makeOrder(6, 3, 21, 4, 'open', 'none');
makeOrder(0, 2, 28, 2, 'open', 'none');
// Shipped
makeOrder(1, 35, 25, 2, 'shipped', 'shipped');
makeOrder(2, 30, 20, 1, 'shipped', 'shipped');
makeOrder(3, 25, 18, 3, 'shipped', 'shipped');
makeOrder(4, 22, 15, 2, 'shipped', 'shipped');
makeOrder(5, 40, 30, 1, 'shipped', 'shipped');

// ── Bill of Materials ──────────────────────────────────────────────────────
interface BOMRow { id: string; parent_part_id: string; component_part_id: string; quantity: number; unit: string; notes: string | null; created_at: string }

const billOfMaterials: BOMRow[] = [
  // 8001 Mug Speckled Blue → bisque 6001, clay 5002, glaze 7003
  { id: rid(), parent_part_id: partByNumber['8001'].id, component_part_id: partByNumber['6001'].id, quantity: 1, unit: 'ea', notes: null, created_at: tsDaysAgo(100) },
  { id: rid(), parent_part_id: partByNumber['8001'].id, component_part_id: partByNumber['5002'].id, quantity: 1.5, unit: 'lbs', notes: 'per piece', created_at: tsDaysAgo(100) },
  { id: rid(), parent_part_id: partByNumber['8001'].id, component_part_id: partByNumber['7003'].id, quantity: 0.05, unit: 'gal', notes: null, created_at: tsDaysAgo(100) },
  // 8002 Mug Matte White → bisque 6001, clay 5002, glaze 7002
  { id: rid(), parent_part_id: partByNumber['8002'].id, component_part_id: partByNumber['6001'].id, quantity: 1, unit: 'ea', notes: null, created_at: tsDaysAgo(100) },
  { id: rid(), parent_part_id: partByNumber['8002'].id, component_part_id: partByNumber['5002'].id, quantity: 1.5, unit: 'lbs', notes: null, created_at: tsDaysAgo(100) },
  { id: rid(), parent_part_id: partByNumber['8002'].id, component_part_id: partByNumber['7002'].id, quantity: 0.05, unit: 'gal', notes: null, created_at: tsDaysAgo(100) },
  // 8003 Bowl Gloss Clear → bisque 6002, clay 5001, glaze 7001
  { id: rid(), parent_part_id: partByNumber['8003'].id, component_part_id: partByNumber['6002'].id, quantity: 1, unit: 'ea', notes: null, created_at: tsDaysAgo(100) },
  { id: rid(), parent_part_id: partByNumber['8003'].id, component_part_id: partByNumber['5001'].id, quantity: 2.5, unit: 'lbs', notes: null, created_at: tsDaysAgo(100) },
  { id: rid(), parent_part_id: partByNumber['8003'].id, component_part_id: partByNumber['7001'].id, quantity: 0.08, unit: 'gal', notes: null, created_at: tsDaysAgo(100) },
  // 8005 Plate Rust Iron → bisque 6003, clay 5001, glaze 7004
  { id: rid(), parent_part_id: partByNumber['8005'].id, component_part_id: partByNumber['6003'].id, quantity: 1, unit: 'ea', notes: null, created_at: tsDaysAgo(100) },
  { id: rid(), parent_part_id: partByNumber['8005'].id, component_part_id: partByNumber['5001'].id, quantity: 3.0, unit: 'lbs', notes: null, created_at: tsDaysAgo(100) },
  { id: rid(), parent_part_id: partByNumber['8005'].id, component_part_id: partByNumber['7004'].id, quantity: 0.1, unit: 'gal', notes: null, created_at: tsDaysAgo(100) },
];

// ── Production Runs ────────────────────────────────────────────────────────
interface PRRow { id: string; run_date: string; part_id: string; quantity_planned: number; quantity_completed: number; clay_part_id: string | null; clay_used_lbs: number; mold_part_id: string | null; blade_part_id: string | null; notes: string | null; created_at: string }

const productionRuns: PRRow[] = [];
for (let d = 0; d < 14; d++) {
  const runCount = 2 + Math.floor(Math.random() * 2);
  for (let r = 0; r < runCount; r++) {
    const part = finishedParts[(d + r) % finishedParts.length];
    const planned = [24, 48, 36, 12, 60][r % 5];
    const completed = d < 2 ? planned : Math.floor(planned * (0.6 + Math.random() * 0.4));
    const clayPart = partByNumber['500' + (1 + (d % 3))];
    const moldPart = partByNumber['300' + (1 + (r % 3))];
    const bladePart = partByNumber['200' + (1 + (r % 2))];
    productionRuns.push({
      id: rid(), run_date: daysAgo(d), part_id: part.id,
      quantity_planned: planned, quantity_completed: completed,
      clay_part_id: clayPart.id, clay_used_lbs: planned * 1.8,
      mold_part_id: moldPart.id, blade_part_id: bladePart.id,
      notes: null, created_at: tsDaysAgo(d),
    });
  }
}

// ── Clay Receipts ──────────────────────────────────────────────────────────
interface CRRow { id: string; clay_part_id: string; receipt_date: string; quantity_lbs: number; supplier: string | null; purchase_order: string | null; unit_cost: number | null; notes: string | null; created_at: string }

const claySuppliers = ['Laguna Clay Co.', 'Standard Ceramic Supply', 'Axner Pottery Supply'];
const clayReceipts: CRRow[] = [];
let crCounter = 5000;
const clayPartIds = parts.filter(p => p.part_number.startsWith('5')).map(p => p.id);
for (let i = 0; i < 12; i++) {
  crCounter++;
  const clayPart = parts.find(p => p.id === clayPartIds[i % clayPartIds.length])!;
  clayReceipts.push({
    id: rid(), clay_part_id: clayPart.id, receipt_date: daysAgo(i * 10 + 2),
    quantity_lbs: [500, 300, 250, 400][i % 4],
    supplier: claySuppliers[i % 3], purchase_order: `CPO-${crCounter}`,
    unit_cost: clayPart.cost_price, notes: null, created_at: tsDaysAgo(i * 10 + 2),
  });
}

// ── Clay Purchase Orders ───────────────────────────────────────────────────
interface CPORow { id: string; clay_part_id: string; order_date: string; quantity_lbs: number; supplier: string | null; purchase_order: string | null; status: string; notes: string | null; created_at: string }

const clayPurchaseOrders: CPORow[] = [];
let cpoCounter = 5000;
for (let i = 0; i < 6; i++) {
  cpoCounter++;
  const clayPart = parts.find(p => p.id === clayPartIds[i % clayPartIds.length])!;
  const status = i < 2 ? 'open' : i < 4 ? 'received' : 'cancelled';
  clayPurchaseOrders.push({
    id: rid(), clay_part_id: clayPart.id, order_date: daysAgo(i * 12 + 5),
    quantity_lbs: [500, 300, 250, 400][i % 4],
    supplier: claySuppliers[i % 3], purchase_order: `CPO-${cpoCounter}`,
    status, notes: null, created_at: tsDaysAgo(i * 12 + 5),
  });
}

// ── Quotes ─────────────────────────────────────────────────────────────────
interface QuoteRow { id: string; quote_number: string; customer_name: string; customer_email: string | null; customer_phone: string | null; quote_date: string; expiry_date: string | null; status: string; notes: string | null; terms: string | null; created_at: string; updated_at: string }
interface QuoteLineRow { id: string; quote_id: string; part_id: string | null; description: string; quantity: number; unit_price: number; discount_pct: number; sort_order: number; created_at: string }

const quotes: QuoteRow[] = [];
const quoteLines: QuoteLineRow[] = [];
let qCounter = 2000;
const quoteStatuses: [string, number][] = [
  ['draft', 2], ['sent', 5], ['sent', 8], ['accepted', 15], ['rejected', 20], ['draft', 1], ['sent', 12],
];
for (let i = 0; i < quoteStatuses.length; i++) {
  qCounter++;
  const [status, ageDays] = quoteStatuses[i];
  const cust = customers[i % customers.length];
  const qId = rid();
  quotes.push({
    id: qId, quote_number: `Q-${qCounter}`, customer_name: cust.name,
    customer_email: cust.email, customer_phone: '555-0100',
    quote_date: daysAgo(ageDays), expiry_date: daysAhead(30 - ageDays),
    status, notes: null, terms: 'Net 30', created_at: tsDaysAgo(ageDays), updated_at: tsDaysAgo(ageDays),
  });
  const lineCount = 1 + (i % 3);
  for (let l = 0; l < lineCount; l++) {
    const part = finishedParts[(i + l) % finishedParts.length];
    quoteLines.push({
      id: rid(), quote_id: qId, part_id: part.id, description: part.description,
      quantity: [24, 48, 12][l % 3], unit_price: part.unit_price ?? 0,
      discount_pct: [0, 5, 10][l % 3], sort_order: l, created_at: tsDaysAgo(ageDays),
    });
  }
}

// ── Invoices ──────────────────────────────────────────────────────────────
interface InvHeader { id: string; invoice_number: string; sales_order_id: string | null; quote_id: string | null; customer_name: string; customer_email: string | null; invoice_date: string; due_date: string; payment_terms: string; status: string; notes: string | null; created_at: string; updated_at: string }
interface InvLineRow { id: string; invoice_id: string; part_id: string | null; description: string; quantity: number; unit_price: number; discount_pct: number; sort_order: number; created_at: string }
interface PaymentRow { id: string; invoice_id: string; payment_date: string; amount: number; method: string; reference_number: string | null; notes: string | null; created_at: string }

const invoices: InvHeader[] = [];
const invoiceLines: InvLineRow[] = [];
const payments: PaymentRow[] = [];
let invCounter = 3000;

const shippedOrders = salesOrders.filter(s => s.status === 'shipped');
for (let i = 0; i < shippedOrders.length; i++) {
  invCounter++;
  const so = shippedOrders[i];
  const soLines = salesOrderLines.filter(l => l.sales_order_id === so.id);
  const invId = rid();
  const invDate = daysAgo(20 - i * 4);
  const dueDate = daysAgo(20 - i * 4 - 30);
  let total = 0;
  for (const l of soLines) {
    const part = partById[l.part_id];
    const lineTotal = l.quantity_ordered * l.unit_price * (1 - l.discount_pct / 100);
    total += lineTotal;
    invoiceLines.push({
      id: rid(), invoice_id: invId, part_id: l.part_id, description: part.description,
      quantity: l.quantity_ordered, unit_price: l.unit_price, discount_pct: l.discount_pct,
      sort_order: 0, created_at: invDate,
    });
  }
  const isPaid = i < 3;
  const isPartial = i === 3;
  const status = isPaid ? 'paid' : isPartial ? 'partial' : i === 4 ? 'sent' : 'sent';
  invoices.push({
    id: invId, invoice_number: `INV-${invCounter}`, sales_order_id: so.id, quote_id: null,
    customer_name: so.customer_name, customer_email: so.customer_email,
    invoice_date: invDate, due_date: dueDate, payment_terms: 'Net 30',
    status, notes: null, created_at: invDate, updated_at: invDate,
  });
  if (isPaid) {
    payments.push({
      id: rid(), invoice_id: invId, payment_date: daysAgo(15 - i * 4), amount: total,
      method: ['ACH', 'Check', 'Credit Card'][i % 3], reference_number: `REF-${1000 + i}`,
      notes: null, created_at: daysAgo(15 - i * 4),
    });
  } else if (isPartial) {
    payments.push({
      id: rid(), invoice_id: invId, payment_date: daysAgo(10), amount: total * 0.5,
      method: 'ACH', reference_number: 'REF-1003', notes: 'Partial payment', created_at: daysAgo(10),
    });
  }
}

// Add a couple of draft invoices not tied to shipped orders
for (let i = 0; i < 2; i++) {
  invCounter++;
  const cust = customers[(i + 3) % customers.length];
  const invId = rid();
  const invDate = daysAgo(i + 1);
  invoices.push({
    id: invId, invoice_number: `INV-${invCounter}`, sales_order_id: null, quote_id: null,
    customer_name: cust.name, customer_email: cust.email,
    invoice_date: invDate, due_date: daysAhead(30 - i), payment_terms: 'Net 30',
    status: 'draft', notes: null, created_at: invDate, updated_at: invDate,
  });
  const part = finishedParts[i];
  invoiceLines.push({
    id: rid(), invoice_id: invId, part_id: part.id, description: part.description,
    quantity: 24, unit_price: part.unit_price ?? 0, discount_pct: 0, sort_order: 0, created_at: invDate,
  });
}

// ── Shipments ─────────────────────────────────────────────────────────────
interface ShipmentRow { id: string; sales_order_id: string; ship_date: string; shipping_method: string | null; tracking_number: string | null; notes: string | null; created_at: string }
interface ShipmentLineRow { id: string; shipment_id: string; sales_order_line_id: string; part_id: string; quantity_shipped: number; created_at: string }

const shipments: ShipmentRow[] = [];
const shipmentLines: ShipmentLineRow[] = [];
for (const so of shippedOrders) {
  const soLines = salesOrderLines.filter(l => l.sales_order_id === so.id);
  const shipId = rid();
  const shipDate = so.required_ship_date ?? daysAgo(15);
  shipments.push({
    id: shipId, sales_order_id: so.id, ship_date: shipDate,
    shipping_method: ['UPS', 'FedEx', 'Pickup'][Math.floor(Math.random() * 3)],
    tracking_number: `TRK-${Math.floor(Math.random() * 900000 + 100000)}`,
    notes: null, created_at: shipDate,
  });
  for (const l of soLines) {
    shipmentLines.push({
      id: rid(), shipment_id: shipId, sales_order_line_id: l.id, part_id: l.part_id,
      quantity_shipped: l.quantity_shipped, created_at: shipDate,
    });
  }
}

// ── Purchase Orders ────────────────────────────────────────────────────────
interface PORow { id: string; po_number: string; vendor_name: string; vendor_email: string | null; order_date: string; expected_date: string | null; status: string; notes: string | null; created_at: string; updated_at: string }
interface POLineRow { id: string; purchase_order_id: string; part_id: string | null; description: string; quantity: number; unit_price: number; quantity_received: number; sort_order: number; created_at: string }

const purchaseOrders: PORow[] = [];
const purchaseOrderLines: POLineRow[] = [];
let poCounter = 100;
const vendors = [
  { name: 'Laguna Clay Co.', email: 'sales@lagunaclay.com' },
  { name: 'Standard Ceramic Supply', email: 'orders@standardceramic.com' },
  { name: 'Axner Pottery Supply', email: 'info@axner.com' },
  { name: 'Bailey Pottery', email: 'sales@baileypottery.com' },
];
const poStatuses: [string, number][] = [
  ['draft', 1], ['sent', 5], ['sent', 8], ['partial', 12], ['received', 20], ['received', 30], ['draft', 0], ['sent', 3],
];
for (let i = 0; i < poStatuses.length; i++) {
  poCounter++;
  const [status, ageDays] = poStatuses[i];
  const vendor = vendors[i % vendors.length];
  const poId = rid();
  const orderDate = daysAgo(ageDays);
  purchaseOrders.push({
    id: poId, po_number: `PO-${poCounter}`, vendor_name: vendor.name, vendor_email: vendor.email,
    order_date: orderDate, expected_date: ageDays > 5 ? daysAgo(ageDays - 7) : daysAhead(7),
    status, notes: null, created_at: orderDate, updated_at: orderDate,
  });
  const lineCount = 1 + (i % 3);
  for (let l = 0; l < lineCount; l++) {
    const part = parts.filter(p => p.part_number.startsWith('5') || p.part_number.startsWith('7'))[(i + l) % 8];
    const qty = [100, 50, 25, 200][l % 4];
    const received = status === 'received' ? qty : status === 'partial' ? Math.floor(qty * 0.5) : 0;
    purchaseOrderLines.push({
      id: rid(), purchase_order_id: poId, part_id: part.id, description: part.description,
      quantity: qty, unit_price: part.unit_price ?? part.cost_price ?? 1, quantity_received: received,
      sort_order: l, created_at: orderDate,
    });
  }
}

// ── Tasks ──────────────────────────────────────────────────────────────────
interface TaskRow { id: string; title: string; description: string | null; status: string; priority: string; category: string; due_date: string | null; assigned_to: string | null; completed_at: string | null; created_at: string; updated_at: string }

const taskDefs: [string, string, string, string, string | null][] = [
  ['Fire kiln – bisque load #42', 'Load and fire bisque kiln for mugs and bowls', 'todo', 'high', 'today'],
  ['Order new jigger blades', 'Blades for mug line are wearing thin', 'todo', 'medium', 'week'],
  ['Glaze test tiles – new blue recipe', 'Test 3 variations of speckled blue glaze', 'in_progress', 'medium', 'week'],
  ['Inventory count – clay storage', 'Monthly cycle count of clay inventory', 'todo', 'low', 'month'],
  ['Update BOM for pitcher 8007', 'Clay usage higher than expected, revise BOM', 'done', 'medium', null],
  ['Call Laguna Clay – delayed shipment', 'Follow up on PO-0103, clay not arrived', 'in_progress', 'high', 'today'],
  ['Clean jigger machine', 'Weekly maintenance on jigger line', 'done', 'low', null],
  ['Quality check – finished mugs', 'Check speckled blue mugs for glaze defects', 'todo', 'high', 'today'],
  ['Restock glaze cabinets', 'Reorganize and restock glaze supplies', 'todo', 'low', 'week'],
  ['Train new worker – Diane', 'Onboarding for jigger operation', 'in_progress', 'medium', 'week'],
];

const tasks: TaskRow[] = taskDefs.map(([title, desc, status, priority, due]) => {
  const dueDate = due === 'today' ? daysAhead(0) : due === 'week' ? daysAhead(5) : due === 'month' ? daysAhead(20) : null;
  return {
    id: rid(), title, description: desc, status, priority, category: 'production',
    due_date: dueDate, assigned_to: null,
    completed_at: status === 'done' ? tsDaysAgo(1) : null,
    created_at: tsDaysAgo(7), updated_at: tsDaysAgo(1),
  };
});

// ── Export the in-memory database ───────────────────────────────────────────
export interface MockDB {
  parts: PartRow[];
  inventory: InvRow[];
  sales_orders: SORow[];
  sales_order_lines: SOLRow[];
  bill_of_materials: BOMRow[];
  production_runs: PRRow[];
  clay_receipts: CRRow[];
  clay_purchase_orders: CPORow[];
  shipments: ShipmentRow[];
  shipment_lines: ShipmentLineRow[];
  quotes: QuoteRow[];
  quote_lines: QuoteLineRow[];
  invoices: InvHeader[];
  invoice_lines: InvLineRow[];
  payments: PaymentRow[];
  workers: WorkerRow[];
  purchase_orders: PORow[];
  purchase_order_lines: POLineRow[];
  tasks: TaskRow[];
}

export function createMockDB(): MockDB {
  return {
    parts: structuredClone(parts),
    inventory: structuredClone(inventory),
    sales_orders: structuredClone(salesOrders),
    sales_order_lines: structuredClone(salesOrderLines),
    bill_of_materials: structuredClone(billOfMaterials),
    production_runs: structuredClone(productionRuns),
    clay_receipts: structuredClone(clayReceipts),
    clay_purchase_orders: structuredClone(clayPurchaseOrders),
    shipments: structuredClone(shipments),
    shipment_lines: structuredClone(shipmentLines),
    quotes: structuredClone(quotes),
    quote_lines: structuredClone(quoteLines),
    invoices: structuredClone(invoices),
    invoice_lines: structuredClone(invoiceLines),
    payments: structuredClone(payments),
    workers: structuredClone(workers),
    purchase_orders: structuredClone(purchaseOrders),
    purchase_order_lines: structuredClone(purchaseOrderLines),
    tasks: structuredClone(tasks),
  };
}
