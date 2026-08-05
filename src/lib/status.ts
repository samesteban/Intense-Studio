/**
 * Derived member status (STATUS-REQ-2..4, DAL-REQ-6).
 *
 * Financial status is ALWAYS computed client-side from the pricing engine and
 * NEVER persisted. `deriveStudentStatus` maps the manual `active` flag plus a
 * student's financial summary into the display shape the UI needs:
 *
 *   - active student  -> { active: true,  status: 'al_dia' | 'con_deuda' }
 *   - inactive student-> { active: false }  (excluded from finance status)
 *
 * The discriminant keeps STATUS-REQ-2 and STATUS-REQ-3: the `inactivo` legacy
 * value is gone; inactivity is represented solely by `active = false`, and the
 * UI renders an inactive marker instead of a finance badge (STATUS-REQ-6).
 */
import type { MemberStatus } from '../types';
import type { StudentFinancialSummary } from '../utils/pricing';

/** Derived status shape consumed by the UI. */
export type MemberStatusInfo =
  | { active: true; status: MemberStatus }
  | { active: false };

/**
 * Pure status derivation (tasks.md 3.6, STATUS-REQ-2).
 *
 * Inactive students are excluded from finance-derived status: they return
 * `{ active: false }` and callers render the inactive marker, never an
 * `al_dia`/`con_deuda` badge.
 */
export function deriveStudentStatus(
  active: boolean,
  finances: StudentFinancialSummary,
): MemberStatusInfo {
  if (!active) return { active: false };
  return { active: true, status: finances.status };
}
