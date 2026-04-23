import { useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import Header from '../components/layout/Header';
import Badge from '../components/ui/Badge';
import { getPartCategory, CATEGORY_LABELS, CATEGORY_COLORS } from '../types';
import { Search, Plus, X, ChevronDown, ChevronRight, MoreHorizontal, AlertTriangle } from 'lucide-react';

interface Part {
  id: string;
  part_number: string;
  description: string;
  unit: string;
  active: boolean;
  notes: string | null;
  created_at: string;
}

interface BomLine {
  id: string;
  quantity: number;
  unit: string;
  component_part: { part_number: string; description: string };
}

const CATEGORY_ORDER = ['finished', 'bisqueware', 'glaze', 'clay', 'mold', 'blade', 'drawing'];

export default function Parts() {
  const [parts, setParts] = useState<Part[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [showInactive, setShowInactive] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [bomData, setBomData] = useState<Record<string, BomLine[]>>({});
  const [showNewPart, setShowNewPart] = useState(false);
  const [newPart, setNewPart] = useState({ part_number: '', description: '', unit: 'ea', notes: '' });
  const [saving, setSaving] = useState(false);
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const [confirmRetire, setConfirmRetire] = useState<Part | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from('parts').select('*').order('part_number');
    if (data) setParts(data);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpenId(null);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const toggleExpand = async (id: string, partNumber: string) => {
    if (expandedId === id) { setExpandedId(null); return; }
    setExpandedId(id);
    if (bomData[id]) return;
    if (!partNumber.startsWith('8')) return;
    const { data } = await supabase
      .from('bill_of_materials')
      .select('id, quantity, unit, component_part:parts!bill_of_materials_component_part_id_fkey(part_number, description)')
      .eq('parent_part_id', id);
    if (data) setBomData(prev => ({ ...prev, [id]: data as any }));
  };

  const createPart = async () => {
    if (!newPart.part_number || !newPart.description) return;
    setSaving(true);
    const { data: created } = await supabase.from('parts').insert({
      part_number: newPart.part_number,
      description: newPart.description,
      unit: newPart.unit,
      notes: newPart.notes || null,
    }).select().maybeSingle();
    if (created) {
      await supabase.from('inventory').insert({ part_id: created.id, quantity_on_hand: 0 });
    }
    setNewPart({ part_number: '', description: '', unit: 'ea', notes: '' });
    setShowNewPart(false);
    setSaving(false);
    load();
  };

  const retirePart = async (part: Part) => {
    await supabase.from('parts').update({ active: false }).eq('id', part.id);
    setConfirmRetire(null);
    setMenuOpenId(null);
    load();
  };

  const restorePart = async (id: string) => {
    await supabase.from('parts').update({ active: true }).eq('id', id);
    setMenuOpenId(null);
    load();
  };

  const filtered = parts.filter(p => {
    const cat = getPartCategory(p.part_number);
    const matchSearch = !search ||
      p.part_number.toLowerCase().includes(search.toLowerCase()) ||
      p.description.toLowerCase().includes(search.toLowerCase());
    const matchCat = categoryFilter === 'all' || cat === categoryFilter;
    const matchActive = showInactive ? true : p.active;
    return matchSearch && matchCat && matchActive;
  });

  const grouped = CATEGORY_ORDER.reduce<Record<string, Part[]>>((acc, cat) => {
    const items = filtered.filter(p => getPartCategory(p.part_number) === cat);
    if (items.length > 0) acc[cat] = items;
    return acc;
  }, {});

  const getCategoryBadgeVariant = (cat: string): 'green' | 'amber' | 'teal' | 'orange' | 'yellow' | 'blue' | 'slate' => {
    const map: Record<string, 'green' | 'amber' | 'teal' | 'orange' | 'yellow' | 'blue' | 'slate'> = {
      finished: 'green', bisqueware: 'yellow', glaze: 'teal', clay: 'orange', mold: 'amber', blade: 'slate', drawing: 'blue',
    };
    return map[cat] ?? 'slate';
  };

  const inactiveCount = parts.filter(p => !p.active).length;

  return (
    <div className="flex-1 overflow-y-auto bg-slate-50">
      <Header
        title="Parts Master"
        subtitle={`${parts.filter(p => p.active).length} active · ${inactiveCount} retired`}
        onRefresh={load}
        loading={loading}
        actions={
          <button
            onClick={() => setShowNewPart(true)}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-amber-500 hover:bg-amber-600 rounded-lg transition-colors"
          >
            <Plus size={15} /> New Part
          </button>
        }
      />

      {/* Retire confirmation modal */}
      {confirmRetire && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl border border-slate-200 p-6 max-w-md w-full mx-4">
            <div className="flex items-start gap-3 mb-4">
              <div className="w-9 h-9 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                <AlertTriangle size={18} className="text-red-600" />
              </div>
              <div>
                <p className="font-semibold text-slate-900">Retire part {confirmRetire.part_number}?</p>
                <p className="text-sm text-slate-500 mt-1">{confirmRetire.description}</p>
              </div>
            </div>
            <p className="text-sm text-slate-600 mb-5">
              Retiring a part marks it as inactive. It will no longer appear in production or planning views, but all historical data is preserved. You can restore it at any time.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => retirePart(confirmRetire)}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-semibold rounded-lg transition-colors"
              >
                Retire Part
              </button>
              <button
                onClick={() => setConfirmRetire(null)}
                className="px-4 py-2 text-sm text-slate-600 hover:text-slate-800 border border-slate-200 rounded-lg"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="p-8 space-y-6">
        <div className="flex items-center gap-4 flex-wrap">
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
          <button
            onClick={() => setShowInactive(v => !v)}
            className={`ml-auto flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
              showInactive ? 'bg-slate-700 text-white border-slate-700' : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'
            }`}
          >
            {showInactive ? 'Hiding retired' : `Show retired${inactiveCount > 0 ? ` (${inactiveCount})` : ''}`}
          </button>
        </div>

        {showNewPart && (
          <div className="bg-white rounded-xl border border-amber-200 p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-slate-900">New Part</h3>
              <button onClick={() => setShowNewPart(false)} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
            </div>
            <div className="bg-slate-50 rounded-lg p-3 mb-4 text-xs text-slate-500">
              <strong>Part Number Convention:</strong> 1xxx=Drawing, 2xxx=Blade, 3xxx=Mold, 5xxx=Clay, 6xxx=Bisqueware, 7xxx=Glaze, 8xxx=Finished
            </div>
            <div className="grid grid-cols-4 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Part Number *</label>
                <input
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                  placeholder="8009"
                  value={newPart.part_number}
                  onChange={e => setNewPart(p => ({ ...p, part_number: e.target.value }))}
                />
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-medium text-slate-600 mb-1">Description *</label>
                <input
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                  placeholder="Part description"
                  value={newPart.description}
                  onChange={e => setNewPart(p => ({ ...p, description: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Unit</label>
                <select
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                  value={newPart.unit}
                  onChange={e => setNewPart(p => ({ ...p, unit: e.target.value }))}
                >
                  <option value="ea">ea</option>
                  <option value="lbs">lbs</option>
                  <option value="gal">gal</option>
                  <option value="set">set</option>
                </select>
              </div>
              <div className="col-span-4">
                <label className="block text-xs font-medium text-slate-600 mb-1">Notes</label>
                <input
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                  placeholder="Optional notes"
                  value={newPart.notes}
                  onChange={e => setNewPart(p => ({ ...p, notes: e.target.value }))}
                />
              </div>
            </div>
            <div className="flex gap-3 mt-4">
              <button
                onClick={createPart}
                disabled={saving || !newPart.part_number || !newPart.description}
                className="px-4 py-2 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
              >
                {saving ? 'Saving...' : 'Create Part'}
              </button>
              <button onClick={() => setShowNewPart(false)} className="px-4 py-2 text-sm text-slate-600 hover:text-slate-800">Cancel</button>
            </div>
          </div>
        )}

        {loading ? (
          <div className="bg-white rounded-xl border border-slate-200 p-8 text-center text-slate-400">Loading parts...</div>
        ) : Object.keys(grouped).length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-200 p-8 text-center text-slate-400">No parts found</div>
        ) : (
          Object.entries(grouped).map(([cat, items]) => (
            <div key={cat} className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <div className="px-6 py-3 bg-slate-50 border-b border-slate-100 flex items-center gap-3">
                <Badge label={CATEGORY_LABELS[cat as keyof typeof CATEGORY_LABELS]} variant={getCategoryBadgeVariant(cat)} />
                <span className="text-xs text-slate-400">{items.length} parts</span>
              </div>
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-100">
                    <th className="w-8 px-4 py-3"></th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Part #</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Description</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Unit</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Notes</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Status</th>
                    <th className="w-10 px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {items.map(part => {
                    const isFinished = part.part_number.startsWith('8');
                    const isExpanded = expandedId === part.id;
                    const bom = bomData[part.id] ?? [];
                    const isMenuOpen = menuOpenId === part.id;
                    return (
                      <>
                        <tr
                          key={part.id}
                          className={`hover:bg-slate-50 transition-colors ${!part.active ? 'opacity-60' : ''}`}
                        >
                          <td className="px-4 py-3 text-slate-300">
                            {isFinished && (
                              <button onClick={() => toggleExpand(part.id, part.part_number)} className="hover:text-slate-600 transition-colors">
                                {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                              </button>
                            )}
                          </td>
                          <td className="px-4 py-3 font-mono text-sm font-semibold text-slate-700">{part.part_number}</td>
                          <td className="px-4 py-3 text-sm text-slate-700">{part.description}</td>
                          <td className="px-4 py-3 text-sm text-slate-500">{part.unit}</td>
                          <td className="px-4 py-3 text-sm text-slate-400 max-w-xs truncate">{part.notes ?? '—'}</td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full ${
                              part.active ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'
                            }`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${part.active ? 'bg-green-500' : 'bg-slate-400'}`} />
                              {part.active ? 'Active' : 'Retired'}
                            </span>
                          </td>
                          <td className="px-4 py-3 relative">
                            <button
                              onClick={() => setMenuOpenId(isMenuOpen ? null : part.id)}
                              className="p-1 rounded text-slate-300 hover:text-slate-600 hover:bg-slate-100 transition-colors"
                            >
                              <MoreHorizontal size={16} />
                            </button>
                            {isMenuOpen && (
                              <div
                                ref={menuRef}
                                className="absolute right-4 top-full mt-1 z-20 bg-white border border-slate-200 rounded-lg shadow-lg py-1 min-w-36"
                              >
                                {part.active ? (
                                  <button
                                    onClick={() => { setConfirmRetire(part); setMenuOpenId(null); }}
                                    className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
                                  >
                                    Retire Part
                                  </button>
                                ) : (
                                  <button
                                    onClick={() => restorePart(part.id)}
                                    className="w-full text-left px-4 py-2 text-sm text-green-700 hover:bg-green-50 transition-colors"
                                  >
                                    Restore Part
                                  </button>
                                )}
                              </div>
                            )}
                          </td>
                        </tr>
                        {isExpanded && isFinished && (
                          <tr key={`bom-${part.id}`} className="bg-amber-50">
                            <td></td>
                            <td colSpan={6} className="px-4 py-3">
                              <p className="text-xs font-semibold text-amber-800 mb-2">Bill of Materials</p>
                              {bom.length === 0 ? (
                                <p className="text-xs text-amber-600">No BOM defined for this part</p>
                              ) : (
                                <div className="flex flex-wrap gap-2">
                                  {bom.map(b => (
                                    <div key={b.id} className="bg-white border border-amber-200 rounded-lg px-3 py-2 text-xs">
                                      <span className="font-mono font-semibold text-slate-700">{(b.component_part as any)?.part_number}</span>
                                      <span className="text-slate-500 ml-1">{(b.component_part as any)?.description}</span>
                                      <span className="ml-2 font-semibold text-amber-700">{b.quantity} {b.unit}</span>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </td>
                          </tr>
                        )}
                      </>
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
