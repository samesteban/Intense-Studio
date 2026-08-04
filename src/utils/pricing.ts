/**
 * Pricing Engine according to Attendance Rules:
 * - Currency: CLP ($)
 * - Base rate per class: $2,500 CLP
 * - 3 classes in the same week: $2,000 CLP per class ($6,000 total for 3)
 * - 2 classes on the same day: $2,000 CLP per class
 * - > 3 classes in a week: $2,000 per class for first 3 ($6,000) + $1,500 per additional class
 * - >= 10 classes in a month (not meeting week/day discount): $2,000 CLP per class
 * - < 9 classes in a month (no other condition applies): $2,500 CLP per class
 */

import { AttendanceRecord, Payment } from '../types';

export interface CalculatedAttendanceItem {
  attendanceId: string;
  date: string; // YYYY-MM-DD
  time: string;
  className: string;
  unitPrice: number; // 2500, 2000, 1500
  appliedRule: 'Tarifa Base ($2.500)' | '3 Clases Semana ($2.000)' | 'Clase Adicional Semana ($1.500)' | '2 Clases Mismo Día ($2.000)' | '10+ Clases Mes ($2.000)';
}

export interface StudentFinancialSummary {
  studentId: string;
  totalAttendances: number;
  totalCost: number;
  totalPaid: number;
  debt: number; // Positive = owes money, Negative = credit balance, 0 = up to date
  status: 'al_dia' | 'con_deuda';
  itemizedAttendances: CalculatedAttendanceItem[];
}

/**
 * Gets the ISO Week string (e.g. "2026-W32") for grouping
 */
function getIsoWeekKey(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  const dayNum = d.getUTCDay() || 7; // Sunday = 1, Monday = 1
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  const weekFormatted = weekNo < 10 ? `0${weekNo}` : `${weekNo}`;
  return `${d.getUTCFullYear()}-W${weekFormatted}`;
}

export function calculateStudentFinances(
  studentId: string,
  allAttendances: AttendanceRecord[],
  allPayments: Payment[]
): StudentFinancialSummary {
  const studentAtts = allAttendances
    .filter((a) => a.studentId === studentId)
    .sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time));

  const studentPays = allPayments.filter((p) => p.studentId === studentId);
  const totalPaid = studentPays.reduce((acc, p) => acc + (p.amount || 0), 0);

  // Group attendances by Month (YYYY-MM)
  const byMonth: Record<string, AttendanceRecord[]> = {};
  for (const att of studentAtts) {
    const month = att.date.substring(0, 7); // YYYY-MM
    if (!byMonth[month]) byMonth[month] = [];
    byMonth[month].push(att);
  }

  const itemizedAttendances: CalculatedAttendanceItem[] = [];
  let totalCost = 0;

  for (const month in byMonth) {
    const monthAtts = byMonth[month];
    const totalMonthClasses = monthAtts.length;

    // Group month's attendances by ISO Week
    const byWeek: Record<string, AttendanceRecord[]> = {};
    for (const att of monthAtts) {
      const weekKey = getIsoWeekKey(att.date);
      if (!byWeek[weekKey]) byWeek[weekKey] = [];
      byWeek[weekKey].push(att);
    }

    for (const weekKey in byWeek) {
      const weekAtts = byWeek[weekKey];
      const weekClassCount = weekAtts.length;

      if (weekClassCount >= 3) {
        // Rule: 3+ classes in same week
        // First 3 = $2,000 each, 4th+ = $1,500 each
        weekAtts.forEach((att, index) => {
          if (index < 3) {
            const unitPrice = 2000;
            totalCost += unitPrice;
            itemizedAttendances.push({
              attendanceId: att.id,
              date: att.date,
              time: att.time,
              className: att.className,
              unitPrice,
              appliedRule: '3 Clases Semana ($2.000)'
            });
          } else {
            const unitPrice = 1500;
            totalCost += unitPrice;
            itemizedAttendances.push({
              attendanceId: att.id,
              date: att.date,
              time: att.time,
              className: att.className,
              unitPrice,
              appliedRule: 'Clase Adicional Semana ($1.500)'
            });
          }
        });
      } else {
        // < 3 classes in week -> Check daily condition or monthly condition
        const byDay: Record<string, AttendanceRecord[]> = {};
        for (const att of weekAtts) {
          if (!byDay[att.date]) byDay[att.date] = [];
          byDay[att.date].push(att);
        }

        for (const dayDate in byDay) {
          const dayAtts = byDay[dayDate];
          const dayClassCount = dayAtts.length;

          if (dayClassCount >= 2) {
            // Rule: 2+ classes on same day -> $2,000 each
            dayAtts.forEach((att) => {
              const unitPrice = 2000;
              totalCost += unitPrice;
              itemizedAttendances.push({
                attendanceId: att.id,
                date: att.date,
                time: att.time,
                className: att.className,
                unitPrice,
                appliedRule: '2 Clases Mismo Día ($2.000)'
              });
            });
          } else {
            // 1 class on this day
            const att = dayAtts[0];
            if (totalMonthClasses >= 10) {
              // Rule: 10+ classes in month -> $2,000 each
              const unitPrice = 2000;
              totalCost += unitPrice;
              itemizedAttendances.push({
                attendanceId: att.id,
                date: att.date,
                time: att.time,
                className: att.className,
                unitPrice,
                appliedRule: '10+ Clases Mes ($2.000)'
              });
            } else {
              // Rule: Base rate -> $2,500 each
              const unitPrice = 2500;
              totalCost += unitPrice;
              itemizedAttendances.push({
                attendanceId: att.id,
                date: att.date,
                time: att.time,
                className: att.className,
                unitPrice,
                appliedRule: 'Tarifa Base ($2.500)'
              });
            }
          }
        }
      }
    }
  }

  const debt = totalCost - totalPaid;
  const status: 'al_dia' | 'con_deuda' = debt > 0 ? 'con_deuda' : 'al_dia';

  return {
    studentId,
    totalAttendances: studentAtts.length,
    totalCost,
    totalPaid,
    debt,
    status,
    itemizedAttendances
  };
}
