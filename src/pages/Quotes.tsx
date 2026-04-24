import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import Header from '../components/layout/Header';
import {
  Plus, X, ChevronDown, ChevronRight, Trash2, Search, ClipboardList, CheckCircle2,
} from 'lucide-react';

interface Part {
  id: string;
  part_number: string;
  description: string;
  unit: string | null;
  unit_price: number | null;
}

interface QuoteLine {
  id: string;
  quote_id: string;
  part_id: string | null;
  description: string;
  quantity: number;
  unit_price: number;
  discount_pct: number;
  sort_order: number;
  part?: Part | null;
}

interface Quote {
  id: string;
  quote_number: string;
  customer_name: string;
  customer_email: string | null;
  customer_phone: string | null;
  quote_date: string;
  expiry_date: string | null;
  status: 'draft' | 'sent' | 'accepted' | 'rejected' | 'expired';
  notes: string | null;
  terms: string | null;
  created_at: string;
  updated_at: string;
  lines: QuoteLine[];
}

type QuoteStatus = Quote['status'];

interface DraftLine {
  key: number;
  part_id: string;
  description: string;
  quantity: string;
  unit_price: string;
  discount_pct: string;
}

interface NewQuoteForm {
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  quote_date: string;
  expiry_date: string;
  notes: string;
  terms: string;
}

const STATUS_COLORS: Record<QuoteStatus, string> = {
  draft: 'bg-slate-100 text-slate-700',
  sent: 'bg-blue-100 text-blue-700',
  accepted: 'bg-green-100 text-green-700',
  rejected: 'bg-red-100 text-red-700',
  expired: 'bg-amber-100 text-amber-700',
};

const STATUS_LABELS: Record<QuoteStatus, string> = {
  draft: 'Draft',
  sent: 'Sent',
  accepted: 'Accepted',
  rejected: 'Rejected',
  expired: 'Expired',
};

function lineTotal(line: DraftLine): number {
  const qty = parseFloat(line.quantity) || 0;
  const price = parseFloat(line.unit_price) || 0;
  const disc = parseFloat(line.discount_pct) || 0;
  return qty * price * (1 - disc / 100);
}

function quoteTotal(lines: QuoteLine[]): number {
  return lines.reduce((sum, l) => {
    return sum + Number(l.quantity) * Number(l.unit_price) * (1 - Number(l.discount_pct) / 100);
  }, 0);
}

function formatCurrency(value: number): string {
  return value.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '—';
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

const BLANK_FORM: NewQuoteForm = {
  customer_name: '',
  customer_email: '',
  customer_phone: '',
  quote_date: new Date().toISOString().split('T')[0],
  expiry_date: '',
  notes: '',
  terms: '',
};

let draftLineKey = 0;
function newDraftLine(): DraftLine {
  return { key: ++draftLineKey, part_id: '', description: '', quantity: '1', unit_price: '0', discount_pct: '0' };
}

export default function Quotes() {
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [parts, setParts] = useState<Part[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState('');

  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState<NewQuoteForm>(BLANK_FORM);
  const [draftLines, setDraftLines] = useState<DraftLine[]>([newDraftLine()]);
  const [saving, setSaving] = useState(false);

  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [convertQuote, setConvertQuote] = useState<Quote | null>(null);
  const [convertShipDate, setConvertShipDate] = useState('');
  const [convertNotes, setConvertNotes] = useState('');
  const [converting, setConverting] = useState(false);
  const [convertedOrderNumber, setConvertedOrderNumber] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('quotes')
      .select(`
        id, quote_number, customer_name, customer_email, customer_phone,
        quote_date, expiry_date, status, notes, terms, created_at, updated_at,
        lines:quote_lines(
          id, quote_id, part_id, description, quantity, unit_price, discount_pct, sort_order,
          part:parts(id, part_number, description, unit, unit_price)
        )
      `)
      .order('quote_date', { ascending: false });

    if (data) {
      const sorted = (data as any[]).map(q => ({
        ...q,
        lines: (q.lines ?? []).slice().sort((a: QuoteLine, b: QuoteLine) => a.sort_order - b.sort_order),
      }));
      setQuotes(sorted as Quote[]);
    }
    setLoading(false);
  }, []);

  const loadParts = useCallback(async () => {
    const { data } = await supabase
      .from('parts')
      .select('id, part_number, description, unit, unit_price')
      .order('part_number');
    if (data) setParts(data as Part[]);
  }, []);

  useEffect(() => {
    load();
    loadParts();
  }, [load, loadParts]);

  const toggle = (id: string) => {
    setExpanded(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const updateStatus = async (quoteId: string, status: QuoteStatus) => {
    await supabase.from('quotes').update({ status, updated_at: new Date().toISOString() }).eq('id', quoteId);
    load();
  };

  const handlePartSelect = (lineKey: number, partId: string) => {
    const part = parts.find(p => p.id === partId);
    setDraftLines(prev =>
      prev.map(l =>
        l.key === lineKey
          ? {
              ...l,
              part_id: partId,
              description: part ? part.description : l.description,
              unit_price: part ? String(part.unit_price ?? 0) : l.unit_price,
            }
          : l,
      ),
    );
  };

  const generateQuoteNumber = async (): Promise<string> => {
    const { data } = await supabase
      .from('quotes')
      .select('quote_number')
      .order('quote_number', { ascending: false })
      .limit(20);

    let maxNum = 0;
    for (const row of data ?? []) {
      const match = (row.quote_number as string).match(/^Q-(\d+)$/);
      if (match) {
        const n = parseInt(match[1], 10);
        if (n > maxNum) maxNum = n;
      }
    }
    return `Q-${String(maxNum + 1).padStart(4, '0')}`;
  };

  const createQuote = async () => {
    if (!form.customer_name || !form.quote_date) return;
    setSaving(true);

    const quoteNumber = await generateQuoteNumber();

    const { data: quoteData, error } = await supabase
      .from('quotes')
      .insert({
        quote_number: quoteNumber,
        customer_name: form.customer_name.trim(),
        customer_email: form.customer_email.trim() || null,
        customer_phone: form.customer_phone.trim() || null,
        quote_date: form.quote_date,
        expiry_date: form.expiry_date || null,
        status: 'draft',
        notes: form.notes.trim() || null,
        terms: form.terms.trim() || null,
      })
      .select('id')
      .maybeSingle();

    if (error || !quoteData) {
      setSaving(false);
      return;
    }

    const validLines = draftLines.filter(l => l.description.trim());
    if (validLines.length > 0) {
      const lineInserts = validLines.map((l, i) => ({
        quote_id: quoteData.id,
        part_id: l.part_id || null,
        description: l.description.trim(),
        quantity: parseFloat(l.quantity) || 1,
        unit_price: parseFloat(l.unit_price) || 0,
        discount_pct: parseFloat(l.discount_pct) || 0,
        sort_order: i,
      }));
      await supabase.from('quote_lines').insert(lineInserts);
    }

    setForm(BLANK_FORM);
    setDraftLines([newDraftLine()]);
    setShowCreate(false);
    setSaving(false);
    load();
  };

  const deleteQuote = async (quoteId: string) => {
    setDeleting(true);
    await supabase.from('quote_lines').delete().eq('quote_id', quoteId);
    await supabase.from('quotes').delete().eq('id', quoteId);
    setDeleteConfirmId(null);
    setDeleting(false);
    load();
  };

  const generateOrderNumber = async (): Promise<string> => {
    const { data } = await supabase
      .from('sales_orders')
      .select('order_number')
      .order('order_number', { ascending: false })
      .limit(20);
    let maxNum = 0;
    for (const row of data ?? []) {
      const match = (row.order_number as string).match(/^SO-(\d+)$/);
      if (match) {
        const n = parseInt(match[1], 10);
        if (n > maxNum) maxNum = n;
      }
    }
    return `SO-${String(maxNum + 1).padStart(4, '0')}`;
  };

  const openConvert = (quote: Quote) => {
    setConvertQuote(quote);
    setConvertShipDate('');
    setConvertNotes(quote.notes ?? '');
    setConvertedOrderNumber(null);
  };

  const submitConvert = async () => {
    if (!convertQuote) return;
    setConverting(true);

    const orderNumber = await generateOrderNumber();

    const { data: soData, error } = await supabase
      .from('sales_orders')
      .insert({
        order_number: orderNumber,
        customer_name: convertQuote.customer_name,
        order_date: new Date().toISOString().split('T')[0],
        required_ship_date: convertShipDate || null,
        status: 'open',
        notes: convertNotes.trim() || null,
        source_quote_id: convertQuote.id,
      })
      .select('id')
      .maybeSingle();

    if (error || !soData) {
      setConverting(false);
      return;
    }

    const linesWithParts = convertQuote.lines.filter(l => l.part_id);
    if (linesWithParts.length > 0) {
      await supabase.from('sales_order_lines').insert(
        linesWithParts.map(l => ({
          sales_order_id: soData.id,
          part_id: l.part_id,
          quantity_ordered: Number(l.quantity),
          quantity_completed: 0,
          quantity_shipped: 0,
          unit_price: Number(l.unit_price),
          discount_pct: Number(l.discount_pct),
        }))
      );
    }

    await supabase
      .from('quotes')
      .update({ status: 'accepted', updated_at: new Date().toISOString() })
      .eq('id', convertQuote.id);

    setConvertedOrderNumber(orderNumber);
    setConverting(false);
    load();
  };

  const filtered = quotes.filter(q =>
    search.trim() === '' ||
    q.customer_name.toLowerCase().includes(search.trim().toLowerCase()),
  );

  const draftLinesTotal = draftLines.reduce((s, l) => s + lineTotal(l), 0);

  return (
    <div className="flex-1 overflow-y-auto bg-slate-50">
      <Header
        title="Quotes"
        subtitle={`${quotes.filter(q => q.status === 'draft' || q.status === 'sent').length} active quotes`}
        onRefresh={load}
        loading={loading}
        actions={
          <button
            onClick={() => { setShowCreate(true); setForm(BLANK_FORM); setDraftLines([newDraftLine()]); }}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-amber-500 hover:bg-amber-600 rounded-lg transition-colors"
          >
            <Plus size={15} /> New Quote
          </button>
        }
      />

      <div className="p-8 space-y-6">

        {/* Search */}
        <div className="relative max-w-sm">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by customer name..."
            className="w-full pl-9 pr-4 py-2 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-amber-400"
          />
        </div>

        {/* Create Form */}
        {showCreate && (
          <div className="bg-white rounded-xl border border-amber-200 shadow-sm overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h3 className="font-semibold text-slate-900">New Quote</h3>
              <button onClick={() => setShowCreate(false)} className="text-slate-400 hover:text-slate-600">
                <X size={18} />
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* Customer Info */}
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Customer</p>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Customer Name *</label>
                    <input
                      className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                      placeholder="Customer name"
                      value={form.customer_name}
                      onChange={e => setForm(p => ({ ...p, customer_name: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Email</label>
                    <input
                      type="email"
                      className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                      placeholder="email@example.com"
                      value={form.customer_email}
                      onChange={e => setForm(p => ({ ...p, customer_email: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Phone</label>
                    <input
                      className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                      placeholder="(555) 000-0000"
                      value={form.customer_phone}
                      onChange={e => setForm(p => ({ ...p, customer_phone: e.target.value }))}
                    />
                  </div>
                </div>
              </div>

              {/* Dates */}
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Dates</p>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Quote Date *</label>
                    <input
                      type="date"
                      className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                      value={form.quote_date}
                      onChange={e => setForm(p => ({ ...p, quote_date: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Expiry Date</label>
                    <input
                      type="date"
                      className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                      value={form.expiry_date}
                      onChange={e => setForm(p => ({ ...p, expiry_date: e.target.value }))}
                    />
                  </div>
                </div>
              </div>

              {/* Line Items */}
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Line Items</p>
                <div className="border border-slate-200 rounded-lg overflow-hidden">
                  <table className="w-full">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200">
                        <th className="text-left px-3 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide w-44">Part</th>
                        <th className="text-left px-3 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide">Description</th>
                        <th className="text-right px-3 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide w-20">Qty</th>
                        <th className="text-right px-3 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide w-28">Unit Price</th>
                        <th className="text-right px-3 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide w-20">Disc %</th>
                        <th className="text-right px-3 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide w-28">Total</th>
                        <th className="w-10" />
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {draftLines.map(line => (
                        <tr key={line.key} className="hover:bg-slate-50">
                          <td className="px-3 py-2">
                            <select
                              value={line.part_id}
                              onChange={e => handlePartSelect(line.key, e.target.value)}
                              className="w-full border border-slate-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-amber-400 bg-white"
                            >
                              <option value="">-- none --</option>
                              {parts.map(p => (
                                <option key={p.id} value={p.id}>
                                  {p.part_number} – {p.description}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td className="px-3 py-2">
                            <input
                              className="w-full border border-slate-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                              placeholder="Description"
                              value={line.description}
                              onChange={e =>
                                setDraftLines(prev =>
                                  prev.map(l => l.key === line.key ? { ...l, description: e.target.value } : l),
                                )
                              }
                            />
                          </td>
                          <td className="px-3 py-2">
                            <input
                              type="number"
                              min={0}
                              className="w-full text-right border border-slate-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                              value={line.quantity}
                              onChange={e =>
                                setDraftLines(prev =>
                                  prev.map(l => l.key === line.key ? { ...l, quantity: e.target.value } : l),
                                )
                              }
                            />
                          </td>
                          <td className="px-3 py-2">
                            <input
                              type="number"
                              min={0}
                              step="0.01"
                              className="w-full text-right border border-slate-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                              value={line.unit_price}
                              onChange={e =>
                                setDraftLines(prev =>
                                  prev.map(l => l.key === line.key ? { ...l, unit_price: e.target.value } : l),
                                )
                              }
                            />
                          </td>
                          <td className="px-3 py-2">
                            <input
                              type="number"
                              min={0}
                              max={100}
                              step="0.1"
                              className="w-full text-right border border-slate-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                              value={line.discount_pct}
                              onChange={e =>
                                setDraftLines(prev =>
                                  prev.map(l => l.key === line.key ? { ...l, discount_pct: e.target.value } : l),
                                )
                              }
                            />
                          </td>
                          <td className="px-3 py-2 text-right text-sm font-medium text-slate-700">
                            {formatCurrency(lineTotal(line))}
                          </td>
                          <td className="px-2 py-2 text-center">
                            <button
                              onClick={() =>
                                setDraftLines(prev => prev.length > 1 ? prev.filter(l => l.key !== line.key) : prev)
                              }
                              className="text-slate-300 hover:text-red-500 transition-colors"
                            >
                              <X size={15} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="border-t border-slate-200 bg-slate-50">
                        <td colSpan={5} className="px-3 py-2.5 text-right text-sm font-semibold text-slate-700">
                          Total
                        </td>
                        <td className="px-3 py-2.5 text-right text-sm font-bold text-slate-900">
                          {formatCurrency(draftLinesTotal)}
                        </td>
                        <td />
                      </tr>
                    </tfoot>
                  </table>
                </div>
                <button
                  onClick={() => setDraftLines(prev => [...prev, newDraftLine()])}
                  className="mt-2 flex items-center gap-1.5 text-sm text-amber-600 hover:text-amber-700 font-medium transition-colors"
                >
                  <Plus size={14} /> Add line
                </button>
              </div>

              {/* Notes & Terms */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Notes</label>
                  <textarea
                    rows={3}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 resize-none"
                    placeholder="Internal notes..."
                    value={form.notes}
                    onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Terms</label>
                  <textarea
                    rows={3}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 resize-none"
                    placeholder="Payment terms, conditions..."
                    value={form.terms}
                    onChange={e => setForm(p => ({ ...p, terms: e.target.value }))}
                  />
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={createQuote}
                  disabled={saving || !form.customer_name || !form.quote_date}
                  className="px-5 py-2 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
                >
                  {saving ? 'Saving...' : 'Create Quote'}
                </button>
                <button
                  onClick={() => setShowCreate(false)}
                  className="px-4 py-2 text-sm text-slate-600 hover:text-slate-800 border border-slate-200 rounded-lg transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Quotes List */}
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Quote #</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Customer</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Date</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Expires</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Status</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Total</th>
                <th className="text-right px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-6 py-10 text-center text-slate-400 text-sm">
                    Loading quotes...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-10 text-center text-slate-400 text-sm">
                    {search ? 'No quotes match your search' : 'No quotes yet'}
                  </td>
                </tr>
              ) : (
                filtered.map(quote => {
                  const isExpanded = expanded.has(quote.id);
                  const total = quoteTotal(quote.lines);
                  const isExpired =
                    quote.expiry_date &&
                    new Date(quote.expiry_date + 'T23:59:59') < new Date() &&
                    quote.status !== 'accepted' &&
                    quote.status !== 'rejected';

                  return (
                    <>
                      <tr
                        key={quote.id}
                        className="hover:bg-slate-50 cursor-pointer transition-colors"
                        onClick={() => toggle(quote.id)}
                      >
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <span className="text-slate-400 shrink-0">
                              {isExpanded ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
                            </span>
                            <span className="font-mono font-semibold text-slate-900 text-sm">{quote.quote_number}</span>
                          </div>
                        </td>
                        <td className="px-4 py-4">
                          <p className="text-sm font-medium text-slate-900">{quote.customer_name}</p>
                          {quote.customer_email && (
                            <p className="text-xs text-slate-400">{quote.customer_email}</p>
                          )}
                        </td>
                        <td className="px-4 py-4 text-sm text-slate-600">{formatDate(quote.quote_date)}</td>
                        <td className="px-4 py-4">
                          <span className={`text-sm ${isExpired ? 'text-red-500 font-medium' : 'text-slate-600'}`}>
                            {formatDate(quote.expiry_date)}
                          </span>
                        </td>
                        <td className="px-4 py-4" onClick={e => e.stopPropagation()}>
                          <select
                            value={quote.status}
                            onChange={e => updateStatus(quote.id, e.target.value as QuoteStatus)}
                            className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-amber-400"
                          >
                            <option value="draft">Draft</option>
                            <option value="sent">Sent</option>
                            <option value="accepted">Accepted</option>
                            <option value="rejected">Rejected</option>
                            <option value="expired">Expired</option>
                          </select>
                          <span
                            className={`ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[quote.status]}`}
                          >
                            {STATUS_LABELS[quote.status]}
                          </span>
                        </td>
                        <td className="px-4 py-4 text-right text-sm font-semibold text-slate-900">
                          {formatCurrency(total)}
                        </td>
                        <td className="px-6 py-4 text-right" onClick={e => e.stopPropagation()}>
                          <div className="flex items-center justify-end gap-2">
                            {(quote.status === 'draft' || quote.status === 'sent') && (
                              <button
                                onClick={() => openConvert(quote)}
                                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors"
                              >
                                <ClipboardList size={12} /> Convert to Order
                              </button>
                            )}
                            {quote.status === 'accepted' && (
                              <span className="flex items-center gap-1 text-xs font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-2.5 py-1.5">
                                <CheckCircle2 size={12} /> Order Created
                              </span>
                            )}
                            <button
                              onClick={() => setDeleteConfirmId(quote.id)}
                              className="p-1.5 text-slate-300 hover:text-red-500 transition-colors"
                            >
                              <Trash2 size={15} />
                            </button>
                          </div>
                        </td>
                      </tr>

                      {/* Delete Confirmation */}
                      {deleteConfirmId === quote.id && (
                        <tr key={`${quote.id}-delete`}>
                          <td colSpan={7} className="px-6 py-3 bg-red-50 border-t border-red-100">
                            <div className="flex items-center justify-between">
                              <p className="text-sm text-red-700">
                                Delete quote <span className="font-semibold">{quote.quote_number}</span> for{' '}
                                <span className="font-semibold">{quote.customer_name}</span>? This cannot be undone.
                              </p>
                              <div className="flex items-center gap-3">
                                <button
                                  onClick={() => setDeleteConfirmId(null)}
                                  className="text-sm text-slate-600 hover:text-slate-800 px-3 py-1.5 border border-slate-200 rounded-lg transition-colors"
                                >
                                  Cancel
                                </button>
                                <button
                                  onClick={() => deleteQuote(quote.id)}
                                  disabled={deleting}
                                  className="text-sm text-white bg-red-600 hover:bg-red-700 disabled:opacity-50 px-4 py-1.5 rounded-lg transition-colors font-medium"
                                >
                                  {deleting ? 'Deleting...' : 'Delete'}
                                </button>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}

                      {/* Expanded Detail */}
                      {isExpanded && (
                        <tr key={`${quote.id}-detail`}>
                          <td colSpan={7} className="bg-slate-50 border-t border-slate-100">
                            <div className="px-6 py-5 space-y-5">

                              {/* Customer + Meta */}
                              <div className="grid grid-cols-4 gap-6">
                                <div>
                                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">Customer</p>
                                  <p className="text-sm font-medium text-slate-900">{quote.customer_name}</p>
                                  {quote.customer_email && (
                                    <p className="text-xs text-slate-500">{quote.customer_email}</p>
                                  )}
                                  {quote.customer_phone && (
                                    <p className="text-xs text-slate-500">{quote.customer_phone}</p>
                                  )}
                                </div>
                                <div>
                                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">Quote Date</p>
                                  <p className="text-sm text-slate-700">{formatDate(quote.quote_date)}</p>
                                </div>
                                <div>
                                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">Expiry Date</p>
                                  <p className={`text-sm ${isExpired ? 'text-red-500 font-medium' : 'text-slate-700'}`}>
                                    {formatDate(quote.expiry_date)}
                                  </p>
                                </div>
                                <div>
                                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">Status</p>
                                  <span
                                    className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[quote.status]}`}
                                  >
                                    {STATUS_LABELS[quote.status]}
                                  </span>
                                </div>
                              </div>

                              {/* Line Items Table */}
                              {quote.lines.length > 0 && (
                                <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
                                  <table className="w-full">
                                    <thead>
                                      <tr className="bg-slate-50 border-b border-slate-200">
                                        <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide">Description</th>
                                        <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide w-36">Part</th>
                                        <th className="text-right px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide w-20">Qty</th>
                                        <th className="text-right px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide w-28">Unit Price</th>
                                        <th className="text-right px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide w-20">Disc %</th>
                                        <th className="text-right px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide w-28">Line Total</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                      {quote.lines.map(line => {
                                        const lTotal =
                                          Number(line.quantity) *
                                          Number(line.unit_price) *
                                          (1 - Number(line.discount_pct) / 100);
                                        return (
                                          <tr key={line.id} className="hover:bg-slate-50">
                                            <td className="px-4 py-3 text-sm text-slate-800">{line.description}</td>
                                            <td className="px-4 py-3 text-xs font-mono text-slate-500">
                                              {line.part?.part_number ?? '—'}
                                            </td>
                                            <td className="px-4 py-3 text-sm text-right text-slate-700">{Number(line.quantity)}</td>
                                            <td className="px-4 py-3 text-sm text-right text-slate-700">
                                              {formatCurrency(Number(line.unit_price))}
                                            </td>
                                            <td className="px-4 py-3 text-sm text-right text-slate-700">
                                              {Number(line.discount_pct) > 0 ? `${Number(line.discount_pct)}%` : '—'}
                                            </td>
                                            <td className="px-4 py-3 text-sm text-right font-semibold text-slate-900">
                                              {formatCurrency(lTotal)}
                                            </td>
                                          </tr>
                                        );
                                      })}
                                    </tbody>
                                    <tfoot>
                                      <tr className="border-t border-slate-200 bg-slate-50">
                                        <td colSpan={5} className="px-4 py-3 text-right text-sm font-semibold text-slate-700">
                                          Quote Total
                                        </td>
                                        <td className="px-4 py-3 text-right text-sm font-bold text-slate-900">
                                          {formatCurrency(total)}
                                        </td>
                                      </tr>
                                    </tfoot>
                                  </table>
                                </div>
                              )}

                              {/* Notes & Terms */}
                              {(quote.notes || quote.terms) && (
                                <div className="grid grid-cols-2 gap-6">
                                  {quote.notes && (
                                    <div>
                                      <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">Notes</p>
                                      <p className="text-sm text-slate-700 whitespace-pre-line">{quote.notes}</p>
                                    </div>
                                  )}
                                  {quote.terms && (
                                    <div>
                                      <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">Terms</p>
                                      <p className="text-sm text-slate-700 whitespace-pre-line">{quote.terms}</p>
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Convert to Production Order Modal */}
      {convertQuote && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
            <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-emerald-600 flex items-center justify-center">
                  <ClipboardList size={18} className="text-white" />
                </div>
                <div>
                  <h2 className="font-semibold text-slate-900">Convert to Production Order</h2>
                  <p className="text-xs text-slate-500">{convertQuote.quote_number} — {convertQuote.customer_name}</p>
                </div>
              </div>
              <button onClick={() => setConvertQuote(null)} className="text-slate-400 hover:text-slate-600">
                <X size={18} />
              </button>
            </div>

            {convertedOrderNumber ? (
              <div className="px-6 py-10 text-center">
                <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-4">
                  <CheckCircle2 size={32} className="text-emerald-600" />
                </div>
                <h3 className="text-lg font-bold text-slate-900 mb-1">Order Created</h3>
                <p className="text-sm text-slate-500 mb-1">
                  Production order <span className="font-mono font-bold text-slate-800">{convertedOrderNumber}</span> is now open.
                </p>
                <p className="text-sm text-slate-400 mb-6">Quote marked as accepted. Navigate to Sales Orders to manage production.</p>
                <button
                  onClick={() => setConvertQuote(null)}
                  className="px-6 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium rounded-lg transition-colors"
                >
                  Done
                </button>
              </div>
            ) : (
              <div className="px-6 py-5 space-y-5">
                {/* Quote summary */}
                <div className="bg-slate-50 rounded-xl p-4 space-y-2">
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Order Lines</p>
                  {convertQuote.lines.length === 0 ? (
                    <p className="text-sm text-slate-400">No line items on this quote.</p>
                  ) : (
                    convertQuote.lines.map(line => {
                      const lTotal = Number(line.quantity) * Number(line.unit_price) * (1 - Number(line.discount_pct) / 100);
                      return (
                        <div key={line.id} className="flex items-center justify-between text-sm">
                          <div className="flex items-center gap-2 min-w-0">
                            {line.part?.part_number && (
                              <span className="font-mono text-xs text-slate-500 shrink-0">{line.part.part_number}</span>
                            )}
                            {!line.part_id && (
                              <span className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded px-1.5 py-0.5 shrink-0">no part</span>
                            )}
                            <span className="text-slate-700 truncate">{line.description}</span>
                          </div>
                          <div className="flex items-center gap-3 shrink-0 ml-3">
                            <span className="text-slate-500 text-xs">x{Number(line.quantity)}</span>
                            <span className="font-semibold text-slate-800">{formatCurrency(lTotal)}</span>
                          </div>
                        </div>
                      );
                    })
                  )}
                  <div className="pt-2 border-t border-slate-200 flex justify-between">
                    <span className="text-sm font-semibold text-slate-700">Total</span>
                    <span className="text-sm font-bold text-slate-900">{formatCurrency(quoteTotal(convertQuote.lines))}</span>
                  </div>
                </div>

                {convertQuote.lines.some(l => !l.part_id) && (
                  <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-sm text-amber-800">
                    <span className="shrink-0 mt-0.5">&#9888;</span>
                    <span>Lines without a linked part will be skipped. Assign parts in the quote before converting if needed.</span>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Required Ship Date <span className="text-slate-400">(optional)</span></label>
                  <input
                    type="date"
                    value={convertShipDate}
                    onChange={e => setConvertShipDate(e.target.value)}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Production Notes <span className="text-slate-400">(optional)</span></label>
                  <textarea
                    rows={2}
                    value={convertNotes}
                    onChange={e => setConvertNotes(e.target.value)}
                    placeholder="Any notes for the production team..."
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400 resize-none"
                  />
                </div>

                <div className="flex gap-3 pt-1">
                  <button
                    onClick={submitConvert}
                    disabled={converting || convertQuote.lines.filter(l => l.part_id).length === 0}
                    className="flex-1 flex items-center justify-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-sm font-semibold rounded-lg transition-colors"
                  >
                    <ClipboardList size={15} />
                    {converting ? 'Creating Order...' : 'Create Production Order'}
                  </button>
                  <button
                    onClick={() => setConvertQuote(null)}
                    className="px-4 py-2.5 text-sm text-slate-600 hover:text-slate-800 border border-slate-200 rounded-lg transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
