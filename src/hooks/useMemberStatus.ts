/**
 * useMemberStatus — memoized derived status hook (tasks.md 3.6, STATUS-REQ-4).
 *
 * Recomputes a student's financial status via useMemo whenever the underlying
 * attendances or payments change. Nothing derived is ever persisted — the hook
 * only feeds the render tree (DAL-REQ-6, STATUS-REQ-4 "Refresh recomputes").
 */
import { useMemo } from 'react';
import type { AttendanceRecord, Payment, Student } from '../types';
import { calculateStudentFinances } from '../utils/pricing';
import { deriveStudentStatus, type MemberStatusInfo } from '../lib/status';

/**
 * Memoized derived status for a single student.
 *
 * `student.active` is the manual flag (STATUS-REQ-1/DAL-REQ-5); the finance
 * status is computed from the current attendances + payments at render time.
 */
export function useMemberStatus(
  student: Pick<Student, 'id' | 'active'>,
  attendances: AttendanceRecord[],
  payments: Payment[],
): MemberStatusInfo {
  const finances = useMemo(
    () => calculateStudentFinances(student.id, attendances, payments),
    [student.id, attendances, payments],
  );

  const info = useMemo(
    () => deriveStudentStatus(student.active, finances),
    [student.active, finances],
  );

  return info;
}
