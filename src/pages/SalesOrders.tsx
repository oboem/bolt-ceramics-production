import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import Header from '../components/layout/Header';
import Badge from '../components/ui/Badge';
import ProgressBar from '../components/ui/ProgressBar';
import {
  ChevronDown, ChevronRight, Clock, AlertTriangle, Plus, X,
  PackageCheck, Truck, CheckCircle2, Package, History, Receipt, FileText,
  Trash2, ArrowRight,
} from 'lucide-react';

interface Part {
  id: string;
  part_number: string;
  description: string;
  unit_price: number | null;
}

interface OrderLine {
  id: string;
  part_id: string;
  quantity_ordered: number;
  quantity_completed: number;
  quantity_shipped: number;
  unit_price: number | null;
  discount_pct: number;
  part?: { part_number: string; description: string };
}

interface Order {
  id: string;
  order_number: string;
  customer_name: string;
  customer_email: string | null;
  order_date: string;
  required_ship_date: string | null;
  status: string;
  notes: string | null;
  source_quote_id: string | null;
  lines: OrderLine[];
}

interface DraftLine {
  key: number;
  part_id: string;
  description: string;
  quantity: string;
  unit_price: string;
  discount_pct: string;
}

interface Shipment {
  id: string;
  ship_date: string;
  shipping_method: string | null;
  tracking_number: string | null;
  notes: string | null;
  lines: {
    id: string;
    quantity_shipped: number;
    part: { part_number: string; description: string } | null;
  }[];
}

interface FulfillLine {
  lineId: string;
  partId: string;
  partNumber: string;
  description: string;
  ordered: number;
  alreadyShipped: number;
  completed: number;
  available: number;
  shipQty: string;
}

const statusVariant: Record<string, 'amber' | 'blue' | 'green' | 'slate' | 'red'> = {
  open: 'blue',
  in_progress: 'amber',
  shipped: 'green',
  cancelled: 'red',
};

function fmtCurrency(n: number) {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
}

function orderValue(lines: OrderLine[]): number {
  return lines.reduce((s, l) => {
    return s + Number(l.quantity_ordered) * Number(l.unit_price ?? 0) * (1 - Number(l.discount_pct ?? 0) / 100);
  }, 0);
}

function draftLineTotal(l: DraftLine): number {
  return (parseFloat(l.quantity) || 0) * (parseFloat(l.unit_price) || 0) * (1 - (parseFloat(l.discount_pct) || 0) / 100);
}

let lineKey = 0;
function newDraftLine(): DraftLine {
  return { key: ++lineKey, part_id: '', description: '', quantity: '1', unit_price: '0', discount_pct: '0' };
}

export default function SalesOrders() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [saving, setSaving] = useState(false);
  const [parts, setParts] = useState<Part[]>([]);

  // New order form
  const [showNewOrder, setShowNewOrder] = useState(false);
  const [newOrder, setNewOrder] = useState({ customer_name: '', customer_email: '', required_ship_date: '', notes: '' });
  const [draftLines, setDraftLines] = useState<DraftLine[]>([newDraftLine()]);

  // Fulfillment
  const [fulfillOrderId, setFulfillOrderId] = useState<string | null>(null);
  const [fulfillLines, setFulfillLines] = useState<FulfillLine[]>([]);
  const [fulfillShipDate, setFulfillShipDate] = useState(new Date().toISOString().split('T')[0]);
  const [fulfillMethod, setFulfillMethod] = useState('');
  const [fulfillTracking, setFulfillTracking] = useState('');
  const [fulfillNotes, setFulfillNotes] = useState('');
  const [createdInvoiceNumber, setCreatedInvoiceNumber] = useState<string | null>(null);

  // Shipment history
  const [shipmentHistoryOrderId, setShipmentHistoryOrderId] = useState<string | null>(null);
  const [shipmentHistory, setShipmentHistory] = useState<Shipment[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('sales_orders')
      .select(`
        id, order_number, customer_name, customer_email, order_date, required_ship_date, status, notes, source_quote_id,
        lines:sales_order_lines(
          id, part_id, quantity_ordered, quantity_completed, quantity_shipped, unit_price, discount_pct,
          part:parts!sales_order_lines_part_id_fkey(part_number, description)
        )
      `)
      .order('order_date', { ascending: false });
    if (data) setOrders(data as any);
    setLoading(false);
  };

  const loadParts = async () => {
    const { data } = await supabase.from('parts').select('id, part_number, description, unit_price').order('part_number');
    if (data) setParts(data as Part[]);
  };

  useEffect(() => { load(); loadParts(); }, []);

  const toggle = (id: string) => {
    setExpanded(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const updateLineCompleted = async (lineId: string, value: number) => {
    await supabase.from('sales_order_lines').update({ quantity_completed: value }).eq('id', lineId);
    load();
  };

  const updateOrderStatus = async (orderId: string, status: string) => {
    await supabase.from('sales_orders').update({ status }).eq('id', orderId);
    load();
  };

  const setDraftLinePart = (key: number, partId: string) => {
    const part = parts.find(p => p.id === partId);
    setDraftLines(prev => prev.map(l =>
      l.key === key
        ? { ...l, part_id: partId, description: part?.description ?? l.description, unit_price: part ? String(part.unit_price ?? 0) : l.unit_price }
        : l
    ));
  };

  const openNewOrder = () => {
    setNewOrder({ customer_name: '', customer_email: '', required_ship_date: '', notes: '' });
    setDraftLines([newDraftLine()]);
    setShowNewOrder(true);
  };

  const createOrder = async () => {
    if (!newOrder.customer_name) return;
    const validLines = draftLines.filter(l => l.part_id && (parseFloat(l.quantity) || 0) > 0);
    if (validLines.length === 0) return;
    setSaving(true);

    const { count } = await supabase.from('sales_orders').select('id', { count: 'exact', head: true });
    const orderNumber = `SO-${new Date().getFullYear()}-${String((count ?? 0) + 1).padStart(3, '0')}`;

    const { data: order } = await supabase
      .from('sales_orders')
      .insert({
        order_number: orderNumber,
        customer_name: newOrder.customer_name.trim(),
        customer_email: newOrder.customer_email.trim() || null,
        required_ship_date: newOrder.required_ship_date || null,
        notes: newOrder.notes.trim() || null,
        status: 'open',
      })
      .select('id')
      .maybeSingle();

    if (order) {
      await supabase.from('sales_order_lines').insert(
        validLines.map(l => ({
          sales_order_id: order.id,
          part_id: l.part_id,
          quantity_ordered: parseFloat(l.quantity),
          quantity_completed: 0,
          quantity_shipped: 0,
          unit_price: parseFloat(l.unit_price) || 0,
          discount_pct: parseFloat(l.discount_pct) || 0,
        }))
      );
    }

    setShowNewOrder(false);
    setSaving(false);
    load();
  };

  const openFulfill = async (order: Order) => {
    const shippableLines = order.lines.filter(l => Number(l.quantity_ordered) - Number(l.quantity_shipped) > 0);
    if (shippableLines.length === 0) return;

    const invResults = await Promise.all(
      shippableLines.map(l => supabase.from('inventory').select('quantity_on_hand').eq('part_id', l.part_id).maybeSingle())
    );

    const lines: FulfillLine[] = shippableLines.map((l, i) => {
      const remaining = Number(l.quantity_ordered) - Number(l.quantity_shipped);
      const onHand = Number(invResults[i].data?.quantity_on_hand ?? 0);
      const canShip = Math.min(remaining, onHand);
      return {
        lineId: l.id,
        partId: l.part_id,
        partNumber: (l.part as any)?.part_number ?? '',
        description: (l.part as any)?.description ?? '',
        ordered: Number(l.quantity_ordered),
        alreadyShipped: Number(l.quantity_shipped),
        completed: Number(l.quantity_completed),
        available: onHand,
        shipQty: String(canShip > 0 ? canShip : 0),
      };
    });

    setFulfillLines(lines);
    setFulfillOrderId(order.id);
    setFulfillShipDate(new Date().toISOString().split('T')[0]);
    setFulfillMethod('');
    setFulfillTracking('');
    setFulfillNotes('');
    setExpanded(prev => { const n = new Set(prev); n.add(order.id); return n; });
  };

  const submitFulfillment = async () => {
    if (!fulfillOrderId) return;
    const linesToShip = fulfillLines.filter(l => Number(l.shipQty) > 0);
    if (linesToShip.length === 0) return;
    setSaving(true);

    const { data: shipment } = await supabase.from('shipments').insert({
      sales_order_id: fulfillOrderId,
      ship_date: fulfillShipDate,
      shipping_method: fulfillMethod || null,
      tracking_number: fulfillTracking || null,
      notes: fulfillNotes || null,
    }).select('id').maybeSingle();

    if (!shipment) { setSaving(false); return; }

    await supabase.from('shipment_lines').insert(
      linesToShip.map(l => ({
        shipment_id: shipment.id,
        sales_order_line_id: l.lineId,
        part_id: l.partId,
        quantity_shipped: Number(l.shipQty),
      }))
    );

    for (const l of linesToShip) {
      const qty = Number(l.shipQty);
      await supabase.from('sales_order_lines').update({ quantity_shipped: l.alreadyShipped + qty }).eq('id', l.lineId);
      const { data: inv } = await supabase.from('inventory').select('id, quantity_on_hand').eq('part_id', l.partId).maybeSingle();
      if (inv) {
        await supabase.from('inventory').update({
          quantity_on_hand: Math.max(0, Number(inv.quantity_on_hand) - qty),
          updated_at: new Date().toISOString(),
        }).eq('id', inv.id);
      }
    }

    const order = orders.find(o => o.id === fulfillOrderId);
    if (order) {
      const allFullyShipped = order.lines.every(l => {
        const line = linesToShip.find(s => s.lineId === l.id);
        return (Number(l.quantity_shipped) + (line ? Number(line.shipQty) : 0)) >= Number(l.quantity_ordered);
      });
      if (allFullyShipped) {
        await supabase.from('sales_orders').update({ status: 'shipped' }).eq('id', fulfillOrderId);
      }

      // Auto-create draft invoice
      const invNum = `INV-${Math.floor(1000 + Math.random() * 9000)}`;
      const due = new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0];
      const { data: inv } = await supabase.from('invoices').insert({
        invoice_number: invNum,
        customer_name: order.customer_name,
        customer_email: order.customer_email || null,
        invoice_date: fulfillShipDate,
        due_date: due,
        payment_terms: 'Net 30',
        sales_order_id: order.id,
        notes: fulfillNotes.trim() || null,
        status: 'draft',
      }).select('id').maybeSingle();

      if (inv) {
        await supabase.from('invoice_lines').insert(
          linesToShip.map((l, i) => {
            const orderLine = order.lines.find(ol => ol.id === l.lineId);
            return {
              invoice_id: inv.id,
              part_id: l.partId,
              description: l.description,
              quantity: Number(l.shipQty),
              unit_price: Number(orderLine?.unit_price ?? 0),
              discount_pct: Number(orderLine?.discount_pct ?? 0),
              sort_order: i,
            };
          })
        );
        setCreatedInvoiceNumber(invNum);
      }
    }

    setFulfillOrderId(null);
    setFulfillLines([]);
    setSaving(false);
    load();
  };

  const closeFulfill = () => {
    setFulfillOrderId(null);
    setFulfillLines([]);
    setCreatedInvoiceNumber(null);
  };

  const loadShipmentHistory = async (orderId: string) => {
    if (shipmentHistoryOrderId === orderId) { setShipmentHistoryOrderId(null); return; }
    setLoadingHistory(true);
    setShipmentHistoryOrderId(orderId);
    const { data } = await supabase
      .from('shipments')
      .select(`
        id, ship_date, shipping_method, tracking_number, notes,
        lines:shipment_lines(
          id, quantity_shipped,
          part:parts!shipment_lines_part_id_fkey(part_number, description)
        )
      `)
      .eq('sales_order_id', orderId)
      .order('ship_date', { ascending: false });
    setShipmentHistory((data as any) ?? []);
    setLoadingHistory(false);
  };

  const fulfillShipTotal = fulfillLines.reduce((s, l) => s + Number(l.shipQty || 0), 0);
  const filtered = statusFilter === 'all' ? orders : orders.filter(o => o.status === statusFilter);
  const draftTotal = draftLines.reduce((s, l) => s + draftLineTotal(l), 0);

  return (
    <div className="flex-1 overflow-y-auto bg-slate-50">
      <Header
        title="Sales Orders"
        subtitle={`${orders.filter(o => o.status !== 'shipped' && o.status !== 'cancelled').length} active orders`}
        onRefresh={load}
        loading={loading}
        actions={
          <button
            onClick={openNewOrder}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-amber-500 hover:bg-amber-600 rounded-lg transition-colors"
          >
            <Plus size={15} /> New Order
          </button>
        }
      />

      <div className="p-8 space-y-6">

        {/* Flow explainer */}
        <div className="flex items-center gap-2 text-xs text-slate-500 bg-white border border-slate-200 rounded-xl px-5 py-3 flex-wrap">
          <span className="font-semibold text-slate-700">Typical flow:</span>
          <span className="bg-blue-100 text-blue-700 font-medium px-2 py-0.5 rounded-full">Quote</span>
          <ArrowRight size={12} className="text-slate-400" />
          <span className="bg-amber-100 text-amber-700 font-medium px-2 py-0.5 rounded-full">Sales Order</span>
          <ArrowRight size={12} className="text-slate-400" />
          <span className="bg-orange-100 text-orange-700 font-medium px-2 py-0.5 rounded-full">Production</span>
          <ArrowRight size={12} className="text-slate-400" />
          <span className="bg-green-100 text-green-700 font-medium px-2 py-0.5 rounded-full">Ship &amp; Invoice</span>
          <ArrowRight size={12} className="text-slate-400" />
          <span className="bg-slate-100 text-slate-700 font-medium px-2 py-0.5 rounded-full">Payment</span>
          <span className="text-slate-400 ml-1">— Convert accepted quotes in the Quotes page, or create ad-hoc orders below.</span>
        </div>

        {/* New order form */}
        {showNewOrder && (
          <div className="bg-white rounded-xl border border-amber-200 shadow-sm overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-amber-100 bg-amber-50">
              <h3 className="font-semibold text-slate-900">New Sales Order</h3>
              <button onClick={() => setShowNewOrder(false)} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
            </div>
            <div className="p-6 space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5">Customer Name *</label>
                  <input
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                    placeholder="e.g. Pottery Barn Boutique"
                    value={newOrder.customer_name}
                    onChange={e => setNewOrder(p => ({ ...p, customer_name: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5">Customer Email</label>
                  <input
                    type="email"
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                    placeholder="customer@example.com"
                    value={newOrder.customer_email}
                    onChange={e => setNewOrder(p => ({ ...p, customer_email: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5">Required Ship Date</label>
                  <input
                    type="date"
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                    value={newOrder.required_ship_date}
                    onChange={e => setNewOrder(p => ({ ...p, required_ship_date: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5">Notes</label>
                  <input
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                    placeholder="Special instructions, PO number, etc."
                    value={newOrder.notes}
                    onChange={e => setNewOrder(p => ({ ...p, notes: e.target.value }))}
                  />
                </div>
              </div>

              {/* Line items */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Order Lines</h4>
                  <button
                    onClick={() => setDraftLines(prev => [...prev, newDraftLine()])}
                    className="flex items-center gap-1.5 text-xs text-amber-600 hover:text-amber-700 font-semibold"
                  >
                    <Plus size={13} /> Add Line
                  </button>
                </div>
                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  <table className="w-full">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200">
                        <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide">Part</th>
                        <th className="text-right px-3 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide w-24">Qty</th>
                        <th className="text-right px-3 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide w-28">Unit Price</th>
                        <th className="text-right px-3 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide w-20">Disc %</th>
                        <th className="text-right px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide w-28">Total</th>
                        <th className="w-10" />
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {draftLines.map(line => (
                        <tr key={line.key}>
                          <td className="px-4 py-2.5">
                            <select
                              value={line.part_id}
                              onChange={e => setDraftLinePart(line.key, e.target.value)}
                              className="w-full border border-slate-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 bg-white"
                            >
                              <option value="">Select a part...</option>
                              {parts.map(p => (
                                <option key={p.id} value={p.id}>{p.part_number} — {p.description}</option>
                              ))}
                            </select>
                          </td>
                          <td className="px-3 py-2.5">
                            <input
                              type="number" min={1}
                              value={line.quantity}
                              onChange={e => setDraftLines(prev => prev.map(l => l.key === line.key ? { ...l, quantity: e.target.value } : l))}
                              className="w-full text-right border border-slate-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                            />
                          </td>
                          <td className="px-3 py-2.5">
                            <div className="relative">
                              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-sm">$</span>
                              <input
                                type="number" min={0} step="0.01"
                                value={line.unit_price}
                                onChange={e => setDraftLines(prev => prev.map(l => l.key === line.key ? { ...l, unit_price: e.target.value } : l))}
                                className="w-full text-right border border-slate-200 rounded-lg pl-6 pr-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                              />
                            </div>
                          </td>
                          <td className="px-3 py-2.5">
                            <input
                              type="number" min={0} max={100} step="0.1"
                              value={line.discount_pct}
                              onChange={e => setDraftLines(prev => prev.map(l => l.key === line.key ? { ...l, discount_pct: e.target.value } : l))}
                              className="w-full text-right border border-slate-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                            />
                          </td>
                          <td className="px-4 py-2.5 text-right text-sm font-semibold text-slate-800">
                            {fmtCurrency(draftLineTotal(line))}
                          </td>
                          <td className="pr-3 py-2.5 text-center">
                            {draftLines.length > 1 && (
                              <button
                                onClick={() => setDraftLines(prev => prev.filter(l => l.key !== line.key))}
                                className="text-slate-300 hover:text-red-500 transition-colors"
                              >
                                <Trash2 size={14} />
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="bg-slate-50 border-t border-slate-200">
                        <td colSpan={4} className="px-4 py-3 text-sm font-semibold text-slate-700 text-right">Order Total</td>
                        <td className="px-4 py-3 text-right text-base font-black text-slate-900">{fmtCurrency(draftTotal)}</td>
                        <td />
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>

              <div className="flex gap-3 pt-1">
                <button
                  onClick={createOrder}
                  disabled={saving || !newOrder.customer_name || draftLines.filter(l => l.part_id).length === 0}
                  className="px-5 py-2.5 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white text-sm font-semibold rounded-lg transition-colors"
                >
                  {saving ? 'Creating...' : 'Create Order'}
                </button>
                <button onClick={() => setShowNewOrder(false)} className="px-4 py-2 text-sm text-slate-600 hover:text-slate-800">
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Invoice creation banner */}
        {createdInvoiceNumber && (
          <div className="flex items-center gap-3 bg-blue-50 border border-blue-200 rounded-xl px-5 py-4">
            <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center shrink-0">
              <Receipt size={16} className="text-white" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-blue-900">Draft invoice created: <span className="font-mono">{createdInvoiceNumber}</span></p>
              <p className="text-xs text-blue-600">Go to Invoices to review, edit, and send it to the customer.</p>
            </div>
            <button onClick={() => setCreatedInvoiceNumber(null)} className="text-blue-400 hover:text-blue-600"><X size={16} /></button>
          </div>
        )}

        {/* Status filter tabs */}
        <div className="flex gap-2">
          {['all', 'open', 'in_progress', 'shipped', 'cancelled'].map(s => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
                statusFilter === s ? 'bg-slate-900 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              {s === 'all' ? 'All' : s.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase())}
              {s !== 'all' && (
                <span className="ml-1.5 text-xs opacity-70">({orders.filter(o => o.status === s).length})</span>
              )}
            </button>
          ))}
        </div>

        {/* Orders list */}
        <div className="space-y-3">
          {loading ? (
            <div className="bg-white rounded-xl border border-slate-200 p-8 text-center text-slate-400">Loading orders...</div>
          ) : filtered.length === 0 ? (
            <div className="bg-white rounded-xl border border-slate-200 p-10 text-center">
              <Package size={28} className="text-slate-300 mx-auto mb-2" />
              <p className="text-sm text-slate-400">No orders found. Create one above or convert an accepted quote.</p>
            </div>
          ) : (
            filtered.map(order => {
              const isExpanded = expanded.has(order.id);
              const totalQty = order.lines?.reduce((s, l) => s + Number(l.quantity_ordered), 0) ?? 0;
              const doneQty = order.lines?.reduce((s, l) => s + Number(l.quantity_completed), 0) ?? 0;
              const shippedQty = order.lines?.reduce((s, l) => s + Number(l.quantity_shipped), 0) ?? 0;
              const isLate = order.required_ship_date && new Date(order.required_ship_date + 'T00:00:00') < new Date() && order.status !== 'shipped';
              const isFulfilling = fulfillOrderId === order.id;
              const hasUnshipped = order.lines?.some(l => Number(l.quantity_ordered) > Number(l.quantity_shipped));
              const showHistory = shipmentHistoryOrderId === order.id;
              const value = orderValue(order.lines ?? []);

              return (
                <div key={order.id} className={`bg-white rounded-xl border overflow-hidden transition-colors ${isFulfilling ? 'border-green-300 shadow-md' : 'border-slate-200'}`}>
                  <div className="px-6 py-4 cursor-pointer hover:bg-slate-50 transition-colors" onClick={() => toggle(order.id)}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className="text-slate-400">{isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}</span>
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold text-slate-900">{order.order_number}</span>
                            <Badge label={order.status.replace('_', ' ')} variant={statusVariant[order.status] ?? 'slate'} />
                            {order.source_quote_id && (
                              <span className="flex items-center gap-1 text-xs text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
                                <FileText size={10} /> From Quote
                              </span>
                            )}
                            {isLate && <span className="flex items-center gap-1 text-xs text-red-600 font-medium"><AlertTriangle size={11} /> Late</span>}
                          </div>
                          <p className="text-sm text-slate-500 mt-0.5">{order.customer_name}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-5">
                        {value > 0 && (
                          <div className="text-right">
                            <p className="text-sm font-bold text-slate-900">{fmtCurrency(value)}</p>
                            <p className="text-xs text-slate-400">order value</p>
                          </div>
                        )}
                        <div className="text-right">
                          <p className="text-sm font-semibold text-slate-900">
                            {shippedQty} / {totalQty}
                            <span className="text-xs font-normal text-slate-400 ml-1">shipped</span>
                          </p>
                          <p className="text-xs text-slate-400">{doneQty} produced · {order.lines?.length ?? 0} line{(order.lines?.length ?? 0) !== 1 ? 's' : ''}</p>
                        </div>
                        {order.required_ship_date && (
                          <div className={`flex items-center gap-1.5 text-sm ${isLate ? 'text-red-500' : 'text-slate-500'}`}>
                            <Clock size={14} />
                            {new Date(order.required_ship_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                          </div>
                        )}
                        {order.status !== 'shipped' && order.status !== 'cancelled' && hasUnshipped && (
                          <button
                            onClick={e => { e.stopPropagation(); openFulfill(order); }}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white text-xs font-semibold rounded-lg transition-colors"
                          >
                            <PackageCheck size={13} /> Fulfill
                          </button>
                        )}
                        <select
                          value={order.status}
                          onChange={e => { e.stopPropagation(); updateOrderStatus(order.id, e.target.value); }}
                          onClick={e => e.stopPropagation()}
                          className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-amber-400"
                        >
                          <option value="open">Open</option>
                          <option value="in_progress">In Progress</option>
                          <option value="shipped">Shipped</option>
                          <option value="cancelled">Cancelled</option>
                        </select>
                      </div>
                    </div>

                    <div className="mt-3 flex items-center gap-4">
                      <div className="flex-1">
                        <ProgressBar value={shippedQty} max={totalQty} showPercent colorClass="bg-green-500" label="Shipped" />
                      </div>
                      {doneQty > shippedQty && (
                        <span className="text-xs text-amber-600 font-medium whitespace-nowrap">{doneQty - shippedQty} ready to ship</span>
                      )}
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="border-t border-slate-100">
                      {order.notes && (
                        <div className="px-6 py-3 bg-amber-50 border-b border-amber-100 text-sm text-amber-800">{order.notes}</div>
                      )}

                      {isFulfilling && (
                        <div className="mx-6 mt-4 mb-2 bg-green-50 border border-green-200 rounded-xl p-5">
                          <div className="flex items-center justify-between mb-4">
                            <h3 className="font-semibold text-green-900 flex items-center gap-2">
                              <PackageCheck size={16} className="text-green-600" /> Fulfill Order
                              <span className="text-xs text-green-600 font-normal">— a draft invoice will be created automatically</span>
                            </h3>
                            <button onClick={closeFulfill} className="text-green-400 hover:text-green-600"><X size={18} /></button>
                          </div>

                          <div className="bg-white rounded-lg border border-green-200 overflow-hidden mb-4">
                            <table className="w-full">
                              <thead>
                                <tr className="border-b border-green-100 bg-green-50">
                                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-green-800 uppercase tracking-wide">Part</th>
                                  <th className="text-right px-3 py-2.5 text-xs font-semibold text-green-800 uppercase tracking-wide">Ordered</th>
                                  <th className="text-right px-3 py-2.5 text-xs font-semibold text-green-800 uppercase tracking-wide">Shipped</th>
                                  <th className="text-right px-3 py-2.5 text-xs font-semibold text-green-800 uppercase tracking-wide">Remaining</th>
                                  <th className="text-right px-3 py-2.5 text-xs font-semibold text-green-800 uppercase tracking-wide">In Stock</th>
                                  <th className="text-right px-4 py-2.5 text-xs font-semibold text-green-800 uppercase tracking-wide">Ship Qty</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-green-50">
                                {fulfillLines.map((fl, i) => {
                                  const remaining = fl.ordered - fl.alreadyShipped;
                                  const maxShip = Math.min(remaining, fl.available);
                                  const overStock = Number(fl.shipQty || 0) > fl.available;
                                  return (
                                    <tr key={fl.lineId} className="hover:bg-green-50/50">
                                      <td className="px-4 py-2.5">
                                        <p className="text-sm font-medium text-slate-800">{fl.description}</p>
                                        <p className="text-xs font-mono text-slate-400">{fl.partNumber}</p>
                                      </td>
                                      <td className="px-3 py-2.5 text-sm text-right text-slate-700">{fl.ordered}</td>
                                      <td className="px-3 py-2.5 text-sm text-right text-slate-500">{fl.alreadyShipped}</td>
                                      <td className="px-3 py-2.5 text-sm text-right font-semibold text-amber-700">{remaining}</td>
                                      <td className={`px-3 py-2.5 text-sm text-right font-semibold ${fl.available <= 0 ? 'text-red-600' : 'text-slate-700'}`}>{fl.available}</td>
                                      <td className="px-4 py-2.5 text-right">
                                        <input
                                          type="number" min={0} max={maxShip}
                                          value={fl.shipQty}
                                          onChange={e => setFulfillLines(prev => prev.map((x, j) => j === i ? { ...x, shipQty: e.target.value } : x))}
                                          className={`w-20 text-sm text-right border rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-green-400 ${overStock ? 'border-red-300 bg-red-50' : 'border-green-200'}`}
                                        />
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>

                          <div className="grid grid-cols-4 gap-3 mb-4">
                            <div>
                              <label className="block text-xs font-medium text-green-800 mb-1">Ship Date</label>
                              <input type="date" value={fulfillShipDate} onChange={e => setFulfillShipDate(e.target.value)}
                                className="w-full border border-green-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-400 bg-white" />
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-green-800 mb-1">Shipping Method</label>
                              <input value={fulfillMethod} onChange={e => setFulfillMethod(e.target.value)} placeholder="UPS, FedEx, Pickup..."
                                className="w-full border border-green-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-400 bg-white" />
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-green-800 mb-1">Tracking #</label>
                              <input value={fulfillTracking} onChange={e => setFulfillTracking(e.target.value)} placeholder="Optional"
                                className="w-full border border-green-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-400 bg-white" />
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-green-800 mb-1">Notes</label>
                              <input value={fulfillNotes} onChange={e => setFulfillNotes(e.target.value)} placeholder="Optional"
                                className="w-full border border-green-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-400 bg-white" />
                            </div>
                          </div>

                          <div className="flex items-center justify-between">
                            <p className="text-sm text-green-800">Shipping <span className="font-bold">{fulfillShipTotal}</span> pieces &rarr; draft invoice auto-created</p>
                            <div className="flex gap-3">
                              <button onClick={closeFulfill} className="px-4 py-2 text-sm text-slate-600 hover:text-slate-800">Cancel</button>
                              <button onClick={submitFulfillment} disabled={saving || fulfillShipTotal === 0}
                                className="flex items-center gap-2 px-5 py-2 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white text-sm font-semibold rounded-lg transition-colors">
                                <Truck size={15} />
                                {saving ? 'Processing...' : 'Ship & Create Invoice'}
                              </button>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Lines table */}
                      <table className="w-full">
                        <thead>
                          <tr className="bg-slate-50 border-b border-slate-100">
                            <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Part #</th>
                            <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Description</th>
                            <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Ordered</th>
                            <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Unit Price</th>
                            <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Produced</th>
                            <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Shipped</th>
                            <th className="text-right px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                          {order.lines?.map(line => {
                            const remaining = Number(line.quantity_ordered) - Number(line.quantity_shipped);
                            const fullyShipped = remaining <= 0;
                            const readyToShip = Number(line.quantity_completed) - Number(line.quantity_shipped);
                            return (
                              <tr key={line.id} className={`hover:bg-slate-50 ${fullyShipped ? 'bg-green-50/30' : ''}`}>
                                <td className="px-6 py-3 font-mono text-sm text-slate-700">{(line.part as any)?.part_number}</td>
                                <td className="px-4 py-3 text-sm text-slate-600">{(line.part as any)?.description}</td>
                                <td className="px-4 py-3 text-sm text-right text-slate-900 font-medium">{line.quantity_ordered}</td>
                                <td className="px-4 py-3 text-sm text-right text-slate-500">
                                  {line.unit_price ? fmtCurrency(Number(line.unit_price)) : <span className="text-slate-300">—</span>}
                                </td>
                                <td className="px-4 py-3 text-right">
                                  <input
                                    type="number" min={0} max={line.quantity_ordered}
                                    defaultValue={line.quantity_completed}
                                    onBlur={e => updateLineCompleted(line.id, Number(e.target.value))}
                                    className="w-20 text-sm text-right border border-slate-200 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-amber-400"
                                  />
                                </td>
                                <td className="px-4 py-3 text-sm text-right font-semibold text-slate-700">{Number(line.quantity_shipped)}</td>
                                <td className="px-6 py-3 text-right">
                                  {fullyShipped ? (
                                    <span className="inline-flex items-center gap-1 text-xs font-medium text-green-700 bg-green-100 px-2.5 py-1 rounded-full">
                                      <CheckCircle2 size={11} /> Fulfilled
                                    </span>
                                  ) : readyToShip > 0 ? (
                                    <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-700 bg-amber-100 px-2.5 py-1 rounded-full">
                                      <Package size={11} /> {readyToShip} ready
                                    </span>
                                  ) : (
                                    <span className="text-xs text-slate-400">{remaining} remaining</span>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                        {value > 0 && (
                          <tfoot>
                            <tr className="bg-slate-50 border-t border-slate-100">
                              <td colSpan={3} className="px-6 py-2.5 text-xs font-semibold text-slate-500 text-right">Order Total</td>
                              <td colSpan={4} className="px-6 py-2.5 text-sm font-black text-slate-900 text-right">{fmtCurrency(value)}</td>
                            </tr>
                          </tfoot>
                        )}
                      </table>

                      <div className="px-6 py-3 border-t border-slate-100 flex items-center gap-3">
                        <button
                          onClick={e => { e.stopPropagation(); loadShipmentHistory(order.id); }}
                          className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-700 font-medium transition-colors"
                        >
                          <History size={13} />
                          {showHistory ? 'Hide' : 'View'} Shipment History
                        </button>
                      </div>

                      {showHistory && (
                        <div className="border-t border-slate-100 bg-slate-50 px-6 py-4">
                          {loadingHistory ? (
                            <p className="text-xs text-slate-400">Loading...</p>
                          ) : shipmentHistory.length === 0 ? (
                            <p className="text-xs text-slate-400">No shipments recorded for this order</p>
                          ) : (
                            <div className="space-y-3">
                              {shipmentHistory.map(s => (
                                <div key={s.id} className="bg-white border border-slate-200 rounded-lg p-4">
                                  <div className="flex items-center justify-between mb-2">
                                    <div className="flex items-center gap-3">
                                      <Truck size={14} className="text-green-600" />
                                      <span className="text-sm font-semibold text-slate-800">
                                        {new Date(s.ship_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                                      </span>
                                      {s.shipping_method && <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">{s.shipping_method}</span>}
                                      {s.tracking_number && <span className="text-xs text-slate-500 font-mono">{s.tracking_number}</span>}
                                    </div>
                                    <span className="text-xs text-slate-400">{s.lines.reduce((sum, l) => sum + Number(l.quantity_shipped), 0)} pcs</span>
                                  </div>
                                  <div className="flex flex-wrap gap-2">
                                    {s.lines.map(sl => (
                                      <div key={sl.id} className="text-xs bg-green-50 border border-green-200 rounded-lg px-2.5 py-1.5">
                                        <span className="font-mono font-semibold text-slate-700">{(sl.part as any)?.part_number}</span>
                                        <span className="text-slate-500 ml-1">{(sl.part as any)?.description}</span>
                                        <span className="ml-2 font-bold text-green-700">{sl.quantity_shipped}</span>
                                      </div>
                                    ))}
                                  </div>
                                  {s.notes && <p className="text-xs text-slate-500 mt-2">{s.notes}</p>}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
