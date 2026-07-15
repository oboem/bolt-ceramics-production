// Mock Supabase client that mimics the @supabase/supabase-js query builder API
// well enough to drop in as a replacement for the real client in simulation mode.
// Supports: from().select() with nested joins, insert(), update(), delete(),
// filters (eq, neq, gt, gte, lt, like, in), order(), limit(), maybeSingle(), single(),
// and count queries.

import { createMockDB, type MockDB } from './mockData';

type Row = Record<string, any>;

// Map of foreign-key constraint names → (table, fk column, referenced table)
// Used to resolve nested joins like `part:parts!inventory_part_id_fkey(...)`.
const FK_MAP: Record<string, { table: string; fk: string; ref: string }> = {
  inventory_part_id_fkey: { table: 'inventory', fk: 'part_id', ref: 'parts' },
  sales_order_lines_sales_order_id_fkey: { table: 'sales_order_lines', fk: 'sales_order_id', ref: 'sales_orders' },
  sales_order_lines_part_id_fkey: { table: 'sales_order_lines', fk: 'part_id', ref: 'parts' },
  bill_of_materials_parent_part_id_fkey: { table: 'bill_of_materials', fk: 'parent_part_id', ref: 'parts' },
  bill_of_materials_component_part_id_fkey: { table: 'bill_of_materials', fk: 'component_part_id', ref: 'parts' },
  clay_receipts_clay_part_id_fkey: { table: 'clay_receipts', fk: 'clay_part_id', ref: 'parts' },
  clay_purchase_orders_clay_part_id_fkey: { table: 'clay_purchase_orders', fk: 'clay_part_id', ref: 'parts' },
  shipment_lines_part_id_fkey: { table: 'shipment_lines', fk: 'part_id', ref: 'parts' },
  shipment_lines_shipment_id_fkey: { table: 'shipment_lines', fk: 'shipment_id', ref: 'shipments' },
  shipment_lines_sales_order_line_id_fkey: { table: 'shipment_lines', fk: 'sales_order_line_id', ref: 'sales_order_lines' },
  shipments_sales_order_id_fkey: { table: 'shipments', fk: 'sales_order_id', ref: 'sales_orders' },
  quote_lines_quote_id_fkey: { table: 'quote_lines', fk: 'quote_id', ref: 'quotes' },
  quote_lines_part_id_fkey: { table: 'quote_lines', fk: 'part_id', ref: 'parts' },
  invoice_lines_invoice_id_fkey: { table: 'invoice_lines', fk: 'invoice_id', ref: 'invoices' },
  invoice_lines_part_id_fkey: { table: 'invoice_lines', fk: 'part_id', ref: 'parts' },
  payments_invoice_id_fkey: { table: 'payments', fk: 'invoice_id', ref: 'invoices' },
  purchase_order_lines_purchase_order_id_fkey: { table: 'purchase_order_lines', fk: 'purchase_order_id', ref: 'purchase_orders' },
  purchase_order_lines_part_id_fkey: { table: 'purchase_order_lines', fk: 'part_id', ref: 'parts' },
};

// Reverse lookup: given (childTable, parentTable) → fk column name in childTable
// Used when the select string uses the alias form without an explicit fk name,
// e.g. `lines:sales_order_lines(...)` (alias "lines", table "sales_order_lines").
const CHILD_PARENT_FK: Record<string, Record<string, string>> = {
  sales_order_lines: { sales_orders: 'sales_order_id', parts: 'part_id' },
  invoice_lines: { invoices: 'invoice_id', parts: 'part_id' },
  quote_lines: { quotes: 'quote_id', parts: 'part_id' },
  shipment_lines: { shipments: 'shipment_id', parts: 'part_id', sales_order_lines: 'sales_order_line_id' },
  purchase_order_lines: { purchase_orders: 'purchase_order_id', parts: 'part_id' },
  bill_of_materials: { parts: 'parent_part_id' },
  inventory: { parts: 'part_id' },
  payments: { invoices: 'invoice_id' },
  clay_receipts: { parts: 'clay_part_id' },
  clay_purchase_orders: { parts: 'clay_part_id' },
  production_runs: { parts: 'part_id' },
  shipments: { sales_orders: 'sales_order_id' },
};

interface Filter { col: string; op: string; val: any; table?: string }
interface OrderSpec { col: string; ascending: boolean; referencedTable?: string }

class MockQueryBuilder {
  private table: string;
  private selectCols: string | null = null;
  private filters: Filter[] = [];
  private orders: OrderSpec[] = [];
  private limitN: number | null = null;
  private singleMode: 'single' | 'maybeSingle' | null = null;
  private isCount = false;
  private isHead = false;
  private insertRows: Row[] | null = null;
  private updateData: Row | null = null;
  private isDelete = false;
  private returnCols: string | null = null;

  constructor(table: string) { this.table = table; }

  // ── Query building methods ────────────────────────────────────────────
  select(cols: string, opts?: { count?: string; head?: boolean }): this {
    this.selectCols = cols.trim();
    if (opts?.count) this.isCount = true;
    if (opts?.head) this.isHead = true;
    return this;
  }

  insert(row: Row | Row[]): this { this.insertRows = Array.isArray(row) ? row : [row]; return this; }
  update(data: Row): this { this.updateData = data; return this; }
  delete(): this { this.isDelete = true; return this; }

  eq(col: string, val: any, opts?: { referencedTable?: string }): this { this.filters.push({ col, op: 'eq', val, table: opts?.referencedTable }); return this; }
  neq(col: string, val: any, opts?: { referencedTable?: string }): this { this.filters.push({ col, op: 'neq', val, table: opts?.referencedTable }); return this; }
  gt(col: string, val: any, opts?: { referencedTable?: string }): this { this.filters.push({ col, op: 'gt', val, table: opts?.referencedTable }); return this; }
  gte(col: string, val: any, opts?: { referencedTable?: string }): this { this.filters.push({ col, op: 'gte', val, table: opts?.referencedTable }); return this; }
  lt(col: string, val: any, opts?: { referencedTable?: string }): this { this.filters.push({ col, op: 'lt', val, table: opts?.referencedTable }); return this; }
  like(col: string, val: any, opts?: { referencedTable?: string }): this { this.filters.push({ col, op: 'like', val, table: opts?.referencedTable }); return this; }
  in(col: string, val: any[], opts?: { referencedTable?: string }): this { this.filters.push({ col, op: 'in', val, table: opts?.referencedTable }); return this; }

  order(col: string, opts?: { ascending?: boolean; referencedTable?: string }): this {
    this.orders.push({ col, ascending: opts?.ascending ?? true, referencedTable: opts?.referencedTable });
    return this;
  }

  limit(n: number): this { this.limitN = n; return this; }
  maybeSingle(): this { this.singleMode = 'maybeSingle'; return this; }
  single(): this { this.singleMode = 'single'; return this; }

  // ── Execution ──────────────────────────────────────────────────────────
  async then(onFulfilled: any, onRejected?: any) {
    try {
      const result = this.execute();
      return onFulfilled?.(result);
    } catch (e) {
      if (onRejected) return onRejected(e);
      throw e;
    }
  }

  private getDB(): MockDB { return getDB(); }

  private execute(): { data: any; error: any; count: number | null } {
    const db = this.getDB();
    const tableData = (db as any)[this.table] as Row[];
    if (!tableData) return { data: null, error: { message: `table "${this.table}" not found` }, count: null };

    // INSERT
    if (this.insertRows) {
      const inserted: Row[] = [];
      for (const row of this.insertRows) {
        const newRow: Row = { id: rid(), ...row };
        if (!row.created_at && hasColumn(this.table, 'created_at')) newRow.created_at = new Date().toISOString();
        if (!row.updated_at && hasColumn(this.table, 'updated_at')) newRow.updated_at = new Date().toISOString();
        (db as any)[this.table].push(newRow);
        inserted.push(newRow);
      }
      const data = this.returnCols ? this.projectInserted(inserted) : (inserted.length === 1 ? inserted[0] : inserted);
      return { data, error: null, count: null };
    }

    // SELECT (with filtering)
    let rows = tableData.slice();

    // Apply filters
    for (const f of this.filters) {
      // If filter targets a referenced table, we need to handle it after join
      if (f.table) continue;
      rows = rows.filter(r => matchFilter(r, f));
    }

    // Apply order
    for (const ord of [...this.orders].reverse()) {
      if (ord.referencedTable) continue;
      rows.sort((a, b) => cmp(a[ord.col], b[ord.col], ord.ascending));
    }

    // Apply limit
    if (this.limitN !== null) rows = rows.slice(0, this.limitN);

    // Count-only query
    if (this.isHead && this.isCount) {
      return { data: null, count: rows.length, error: null };
    }

    // Build the result with selected columns and joins
    let result: any[];
    if (this.selectCols) {
      result = rows.map(r => this.projectRow(r, this.selectCols!));
    } else {
      result = rows;
    }

    // Apply filters on referenced tables (post-join)
    for (const f of this.filters) {
      if (!f.table) continue;
      result = result.filter(r => matchFilterOnRef(r, f));
    }

    // Apply order on referenced tables
    for (const ord of [...this.orders].reverse()) {
      if (!ord.referencedTable) continue;
      result.sort((a, b) => cmpOnRef(a, b, ord));
    }

    // Apply limit again after ref filtering
    if (this.limitN !== null) result = result.slice(0, this.limitN);

    // maybeSingle / single
    if (this.singleMode === 'maybeSingle') {
      return { data: result[0] ?? null, error: null, count: null };
    }
    if (this.singleMode === 'single') {
      if (result.length === 0) return { data: null, error: { message: 'no rows' }, count: null };
      return { data: result[0], error: null, count: null };
    }

    // UPDATE
    if (this.updateData) {
      const updated: Row[] = [];
      for (const r of rows) {
        Object.assign(r, this.updateData);
        updated.push(r);
      }
      const data = this.returnCols ? this.projectInserted(updated) : (updated.length === 1 ? updated[0] : updated);
      return { data, error: null, count: null };
    }

    // DELETE
    if (this.isDelete) {
      const ids = new Set(rows.map(r => r.id));
      (db as any)[this.table] = tableData.filter(r => !ids.has(r.id));
      return { data: null, error: null, count: null };
    }

    return { data: result, error: null, count: null };
  }

  // ── Column projection + nested join resolution ────────────────────────
  private projectRow(row: Row, selectStr: string): Row {
    const cols = parseSelectColumns(selectStr);
    const out: Row = {};

    for (const c of cols) {
      if (c.kind === 'simple') {
        if (c.name === '*') {
          Object.assign(out, row);
        } else {
          out[c.name] = row[c.name] ?? null;
        }
      } else if (c.kind === 'nested') {
        out[c.alias] = this.resolveJoin(row, c);
      }
    }
    return out;
  }

  private resolveJoin(row: Row, col: NestedCol): Row | Row[] | null {
    const db = this.getDB();
    const fkInfo = resolveFK(this.table, col);
    if (!fkInfo) return null;

    const refData = (db as any)[fkInfo.refTable] as Row[];
    if (!refData) return null;

    // One-to-many: current table is the parent, join table is the child
    if (fkInfo.direction === 'oneToMany') {
      const children = refData.filter(child => child[fkInfo.fk] === row.id);
      return children.map(child => this.projectRow(child, col.innerSelect));
    }

    // Many-to-one: current table is the child, ref table is the parent
    const parent = refData.find(p => p.id === row[fkInfo.fk]);
    if (!parent) return null;
    return this.projectRow(parent, col.innerSelect);
  }

  private projectInserted(rows: Row[]): Row | Row[] {
    if (this.returnCols === 'id' || this.returnCols === '') {
      return rows.length === 1 ? { id: rows[0].id } : rows.map(r => ({ id: r.id }));
    }
    return rows.length === 1 ? rows[0] : rows;
  }
}

// ── Select string parser ────────────────────────────────────────────────────
interface SimpleCol { kind: 'simple'; name: string }
interface NestedCol { kind: 'nested'; alias: string; refTable: string; fkName: string | null; innerSelect: string }
type ParsedCol = SimpleCol | NestedCol;

function parseSelectColumns(selectStr: string): ParsedCol[] {
  const cols: ParsedCol[] = [];
  let i = 0;
  const s = selectStr.replace(/\s+/g, ' ').trim();

  while (i < s.length) {
    // Skip leading whitespace and commas
    while (i < s.length && (s[i] === ',' || s[i] === ' ')) i++;
    if (i >= s.length) break;

    // Read the field name (up to ':', '(', ',', or end)
    let name = '';
    while (i < s.length && s[i] !== ':' && s[i] !== '(' && s[i] !== ',') {
      name += s[i];
      i++;
    }
    name = name.trim();

    if (i < s.length && s[i] === ':') {
      // Nested: alias:table!fk(...) or alias:table(...)
      i++; // skip ':'
      let refPart = '';
      while (i < s.length && s[i] !== '(') {
        refPart += s[i];
        i++;
      }
      refPart = refPart.trim();
      // refPart is like "parts!inventory_part_id_fkey" or "parts" or "sales_order_lines"
      let refTable = refPart;
      let fkName: string | null = null;
      if (refPart.includes('!')) {
        const [t, fk] = refPart.split('!');
        refTable = t;
        fkName = fk;
      }
      // Now read the inner select (...)
      if (i < s.length && s[i] === '(') {
        const inner = readParen(s, i);
        i = inner.endIndex + 1;
        cols.push({ kind: 'nested', alias: name, refTable, fkName, innerSelect: inner.content });
      }
    } else if (i < s.length && s[i] === '(') {
      // No alias, table(...)
      const inner = readParen(s, i);
      i = inner.endIndex + 1;
      cols.push({ kind: 'nested', alias: name, refTable: name, fkName: null, innerSelect: inner.content });
    } else {
      cols.push({ kind: 'simple', name });
    }
  }
  return cols;
}

function readParen(s: string, start: number): { content: string; endIndex: number } {
  let depth = 0;
  let i = start;
  while (i < s.length) {
    if (s[i] === '(') depth++;
    else if (s[i] === ')') {
      depth--;
      if (depth === 0) return { content: s.slice(start + 1, i), endIndex: i };
    }
    i++;
  }
  return { content: s.slice(start + 1), endIndex: s.length - 1 };
}

// ── FK resolution ──────────────────────────────────────────────────────────
interface FKInfo {
  fk: string;
  refTable: string;
  direction: 'oneToMany' | 'manyToOne';
}

function resolveFK(currentTable: string, col: NestedCol): FKInfo | null {
  // Explicit FK name in the select string (e.g. parts!inventory_part_id_fkey)
  if (col.fkName && FK_MAP[col.fkName]) {
    const entry = FK_MAP[col.fkName];
    if (entry.table === currentTable) {
      return { fk: entry.fk, refTable: entry.ref, direction: 'manyToOne' };
    }
    // The FK is on the child table pointing to current table
    if (entry.ref === currentTable) {
      return { fk: entry.fk, refTable: entry.table, direction: 'oneToMany' };
    }
  }

  // No explicit FK name — infer from table pair
  // If alias name matches a known child table of currentTable → oneToMany
  const childFk = CHILD_PARENT_FK[col.refTable]?.[currentTable];
  if (childFk) {
    return { fk: childFk, refTable: col.refTable, direction: 'oneToMany' };
  }

  // If currentTable has a FK pointing to refTable → manyToOne
  const parentFk = CHILD_PARENT_FK[currentTable]?.[col.refTable];
  if (parentFk) {
    return { fk: parentFk, refTable: col.refTable, direction: 'manyToOne' };
  }

  // Fallback: try matching by common FK column names
  const guessFk = `${col.refTable.replace(/s$/, '')}_id`;
  return { fk: guessFk, refTable: col.refTable, direction: 'manyToOne' };
}

// ── Helpers ─────────────────────────────────────────────────────────────────
const knownColumns: Record<string, Set<string>> = {};
function hasColumn(table: string, col: string): boolean {
  if (!knownColumns[table]) {
    const db = getDB();
    const rows = (db as any)[table] as Row[] | undefined;
    if (rows && rows.length > 0) {
      knownColumns[table] = new Set(Object.keys(rows[0]));
    } else {
      return false;
    }
  }
  return knownColumns[table].has(col);
}

function matchFilter(row: Row, f: Filter): boolean {
  const v = row[f.col];
  switch (f.op) {
    case 'eq': return v === f.val;
    case 'neq': return v !== f.val;
    case 'gt': return Number(v) > Number(f.val);
    case 'gte': return Number(v) >= Number(f.val);
    case 'lt': return Number(v) < Number(f.val);
    case 'like': return likeMatch(String(v ?? ''), f.val);
    case 'in': return Array.isArray(f.val) && f.val.includes(v);
    default: return true;
  }
}

function likeMatch(str: string, pattern: string): boolean {
  // Supabase LIKE uses % as wildcard
  const regex = pattern.replace(/%/g, '.*').replace(/_/g, '.');
  return new RegExp('^' + regex + '$').test(str);
}

function matchFilterOnRef(row: Row, f: Filter): boolean {
  // row is already projected; the referenced table data is nested under its alias
  // We need to find which alias corresponds to f.table
  // This is a simplification: we look for any nested property that came from f.table
  for (const key in row) {
    const val = row[key];
    if (val && typeof val === 'object' && !Array.isArray(val)) {
      if (matchFilter(val, f)) return true;
    }
  }
  return false;
}

function cmp(a: any, b: any, ascending: boolean): number {
  if (a == null && b == null) return 0;
  if (a == null) return ascending ? 1 : -1;
  if (b == null) return ascending ? -1 : 1;
  if (a < b) return ascending ? -1 : 1;
  if (a > b) return ascending ? 1 : -1;
  return 0;
}

function cmpOnRef(a: Row, b: Row, ord: OrderSpec): number {
  const aVal = findRefVal(a, ord.referencedTable!, ord.col);
  const bVal = findRefVal(b, ord.referencedTable!, ord.col);
  return cmp(aVal?.[ord.col], bVal?.[ord.col], ord.ascending);
}

function findRefVal(row: Row, _refTable: string, col?: string): Row | null {
  for (const key in row) {
    const val = row[key];
    if (val && typeof val === 'object' && !Array.isArray(val)) {
      if (col && col in val) return val;
    }
  }
  return null;
}

function rid(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

// ── DB singleton ────────────────────────────────────────────────────────────
let dbInstance: MockDB | null = null;

export function getDB(): MockDB {
  if (!dbInstance) dbInstance = createMockDB();
  return dbInstance;
}

export function resetDB() {
  dbInstance = createMockDB();
}

// ── Mock client ──────────────────────────────────────────────────────────────
export const mockSupabase = {
  from(table: string): MockQueryBuilder {
    return new MockQueryBuilder(table);
  },
};
