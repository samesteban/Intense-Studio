/**
 * snake_case (Supabase/Postgres) <-> camelCase (app types) mappers (DAL-REQ-2).
 *
 * Every repository converts rows through these functions so Supabase columns
 * never leak into components and app fields never leak into SQL. Column names
 * mirror supabase/migrations/0001_initial_schema.sql.
 *
 * Derived finance fields (status, lastPayment*) are intentionally NOT mapped:
 * they are computed client-side and never persisted (DAL-REQ-6).
 */
import type {
  AttendanceRecord,
  ClassEnrollment,
  ClassSchedule,
  Payment,
  PaymentMethod,
  Student,
} from '../types';

// --- students ---------------------------------------------------------------

export interface StudentRow {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  registration_date: string;
  active: boolean;
  notes: string | null;
}

export function studentFromRow(row: StudentRow): Student {
  return {
    id: row.id,
    name: row.name,
    phone: row.phone,
    email: row.email ?? undefined,
    registrationDate: row.registration_date,
    active: row.active,
    notes: row.notes ?? undefined,
  };
}

export function studentToRow(student: Student): StudentRow {
  return {
    id: student.id,
    name: student.name,
    phone: student.phone,
    email: student.email ?? null,
    registration_date: student.registrationDate,
    active: student.active,
    notes: student.notes ?? null,
  };
}

// --- class_schedules ---------------------------------------------------------

export interface ClassRow {
  id: string;
  name: string;
  start_time: string;
  end_time: string;
  days_of_week: number[];
  max_capacity: number;
  color: string;
  description: string | null;
}

export function classFromRow(row: ClassRow): ClassSchedule {
  return {
    id: row.id,
    name: row.name,
    startTime: row.start_time,
    endTime: row.end_time,
    daysOfWeek: row.days_of_week,
    maxCapacity: row.max_capacity,
    color: row.color,
    description: row.description ?? undefined,
  };
}

export function classToRow(cls: ClassSchedule): ClassRow {
  return {
    id: cls.id,
    name: cls.name,
    start_time: cls.startTime,
    end_time: cls.endTime,
    days_of_week: cls.daysOfWeek,
    max_capacity: cls.maxCapacity,
    color: cls.color,
    description: cls.description ?? null,
  };
}

// --- payments ------------------------------------------------------------------

export interface PaymentRow {
  id: string;
  student_id: string;
  student_name: string;
  amount: number;
  payment_method: PaymentMethod;
  payment_date: string;
  notes: string | null;
  receipt_number: string;
}

export function paymentFromRow(row: PaymentRow): Payment {
  return {
    id: row.id,
    studentId: row.student_id,
    studentName: row.student_name,
    amount: row.amount,
    paymentMethod: row.payment_method,
    paymentDate: row.payment_date,
    notes: row.notes ?? undefined,
    receiptNumber: row.receipt_number,
  };
}

export function paymentToRow(payment: Payment): PaymentRow {
  return {
    id: payment.id,
    student_id: payment.studentId,
    student_name: payment.studentName,
    amount: payment.amount,
    payment_method: payment.paymentMethod,
    payment_date: payment.paymentDate,
    notes: payment.notes ?? null,
    receipt_number: payment.receiptNumber,
  };
}

// --- attendance_records ----------------------------------------------------------

export interface AttendanceRow {
  id: string;
  student_id: string;
  student_name: string;
  class_id: string | null;
  class_name: string;
  date: string;
  time: string;
  recorded_offline: boolean;
}

export function attendanceFromRow(row: AttendanceRow): AttendanceRecord {
  return {
    id: row.id,
    studentId: row.student_id,
    studentName: row.student_name,
    classId: row.class_id ?? undefined,
    className: row.class_name,
    date: row.date,
    time: row.time,
    recordedOffline: row.recorded_offline,
  };
}

export function attendanceToRow(att: AttendanceRecord): AttendanceRow {
  return {
    id: att.id,
    student_id: att.studentId,
    student_name: att.studentName,
    class_id: att.classId ?? null,
    class_name: att.className,
    date: att.date,
    time: att.time,
    recorded_offline: att.recordedOffline,
  };
}

// --- class_enrollments -----------------------------------------------------------

export interface EnrollmentRow {
  class_id: string;
  student_id: string;
  day_of_week: number;
}

export function enrollmentFromRow(row: EnrollmentRow): ClassEnrollment {
  return {
    classId: row.class_id,
    studentId: row.student_id,
    dayOfWeek: row.day_of_week,
  };
}

export function enrollmentToRow(enr: ClassEnrollment): EnrollmentRow {
  return {
    class_id: enr.classId,
    student_id: enr.studentId,
    day_of_week: enr.dayOfWeek,
  };
}
