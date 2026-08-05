/**
 * DataProvider + useData (tasks.md 3.7, design decision 8, DAL-REQ-3/4/6).
 *
 * Owns every entity collection, connectivity state and the offline queue.
 * Boot is cache-first: it renders the cached snapshot from localStorage, then
 * refreshes from Supabase in the background and overwrites the cache with the
 * fetched rows (DAL-REQ-3). Writes are write-through (DAL-REQ-4): optimistic
 * state + cache update always, then persist via repository when online, or
 * enqueue an offline sync item when offline.
 *
 * The write path NEVER persists derived finance status (DAL-REQ-6/STATUS-REQ-4):
 * the entities stored/queued here carry only persisted fields — status is
 * recomputed at render time by useMemberStatus / deriveStudentStatus.
 *
 * Note: remap+reconcile against optimistic queued rows arrives with the PR4
 * store merging (4.4). Boot fetch here directly replaces the cache snapshot.
 */
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type {
  AttendanceRecord,
  ClassEnrollment,
  ClassSchedule,
  OfflineSyncItem,
  Payment,
  Student,
  SyncAction,
} from '../types';
import {
  attendanceRepo,
  classesRepo,
  enrollmentsRepo,
  paymentsRepo,
  studentsRepo,
} from '../lib/repositories';
import {
  readCacheSnapshot,
  writeCache,
  writeCacheSnapshot,
} from '../lib/cache';
import { addToOfflineQueue, clearOfflineQueue, getOfflineQueue } from '../utils/storage';

export interface DataContextValue {
  students: Student[];
  classes: ClassSchedule[];
  payments: Payment[];
  attendances: AttendanceRecord[];
  enrollments: ClassEnrollment[];
  isOnline: boolean;
  queue: OfflineSyncItem[];

  /** Drain queue + refetch. Real FIFO replay lands with PR4 (sync.ts). */
  syncNow: () => Promise<void>;
  resetData: () => Promise<void>;

  // Write-through mutations (DAL-REQ-4).
  upsertStudent: (student: Student) => Promise<void>;
  deleteStudent: (studentId: string) => Promise<void>;
  saveClass: (cls: ClassSchedule) => Promise<void>;
  deleteClass: (classId: string) => Promise<void>;
  processPayment: (payment: Payment) => Promise<void>;
  deletePayment: (paymentId: string) => Promise<void>;
  recordAttendance: (att: AttendanceRecord) => Promise<void>;
  cancelAttendance: (attendanceId: string) => Promise<void>;
  enrollStudent: (enr: ClassEnrollment) => Promise<void>;
  unenrollStudent: (enr: ClassEnrollment) => Promise<void>;
}

const DataContext = createContext<DataContextValue | null>(null);

export function DataProvider({ children }: { children: React.ReactNode }) {
  // Cache-first initial state (DAL-REQ-3 first paint).
  const initial = useMemo(readCacheSnapshot, []);
  const [students, setStudents] = useState<Student[]>(initial.students);
  const [classes, setClasses] = useState<ClassSchedule[]>(initial.classes);
  const [payments, setPayments] = useState<Payment[]>(initial.payments);
  const [attendances, setAttendances] = useState<AttendanceRecord[]>(initial.attendances);
  const [enrollments, setEnrollments] = useState<ClassEnrollment[]>(initial.enrollments);

  const [isOnline, setIsOnline] = useState<boolean>(() => navigator.onLine);
  const [queue, setQueue] = useState<OfflineSyncItem[]>(() => getOfflineQueue());

  // Keep refs in sync so async mutation handlers read the latest snapshot.
  const studentsRef = useRef(students);
  const paymentsRef = useRef(payments);
  const classesRef = useRef(classes);
  const attendancesRef = useRef(attendances);
  const enrollmentsRef = useRef(enrollments);
  const isOnlineRef = useRef(isOnline);

  useEffect(() => {
    studentsRef.current = students;
  }, [students]);
  useEffect(() => {
    paymentsRef.current = payments;
  }, [payments]);
  useEffect(() => {
    classesRef.current = classes;
  }, [classes]);
  useEffect(() => {
    attendancesRef.current = attendances;
  }, [attendances]);
  useEffect(() => {
    enrollmentsRef.current = enrollments;
  }, [enrollments]);
  useEffect(() => {
    isOnlineRef.current = isOnline;
  }, [isOnline]);

  /**
   * Persist an offline sync item and reflect it in the queue state.
   *
   * Used by the offline write path AND as the fallback when an ONLINE repo
   * write fails (PR3b review W1): a transient online failure must not swallow
   * the mutation — the item is queued for the PR4 replay instead of being lost.
   * The queue write is best-effort: if localStorage throws (quota / private
   * mode) the item still stays in memory so the UI pending-count is honest.
   */
  const enqueueItem = useCallback(
    (action: SyncAction, entity: string, payload: unknown): void => {
      const item: OfflineSyncItem = {
        action,
        entity,
        payload,
        id: `queue-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        timestamp: new Date().toISOString(),
      };
      try {
        addToOfflineQueue(item);
        setQueue(getOfflineQueue());
      } catch {
        setQueue((prev) => [...prev, item]);
      }
    },
    [],
  );

  /** Fetch every entity from Supabase; on success replace state + cache. */
  const refreshAll = useCallback(async () => {
    if (!isOnlineRef.current) return; // offline → keep the cache snapshot
    try {
      const results = await Promise.all([
        studentsRepo.list(),
        classesRepo.list(),
        paymentsRepo.list(),
        attendanceRepo.list(),
        enrollmentsRepo.list(),
      ]);
      setStudents(results[0]);
      setClasses(results[1]);
      setPayments(results[2]);
      setAttendances(results[3]);
      setEnrollments(results[4]);
      writeCacheSnapshot({
        students: results[0],
        classes: results[1],
        payments: results[2],
        attendances: results[3],
        enrollments: results[4],
      });
    } catch {
      // Transient / DB error: snapshot stays (reconcile lands in PR4 4.4).
    }
  }, []);

  // Boot: cache snapshot is the initial state; refresh from Supabase after.
  useEffect(() => {
    void refreshAll();
    const handleOnline = () => {
      setIsOnline(true);
      void refreshAll();
    };
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [refreshAll]);

  const syncNow = useCallback(async () => {
    // PR4 4.5 replaces this placeholder with real FIFO replay. Until then,
    // clearing the queue + refetching keeps the pending-count honest.
    clearOfflineQueue();
    setQueue([]);
    await refreshAll();
  }, [refreshAll]);

  const resetData = useCallback(async () => {
    // DAL-REQ-7: no seed/import — reset clears client cache+queue and refetches
    // the (empty) Supabase tables.
    ['students', 'classes', 'payments', 'attendances', 'enrollments'].forEach((k) =>
      writeCache(k as 'students', []),
    );
    clearOfflineQueue();
    setQueue([]);
    setIsOnline(true);
    await refreshAll();
  }, [refreshAll]);

  // --- Write-through mutations (DAL-REQ-4) -------------------------------
  // Each mutation: optimistic state + cache first; then persist via repo when
  // online (falling back to the offline queue if the write fails — W1), or
  // enqueue an offline sync item directly when offline.

  const upsertStudent = useCallback(async (student: Student) => {
    const exists = studentsRef.current.some((s) => s.id === student.id);
    const next = exists
      ? studentsRef.current.map((s) => (s.id === student.id ? student : s))
      : [student, ...studentsRef.current];
    setStudents(next);
    writeCache('students', next);
    if (isOnlineRef.current) {
      await studentsRepo.upsert(student).catch(() =>
        enqueueItem(exists ? 'UPDATE_STUDENT' : 'CREATE_STUDENT', 'Student', student),
      );
    } else {
      enqueueItem(exists ? 'UPDATE_STUDENT' : 'CREATE_STUDENT', 'Student', student);
    }
  }, [enqueueItem]);

  const deleteStudent = useCallback(async (studentId: string) => {
    const next = studentsRef.current.filter((s) => s.id !== studentId);
    setStudents(next);
    writeCache('students', next);
    if (isOnlineRef.current) {
      await studentsRepo.remove(studentId).catch(() =>
        enqueueItem('DELETE_STUDENT', 'Student', { id: studentId }),
      );
    } else {
      enqueueItem('DELETE_STUDENT', 'Student', { id: studentId });
    }
  }, [enqueueItem]);

  const saveClass = useCallback(async (cls: ClassSchedule) => {
    const exists = classesRef.current.some((c) => c.id === cls.id);
    const next = exists
      ? classesRef.current.map((c) => (c.id === cls.id ? cls : c))
      : [...classesRef.current, cls];
    setClasses(next);
    writeCache('classes', next);
    if (isOnlineRef.current) {
      await classesRepo.upsert(cls).catch(() =>
        enqueueItem(exists ? 'UPDATE_CLASS' : 'CREATE_CLASS', 'ClassSchedule', cls),
      );
    } else {
      enqueueItem(exists ? 'UPDATE_CLASS' : 'CREATE_CLASS', 'ClassSchedule', cls);
    }
  }, [enqueueItem]);

  const deleteClass = useCallback(async (classId: string) => {
    const next = classesRef.current.filter((c) => c.id !== classId);
    setClasses(next);
    writeCache('classes', next);
    if (isOnlineRef.current) {
      await classesRepo.remove(classId).catch(() =>
        enqueueItem('DELETE_CLASS', 'ClassSchedule', { id: classId }),
      );
    } else {
      enqueueItem('DELETE_CLASS', 'ClassSchedule', { id: classId });
    }
  }, [enqueueItem]);

  const processPayment = useCallback(async (payment: Payment) => {
    const exists = paymentsRef.current.some((p) => p.id === payment.id);
    const next = exists
      ? paymentsRef.current.map((p) => (p.id === payment.id ? payment : p))
      : [payment, ...paymentsRef.current];
    setPayments(next);
    writeCache('payments', next);
    if (isOnlineRef.current) {
      await paymentsRepo.upsert(payment).catch(() =>
        enqueueItem('CREATE_PAYMENT', 'Payment', payment),
      );
    } else {
      enqueueItem('CREATE_PAYMENT', 'Payment', payment);
    }
  }, [enqueueItem]);

  const deletePayment = useCallback(async (paymentId: string) => {
    const next = paymentsRef.current.filter((p) => p.id !== paymentId);
    setPayments(next);
    writeCache('payments', next);
    if (isOnlineRef.current) {
      await paymentsRepo.remove(paymentId).catch(() =>
        enqueueItem('DELETE_PAYMENT', 'Payment', { id: paymentId }),
      );
    } else {
      enqueueItem('DELETE_PAYMENT', 'Payment', { id: paymentId });
    }
  }, [enqueueItem]);

  const recordAttendance = useCallback(async (att: AttendanceRecord) => {
    const next = [att, ...attendancesRef.current];
    setAttendances(next);
    writeCache('attendances', next);
    if (isOnlineRef.current) {
      await attendanceRepo.upsert(att).catch(() =>
        enqueueItem('RECORD_ATTENDANCE', 'Attendance', att),
      );
    } else {
      enqueueItem('RECORD_ATTENDANCE', 'Attendance', att);
    }
  }, [enqueueItem]);

  const cancelAttendance = useCallback(async (attendanceId: string) => {
    const next = attendancesRef.current.filter((a) => a.id !== attendanceId);
    setAttendances(next);
    writeCache('attendances', next);
    if (isOnlineRef.current) {
      await attendanceRepo.remove(attendanceId).catch(() =>
        enqueueItem('DELETE_ATTENDANCE', 'Attendance', { id: attendanceId }),
      );
    } else {
      enqueueItem('DELETE_ATTENDANCE', 'Attendance', { id: attendanceId });
    }
  }, [enqueueItem]);

  const enrollStudent = useCallback(async (enr: ClassEnrollment) => {
    const next = enrollmentsRef.current.find(
      (e) =>
        e.classId === enr.classId &&
        e.studentId === enr.studentId &&
        e.dayOfWeek === enr.dayOfWeek,
    )
      ? enrollmentsRef.current
      : [...enrollmentsRef.current, enr];
    setEnrollments(next);
    writeCache('enrollments', next);
    if (isOnlineRef.current) {
      await enrollmentsRepo.upsert(enr).catch(() =>
        enqueueItem('ENROLL_STUDENT', 'ClassEnrollment', enr),
      );
    } else {
      enqueueItem('ENROLL_STUDENT', 'ClassEnrollment', enr);
    }
  }, [enqueueItem]);

  const unenrollStudent = useCallback(async (enr: ClassEnrollment) => {
    const next = enrollmentsRef.current.filter(
      (e) =>
        !(e.classId === enr.classId && e.studentId === enr.studentId && e.dayOfWeek === enr.dayOfWeek),
    );
    setEnrollments(next);
    writeCache('enrollments', next);
    if (isOnlineRef.current) {
      await enrollmentsRepo
        .remove(enr.classId, enr.studentId, enr.dayOfWeek)
        .catch(() => enqueueItem('UNENROLL_STUDENT', 'ClassEnrollment', enr));
    } else {
      enqueueItem('UNENROLL_STUDENT', 'ClassEnrollment', enr);
    }
  }, [enqueueItem]);

  const value = useMemo<DataContextValue>(
    () => ({
      students,
      classes,
      payments,
      attendances,
      enrollments,
      isOnline,
      queue,
      syncNow,
      resetData,
      upsertStudent,
      deleteStudent,
      saveClass,
      deleteClass,
      processPayment,
      deletePayment,
      recordAttendance,
      cancelAttendance,
      enrollStudent,
      unenrollStudent,
    }),
    [
      students,
      classes,
      payments,
      attendances,
      enrollments,
      isOnline,
      queue,
      syncNow,
      resetData,
      upsertStudent,
      deleteStudent,
      saveClass,
      deleteClass,
      processPayment,
      deletePayment,
      recordAttendance,
      cancelAttendance,
      enrollStudent,
      unenrollStudent,
    ],
  );

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

/** Access the data layer. MUST be rendered under a DataProvider (GIVEN 3.7). */
export function useData(): DataContextValue {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error('useData must be used within a <DataProvider>');
  return ctx;
}
