/**
 * Remote <-> optimistic queue reconcile (tasks.md 4.4, DAL-REQ-3, SYNC-REQ-4,
 * DB-REQ-2; design.md Sequence B + Risk "junction drift" / Q3 resolution).
 *
 * Boot flow: cache snapshot renders -> Promise.all(5 selects) -> the fetched
 * rows are merged with what the offline queue still holds (items not yet
 * replayed / item that failed). This prevents the fetch from clobbering the
 * operator's optimistic-but-not-yet-synced changes (remote ∪ queuedById).
 *
 * Merge rules (per entity, keyed by `id`):
 * - a queued CREATE/UPDATE item's payload is the source of truth for that id
 *   (its pending change must survive the fetch — LWW by queue re-applies later)
 * - a queued DELETE item removes that id's remote row from the merged result
 * - anything else comes from remote
 *
 * Prune (Q3 resolution): when a class UPDATE shrinks `days_of_week`, the
 * `class_enrollments` junction rows for the removed days must be dropped
 * (DB-REQ-2). Pure function returns the stale enrollments to delete so the
 * caller can issue the removes through the enrollments repo.
 */
import type {
  AttendanceRecord,
  ClassEnrollment,
  ClassSchedule,
  Payment,
  Student,
} from '../types';
import type { OfflineSyncItem } from '../types';

function isQueuedUpdate(item: OfflineSyncItem): boolean {
  return /^(CREATE|UPDATE|RECORD|ENROLL)_/.test(item.action);
}

function isQueuedDelete(item: OfflineSyncItem): boolean {
  return item.action.startsWith('DELETE_') || item.action === 'UNENROLL_STUDENT';
}

/**
 * Merge one entity's remote rows with the optimistic queue. The queue is
 * already normalized (legacy RECORD_PAYMENT aliased to CREATE_PAYMENT).
 *
 * `queuedById` maps item.payload id -> item for CREATE/UPDATE; `deleteIds` holds
 * the ids of queued DELETE/UNENROLL items to exclude.
 */
export interface QueuedMerge {
  id: string;
  item: OfflineSyncItem;
}

export interface ReconcileInput<T> {
  remote: T[];
  /** Optimistic rewritten rows (payload) by id, from queued CREATE/UPDATE items. */
  queuedById: Map<string, T>;
  /** Ids excluded because a queued DELETE/UNENROLL removed them. */
  deleteIds: Set<string>;
}

/** Generic id-merge: queued wins over remote, deletes excluded (SYNC-REQ-4). */
export function reconcileById<T extends { id: string }>({
  remote,
  queuedById,
  deleteIds,
}: ReconcileInput<T>): T[] {
  const merged = new Map<string, T>();

  for (const row of remote) {
    if (deleteIds.has(row.id)) continue; // pending delete wins
    merged.set(row.id, row);
  }
  for (const [id, row] of queuedById) {
    if (deleteIds.has(id)) continue; // delete wins over an earlier create
    merged.set(id, row); // optimistic queued value is the source of truth
  }

  return Array.from(merged.values());
}

/**
 * Build the ReconcileInput for an entity from the raw queue items. Items are
 * matched to an entity by the queued `entity` field (the TanStack-agnostic
 * domain name) so a single queue can feed all five merges.
 */
export function queueDiffForEntity<T>(
  queue: OfflineSyncItem[],
  entity: string,
  extractId: (payload: unknown) => string,
): Pick<ReconcileInput<T>, 'queuedById' | 'deleteIds'> {
  const queuedById = new Map<string, T>();
  const deleteIds = new Set<string>();

  for (const item of queue) {
    if (item.entity !== entity) continue;
    if (isQueuedDelete(item)) {
      deleteIds.add(extractId(item.payload));
    } else if (isQueuedUpdate(item)) {
      queuedById.set(extractId(item.payload), item.payload as T);
    }
  }
  return { queuedById, deleteIds };
}

// --- Prune (Q3 resolution) ---------------------------------------------------

/**
 * Compute stale `class_enrollments` rows whose `day_of_week` was removed from
 * the class's `days_of_week` on a class UPDATE. Returns the enrollments the
 * caller must delete (design.md Risk "junction drift when days_of_week shrinks").
 */
export function staleEnrollments(
  classes: ClassSchedule[],
  enrollments: ClassEnrollment[],
): ClassEnrollment[] {
  const byClass = new Map<string, Set<number>>();
  for (const cls of classes) byClass.set(cls.id, new Set(cls.daysOfWeek));

  return enrollments.filter((enr) => {
    const allowed = byClass.get(enr.classId);
    return allowed !== undefined && !allowed.has(enr.dayOfWeek);
  });
}

/**
 * Reconcile helper signature mirroring design.md Sequence B. Applies queued
 * CREATE/UPDATE payloads over fetched rows and drops queued deletes.
 */
export function reconcileStudents(
  remote: Student[],
  queue: OfflineSyncItem[],
): Student[] {
  const { queuedById, deleteIds } = queueDiffForEntity<Student>(queue, 'Student', (p) =>
    (p as { id: string }).id,
  );
  return reconcileById({ remote, queuedById, deleteIds });
}

/** Payments merge — keyed by id, queued wins (SYNC-REQ-4). */
export function reconcilePayments(
  remote: Payment[],
  queue: OfflineSyncItem[],
): Payment[] {
  const { queuedById, deleteIds } = queueDiffForEntity<Payment>(queue, 'Payment', (p) =>
    (p as { id: string }).id,
  );
  return reconcileById({ remote, queuedById, deleteIds });
}

/** Classes merge — queued CREATE/UPDATE wins, delete excluded. */
export function reconcileClasses(
  remote: ClassSchedule[],
  queue: OfflineSyncItem[],
): ClassSchedule[] {
  const { queuedById, deleteIds } = queueDiffForEntity<ClassSchedule>(queue, 'ClassSchedule', (p) =>
    (p as { id: string }).id,
  );
  return reconcileById({ remote, queuedById, deleteIds });
}

/** Attendance merge — keyed by id. */
export function reconcileAttendances(
  remote: AttendanceRecord[],
  queue: OfflineSyncItem[],
): AttendanceRecord[] {
  const { queuedById, deleteIds } = queueDiffForEntity<AttendanceRecord>(queue, 'Attendance', (p) =>
    (p as { id: string }).id,
  );
  return reconcileById({ remote, queuedById, deleteIds });
}

/**
 * Enrollment merge — keyed by composite (class|student|day). Queued ENROLL wins
 * over remote; queued UNENROLL removes the composite key.
 */
export function reconcileEnrollments(
  remote: ClassEnrollment[],
  queue: OfflineSyncItem[],
): ClassEnrollment[] {
  const key = (enr: ClassEnrollment) => `${enr.classId}|${enr.studentId}|${enr.dayOfWeek}`;
  const keyOfPayload = (p: unknown) => key(p as ClassEnrollment);

  const queuedById = new Map<string, ClassEnrollment>();
  const deleteIds = new Set<string>();

  for (const item of queue) {
    if (item.entity !== 'ClassEnrollment') continue;
    if (item.action === 'UNENROLL_STUDENT') {
      deleteIds.add(keyOfPayload(item.payload));
    } else if (item.action === 'ENROLL_STUDENT') {
      queuedById.set(keyOfPayload(item.payload), item.payload as ClassEnrollment);
    }
  }

  // Same generic merge semantics on the composite key.
  const merged = new Map<string, ClassEnrollment>();
  for (const row of remote) if (!deleteIds.has(key(row))) merged.set(key(row), row);
  for (const [k, row] of queuedById) if (!deleteIds.has(k)) merged.set(k, row);
  return Array.from(merged.values());
}