import { createClient } from '@supabase/supabase-js';
import { FUEL_SALES_ENABLED } from './config';

// Default Supabase configuration
// Project URL: https://arierwpjaksxxnmvbqwn.supabase.co
// Publishable Key: sb_publishable__c-Q3k0ibuQMt3_mtYpRNw_Se-8kFbS
export const HARDCODED_SUPABASE_URL = 'https://arierwpjaksxxnmvbqwn.supabase.co';
export const HARDCODED_SUPABASE_ANON_KEY = 'sb_publishable__c-Q3k0ibuQMt3_mtYpRNw_Se-8kFbS';

export const DEFAULT_SUPABASE_URL = HARDCODED_SUPABASE_URL;
export const DEFAULT_SUPABASE_ANON_KEY = HARDCODED_SUPABASE_ANON_KEY;

export function isValidSupabaseUrl(url: unknown): url is string {
  if (typeof url !== 'string') return false;
  const trimmed = url.trim().replace(/^["']|["']$/g, '');
  return trimmed.startsWith('https://') && !trimmed.includes('your-project-id');
}

export function isValidSupabaseKey(key: unknown): key is string {
  if (typeof key !== 'string') return false;
  const trimmed = key.trim().replace(/^["']|["']$/g, '');
  return (
    trimmed.startsWith('sb_publishable_') ||
    trimmed.startsWith('eyJ')
  );
}

function getValidLocalStorageItem(key: string, validator: (v: unknown) => boolean): string | null {
  if (typeof window === 'undefined' || !window.localStorage) return null;
  try {
    const val = window.localStorage.getItem(key);
    if (!val) return null;
    if (validator(val)) {
      return val.trim().replace(/^["']|["']$/g, '');
    } else {
      console.warn(`[Supabase] Removing invalid stored value for ${key}:`, val);
      window.localStorage.removeItem(key);
    }
  } catch {
    // Ignore localStorage access restrictions
  }
  return null;
}

function resolveSupabaseUrl(): string {
  const storedUrl = getValidLocalStorageItem('supabase_url', isValidSupabaseUrl) ||
                    getValidLocalStorageItem('VITE_SUPABASE_URL', isValidSupabaseUrl);
  if (storedUrl) return storedUrl;

  const envUrl = (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_SUPABASE_URL) || 
                 (typeof import.meta !== 'undefined' && (import.meta as any).env?.SUPABASE_URL) || 
                 '';
  if (isValidSupabaseUrl(envUrl)) {
    return String(envUrl).trim().replace(/^["']|["']$/g, '');
  }

  return DEFAULT_SUPABASE_URL;
}

function resolveSupabaseAnonKey(): string {
  const storedKey = getValidLocalStorageItem('supabase_anon_key', isValidSupabaseKey) ||
                    getValidLocalStorageItem('VITE_SUPABASE_ANON_KEY', isValidSupabaseKey) ||
                    getValidLocalStorageItem('supabase_key', isValidSupabaseKey);
  if (storedKey) return storedKey;

  const envKey = (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_SUPABASE_ANON_KEY) || 
                 (typeof import.meta !== 'undefined' && (import.meta as any).env?.SUPABASE_ANON_KEY) || 
                 '';
  if (isValidSupabaseKey(envKey)) {
    return String(envKey).trim().replace(/^["']|["']$/g, '');
  }

  return DEFAULT_SUPABASE_ANON_KEY;
}

export const SUPABASE_URL = resolveSupabaseUrl();
export const SUPABASE_ANON_KEY = resolveSupabaseAnonKey();

console.log('[Supabase Client] Initialized with URL:', SUPABASE_URL, 'Key prefix:', SUPABASE_ANON_KEY.slice(0, 10) + '...');

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
  customer_id?: string;
  technician_id?: string;
  address?: string;
  lat?: number | null;
  lng?: number | null;
  customer_name?: string;
  customer_phone?: string;
  vehicle_name?: string;
  rc_number?: string;
  vehicle_plate?: string;
  description?: string;
  price?: number;
  total_amount?: number;
  payment_status?: string;
  payment_method?: string;
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
    customerId?: string;
    customer_id?: string;
    userId?: string;
    technicianId?: string;
    technician_id?: string;
    address?: string;
    pickupAddress?: string;
    lat?: number | null;
    lng?: number | null;
    customerName?: string;
    customerPhone?: string;
    vehicleName: string;
    rcNumber: string;
    vehiclePlate: string;
    description: string;
    status: string;
    price?: number;
    total_amount?: number;
    totalAmount?: number;
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

  const rawPhone = String(request.customerPhone || request.customer_phone || request.phone || '').replace(/\D/g, '');
  const customerId = rawPhone.length > 0
    ? `cust_${rawPhone.length >= 10 ? rawPhone.slice(-10) : rawPhone.padStart(10, '0')}`
    : (request.customer_id?.startsWith('cust_') ? request.customer_id : (request.customerId?.startsWith('cust_') ? request.customerId : 'cust_0000000000'));

  const technicianId = request.technician_id || request.technicianId || null;
  const address = request.address || request.pickupAddress || '';
  const lat = typeof request.lat === 'number' ? request.lat : (request.lat ? Number(request.lat) : null);
  const lng = typeof request.lng === 'number' ? request.lng : (request.lng ? Number(request.lng) : null);

  const calculatedPrice = isPart && options.partItem?.price
    ? Number(options.partItem.price)
    : (request.price ? Number(request.price) : 0);
  const calculatedTotal = request.total_amount !== undefined && request.total_amount !== null
    ? Number(request.total_amount)
    : (request.totalAmount !== undefined && request.totalAmount !== null ? Number(request.totalAmount) : calculatedPrice);

  const primaryPayload: Record<string, any> = {
    id: orderId,
    service_type: 'MAINTENANCE',
    technician_id: technicianId,
    status: isPart ? 'pending' : (request.status || 'pending'),
    customer_id: customerId,
    address: address,
    lat: lat,
    lng: lng,
    customer_name: request.customerName || 'Customer',
    customer_phone: request.customerPhone || '',
    vehicle_name: request.vehicleName || 'Vehicle',
    rc_number: request.rcNumber || '',
    vehicle_plate: request.vehiclePlate || '',
    description: isPart && options.partItem
      ? `Part Request: ${options.partItem.name} (${options.partItem.sourcing || 'OEM'}) - For ${request.vehicleName || 'Vehicle'}`
      : (request.description || 'Repair Job Card'),
    price: calculatedPrice,
    total_amount: calculatedTotal,
    parts: isPart && options.partItem ? [options.partItem] : (request.parts || []),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  // Rule: Never write payment_status, paid_at or collected_by
  delete primaryPayload.payment_status;
  delete primaryPayload.paid_at;
  delete primaryPayload.collected_by;

  try {
    console.log('[Supabase] Inserting order with service_type: MAINTENANCE into orders table:', primaryPayload);
    const { data, error } = await supabase.from('orders').insert([primaryPayload]).select();

    if (error) {
      console.warn('[Supabase] Full insert encountered an issue, trying minimal fallback schema:', error.message);
      // Fallback in case specific columns don't exist in user's schema
      const fallbackPayload: Record<string, any> = {
        service_type: 'MAINTENANCE',
        status: primaryPayload.status,
        customer_id: customerId,
        address: address,
        lat: lat,
        lng: lng,
        description: primaryPayload.description,
        price: primaryPayload.price,
        total_amount: primaryPayload.total_amount,
        created_at: primaryPayload.created_at,
      };

      delete fallbackPayload.payment_status;
      delete fallbackPayload.paid_at;
      delete fallbackPayload.collected_by;

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
    console.log(`[Supabase] Updating order status to '${newStatus}' for id: ${orderId}`, additionalData);
    const updatePayload: Record<string, any> = {
      status: newStatus,
      updated_at: new Date().toISOString(),
      ...additionalData,
    };

    if (additionalData.total_amount !== undefined && additionalData.total_amount !== null) {
      updatePayload.total_amount = Number(additionalData.total_amount);
    }
    if (additionalData.price !== undefined && additionalData.price !== null) {
      updatePayload.price = Number(additionalData.price);
    }

    // Rule: Never write payment_status, paid_at or collected_by
    delete updatePayload.payment_status;
    delete updatePayload.paid_at;
    delete updatePayload.collected_by;

    const { error } = await supabase
      .from('orders')
      .update(updatePayload)
      .eq('id', orderId);

    if (error) {
      console.warn(`[Supabase] Update status failed with id ${orderId}:`, error.message);
      // Try updating just status, price, total_amount and updated_at
      const simplePayload: Record<string, any> = { status: newStatus };
      if (updatePayload.price !== undefined) simplePayload.price = updatePayload.price;
      if (updatePayload.total_amount !== undefined) simplePayload.total_amount = updatePayload.total_amount;

      const simpleUpdate = await supabase
        .from('orders')
        .update(simplePayload)
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
      const general = await supabase.from('orders').select('*').limit(50);
      return (general.data || []).filter((row: any) => row.service_type === 'MAINTENANCE');
    }

    // Ignore rows where service_type isn't 'MAINTENANCE' (fuel, parts and transport rows are not repair jobs)
    return (data || []).filter((row: any) => row.service_type === 'MAINTENANCE');
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
          // Ignore rows where service_type isn't 'MAINTENANCE' (fuel, parts and transport rows are not repair jobs)
          if (payload.new && payload.new.service_type === 'MAINTENANCE') {
            callbacks.onInsert(payload.new);
          } else {
            console.log('[Supabase Realtime] Ignored non-MAINTENANCE insert:', payload.new?.service_type);
          }
        } else if (payload.eventType === 'UPDATE' && callbacks.onUpdate) {
          // Ignore rows where service_type isn't 'MAINTENANCE' (fuel, parts and transport rows are not repair jobs)
          if (payload.new && (!payload.new.service_type || payload.new.service_type === 'MAINTENANCE')) {
            callbacks.onUpdate(payload.new);
          } else {
            console.log('[Supabase Realtime] Ignored non-MAINTENANCE update:', payload.new?.service_type);
          }
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
