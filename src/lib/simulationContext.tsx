import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import { resetDB } from './mockClient';

const STORAGE_KEY = 'kilntrack-simulation';

interface SimulationContextValue {
  simulationMode: boolean;
  toggleSimulation: () => void;
}

const SimulationContext = createContext<SimulationContextValue>({
  simulationMode: false,
  toggleSimulation: () => {},
});

export function SimulationProvider({ children }: { children: ReactNode }) {
  const [simulationMode, setSimulationMode] = useState(() =>
    localStorage.getItem(STORAGE_KEY) === 'true'
  );

  const toggleSimulation = useCallback(() => {
    setSimulationMode(prev => {
      const next = !prev;
      localStorage.setItem(STORAGE_KEY, String(next));
      if (next) resetDB();
      // Force a full page reload so the supabase proxy picks up the new mode
      // and all page state is re-initialized cleanly.
      setTimeout(() => window.location.reload(), 50);
      return next;
    });
  }, []);

  return (
    <SimulationContext.Provider value={{ simulationMode, toggleSimulation }}>
      {children}
    </SimulationContext.Provider>
  );
}

export function useSimulation() {
  return useContext(SimulationContext);
}
