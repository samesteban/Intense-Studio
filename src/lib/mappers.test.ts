/**
 * Unit tests for the snake<->camel mappers (tasks.md 3.3, DAL-REQ-2).
 * Locks the DB row <-> app type contract so column renames fail loudly here
 * instead of at runtime. Also asserts DAL-REQ-6: derived finance fields are
 * never mapped into persisted rows.
 */
import { describe, expect, it } from 'vitest';
import {
  attendanceFromRow,
  attendanceToRow,
  classFromRow,
  classToRow,
  enrollmentFromRow,
  enrollmentToRow,
  paymentFromRow,
  paymentToRow,
  studentFromRow,
  studentToRow,
} from './mappers';
import type { StudentRow } from './mappers';

describe('student mappers', () => {
  it('maps a DB row to the app Student (camelCase)', () => {
    const row: StudentRow = {
      id: 'std-1',
      name: 'Camila Muñoz',
      phone: '+56911111111',
      email: 'camila@example.com',
      registration_date: '2026-06-15',
      active: true,
      notes: 'lesión leve',
    };

    expect(studentFromRow(row)).toEqual({
      id: 'std-1',
      name: 'Camila Muñoz',
      phone: '+56911111111',
      email: 'camila@example.com',
      registrationDate: '2026-06-15',
      active: true,
      notes: 'lesión leve',
    });
  });

  it('normalizes NULL email/notes to undefined on read', () => {
    const student = studentFromRow({
      id: 'std-2',
      name: 'Rodrigo',
      phone: '+56922222222',
      email: null,
      registration_date: '2026-05-10',
      active: false,
      notes: null,
    });

    expect(student.email).toBeUndefined();
    expect(student.notes).toBeUndefined();
    expect(student.active).toBe(false);
  });

  it('normalizes undefined email/notes to NULL on write', () => {
    const row = studentToRow({
      id: 'std-3',
      name: 'Valentina',
      phone: '+56933333333',
      registrationDate: '2026-07-01',
      active: true,
    });

    expect(row.email).toBeNull();
    expect(row.notes).toBeNull();
  });

  it('never writes derived finance fields (DAL-REQ-6)', () => {
    const row = studentToRow({
      id: 'std-1',
      name: 'Camila',
      phone: '+56911111111',
      registrationDate: '2026-06-15',
      active: true,
      status: 'con_deuda',
      lastPaymentAmount: 5000,
      lastPaymentDate: '2026-07-06',
    });

    expect(row).not.toHaveProperty('status');
    expect(row).not.toHaveProperty('last_payment_amount');
    expect(row).not.toHaveProperty('last_payment_date');
    expect(row).not.toHaveProperty('emergency_contact');
  });

  it('round-trips a full student', () => {
    const student = {
      id: 'std-4',
      name: 'Gonzalo Rojas',
      phone: '+56944444444',
      email: 'gonzalo@example.com',
      registrationDate: '2026-04-12',
      active: false,
      notes: 'registrado recientemente',
    };
    expect(studentFromRow(studentToRow(student))).toEqual(student);
  });
});

describe('class mappers', () => {
  it('round-trips days_of_week and nullable description', () => {
    const cls = {
      id: 'class-1',
      name: 'CrossFit WOD',
      startTime: '08:00',
      endTime: '09:00',
      daysOfWeek: [1, 3, 5],
      maxCapacity: 15,
      color: '#84cc16',
      description: undefined,
    };

    const row = classToRow(cls);
    expect(row).toEqual({
      id: 'class-1',
      name: 'CrossFit WOD',
      start_time: '08:00',
      end_time: '09:00',
      days_of_week: [1, 3, 5],
      max_capacity: 15,
      color: '#84cc16',
      description: null,
    });
    expect(classFromRow(row)).toEqual(cls);
  });
});

describe('payment mappers', () => {
  it('round-trips method enum, receipt and nullable notes', () => {
    const payment = {
      id: 'pay-1001',
      studentId: 'std-1',
      studentName: 'Camila Muñoz',
      amount: 10000,
      paymentMethod: 'transferencia' as const,
      paymentDate: '2026-08-01',
      notes: undefined,
      receiptNumber: 'REC-2026-0801',
    };

    const row = paymentToRow(payment);
    expect(row).toEqual({
      id: 'pay-1001',
      student_id: 'std-1',
      student_name: 'Camila Muñoz',
      amount: 10000,
      payment_method: 'transferencia',
      payment_date: '2026-08-01',
      notes: null,
      receipt_number: 'REC-2026-0801',
    });
    expect(paymentFromRow(row)).toEqual(payment);
  });
});

describe('attendance mappers', () => {
  it('maps class_id null to undefined and back to null', () => {
    const att = {
      id: 'att-1',
      studentId: 'std-1',
      studentName: 'Camila Muñoz',
      classId: undefined,
      className: 'Entrenamiento Libre',
      date: '2026-08-03',
      time: '08:15',
      recordedOffline: true,
    };

    const row = attendanceToRow(att);
    expect(row.class_id).toBeNull();
    expect(attendanceFromRow(row).classId).toBeUndefined();
    expect(attendanceFromRow(row).recordedOffline).toBe(true);
  });

  it('round-trips a class-linked attendance', () => {
    const att = {
      id: 'att-2',
      studentId: 'std-2',
      studentName: 'Rodrigo Fuenzalida',
      classId: 'class-1',
      className: 'CrossFit WOD',
      date: '2026-08-03',
      time: '08:20',
      recordedOffline: false,
    };
    expect(attendanceFromRow(attendanceToRow(att))).toEqual(att);
  });
});

describe('enrollment mappers', () => {
  it('round-trips the composite-key junction row', () => {
    const enrollment = { classId: 'class-1', studentId: 'std-1', dayOfWeek: 3 };
    const row = enrollmentToRow(enrollment);
    expect(row).toEqual({ class_id: 'class-1', student_id: 'std-1', day_of_week: 3 });
    expect(enrollmentFromRow(row)).toEqual(enrollment);
  });
});
