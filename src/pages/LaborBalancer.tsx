import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import Header from '../components/layout/Header';
import { Clock, Plus, X, ChevronDown, ChevronUp, AlertTriangle, CheckCircle, CreditCard as Edit2, Check } from 'lucide-react';

interface Worker { id: string; name: string; active: boolean; capacity_minutes_per_day: number; }
interface WorkItem { lineId: string; orderNumber: string; partId: string; partNumber: string; description: string; qtyRemaining: number; minutesPerPiece: number; totalMinutes: number; assignedWorkerId: string | null; requiredShipDate: string | null; }

function fmtMins(m: number): string { if (m < 60) return `${Math.round(m)}m`; const h = Math.floor(m / 60); const rem = Math.round(m % 60); return rem > 0 ? `${h}h ${rem}m` : `${h}h`; }
function fmtDate(d: string | null): string { if (!d) return ''; return new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }); }

function LoadBar({ used, capacity }: { used: number; capacity: number }) {
  if (capacity <= 0) return null;
  const pct = Math.min(100, (used / capacity) * 100);
  const over = used > capacity;
  const color = over ? 'bg-red-500' : pct > 85 ? 'bg-amber-500' : 'bg-emerald-500';
  return <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden"><div className={`h-2 rounded-full transition-all duration-300 ${color}`} style={{ width: `${pct}%` }} /></div>;
}

export default function LaborBalancer() {
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [workItems, setWorkItems] = useState<WorkItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [editingWorker, setEditingWorker] = useState<string | null>(null);
  const [editCapacity, setEditCapacity] = useState('');
  const [editingMpp, setEditingMpp] = useState<string | null>(null);
  const [editMppValue, setEditMppValue] = useState('');
  const [showAddWorker, setShowAddWorker] = useState(false);
  const [newWorkerName, setNewWorkerName] = useState('');
  const [newWorkerCap, setNewWorkerCap] = useState('480');
  const [addingWorker, setAddingWorker] = useState(false);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    setLoading(true);
    const [{ data: wData }, { data: lData }] = await Promise.all([
      supabase.from('workers').select('id, name, active, capacity_minutes_per_day').eq('active', true).order('name'),
      supabase.from('sales_order_lines').select(`id, quantity_ordered, quantity_shipped, assigned_worker_id, part:parts!sales_order_lines_part_id_fkey(id, part_number, description, minutes_per_piece), sales_order:sales_orders!sales_order_lines_sales_order_id_fkey(id, order_number, required_ship_date, status)`),
    ]);
    if (wData) setWorkers(wData as Worker[]);
    if (lData) {
      const items: WorkItem[] = [];
      for (const row of lData as any[]) {
        const so = row.sales_order;
        if (!so || (so.status !== 'open' && so.status !== 'in_progress')) continue;
        const remaining = Math.max(0, Number(row.quantity_ordered) - Number(row.quantity_shipped ?? 0));
        if (remaining <= 0) continue;
        const mpp = Number(row.part?.minutes_per_piece ?? 0);
        items.push({ lineId: row.id, orderNumber: so.order_number, partId: row.part?.id ?? '', partNumber: row.part?.part_number ?? '', description: row.part?.description ?? '', qtyRemaining: remaining, minutesPerPiece: mpp, totalMinutes: mpp * remaining, assignedWorkerId: row.assigned_worker_id ?? null, requiredShipDate: so.required_ship_date ?? null });
      }
      setWorkItems(items);
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const assignWorker = async (lineId: string, workerId: string | null) => {
    setSaving(lineId);
    await supabase.from('sales_order_lines').update({ assigned_worker_id: workerId }).eq('id', lineId);
    setWorkItems(prev => prev.map(w => w.lineId === lineId ? { ...w, assignedWorkerId: workerId } : w));
    setSaving(null);
  };

  const saveCapacity = async (workerId: string) => {
    const cap = parseFloat(editCapacity);
    if (isNaN(cap) || cap <= 0) { setEditingWorker(null); return; }
    await supabase.from('workers').update({ capacity_minutes_per_day: cap }).eq('id', workerId);
    setWorkers(prev => prev.map(w => w.id === workerId ? { ...w, capacity_minutes_per_day: cap } : w));
    setEditingWorker(null);
  };

  const saveMpp = async (partId: string) => {
    const mpp = parseFloat(editMppValue);
    if (isNaN(mpp) || mpp < 0) { setEditingMpp(null); return; }
    await supabase.from('parts').update({ minutes_per_piece: mpp }).eq('id', partId);
    setWorkItems(prev => prev.map(w => w.partId === partId ? { ...w, minutesPerPiece: mpp, totalMinutes: mpp * w.qtyRemaining } : w));
    setEditingMpp(null);
  };

  const addWorker = async () => {
    if (!newWorkerName.trim()) return;
    setAddingWorker(true);
    await supabase.from('workers').insert({ name: newWorkerName.trim(), capacity_minutes_per_day: parseFloat(newWorkerCap) || 480, active: true });
    setNewWorkerName(''); setNewWorkerCap('480'); setShowAddWorker(false); setAddingWorker(false);
    load();
  };

  const toggleCollapse = (id: string) => { setCollapsed(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; }); };

  const unassigned = workItems.filter(w => !w.assignedWorkerId);
  const totalUnassignedMins = unassigned.reduce((s, w) => s + w.totalMinutes, 0);
  const workerItems = (wId: string) => workItems.filter(w => w.assignedWorkerId === wId);
  const workerLoad = (wId: string) => workerItems(wId).reduce((s, w) => s + w.totalMinutes, 0);
  const totalWork = workItems.reduce((s, w) => s + w.totalMinutes, 0);
  const totalCapacity = workers.reduce((s, w) => s + w.capacity_minutes_per_day, 0);
  const avgLoad = workers.length > 0 ? totalWork / workers.length : 0;
  const missingMpp = Array.from(new Map(workItems.filter(w => w.minutesPerPiece === 0).map(w => [w.partId, w])).values());

  return (
    <div className="flex-1 overflow-y-auto bg-slate-50">
      <Header title="Labor Balancer" subtitle={`${workItems.length} open line items`} onRefresh={load} loading={loading} actions={
        <button onClick={() => setShowAddWorker(v => !v)} className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-amber-500 hover:bg-amber-600 rounded-lg transition-colors"><Plus size={15} /> Add Worker</button>
      } />
      <div className="p-8 space-y-6">
        <div className="grid grid-cols-4 gap-4">
          <div className="bg-white rounded-xl border border-slate-200 p-5"><p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Active Workers</p><p className="text-2xl font-bold text-slate-900">{workers.length}</p><p className="text-xs text-slate-400 mt-1">Total capacity {fmtMins(totalCapacity)}/day</p></div>
          <div className="bg-white rounded-xl border border-slate-200 p-5"><p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Total Work</p><p className="text-2xl font-bold text-slate-900">{fmtMins(totalWork)}</p><p className="text-xs text-slate-400 mt-1">{workItems.length} line items</p></div>
          <div className={`bg-white rounded-xl border p-5 ${unassigned.length > 0 ? 'border-amber-200' : 'border-slate-200'}`}><p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1 flex items-center gap-1">{unassigned.length > 0 && <AlertTriangle size={12} className="text-amber-500" />} Unassigned</p><p className={`text-2xl font-bold ${unassigned.length > 0 ? 'text-amber-600' : 'text-slate-900'}`}>{unassigned.length}</p><p className="text-xs text-slate-400 mt-1">{fmtMins(totalUnassignedMins)} unscheduled</p></div>
          <div className="bg-white rounded-xl border border-slate-200 p-5"><p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Avg Load / Worker</p><p className="text-2xl font-bold text-slate-900">{fmtMins(avgLoad)}</p><p className="text-xs text-slate-400 mt-1">Based on all open work</p></div>
        </div>
        {missingMpp.length > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
            <p className="text-sm font-semibold text-amber-800 mb-2 flex items-center gap-1.5"><AlertTriangle size={15} /> These parts have no time set</p>
            <div className="flex flex-wrap gap-2">{missingMpp.map(w => <span key={w.partId} className="text-xs bg-white border border-amber-200 rounded-lg px-2.5 py-1 text-amber-700 font-mono">{w.partNumber} — {w.description}</span>)}</div>
          </div>
        )}
        {showAddWorker && (
          <div className="bg-white rounded-xl border border-amber-200 p-5 shadow-sm">
            <div className="flex items-center justify-between mb-4"><h3 className="font-semibold text-slate-900">New Worker</h3><button onClick={() => setShowAddWorker(false)} className="text-slate-400 hover:text-slate-600"><X size={17} /></button></div>
            <div className="flex items-end gap-3">
              <div className="flex-1"><label className="block text-xs font-medium text-slate-600 mb-1">Name</label><input className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" placeholder="Worker name" value={newWorkerName} onChange={e => setNewWorkerName(e.target.value)} onKeyDown={e => e.key === 'Enter' && addWorker()} /></div>
              <div className="w-48"><label className="block text-xs font-medium text-slate-600 mb-1">Daily capacity (minutes)</label><input type="number" min="1" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" value={newWorkerCap} onChange={e => setNewWorkerCap(e.target.value)} /></div>
              <button onClick={addWorker} disabled={addingWorker || !newWorkerName.trim()} className="px-4 py-2 text-sm font-medium text-white bg-amber-500 hover:bg-amber-600 disabled:opacity-50 rounded-lg transition-colors whitespace-nowrap">{addingWorker ? 'Adding...' : 'Add Worker'}</button>
            </div>
          </div>
        )}
        <div className="grid grid-cols-3 gap-6">
          <div className="col-span-1">
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-slate-700 flex items-center gap-2"><Clock size={15} className="text-slate-400" /> Unassigned Queue</h3>
                <span className="text-xs font-medium text-slate-500 bg-slate-200 rounded-full px-2 py-0.5">{unassigned.length}</span>
              </div>
              {unassigned.length === 0 ? (
                <div className="p-8 text-center"><CheckCircle size={28} className="text-emerald-400 mx-auto mb-2" /><p className="text-sm text-slate-500">All work assigned</p></div>
              ) : (
                <div className="divide-y divide-slate-100 max-h-[600px] overflow-y-auto">
                  {unassigned.map(item => <WorkCard key={item.lineId} item={item} workers={workers} onAssign={assignWorker} saving={saving === item.lineId} onEditMpp={() => { setEditingMpp(item.partId); setEditMppValue(String(item.minutesPerPiece)); }} editingMpp={editingMpp === item.partId} editMppValue={editMppValue} onEditMppChange={setEditMppValue} onSaveMpp={() => saveMpp(item.partId)} onCancelMpp={() => setEditingMpp(null)} />)}
                </div>
              )}
            </div>
          </div>
          <div className="col-span-2 space-y-4">
            {workers.length === 0 && !loading && <div className="bg-white rounded-xl border border-slate-200 p-10 text-center text-slate-400">No active workers — add one to start assigning work.</div>}
            {workers.map(worker => {
              const items = workerItems(worker.id);
              const load = workerLoad(worker.id);
              const cap = worker.capacity_minutes_per_day;
              const over = load > cap;
              const isCollapsed = collapsed.has(worker.id);
              const pct = cap > 0 ? Math.min(100, Math.round((load / cap) * 100)) : 0;
              return (
                <div key={worker.id} className={`bg-white rounded-xl border overflow-hidden ${over ? 'border-red-200' : 'border-slate-200'}`}>
                  <div className="px-5 py-4 border-b border-slate-100">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold text-white ${over ? 'bg-red-500' : 'bg-slate-700'}`}>{worker.name.charAt(0).toUpperCase()}</div>
                        <div>
                          <p className="text-sm font-semibold text-slate-900">{worker.name}</p>
                          {editingWorker === worker.id ? (
                            <div className="flex items-center gap-1 mt-0.5">
                              <input type="number" min="1" className="w-20 border border-amber-300 rounded px-1.5 py-0.5 text-xs focus:outline-none" value={editCapacity} onChange={e => setEditCapacity(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') saveCapacity(worker.id); if (e.key === 'Escape') setEditingWorker(null); }} autoFocus />
                              <span className="text-xs text-slate-400">min/day</span>
                              <button onClick={() => saveCapacity(worker.id)} className="text-emerald-500"><Check size={13} /></button>
                              <button onClick={() => setEditingWorker(null)} className="text-slate-400"><X size={13} /></button>
                            </div>
                          ) : (
                            <button onClick={() => { setEditingWorker(worker.id); setEditCapacity(String(cap)); }} className="text-xs text-slate-400 hover:text-slate-600 flex items-center gap-1 mt-0.5"><Clock size={11} /> {fmtMins(cap)}/day <Edit2 size={10} className="ml-0.5" /></button>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="text-right"><p className={`text-sm font-bold ${over ? 'text-red-600' : 'text-slate-900'}`}>{fmtMins(load)}</p><p className="text-xs text-slate-400">{pct}% load</p></div>
                        {over && <div className="flex items-center gap-1 text-xs font-medium text-red-600 bg-red-50 border border-red-200 rounded-lg px-2 py-1"><AlertTriangle size={11} /> +{fmtMins(load - cap)} over</div>}
                        <button onClick={() => toggleCollapse(worker.id)} className="text-slate-400 hover:text-slate-600">{isCollapsed ? <ChevronDown size={16} /> : <ChevronUp size={16} />}</button>
                      </div>
                    </div>
                    <LoadBar used={load} capacity={cap} />
                  </div>
                  {!isCollapsed && (
                    <div className="divide-y divide-slate-100 max-h-80 overflow-y-auto">
                      {items.length === 0 ? <p className="text-sm text-slate-400 text-center py-5">No work assigned</p> : items.map(item => <WorkCard key={item.lineId} item={item} workers={workers} onAssign={assignWorker} saving={saving === item.lineId} onEditMpp={() => { setEditingMpp(item.partId); setEditMppValue(String(item.minutesPerPiece)); }} editingMpp={editingMpp === item.partId} editMppValue={editMppValue} onEditMppChange={setEditMppValue} onSaveMpp={() => saveMpp(item.partId)} onCancelMpp={() => setEditingMpp(null)} />)}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

interface WorkCardProps { item: WorkItem; workers: Worker[]; onAssign: (lineId: string, workerId: string | null) => void; saving: boolean; onEditMpp: () => void; editingMpp: boolean; editMppValue: string; onEditMppChange: (v: string) => void; onSaveMpp: () => void; onCancelMpp: () => void; }

function WorkCard({ item, workers, onAssign, saving, onEditMpp, editingMpp, editMppValue, onEditMppChange, onSaveMpp, onCancelMpp }: WorkCardProps) {
  const noTime = item.minutesPerPiece === 0;
  return (
    <div className={`px-4 py-3 hover:bg-slate-50 transition-colors ${saving ? 'opacity-60' : ''}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-0.5">
            <span className="text-xs font-mono font-semibold text-slate-600">{item.partNumber}</span>
            <span className="text-xs text-slate-400">·</span>
            <span className="text-xs font-medium text-slate-700">{item.orderNumber}</span>
            {item.requiredShipDate && <span className="text-xs text-slate-400">due {fmtDate(item.requiredShipDate)}</span>}
          </div>
          <p className="text-sm text-slate-800 truncate">{item.description}</p>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <span className="text-xs text-slate-500">{item.qtyRemaining} pcs</span>
            <span className="text-xs text-slate-300">x</span>
            {editingMpp ? (
              <div className="flex items-center gap-1">
                <input type="number" min="0" step="0.5" className="w-16 border border-amber-300 rounded px-1.5 py-0.5 text-xs" value={editMppValue} onChange={e => onEditMppChange(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') onSaveMpp(); if (e.key === 'Escape') onCancelMpp(); }} autoFocus />
                <span className="text-xs text-slate-400">min/pc</span>
                <button onClick={onSaveMpp} className="text-emerald-500"><Check size={12} /></button>
                <button onClick={onCancelMpp} className="text-slate-400"><X size={12} /></button>
              </div>
            ) : (
              <button onClick={onEditMpp} className={`text-xs flex items-center gap-0.5 ${noTime ? 'text-amber-600 font-medium' : 'text-slate-500 hover:text-slate-700'}`}>
                {noTime ? '+ set time' : `${item.minutesPerPiece}m/pc`} <Edit2 size={10} className="ml-0.5" />
              </button>
            )}
            {!noTime && <><span className="text-xs text-slate-300">=</span><span className="text-xs font-semibold text-slate-700">{fmtMins(item.totalMinutes)}</span></>}
          </div>
        </div>
        <div className="flex-shrink-0">
          <select value={item.assignedWorkerId ?? ''} onChange={e => onAssign(item.lineId, e.target.value || null)} disabled={saving} className="border border-slate-200 rounded-lg px-2 py-1.5 text-xs bg-white text-slate-700 min-w-[120px]">
            <option value="">— unassigned —</option>
            {workers.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
          </select>
        </div>
      </div>
    </div>
  );
}
