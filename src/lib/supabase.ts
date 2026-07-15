import { createClient } from '@supabase/supabase-js';
import { mockSupabase } from './mockClient';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

const realSupabase = createClient(supabaseUrl, supabaseAnonKey);

// In simulation mode, all `.from()` calls are routed to the mock client.
// The simulation flag is read from localStorage so it persists across reloads
// and is available synchronously at module init (before React renders).
function isSimulationMode(): boolean {
  return localStorage.getItem('kilntrack-simulation') === 'true';
}

// Proxy that switches between real and mock at call time.
export const supabase = new Proxy(realSupabase, {
  get(_target, prop) {
    if (prop === 'from' && isSimulationMode()) {
      return mockSupabase.from.bind(mockSupabase);
    }
    return (realSupabase as any)[prop];
  },
});
