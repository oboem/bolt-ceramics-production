import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import Header from '../components/layout/Header';
import StatCard from '../components/ui/StatCard';
import ProgressBar from '../components/ui/ProgressBar';
import {
  ShoppingCart, Package, Droplets, AlertTriangle, CheckCircle2,
  Clock, Layers, Flame, CalendarClock, ArrowRight, PackageCheck,
  DollarSign, TrendingUp, Receipt, CreditCard, UserPlus, X, Users, Pencil, Check,
} from 'lucide-react';

function fmtCurrency(v: number) { return v.toLocaleString('en-US', { style: 'currency', currency: 'USD' }); }

interface Worker { id: string; name: string; active: boolean; }

interface FinanceSummary {
  outstanding: number;
  overdueCount: number;
  overdueAmount: number;
  collectedThisMonth: number;
  invoicedThisMonth: number;
  openQuoteValue: number;
}

interface OrderLineWithPart {
  id: string;
  quantity_ordered: number;
  quantity_completed: number;
  quantity_shipped: number;
  part_id: string;
  assigned_worker_id: string | null;
  part: { part_number: string; description: string };
  sales_order: { order_number: string; customer_name: string; required_ship_date: string | null; status: string };
}

interface ClayStatus {
  part_number: string;
  description: string;
  on_hand: number;
  avg_daily_lbs: number;
  days_remaining: number;
  reorder_point: number;
}

interface BisqueItem {
  part_number: string;
  description: string;
  on_hand: number;
}

interface ProductionNeed {
  partNumber: string;
  description: string;
  partId: string;
  totalNeeded: number;
  totalProduced: number;
  totalShipped: number;
  inventoryOnHand: number;
  toProduce: number;
  urgency: 'overdue' | 'this_week' | 'upcoming';
  earliestShipDate: string | null;
  orders: { lineId: string; orderNumber: string; customer: string; qty: number; produced: number; shipDate: string | null; assignedWorkerId: string | null }[];
}

function daysFromNow(dateStr: string): number {
  const d = new Date(dateStr + 'T00:00:00');
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return Math.ceil((d.getTime() - now.getTime()) / 86400000);
}

export default function Dashboard() {
  const [loading, setLoading] = useState(true);
  const [clayStatus, setClayStatus] = useState<ClayStatus[]>([]);
  const [bisqueItems, setBisqueItems] = useState<BisqueItem[]>([]);
  const [productionNeeds, setProductionNeeds] = useState<ProductionNeed[]>([]);
  const [totalPieces, setTotalPieces] = useState(0);
  const [completedPieces, setCompletedPieces] = useState(0);
  const [shippedPieces, setShippedPieces] = useState(0);
  const [openOrderCount, setOpenOrderCount] = useState(0);
  const [finance, setFinance] = useState<FinanceSummary>({ outstanding: 0, overdueCount: 0, overdueAmount: 0, collectedThisMonth: 0, invoicedThisMonth: 0, openQuoteValue: 0 });
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [showWorkerPanel, setShowWorkerPanel] = useState(false);
  const [newWorkerName, setNewWorkerName] = useState('');
  const [editWorkerId, setEditWorkerId] = useState<string | null>(null);
  const [editWorkerName, setEditWorkerName] = useState('');

  const loadWorkers = useCallback(async () => {
    const { data } = await supabase.from('workers').select('id, name, active').eq('active', true).order('name');
    if (data) setWorkers(data);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    await Promise.all([loadOrderLines(), loadClayStatus(), loadBisqueInventory(), loadFinance(), loadWorkers()]);
    setLoading(false);
  }, [loadWorkers]);

  const loadFinance = async () => {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];

    const [{ data: invoices }, { data: payments }, { data: quotes }] = await Promise.all([
      supabase.from('invoices').select('id, invoice_date, due_date, status, lines:invoice_lines(quantity, unit_price, discount_pct)'),
      supabase.from('payments').select('amount, payment_date, invoice_id'),
      supabase.from('quotes').select('status, lines:quote_lines(quantity, unit_price, discount_pct)').in('status', ['draft', 'sent']),
    ]);

    const lineAmt = (lines: any[]) => lines.reduce((s: number, l: any) => s + l.quantity * l.unit_price * (1 - (l.discount_pct ?? 0) / 100), 0);
    const invoiceTotals: Record<string, number> = {};
    let outstanding = 0, overdueCount = 0, overdueAmount = 0, invoicedThisMonth = 0;

    for (const inv of invoices ?? []) {
      const total = lineAmt((inv as any).lines ?? []);
      invoiceTotals[inv.id] = total;
      if (inv.invoice_date >= monthStart) invoicedThisMonth += total;
    }

    const paidByInvoice: Record<string, number> = {};
    let collectedThisMonth = 0;
    for (const p of payments ?? []) {
      paidByInvoice[p.invoice_id] = (paidByInvoice[p.invoice_id] ?? 0) + Number(p.amount);
      if (p.payment_date >= monthStart) collectedThisMonth += Number(p.amount);
    }

    for (const inv of invoices ?? []) {
      if (inv.status === 'void') continue;
      const total = invoiceTotals[inv.id] ?? 0;
      const paid = paidByInvoice[inv.id] ?? 0;
      const remaining = total - paid;
      if (remaining > 0 && inv.status !== 'paid') {
        outstanding += remaining;
        const isOverdue = inv.due_date && new Date(inv.due_date + 'T00:00:00') < now;
        if (isOverdue) { overdueCount++; overdueAmount += remaining; }
      }
    }

    const openQuoteValue = (quotes ?? []).reduce((s, q) => s + lineAmt((q as any).lines ?? []), 0);
    setFinance({ outstanding, overdueCount, overdueAmount, collectedThisMonth, invoicedThisMonth, openQuoteValue });
  };

  const loadOrderLines = async () => {
    const { data } = await supabase
      .from('sales_order_lines')
      .select(`
        id, part_id, quantity_ordered, quantity_completed, quantity_shipped, assigned_worker_id,
        part:parts!sales_order_lines_part_id_fkey(part_number, description),
        sales_order:sales_orders!sales_order_lines_sales_order_id_fkey(order_number, customer_name, required_ship_date, status)
      `)
      .neq('sales_orders.status', 'shipped')
      .neq('sales_orders.status', 'cancelled');

    if (!data) return;

    const open = data.filter(l => {
      const so = l.sales_order as any;
      return so?.status !== 'shipped' && so?.status !== 'cancelled';
    }) as any as OrderLineWithPart[];

    const orderSet = new Set(open.map(l => l.sales_order.order_number));
    setOpenOrderCount(orderSet.size);
    const total = open.reduce((s, l) => s + Number(l.quantity_ordered), 0);
    const done = open.reduce((s, l) => s + Number(l.quantity_completed), 0);
    const shipped = open.reduce((s, l) => s + Number(l.quantity_shipped), 0);
    setTotalPieces(total);
    setCompletedPieces(done);
    setShippedPieces(shipped);

    const invIds = [...new Set(open.map(l => l.part_id))];
    const invMap: Record<string, number> = {};
    if (invIds.length > 0) {
      const { data: invData } = await supabase.from('inventory').select('part_id, quantity_on_hand').in('part_id', invIds);
      for (const row of invData ?? []) invMap[row.part_id] = Number(row.quantity_on_hand);
    }

    const grouped: Record<string, ProductionNeed> = {};
    for (const line of open) {
      const remaining = Number(line.quantity_ordered) - Number(line.quantity_completed);
      if (remaining <= 0) continue;
      const pn = line.part.part_number;
      const so = line.sales_order;
      let urgency: 'overdue' | 'this_week' | 'upcoming' = 'upcoming';
      if (so.required_ship_date) {
        const days = daysFromNow(so.required_ship_date);
        if (days < 0) urgency = 'overdue';
        else if (days <= 7) urgency = 'this_week';
      }
      if (!grouped[pn]) {
        grouped[pn] = { partNumber: pn, description: line.part.description, partId: line.part_id, totalNeeded: 0, totalProduced: 0, totalShipped: 0, inventoryOnHand: invMap[line.part_id] ?? 0, toProduce: 0, urgency, earliestShipDate: so.required_ship_date, orders: [] };
      }
      const need = grouped[pn];
      need.totalNeeded += Number(line.quantity_ordered);
      need.totalProduced += Number(line.quantity_completed);
      need.totalShipped += Number(line.quantity_shipped);
      if (urgency === 'overdue') need.urgency = 'overdue';
      else if (urgency === 'this_week' && need.urgency !== 'overdue') need.urgency = 'this_week';
      if (so.required_ship_date && (!need.earliestShipDate || so.required_ship_date < need.earliestShipDate)) {
        need.earliestShipDate = so.required_ship_date;
      }
      need.orders.push({ lineId: line.id, orderNumber: so.order_number, customer: so.customer_name, qty: Number(line.quantity_ordered), produced: Number(line.quantity_completed), shipDate: so.required_ship_date, assignedWorkerId: line.assigned_worker_id });
    }

    for (const need of Object.values(grouped)) need.toProduce = Math.max(0, need.totalNeeded - need.totalProduced);

    const urgencyOrder = { overdue: 0, this_week: 1, upcoming: 2 };
    setProductionNeeds(
      Object.values(grouped).filter(n => n.toProduce > 0).sort((a, b) => {
        const uDiff = urgencyOrder[a.urgency] - urgencyOrder[b.urgency];
        if (uDiff !== 0) return uDiff;
        if (a.earliestShipDate && b.earliestShipDate) return a.earliestShipDate.localeCompare(b.earliestShipDate);
        if (a.earliestShipDate) return -1;
        if (b.earliestShipDate) return 1;
        return b.toProduce - a.toProduce;
      })
    );
  };

  const loadClayStatus = async () => {
    const { data: clayParts } = await supabase.from('parts').select('id, part_number, description').like('part_number', '5%');
    if (!clayParts) return;
    const statuses: ClayStatus[] = [];
    for (const part of clayParts) {
      const [{ data: inv }, { data: runs }] = await Promise.all([
        supabase.from('inventory').select('quantity_on_hand, reorder_point').eq('part_id', part.id).maybeSingle(),
        supabase.from('production_runs').select('clay_used_lbs, run_date').eq('clay_part_id', part.id).gte('run_date', new Date(Date.now() - 14 * 86400000).toISOString().split('T')[0])
      ]);
      const onHand = inv?.quantity_on_hand ?? 0;
      const reorderPoint = inv?.reorder_point ?? 0;
      const totalLbs = runs?.reduce((s, r) => s + Number(r.clay_used_lbs), 0) ?? 0;
      const distinctDays = new Set(runs?.map(r => r.run_date) ?? []).size;
      const avgDaily = distinctDays > 0 ? totalLbs / distinctDays : 0;
      statuses.push({ part_number: part.part_number, description: part.description, on_hand: onHand, avg_daily_lbs: avgDaily, days_remaining: avgDaily > 0 ? onHand / avgDaily : 999, reorder_point: reorderPoint });
    }
    setClayStatus(statuses);
  };

  const loadBisqueInventory = async () => {
    const { data } = await supabase.from('inventory').select('quantity_on_hand, part:parts!inventory_part_id_fkey(part_number, description)').gt('quantity_on_hand', 0);
    if (data) {
      setBisqueItems(data.filter(i => (i.part as any)?.part_number?.startsWith('6')).map(i => ({ part_number: (i.part as any).part_number, description: (i.part as any).description, on_hand: i.quantity_on_hand })));
    }
  };

  const assignWorker = async (lineId: string, workerId: string | null) => {
    await supabase.from('sales_order_lines').update({ assigned_worker_id: workerId || null }).eq('id', lineId);
    await loadOrderLines();
  };

  const addWorker = async () => {
    if (!newWorkerName.trim()) return;
    await supabase.from('workers').insert({ name: newWorkerName.trim() });
    setNewWorkerName('');
    loadWorkers();
  };

  const saveWorkerEdit = async (id: string) => {
    if (!editWorkerName.trim()) return;
    await supabase.from('workers').update({ name: editWorkerName.trim() }).eq('id', id);
    setEditWorkerId(null);
    loadWorkers();
  };

  const deactivateWorker = async (id: string) => {
    await supabase.from('workers').update({ active: false }).eq('id', id);
    loadWorkers();
  };

  useEffect(() => { load(); }, [load]);

  const today = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
  const overdueNeeds = productionNeeds.filter(n => n.urgency === 'overdue');
  const thisWeekNeeds = productionNeeds.filter(n => n.urgency === 'this_week');
  const upcomingNeeds = productionNeeds.filter(n => n.urgency === 'upcoming');
  const readyToShip = completedPieces - shippedPieces;

  return (
    <div className="flex-1 overflow-y-auto bg-slate-50">
      <Header title="Production Dashboard" subtitle={today} onRefresh={load} loading={loading} />

      <div className="p-8 space-y-8">
        <div className="grid grid-cols-5 gap-4">
          <StatCard label="Open Orders" value={openOrderCount} sub="Active sales orders" icon={<ShoppingCart size={20} />} accent="blue" />
          <StatCard label="Pieces to Produce" value={totalPieces - completedPieces} sub={`${totalPieces} ordered total`} icon={<Package size={20} />} accent="amber" />
          <StatCard label="Produced" value={completedPieces} sub={`${totalPieces > 0 ? ((completedPieces / totalPieces) * 100).toFixed(0) : 0}% complete`} icon={<CheckCircle2 size={20} />} accent="green" />
          <StatCard label="Ready to Ship" value={readyToShip > 0 ? readyToShip : 0} sub="Produced, not yet shipped" icon={<PackageCheck size={20} />} accent={readyToShip > 0 ? 'amber' : 'slate'} />
          <StatCard label="Bisqueware" value={bisqueItems.reduce((s, b) => s + b.on_hand, 0)} sub="In process for glaze" icon={<Layers size={20} />} accent="slate" />
        </div>

        {/* Production priorities */}
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="px-6 py-5 border-b border-slate-100 bg-slate-900">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-amber-500 flex items-center justify-center">
                  <Flame size={20} className="text-white" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-white">Today's Production</h2>
                  <p className="text-sm text-slate-400">
                    {productionNeeds.length} part{productionNeeds.length !== 1 ? 's' : ''} need production
                    {' '}&middot;{' '}
                    {productionNeeds.reduce((s, n) => s + n.toProduce, 0)} total pieces
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                {overdueNeeds.length > 0 && (
                  <div className="flex items-center gap-2 bg-red-500/20 border border-red-500/30 rounded-lg px-3 py-1.5">
                    <AlertTriangle size={14} className="text-red-400" />
                    <span className="text-sm font-semibold text-red-300">{overdueNeeds.length} overdue</span>
                  </div>
                )}
                <div className="relative">
                  <button
                    onClick={() => setShowWorkerPanel(v => !v)}
                    className="flex items-center gap-2 px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-200 text-sm font-medium rounded-lg transition-colors"
                  >
                    <Users size={14} />
                    Manage Workers
                  </button>
                  {showWorkerPanel && (
                    <div className="absolute right-0 top-full mt-2 w-72 bg-white border border-slate-200 rounded-xl shadow-xl z-50 p-4">
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="font-semibold text-slate-900 text-sm">Workers</h3>
                        <button onClick={() => setShowWorkerPanel(false)} className="text-slate-400 hover:text-slate-600"><X size={15} /></button>
                      </div>
                      <div className="space-y-1.5 mb-3 max-h-48 overflow-y-auto">
                        {workers.length === 0 && <p className="text-xs text-slate-400 text-center py-2">No workers yet</p>}
                        {workers.map(w => (
                          <div key={w.id} className="flex items-center gap-2">
                            {editWorkerId === w.id ? (
                              <>
                                <input value={editWorkerName} onChange={e => setEditWorkerName(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') saveWorkerEdit(w.id); if (e.key === 'Escape') setEditWorkerId(null); }} autoFocus className="flex-1 text-sm border border-amber-300 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-amber-400" />
                                <button onClick={() => saveWorkerEdit(w.id)} className="text-green-600 hover:text-green-700"><Check size={14} /></button>
                                <button onClick={() => setEditWorkerId(null)} className="text-slate-400 hover:text-slate-600"><X size={14} /></button>
                              </>
                            ) : (
                              <>
                                <span className="flex-1 text-sm text-slate-700">{w.name}</span>
                                <button onClick={() => { setEditWorkerId(w.id); setEditWorkerName(w.name); }} className="text-slate-300 hover:text-amber-500"><Pencil size={13} /></button>
                                <button onClick={() => deactivateWorker(w.id)} className="text-slate-300 hover:text-red-500"><X size={13} /></button>
                              </>
                            )}
                          </div>
                        ))}
                      </div>
                      <div className="flex gap-2 border-t border-slate-100 pt-3">
                        <input value={newWorkerName} onChange={e => setNewWorkerName(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') addWorker(); }} placeholder="New worker name..." className="flex-1 text-sm border border-slate-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-amber-400" />
                        <button onClick={addWorker} className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white text-sm font-semibold rounded-lg transition-colors"><UserPlus size={14} /></button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {loading ? (
            <div className="p-8 text-center text-slate-400">Loading production needs...</div>
          ) : productionNeeds.length === 0 ? (
            <div className="p-10 text-center">
              <CheckCircle2 size={32} className="text-green-400 mx-auto mb-2" />
              <p className="text-sm font-medium text-slate-600">All caught up -- no production needed right now</p>
            </div>
          ) : (
            <div>
              {overdueNeeds.length > 0 && (
                <div>
                  <div className="px-6 py-2.5 bg-red-50 border-b border-red-100 flex items-center gap-2">
                    <AlertTriangle size={13} className="text-red-500" />
                    <span className="text-xs font-bold uppercase tracking-wider text-red-700">Past Due -- Produce Immediately</span>
                    <span className="text-xs text-red-500 ml-auto">{overdueNeeds.reduce((s, n) => s + n.toProduce, 0)} pcs</span>
                  </div>
                  {overdueNeeds.map(need => <ProductionNeedRow key={need.partNumber} need={need} workers={workers} onAssign={assignWorker} />)}
                </div>
              )}
              {thisWeekNeeds.length > 0 && (
                <div>
                  <div className="px-6 py-2.5 bg-amber-50 border-b border-amber-100 border-t border-t-amber-100 flex items-center gap-2">
                    <CalendarClock size={13} className="text-amber-600" />
                    <span className="text-xs font-bold uppercase tracking-wider text-amber-700">Due This Week</span>
                    <span className="text-xs text-amber-500 ml-auto">{thisWeekNeeds.reduce((s, n) => s + n.toProduce, 0)} pcs</span>
                  </div>
                  {thisWeekNeeds.map(need => <ProductionNeedRow key={need.partNumber} need={need} workers={workers} onAssign={assignWorker} />)}
                </div>
              )}
              {upcomingNeeds.length > 0 && (
                <div>
                  <div className="px-6 py-2.5 bg-slate-50 border-b border-slate-100 border-t border-t-slate-200 flex items-center gap-2">
                    <Clock size={13} className="text-slate-500" />
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-600">Upcoming</span>
                    <span className="text-xs text-slate-400 ml-auto">{upcomingNeeds.reduce((s, n) => s + n.toProduce, 0)} pcs</span>
                  </div>
                  {upcomingNeeds.map(need => <ProductionNeedRow key={need.partNumber} need={need} workers={workers} onAssign={assignWorker} />)}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Finance snapshot */}
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-green-600 flex items-center justify-center">
              <DollarSign size={16} className="text-white" />
            </div>
            <h2 className="font-semibold text-slate-900">Finance Snapshot</h2>
          </div>
          <div className="grid grid-cols-4 divide-x divide-slate-100">
            <div className="px-6 py-5">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1 flex items-center gap-1.5"><Receipt size={11} /> Outstanding AR</p>
              <p className="text-2xl font-bold text-slate-900">{fmtCurrency(finance.outstanding)}</p>
              <p className="text-xs text-slate-400 mt-1">unpaid invoices</p>
            </div>
            <div className={`px-6 py-5 ${finance.overdueCount > 0 ? 'bg-red-50/50' : ''}`}>
              <p className={`text-xs font-semibold uppercase tracking-wide mb-1 flex items-center gap-1.5 ${finance.overdueCount > 0 ? 'text-red-600' : 'text-slate-500'}`}>
                <AlertTriangle size={11} /> Overdue
              </p>
              <p className={`text-2xl font-bold ${finance.overdueCount > 0 ? 'text-red-700' : 'text-slate-900'}`}>{fmtCurrency(finance.overdueAmount)}</p>
              <p className={`text-xs mt-1 ${finance.overdueCount > 0 ? 'text-red-500' : 'text-slate-400'}`}>{finance.overdueCount} invoice{finance.overdueCount !== 1 ? 's' : ''} past due</p>
            </div>
            <div className="px-6 py-5">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1 flex items-center gap-1.5"><CreditCard size={11} /> Collected This Month</p>
              <p className="text-2xl font-bold text-green-700">{fmtCurrency(finance.collectedThisMonth)}</p>
              <p className="text-xs text-slate-400 mt-1">{fmtCurrency(finance.invoicedThisMonth)} invoiced</p>
            </div>
            <div className="px-6 py-5">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1 flex items-center gap-1.5"><TrendingUp size={11} /> Open Quote Pipeline</p>
              <p className="text-2xl font-bold text-slate-900">{fmtCurrency(finance.openQuoteValue)}</p>
              <p className="text-xs text-slate-400 mt-1">draft + sent quotes</p>
            </div>
          </div>
        </div>

        {/* Clay + Bisque */}
        <div className="grid grid-cols-2 gap-6">
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100">
              <h2 className="font-semibold text-slate-900 flex items-center gap-2"><Droplets size={16} className="text-orange-500" /> Clay On Hand</h2>
            </div>
            <div className="divide-y divide-slate-100">
              {clayStatus.map(clay => {
                const isLow = clay.on_hand <= clay.reorder_point;
                const isCritical = clay.days_remaining < 5;
                return (
                  <div key={clay.part_number} className="px-5 py-4">
                    <div className="flex items-start justify-between mb-1">
                      <div>
                        <p className="text-sm font-medium text-slate-800">{clay.description}</p>
                        <p className="text-xs text-slate-400 font-mono">{clay.part_number}</p>
                      </div>
                      <div className="text-right">
                        <p className={`text-sm font-bold ${isLow ? 'text-red-600' : 'text-slate-900'}`}>{clay.on_hand.toFixed(0)} lbs</p>
                        {(isLow || isCritical) && <span className="text-xs text-red-500 font-medium flex items-center gap-0.5 justify-end"><AlertTriangle size={10} /> Reorder</span>}
                      </div>
                    </div>
                    <ProgressBar value={clay.on_hand} max={clay.reorder_point > 0 ? clay.reorder_point * 3 : 500} showPercent={false} colorClass="bg-orange-400" />
                    <div className="flex justify-between mt-1.5">
                      <span className="text-xs text-slate-400">~{clay.avg_daily_lbs.toFixed(0)} lbs/day avg</span>
                      <span className={`text-xs font-medium ${isCritical ? 'text-red-500' : 'text-slate-500'}`}>
                        {clay.days_remaining < 999 ? `${clay.days_remaining.toFixed(0)} days left` : 'No usage data'}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100">
              <h2 className="font-semibold text-slate-900 flex items-center gap-2"><Layers size={16} className="text-yellow-600" /> Bisqueware Inventory</h2>
            </div>
            {bisqueItems.length === 0 ? (
              <div className="px-5 py-4 text-sm text-slate-400">No bisqueware in stock</div>
            ) : (
              <div className="divide-y divide-slate-100">
                {bisqueItems.map(b => (
                  <div key={b.part_number} className="px-5 py-3 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-slate-800">{b.description}</p>
                      <p className="text-xs text-slate-400 font-mono">{b.part_number}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-slate-900">{b.on_hand}</p>
                      <p className="text-xs text-slate-400">pcs</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function ProductionNeedRow({ need, workers, onAssign }: {
  need: ProductionNeed;
  workers: Worker[];
  onAssign: (lineId: string, workerId: string | null) => void;
}) {
  const pctDone = need.totalNeeded > 0 ? (need.totalProduced / need.totalNeeded) * 100 : 0;
  const isOverdue = need.urgency === 'overdue';
  const isThisWeek = need.urgency === 'this_week';

  return (
    <div className={`px-6 py-4 border-b last:border-b-0 hover:bg-slate-50/50 transition-colors ${isOverdue ? 'border-red-100' : isThisWeek ? 'border-amber-100' : 'border-slate-50'}`}>
      <div className="flex items-start gap-4">
        <div className={`w-20 h-20 rounded-xl flex flex-col items-center justify-center flex-shrink-0 ${isOverdue ? 'bg-red-600' : isThisWeek ? 'bg-amber-500' : 'bg-slate-700'}`}>
          <span className="text-2xl font-black text-white leading-none">{need.toProduce}</span>
          <span className="text-xs text-white/70 mt-0.5">to make</span>
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-sm font-bold text-slate-800">{need.partNumber}</span>
                <span className="text-sm text-slate-600">{need.description}</span>
              </div>
              {need.earliestShipDate && (
                <div className={`flex items-center gap-1.5 mt-1 text-xs font-medium ${isOverdue ? 'text-red-600' : isThisWeek ? 'text-amber-700' : 'text-slate-500'}`}>
                  <Clock size={11} />
                  {isOverdue
                    ? `Due ${new Date(need.earliestShipDate + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} -- ${Math.abs(daysFromNow(need.earliestShipDate))} days overdue`
                    : `Ship by ${new Date(need.earliestShipDate + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} -- ${daysFromNow(need.earliestShipDate)} day${daysFromNow(need.earliestShipDate) === 1 ? '' : 's'} left`}
                </div>
              )}
            </div>
            <div className="text-right flex-shrink-0">
              <p className="text-sm text-slate-500">
                <span className="font-semibold text-slate-800">{need.totalProduced}</span>
                <span className="text-slate-400"> / </span>
                <span>{need.totalNeeded}</span>
                <span className="text-xs text-slate-400 ml-1">produced</span>
              </p>
              {need.inventoryOnHand > 0 && <p className="text-xs text-green-600 font-medium mt-0.5">{need.inventoryOnHand} in stock</p>}
            </div>
          </div>

          <div className="mt-2.5">
            <div className="h-2.5 bg-slate-200 rounded-full overflow-hidden">
              <div className={`h-full rounded-full transition-all duration-500 ${isOverdue ? 'bg-red-500' : isThisWeek ? 'bg-amber-500' : 'bg-green-500'}`} style={{ width: `${Math.min(100, pctDone)}%` }} />
            </div>
          </div>

          <div className="mt-2.5 space-y-1.5">
            {need.orders.map((o, i) => {
              const remaining = o.qty - o.produced;
              const assignedWorker = workers.find(w => w.id === o.assignedWorkerId);
              return (
                <div key={i} className="flex items-center gap-2 flex-wrap">
                  <ArrowRight size={10} className="text-slate-300 flex-shrink-0" />
                  <span className="text-xs font-medium text-slate-600">{o.orderNumber}</span>
                  <span className="text-xs text-slate-400">{o.customer}</span>
                  <span className={`text-xs font-semibold ${remaining > 0 ? (isOverdue ? 'text-red-600' : 'text-amber-600') : 'text-green-600'}`}>
                    {remaining > 0 ? `${remaining} left` : 'done'}
                  </span>
                  <div className="ml-auto flex items-center gap-1.5">
                    {assignedWorker && (
                      <span className="inline-flex items-center gap-1 text-xs font-semibold bg-slate-100 text-slate-700 px-2 py-0.5 rounded-full">
                        <Users size={10} />
                        {assignedWorker.name}
                      </span>
                    )}
                    <select
                      value={o.assignedWorkerId ?? ''}
                      onChange={e => onAssign(o.lineId, e.target.value || null)}
                      className={`text-xs border rounded-lg px-2 py-0.5 focus:outline-none focus:ring-2 focus:ring-amber-400 transition-colors ${o.assignedWorkerId ? 'border-slate-200 bg-white text-slate-600' : 'border-dashed border-slate-300 bg-transparent text-slate-400 hover:border-amber-400 hover:text-amber-600'}`}
                    >
                      <option value="">Assign worker...</option>
                      {workers.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                    </select>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
