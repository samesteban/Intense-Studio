/**
 * Unit tests for sync.ts FIFO replay (tasks.md 4.3, SYNC-REQ-3, design
 * Sequence A, Q2). In-memory fake client + fake queue adapter — no real
 * localStorage or Supabase.
 *
 * Locks the SYNC-REQ-3 acceptance scenarios: all-success drains; a single
 * failing item preserves the rest; fatal items quarantine without stopping the
 * run; success acks ONLY the applied item (never a whole-queue clear).
 */
import { describe, expect, it } from 'vitest';
import { replay, type QueueAdapter } from './sync';
import { type SyncClient } from './syncExecutors';
import type { OfflineSyncItem, Student } from '../types';

/** Items A, B, C — the SYNC-REQ-3 acceptance trio. */
function trio(): OfflineSyncItem[] {
  const mk = (n: number): OfflineSyncItem => ({
    id: ['A', 'B', 'C'][n - 1],
    action: 'CREATE_STUDENT',
    entity: 'Student',
    payload: {
      id: ['std-a', 'std-b', 'std-c'][n - 1],
      name: ['A', 'B', 'C'][n - 1],
      phone: '+5690',
      registrationDate: '2026-06-01',
      active: true,
    } as Student,
    timestamp: `2026-08-0${n}T00:00:00.000Z`,
  });
  return [mk(1), mk(2), mk(3)];
}

/** In-memory queue adapter mirroring queue.ts per-item ack. */
function makeQueue(
  initial: OfflineSyncItem[],
): QueueAdapter & { remaining(): OfflineSyncItem[] } {
  const items = [...initial];
  return {
    list: () => [...items],
    ack: (id) => {
      const idx = items.findIndex((i) => i.id === id);
      if (idx >= 0) items.splice(idx, 1);
    },
    remaining: () => [...items],
  };
}

/** A fake client. `failTransient` ids reject with a generic error (non-fatal). */
function fakeClient(failTransient: Set<string> = new Set()): SyncClient {
  const studentUpsert = (row: Student) => {
    if (failTransient.has(row.id)) {
      return Promise.reject(new Error('transient network'));
    }
    return Promise.resolve();
  };
  const removeOk = () => Promise.resolve();
  const upsertOk = () => Promise.resolve();
  const enrollUpsert = () => Promise.resolve();
  const enrollRemove = () => Promise.resolve();
  return {
    students: { upsert: studentUpsert, remove: removeOk },
    classes: { upsert: upsertOk, remove: removeOk },
    payments: { upsert: upsertOk, remove: removeOk },
    attendances: { upsert: upsertOk, remove: removeOk },
    enrollments: { upsert: enrollUpsert, remove: enrollRemove },
  };
}

describe('FIFO sequential replay (SYNC-REQ-3)', () => {
  it('all items succeed -> each acked individually, queue ends empty', async () => {
    const items = trio();
    const q = makeQueue(items);
    const result = await replay(fakeClient(), q);

    expect(result.acked.length).toBe(3);
    expect(result.acked.map((i) => i.id)).toEqual(['A', 'B', 'C']);
    expect(result.quarantined).toEqual([]);
    expect(result.stoppedOnError).toBe(false);
    expect(q.remaining()).toEqual([]);
  });

  it('single failure at B stops replay, preserving B and C (no whole-queue clear)', async () => {
    const items = trio();
    const q = makeQueue(items);
    const result = await replay(fakeClient(new Set(['std-b'])), q);

    expect(result.acked.map((i) => i.id)).toEqual(['A']);
    expect(result.stoppedOnError).toBe(true);
    expect(result.quarantined).toEqual([]);
    // A acked (removed); B and C remain for retry.
    expect(q.remaining().map((i) => i.id)).toEqual(['B', 'C']);
  });

  it('success acks ONLY the applied item — never a whole-queue clear', async () => {
    const items = trio();
    const q = makeQueue(items);
    await replay(fakeClient(new Set(['std-b'])), q);

    // Exactly one item was removed (A). B and C are untouched.
    expect(q.remaining().map((i) => i.id)).toEqual(['B', 'C']);
  });

  it('fatal item (23505) quarantines and CONTINUES; a later transient stops', async () => {
    const items = trio();
    // B becomes a CREATE_PAYMENT with a duplicate receipt -> fatal on replay.
    items[1] = {
      ...items[1],
      id: 'B',
      action: 'CREATE_PAYMENT',
      entity: 'Payment',
      payload: {
        id: 'pay-dup',
        studentId: 'std-1',
        studentName: 'X',
        amount: 1000,
        paymentMethod: 'efectivo',
        paymentDate: '2026-08-01',
        receiptNumber: 'REC-DUP',
      },
    };
    // C still transient-fails for its student id.
    const q = makeQueue(items);
    const client = fakeClient(new Set(['std-c']));
    // Force the payment upsert to throw a fatal 23505-like error.
    client.payments.upsert = () =>
      Promise.reject(
        new Error('duplicate key value violates unique constraint "payments_receipt_number_key" (23505)'),
      );

    const result = await replay(client, q);

    // A acked. B fatal -> quarantined (kept, NOT acked, queue NOT stopped).
    expect(result.acked.map((i) => i.id)).toEqual(['A']);
    expect(result.quarantined.map((i) => i.id)).toEqual(['B']);
    // C transient -> stop (not acked).
    expect(result.stoppedOnError).toBe(true);
    // B was NOT deleted (quarantine keeps it); C remains for retry.
    const remaining = q.remaining().map((i) => i.id);
    expect(remaining).toContain('B');
    expect(remaining).toContain('C');
  });
});