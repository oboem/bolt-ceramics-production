import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import Header from '../components/layout/Header';
import { AlertTriangle, Calendar, Truck, Plus, X, ShoppingBag, CheckCircle2, ClipboardList } from 'lucide-react';

interface ClayData {
  part_id: string;
  part_number: string;
  description: string;
  on_hand: number;
  reorder_point: number;
  reorder_quantity: number;
  avg_daily_lbs: number;
  days_remaining: number;
  projected_order_date: Date | null;
  recent_usage: { date: string; lbs: number }[];
  last_supplier: string;
}

interface Receipt {
  id: string;
  receipt_date: string;
  quantity_lbs: number;
  supplier: string | null;
  purchase_order: string | null;
  clay_part?: { part_number: string; description: string };
}

interface ClayOrder {
  id: string;
  clay_part_id: string;
  order_date: string;
  quantity_lbs: number;
  supplier: string;
  purchase_order: string;
  status: 'pending' | 'ordered' | 'received';
  notes: string;
  clay_part?: { part_number: string; description: string };
}

interface OrderForm {
  clay_part_id: string;
  clay_description: string;
  quantity_lbs: string;
  supplier: string;
  purchase_order: string;
  order_date: string;
  notes: string;
}

const emptyOrderForm = (): OrderForm => ({
  clay_part_id: '',
  clay_description: '',
  quantity_lbs: '',
  supplier: '',
  purchase_order: '',
  order_date: new Date().toISOString().split('T')[0],
  notes: '',
});

export default function ClayPlanning() {
  const [clays, setClays] = useState<ClayData[]>([]);
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [clayOrders, setClayOrders] = useState<ClayOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNewReceipt, setShowNewReceipt] = useState(false);
  const [showOrderForm, setShowOrderForm] = useState(false);
  const [orderForm, setOrderForm] = useState<OrderForm>(emptyOrderForm());
  const [clayParts, setClayParts] = useState<{ id: string; part_number: string; description: string }[]>([]);
  const [newReceipt, setNewReceipt] = useState({ clay_part_id: '', quantity_lbs: '', supplier: '', purchase_order: '', receipt_date: new Date().toISOString().split('T')[0] });
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'status' | 'orders' | 'receipts'>('status');

  const load = async () => {
    setLoading(true);
    await Promise.all([loadClayData(), loadReceipts(), loadClayOrders()]);
    setLoading(false);
  };

  const loadClayData = async () => {
    const { data: parts } = await supabase.from('parts').select('id, part_number, description').like('part_number', '5%').eq('active', true);
    if (!parts) return;
    setClayParts(parts);

    const results: ClayData[] = [];
    const lookback = new Date(Date.now() - 14 * 86400000).toISOString().split('T')[0];

    for (const part of parts) {
      const [{ data: inv }, { data: runs }, { data: lastReceipt }] = await Promise.all([
        supabase.from('inventory').select('quantity_on_hand, reorder_point, reorder_quantity').eq('part_id', part.id).maybeSingle(),
        supabase.from('production_runs').select('run_date, clay_used_lbs').eq('clay_part_id', part.id).gte('run_date', lookback).order('run_date', { ascending: true }),
        supabase.from('clay_receipts').select('supplier').eq('clay_part_id', part.id).order('receipt_date', { ascending: false }).limit(1).maybeSingle(),
      ]);

      const onHand = inv?.quantity_on_hand ?? 0;
      const reorderPt = inv?.reorder_point ?? 0;
      const reorderQty = inv?.reorder_quantity ?? 0;

      const byDay: Record<string, number> = {};
      for (const r of runs ?? []) {
        byDay[r.run_date] = (byDay[r.run_date] ?? 0) + Number(r.clay_used_lbs);
      }
      const dayEntries = Object.entries(byDay).map(([date, lbs]) => ({ date, lbs }));
      const totalLbs = dayEntries.reduce((s, d) => s + d.lbs, 0);
      const distinctDays = dayEntries.length;
      const avgDaily = distinctDays > 0 ? totalLbs / distinctDays : 0;
      const daysRemaining = avgDaily > 0 ? onHand / avgDaily : 999;

      let projectedOrderDate: Date | null = null;
      if (avgDaily > 0 && reorderPt > 0) {
        const daysUntilReorder = Math.max(0, (onHand - reorderPt) / avgDaily);
        projectedOrderDate = new Date(Date.now() + daysUntilReorder * 86400000);
      }

      results.push({
        part_id: part.id,
        part_number: part.part_number,
        description: part.description,
        on_hand: onHand,
        reorder_point: reorderPt,
        reorder_quantity: reorderQty,
        avg_daily_lbs: avgDaily,
        days_remaining: daysRemaining,
        projected_order_date: projectedOrderDate,
        recent_usage: dayEntries.slice(-7),
        last_supplier: lastReceipt?.supplier ?? '',
      });
    }
    setClays(results);
  };

  const loadReceipts = async () => {
    const { data } = await supabase
      .from('clay_receipts')
      .select('id, receipt_date, quantity_lbs, supplier, purchase_order, clay_part:parts!clay_receipts_clay_part_id_fkey(part_number, description)')
      .order('receipt_date', { ascending: false })
      .limit(20);
    if (data) setReceipts(data as any);
  };

  const loadClayOrders = async () => {
    const { data } = await supabase
      .from('clay_purchase_orders')
      .select('id, clay_part_id, order_date, quantity_lbs, supplier, purchase_order, status, notes, clay_part:parts!clay_purchase_orders_clay_part_id_fkey(part_number, description)')
      .order('order_date', { ascending: false })
      .limit(30);
    if (data) setClayOrders(data as any);
  };

  const openOrderForm = (clay?: ClayData) => {
    if (clay) {
      const nextPO = `PO-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 900) + 100)}`;
      setOrderForm({
        clay_part_id: clay.part_id,
        clay_description: clay.description,
        quantity_lbs: clay.reorder_quantity > 0 ? String(clay.reorder_quantity) : String(Math.ceil(clay.avg_daily_lbs * 30)),
        supplier: clay.last_supplier,
        purchase_order: nextPO,
        order_date: new Date().toISOString().split('T')[0],
        notes: '',
      });
    } else {
      setOrderForm(emptyOrderForm());
    }
    setShowOrderForm(true);
    setActiveTab('orders');
  };

  const submitOrder = async () => {
    if (!orderForm.clay_part_id || !orderForm.quantity_lbs) return;
    setSaving(true);
    await supabase.from('clay_purchase_orders').insert({
      clay_part_id: orderForm.clay_part_id,
      quantity_lbs: Number(orderForm.quantity_lbs),
      supplier: orderForm.supplier || null,
      purchase_order: orderForm.purchase_order || null,
      order_date: orderForm.order_date,
      notes: orderForm.notes || null,
      status: 'ordered',
    });
    setOrderForm(emptyOrderForm());
    setShowOrderForm(false);
    setSaving(false);
    loadClayOrders();
  };

  const markReceived = async (order: ClayOrder) => {
    await supabase.from('clay_purchase_orders').update({ status: 'received' }).eq('id', order.id);
    await supabase.from('clay_receipts').insert({
      clay_part_id: order.clay_part_id,
      quantity_lbs: order.quantity_lbs,
      supplier: order.supplier || null,
      purchase_order: order.purchase_order || null,
      receipt_date: new Date().toISOString().split('T')[0],
    });
    const partInv = await supabase.from('inventory').select('id, quantity_on_hand').eq('part_id', order.clay_part_id).maybeSingle();
    if (partInv.data) {
      await supabase.from('inventory').update({
        quantity_on_hand: partInv.data.quantity_on_hand + Number(order.quantity_lbs),
        updated_at: new Date().toISOString(),
      }).eq('id', partInv.data.id);
    }
    load();
  };

  const createReceipt = async () => {
    if (!newReceipt.clay_part_id || !newReceipt.quantity_lbs) return;
    setSaving(true);
    await supabase.from('clay_receipts').insert({
      clay_part_id: newReceipt.clay_part_id,
      quantity_lbs: Number(newReceipt.quantity_lbs),
      supplier: newReceipt.supplier || null,
      purchase_order: newReceipt.purchase_order || null,
      receipt_date: newReceipt.receipt_date,
    });
    const partInv = await supabase.from('inventory').select('id, quantity_on_hand').eq('part_id', newReceipt.clay_part_id).maybeSingle();
    if (partInv.data) {
      await supabase.from('inventory').update({
        quantity_on_hand: partInv.data.quantity_on_hand + Number(newReceipt.quantity_lbs),
        updated_at: new Date().toISOString(),
      }).eq('id', partInv.data.id);
    }
    setNewReceipt({ clay_part_id: '', quantity_lbs: '', supplier: '', purchase_order: '', receipt_date: new Date().toISOString().split('T')[0] });
    setShowNewReceipt(false);
    setSaving(false);
    load();
  };

  useEffect(() => { load(); }, []);

  const criticalClays = clays.filter(c => c.days_remaining < 7 || (c.reorder_point > 0 && c.on_hand <= c.reorder_point));
  const pendingOrders = clayOrders.filter(o => o.status === 'ordered');

  return (
    <div className="flex-1 overflow-y-auto bg-slate-50">
      <Header
        title="Clay Planning"
        subtitle="Usage tracking and reorder management"
        onRefresh={load}
        loading={loading}
        actions={
          <div className="flex gap-2">
            <button
              onClick={() => { setShowNewReceipt(true); setActiveTab('receipts'); }}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg transition-colors"
            >
              <Truck size={15} /> Log Receipt
            </button>
            <button
              onClick={() => openOrderForm()}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-amber-500 hover:bg-amber-600 rounded-lg transition-colors"
            >
              <Plus size={15} /> Place Order
            </button>
          </div>
        }
      />

      <div className="p-8 space-y-6">
        {criticalClays.length > 0 && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">
            <AlertTriangle size={18} className="text-red-500 mt-0.5 flex-shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-semibold text-red-800">Clay Reorder Alert</p>
              <p className="text-sm text-red-700 mt-0.5">
                {criticalClays.map(c => c.description).join(', ')} {criticalClays.length === 1 ? 'is' : 'are'} at or below reorder point.
              </p>
            </div>
            <button
              onClick={() => openOrderForm(criticalClays[0])}
              className="flex-shrink-0 px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white text-xs font-semibold rounded-lg transition-colors"
            >
              Order Now
            </button>
          </div>
        )}

        {pendingOrders.length > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
            <ClipboardList size={18} className="text-amber-600 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm font-semibold text-amber-800">{pendingOrders.length} open purchase order{pendingOrders.length > 1 ? 's' : ''}</p>
              <p className="text-sm text-amber-700 mt-0.5">
                {pendingOrders.map(o => `${(o.clay_part as any)?.description} — ${o.quantity_lbs} lbs`).join(' · ')}
              </p>
            </div>
          </div>
        )}

        <div className="flex gap-1 border-b border-slate-200">
          {(['status', 'orders', 'receipts'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-5 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab
                  ? 'border-amber-500 text-amber-700'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              {tab === 'status' ? 'Clay Status' : tab === 'orders' ? `Purchase Orders${pendingOrders.length > 0 ? ` (${pendingOrders.length})` : ''}` : 'Receipts'}
            </button>
          ))}
        </div>

        {activeTab === 'status' && (
          <div className="grid grid-cols-3 gap-6">
            {clays.map(clay => {
              const isLow = clay.reorder_point > 0 && clay.on_hand <= clay.reorder_point;
              const isCritical = clay.days_remaining < 7;
              const maxBar = Math.max(clay.on_hand, clay.reorder_point * 2.5, 1);

              return (
                <div key={clay.part_number} className={`bg-white rounded-xl border ${isLow || isCritical ? 'border-red-200' : 'border-slate-200'} overflow-hidden flex flex-col`}>
                  <div className={`px-6 py-4 ${isLow || isCritical ? 'bg-red-50' : 'bg-slate-50'} border-b ${isLow || isCritical ? 'border-red-100' : 'border-slate-100'}`}>
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-xs font-mono text-slate-400">{clay.part_number}</p>
                        <p className="font-semibold text-slate-900 mt-0.5">{clay.description}</p>
                      </div>
                      {(isLow || isCritical) && <AlertTriangle size={16} className="text-red-500 flex-shrink-0" />}
                    </div>
                  </div>

                  <div className="px-6 py-5 space-y-4 flex-1">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-slate-50 rounded-lg p-3">
                        <p className="text-xs text-slate-500">On Hand</p>
                        <p className={`text-2xl font-bold mt-0.5 ${isLow ? 'text-red-600' : 'text-slate-900'}`}>{clay.on_hand.toFixed(0)}</p>
                        <p className="text-xs text-slate-400">lbs</p>
                      </div>
                      <div className="bg-slate-50 rounded-lg p-3">
                        <p className="text-xs text-slate-500">Days Left</p>
                        <p className={`text-2xl font-bold mt-0.5 ${isCritical ? 'text-red-600' : 'text-slate-900'}`}>
                          {clay.days_remaining < 999 ? clay.days_remaining.toFixed(0) : '—'}
                        </p>
                        <p className="text-xs text-slate-400">at avg rate</p>
                      </div>
                    </div>

                    <div>
                      <div className="flex justify-between text-xs text-slate-500 mb-1.5">
                        <span>Stock Level</span>
                        <span>Reorder at {clay.reorder_point} lbs</span>
                      </div>
                      <div className="h-3 bg-slate-200 rounded-full overflow-hidden relative">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${isLow ? 'bg-red-500' : clay.days_remaining < 14 ? 'bg-amber-500' : 'bg-green-500'}`}
                          style={{ width: `${Math.min(100, (clay.on_hand / maxBar) * 100)}%` }}
                        />
                        {clay.reorder_point > 0 && (
                          <div
                            className="absolute top-0 bottom-0 w-0.5 bg-red-400 opacity-70"
                            style={{ left: `${Math.min(100, (clay.reorder_point / maxBar) * 100)}%` }}
                          />
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div>
                        <p className="text-xs text-slate-400">Avg Daily Usage</p>
                        <p className="font-semibold text-slate-800">{clay.avg_daily_lbs > 0 ? `${clay.avg_daily_lbs.toFixed(1)} lbs` : 'No data'}</p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-400">Reorder Qty</p>
                        <p className="font-semibold text-slate-800">{clay.reorder_quantity > 0 ? `${clay.reorder_quantity} lbs` : '—'}</p>
                      </div>
                    </div>

                    {clay.projected_order_date && (
                      <div className={`flex items-center gap-2 p-3 rounded-lg text-sm ${clay.projected_order_date <= new Date() ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-700'}`}>
                        <Calendar size={14} className="flex-shrink-0" />
                        <span>
                          {clay.projected_order_date <= new Date()
                            ? 'Order needed now'
                            : `Order by ${clay.projected_order_date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`}
                        </span>
                      </div>
                    )}

                    {clay.recent_usage.length > 0 && (
                      <div>
                        <p className="text-xs text-slate-400 mb-2">Recent Usage (last 7 days)</p>
                        <div className="flex items-end gap-1 h-12">
                          {clay.recent_usage.map((d, i) => {
                            const max = Math.max(...clay.recent_usage.map(x => x.lbs));
                            const h = max > 0 ? (d.lbs / max) * 100 : 0;
                            return (
                              <div key={i} className="flex-1 flex flex-col items-center gap-1">
                                <div className="w-full bg-slate-200 rounded-sm overflow-hidden" style={{ height: '40px' }}>
                                  <div className="w-full bg-orange-400 rounded-sm transition-all" style={{ height: `${h}%`, marginTop: `${100 - h}%` }} />
                                </div>
                                <span className="text-xs text-slate-300 leading-none">
                                  {new Date(d.date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'narrow' })}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="px-6 pb-5">
                    <button
                      onClick={() => openOrderForm(clay)}
                      className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold transition-colors ${
                        isLow || isCritical
                          ? 'bg-red-600 hover:bg-red-700 text-white'
                          : 'bg-amber-500 hover:bg-amber-600 text-white'
                      }`}
                    >
                      <ShoppingBag size={15} />
                      {isLow || isCritical ? 'Order Now' : 'Place Order'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {activeTab === 'orders' && (
          <div className="space-y-4">
            {showOrderForm && (
              <div className="bg-white rounded-xl border border-amber-200 p-6 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold text-slate-900 flex items-center gap-2">
                    <ShoppingBag size={16} className="text-amber-500" /> Place Clay Purchase Order
                  </h3>
                  <button onClick={() => setShowOrderForm(false)} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Clay Type *</label>
                    <select
                      className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                      value={orderForm.clay_part_id}
                      onChange={e => {
                        const part = clayParts.find(p => p.id === e.target.value);
                        setOrderForm(f => ({ ...f, clay_part_id: e.target.value, clay_description: part?.description ?? '' }));
                      }}
                    >
                      <option value="">Select clay...</option>
                      {clayParts.map(p => <option key={p.id} value={p.id}>{p.part_number} — {p.description}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Quantity (lbs) *</label>
                    <input
                      type="number" min={0}
                      className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                      placeholder="500"
                      value={orderForm.quantity_lbs}
                      onChange={e => setOrderForm(f => ({ ...f, quantity_lbs: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Order Date</label>
                    <input
                      type="date"
                      className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                      value={orderForm.order_date}
                      onChange={e => setOrderForm(f => ({ ...f, order_date: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Supplier</label>
                    <input
                      className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                      placeholder="Supplier name"
                      value={orderForm.supplier}
                      onChange={e => setOrderForm(f => ({ ...f, supplier: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Purchase Order #</label>
                    <input
                      className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                      placeholder="PO-2024-xxx"
                      value={orderForm.purchase_order}
                      onChange={e => setOrderForm(f => ({ ...f, purchase_order: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Notes</label>
                    <input
                      className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                      placeholder="Optional notes"
                      value={orderForm.notes}
                      onChange={e => setOrderForm(f => ({ ...f, notes: e.target.value }))}
                    />
                  </div>
                </div>
                <div className="flex gap-3 mt-4">
                  <button
                    onClick={submitOrder}
                    disabled={saving || !orderForm.clay_part_id || !orderForm.quantity_lbs}
                    className="px-5 py-2 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white text-sm font-semibold rounded-lg transition-colors"
                  >
                    {saving ? 'Saving...' : 'Submit Order'}
                  </button>
                  <button onClick={() => setShowOrderForm(false)} className="px-4 py-2 text-sm text-slate-600 hover:text-slate-800">Cancel</button>
                </div>
              </div>
            )}

            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                <h2 className="font-semibold text-slate-900 flex items-center gap-2">
                  <ClipboardList size={16} className="text-slate-400" /> Purchase Orders
                </h2>
                {!showOrderForm && (
                  <button onClick={() => openOrderForm()} className="flex items-center gap-1.5 text-sm text-amber-600 hover:text-amber-700 font-medium">
                    <Plus size={14} /> New Order
                  </button>
                )}
              </div>
              {clayOrders.length === 0 ? (
                <div className="px-6 py-10 text-center">
                  <ShoppingBag size={28} className="text-slate-300 mx-auto mb-2" />
                  <p className="text-sm text-slate-400">No purchase orders yet</p>
                  <button onClick={() => openOrderForm()} className="mt-3 text-sm text-amber-600 hover:text-amber-700 font-medium">Place your first order</button>
                </div>
              ) : (
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-slate-100">
                      <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Date</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Clay</th>
                      <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Qty (lbs)</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Supplier</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">PO #</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Status</th>
                      <th className="text-right px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {clayOrders.map(order => (
                      <tr key={order.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-6 py-3 text-sm text-slate-600">
                          {new Date(order.order_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                        </td>
                        <td className="px-4 py-3">
                          <p className="text-sm text-slate-800">{(order.clay_part as any)?.description}</p>
                          <p className="text-xs text-slate-400 font-mono">{(order.clay_part as any)?.part_number}</p>
                        </td>
                        <td className="px-4 py-3 text-sm text-right font-semibold text-slate-900">{Number(order.quantity_lbs).toFixed(0)}</td>
                        <td className="px-4 py-3 text-sm text-slate-600">{order.supplier || '—'}</td>
                        <td className="px-4 py-3 text-sm font-mono text-slate-500">{order.purchase_order || '—'}</td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            order.status === 'received' ? 'bg-green-100 text-green-800' :
                            order.status === 'ordered' ? 'bg-amber-100 text-amber-800' :
                            'bg-slate-100 text-slate-700'
                          }`}>
                            {order.status === 'received' && <CheckCircle2 size={10} />}
                            {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
                          </span>
                        </td>
                        <td className="px-6 py-3 text-right">
                          {order.status === 'ordered' && (
                            <button
                              onClick={() => markReceived(order)}
                              className="text-xs font-medium px-3 py-1.5 bg-green-100 hover:bg-green-200 text-green-800 rounded-lg transition-colors"
                            >
                              Mark Received
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}

        {activeTab === 'receipts' && (
          <div className="space-y-4">
            {showNewReceipt && (
              <div className="bg-white rounded-xl border border-amber-200 p-6 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold text-slate-900 flex items-center gap-2">
                    <Truck size={16} className="text-amber-500" /> Log Clay Receipt
                  </h3>
                  <button onClick={() => setShowNewReceipt(false)} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Clay Type *</label>
                    <select
                      className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                      value={newReceipt.clay_part_id}
                      onChange={e => setNewReceipt(p => ({ ...p, clay_part_id: e.target.value }))}
                    >
                      <option value="">Select clay...</option>
                      {clayParts.map(p => <option key={p.id} value={p.id}>{p.part_number} — {p.description}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Quantity (lbs) *</label>
                    <input type="number" min={0}
                      className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                      placeholder="500" value={newReceipt.quantity_lbs}
                      onChange={e => setNewReceipt(p => ({ ...p, quantity_lbs: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Receipt Date</label>
                    <input type="date"
                      className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                      value={newReceipt.receipt_date}
                      onChange={e => setNewReceipt(p => ({ ...p, receipt_date: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Supplier</label>
                    <input className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                      placeholder="Supplier name" value={newReceipt.supplier}
                      onChange={e => setNewReceipt(p => ({ ...p, supplier: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Purchase Order #</label>
                    <input className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                      placeholder="PO-2024-xxx" value={newReceipt.purchase_order}
                      onChange={e => setNewReceipt(p => ({ ...p, purchase_order: e.target.value }))}
                    />
                  </div>
                </div>
                <div className="flex gap-3 mt-4">
                  <button onClick={createReceipt} disabled={saving || !newReceipt.clay_part_id || !newReceipt.quantity_lbs}
                    className="px-4 py-2 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
                  >
                    {saving ? 'Saving...' : 'Log Receipt'}
                  </button>
                  <button onClick={() => setShowNewReceipt(false)} className="px-4 py-2 text-sm text-slate-600 hover:text-slate-800">Cancel</button>
                </div>
              </div>
            )}

            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                <h2 className="font-semibold text-slate-900 flex items-center gap-2">
                  <Truck size={16} className="text-slate-400" /> Receipts History
                </h2>
                {!showNewReceipt && (
                  <button onClick={() => setShowNewReceipt(true)} className="flex items-center gap-1.5 text-sm text-amber-600 hover:text-amber-700 font-medium">
                    <Plus size={14} /> Log Receipt
                  </button>
                )}
              </div>
              {receipts.length === 0 ? (
                <div className="px-6 py-6 text-sm text-slate-400">No receipts recorded</div>
              ) : (
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-slate-100">
                      <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Date</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Clay Type</th>
                      <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Qty (lbs)</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Supplier</th>
                      <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">PO #</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {receipts.map(r => (
                      <tr key={r.id} className="hover:bg-slate-50">
                        <td className="px-6 py-3 text-sm text-slate-600">
                          {new Date(r.receipt_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                        </td>
                        <td className="px-4 py-3">
                          <p className="text-sm text-slate-800">{(r.clay_part as any)?.description}</p>
                          <p className="text-xs text-slate-400 font-mono">{(r.clay_part as any)?.part_number}</p>
                        </td>
                        <td className="px-4 py-3 text-sm text-right font-semibold text-slate-900">{r.quantity_lbs.toFixed(0)}</td>
                        <td className="px-4 py-3 text-sm text-slate-600">{r.supplier ?? '—'}</td>
                        <td className="px-6 py-3 text-sm font-mono text-slate-500">{r.purchase_order ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
