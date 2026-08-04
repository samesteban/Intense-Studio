/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type MemberStatus = 'al_dia' | 'con_deuda' | 'inactivo';
export type PaymentMethod = 'efectivo' | 'transferencia' | 'debito' | 'credito';

export interface Student {
  id: string; // Auto-generated UUID or unique ID
  name: string;
  phone: string;
  email?: string;
  registrationDate: string; // ISO string YYYY-MM-DD
  status: MemberStatus;
  lastPaymentAmount?: number;
  lastPaymentDate?: string;
  notes?: string;
  emergencyContact?: string;
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
  notes?: string;
}

export interface OfflineSyncItem {
  id: string;
  action: 'CREATE_STUDENT' | 'UPDATE_STUDENT' | 'RECORD_PAYMENT' | 'RECORD_ATTENDANCE' | 'CREATE_CLASS';
  entity: string;
  payload: any;
  timestamp: string;
}

export interface IncomeReportSummary {
  totalMonth: number;
  totalWeek: number;
  totalToday: number;
  byMethod: Record<PaymentMethod, number>;
  monthlyTrends: { month: string; amount: number; count: number }[];
}
