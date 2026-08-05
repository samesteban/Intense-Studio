/**
 * Offline action queue (tasks.md 4.1, SYNC-REQ-1/3, design decision 7).
 *
 * Lives in localStorage under the existing legacy key
 * `gymcontrol_offline_queue_v3` (preserved contract — rollback-safe). Each item
 * carries `id`, `action`, `entity`, `payload`, `timestamp`.
 *
 * Queue operations are PER-ITEM only (SYNC-REQ-3): enqueue appends one item,
 * ack/remove delete the targeted id, and the queue is NEVER cleared all at
 * once — the FIFO replay acknowledges the one item it just applied, so a crash
 * mid-replay cannot silently drop the rest.
 *
 * Read normalizes out-of-band items (W3 / PR3a review): the legacy action
 * `RECORD_PAYMENT` was renamed to `CREATE_PAYMENT` in PR3a. Deployed browsers
 * may still hold `RECORD_PAYMENT` items in the queue; they are aliased to
 * `CREATE_PAYMENT` at read time so replay does not silently lose them.
 */
import type { OfflineSyncItem, SyncAction } from '../types';

/** Existing queue key — MUST NOT change (SYNC-REQ-1, W3). */
export const QUEUE_KEY = 'gymcontrol_offline_queue_v3';

/** Legacy action alias: PR3a renamed RECORD_PAYMENT -> CREATE_PAYMENT (W3). */
export function normalizeAction(action: string): SyncAction {
  return action === 'RECORD_PAYMENT' ? 'CREATE_PAYMENT' : (action as SyncAction);
}

function readRaw(): string | null {
  try {
    return globalThis.localStorage.getItem(QUEUE_KEY);
  } catch {
    return null; // storage unavailable -> empty queue
  }
}

/**
 * Read the queue. Legacy `RECORD_PAYMENT` actions are aliased at read time
 * (W3). Corrupt/missing entries fall back to an empty queue.
 */
export function readQueue(): OfflineSyncItem[] {
  const raw = readRaw();
  if (raw === null) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return (parsed as OfflineSyncItem[]).map((item) => ({
      ...item,
      action: normalizeAction(item.action),
    }));
  } catch {
    return [];
  }
}

/**
 * Persist the queue. Returns false when localStorage is unavailable (quota /
 * private mode) so callers can decide: enqueue surfaces the failure to the
 * in-memory fallback; ack tolerates it (a missing ack just replays again).
 */
function writeRaw(items: OfflineSyncItem[]): boolean {
  try {
    globalThis.localStorage.setItem(QUEUE_KEY, JSON.stringify(items));
    return true;
  } catch {
    return false; // Quota / private-mode failure: caller decides.
  }
}

/**
 * Generate a client-side item id + timestamp, matching the legacy queue shape.
 */
export function nextQueueId(): string {
  return `queue-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
}

/** Append one item to the queue (never clears existing items). */
export function enqueueItem(
  item: Omit<OfflineSyncItem, 'id' | 'timestamp'>,
): OfflineSyncItem {
  const queue = readQueue();
  const full: OfflineSyncItem = {
    ...item,
    id: nextQueueId(),
    timestamp: new Date().toISOString(),
  };
  const persisted = writeRaw([...queue, full]);
  if (!persisted) {
    // Surface the storage failure so callers can fall back to in-memory state
    // (DataContext.enqueueItem catch) instead of silently dropping the item.
    throw new Error('queue write failed: localStorage unavailable');
  }
  return full;
}

/**
 * Remove exactly one item by id. No-op when the id is absent. NEVER clears the
 * whole queue (SYNC-REQ-3).
 */
export function ackItem(id: string): OfflineSyncItem[] {
  const remaining = readQueue().filter((item) => item.id !== id);
  writeRaw(remaining);
  return remaining;
}

/** Alias for ackItem — same per-item semantics (`remove` is ack's public name). */
export function removeItem(id: string): OfflineSyncItem[] {
  return ackItem(id);
}