import { RepairRequest, PartPreference } from '../types';
import { saveOrderToSupabase, updateOrderStatusInSupabase } from './supabase';

const CACHE_KEY_REPAIRS = 'fugo_cached_repair_orders_v1';
const OUTBOX_KEY = 'fugo_offline_repair_outbox_v1';

export interface OfflineAction {
  id: string;
  type: 'CREATE_JOB' | 'UPDATE_STATUS' | 'CREATE_PART_REQUEST';
  payload: any;
  timestamp: number;
  retryCount: number;
}

/**
 * Persists the entire set of repair requests to local storage for instant offline access.
 */
export function cacheRepairRequestsLocally(requests: RepairRequest[]): void {
  try {
    localStorage.setItem(CACHE_KEY_REPAIRS, JSON.stringify(requests));
  } catch (err) {
    console.warn('[OfflineCache] Failed to cache repair requests locally:', err);
  }
}

/**
 * Retrieves cached repair requests when network is unavailable.
 */
export function getCachedRepairRequests(): RepairRequest[] {
  try {
    const raw = localStorage.getItem(CACHE_KEY_REPAIRS);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch (err) {
    console.warn('[OfflineCache] Failed to parse cached repair requests:', err);
    return [];
  }
}

/**
 * Returns pending offline actions waiting to sync back to Supabase.
 */
export function getOfflineOutbox(): OfflineAction[] {
  try {
    const raw = localStorage.getItem(OUTBOX_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch (err) {
    console.warn('[OfflineCache] Failed to load offline outbox:', err);
    return [];
  }
}

/**
 * Queues an action into the offline outbox.
 */
export function queueOfflineAction(action: Omit<OfflineAction, 'id' | 'timestamp' | 'retryCount'>): void {
  try {
    const current = getOfflineOutbox();
    const newAction: OfflineAction = {
      ...action,
      id: `offline_act_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      timestamp: Date.now(),
      retryCount: 0,
    };
    current.push(newAction);
    localStorage.setItem(OUTBOX_KEY, JSON.stringify(current));
    console.log('[OfflineOutbox] Queued offline action:', newAction);
  } catch (err) {
    console.error('[OfflineOutbox] Error queueing action:', err);
  }
}

/**
 * Attempts to flush all queued offline actions to Supabase when connectivity restores.
 */
export async function flushOfflineOutbox(
  onProgress?: (syncedCount: number, remainingCount: number) => void
): Promise<{ success: number; failed: number }> {
  const queue = getOfflineOutbox();
  if (queue.length === 0) return { success: 0, failed: 0 };

  console.log(`[OfflineOutbox] Flushing ${queue.length} pending actions to Supabase...`);
  const remaining: OfflineAction[] = [];
  let successCount = 0;

  for (const item of queue) {
    try {
      if (item.type === 'CREATE_JOB') {
        await saveOrderToSupabase(item.payload);
        successCount++;
      } else if (item.type === 'UPDATE_STATUS') {
        const { requestId, status, extraFields } = item.payload;
        await updateOrderStatusInSupabase(requestId, status, extraFields);
        successCount++;
      } else if (item.type === 'CREATE_PART_REQUEST') {
        const { request, part } = item.payload;
        await saveOrderToSupabase(request, {
          isPartRequest: true,
          partItem: part
        });
        successCount++;
      }
    } catch (err) {
      console.error(`[OfflineOutbox] Failed to sync action ${item.id}:`, err);
      item.retryCount += 1;
      remaining.push(item);
    }

    if (onProgress) {
      onProgress(successCount, remaining.length);
    }
  }

  localStorage.setItem(OUTBOX_KEY, JSON.stringify(remaining));
  return { success: successCount, failed: remaining.length };
}

/**
 * Clears the offline outbox
 */
export function clearOfflineOutbox(): void {
  localStorage.removeItem(OUTBOX_KEY);
}
