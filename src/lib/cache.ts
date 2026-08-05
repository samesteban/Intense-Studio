/**
 * Cache-first read/write layer over localStorage (DAL-REQ-3, DAL-REQ-7).
 *
 * localStorage is a READ CACHE only, never the source of truth. The
 * DataProvider renders the cached snapshot immediately on boot, then refreshes
 * from Supabase in the background and overwrites the cache with the fetched
 * rows (cache-first first paint / empty-cache fall-through).
 *
 * Keys live under the `gymcontrol_cache_*` namespace (design decision 7). The
 * legacy `gymcontrol_*_v3` keys are deliberately untouched — rollback stays
 * intact and the old demo seed never flashes while the app boots into real data.
 *
 * Writes are best-effort: quota or private-mode failures are non-fatal because
 * the cache is only a fast path; the backing store is Supabase. Derived finance
 * fields are never written here — the DataProvider only ever caches the clean
 * persisted entities (DAL-REQ-6).
 */
import type {
  AttendanceRecord,
  ClassEnrollment,
  ClassSchedule,
  Payment,
  Student,
} from '../types';

const CACHE_PREFIX = 'gymcontrol_cache_';

/** Cache key per entity. Legacy `*_v3` keys are NOT reused (design decision 7). */
export const CACHE_KEYS = {
  students: `${CACHE_PREFIX}students`,
  classes: `${CACHE_PREFIX}classes`,
  payments: `${CACHE_PREFIX}payments`,
  attendances: `${CACHE_PREFIX}attendances`,
  enrollments: `${CACHE_PREFIX}enrollments`,
} as const;

export type CacheEntity = keyof typeof CACHE_KEYS;

/** All entities, for the DataProvider's cache-first boot snapshot. */
export interface CacheSnapshot {
  students: Student[];
  classes: ClassSchedule[];
  payments: Payment[];
  attendances: AttendanceRecord[];
  enrollments: ClassEnrollment[];
}

function readRaw(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null; // storage unavailable (private mode / disabled) → empty cache
  }
}

/** Safe JSON parse: corrupted or missing rows fall back to null (empty cache). */
function parseRows<T>(raw: string | null): T[] | null {
  if (raw === null) return null;
  try {
    const value: unknown = JSON.parse(raw);
    return Array.isArray(value) ? (value as T[]) : null;
  } catch {
    return null;
  }
}

/**
 * Read a cached entity. Returns `null` when nothing is cached (or the entry is
 * corrupt), so the provider can distinguish "render snapshot" from "wait for
 * the fetch" (DAL-REQ-3 empty-cache falls through).
 */
export function readCache<T>(entity: CacheEntity): T[] | null {
  return parseRows<T>(readRaw(CACHE_KEYS[entity]));
}

/** Write after a successful Supabase fetch or an optimistic mutation. */
export function writeCache<T>(entity: CacheEntity, rows: T[]): void {
  try {
    localStorage.setItem(CACHE_KEYS[entity], JSON.stringify(rows));
  } catch {
    // Quota / private-mode failure: non-fatal, cache is a fast path only.
  }
}

/** Remove a single cached entity (e.g. keep cache-but-drop after a reset). */
export function removeCache(entity: CacheEntity): void {
  try {
    localStorage.removeItem(CACHE_KEYS[entity]);
  } catch {
    // ignore
  }
}

/** Boot snapshot: every entity's cached rows (empty array when never cached). */
export function readCacheSnapshot(): CacheSnapshot {
  return {
    students: readCache<Student>('students') ?? [],
    classes: readCache<ClassSchedule>('classes') ?? [],
    payments: readCache<Payment>('payments') ?? [],
    attendances: readCache<AttendanceRecord>('attendances') ?? [],
    enrollments: readCache<ClassEnrollment>('enrollments') ?? [],
  };
}

/** Persist the full snapshot after a successful all-entity fetch. */
export function writeCacheSnapshot(snapshot: CacheSnapshot): void {
  writeCache('students', snapshot.students);
  writeCache('classes', snapshot.classes);
  writeCache('payments', snapshot.payments);
  writeCache('attendances', snapshot.attendances);
  writeCache('enrollments', snapshot.enrollments);
}