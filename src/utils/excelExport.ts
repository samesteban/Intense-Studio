/**
 * Excel Export Utilities using SheetJS (xlsx)
 */
import * as XLSX from 'xlsx';
import { AttendanceRecord, Payment, Student } from '../types';
import { calculateStudentFinances } from './pricing';
import { deriveStudentStatus } from '../lib/status';

export function exportAttendanceToExcel(
  attendances: AttendanceRecord[],
  monthLabel: string = 'Mes Actual'
) {
  const data = attendances.map((att, index) => ({
    '#': index + 1,
    'Fecha': att.date,
    'Hora': att.time,
    'ID Alumno': att.studentId,
    'Nombre Alumno': att.studentName,
    'Clase Impartida': att.className,
    'Estado Sincro': att.recordedOffline ? 'Registrado Offline' : 'En Línea'
  }));

  const worksheet = XLSX.utils.json_to_sheet(data);

  // Auto column widths
  const colWidths = [
    { wch: 5 },
    { wch: 12 },
    { wch: 8 },
    { wch: 15 },
    { wch: 30 },
    { wch: 25 },
    { wch: 18 }
  ];
  worksheet['!cols'] = colWidths;

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Asistencias');

  // Summary Sheet
  const studentCounts: Record<string, { id: string; name: string; count: number }> = {};
  attendances.forEach((att) => {
    if (!studentCounts[att.studentId]) {
      studentCounts[att.studentId] = {
        id: att.studentId,
        name: att.studentName,
        count: 0
      };
    }
    studentCounts[att.studentId].count++;
  });

  const summaryData = Object.values(studentCounts).map((s, idx) => ({
    '#': idx + 1,
    'ID': s.id,
    'Nombre Alumno': s.name,
    'Total Asistencias': s.count
  }));

  const summarySheet = XLSX.utils.json_to_sheet(summaryData);
  summarySheet['!cols'] = [{ wch: 5 }, { wch: 15 }, { wch: 30 }, { wch: 18 }];
  XLSX.utils.book_append_sheet(workbook, summarySheet, 'Resumen por Alumno');

  const fileName = `Asistencia_IntenseStudio_${monthLabel.replace(/\s+/g, '_')}.xlsx`;
  XLSX.writeFile(workbook, fileName);
}

export function exportIncomeReportToExcel(payments: Payment[], monthLabel: string = 'Actual') {
  const data = payments.map((p, idx) => ({
    '#': idx + 1,
    'N° Recibo': p.receiptNumber,
    'Fecha Pago': p.paymentDate,
    'ID Alumno': p.studentId,
    'Nombre Alumno': p.studentName,
    'Monto ($ CLP)': p.amount,
    'Método Pago': p.paymentMethod.toUpperCase(),
    'Observaciones': p.notes || ''
  }));

  const worksheet = XLSX.utils.json_to_sheet(data);
  worksheet['!cols'] = [
    { wch: 5 },
    { wch: 15 },
    { wch: 12 },
    { wch: 15 },
    { wch: 28 },
    { wch: 15 },
    { wch: 18 },
    { wch: 30 }
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Ingresos');

  const fileName = `Reporte_Ingresos_IntenseStudio_${monthLabel.replace(/\s+/g, '_')}.xlsx`;
  XLSX.writeFile(workbook, fileName);
}

export function exportStudentsListToExcel(
  students: Student[],
  attendances: AttendanceRecord[],
  payments: Payment[]
) {
  const data = students.map((s, idx) => {
    // Derived status + last payment are computed from the live data at export
    // time (DAL-REQ-6 / STATUS-REQ-4 / S1): never read from stored fields.
    const info = deriveStudentStatus(
      s.active,
      calculateStudentFinances(s.id, attendances, payments)
    );
    const latestPayment = payments
      .filter((p) => p.studentId === s.id)
      .sort((a, b) => b.paymentDate.localeCompare(a.paymentDate))[0];

    return {
      '#': idx + 1,
      'ID': s.id,
      'Nombre Completo': s.name,
      'Teléfono': s.phone,
      'Estado': !info.active
        ? 'INACTIVO'
        : info.status === 'al_dia'
          ? 'AL DÍA'
          : 'CON DEUDA',
      'Último Pago ($)': latestPayment?.amount ?? 0,
      'Fecha Registro': s.registrationDate,
      'Notas': s.notes || ''
    };
  });

  const worksheet = XLSX.utils.json_to_sheet(data);
  worksheet['!cols'] = [
    { wch: 5 },
    { wch: 15 },
    { wch: 28 },
    { wch: 15 },
    { wch: 15 },
    { wch: 15 },
    { wch: 15 },
    { wch: 25 }
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Nómina Alumnos');

  XLSX.writeFile(workbook, `Nomina_Alumnos_IntenseStudio_${new Date().toISOString().slice(0, 10)}.xlsx`);
}
