export type PartCategory = 'drawing' | 'blade' | 'mold' | 'clay' | 'bisqueware' | 'glaze' | 'finished' | 'unknown';

export interface Part {
  id: string;
  part_number: string;
  description: string;
  unit: string;
  active: boolean;
  notes: string | null;
  created_at: string;
}

export interface Inventory {
  id: string;
  part_id: string;
  quantity_on_hand: number;
  reorder_point: number;
  reorder_quantity: number;
  location: string | null;
  updated_at: string;
  part?: Part;
}

export interface SalesOrder {
  id: string;
  order_number: string;
  customer_name: string;
  order_date: string;
  required_ship_date: string | null;
  status: 'open' | 'in_progress' | 'shipped' | 'cancelled';
  notes: string | null;
  created_at: string;
  lines?: SalesOrderLine[];
}

export interface SalesOrderLine {
  id: string;
  sales_order_id: string;
  part_id: string;
  quantity_ordered: number;
  quantity_completed: number;
  quantity_shipped: number;
  created_at: string;
  part?: Part;
}

export interface BillOfMaterials {
  id: string;
  parent_part_id: string;
  component_part_id: string;
  quantity: number;
  unit: string;
  notes: string | null;
  parent_part?: Part;
  component_part?: Part;
}

export interface ProductionRun {
  id: string;
  run_date: string;
  part_id: string;
  quantity_planned: number;
  quantity_completed: number;
  clay_part_id: string | null;
  clay_used_lbs: number;
  mold_part_id: string | null;
  blade_part_id: string | null;
  notes: string | null;
  created_at: string;
  part?: Part;
  clay_part?: Part;
  mold_part?: Part;
  blade_part?: Part;
}

export interface ClayReceipt {
  id: string;
  clay_part_id: string;
  receipt_date: string;
  quantity_lbs: number;
  supplier: string | null;
  purchase_order: string | null;
  unit_cost: number | null;
  notes: string | null;
  created_at: string;
  clay_part?: Part;
}

export function getPartCategory(partNumber: string): PartCategory {
  const prefix = partNumber.charAt(0);
  switch (prefix) {
    case '1': return 'drawing';
    case '2': return 'blade';
    case '3': return 'mold';
    case '5': return 'clay';
    case '6': return 'bisqueware';
    case '7': return 'glaze';
    case '8': return 'finished';
    default: return 'unknown';
  }
}

export const CATEGORY_LABELS: Record<PartCategory, string> = {
  drawing: 'Drawing',
  blade: 'Jigger Blade',
  mold: 'Plaster Mold',
  clay: 'Clay',
  bisqueware: 'Bisqueware',
  glaze: 'Glaze',
  finished: 'Finished Part',
  unknown: 'Unknown',
};

export const CATEGORY_COLORS: Record<PartCategory, string> = {
  drawing: 'bg-sky-100 text-sky-800',
  blade: 'bg-zinc-100 text-zinc-800',
  mold: 'bg-amber-100 text-amber-800',
  clay: 'bg-orange-100 text-orange-800',
  bisqueware: 'bg-yellow-100 text-yellow-800',
  glaze: 'bg-teal-100 text-teal-800',
  finished: 'bg-green-100 text-green-800',
  unknown: 'bg-gray-100 text-gray-800',
};
