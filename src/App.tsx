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
import SignIn from './pages/SignIn';
import { SimulationProvider, useSimulation } from './lib/simulationContext';
import { AuthProvider, useAuth } from './lib/authContext';
import { Beaker, Loader2 } from 'lucide-react';

function AppContent() {
  const [currentPage, setCurrentPage] = useState<Page>('dashboard');
  const { simulationMode } = useSimulation();
  const { session, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50">
        <Loader2 size={24} className="animate-spin text-amber-500" />
      </div>
    );
  }

  if (!session && !simulationMode) {
    return <SignIn />;
  }

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50 font-sans">
      <Sidebar currentPage={currentPage} onNavigate={setCurrentPage} />
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
        {simulationMode && (
          <div className="flex items-center gap-2 px-4 py-1.5 bg-teal-500/10 border-b border-teal-500/20 text-teal-700 text-xs font-medium">
            <Beaker size={13} />
            Simulation mode active — showing realistic demo data
          </div>
        )}
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

export default function App() {
  return (
    <AuthProvider>
      <SimulationProvider>
        <AppContent />
      </SimulationProvider>
    </AuthProvider>
  );
}
