import { useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import Header from '../components/layout/Header';
import {
  Plus, X, ChevronRight, Trash2, Send,
  PackageCheck, ArrowLeft, Printer,
} from 'lucide-react';

interface Part {
  id: string;
  part_number: string;
  description: string;
  unit: string | null;
}

interface POLine {
  id: string;
  purchase_order_id: string;
  part_id: string | null;
  description: string;
  quantity: number;
  unit_price: number;
  quantity_received: number;
  sort_order: number;
  part?: { part_number: string; description: string; unit: string | null } | null;
}

interface PurchaseOrder {
  id: string;
  po_number: string;
  vendor_name: string;
  vendor_email: string | null;
  order_date: string;
  expected_date: string | null;
  status: 'draft' | 'sent' | 'received' | 'partial' | 'cancelled';
  notes: string | null;
  created_at: string;
  updated_at: string;
  lines: POLine[];
}

interface NewLine {
  description: string;
  part_id: string;
  quantity: string;
  unit_price: string;
}

interface ReceiveLine {
  lineId: string;
  description: string;
  quantity: number;
  quantity_received: number;
  receiving: string;
}

type StatusType = 'draft' | 'sent' | 'received' | 'partial' | 'cancelled';
type FilterTab = 'all' | 'open' | 'received';

const STATUS_BADGE: Record<StatusType, { label: string; cls: string }> = {
  draft:     { label: 'Draft',     cls: 'bg-slate-100 text-slate-600' },
  sent:      { label: 'Sent',      cls: 'bg-blue-100 text-blue-700' },
  partial:   { label: 'Partial',   cls: 'bg-amber-100 text-amber-700' },
  received:  { label: 'Received',  cls: 'bg-green-100 text-green-700' },
  cancelled: { label: 'Cancelled', cls: 'bg-slate-100 text-slate-500' },
};

function StatusBadge({ status }: { status: StatusType }) {
  const { label, cls } = STATUS_BADGE[status] ?? { label: status, cls: 'bg-slate-100 text-slate-600' };
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${cls}`}>
      {label}
    </span>
  );
}

function fmt(n: number) {
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtDate(d: string | null) {
  if (!d) return '—';
  return new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function poTotal(lines: POLine[]) {
  return lines.reduce((s, l) => s + Number(l.quantity) * Number(l.unit_price), 0);
}

function receivedProgress(lines: POLine[]) {
  const total = lines.length;
  const done = lines.filter(l => Number(l.quantity_received) >= Number(l.quantity)).length;
  return { done, total };
}

function generatePoNumber(existing: string[]) {
  const nums = existing
    .map(n => parseInt(n.replace(/^PO-/, ''), 10))
    .filter(n => !isNaN(n));
  const next = nums.length > 0 ? Math.max(...nums) + 1 : 1;
  return 'PO-' + String(next).padStart(4, '0');
}

const EMPTY_LINE: NewLine = { description: '', part_id: '', quantity: '1', unit_price: '0.00' };

function PurchaseOrders() {
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [parts, setParts] = useState<Part[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterTab>('all');
  const [saving, setSaving] = useState(false);

  const [showCreate, setShowCreate] = useState(false);
  const [newVendor, setNewVendor] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newOrderDate, setNewOrderDate] = useState(new Date().toISOString().split('T')[0]);
  const [newExpected, setNewExpected] = useState('');
  const [newNotes, setNewNotes] = useState('');
  const [newLines, setNewLines] = useState<NewLine[]>([{ ...EMPTY_LINE }]);

  const [detailId, setDetailId] = useState<string | null>(null);
  const [showPrint, setShowPrint] = useState(false);

  const [receiveId, setReceiveId] = useState<string | null>(null);
  const [receiveLines, setReceiveLines] = useState<ReceiveLine[]>([]);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('purchase_orders')
      .select(`
        id, po_number, vendor_name, vendor_email, order_date, expected_date,
        status, notes, created_at, updated_at,
        lines:purchase_order_lines(
          id, purchase_order_id, part_id, description, quantity, unit_price,
          quantity_received, sort_order,
          part:parts!purchase_order_lines_part_id_fkey(part_number, description, unit)
        )
      `)
      .order('order_date', { ascending: false });

    if (data) setOrders(data as any);
    setLoading(false);
  };

  const loadParts = async () => {
    const { data } = await supabase.from('parts').select('id, part_number, description, unit').order('part_number');
    if (data) setParts(data as Part[]);
  };

  useEffect(() => { load(); loadParts(); }, []);

  const filtered = orders.filter(o => {
    if (filter === 'all') return true;
    if (filter === 'open') return o.status === 'draft' || o.status === 'sent' || o.status === 'partial';
    if (filter === 'received') return o.status === 'received';
    return true;
  });

  const openCreate = () => {
    setNewVendor(''); setNewEmail('');
    setNewOrderDate(new Date().toISOString().split('T')[0]);
    setNewExpected(''); setNewNotes('');
    setNewLines([{ ...EMPTY_LINE }]);
    setShowCreate(true);
  };

  const addLine = () => setNewLines(p => [...p, { ...EMPTY_LINE }]);
  const removeLine = (i: number) => setNewLines(p => p.filter((_, j) => j !== i));
  const updateLine = (i: number, field: keyof NewLine, value: string) => {
    setNewLines(p => p.map((l, j) => {
      if (j !== i) return l;
      const updated = { ...l, [field]: value };
      if (field === 'part_id' && value) {
        const part = parts.find(p => p.id === value);
        if (part && !l.description) updated.description = part.description;
      }
      return updated;
    }));
  };

  const createPO = async () => {
    if (!newVendor.trim()) return;
    const validLines = newLines.filter(l => l.description.trim());
    if (validLines.length === 0) return;
    setSaving(true);

    const poNumber = generatePoNumber(orders.map(o => o.po_number));
    const { data: po } = await supabase
      .from('purchase_orders')
      .insert({
        po_number: poNumber,
        vendor_name: newVendor.trim(),
        vendor_email: newEmail.trim() || null,
        order_date: newOrderDate,
        expected_date: newExpected || null,
        notes: newNotes.trim() || null,
        status: 'draft',
      })
      .select('id')
      .maybeSingle();

    if (po) {
      await supabase.from('purchase_order_lines').insert(
        validLines.map((l, i) => ({
          purchase_order_id: po.id,
          part_id: l.part_id || null,
          description: l.description.trim(),
          quantity: parseFloat(l.quantity) || 1,
          unit_price: parseFloat(l.unit_price) || 0,
          quantity_received: 0,
          sort_order: i,
        }))
      );
    }

    setSaving(false);
    setShowCreate(false);
    load();
  };

  const markSent = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    await supabase.from('purchase_orders').update({ status: 'sent', updated_at: new Date().toISOString() }).eq('id', id);
    load();
  };

  const deletePO = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (!confirm('Delete this draft purchase order?')) return;
    await supabase.from('purchase_order_lines').delete().eq('purchase_order_id', id);
    await supabase.from('purchase_orders').delete().eq('id', id);
    if (detailId === id) setDetailId(null);
    load();
  };

  const openReceive = (po: PurchaseOrder) => {
    setReceiveLines(
      po.lines
        .filter(l => Number(l.quantity_received) < Number(l.quantity))
        .map(l => ({
          lineId: l.id,
          description: l.description,
          quantity: Number(l.quantity),
          quantity_received: Number(l.quantity_received),
          receiving: String(Number(l.quantity) - Number(l.quantity_received)),
        }))
    );
    setReceiveId(po.id);
  };

  const submitReceive = async () => {
    if (!receiveId) return;
    const po = orders.find(o => o.id === receiveId);
    if (!po) return;
    setSaving(true);

    for (const rl of receiveLines) {
      const qty = Math.max(0, parseFloat(rl.receiving) || 0);
      if (qty === 0) continue;
      const newReceived = Math.min(rl.quantity_received + qty, rl.quantity);
      await supabase.from('purchase_order_lines').update({ quantity_received: newReceived }).eq('id', rl.lineId);
    }

    const { data: updatedLines } = await supabase
      .from('purchase_order_lines')
      .select('quantity, quantity_received')
      .eq('purchase_order_id', receiveId);

    if (updatedLines) {
      const allReceived = updatedLines.every(l => Number(l.quantity_received) >= Number(l.quantity));
      const anyReceived = updatedLines.some(l => Number(l.quantity_received) > 0);
      const newStatus = allReceived ? 'received' : anyReceived ? 'partial' : po.status;
      await supabase.from('purchase_orders').update({ status: newStatus, updated_at: new Date().toISOString() }).eq('id', receiveId);
    }

    setSaving(false);
    setReceiveId(null);
    setReceiveLines([]);
    load();
  };

  const detailOrder = detailId ? orders.find(o => o.id === detailId) ?? null : null;
  const newLinesTotal = newLines.reduce((s, l) => s + (parseFloat(l.quantity) || 0) * (parseFloat(l.unit_price) || 0), 0);

  return (
    <div className="flex-1 overflow-y-auto bg-slate-50">
      <Header
        title="Purchase Orders"
        subtitle={`${orders.filter(o => ['draft','sent','partial'].includes(o.status)).length} open orders`}
        onRefresh={load}
        loading={loading}
        actions={
          !detailId ? (
            <button onClick={openCreate} className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-amber-500 hover:bg-amber-600 rounded-lg transition-colors">
              <Plus size={15} /> New PO
            </button>
          ) : undefined
        }
      />

      {/* Print preview overlay */}
      {showPrint && detailOrder && (
        <POPrintPreview po={detailOrder} onClose={() => setShowPrint(false)} />
      )}

      {detailId && detailOrder ? (
        <DetailView
          po={detailOrder}
          onBack={() => setDetailId(null)}
          onReceive={() => openReceive(detailOrder)}
          onMarkSent={markSent}
          onDelete={deletePO}
          onPrint={() => setShowPrint(true)}
        />
      ) : (
        <div className="p-8 space-y-6">
          <div className="flex gap-2">
            {(['all', 'open', 'received'] as FilterTab[]).map(t => (
              <button
                key={t}
                onClick={() => setFilter(t)}
                className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
                  filter === t ? 'bg-slate-900 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                {t.charAt(0).toUpperCase() + t.slice(1)}
              </button>
            ))}
          </div>

          {showCreate && (
            <div className="bg-white rounded-xl border border-amber-200 shadow-sm p-6">
              <div className="flex items-center justify-between mb-5">
                <h3 className="font-semibold text-slate-900">New Purchase Order</h3>
                <button onClick={() => setShowCreate(false)} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
              </div>

              <div className="grid grid-cols-2 gap-4 mb-5">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Vendor Name *</label>
                  <input className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" placeholder="Vendor name" value={newVendor} onChange={e => setNewVendor(e.target.value)} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Vendor Email</label>
                  <input type="email" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" placeholder="vendor@example.com" value={newEmail} onChange={e => setNewEmail(e.target.value)} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Order Date *</label>
                  <input type="date" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" value={newOrderDate} onChange={e => setNewOrderDate(e.target.value)} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Expected Date</label>
                  <input type="date" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" value={newExpected} onChange={e => setNewExpected(e.target.value)} />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-slate-600 mb-1">Notes</label>
                  <textarea rows={2} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 resize-none" placeholder="Optional notes" value={newNotes} onChange={e => setNewNotes(e.target.value)} />
                </div>
              </div>

              <div className="mb-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-slate-700 uppercase tracking-wide">Line Items</span>
                </div>
                <div className="border border-slate-200 rounded-lg overflow-hidden">
                  <table className="w-full">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200">
                        <th className="text-left px-3 py-2 text-xs font-semibold text-slate-500">Part (optional)</th>
                        <th className="text-left px-3 py-2 text-xs font-semibold text-slate-500">Description *</th>
                        <th className="text-right px-3 py-2 text-xs font-semibold text-slate-500">Qty</th>
                        <th className="text-right px-3 py-2 text-xs font-semibold text-slate-500">Unit Price</th>
                        <th className="text-right px-3 py-2 text-xs font-semibold text-slate-500">Total</th>
                        <th className="w-8" />
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {newLines.map((line, i) => {
                        const total = (parseFloat(line.quantity) || 0) * (parseFloat(line.unit_price) || 0);
                        return (
                          <tr key={i} className="hover:bg-slate-50">
                            <td className="px-3 py-2">
                              <select className="w-full border border-slate-200 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 bg-white" value={line.part_id} onChange={e => updateLine(i, 'part_id', e.target.value)}>
                                <option value="">— no part —</option>
                                {parts.map(p => <option key={p.id} value={p.id}>{p.part_number} – {p.description}</option>)}
                              </select>
                            </td>
                            <td className="px-3 py-2">
                              <input className="w-full border border-slate-200 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" placeholder="Description" value={line.description} onChange={e => updateLine(i, 'description', e.target.value)} />
                            </td>
                            <td className="px-3 py-2">
                              <input type="number" min="0" className="w-20 border border-slate-200 rounded px-2 py-1.5 text-sm text-right focus:outline-none focus:ring-2 focus:ring-amber-400" value={line.quantity} onChange={e => updateLine(i, 'quantity', e.target.value)} />
                            </td>
                            <td className="px-3 py-2">
                              <input type="number" min="0" step="0.01" className="w-24 border border-slate-200 rounded px-2 py-1.5 text-sm text-right focus:outline-none focus:ring-2 focus:ring-amber-400" value={line.unit_price} onChange={e => updateLine(i, 'unit_price', e.target.value)} />
                            </td>
                            <td className="px-3 py-2 text-sm text-right text-slate-700 font-medium whitespace-nowrap">${fmt(total)}</td>
                            <td className="px-2 py-2 text-center">
                              {newLines.length > 1 && (
                                <button onClick={() => removeLine(i)} className="text-slate-300 hover:text-red-500 transition-colors"><X size={15} /></button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot>
                      <tr className="border-t border-slate-200 bg-slate-50">
                        <td colSpan={4} className="px-3 py-2 text-sm font-semibold text-slate-700 text-right">Total</td>
                        <td className="px-3 py-2 text-sm font-bold text-slate-900 text-right whitespace-nowrap">${fmt(newLinesTotal)}</td>
                        <td />
                      </tr>
                    </tfoot>
                  </table>
                </div>
                <button onClick={addLine} className="mt-2 flex items-center gap-1.5 text-xs font-medium text-amber-600 hover:text-amber-700 transition-colors">
                  <Plus size={13} /> Add Line
                </button>
              </div>

              <div className="flex items-center gap-3 mt-4">
                <button onClick={createPO} disabled={saving || !newVendor.trim() || !newLines.some(l => l.description.trim())} className="px-4 py-2 text-sm font-medium text-white bg-amber-500 hover:bg-amber-600 disabled:opacity-50 rounded-lg transition-colors">
                  {saving ? 'Saving...' : 'Create Purchase Order'}
                </button>
                <button onClick={() => setShowCreate(false)} className="px-4 py-2 text-sm text-slate-600 hover:text-slate-800">Cancel</button>
              </div>
            </div>
          )}

          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            {loading ? (
              <div className="p-8 text-center text-slate-400">Loading purchase orders...</div>
            ) : filtered.length === 0 ? (
              <div className="p-8 text-center text-slate-400">No purchase orders found</div>
            ) : (
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50">
                    <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">PO Number</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Vendor</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Order Date</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Expected</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Status</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Total Value</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Progress</th>
                    <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filtered.map(po => {
                    const total = poTotal(po.lines);
                    const { done, total: lineCount } = receivedProgress(po.lines);
                    return (
                      <tr key={po.id} className="hover:bg-slate-50 cursor-pointer transition-colors" onClick={() => setDetailId(po.id)}>
                        <td className="px-6 py-3.5"><span className="font-mono font-semibold text-slate-900 text-sm">{po.po_number}</span></td>
                        <td className="px-4 py-3.5">
                          <p className="text-sm font-medium text-slate-800">{po.vendor_name}</p>
                          {po.vendor_email && <p className="text-xs text-slate-400">{po.vendor_email}</p>}
                        </td>
                        <td className="px-4 py-3.5 text-sm text-slate-600 whitespace-nowrap">{fmtDate(po.order_date)}</td>
                        <td className="px-4 py-3.5 text-sm text-slate-600 whitespace-nowrap">{fmtDate(po.expected_date)}</td>
                        <td className="px-4 py-3.5"><StatusBadge status={po.status} /></td>
                        <td className="px-4 py-3.5 text-sm font-semibold text-slate-900 text-right whitespace-nowrap">${fmt(total)}</td>
                        <td className="px-4 py-3.5">
                          {lineCount > 0
                            ? <span className="text-sm text-slate-600">{done}/{lineCount} lines received</span>
                            : <span className="text-xs text-slate-400">No lines</span>}
                        </td>
                        <td className="px-4 py-3.5">
                          <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                            {po.status === 'draft' && (
                              <>
                                <button onClick={e => markSent(e, po.id)} className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-white bg-blue-500 hover:bg-blue-600 rounded-lg transition-colors whitespace-nowrap">
                                  <Send size={11} /> Mark Sent
                                </button>
                                <button onClick={e => deletePO(e, po.id)} className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 rounded-lg transition-colors border border-red-200">
                                  <Trash2 size={11} /> Delete
                                </button>
                              </>
                            )}
                            {(po.status === 'sent' || po.status === 'partial') && (
                              <button onClick={e => { e.stopPropagation(); openReceive(po); setDetailId(po.id); }} className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-white bg-amber-500 hover:bg-amber-600 rounded-lg transition-colors whitespace-nowrap">
                                <PackageCheck size={11} /> Receive
                              </button>
                            )}
                            <ChevronRight size={15} className="text-slate-400" />
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {receiveId && (
        <ReceiveModal lines={receiveLines} saving={saving} onChange={setReceiveLines} onSubmit={submitReceive} onClose={() => { setReceiveId(null); setReceiveLines([]); }} />
      )}
    </div>
  );
}

// ---- Print Preview ----

function buildPOHtml(po: PurchaseOrder): string {
  const total = poTotal(po.lines);
  const sortedLines = po.lines.slice().sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
  const esc = (s: string | null | undefined) =>
    (s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  const lineRows = sortedLines.map((l, i) => `
    <tr style="background:${i % 2 === 1 ? '#f8fafc' : '#fff'};border-bottom:1px solid #f1f5f9">
      <td style="padding:10px 14px;font-family:monospace;font-size:12px;color:#64748b">${esc(l.part?.part_number ?? '')}</td>
      <td style="padding:10px 14px;font-size:13px;color:#334155">${esc(l.description)}</td>
      <td style="padding:10px 14px;font-size:13px;text-align:right;color:#1e293b">${Number(l.quantity)}</td>
      <td style="padding:10px 14px;font-size:13px;text-align:right;color:#475569">$${fmt(Number(l.unit_price))}</td>
      <td style="padding:10px 14px;font-size:13px;text-align:right;font-weight:600;color:#0f172a">$${fmt(Number(l.quantity) * Number(l.unit_price))}</td>
    </tr>`).join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<title>Purchase Order ${esc(po.po_number)}</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:'Helvetica Neue',Arial,sans-serif;color:#1e293b;background:#fff;padding:48px;max-width:820px;margin:0 auto}
  table{width:100%;border-collapse:collapse}
  @media print{body{padding:24px}@page{margin:1.5cm}}
</style>
</head>
<body>
  <table style="margin-bottom:32px">
    <tr>
      <td>
        <div style="font-size:24px;font-weight:900;color:#0f172a;letter-spacing:-0.5px">KilnTrack</div>
        <div style="font-size:12px;color:#94a3b8;margin-top:3px">Ceramics Production</div>
      </td>
      <td style="text-align:right">
        <div style="font-size:30px;font-weight:900;color:#f59e0b;letter-spacing:-1px;line-height:1">Purchase Order</div>
        <div style="font-size:15px;font-weight:700;font-family:monospace;color:#1e293b;margin-top:6px">${esc(po.po_number)}</div>
      </td>
    </tr>
  </table>

  <hr style="border:none;border-top:2px solid #f1f5f9;margin-bottom:28px"/>

  <table style="margin-bottom:32px">
    <tr>
      <td style="width:50%;vertical-align:top">
        <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:#94a3b8;margin-bottom:4px">Vendor</div>
        <div style="font-size:14px;font-weight:600;color:#0f172a">${esc(po.vendor_name)}</div>
        ${po.vendor_email ? `<div style="font-size:12px;color:#64748b;margin-top:2px">${esc(po.vendor_email)}</div>` : ''}
      </td>
      <td style="vertical-align:top;text-align:right">
        <table style="margin-left:auto">
          <tr>
            <td style="padding:0 20px 0 0;vertical-align:top">
              <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:#94a3b8;margin-bottom:4px">Order Date</div>
              <div style="font-size:13px;font-weight:600;color:#0f172a">${fmtDate(po.order_date)}</div>
            </td>
            <td style="padding:0 20px 0 0;vertical-align:top">
              <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:#94a3b8;margin-bottom:4px">Expected Delivery</div>
              <div style="font-size:13px;font-weight:600;color:#0f172a">${fmtDate(po.expected_date)}</div>
            </td>
            <td style="vertical-align:top">
              <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:#94a3b8;margin-bottom:4px">Status</div>
              <div style="display:inline-block;padding:3px 10px;background:#f1f5f9;border-radius:999px;font-size:11px;font-weight:700;text-transform:uppercase;color:#475569">${esc(po.status)}</div>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>

  <table style="margin-bottom:8px">
    <thead>
      <tr style="background:#0f172a">
        <th style="text-align:left;padding:11px 14px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:#fff;width:110px">Part #</th>
        <th style="text-align:left;padding:11px 14px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:#fff">Description</th>
        <th style="text-align:right;padding:11px 14px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:#fff;width:70px">Qty</th>
        <th style="text-align:right;padding:11px 14px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:#fff;width:110px">Unit Price</th>
        <th style="text-align:right;padding:11px 14px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:#fff;width:110px">Total</th>
      </tr>
    </thead>
    <tbody>${lineRows}</tbody>
    <tfoot>
      <tr style="background:#f8fafc;border-top:2px solid #e2e8f0">
        <td colspan="4" style="padding:13px 14px;font-size:13px;font-weight:700;text-align:right;color:#475569">Order Total</td>
        <td style="padding:13px 14px;font-size:16px;font-weight:900;text-align:right;color:#0f172a">$${fmt(total)}</td>
      </tr>
    </tfoot>
  </table>

  ${po.notes ? `
  <div style="margin-top:24px;padding:14px 16px;background:#fffbeb;border-left:4px solid #f59e0b;border-radius:0 6px 6px 0">
    <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:#92400e;margin-bottom:5px">Notes</div>
    <div style="font-size:13px;color:#78350f;line-height:1.6">${esc(po.notes)}</div>
  </div>` : ''}

  <div style="margin-top:48px;padding-top:16px;border-top:1px solid #e2e8f0;display:flex;justify-content:space-between;font-size:11px;color:#94a3b8">
    <span>Generated ${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</span>
    <span>${esc(po.po_number)} &bull; KilnTrack Production Control</span>
  </div>
</body>
</html>`;
}

function POPrintPreview({ po, onClose }: { po: PurchaseOrder; onClose: () => void }) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const html = buildPOHtml(po);

  const handlePrint = () => {
    const iframe = iframeRef.current;
    if (iframe?.contentWindow) {
      iframe.contentWindow.focus();
      iframe.contentWindow.print();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-slate-800">
      <div className="flex items-center justify-between px-8 py-3 bg-slate-900 border-b border-slate-700 flex-shrink-0">
        <span className="text-white font-semibold text-sm">{po.po_number} — Print Preview</span>
        <div className="flex items-center gap-3">
          <button
            onClick={handlePrint}
            className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-amber-500 hover:bg-amber-600 rounded-lg transition-colors"
          >
            <Printer size={15} /> Print / Save as PDF
          </button>
          <button
            onClick={onClose}
            className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-slate-300 hover:text-white rounded-lg border border-slate-600 transition-colors"
          >
            <X size={15} /> Close
          </button>
        </div>
      </div>

      <iframe
        ref={iframeRef}
        srcDoc={html}
        title={`Purchase Order ${po.po_number}`}
        className="flex-1 w-full bg-white"
        style={{ border: 'none' }}
      />
    </div>
  );
}

// ---- Detail View ----

interface DetailViewProps {
  po: PurchaseOrder;
  onBack: () => void;
  onReceive: () => void;
  onMarkSent: (e: React.MouseEvent, id: string) => void;
  onDelete: (e: React.MouseEvent, id: string) => void;
  onPrint: () => void;
}

function DetailView({ po, onBack, onReceive, onMarkSent, onDelete, onPrint }: DetailViewProps) {
  const total = poTotal(po.lines);
  const { done, total: lineCount } = receivedProgress(po.lines);

  return (
    <div className="p-8 space-y-6">
      <button onClick={onBack} className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 font-medium transition-colors">
        <ArrowLeft size={15} /> Back to list
      </button>

      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <div className="flex items-start justify-between mb-6">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h2 className="text-xl font-bold text-slate-900 font-mono">{po.po_number}</h2>
              <StatusBadge status={po.status} />
            </div>
            <p className="text-slate-500">{po.vendor_name}</p>
            {po.vendor_email && <p className="text-sm text-slate-400">{po.vendor_email}</p>}
          </div>
          <div className="flex items-center gap-2">
            <button onClick={onPrint} className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-slate-700 bg-white hover:bg-slate-50 rounded-lg border border-slate-200 transition-colors">
              <Printer size={14} /> Print / Email
            </button>
            {po.status === 'draft' && (
              <>
                <button onClick={e => onMarkSent(e, po.id)} className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-white bg-blue-500 hover:bg-blue-600 rounded-lg transition-colors">
                  <Send size={14} /> Mark Sent
                </button>
                <button onClick={e => { onDelete(e, po.id); onBack(); }} className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 rounded-lg border border-red-200 transition-colors">
                  <Trash2 size={14} /> Delete
                </button>
              </>
            )}
            {(po.status === 'sent' || po.status === 'partial') && (
              <button onClick={onReceive} className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-amber-500 hover:bg-amber-600 rounded-lg transition-colors">
                <PackageCheck size={14} /> Receive Items
              </button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-4 gap-6 mb-6 pb-6 border-b border-slate-100">
          <div>
            <p className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-1">Order Date</p>
            <p className="text-sm font-medium text-slate-800">{fmtDate(po.order_date)}</p>
          </div>
          <div>
            <p className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-1">Expected Date</p>
            <p className="text-sm font-medium text-slate-800">{fmtDate(po.expected_date)}</p>
          </div>
          <div>
            <p className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-1">Total Value</p>
            <p className="text-sm font-bold text-slate-900">${fmt(total)}</p>
          </div>
          <div>
            <p className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-1">Received Progress</p>
            <p className="text-sm font-medium text-slate-800">{done}/{lineCount} lines</p>
          </div>
        </div>

        {po.notes && (
          <div className="mb-6 px-4 py-3 bg-amber-50 border border-amber-100 rounded-lg text-sm text-amber-800">
            {po.notes}
          </div>
        )}

        <div>
          <h3 className="text-sm font-semibold text-slate-700 uppercase tracking-wide mb-3">Line Items</h3>
          <div className="border border-slate-200 rounded-lg overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Description</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Part</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Qty Ordered</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Qty Received</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Unit Price</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Line Total</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {po.lines.length === 0 ? (
                  <tr><td colSpan={7} className="px-4 py-6 text-center text-sm text-slate-400">No line items</td></tr>
                ) : (
                  po.lines.slice().sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)).map(line => {
                    const lineTotal = Number(line.quantity) * Number(line.unit_price);
                    const fullReceived = Number(line.quantity_received) >= Number(line.quantity);
                    const partialReceived = Number(line.quantity_received) > 0 && !fullReceived;
                    return (
                      <tr key={line.id} className={`hover:bg-slate-50 ${fullReceived ? 'bg-green-50/30' : ''}`}>
                        <td className="px-4 py-3 text-sm text-slate-800">{line.description}</td>
                        <td className="px-4 py-3 text-sm text-slate-500 font-mono">{line.part ? line.part.part_number : <span className="text-slate-300">—</span>}</td>
                        <td className="px-4 py-3 text-sm text-right font-medium text-slate-900">{line.quantity}</td>
                        <td className="px-4 py-3 text-sm text-right font-semibold">
                          <span className={fullReceived ? 'text-green-600' : partialReceived ? 'text-amber-600' : 'text-slate-400'}>{line.quantity_received}</span>
                        </td>
                        <td className="px-4 py-3 text-sm text-right text-slate-700">${fmt(Number(line.unit_price))}</td>
                        <td className="px-4 py-3 text-sm text-right font-semibold text-slate-900">${fmt(lineTotal)}</td>
                        <td className="px-4 py-3 text-sm">
                          {fullReceived
                            ? <span className="text-xs font-medium text-green-700 bg-green-100 px-2 py-0.5 rounded-full">Complete</span>
                            : partialReceived
                            ? <span className="text-xs font-medium text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full">Partial</span>
                            : <span className="text-xs font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">Pending</span>}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
              <tfoot className="border-t border-slate-200 bg-slate-50">
                <tr>
                  <td colSpan={5} className="px-4 py-3 text-sm font-semibold text-slate-700 text-right">Total</td>
                  <td className="px-4 py-3 text-sm font-bold text-slate-900 text-right">${fmt(total)}</td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---- Receive Modal ----

interface ReceiveModalProps {
  lines: ReceiveLine[];
  saving: boolean;
  onChange: (lines: ReceiveLine[]) => void;
  onSubmit: () => void;
  onClose: () => void;
}

function ReceiveModal({ lines, saving, onChange, onSubmit, onClose }: ReceiveModalProps) {
  const updateQty = (i: number, value: string) => {
    onChange(lines.map((l, j) => j === i ? { ...l, receiving: value } : l));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl mx-4">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <h3 className="font-semibold text-slate-900 flex items-center gap-2">
            <PackageCheck size={17} className="text-amber-500" /> Receive Items
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
        </div>
        <div className="p-6">
          {lines.length === 0 ? (
            <p className="text-sm text-slate-500 text-center py-4">All items have already been received.</p>
          ) : (
            <div className="border border-slate-200 rounded-lg overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide">Description</th>
                    <th className="text-right px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide">Ordered</th>
                    <th className="text-right px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide">Previously Received</th>
                    <th className="text-right px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide">Receiving Now</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {lines.map((line, i) => {
                    const remaining = line.quantity - line.quantity_received;
                    return (
                      <tr key={line.lineId} className="hover:bg-slate-50">
                        <td className="px-4 py-3 text-sm text-slate-800">{line.description}</td>
                        <td className="px-4 py-3 text-sm text-right text-slate-700">{line.quantity}</td>
                        <td className="px-4 py-3 text-sm text-right text-slate-500">{line.quantity_received}</td>
                        <td className="px-4 py-3 text-right">
                          <input type="number" min={0} max={remaining} value={line.receiving} onChange={e => updateQty(i, e.target.value)} className="w-24 border border-slate-200 rounded-lg px-2 py-1.5 text-sm text-right focus:outline-none focus:ring-2 focus:ring-amber-400" />
                          <span className="text-xs text-slate-400 ml-1.5">/ {remaining}</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-200">
          <button onClick={onClose} className="px-4 py-2 text-sm text-slate-600 hover:text-slate-800">Cancel</button>
          <button onClick={onSubmit} disabled={saving || lines.length === 0} className="px-5 py-2 text-sm font-medium text-white bg-amber-500 hover:bg-amber-600 disabled:opacity-50 rounded-lg transition-colors">
            {saving ? 'Saving...' : 'Save Receipts'}
          </button>
        </div>
      </div>
    </div>
  );
}


export default PurchaseOrders