/**
 * Regression tests locking the pricing engine (src/utils/pricing.ts).
 * Locks the 5 tier rules and the debt -> status derivation so future
 * refactors (e.g. the Slice 3 status pipeline) cannot drift silently.
 *
 * Attendance rules under test:
 *  - Base rate:                    $2.500/class
 *  - 3+ classes in a week:         $2.000 for the first 3, $1.500 beyond
 *  - 2+ classes on the same day:   $2.000 each
 *  - 10+ classes in a month:       $2.000 each
 *  - Status: debt > 0 -> 'con_deuda', otherwise -> 'al_dia'
 */

import { describe, expect, it } from 'vitest';
import { calculateStudentFinances } from './pricing';
import type { AttendanceRecord, Payment } from '../types';

const STUDENT_ID = 'student-1';

function att(id: string, date: string, time = '18:00'): AttendanceRecord {
  return {
    id,
    studentId: STUDENT_ID,
    studentName: 'Test Student',
    className: 'Boxeo',
    date,
    time,
    recordedOffline: false,
  };
}

function payment(id: string, amount: number): Payment {
  return {
    id,
    studentId: STUDENT_ID,
    studentName: 'Test Student',
    amount,
    paymentMethod: 'efectivo',
    paymentDate: '2026-08-04',
    receiptNumber: `REC-${id}`,
  };
}

describe('calculateStudentFinances — tier rules', () => {
  it('applies the base rate ($2.500) to a single class in a month', () => {
    const summary = calculateStudentFinances(STUDENT_ID, [att('a1', '2026-08-04')], []);

    expect(summary.totalAttendances).toBe(1);
    expect(summary.totalCost).toBe(2500);
    expect(summary.itemizedAttendances[0]).toMatchObject({
      unitPrice: 2500,
      appliedRule: 'Tarifa Base ($2.500)',
    });
  });

  it('applies $2.000 to the first 3 classes of the same week', () => {
    // Mon/Tue/Wed 2026-08-03..05 — same ISO week, different days.
    const summary = calculateStudentFinances(
      STUDENT_ID,
      [att('a1', '2026-08-03'), att('a2', '2026-08-04'), att('a3', '2026-08-05')],
      [],
    );

    expect(summary.totalAttendances).toBe(3);
    expect(summary.totalCost).toBe(6000);
    for (const item of summary.itemizedAttendances) {
      expect(item.unitPrice).toBe(2000);
      expect(item.appliedRule).toBe('3 Clases Semana ($2.000)');
    }
  });

  it('applies $1.500 to classes beyond the 3rd in the same week', () => {
    // Mon..Fri 2026-08-03..07 — 5 classes in one ISO week.
    const summary = calculateStudentFinances(
      STUDENT_ID,
      [
        att('a1', '2026-08-03'),
        att('a2', '2026-08-04'),
        att('a3', '2026-08-05'),
        att('a4', '2026-08-06'),
        att('a5', '2026-08-07'),
      ],
      [],
    );

    expect(summary.totalAttendances).toBe(5);
    expect(summary.totalCost).toBe(9000); // 3 * 2000 + 2 * 1500

    const byRule = new Map(
      summary.itemizedAttendances.map((item) => [item.attendanceId, item]),
    );
    expect(byRule.get('a1')?.unitPrice).toBe(2000);
    expect(byRule.get('a2')?.unitPrice).toBe(2000);
    expect(byRule.get('a3')?.unitPrice).toBe(2000);
    expect(byRule.get('a4')).toMatchObject({
      unitPrice: 1500,
      appliedRule: 'Clase Adicional Semana ($1.500)',
    });
    expect(byRule.get('a5')).toMatchObject({
      unitPrice: 1500,
      appliedRule: 'Clase Adicional Semana ($1.500)',
    });
  });

  it('applies $2.000 to 2+ classes on the same day when the week has fewer than 3', () => {
    // Two classes on 2026-08-04 (week total = 2, so the weekly rule must not fire).
    const summary = calculateStudentFinances(
      STUDENT_ID,
      [att('a1', '2026-08-04', '18:00'), att('a2', '2026-08-04', '19:00')],
      [],
    );

    expect(summary.totalAttendances).toBe(2);
    expect(summary.totalCost).toBe(4000);
    for (const item of summary.itemizedAttendances) {
      expect(item.unitPrice).toBe(2000);
      expect(item.appliedRule).toBe('2 Clases Mismo Día ($2.000)');
    }
  });

  it('applies $2.000 per class when a month reaches 10+ classes', () => {
    // 10 August classes across distinct days, max 2 per ISO week, so neither
    // the weekly nor the daily rule can fire; only the monthly rule applies.
    const dates = [
      '2026-08-01', '2026-08-02', // W31 (Sat/Sun)
      '2026-08-03', '2026-08-04', // W32 (Mon/Tue)
      '2026-08-10', '2026-08-11', // W33
      '2026-08-17', '2026-08-18', // W34
      '2026-08-24', '2026-08-25', // W35
    ];
    const summary = calculateStudentFinances(
      STUDENT_ID,
      dates.map((date, index) => att(`a${index + 1}`, date)),
      [],
    );

    expect(summary.totalAttendances).toBe(10);
    expect(summary.totalCost).toBe(20000);
    for (const item of summary.itemizedAttendances) {
      expect(item.unitPrice).toBe(2000);
      expect(item.appliedRule).toBe('10+ Clases Mes ($2.000)');
    }
  });
});

describe('calculateStudentFinances — debt status', () => {
  const weekOf3 = [
    att('a1', '2026-08-03'),
    att('a2', '2026-08-04'),
    att('a3', '2026-08-05'),
  ];

  it('marks con_deuda when attendances cost more than payments', () => {
    const summary = calculateStudentFinances(STUDENT_ID, weekOf3, [payment('p1', 4000)]);

    expect(summary.totalCost).toBe(6000);
    expect(summary.totalPaid).toBe(4000);
    expect(summary.debt).toBe(2000);
    expect(summary.status).toBe('con_deuda');
  });

  it('marks al_dia when payments exactly cover the cost', () => {
    const summary = calculateStudentFinances(STUDENT_ID, weekOf3, [payment('p1', 6000)]);

    expect(summary.debt).toBe(0);
    expect(summary.status).toBe('al_dia');
  });

  it('marks al_dia on a credit balance and never produces inactivo', () => {
    const summary = calculateStudentFinances(STUDENT_ID, weekOf3, [payment('p1', 7000)]);

    expect(summary.debt).toBe(-1000);
    // STATUS-REQ-3: the status pipeline only ever yields al_dia | con_deuda.
    expect(summary.status).toBe('al_dia');
    expect(['al_dia', 'con_deuda']).toContain(summary.status);
  });
});
