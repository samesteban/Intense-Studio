/**
 * FIFO sequential replay (tasks.md 4.3, SYNC-REQ-3, design.md Sequence A).
 *
 * Replays the offline queue one item at a time, in FIFO order (insert order).
 * For each item it runs the idempotent executor against the injectable client:
 *
 *   success         -> ack ONLY that item (queue.ts per-item remove) — never a
 *                      whole-queue clear (SYNC-REQ-3)
 *   transient fail  -> STOP replay, keep i..N for later retry (SYNC-REQ-3)
 *   fatal (23505/409) -> quarantine: keep the item OUT of acked, surface a
 *                      badge count, and CONTINUE with the next item (design.md
 *                      Sequence A / Q2 resolution) — do NOT stop the rest.
 *
 * The recorded timestamp is used for LWW at the executor layer (SYNC-REQ-4).
 *
 * Pure w.r.t. the client + queue adapters: injected so tests use an in-memory
 * fake queue (no real localStorage) and a fake client (no real Supabase).
 */
import type { OfflineSyncItem } from '../types';
import {
  isFatalReplayError,
  runExecutor,
  type SyncClient,
} from './syncExecutors';

/** Minimal queue adapter — injected so tests avoid real localStorage. */
export interface QueueAdapter {
  /** All pending items in FIFO order (legacy actions already normalized). */
  list(): OfflineSyncItem[];
  /** Remove exactly one item by id (SYNC-REQ-3 per-item ack). */
  ack(id: string): void;
}

export interface ReplayResult {
  acked: OfflineSyncItem[];
  /** Fatal items kept for a quarantine badge (not acked, not deleted). */
  quarantined: OfflineSyncItem[];
  /** True when a transient failure stopped the run with i..N still pending. */
  stoppedOnError: boolean;
  /** The transient error message, when stopped. */
  errorMessage?: string;
}

/**
 * Replay all pending items sequentially. Returns the per-item outcomes; it does
 * NOT mutate the real queue beyond acking — the caller commits state.
 */
export async function replay(
  client: SyncClient,
  queue: QueueAdapter,
): Promise<ReplayResult> {
  const items = queue.list();
  const result: ReplayResult = {
    acked: [],
    quarantined: [],
    stoppedOnError: false,
  };

  for (const item of items) {
    try {
      await runExecutor(client, item);
      queue.ack(item.id);
      result.acked.push(item);
    } catch (err) {
      if (isFatalReplayError(err)) {
        // Quarantine: do NOT ack, do NOT stop the queue (Q2 resolution).
        result.quarantined.push(item);
        continue;
      }
      // Transient failure: stop replay, keep i..N for later retry.
      result.stoppedOnError = true;
      result.errorMessage = err instanceof Error ? err.message : String(err);
      break;
    }
  }

  return result;
}