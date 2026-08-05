/**
 * Idempotent sync executors (tasks.md 4.2, SYNC-REQ-2/4/5, design.md Interfaces).
 *
 * Each mapping action -> executor replays one queue item against an injectable
 * `SyncClient` (a repo-shaped set of table operations). Executors are PURE with
 * respect to the client: they decide WHICH repo method and payload to call, and
 * delegate every Supabase query to the injected client (DAL-REQ-2). Tests pass
 * an in-memory fake client; the DataContext passes the real repositories.
 *
 * Invariants locked here:
 * - CREATE/UPDATE upsert idempotently (`onConflict:id` is the repo contract)
 *   and attach the queue timestamp as `updatedAt` so the `set_updated_at`
 *   guard trigger preserves it — LWW by queue timestamp (SYNC-REQ-4, W1).
 * - DELETE_* treat 0 affected rows as success (SYNC-REQ-5): the repo delete is
 *   a no-op on a missing row, so it never throws for "already applied".
 * - ENROLL/UNENROLL target the composite PK (class, student, day) — the
 *   junction upsert/delete (DB-REQ-2).
 * - Fatal unique violations (receipt dup 23505 / Postgrest 409) surface as a
 *   thrown error tagged `isFatal: true`; the replay loop (sync.ts) reacts by
 *   keeping + exposing the item for the quarantine badge, NOT by deleting it
 *   silently (SYNC-REQ-3, Q2 resolution).
 */
import type {
  AttendanceRecord,
  ClassEnrollment,
  ClassSchedule,
  OfflineSyncItem,
  Payment,
  Student,
  SyncAction,
} from '../types';
import type { UpsertOptions } from './repositories/base';

/** One-line legacy alias (W3): RECORD_PAYMENT -> CREATE_PAYMENT, handled in queue.ts. */

/**
 * Injectable repo-shaped client. Mirrors the operations each executor needs,
 * so the real repositories (or a test fake) both satisfy it.
 */
export interface SyncClient {
  students: {
    upsert(row: Student, opts?: UpsertOptions): Promise<void>;
    remove(id: string): Promise<void>;
  };
  classes: {
    upsert(row: ClassSchedule, opts?: UpsertOptions): Promise<void>;
    remove(id: string): Promise<void>;
  };
  payments: {
    upsert(row: Payment, opts?: UpsertOptions): Promise<void>;
    remove(id: string): Promise<void>;
  };
  attendances: {
    upsert(row: AttendanceRecord, opts?: UpsertOptions): Promise<void>;
    remove(id: string): Promise<void>;
  };
  enrollments: {
    upsert(row: ClassEnrollment, opts?: UpsertOptions): Promise<void>;
    remove(classId: string, studentId: string, dayOfWeek: number): Promise<void>;
  };
}

export type Executor = (client: SyncClient, item: OfflineSyncItem) => Promise<void>;

/** A thrown replay error tagged `isFatal` when it must quarantine, not retry. */
export interface ReplayError extends Error {
  isFatal?: boolean;
}

function payloadOf<T>(item: OfflineSyncItem): T {
  return item.payload as T;
}

/** Errors to quarantine: Postgres 23505 / Postgrest HTTP 409 (Q2 resolution). */
export function isFatalReplayError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  if ((err as Error & { status?: number }).status === 409) return true;
  // Postgrest wraps the 23505 SQLSTATE in the message, e.g.
  // "duplicate key value violates unique constraint ... 23505".
  return /23505|duplicate key|unique constraint/i.test(err.message);
}

/**
 * Execute one queue item against the client, dispatching on its action.
 * Uses item timestamps for LWW on upserts and treats remove-as-success.
 */
export const executors: Record<SyncAction, Executor> = {
  CREATE_STUDENT: (c, item) =>
    c.students.upsert(payloadOf<Student>(item), { updatedAt: item.timestamp }),
  UPDATE_STUDENT: (c, item) =>
    c.students.upsert(payloadOf<Student>(item), { updatedAt: item.timestamp }),
  DELETE_STUDENT: (c, item) =>
    c.students.remove((item.payload as { id: string }).id),
  CREATE_PAYMENT: (c, item) =>
    c.payments.upsert(payloadOf<Payment>(item), { updatedAt: item.timestamp }),
  UPDATE_PAYMENT: (c, item) =>
    c.payments.upsert(payloadOf<Payment>(item), { updatedAt: item.timestamp }),
  DELETE_PAYMENT: (c, item) =>
    c.payments.remove((item.payload as { id: string }).id),
  CREATE_CLASS: (c, item) =>
    c.classes.upsert(payloadOf<ClassSchedule>(item), { updatedAt: item.timestamp }),
  UPDATE_CLASS: (c, item) =>
    c.classes.upsert(payloadOf<ClassSchedule>(item), { updatedAt: item.timestamp }),
  DELETE_CLASS: (c, item) => c.classes.remove((item.payload as { id: string }).id),
  RECORD_ATTENDANCE: (c, item) =>
    c.attendances.upsert(payloadOf<AttendanceRecord>(item), {
      updatedAt: item.timestamp,
    }),
  ENROLL_STUDENT: (c, item) =>
    c.enrollments.upsert(payloadOf<ClassEnrollment>(item), {
      updatedAt: item.timestamp,
    }),
  UNENROLL_STUDENT: (c, item) => {
    const enr = payloadOf<ClassEnrollment>(item);
    return c.enrollments.remove(enr.classId, enr.studentId, enr.dayOfWeek);
  },
  DELETE_ATTENDANCE: (c, item) =>
    c.attendances.remove((item.payload as { id: string }).id),
};

/**
 * Run a single item. Repo failures propagate: unique-violation / 409 errors are
 * re-thrown tagged `isFatal` (quarantine, Q2) — everything else stays transient
 * so the replay loop stops and retries later (SYNC-REQ-3).
 */
export async function runExecutor(
  client: SyncClient,
  item: OfflineSyncItem,
): Promise<void> {
  const run = executors[item.action];
  if (!run) throw new Error(`no executor for action ${item.action}`);
  try {
    await run(client, item);
  } catch (err) {
    if (isFatalReplayError(err)) {
      const wrapped = new Error(
        `${item.action} failed: ${err instanceof Error ? err.message : String(err)}`,
      ) as ReplayError;
      wrapped.isFatal = true;
      throw wrapped;
    }
    throw err;
  }
}