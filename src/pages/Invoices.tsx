import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import Header from '../components/layout/Header';
import {
  Plus, X, ChevronRight, AlertTriangle, Trash2,
  CreditCard, Send, Ban, DollarSign, FileText,
} from 'lucide-react';

interface Part {
  id: string;
  part_number: string;
  description: string;
  unit: string | null;
  unit_price: number;
}

interface SalesOrder {
  id: string;
  order_number: string;
  customer_name: string;
}

interface InvoiceLine {
  id: string;
  invoice_id: string;
  part_id: string | null;
  description: string;
  quantity: number;
  unit_price: number;
  discount_pct: number;
  sort_order: number;
}

interface Payment {
  id: string;
  invoice_id: string;
  payment_date: string;
  amount: number;
  method: string;
  reference_number: string | null;
  notes: string | null;
}

interface Invoice {
  id: string;
  invoice_number: string;
  sales_order_id: string | null;
  quote_id: string | null;
  customer_name: string;
  customer_email: string | null;
  invoice_date: string;
  due_date: string;
  payment_terms: string;
  status: 'draft' | 'sent' | 'paid' | 'partial' | 'void';
  notes: string | null;
  lines: InvoiceLine[];
  payments: Payment[];
}

interface NewLine {
  part_id: string;
  description: string;
  quantity: string;
  unit_price: string;
  discount_pct: string;
}

interface NewInvoiceForm {
  customer_name: string;
  customer_email: string;
  invoice_date: string;
  due_date: string;
  payment_terms: string;
  notes: string;
  sales_order_id: string;
  lines: NewLine[];
}

interface NewPaymentForm {
  payment_date: string;
  amount: string;
  method: string;
  reference_number: string;
  notes: string;
}

type StatusFilter = 'all' | 'outstanding' | 'overdue' | 'paid';

function lineTotal(line: NewLine | InvoiceLine): number {
  const qty = typeof (line as NewLine).quantity === 'string'
    ? parseFloat((line as NewLine).quantity) || 0
    : (line as InvoiceLine).quantity;
  const price = typeof (line as NewLine).unit_price === 'string'
    ? parseFloat((line as NewLine).unit_price) || 0
    : (line as InvoiceLine).unit_price;
  const disc = typeof (line as NewLine).discount_pct === 'string'
    ? parseFloat((line as NewLine).discount_pct) || 0
    : (line as InvoiceLine).discount_pct;
  return qty * price * (1 - disc / 100);
}

function invoiceTotal(lines: InvoiceLine[]): number {
  return lines.reduce((s, l) => s + lineTotal(l), 0);
}

function amountPaid(payments: Payment[]): number {
  return payments.reduce((s, p) => s + Number(p.amount), 0);
}

function formatCurrency(n: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);
}

function formatDate(d: string): string {
  return new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function isOverdue(inv: Invoice): boolean {
  if (inv.status === 'paid' || inv.status === 'void') return false;
  return new Date(inv.due_date + 'T00:00:00') < new Date();
}

const STATUS_BADGE: Record<Invoice['status'], string> = {
  draft: 'bg-slate-100 text-slate-600',
  sent: 'bg-blue-100 text-blue-700',
  paid: 'bg-green-100 text-green-700',
  partial: 'bg-amber-100 text-amber-700',
  void: 'bg-slate-100 text-slate-400 line-through',
};

const PAYMENT_METHODS = ['check', 'wire', 'ach', 'credit_card', 'cash', 'other'];

function StatusBadge({ status }: { status: Invoice['status'] }) {
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${STATUS_BADGE[status]}`}>
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}

function generateInvoiceNumber(): string {
  const n = Math.floor(1000 + Math.random() * 9000);
  return `INV-${n}`;
}

const emptyLine = (): NewLine => ({
  part_id: '',
  description: '',
  quantity: '1',
  unit_price: '0.00',
  discount_pct: '0',
});

const defaultForm = (): NewInvoiceForm => {
  const today = new Date().toISOString().split('T')[0];
  const due = new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0];
  return {
    customer_name: '',
    customer_email: '',
    invoice_date: today,
    due_date: due,
    payment_terms: 'Net 30',
    notes: '',
    sales_order_id: '',
    lines: [emptyLine()],
  };
};

export default function Invoices() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [parts, setParts] = useState<Part[]>([]);
  const [salesOrders, setSalesOrders] = useState<SalesOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState<NewInvoiceForm>(defaultForm());
  const [saving, setSaving] = useState(false);

  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);

  const [showPayment, setShowPayment] = useState(false);
  const [paymentForm, setPaymentForm] = useState<NewPaymentForm>({
    payment_date: new Date().toISOString().split('T')[0],
    amount: '',
    method: 'check',
    reference_number: '',
    notes: '',
  });
  const [paymentSaving, setPaymentSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('invoices')
      .select(`
        id, invoice_number, sales_order_id, quote_id, customer_name, customer_email,
        invoice_date, due_date, payment_terms, status, notes,
        lines:invoice_lines(id, invoice_id, part_id, description, quantity, unit_price, discount_pct, sort_order),
        payments(id, invoice_id, payment_date, amount, method, reference_number, notes)
      `)
      .order('invoice_date', { ascending: false });

    if (data) {
      setInvoices(data as Invoice[]);
      if (selectedInvoice) {
        const refreshed = (data as Invoice[]).find(i => i.id === selectedInvoice.id);
        if (refreshed) setSelectedInvoice(refreshed);
      }
    }
    setLoading(false);
  }, [selectedInvoice?.id]);

  const loadParts = async () => {
    const { data } = await supabase.from('parts').select('id, part_number, description, unit, unit_price').order('part_number');
    if (data) setParts(data as Part[]);
  };

  const loadSalesOrders = async () => {
    const { data } = await supabase
      .from('sales_orders')
      .select('id, order_number, customer_name')
      .in('status', ['open', 'in_progress'])
      .order('order_number');
    if (data) setSalesOrders(data as SalesOrder[]);
  };

  useEffect(() => {
    load();
    loadParts();
    loadSalesOrders();
  }, []);

  const today = new Date().toISOString().split('T')[0];
  const thisMonthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];

  const totalOutstanding = invoices
    .filter(i => i.status !== 'paid' && i.status !== 'void')
    .reduce((s, i) => {
      const bal = invoiceTotal(i.lines) - amountPaid(i.payments);
      return s + Math.max(0, bal);
    }, 0);

  const overdueInvoices = invoices.filter(i => isOverdue(i));
  const overdueAmount = overdueInvoices.reduce((s, i) => {
    const bal = invoiceTotal(i.lines) - amountPaid(i.payments);
    return s + Math.max(0, bal);
  }, 0);

  const collectedThisMonth = invoices.reduce((s, i) => {
    return s + i.payments
      .filter(p => p.payment_date >= thisMonthStart)
      .reduce((ps, p) => ps + Number(p.amount), 0);
  }, 0);

  const filteredInvoices = invoices.filter(inv => {
    if (statusFilter === 'all') return true;
    if (statusFilter === 'outstanding') return inv.status === 'sent' || inv.status === 'partial' || inv.status === 'draft';
    if (statusFilter === 'overdue') return isOverdue(inv);
    if (statusFilter === 'paid') return inv.status === 'paid';
    return true;
  });

  const handleCreateFormChange = (field: keyof Omit<NewInvoiceForm, 'lines'>, value: string) => {
    setCreateForm(prev => ({ ...prev, [field]: value }));
  };

  const handleLineChange = (idx: number, field: keyof NewLine, value: string) => {
    setCreateForm(prev => {
      const lines = prev.lines.map((l, i) => {
        if (i !== idx) return l;
        const updated = { ...l, [field]: value };
        if (field === 'part_id' && value) {
          const part = parts.find(p => p.id === value);
          if (part) {
            updated.description = part.description;
            updated.unit_price = String(part.unit_price);
          }
        }
        return updated;
      });
      return { ...prev, lines };
    });
  };

  const addLine = () => {
    setCreateForm(prev => ({ ...prev, lines: [...prev.lines, emptyLine()] }));
  };

  const removeLine = (idx: number) => {
    setCreateForm(prev => ({ ...prev, lines: prev.lines.filter((_, i) => i !== idx) }));
  };

  const createInvoice = async () => {
    if (!createForm.customer_name || createForm.lines.length === 0) return;
    setSaving(true);

    const invoiceNumber = generateInvoiceNumber();

    const { data: inv } = await supabase.from('invoices').insert({
      invoice_number: invoiceNumber,
      customer_name: createForm.customer_name,
      customer_email: createForm.customer_email || null,
      invoice_date: createForm.invoice_date,
      due_date: createForm.due_date,
      payment_terms: createForm.payment_terms || 'Net 30',
      notes: createForm.notes || null,
      sales_order_id: createForm.sales_order_id || null,
      status: 'draft',
    }).select('id').maybeSingle();

    if (inv) {
      const lineInserts = createForm.lines
        .filter(l => l.description)
        .map((l, i) => ({
          invoice_id: inv.id,
          part_id: l.part_id || null,
          description: l.description,
          quantity: parseFloat(l.quantity) || 1,
          unit_price: parseFloat(l.unit_price) || 0,
          discount_pct: parseFloat(l.discount_pct) || 0,
          sort_order: i,
        }));
      if (lineInserts.length > 0) {
        await supabase.from('invoice_lines').insert(lineInserts);
      }
    }

    setShowCreate(false);
    setCreateForm(defaultForm());
    setSaving(false);
    load();
  };

  const updateStatus = async (inv: Invoice, status: Invoice['status']) => {
    await supabase.from('invoices').update({ status }).eq('id', inv.id);
    load();
  };

  const deleteInvoice = async (inv: Invoice) => {
    if (inv.status !== 'draft' && inv.status !== 'void') return;
    if (!confirm(`Delete invoice ${inv.invoice_number}? This cannot be undone.`)) return;
    await supabase.from('invoice_lines').delete().eq('invoice_id', inv.id);
    await supabase.from('invoices').delete().eq('id', inv.id);
    if (selectedInvoice?.id === inv.id) setSelectedInvoice(null);
    load();
  };

  const openPaymentModal = (inv: Invoice) => {
    const total = invoiceTotal(inv.lines);
    const paid = amountPaid(inv.payments);
    const balance = Math.max(0, total - paid);
    setPaymentForm({
      payment_date: new Date().toISOString().split('T')[0],
      amount: balance.toFixed(2),
      method: 'check',
      reference_number: '',
      notes: '',
    });
    setShowPayment(true);
  };

  const recordPayment = async () => {
    if (!selectedInvoice) return;
    setPaymentSaving(true);

    await supabase.from('payments').insert({
      invoice_id: selectedInvoice.id,
      payment_date: paymentForm.payment_date,
      amount: parseFloat(paymentForm.amount) || 0,
      method: paymentForm.method,
      reference_number: paymentForm.reference_number || null,
      notes: paymentForm.notes || null,
    });

    const existingPaid = amountPaid(selectedInvoice.payments);
    const newPaid = existingPaid + (parseFloat(paymentForm.amount) || 0);
    const total = invoiceTotal(selectedInvoice.lines);
    const newBalance = total - newPaid;

    let newStatus: Invoice['status'] = selectedInvoice.status;
    if (newBalance <= 0) {
      newStatus = 'paid';
    } else if (newPaid > 0) {
      newStatus = 'partial';
    }

    if (newStatus !== selectedInvoice.status) {
      await supabase.from('invoices').update({ status: newStatus }).eq('id', selectedInvoice.id);
    }

    setShowPayment(false);
    setPaymentSaving(false);
    load();
  };

  const createFormTotal = createForm.lines.reduce((s, l) => s + lineTotal(l), 0);

  return (
    <div className="flex-1 overflow-y-auto bg-slate-50">
      <Header
        title="Invoices & Accounts Receivable"
        subtitle={`${invoices.filter(i => i.status !== 'paid' && i.status !== 'void').length} open invoices`}
        onRefresh={load}
        loading={loading}
        actions={
          <button
            onClick={() => { setCreateForm(defaultForm()); setShowCreate(true); }}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-amber-500 hover:bg-amber-600 rounded-lg transition-colors"
          >
            <Plus size={15} /> New Invoice
          </button>
        }
      />

      <div className="p-8 space-y-6">

        {/* AR Stats */}
        <div className="grid grid-cols-4 gap-4">
          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Total Outstanding</p>
            <p className="text-2xl font-bold text-slate-900">{formatCurrency(totalOutstanding)}</p>
            <p className="text-xs text-slate-400 mt-1">
              {invoices.filter(i => i.status !== 'paid' && i.status !== 'void').length} open invoices
            </p>
          </div>
          <div className={`bg-white rounded-xl border p-5 ${overdueAmount > 0 ? 'border-red-200' : 'border-slate-200'}`}>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1 flex items-center gap-1">
              {overdueAmount > 0 && <AlertTriangle size={12} className="text-red-500" />}
              Overdue Amount
            </p>
            <p className={`text-2xl font-bold ${overdueAmount > 0 ? 'text-red-600' : 'text-slate-900'}`}>
              {formatCurrency(overdueAmount)}
            </p>
            <p className="text-xs text-slate-400 mt-1">{overdueInvoices.length} overdue invoice{overdueInvoices.length !== 1 ? 's' : ''}</p>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Collected This Month</p>
            <p className="text-2xl font-bold text-green-700">{formatCurrency(collectedThisMonth)}</p>
            <p className="text-xs text-slate-400 mt-1">
              {new Date().toLocaleString('en-US', { month: 'long' })} {new Date().getFullYear()}
            </p>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Overdue Count</p>
            <p className={`text-2xl font-bold ${overdueInvoices.length > 0 ? 'text-red-600' : 'text-slate-900'}`}>
              {overdueInvoices.length}
            </p>
            <p className="text-xs text-slate-400 mt-1">Past due date</p>
          </div>
        </div>

        {/* Status Filter Tabs */}
        <div className="flex gap-2">
          {(['all', 'outstanding', 'overdue', 'paid'] as StatusFilter[]).map(f => (
            <button
              key={f}
              onClick={() => setStatusFilter(f)}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
                statusFilter === f
                  ? 'bg-slate-900 text-white'
                  : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
              {f === 'overdue' && overdueInvoices.length > 0 && (
                <span className="ml-1.5 text-xs bg-red-500 text-white rounded-full px-1.5 py-0.5">
                  {overdueInvoices.length}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Create Invoice Modal */}
        {showCreate && (
          <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 overflow-y-auto py-10">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl mx-4 my-auto">
              <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
                <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <FileText size={18} className="text-amber-500" /> New Invoice
                </h2>
                <button onClick={() => setShowCreate(false)} className="text-slate-400 hover:text-slate-600">
                  <X size={20} />
                </button>
              </div>

              <div className="p-6 space-y-5">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Customer Name *</label>
                    <input
                      className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                      placeholder="Customer name"
                      value={createForm.customer_name}
                      onChange={e => handleCreateFormChange('customer_name', e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Customer Email</label>
                    <input
                      type="email"
                      className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                      placeholder="email@example.com"
                      value={createForm.customer_email}
                      onChange={e => handleCreateFormChange('customer_email', e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Invoice Date</label>
                    <input
                      type="date"
                      className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                      value={createForm.invoice_date}
                      onChange={e => handleCreateFormChange('invoice_date', e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Due Date</label>
                    <input
                      type="date"
                      className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                      value={createForm.due_date}
                      onChange={e => handleCreateFormChange('due_date', e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Payment Terms</label>
                    <select
                      className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                      value={createForm.payment_terms}
                      onChange={e => handleCreateFormChange('payment_terms', e.target.value)}
                    >
                      <option>Net 15</option>
                      <option>Net 30</option>
                      <option>Net 45</option>
                      <option>Net 60</option>
                      <option>Due on Receipt</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Link to Sales Order</label>
                    <select
                      className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                      value={createForm.sales_order_id}
                      onChange={e => handleCreateFormChange('sales_order_id', e.target.value)}
                    >
                      <option value="">None</option>
                      {salesOrders.map(so => (
                        <option key={so.id} value={so.id}>{so.order_number} — {so.customer_name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Notes</label>
                  <textarea
                    rows={2}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 resize-none"
                    placeholder="Optional notes or payment instructions"
                    value={createForm.notes}
                    onChange={e => handleCreateFormChange('notes', e.target.value)}
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-semibold text-slate-700">Line Items</h3>
                    <button
                      onClick={addLine}
                      className="flex items-center gap-1 text-xs text-amber-600 hover:text-amber-700 font-medium"
                    >
                      <Plus size={13} /> Add Line
                    </button>
                  </div>

                  <div className="border border-slate-200 rounded-xl overflow-hidden">
                    <table className="w-full">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-200">
                          <th className="text-left px-3 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide w-40">Part</th>
                          <th className="text-left px-3 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide">Description</th>
                          <th className="text-right px-3 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide w-20">Qty</th>
                          <th className="text-right px-3 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide w-28">Unit Price</th>
                          <th className="text-right px-3 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide w-20">Disc %</th>
                          <th className="text-right px-3 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide w-28">Total</th>
                          <th className="w-10"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {createForm.lines.map((line, idx) => (
                          <tr key={idx}>
                            <td className="px-3 py-2">
                              <select
                                className="w-full border border-slate-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-amber-400"
                                value={line.part_id}
                                onChange={e => handleLineChange(idx, 'part_id', e.target.value)}
                              >
                                <option value="">None</option>
                                {parts.map(p => (
                                  <option key={p.id} value={p.id}>{p.part_number}</option>
                                ))}
                              </select>
                            </td>
                            <td className="px-3 py-2">
                              <input
                                className="w-full border border-slate-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                                placeholder="Description"
                                value={line.description}
                                onChange={e => handleLineChange(idx, 'description', e.target.value)}
                              />
                            </td>
                            <td className="px-3 py-2">
                              <input
                                type="number"
                                min="0"
                                className="w-full border border-slate-200 rounded-lg px-2 py-1.5 text-sm text-right focus:outline-none focus:ring-2 focus:ring-amber-400"
                                value={line.quantity}
                                onChange={e => handleLineChange(idx, 'quantity', e.target.value)}
                              />
                            </td>
                            <td className="px-3 py-2">
                              <input
                                type="number"
                                min="0"
                                step="0.01"
                                className="w-full border border-slate-200 rounded-lg px-2 py-1.5 text-sm text-right focus:outline-none focus:ring-2 focus:ring-amber-400"
                                value={line.unit_price}
                                onChange={e => handleLineChange(idx, 'unit_price', e.target.value)}
                              />
                            </td>
                            <td className="px-3 py-2">
                              <input
                                type="number"
                                min="0"
                                max="100"
                                className="w-full border border-slate-200 rounded-lg px-2 py-1.5 text-sm text-right focus:outline-none focus:ring-2 focus:ring-amber-400"
                                value={line.discount_pct}
                                onChange={e => handleLineChange(idx, 'discount_pct', e.target.value)}
                              />
                            </td>
                            <td className="px-3 py-2 text-sm text-right font-medium text-slate-700 tabular-nums">
                              {formatCurrency(lineTotal(line))}
                            </td>
                            <td className="px-3 py-2">
                              {createForm.lines.length > 1 && (
                                <button onClick={() => removeLine(idx)} className="text-slate-300 hover:text-red-500 transition-colors">
                                  <X size={15} />
                                </button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr className="bg-slate-50 border-t border-slate-200">
                          <td colSpan={5} className="px-3 py-2.5 text-sm font-semibold text-slate-700 text-right">
                            Total
                          </td>
                          <td className="px-3 py-2.5 text-sm font-bold text-slate-900 text-right tabular-nums">
                            {formatCurrency(createFormTotal)}
                          </td>
                          <td></td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-200">
                <button onClick={() => setShowCreate(false)} className="px-4 py-2 text-sm text-slate-600 hover:text-slate-800">
                  Cancel
                </button>
                <button
                  onClick={createInvoice}
                  disabled={saving || !createForm.customer_name}
                  className="px-5 py-2 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
                >
                  {saving ? 'Saving...' : 'Create Invoice'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Invoices Table */}
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          {loading ? (
            <div className="p-10 text-center text-slate-400">Loading invoices...</div>
          ) : filteredInvoices.length === 0 ? (
            <div className="p-10 text-center text-slate-400">No invoices found</div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Invoice #</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Customer</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Invoice Date</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Due Date</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Status</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Total</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Paid</th>
                  <th className="text-right px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Balance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredInvoices.map(inv => {
                  const total = invoiceTotal(inv.lines);
                  const paid = amountPaid(inv.payments);
                  const balance = Math.max(0, total - paid);
                  const overdue = isOverdue(inv);

                  return (
                    <tr
                      key={inv.id}
                      onClick={() => setSelectedInvoice(inv)}
                      className={`cursor-pointer hover:bg-slate-50 transition-colors ${overdue ? 'bg-red-50 hover:bg-red-100/60' : ''}`}
                    >
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2">
                          <ChevronRight size={14} className="text-slate-300" />
                          <span className="text-sm font-semibold text-slate-900 font-mono">{inv.invoice_number}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-sm text-slate-800">{inv.customer_name}</p>
                        {inv.customer_email && (
                          <p className="text-xs text-slate-400">{inv.customer_email}</p>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-600">{formatDate(inv.invoice_date)}</td>
                      <td className="px-4 py-3">
                        <span className={`text-sm ${overdue ? 'text-red-600 font-medium' : 'text-slate-600'}`}>
                          {formatDate(inv.due_date)}
                        </span>
                        {overdue && (
                          <span className="ml-1.5 inline-flex items-center gap-0.5 text-xs text-red-500">
                            <AlertTriangle size={10} /> Overdue
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={inv.status} />
                      </td>
                      <td className="px-4 py-3 text-sm text-right text-slate-800 font-medium tabular-nums">
                        {formatCurrency(total)}
                      </td>
                      <td className="px-4 py-3 text-sm text-right text-slate-500 tabular-nums">
                        {paid > 0 ? formatCurrency(paid) : '—'}
                      </td>
                      <td className="px-5 py-3 text-sm text-right font-semibold tabular-nums">
                        <span className={inv.status === 'paid' ? 'text-green-600' : balance > 0 ? 'text-slate-900' : 'text-green-600'}>
                          {formatCurrency(balance)}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Detail Panel */}
      {selectedInvoice && (() => {
        const inv = selectedInvoice;
        const total = invoiceTotal(inv.lines);
        const paid = amountPaid(inv.payments);
        const balance = Math.max(0, total - paid);
        const overdue = isOverdue(inv);

        return (
          <div className="fixed inset-0 z-40 flex items-start justify-end bg-black/30">
            <div className="w-full max-w-2xl h-full bg-white shadow-2xl overflow-y-auto flex flex-col">
              <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 sticky top-0 bg-white z-10">
                <div>
                  <h2 className="text-lg font-bold text-slate-900 font-mono">{inv.invoice_number}</h2>
                  <p className="text-sm text-slate-500">{inv.customer_name}</p>
                </div>
                <div className="flex items-center gap-2">
                  {inv.status === 'draft' && (
                    <button
                      onClick={() => updateStatus(inv, 'sent')}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg transition-colors"
                    >
                      <Send size={13} /> Mark Sent
                    </button>
                  )}
                  {inv.status === 'sent' && (
                    <button
                      onClick={() => updateStatus(inv, 'void')}
                      className="flex items-center gap-1.5 px-3 py-1.5 border border-slate-200 text-slate-600 hover:bg-slate-100 text-xs font-semibold rounded-lg transition-colors"
                    >
                      <Ban size={13} /> Void
                    </button>
                  )}
                  {(inv.status === 'sent' || inv.status === 'partial') && (
                    <button
                      onClick={() => openPaymentModal(inv)}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white text-xs font-semibold rounded-lg transition-colors"
                    >
                      <DollarSign size={13} /> Record Payment
                    </button>
                  )}
                  {(inv.status === 'draft' || inv.status === 'void') && (
                    <button
                      onClick={() => deleteInvoice(inv)}
                      className="flex items-center gap-1.5 px-3 py-1.5 border border-red-200 text-red-600 hover:bg-red-50 text-xs font-semibold rounded-lg transition-colors"
                    >
                      <Trash2 size={13} /> Delete
                    </button>
                  )}
                  <button onClick={() => setSelectedInvoice(null)} className="text-slate-400 hover:text-slate-600 ml-1">
                    <X size={20} />
                  </button>
                </div>
              </div>

              <div className="p-6 space-y-6 flex-1">
                {/* Invoice Fields */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-slate-50 rounded-lg p-3">
                    <p className="text-xs text-slate-500 mb-0.5">Status</p>
                    <StatusBadge status={inv.status} />
                  </div>
                  <div className="bg-slate-50 rounded-lg p-3">
                    <p className="text-xs text-slate-500 mb-0.5">Payment Terms</p>
                    <p className="text-sm font-medium text-slate-800">{inv.payment_terms}</p>
                  </div>
                  <div className="bg-slate-50 rounded-lg p-3">
                    <p className="text-xs text-slate-500 mb-0.5">Invoice Date</p>
                    <p className="text-sm font-medium text-slate-800">{formatDate(inv.invoice_date)}</p>
                  </div>
                  <div className={`rounded-lg p-3 ${overdue ? 'bg-red-50' : 'bg-slate-50'}`}>
                    <p className="text-xs text-slate-500 mb-0.5 flex items-center gap-1">
                      {overdue && <AlertTriangle size={11} className="text-red-500" />}
                      Due Date
                    </p>
                    <p className={`text-sm font-medium ${overdue ? 'text-red-700' : 'text-slate-800'}`}>
                      {formatDate(inv.due_date)}
                    </p>
                  </div>
                  {inv.customer_email && (
                    <div className="bg-slate-50 rounded-lg p-3 col-span-2">
                      <p className="text-xs text-slate-500 mb-0.5">Customer Email</p>
                      <p className="text-sm font-medium text-slate-800">{inv.customer_email}</p>
                    </div>
                  )}
                  {inv.notes && (
                    <div className="bg-amber-50 border border-amber-100 rounded-lg p-3 col-span-2">
                      <p className="text-xs text-amber-700 font-medium mb-0.5">Notes</p>
                      <p className="text-sm text-amber-800">{inv.notes}</p>
                    </div>
                  )}
                </div>

                {/* Line Items */}
                <div>
                  <h3 className="text-sm font-semibold text-slate-700 mb-2">Line Items</h3>
                  <div className="border border-slate-200 rounded-xl overflow-hidden">
                    <table className="w-full">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-200">
                          <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide">Description</th>
                          <th className="text-right px-3 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide">Qty</th>
                          <th className="text-right px-3 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide">Unit Price</th>
                          <th className="text-right px-3 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide">Disc %</th>
                          <th className="text-right px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide">Total</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {inv.lines
                          .slice()
                          .sort((a, b) => a.sort_order - b.sort_order)
                          .map(line => (
                            <tr key={line.id} className="hover:bg-slate-50">
                              <td className="px-4 py-2.5 text-sm text-slate-800">{line.description}</td>
                              <td className="px-3 py-2.5 text-sm text-right text-slate-700">{line.quantity}</td>
                              <td className="px-3 py-2.5 text-sm text-right text-slate-700 tabular-nums">
                                {formatCurrency(line.unit_price)}
                              </td>
                              <td className="px-3 py-2.5 text-sm text-right text-slate-500">
                                {line.discount_pct > 0 ? `${line.discount_pct}%` : '—'}
                              </td>
                              <td className="px-4 py-2.5 text-sm text-right font-medium text-slate-800 tabular-nums">
                                {formatCurrency(lineTotal(line))}
                              </td>
                            </tr>
                          ))}
                      </tbody>
                      <tfoot>
                        <tr className="bg-slate-50 border-t border-slate-200">
                          <td colSpan={4} className="px-4 py-2.5 text-sm font-semibold text-slate-700 text-right">
                            Invoice Total
                          </td>
                          <td className="px-4 py-2.5 text-sm font-bold text-slate-900 text-right tabular-nums">
                            {formatCurrency(total)}
                          </td>
                        </tr>
                        {paid > 0 && (
                          <tr className="bg-slate-50 border-t border-slate-100">
                            <td colSpan={4} className="px-4 py-2 text-sm text-slate-500 text-right">
                              Total Paid
                            </td>
                            <td className="px-4 py-2 text-sm text-green-600 font-medium text-right tabular-nums">
                              -{formatCurrency(paid)}
                            </td>
                          </tr>
                        )}
                        <tr className="bg-slate-50 border-t border-slate-100">
                          <td colSpan={4} className="px-4 py-2.5 text-sm font-bold text-slate-800 text-right">
                            Balance Due
                          </td>
                          <td className={`px-4 py-2.5 text-base font-bold text-right tabular-nums ${balance === 0 ? 'text-green-600' : 'text-slate-900'}`}>
                            {formatCurrency(balance)}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>

                {/* Payments */}
                {inv.payments.length > 0 && (
                  <div>
                    <h3 className="text-sm font-semibold text-slate-700 mb-2">Payments Received</h3>
                    <div className="border border-slate-200 rounded-xl overflow-hidden">
                      <table className="w-full">
                        <thead>
                          <tr className="bg-slate-50 border-b border-slate-200">
                            <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide">Date</th>
                            <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide">Method</th>
                            <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide">Reference</th>
                            <th className="text-right px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide">Amount</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {inv.payments
                            .slice()
                            .sort((a, b) => a.payment_date.localeCompare(b.payment_date))
                            .map(p => (
                              <tr key={p.id} className="hover:bg-slate-50">
                                <td className="px-4 py-2.5 text-sm text-slate-700">{formatDate(p.payment_date)}</td>
                                <td className="px-4 py-2.5 text-sm text-slate-600 capitalize">
                                  {p.method.replace('_', ' ')}
                                </td>
                                <td className="px-4 py-2.5 text-sm text-slate-500 font-mono">
                                  {p.reference_number ?? '—'}
                                </td>
                                <td className="px-4 py-2.5 text-sm text-right font-medium text-green-700 tabular-nums">
                                  {formatCurrency(Number(p.amount))}
                                </td>
                              </tr>
                            ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {(inv.status === 'sent' || inv.status === 'partial') && (
                  <button
                    onClick={() => openPaymentModal(inv)}
                    className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-amber-500 hover:bg-amber-600 text-white text-sm font-semibold rounded-xl transition-colors"
                  >
                    <CreditCard size={16} /> Record Payment
                  </button>
                )}
              </div>
            </div>
          </div>
        );
      })()}

      {/* Record Payment Modal */}
      {showPayment && selectedInvoice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <DollarSign size={17} className="text-amber-500" /> Record Payment
              </h2>
              <button onClick={() => setShowPayment(false)} className="text-slate-400 hover:text-slate-600">
                <X size={18} />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Payment Date</label>
                <input
                  type="date"
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                  value={paymentForm.payment_date}
                  onChange={e => setPaymentForm(p => ({ ...p, payment_date: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Amount</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                  value={paymentForm.amount}
                  onChange={e => setPaymentForm(p => ({ ...p, amount: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Payment Method</label>
                <select
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                  value={paymentForm.method}
                  onChange={e => setPaymentForm(p => ({ ...p, method: e.target.value }))}
                >
                  {PAYMENT_METHODS.map(m => (
                    <option key={m} value={m}>{m.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase())}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Reference Number</label>
                <input
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                  placeholder="Check #, wire ref, etc."
                  value={paymentForm.reference_number}
                  onChange={e => setPaymentForm(p => ({ ...p, reference_number: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Notes</label>
                <textarea
                  rows={2}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 resize-none"
                  placeholder="Optional"
                  value={paymentForm.notes}
                  onChange={e => setPaymentForm(p => ({ ...p, notes: e.target.value }))}
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-200">
              <button onClick={() => setShowPayment(false)} className="px-4 py-2 text-sm text-slate-600 hover:text-slate-800">
                Cancel
              </button>
              <button
                onClick={recordPayment}
                disabled={paymentSaving || !paymentForm.amount || parseFloat(paymentForm.amount) <= 0}
                className="px-5 py-2 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white text-sm font-semibold rounded-lg transition-colors"
              >
                {paymentSaving ? 'Saving...' : 'Record Payment'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
