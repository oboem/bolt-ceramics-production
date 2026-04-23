import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import Header from '../components/layout/Header';
import Badge from '../components/ui/Badge';
import { getPartCategory, CATEGORY_LABELS, CATEGORY_COLORS } from '../types';
import { AlertTriangle, Search } from 'lucide-react';

interface InvRow {
  id: string;
  quantity_on_hand: number;
  reorder_point: number;
  reorder_quantity: number;
  location: string | null;
  updated_at: string;
  part: { part_number: string; description: string; unit: string };
}

const CATEGORY_ORDER = ['finished', 'bisqueware', 'clay', 'glaze', 'mold', 'blade', 'drawing', 'unknown'];

export default function Inventory() {
  const [rows, setRows] = useState<InvRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editQty, setEditQty] = useState<number>(0);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('inventory')
      .select('id, quantity_on_hand, reorder_point, reorder_quantity, location, updated_at, part:parts!inventory_part_id_fkey(part_number, description, unit)')
      .order('part_number', { referencedTable: 'parts', ascending: true });
    if (data) setRows(data as any);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const saveQty = async (id: string) => {
    await supabase.from('inventory').update({ quantity_on_hand: editQty, updated_at: new Date().toISOString() }).eq('id', id);
    setEditingId(null);
    load();
  };

  const filtered = rows.filter(r => {
    const cat = getPartCategory(r.part?.part_number ?? '');
    const matchSearch = !search ||
      r.part?.part_number?.toLowerCase().includes(search.toLowerCase()) ||
      r.part?.description?.toLowerCase().includes(search.toLowerCase());
    const matchCat = categoryFilter === 'all' || cat === categoryFilter;
    return matchSearch && matchCat;
  });

  const grouped = CATEGORY_ORDER.reduce<Record<string, InvRow[]>>((acc, cat) => {
    const items = filtered.filter(r => getPartCategory(r.part?.part_number ?? '') === cat);
    if (items.length > 0) acc[cat] = items;
    return acc;
  }, {});

  const lowStockCount = rows.filter(r => r.reorder_point > 0 && r.quantity_on_hand <= r.reorder_point).length;

  return (
    <div className="flex-1 overflow-y-auto bg-slate-50">
      <Header
        title="Inventory"
        subtitle={`${rows.length} tracked items${lowStockCount > 0 ? ` · ${lowStockCount} below reorder point` : ''}`}
        onRefresh={load}
        loading={loading}
      />

      <div className="p-8 space-y-6">
        <div className="flex items-center gap-4">
          <div className="relative flex-1 max-w-sm">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              className="w-full pl-9 pr-4 py-2 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-amber-400"
              placeholder="Search part number or description..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <div className="flex gap-2 flex-wrap">
            {['all', ...CATEGORY_ORDER].map(cat => (
              <button
                key={cat}
                onClick={() => setCategoryFilter(cat)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                  categoryFilter === cat ? 'bg-slate-900 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                {cat === 'all' ? 'All' : CATEGORY_LABELS[cat as keyof typeof CATEGORY_LABELS]}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="bg-white rounded-xl border border-slate-200 p-8 text-center text-slate-400">Loading inventory...</div>
        ) : Object.keys(grouped).length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-200 p-8 text-center text-slate-400">No items found</div>
        ) : (
          Object.entries(grouped).map(([cat, items]) => (
            <div key={cat} className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <div className="px-6 py-3 bg-slate-50 border-b border-slate-100 flex items-center gap-3">
                <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${CATEGORY_COLORS[cat as keyof typeof CATEGORY_COLORS]}`}>
                  {CATEGORY_LABELS[cat as keyof typeof CATEGORY_LABELS]}
                </span>
                <span className="text-xs text-slate-400">{items.length} items</span>
              </div>
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-100">
                    <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Part #</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Description</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">On Hand</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Reorder Pt.</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Location</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Status</th>
                    <th className="text-right px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Updated</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {items.map(row => {
                    const isLow = row.reorder_point > 0 && row.quantity_on_hand <= row.reorder_point;
                    const isOut = row.quantity_on_hand === 0;
                    return (
                      <tr key={row.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-6 py-3 font-mono text-sm font-semibold text-slate-700">{row.part?.part_number}</td>
                        <td className="px-4 py-3 text-sm text-slate-600 max-w-xs truncate">{row.part?.description}</td>
                        <td className="px-4 py-3 text-right">
                          {editingId === row.id ? (
                            <div className="flex items-center justify-end gap-2">
                              <input
                                type="number"
                                min={0}
                                className="w-24 text-sm text-right border border-amber-400 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-amber-400"
                                value={editQty}
                                onChange={e => setEditQty(Number(e.target.value))}
                                autoFocus
                              />
                              <button onClick={() => saveQty(row.id)} className="text-xs font-medium text-green-600 hover:text-green-700">Save</button>
                              <button onClick={() => setEditingId(null)} className="text-xs text-slate-400 hover:text-slate-600">Cancel</button>
                            </div>
                          ) : (
                            <button
                              onClick={() => { setEditingId(row.id); setEditQty(row.quantity_on_hand); }}
                              className={`text-sm font-semibold hover:underline ${isOut ? 'text-red-600' : isLow ? 'text-amber-600' : 'text-slate-900'}`}
                            >
                              {row.quantity_on_hand} {row.part?.unit}
                            </button>
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm text-right text-slate-400">
                          {row.reorder_point > 0 ? `${row.reorder_point} ${row.part?.unit}` : '—'}
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-500">{row.location ?? '—'}</td>
                        <td className="px-4 py-3">
                          {isOut ? (
                            <span className="flex items-center gap-1 text-xs font-medium text-red-600">
                              <AlertTriangle size={12} /> Out of stock
                            </span>
                          ) : isLow ? (
                            <span className="flex items-center gap-1 text-xs font-medium text-amber-600">
                              <AlertTriangle size={12} /> Low stock
                            </span>
                          ) : (
                            <Badge label="In Stock" variant="green" />
                          )}
                        </td>
                        <td className="px-6 py-3 text-xs text-slate-400 text-right">
                          {new Date(row.updated_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
