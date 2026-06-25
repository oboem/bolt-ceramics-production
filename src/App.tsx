import { useState } from 'react';
import Sidebar, { type Page } from './components/layout/Sidebar';
import Dashboard from './pages/Dashboard';
import SalesOrders from './pages/SalesOrders';
import Inventory from './pages/Inventory';
import ClayPlanning from './pages/ClayPlanning';
import LaborBalancer from './pages/LaborBalancer';
import Parts from './pages/Parts';
import Quotes from './pages/Quotes';
import Invoices from './pages/Invoices';
import PurchaseOrders from './pages/PurchaseOrders';
import Tasks from './pages/Tasks';

export default function App() {
  const [currentPage, setCurrentPage] = useState<Page>('dashboard');

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50 font-sans">
      <Sidebar currentPage={currentPage} onNavigate={setCurrentPage} />
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {currentPage === 'dashboard' && <Dashboard />}
        {currentPage === 'orders' && <SalesOrders />}
        {currentPage === 'inventory' && <Inventory />}
        {currentPage === 'clay' && <ClayPlanning />}
        {currentPage === 'labor' && <LaborBalancer />}
        {currentPage === 'parts' && <Parts />}
        {currentPage === 'quotes' && <Quotes />}
        {currentPage === 'invoices' && <Invoices />}
        {currentPage === 'purchase-orders' && <PurchaseOrders />}
        {currentPage === 'tasks' && <Tasks />}
      </main>
    </div>
  );
}
