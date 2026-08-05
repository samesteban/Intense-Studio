/**
 * Unit tests for reconcile.ts (tasks.md 4.4, DAL-REQ-3, SYNC-REQ-4, DB-REQ-2;
 * Q3 resolution prune). Pure functions — in-memory data only.
 *
 * Locks: remote ∪ queuedById merge where queued CREATE/UPDATE wins (SYNC-REQ-4)
 * and queued DELETE/UNENROLL excludes the row; composite-key enrollment merge;
 * staleEnrollments prune for days removed from days_of_week on class UPDATE.
 */
import { describe, expect, it } from 'vitest';
import {
  reconcileById,
  reconcileClasses,
  reconcileEnrollments,
  reconcilePayments,
  reconcileStudents,
  staleEnrollments,
} from './reconcile';
import type {
  ClassEnrollment,
  ClassSchedule,
  OfflineSyncItem,
  Payment,
  Student,
} from '../types';

const student = (id: string, name = id): Student => ({
  id,
  name,
  phone: '+5691',
  registrationDate: '2026-06-01',
  active: true,
});

const queued = (overrides: Partial<OfflineSyncItem>): OfflineSyncItem => ({
  id: 'q-1',
  action: 'CREATE_STUDENT',
  entity: 'Student',
  payload: student('std-9', 'Queued'),
  timestamp: '2026-08-05T00:00:00.000Z',
  ...overrides,
});

describe('reconcileById — remote ∪ queuedById (SYNC-REQ-4)', () => {
  it('queued CREATE/UPDATE payload wins over the remote row for the same id', () => {
    const remote = [student('std-1', 'Remote'), student('std-2', 'Remote2')];
    const queuedById = new Map([['std-1', student('std-1', 'Queued')]]);
    const out = reconcileById({ remote, queuedById, deleteIds: new Set() });
    expect(out.find((s) => s.id === 'std-1')?.name).toBe('Queued');
    expect(out.find((s) => s.id === 'std-2')?.name).toBe('Remote2');
  });

  it('queued-only rows (not yet on remote) are included', () => {
    const remote = [student('std-1')];
    const queuedById = new Map([['std-new', student('std-new', 'Offline')]]);
    const out = reconcileById({ remote, queuedById, deleteIds: new Set() });
    expect(out.map((s) => s.id).sort()).toEqual(['std-1', 'std-new']);
  });

  it('queued DELETE excludes the remote row (delete wins)', () => {
    const remote = [student('std-1'), student('std-2')];
    const queuedById = new Map([['std-1', student('std-1', 'But deleted later')]]);
    const deleteIds = new Set(['std-1']);
    const out = reconcileById({ remote, queuedById, deleteIds });
    expect(out.map((s) => s.id)).toEqual(['std-2']);
  });

  it('legacy RECORD_PAYMENT is treated as an update (already normalized at read)', () => {
    const remote: Payment[] = [
      {
        id: 'pay-1',
        studentId: 'std-1',
        studentName: 'Camila',
        amount: 1000,
        paymentMethod: 'efectivo',
        paymentDate: '2026-08-01',
        receiptNumber: 'REC-1',
      },
    ];
    const item = queued({
      action: 'CREATE_PAYMENT',
      entity: 'Payment',
      payload: {
        id: 'pay-1',
        studentId: 'std-1',
        studentName: 'Camila',
        amount: 2000,
        paymentMethod: 'efectivo',
        paymentDate: '2026-08-02',
        receiptNumber: 'REC-1',
      },
    });
    const out = reconcilePayments(remote, [item]);
    expect(out.find((p) => p.id === 'pay-1')?.amount).toBe(2000);
  });
});

describe('entity-specific merges', () => {
  it('reconcileStudents merges CREATE + DELETE from the queue', () => {
    const remote = [student('std-1'), student('std-2')];
    const queue = [
      queued({ action: 'CREATE_STUDENT', payload: student('std-9', 'New') }),
      queued({ action: 'DELETE_STUDENT', payload: { id: 'std-2' } }),
    ];
    const out = reconcileStudents(remote, queue);
    const ids = out.map((s) => s.id);
    expect(ids).toContain('std-1');
    expect(ids).toContain('std-9');
    expect(ids).not.toContain('std-2');
    expect(out.find((s) => s.id === 'std-9')?.name).toBe('New');
  });

  it('reconcileClasses merges queued UPDATE over remote', () => {
    const remote: ClassSchedule[] = [
      {
        id: 'class-1',
        name: 'CrossFit',
        startTime: '08:00',
        endTime: '09:00',
        daysOfWeek: [1, 3, 5],
        maxCapacity: 15,
        color: '#84cc16',
      },
    ];
    const queue = [
      queued({
        action: 'UPDATE_CLASS',
        entity: 'ClassSchedule',
        payload: {
          id: 'class-1',
          name: 'CrossFit NUEVO',
          startTime: '09:00',
          endTime: '10:00',
          daysOfWeek: [1, 3, 5],
          maxCapacity: 20,
          color: '#84cc16',
        },
      }),
    ];
    const out = reconcileClasses(remote, queue);
    expect(out.find((c) => c.id === 'class-1')?.name).toBe('CrossFit NUEVO');
  });

  it('reconcileEnrollments merges by composite key; UNENROLL wins', () => {
    const remote: ClassEnrollment[] = [
      { classId: 'class-1', studentId: 'std-1', dayOfWeek: 1 },
      { classId: 'class-1', studentId: 'std-2', dayOfWeek: 3 },
    ];
    const queue = [
      queued({
        action: 'ENROLL_STUDENT',
        entity: 'ClassEnrollment',
        payload: { classId: 'class-1', studentId: 'std-9', dayOfWeek: 5 },
      }),
      queued({
        action: 'UNENROLL_STUDENT',
        entity: 'ClassEnrollment',
        payload: { classId: 'class-1', studentId: 'std-2', dayOfWeek: 3 },
      }),
    ];
    const out = reconcileEnrollments(remote, queue);
    expect(out).toHaveLength(2);
    expect(out.some((e) => e.studentId === 'std-9' && e.dayOfWeek === 5)).toBe(true);
    expect(out.some((e) => e.studentId === 'std-2')).toBe(false);
    expect(out.some((e) => e.studentId === 'std-1' && e.dayOfWeek === 1)).toBe(true);
  });
});

describe('staleEnrollments prune (Q3 / DB-REQ-2)', () => {
  const cls = (id: string, days: number[]): ClassSchedule => ({
    id,
    name: id,
    startTime: '08:00',
    endTime: '09:00',
    daysOfWeek: days,
    maxCapacity: 10,
    color: '#fff',
  });

  it('flags junction rows for days removed from days_of_week', () => {
    const classes = [cls('class-1', [1, 5])]; // was [1,3,5], day 3 removed
    const enrollments: ClassEnrollment[] = [
      { classId: 'class-1', studentId: 'std-1', dayOfWeek: 1 }, // kept
      { classId: 'class-1', studentId: 'std-1', dayOfWeek: 3 }, // stale
      { classId: 'class-1', studentId: 'std-2', dayOfWeek: 5 }, // kept
    ];
    const stale = staleEnrollments(classes, enrollments);
    expect(stale).toEqual([
      { classId: 'class-1', studentId: 'std-1', dayOfWeek: 3 },
    ]);
  });

  it('keeps rows for classes without a match (no class row -> not pruned)', () => {
    const classes = [cls('class-1', [1])];
    const enrollments: ClassEnrollment[] = [
      { classId: 'class-other', studentId: 'std-1', dayOfWeek: 2 },
    ];
    expect(staleEnrollments(classes, enrollments)).toEqual([]);
  });

  it('no stale rows when days unchanged', () => {
    const classes = [cls('class-1', [2, 4])];
    const enrollments: ClassEnrollment[] = [
      { classId: 'class-1', studentId: 'std-1', dayOfWeek: 2 },
      { classId: 'class-1', studentId: 'std-1', dayOfWeek: 4 },
    ];
    expect(staleEnrollments(classes, enrollments)).toEqual([]);
  });
});