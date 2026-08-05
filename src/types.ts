/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type MemberStatus = 'al_dia' | 'con_deuda';
export type PaymentMethod = 'efectivo' | 'transferencia' | 'debito' | 'credito';

export interface Student {
  id: string; // Auto-generated UUID or unique ID
  name: string;
  phone: string;
  email?: string;
  registrationDate: string; // ISO string YYYY-MM-DD
  /**
   * Manual active flag (STATUS-REQ-1, DAL-REQ-5). Persisted boolean, default
   * true; the sole source of active/inactive state. Derived finance status
   * (al_dia | con_deuda) is computed client-side via useMemo from the pricing
   * engine and NEVER persisted (DAL-REQ-6, STATUS-REQ-4). The legacy
   * `status`, `lastPaymentAmount`, `lastPaymentDate` and `emergencyContact`
   * fields were dropped with the derived-status pipeline (Slice 3b2).
   */
  active: boolean;
  notes?: string;
}

export interface Payment {
  id: string;
  studentId: string;
  studentName: string;
  amount: number;
  paymentMethod: PaymentMethod;
  paymentDate: string; // ISO YYYY-MM-DD
  notes?: string;
  receiptNumber: string;
}

export interface ClassSchedule {
  id: string;
  name: string;
  startTime: string; // e.g., "18:00"
  endTime: string; // e.g., "19:00"
  daysOfWeek: number[]; // 1=Lunes, 2=Martes, ..., 7=Domingo
  maxCapacity: number;
  color: string;
  description?: string;
}

export interface AttendanceRecord {
  id: string;
  studentId: string;
  studentName: string;
  classId?: string;
  className: string;
  date: string; // ISO YYYY-MM-DD
  time: string; // HH:MM
  recordedOffline: boolean;
}

/**
 * Sync action set (design.md Interfaces). 13 idempotent actions; the 4 legacy
 * names (RECORD_PAYMENT) were renamed to CREATE_* — CREATE_PAYMENT covers both
 * create and edit via upsert. DELETE_ATTENDANCE closes the offline-cancel gap
 * (design open Q1, resolved yes in tasks.md 3.2).
 */
export type SyncAction =
  | 'CREATE_STUDENT'
  | 'UPDATE_STUDENT'
  | 'DELETE_STUDENT'
  | 'CREATE_PAYMENT'
  | 'UPDATE_PAYMENT'
  | 'DELETE_PAYMENT'
  | 'CREATE_CLASS'
  | 'UPDATE_CLASS'
  | 'DELETE_CLASS'
  | 'RECORD_ATTENDANCE'
  | 'ENROLL_STUDENT'
  | 'UNENROLL_STUDENT'
  | 'DELETE_ATTENDANCE';

export interface OfflineSyncItem {
  id: string;
  action: SyncAction;
  entity: string;
  payload: any;
  timestamp: string;
}

/** class_enrollments junction row (DB-REQ-2): composite PK (class, student, day). */
export interface ClassEnrollment {
  classId: string;
  studentId: string;
  dayOfWeek: number; // 1=Lunes .. 7=Domingo
}
