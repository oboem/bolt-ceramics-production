import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import Header from '../components/layout/Header';
import Badge from '../components/ui/Badge';
import ProgressBar from '../components/ui/ProgressBar';
import {
  ChevronDown, ChevronRight, Clock, AlertTriangle, Plus, X,
  PackageCheck, Truck, CheckCircle2, Package, History,
} from 'lucide-react';

interface OrderLine {
  id: string;
  part_id: string;
  quantity_ordered: number;
  quantity_completed: number;
  quantity_shipped: number;
  part?: { part_number: string; description: string };
}

interface Order {
  id: string;
  order_number: string;
  customer_name: string;
  order_date: string;
  required_ship_date: string | null;
  status: string;
  notes: string | null;
  lines: OrderLine[];
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

export default function SalesOrders() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [showNewOrder, setShowNewOrder] = useState(false);
  const [newOrder, setNewOrder] = useState({ order_number: '', customer_name: '', required_ship_date: '', notes: '' });
  const [saving, setSaving] = useState(false);

  const [fulfillOrderId, setFulfillOrderId] = useState<string | null>(null);
  const [fulfillLines, setFulfillLines] = useState<FulfillLine[]>([]);
  const [fulfillShipDate, setFulfillShipDate] = useState(new Date().toISOString().split('T')[0]);
  const [fulfillMethod, setFulfillMethod] = useState('');
  const [fulfillTracking, setFulfillTracking] = useState('');
  const [fulfillNotes, setFulfillNotes] = useState('');

  const [shipmentHistoryOrderId, setShipmentHistoryOrderId] = useState<string | null>(null);
  const [shipmentHistory, setShipmentHistory] = useState<Shipment[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('sales_orders')
      .select(`
        id, order_number, customer_name, order_date, required_ship_date, status, notes,
        lines:sales_order_lines(
          id, part_id, quantity_ordered, quantity_completed, quantity_shipped,
          part:parts!sales_order_lines_part_id_fkey(part_number, description)
        )
      `)
      .order('order_date', { ascending: false });

    if (data) setOrders(data as any);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

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

  const createOrder = async () => {
    if (!newOrder.order_number || !newOrder.customer_name) return;
    setSaving(true);
    await supabase.from('sales_orders').insert({
      order_number: newOrder.order_number,
      customer_name: newOrder.customer_name,
      required_ship_date: newOrder.required_ship_date || null,
      notes: newOrder.notes || null,
      status: 'open',
    });
    setNewOrder({ order_number: '', customer_name: '', required_ship_date: '', notes: '' });
    setShowNewOrder(false);
    setSaving(false);
    load();
  };

  const openFulfill = async (order: Order) => {
    const shippableLines = order.lines.filter(l => {
      const remaining = Number(l.quantity_ordered) - Number(l.quantity_shipped);
      return remaining > 0;
    });

    if (shippableLines.length === 0) return;

    const invPromises = shippableLines.map(l =>
      supabase.from('inventory').select('quantity_on_hand').eq('part_id', l.part_id).maybeSingle()
    );
    const invResults = await Promise.all(invPromises);

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

    const shipmentLineInserts = linesToShip.map(l => ({
      shipment_id: shipment.id,
      sales_order_line_id: l.lineId,
      part_id: l.partId,
      quantity_shipped: Number(l.shipQty),
    }));
    await supabase.from('shipment_lines').insert(shipmentLineInserts);

    for (const l of linesToShip) {
      const qty = Number(l.shipQty);
      await supabase.from('sales_order_lines').update({
        quantity_shipped: l.alreadyShipped + qty,
      }).eq('id', l.lineId);

      const { data: inv } = await supabase.from('inventory')
        .select('id, quantity_on_hand')
        .eq('part_id', l.partId)
        .maybeSingle();
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
        const shipped = Number(l.quantity_shipped) + (line ? Number(line.shipQty) : 0);
        return shipped >= Number(l.quantity_ordered);
      });
      if (allFullyShipped) {
        await supabase.from('sales_orders').update({ status: 'shipped' }).eq('id', fulfillOrderId);
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
  };

  const loadShipmentHistory = async (orderId: string) => {
    if (shipmentHistoryOrderId === orderId) {
      setShipmentHistoryOrderId(null);
      return;
    }
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

  return (
    <div className="flex-1 overflow-y-auto bg-slate-50">
      <Header
        title="Sales Orders"
        subtitle={`${orders.filter(o => o.status !== 'shipped' && o.status !== 'cancelled').length} active orders`}
        onRefresh={load}
        loading={loading}
        actions={
          <button
            onClick={() => setShowNewOrder(true)}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-amber-500 hover:bg-amber-600 rounded-lg transition-colors"
          >
            <Plus size={15} /> New Order
          </button>
        }
      />

      <div className="p-8 space-y-6">
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
                <span className="ml-1.5 text-xs opacity-70">
                  ({orders.filter(o => o.status === s).length})
                </span>
              )}
            </button>
          ))}
        </div>

        {showNewOrder && (
          <div className="bg-white rounded-xl border border-amber-200 p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-slate-900">New Sales Order</h3>
              <button onClick={() => setShowNewOrder(false)} className="text-slate-400 hover:text-slate-600">
                <X size={18} />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Order Number *</label>
                <input
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                  placeholder="SO-2024-006"
                  value={newOrder.order_number}
                  onChange={e => setNewOrder(p => ({ ...p, order_number: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Customer Name *</label>
                <input
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                  placeholder="Customer name"
                  value={newOrder.customer_name}
                  onChange={e => setNewOrder(p => ({ ...p, customer_name: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Required Ship Date</label>
                <input
                  type="date"
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                  value={newOrder.required_ship_date}
                  onChange={e => setNewOrder(p => ({ ...p, required_ship_date: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Notes</label>
                <input
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                  placeholder="Optional notes"
                  value={newOrder.notes}
                  onChange={e => setNewOrder(p => ({ ...p, notes: e.target.value }))}
                />
              </div>
            </div>
            <div className="flex gap-3 mt-4">
              <button
                onClick={createOrder}
                disabled={saving || !newOrder.order_number || !newOrder.customer_name}
                className="px-4 py-2 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
              >
                {saving ? 'Saving...' : 'Create Order'}
              </button>
              <button onClick={() => setShowNewOrder(false)} className="px-4 py-2 text-sm text-slate-600 hover:text-slate-800">
                Cancel
              </button>
            </div>
          </div>
        )}

        <div className="space-y-3">
          {loading ? (
            <div className="bg-white rounded-xl border border-slate-200 p-8 text-center text-slate-400">Loading orders...</div>
          ) : filtered.length === 0 ? (
            <div className="bg-white rounded-xl border border-slate-200 p-8 text-center text-slate-400">No orders found</div>
          ) : (
            filtered.map(order => {
              const isExpanded = expanded.has(order.id);
              const totalQty = order.lines?.reduce((s, l) => s + Number(l.quantity_ordered), 0) ?? 0;
              const doneQty = order.lines?.reduce((s, l) => s + Number(l.quantity_completed), 0) ?? 0;
              const shippedQty = order.lines?.reduce((s, l) => s + Number(l.quantity_shipped), 0) ?? 0;
              const isLate = order.required_ship_date && new Date(order.required_ship_date) < new Date() && order.status !== 'shipped';
              const isFulfilling = fulfillOrderId === order.id;
              const hasUnshipped = order.lines?.some(l => Number(l.quantity_ordered) > Number(l.quantity_shipped));
              const showHistory = shipmentHistoryOrderId === order.id;

              return (
                <div key={order.id} className={`bg-white rounded-xl border overflow-hidden transition-colors ${
                  isFulfilling ? 'border-green-300 shadow-md' : 'border-slate-200'
                }`}>
                  <div
                    className="px-6 py-4 cursor-pointer hover:bg-slate-50 transition-colors"
                    onClick={() => toggle(order.id)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className="text-slate-400">
                          {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                        </span>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-slate-900">{order.order_number}</span>
                            <Badge label={order.status.replace('_', ' ')} variant={statusVariant[order.status] ?? 'slate'} />
                            {isLate && <span className="flex items-center gap-1 text-xs text-red-600 font-medium"><AlertTriangle size={11} /> Late</span>}
                          </div>
                          <p className="text-sm text-slate-500">{order.customer_name}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-6">
                        <div className="text-right">
                          <p className="text-sm font-semibold text-slate-900">
                            {shippedQty} / {totalQty}
                            <span className="text-xs font-normal text-slate-400 ml-1">shipped</span>
                          </p>
                          <p className="text-xs text-slate-400">
                            {doneQty} produced · {order.lines?.length ?? 0} lines
                          </p>
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
                        <span className="text-xs text-amber-600 font-medium whitespace-nowrap">
                          {doneQty - shippedQty} ready to ship
                        </span>
                      )}
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="border-t border-slate-100">
                      {order.notes && (
                        <div className="px-6 py-3 bg-amber-50 border-b border-amber-100 text-sm text-amber-800">
                          {order.notes}
                        </div>
                      )}

                      {isFulfilling && (
                        <div className="mx-6 mt-4 mb-2 bg-green-50 border border-green-200 rounded-xl p-5">
                          <div className="flex items-center justify-between mb-4">
                            <h3 className="font-semibold text-green-900 flex items-center gap-2">
                              <PackageCheck size={16} className="text-green-600" /> Fulfill Order
                            </h3>
                            <button onClick={closeFulfill} className="text-green-400 hover:text-green-600"><X size={18} /></button>
                          </div>

                          <div className="bg-white rounded-lg border border-green-200 overflow-hidden mb-4">
                            <table className="w-full">
                              <thead>
                                <tr className="border-b border-green-100 bg-green-50">
                                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-green-800 uppercase tracking-wide">Part</th>
                                  <th className="text-right px-3 py-2.5 text-xs font-semibold text-green-800 uppercase tracking-wide">Ordered</th>
                                  <th className="text-right px-3 py-2.5 text-xs font-semibold text-green-800 uppercase tracking-wide">Already Shipped</th>
                                  <th className="text-right px-3 py-2.5 text-xs font-semibold text-green-800 uppercase tracking-wide">Remaining</th>
                                  <th className="text-right px-3 py-2.5 text-xs font-semibold text-green-800 uppercase tracking-wide">In Stock</th>
                                  <th className="text-right px-4 py-2.5 text-xs font-semibold text-green-800 uppercase tracking-wide">Ship Qty</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-green-50">
                                {fulfillLines.map((fl, i) => {
                                  const remaining = fl.ordered - fl.alreadyShipped;
                                  const maxShip = Math.min(remaining, fl.available);
                                  const shipVal = Number(fl.shipQty || 0);
                                  const overStock = shipVal > fl.available;

                                  return (
                                    <tr key={fl.lineId} className="hover:bg-green-50/50">
                                      <td className="px-4 py-2.5">
                                        <p className="text-sm font-medium text-slate-800">{fl.description}</p>
                                        <p className="text-xs font-mono text-slate-400">{fl.partNumber}</p>
                                      </td>
                                      <td className="px-3 py-2.5 text-sm text-right text-slate-700">{fl.ordered}</td>
                                      <td className="px-3 py-2.5 text-sm text-right text-slate-500">{fl.alreadyShipped}</td>
                                      <td className="px-3 py-2.5 text-sm text-right font-semibold text-amber-700">{remaining}</td>
                                      <td className={`px-3 py-2.5 text-sm text-right font-semibold ${fl.available <= 0 ? 'text-red-600' : 'text-slate-700'}`}>
                                        {fl.available}
                                      </td>
                                      <td className="px-4 py-2.5 text-right">
                                        <input
                                          type="number"
                                          min={0}
                                          max={maxShip}
                                          value={fl.shipQty}
                                          onChange={e => {
                                            const val = e.target.value;
                                            setFulfillLines(prev => prev.map((x, j) => j === i ? { ...x, shipQty: val } : x));
                                          }}
                                          className={`w-20 text-sm text-right border rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-green-400 ${
                                            overStock ? 'border-red-300 bg-red-50' : 'border-green-200'
                                          }`}
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
                              <input type="date" value={fulfillShipDate}
                                onChange={e => setFulfillShipDate(e.target.value)}
                                className="w-full border border-green-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-400 bg-white"
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-green-800 mb-1">Shipping Method</label>
                              <input value={fulfillMethod}
                                onChange={e => setFulfillMethod(e.target.value)}
                                placeholder="UPS, FedEx, Pickup..."
                                className="w-full border border-green-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-400 bg-white"
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-green-800 mb-1">Tracking #</label>
                              <input value={fulfillTracking}
                                onChange={e => setFulfillTracking(e.target.value)}
                                placeholder="Optional"
                                className="w-full border border-green-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-400 bg-white"
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-green-800 mb-1">Notes</label>
                              <input value={fulfillNotes}
                                onChange={e => setFulfillNotes(e.target.value)}
                                placeholder="Optional"
                                className="w-full border border-green-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-400 bg-white"
                              />
                            </div>
                          </div>

                          <div className="flex items-center justify-between">
                            <p className="text-sm text-green-800">
                              Shipping <span className="font-bold">{fulfillShipTotal}</span> total pieces
                            </p>
                            <div className="flex gap-3">
                              <button onClick={closeFulfill}
                                className="px-4 py-2 text-sm text-slate-600 hover:text-slate-800">
                                Cancel
                              </button>
                              <button onClick={submitFulfillment}
                                disabled={saving || fulfillShipTotal === 0}
                                className="flex items-center gap-2 px-5 py-2 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white text-sm font-semibold rounded-lg transition-colors"
                              >
                                <Truck size={15} />
                                {saving ? 'Processing...' : 'Ship & Deduct Inventory'}
                              </button>
                            </div>
                          </div>
                        </div>
                      )}

                      <table className="w-full">
                        <thead>
                          <tr className="bg-slate-50 border-b border-slate-100">
                            <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Part #</th>
                            <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Description</th>
                            <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Ordered</th>
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
                                <td className="px-4 py-3 text-right">
                                  <input
                                    type="number"
                                    min={0}
                                    max={line.quantity_ordered}
                                    defaultValue={line.quantity_completed}
                                    onBlur={e => updateLineCompleted(line.id, Number(e.target.value))}
                                    className="w-20 text-sm text-right border border-slate-200 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-amber-400"
                                  />
                                </td>
                                <td className="px-4 py-3 text-sm text-right font-semibold text-slate-700">
                                  {Number(line.quantity_shipped)}
                                </td>
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
                                      {s.shipping_method && (
                                        <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">{s.shipping_method}</span>
                                      )}
                                      {s.tracking_number && (
                                        <span className="text-xs text-slate-500 font-mono">{s.tracking_number}</span>
                                      )}
                                    </div>
                                    <span className="text-xs text-slate-400">
                                      {s.lines.reduce((sum, l) => sum + Number(l.quantity_shipped), 0)} pcs
                                    </span>
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
