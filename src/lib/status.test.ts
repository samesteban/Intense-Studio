/**
 * Unit tests for deriveStudentStatus (tasks.md 3.6, STATUS-REQ-2..4).
 *
 * Locks the pure derivation contract: active + no debt -> al_dia, active +
 * debt -> con_deuda, inactive -> { active: false } (excluded, never a badge).
 *
 * Node env: status.ts is pure (no localStorage / DOM), so it runs directly.
 */
import { describe, expect, it } from 'vitest';
import { deriveStudentStatus } from './status';
import type { StudentFinancialSummary } from '../utils/pricing';

function financesOf(debt: number, status: 'al_dia' | 'con_deuda'): StudentFinancialSummary {
  return {
    studentId: 'std-x',
    totalAttendances: 1,
    totalCost: 1000,
    totalPaid: 1000 - debt,
    debt,
    status,
    itemizedAttendances: [],
  };
}

describe('deriveStudentStatus', () => {
  it('active + no debt -> al_dia (STATUS-REQ-2)', () => {
    expect(deriveStudentStatus(true, financesOf(0, 'al_dia'))).toEqual({
      active: true,
      status: 'al_dia',
    });
  });

  it('active + debt -> con_deuda (STATUS-REQ-2)', () => {
    const withDebt = financesOf(500, 'con_deuda');
    expect(deriveStudentStatus(true, withDebt)).toEqual({
      active: true,
      status: 'con_deuda',
    });
  });

  it('inactive student is excluded, never finances-derived (STATUS-REQ-2)', () => {
    // Even with outstanding debt the result must NOT be a finance badge.
    const withDebt = financesOf(500, 'con_deuda');
    expect(deriveStudentStatus(false, withDebt)).toEqual({ active: false });
  });

  it('never produces the legacy inactivo value (STATUS-REQ-3)', () => {
    const result = deriveStudentStatus(false, financesOf(0, 'al_dia'));
    expect('status' in result).toBe(false);
    expect('inactivo' in result).toBe(false);
  });

  it('result is only ever al_dia or con_deuda for active students (STATUS-REQ-3)', () => {
    const noDebt = deriveStudentStatus(true, financesOf(0, 'al_dia'));
    const debt = deriveStudentStatus(true, financesOf(100, 'con_deuda'));
    expect(['al_dia', 'con_deuda']).toContain(
      noDebt.active ? noDebt.status : '',
    );
    expect(['al_dia', 'con_deuda']).toContain(debt.active ? debt.status : '');
  });
});