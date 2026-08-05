/**
 * Unit tests for cache.ts (tasks.md 3.5, DAL-REQ-3, DAL-REQ-7, design decision 7).
 *
 * Locks: (1) reads/writes live under `gymcontrol_cache_*`; (2) legacy `*_v3`
 * keys are never touched; (3) corrupt/missing entries fall through to null;
 * (4) writes are best-effort (never throw on storage failures).
 *
 * Node env: localStorage is shimmed with a tiny in-memory store for the tests.
 */
import { describe, expect, it, beforeEach } from 'vitest';
import {
  CACHE_KEYS,
  readCache,
  readCacheSnapshot,
  removeCache,
  writeCache,
  writeCacheSnapshot,
} from './cache';
import type { Student } from '../types';

/** Minimal in-memory localStorage shim (keeps tests deterministic). */
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

const student: Student = {
  id: 'std-1',
  name: 'Camila Muñoz',
  phone: '+56911111111',
  registrationDate: '2026-06-15',
  active: true,
};

beforeEach(() => {
  Object.defineProperty(globalThis, 'localStorage', {
    value: createMemoryStorage(),
    writable: true,
    configurable: true,
  });
});

describe('cache read/write', () => {
  it('returns null when nothing is cached (empty cache falls through)', () => {
    expect(readCache<Student>('students')).toBeNull();
  });

  it('round-trips a cached entity under the gymcontrol_cache_* key', () => {
    writeCache('students', [student]);

    expect(readCache<Student>('students')).toEqual([student]);
    // Key contract (design decision 7): gymcontrol_cache_students
    const raw = (globalThis as { localStorage: Storage }).localStorage.getItem(
      CACHE_KEYS.students,
    );
    expect(raw).not.toBeNull();
    expect(JSON.parse(raw!)).toEqual([student]);
  });

  it('never touches legacy *_v3 keys (design decision 7)', () => {
    writeCache('students', [student]);

    const raw = (globalThis as { localStorage: Storage }).localStorage.getItem(
      'gymcontrol_students_v3',
    );
    expect(raw).toBeNull();
  });

  it('falls through to null on corrupted JSON', () => {
    (globalThis as { localStorage: Storage }).localStorage.setItem(
      CACHE_KEYS.students,
      '{not valid json',
    );
    expect(readCache<Student>('students')).toBeNull();
  });

  it('readCacheSnapshot returns empty arrays when nothing cached', () => {
    const snap = readCacheSnapshot();
    expect(snap.students).toEqual([]);
    expect(snap.classes).toEqual([]);
    expect(snap.enrollments).toEqual([]);
  });

  it('writeSnapshot then readSnapshot round-trips all entities', () => {
    writeCacheSnapshot({
      students: [student],
      classes: [],
      payments: [],
      attendances: [],
      enrollments: [],
    });

    const snap = readCacheSnapshot();
    expect(snap.students).toEqual([student]);
  });

  it('removeCache drops only the targeted entity', () => {
    writeCache('students', [student]);
    writeCache('classes', []);
    removeCache('students');

    expect(readCache<Student>('students')).toBeNull();
    expect(readCache('classes')).toEqual([]);
  });

  it('does not throw when storage is unavailable', () => {
    (globalThis as { localStorage: Storage }).localStorage.setItem = (
      _k: string,
      _v: string,
    ) => {
      throw new Error('QuotaExceededError');
    };
    expect(() => writeCache('students', [student])).not.toThrow();
  });
});