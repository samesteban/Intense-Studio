/**
 * Unit tests for syncExecutors.ts (tasks.md 4.2, SYNC-REQ-2/4/5, design.md,
 * Q2 resolution). Uses an in-memory fake client — never a real Supabase project.
 *
 * Locks: LWW via updatedAt (SYNC-REQ-4); idempotent upsert by onConflict id;
 * deletes treat 0-rows as success (SYNC-REQ-5); composite-key ENROLL/UNENROLL
 * (DB-REQ-2); DELETE_ATTENDANCE by id; fatal 23505/409 -> tagged isFatal
 * (quarantine signal), transient errors stay untagged.
 */
import { describe, expect, it } from 'vitest';
import {
  executors,
  isFatalReplayError,
  runExecutor,
  type SyncClient,
} from './syncExecutors';
import type { OfflineSyncItem, Student } from '../types';

/** In-memory fake client recording every write for assertions. */
function createFakeClient(): SyncClient & { calls: unknown[][]; store: Record<string, unknown[]> } {
  const calls: unknown[][] = [];
  // Store per table: key -> array of rows (id => row map used for upsert).
  const tables: Record<string, Map<string, unknown>> = {
    students: new Map(),
    classes: new Map(),
    payments: new Map(),
    attendances: new Map(),
    attendance: new Map(), // DELETE_ATTENDANCE executor targets table 'attendance'
    enrollments: new Map(),
  };
  const store: Record<string, unknown[]> = {
    students: [],
    classes: [],
    payments: [],
    attendances: [],
    attendance: [],
    enrollments: [],
  };
  const sync = (key: string) =>
    (store[key as keyof typeof store] = Array.from(tables[key].values()));

  const upsert = (table: string) => (row: unknown, opts?: { updatedAt?: string }) => {
    calls.push([`${table}.upsert`, row, opts]);
    const id = (row as { id: string }).id;
    tables[table].set(id, row);
    sync(table);
    return Promise.resolve();
  };
  const enrollUpsert = (row: unknown, opts?: { updatedAt?: string }) => {
    calls.push(['enrollments.upsert', row, opts]);
    const enr = row as { classId: string; studentId: string; dayOfWeek: number };
    tables.enrollments.set(
      [enr.classId, enr.studentId, enr.dayOfWeek].join('|'),
      enr,
    );
    sync('enrollments');
    return Promise.resolve();
  };
  const remove = (table: string) => (id: string) => {
    calls.push([`${table}.remove`, id, undefined]);
    tables[table].delete(id); // 0 affected rows when absent — success (SYNC-REQ-5)
    sync(table);
    return Promise.resolve();
  };
  const enrollRemove = (classId: string, studentId: string, dayOfWeek: number) => {
    calls.push(['enrollments.remove', { classId, studentId, dayOfWeek }, undefined]);
    tables.enrollments.delete([classId, studentId, dayOfWeek].join('|'));
    sync('enrollments');
    return Promise.resolve();
  };
  const enrollPrune = (classId: string, allowedDays: number[]) => {
    calls.push(['enrollments.pruneDays', { classId, allowedDays }, undefined]);
    for (const [key, row] of Array.from(tables.enrollments.entries())) {
      const enr = row as { classId: string; dayOfWeek: number };
      if (enr.classId === classId && !allowedDays.includes(enr.dayOfWeek)) {
        tables.enrollments.delete(key);
      }
    }
    sync('enrollments');
    return Promise.resolve();
  };

  const client: SyncClient = {
    students: { upsert: upsert('students'), remove: remove('students') },
    classes: { upsert: upsert('classes'), remove: remove('classes') },
    payments: { upsert: upsert('payments'), remove: remove('payments') },
    attendances: { upsert: upsert('attendances'), remove: remove('attendance') },
    enrollments: { upsert: enrollUpsert, remove: enrollRemove, pruneDays: enrollPrune },
  };
  return { ...client, calls, store };
}

function item(overrides: Partial<OfflineSyncItem>): OfflineSyncItem {
  const defaultPayload: Student = {
    id: 'std-1',
    name: 'Camila',
    phone: '+5691',
    registrationDate: '2026-06-15',
    active: true,
  };
  return {
    id: 'q-1',
    action: 'CREATE_STUDENT',
    entity: 'Student',
    payload: defaultPayload,
    timestamp: '2026-08-05T12:00:00.000Z',
    ...overrides,
  };
}

describe('LWW upsert (SYNC-REQ-4)', () => {
  it('CREATE_STUDENT upserts with updatedAt = queue timestamp', async () => {
    const c = createFakeClient();
    const i = item({ action: 'CREATE_STUDENT', timestamp: '2026-07-01T00:00:00.000Z' });
    await runExecutor(c, i);
    const [table, row, opts] = c.calls[0] as [
      string,
      Student,
      { updatedAt?: string },
    ];
    expect(table).toBe('students.upsert');
    expect(opts?.updatedAt).toBe('2026-07-01T00:00:00.000Z');
    expect(row).toMatchObject({ id: 'std-1', name: 'Camila' });
  });

  it('UPDATE_STUDENT and UPDATE_PAYMENT also carry updatedAt (LWW)', async () => {
    const c = createFakeClient();
    await runExecutor(c, item({ action: 'UPDATE_STUDENT', timestamp: '2026-07-02T00:00:00Z' }));
    await runExecutor(c, item({ action: 'UPDATE_PAYMENT', timestamp: '2026-07-03T00:00:00Z' }));
    const [sTable, , sOpts] = c.calls[0] as [string, unknown, { updatedAt?: string }];
    const [, , pOpts] = c.calls[1] as [string, unknown, { updatedAt?: string }];
    expect(sTable).toBe('students.upsert');
    expect(sOpts?.updatedAt).toBe('2026-07-02T00:00:00Z');
    expect(pOpts?.updatedAt).toBe('2026-07-03T00:00:00Z');
  });
});

describe('idempotent upsert by onConflict id (SYNC-REQ-4)', () => {
  it('replaying the same CREATE_PAYMENT does not create a duplicate row', async () => {
    const c = createFakeClient();
    const p = item({
      action: 'CREATE_PAYMENT',
      payload: {
        id: 'pay-1',
        studentId: 'std-1',
        studentName: 'Camila',
        amount: 1000,
        paymentMethod: 'efectivo',
        paymentDate: '2026-08-01',
        receiptNumber: 'REC-1',
      },
      timestamp: '2026-07-04T00:00:00Z',
    });
    // First replay inserts, second replay upserts the same id (no dup row).
    await runExecutor(c, p);
    await runExecutor(c, p);
    expect(c.store.payments).toHaveLength(1);
  });
});

describe('deletes apply idempotently — 0 rows = success (SYNC-REQ-5)', () => {
  it('DELETE_STUDENT removes the id and succeeds', async () => {
    const c = createFakeClient();
    await runExecutor(c, item({ action: 'DELETE_STUDENT', payload: { id: 'std-9' } }));
    expect(c.calls[0]?.[0]).toBe('students.remove');
    expect(c.calls[0]?.[1]).toBe('std-9');
  });

  it('replaying a delete for an already-missing row resolves (no throw)', async () => {
    const c = createFakeClient();
    // No student 'std-1' seeded in fake store — delete must still succeed.
    await expect(
      runExecutor(c, item({ action: 'DELETE_STUDENT', payload: { id: 'std-1' } })),
    ).resolves.toBeUndefined();
  });
});

describe('composite-key junction ENROLL/UNENROLL (DB-REQ-2)', () => {
  it('ENROLL_STUDENT writes a junction row via enrollments.upsert', async () => {
    const c = createFakeClient();
    const enr = { classId: 'class-1', studentId: 'std-1', dayOfWeek: 3 };
    await runExecutor(c, item({ action: 'ENROLL_STUDENT', payload: enr, timestamp: '2026-07-05T00:00:00Z' }));
    const [table, row, opts] = c.calls[0] as [string, typeof enr, { updatedAt?: string }];
    expect(table).toBe('enrollments.upsert');
    expect(row).toEqual(enr);
    expect(opts?.updatedAt).toBe('2026-07-05T00:00:00Z');
  });

  it('UNENROLL_STUDENT removes on the composite key', async () => {
    const c = createFakeClient();
    await runExecutor(
      c,
      item({
        action: 'UNENROLL_STUDENT',
        payload: { classId: 'class-1', studentId: 'std-2', dayOfWeek: 5 },
      }),
    );
    const [table, key] = c.calls[0] as [string, { classId: string; studentId: string; dayOfWeek: number }];
    expect(table).toBe('enrollments.remove');
    expect(key).toEqual({ classId: 'class-1', studentId: 'std-2', dayOfWeek: 5 });
  });

  it('UNENROLL_STUDENT of a non-existent junction row is a no-op success', async () => {
    const c = createFakeClient();
    await expect(
      runExecutor(
        c,
        item({
          action: 'UNENROLL_STUDENT',
          payload: { classId: 'missing', studentId: 'std-3', dayOfWeek: 1 },
        }),
      ),
    ).resolves.toBeUndefined();
  });
});

describe('DELETE_ATTENDANCE by id (Q1 resolution)', () => {
  it('removes the attendance row by id', async () => {
    const c = createFakeClient();
    await runExecutor(c, item({ action: 'DELETE_ATTENDANCE', payload: { id: 'att-7' } }));
    expect(c.calls[0]?.[0]).toBe('attendance.remove');
    expect(c.calls[0]?.[1]).toBe('att-7');
  });

  it('deleting an already-absent attendance row is success', async () => {
    const c = createFakeClient();
    await expect(
      runExecutor(c, item({ action: 'DELETE_ATTENDANCE', payload: { id: 'att-nope' } })),
    ).resolves.toBeUndefined();
  });
});

describe('UPDATE_CLASS prunes junction rows for removed days (Q3)', () => {
  it('calls enrollments.pruneDays with the new days_of_week after the upsert', async () => {
    const c = createFakeClient();
    const cls = {
      id: 'class-1',
      name: 'CrossFit',
      startTime: '08:00',
      endTime: '09:00',
      daysOfWeek: [1, 5], // day 3 was removed
      maxCapacity: 15,
      color: '#84cc16',
    };
    await runExecutor(c, item({ action: 'UPDATE_CLASS', payload: cls, timestamp: '2026-07-06T00:00:00Z' }));
    expect(c.calls[0]?.[0]).toBe('classes.upsert');
    const [table, prune] = c.calls[1] as [string, { classId: string; allowedDays: number[] }];
    expect(table).toBe('enrollments.pruneDays');
    expect(prune).toEqual({ classId: 'class-1', allowedDays: [1, 5] });
  });
});

describe('fatal vs transient classification (Q2)', () => {
  it('isFatalReplayError matches 23505 / 23503 / duplicate / unique / FK / 409', () => {
    expect(isFatalReplayError(new Error('duplicate key value violates unique constraint "payments_receipt_number_key" (23505)'))).toBe(true);
    expect(isFatalReplayError(new Error('insert or update on table "payments" violates foreign key constraint "payments_student_id_fkey" (23503)'))).toBe(true);
    expect(isFatalReplayError(Object.assign(new Error('Conflict'), { status: 409 }))).toBe(true);
    expect(isFatalReplayError(new Error('fetch failed (network down)'))).toBe(false);
    expect(isFatalReplayError(new Error('students.list failed'))).toBe(false);
  });

  it('runExecutor 409 wrapper preserves status for downstream classification (F1)', async () => {
    const c = createFakeClient();
    c.payments.upsert = () => {
      const err = new Error('Conflict') as Error & { status: number };
      err.status = 409;
      return Promise.reject(err);
    };
    await expect(
      runExecutor(
        c,
        item({ action: 'CREATE_PAYMENT' }),
      ),
    ).rejects.toSatisfy((e) => isFatalReplayError(e));
  });

  it('runExecutor rethrows 23505 wrapped as isFatal', async () => {
    const c = createFakeClient();
    // Force the payment upsert to reject with a unique violation.
    c.payments.upsert = () =>
      Promise.reject(
        new Error('duplicate key value violates unique constraint "payments_receipt_number_key" (23505)'),
      );
    await expect(
      runExecutor(
        c,
        item({
          action: 'CREATE_PAYMENT',
          payload: {
            id: 'pay-dup',
            studentId: 'std-1',
            studentName: 'Camila',
            amount: 1000,
            paymentMethod: 'efectivo',
            paymentDate: '2026-08-01',
            receiptNumber: 'REC-DUP',
          },
        }),
      ),
    ).rejects.toSatisfy((e) => isFatalReplayError(e));
  });

  it('runExecutor leaves a transient failure untagged (retry later)', async () => {
    const c = createFakeClient();
    c.students.upsert = () => Promise.reject(new Error('network request failed'));
    await expect(
      runExecutor(c, item({ action: 'UPDATE_STUDENT' })),
    ).rejects.not.toSatisfy((e) => isFatalReplayError(e));
  });
});