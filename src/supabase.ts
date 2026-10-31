import { createClient } from '@supabase/supabase-js';

// Hardcoded Supabase configuration using project URL and Anon Key fallbacks
// Direct project configurations:
// Project URL: https://arierwpjaksxxnmvbqwn.supabase.co
// Anon Key: ap-southeast-1
export const HARDCODED_SUPABASE_URL = 'https://arierwpjaksxxnmvbqwn.supabase.co';
export const HARDCODED_SUPABASE_ANON_KEY = 'ap-southeast-1';

// URL and Anon Key resolved with hardcoded fallbacks
const envUrl = (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_SUPABASE_URL) || 
               (typeof import.meta !== 'undefined' && (import.meta as any).env?.SUPABASE_URL) || 
               '';
const cleanUrl = String(envUrl).trim().replace(/^["']|["']$/g, '');
export const SUPABASE_URL = cleanUrl.length > 0 
  ? (cleanUrl.startsWith('http') ? cleanUrl : `https://${cleanUrl}.supabase.co`)
  : HARDCODED_SUPABASE_URL;

const envKey = (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_SUPABASE_ANON_KEY) || 
               (typeof import.meta !== 'undefined' && (import.meta as any).env?.SUPABASE_ANON_KEY) || 
               '';
const cleanKey = String(envKey).trim().replace(/^["']|["']$/g, '');
export const SUPABASE_ANON_KEY = cleanKey.length > 0 ? cleanKey : HARDCODED_SUPABASE_ANON_KEY;

console.log('[Supabase Client] Initialized with URL:', SUPABASE_URL, 'Anon Key:', SUPABASE_ANON_KEY.slice(0, 6) + '...');

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
  realtime: {
    params: {
      eventsPerSecond: 10,
    },
  },
});

export interface SupabaseOrder {
  id?: string;
  service_type: 'MAINTENANCE';
  status: string;
  customer_name?: string;
  customer_phone?: string;
  vehicle_name?: string;
  rc_number?: string;
  vehicle_plate?: string;
  description?: string;
  price?: number;
  parts?: any;
  part_preference?: string;
  repair_complexity?: string;
  repair_start_time?: string;
  estimated_timing?: string;
  created_at?: string;
  updated_at?: string;
  metadata?: Record<string, any>;
  [key: string]: any;
}

/**
 * Save a repair job card or part request to the Supabase orders table with service_type: 'MAINTENANCE'
 */
export async function saveOrderToSupabase(
  request: {
    id: string;
    customerName?: string;
    customerPhone?: string;
    vehicleName: string;
    rcNumber: string;
    vehiclePlate: string;
    description: string;
    status: string;
    price?: number;
    serviceType?: string;
    partPreference?: string;
    parts?: any[];
    repairComplexity?: string;
    estimatedTiming?: string;
    [key: string]: any;
  },
  options: { isPartRequest?: boolean; partItem?: any } = {}
): Promise<{ success: boolean; data?: any; error?: string }> {
  const isPart = options.isPartRequest || false;
  const orderId = isPart ? `PART-${Date.now()}` : (request.id || `REQ-${Date.now()}`);

  const primaryPayload: Record<string, any> = {
    id: orderId,
    service_type: 'MAINTENANCE',
    status: isPart ? 'pending' : (request.status || 'pending'),
    customer_name: request.customerName || 'Customer',
    customer_phone: request.customerPhone || '',
    vehicle_name: request.vehicleName || 'Vehicle',
    rc_number: request.rcNumber || '',
    vehicle_plate: request.vehiclePlate || '',
    description: isPart && options.partItem
      ? `Part Request: ${options.partItem.name} (${options.partItem.sourcing || 'OEM'}) - For ${request.vehicleName || 'Vehicle'}`
      : (request.description || 'Repair Job Card'),
    price: isPart && options.partItem?.price
      ? Number(options.partItem.price)
      : (request.price ? Number(request.price) : 0),
    parts: isPart && options.partItem ? [options.partItem] : (request.parts || []),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  try {
    console.log('[Supabase] Inserting order with service_type: MAINTENANCE into orders table:', primaryPayload);
    const { data, error } = await supabase.from('orders').insert([primaryPayload]).select();

    if (error) {
      console.warn('[Supabase] Full insert encountered an issue, trying minimal fallback schema:', error.message);
      // Fallback in case specific columns don't exist in user's schema
      const fallbackPayload: Record<string, any> = {
        service_type: 'MAINTENANCE',
        status: primaryPayload.status,
        description: primaryPayload.description,
        price: primaryPayload.price,
        created_at: primaryPayload.created_at,
      };

      const fallbackResult = await supabase.from('orders').insert([fallbackPayload]).select();
      if (fallbackResult.error) {
        console.error('[Supabase] Fallback insert also failed:', fallbackResult.error);
        return { success: false, error: fallbackResult.error.message };
      }
      return { success: true, data: fallbackResult.data };
    }

    console.log('[Supabase] Successfully saved order to orders table:', data);
    return { success: true, data };
  } catch (err: any) {
    console.error('[Supabase] Exception while saving to orders table:', err);
    return { success: false, error: err?.message || 'Network exception' };
  }
}

/**
 * Update the job status in the Supabase orders table and broadcast in real-time
 */
export async function updateOrderStatusInSupabase(
  orderId: string,
  newStatus: string,
  additionalData: Record<string, any> = {}
): Promise<{ success: boolean; error?: string }> {
  try {
    console.log(`[Supabase] Updating order status to '${newStatus}' for id: ${orderId}`);
    const updatePayload: Record<string, any> = {
      status: newStatus,
      updated_at: new Date().toISOString(),
      ...additionalData,
    };

    const { error } = await supabase
      .from('orders')
      .update(updatePayload)
      .eq('id', orderId);

    if (error) {
      console.warn(`[Supabase] Update status failed with id ${orderId}:`, error.message);
      // Try updating just status and updated_at
      const simpleUpdate = await supabase
        .from('orders')
        .update({ status: newStatus })
        .eq('id', orderId);
      
      if (simpleUpdate.error) {
        return { success: false, error: simpleUpdate.error.message };
      }
    }

    return { success: true };
  } catch (err: any) {
    console.error('[Supabase] Exception while updating status:', err);
    return { success: false, error: err?.message || 'Update exception' };
  }
}

/**
 * Fetch all maintenance orders from Supabase
 */
export async function fetchMaintenanceOrders(): Promise<any[]> {
  try {
    const { data, error } = await supabase
      .from('orders')
      .select('*')
      .eq('service_type', 'MAINTENANCE')
      .order('created_at', { ascending: false });

    if (error) {
      console.warn('[Supabase] Fetch maintenance orders note:', error.message);
      const general = await supabase.from('orders').select('*').limit(20);
      return general.data || [];
    }

    return data || [];
  } catch (err) {
    console.warn('[Supabase] Could not fetch orders from Supabase:', err);
    return [];
  }
}

/**
 * Real-time subscription to orders table changes
 */
export function subscribeToOrdersRealtime(callbacks: {
  onInsert?: (order: any) => void;
  onUpdate?: (order: any) => void;
  onDelete?: (order: any) => void;
  onConnectionChange?: (status: string) => void;
}) {
  const channel = supabase
    .channel('orders-realtime-sync')
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'orders',
      },
      (payload) => {
        console.log('[Supabase Realtime] Event:', payload.eventType, payload);
        if (payload.eventType === 'INSERT' && callbacks.onInsert) {
          callbacks.onInsert(payload.new);
        } else if (payload.eventType === 'UPDATE' && callbacks.onUpdate) {
          callbacks.onUpdate(payload.new);
        } else if (payload.eventType === 'DELETE' && callbacks.onDelete) {
          callbacks.onDelete(payload.old);
        }
      }
    )
    .subscribe((status) => {
      console.log('[Supabase Realtime Channel Status]:', status);
      if (callbacks.onConnectionChange) {
        callbacks.onConnectionChange(status);
      }
    });

  return () => {
    supabase.removeChannel(channel);
  };
}

/**
 * Test connectivity to Supabase orders table
 */
export async function testSupabaseConnection(): Promise<{ 
  connected: boolean; 
  message: string; 
  latencyMs?: number; 
  count?: number; 
  url?: string;
}> {
  const start = performance.now();
  try {
    const { count, error } = await supabase.from('orders').select('*', { count: 'exact', head: true });
    const latencyMs = Math.round(performance.now() - start);

    if (error) {
      // Secondary fallback query test in case count query header is restricted
      const altTest = await supabase.from('orders').select('id, service_type').limit(1);
      const altLatency = Math.round(performance.now() - start);
      if (altTest.error) {
        console.warn('[Supabase Connection Test Note]:', error.message || altTest.error.message);
        return { 
          connected: false, 
          message: error.message || altTest.error.message || 'Supabase orders table unreachable', 
          latencyMs: altLatency,
          url: SUPABASE_URL
        };
      }
      return { 
        connected: true, 
        message: `Connected to orders table (${altLatency}ms)`, 
        latencyMs: altLatency, 
        count: altTest.data?.length ?? 0,
        url: SUPABASE_URL
      };
    }

    return { 
      connected: true, 
      message: `Connected to Supabase orders table (${latencyMs}ms, ${count ?? 0} records)`, 
      latencyMs, 
      count: count ?? 0,
      url: SUPABASE_URL
    };
  } catch (err: any) {
    const latencyMs = Math.round(performance.now() - start);
    console.error('[Supabase Connection Test Exception]:', err);
    return { 
      connected: false, 
      message: err?.message || 'Connection failed', 
      latencyMs,
      url: SUPABASE_URL
    };
  }
}
