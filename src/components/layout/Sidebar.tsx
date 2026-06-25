import { LayoutDashboard, ShoppingCart, Package, Droplets, Layers, FlaskConical, FileText, Receipt, ClipboardList, Scale, CheckSquare } from 'lucide-react';

export type Page = 'dashboard' | 'orders' | 'inventory' | 'clay' | 'labor' | 'parts' | 'quotes' | 'invoices' | 'purchase-orders' | 'tasks';

interface SidebarProps {
  currentPage: Page;
  onNavigate: (page: Page) => void;
}

const navItems: { id: Page; label: string; icon: React.ReactNode; description: string; group?: string }[] = [
  { id: 'dashboard', label: 'Production', icon: <LayoutDashboard size={20} />, description: "Today's run" },
  { id: 'orders', label: 'Sales Orders', icon: <ShoppingCart size={20} />, description: 'Customer orders' },
  { id: 'inventory', label: 'Inventory', icon: <Package size={20} />, description: 'All stock levels' },
  { id: 'clay', label: 'Clay Planning', icon: <Droplets size={20} />, description: 'Usage & ordering' },
  { id: 'labor', label: 'Labor Balancer', icon: <Scale size={20} />, description: 'Workload per worker' },
  { id: 'parts', label: 'Parts Master', icon: <Layers size={20} />, description: 'Part numbers', group: 'divider' },
  { id: 'quotes', label: 'Quotes', icon: <FileText size={20} />, description: 'Customer quotes' },
  { id: 'invoices', label: 'Invoices & AR', icon: <Receipt size={20} />, description: 'Billing & payments' },
  { id: 'purchase-orders', label: 'Purchase Orders', icon: <ClipboardList size={20} />, description: 'Vendor POs' },
  { id: 'tasks', label: 'Tasks', icon: <CheckSquare size={20} />, description: 'To-do & done', group: 'tasks-divider' },
];

export default function Sidebar({ currentPage, onNavigate }: SidebarProps) {
  return (
    <aside className="w-64 bg-slate-900 min-h-screen flex flex-col">
      <div className="px-6 py-5 border-b border-slate-700/60">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-amber-500 flex items-center justify-center flex-shrink-0">
            <FlaskConical size={20} className="text-white" />
          </div>
          <div>
            <p className="text-white font-semibold text-sm leading-tight">KilnTrack</p>
            <p className="text-slate-400 text-xs">Production Control</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1">
        {navItems.map((item, idx) => (
          <div key={item.id}>
            {item.group === 'divider' && (
              <div className="pt-3 pb-1 px-3">
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-600">Accounting</p>
              </div>
            )}
            {item.group === 'tasks-divider' && (
              <div className="pt-3 pb-1 px-3">
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-600">Team</p>
              </div>
            )}
            <button
              onClick={() => onNavigate(item.id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-all duration-150 group ${
                currentPage === item.id
                  ? 'bg-amber-500 text-white'
                  : 'text-slate-400 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <span className={currentPage === item.id ? 'text-white' : 'text-slate-500 group-hover:text-slate-300'}>
                {item.icon}
              </span>
              <div>
                <p className="text-sm font-medium leading-tight">{item.label}</p>
                <p className={`text-xs leading-tight ${currentPage === item.id ? 'text-amber-100' : 'text-slate-500 group-hover:text-slate-400'}`}>
                  {item.description}
                </p>
              </div>
            </button>
          </div>
        ))}
      </nav>

      <div className="px-4 py-4 border-t border-slate-700/60">
        <p className="text-slate-500 text-xs text-center">
          {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
        </p>
      </div>
    </aside>
  );
}
