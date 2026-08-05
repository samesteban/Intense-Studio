/**
 * Unit tests for queue.ts (tasks.md 4.1, SYNC-REQ-1/3, design decision 7, W3).
 *
 * Locks: (1) the queue lives under `gymcontrol_offline_queue_v3` (SYNC-REQ-1);
 * (2) enqueue appends only (never clears); (3) ack/remove delete EXACTLY one
 * item by id (SYNC-REQ-3 — no whole-queue clear); (4) read aliases the legacy
 * `RECORD_PAYMENT` action to `CREATE_PAYMENT` (W3); (5) corrupt storage is safe.
 *
 * Node env: localStorage shimmed in-memory like cache.test.ts.
 */
import { describe, expect, it, beforeEach } from 'vitest';
import {
  QUEUE_KEY,
  ackItem,
  enqueueItem,
  normalizeAction,
  readQueue,
  removeItem,
} from './queue';
import type { OfflineSyncItem } from '../types';

function createMemoryStorage(): Storage {
  const store = new Map<string, string>();
  return {
    get length() {
      return store.size;
    },
    clear: () => store.clear(),
    getItem: (key: string) => store.get(key) ?? null,
    key: (index: number) => Array.from(store.keys())[index] ?? null,
    removeItem: (key: string) => {
      store.delete(key);
    },
    setItem: (key: string, value: string) => {
      store.set(key, value);
    },
  };
}

const base = {
  action: 'CREATE_STUDENT',
  entity: 'Student',
  payload: { id: 'std-1', name: 'Camila' },
} as const;

function item(i: number): OfflineSyncItem {
  return {
    ...base,
    id: `item-${i}`,
    timestamp: '2026-08-05T00:00:00.000Z',
  } as unknown as OfflineSyncItem;
}

beforeEach(() => {
  Object.defineProperty(globalThis, 'localStorage', {
    value: createMemoryStorage(),
    writable: true,
    configurable: true,
  });
});

describe('queue key contract (SYNC-REQ-1)', () => {
  it('uses the preserved legacy key gymcontrol_offline_queue_v3', () => {
    enqueueItem(base);
    const raw = (globalThis as { localStorage: Storage }).localStorage.getItem(
      QUEUE_KEY,
    );
    expect(raw).not.toBeNull();
    expect(QUEUE_KEY).toBe('gymcontrol_offline_queue_v3');
  });

  it('readQueue returns empty when nothing is stored', () => {
    expect(readQueue()).toEqual([]);
  });
});

describe('enqueue (SYNC-REQ-3 — append only, never clear-all)', () => {
  it('appends one item and stamps id + timestamp', () => {
    const added = enqueueItem(base);
    expect(added.id).toMatch(/^queue-/);
    expect(added.timestamp).toBeTruthy();
    expect(readQueue()).toHaveLength(1);
    expect(readQueue()[0]).toMatchObject(base);
  });

  it('appends to an existing queue without dropping earlier items', () => {
    enqueueItem({ ...base, payload: { id: 'a' } });
    enqueueItem({ ...base, payload: { id: 'b' } });
    const q = readQueue();
    expect(q).toHaveLength(2);
    expect(q.map((i) => (i.payload as { id: string }).id)).toEqual(['a', 'b']);
  });

  it('restores the queue after enqueue (survives reload, SYNC-REQ-1)', () => {
    enqueueItem(base);
    // simulate reload: a fresh read returns the persisted item
    const raw = (globalThis as { localStorage: Storage }).localStorage.getItem(
      QUEUE_KEY,
    );
    expect(JSON.parse(raw!)).toHaveLength(1);
  });
});

describe('ack / remove — per-item only (SYNC-REQ-3)', () => {
  it('ack removes exactly the targeted id', () => {
    const a = enqueueItem({ ...base, payload: { id: 'a' } });
    const b = enqueueItem({ ...base, payload: { id: 'b' } });
    const remaining = ackItem(a.id);
    expect(remaining.map((i) => i.id)).toEqual([b.id]);
    expect(readQueue().map((i) => i.id)).toEqual([b.id]);
  });

  it('remove is an alias of ack (per-item)', () => {
    const a = enqueueItem({ ...base, payload: { id: 'a' } });
    const removed = removeItem(a.id);
    expect(removed).toEqual([]);
  });

  it('ack of an unknown id is a safe no-op', () => {
    enqueueItem(base);
    const remaining = ackItem('not-there');
    expect(remaining).toHaveLength(1);
  });

  it('never clears the whole queue in one shot', () => {
    enqueueItem({ ...base, payload: { id: 'a' } });
    enqueueItem({ ...base, payload: { id: 'b' } });
    enqueueItem({ ...base, payload: { id: 'c' } });
    ackItem('item-missing'); // deleting an unrelated id must keep all
    expect(readQueue()).toHaveLength(3);
  });
});

describe('legacy action alias (W3 — RECORD_PAYMENT)', () => {
  it('normalizeAction maps RECORD_PAYMENT -> CREATE_PAYMENT', () => {
    expect(normalizeAction('RECORD_PAYMENT')).toBe('CREATE_PAYMENT');
  });

  it('read aliases stored RECORD_PAYMENT items to CREATE_PAYMENT', () => {
    const legacy = [item(1), { ...item(2), action: 'RECORD_PAYMENT' }];
    (globalThis as { localStorage: Storage }).localStorage.setItem(
      QUEUE_KEY,
      JSON.stringify(legacy),
    );
    const q = readQueue();
    const actions = q.map((i) => i.action);
    expect(actions).toContain('CREATE_PAYMENT');
    expect(actions).not.toContain('RECORD_PAYMENT');
    expect(q).toHaveLength(2);
  });
});

describe('robustness', () => {
  it('falls back to empty queue on corrupted JSON', () => {
    (globalThis as { localStorage: Storage }).localStorage.setItem(
      QUEUE_KEY,
      '{not valid',
    );
    expect(readQueue()).toEqual([]);
  });

  it('does not throw when storage write is unavailable', () => {
    const ls = (globalThis as { localStorage: Storage }).localStorage;
    ls.setItem = () => {
      throw new Error('QuotaExceededError');
    };
    expect(() => enqueueItem(base)).not.toThrow();
    // read falls back to empty when storage read throws
    ls.getItem = () => {
      throw new Error('denied');
    };
    expect(readQueue()).toEqual([]);
  });
});