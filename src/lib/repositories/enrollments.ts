import type { ClassEnrollment } from '../../types';
import { enrollmentFromRow, enrollmentToRow, type EnrollmentRow } from '../mappers';
import { supabaseClient } from '../supabaseClient';
import { repoError, type UpsertOptions } from './base';

const TABLE = 'class_enrollments';

/**
 * Junction repository (design decision 9 / DB-REQ-2).
 *
 * The PK is composite (class_id, student_id, day_of_week), so `remove` takes
 * the three key parts — deliberately not the single-id Repo.remove.
 */
export interface EnrollmentsRepo {
  list(): Promise<ClassEnrollment[]>;
  upsert(enr: ClassEnrollment, opts?: UpsertOptions): Promise<void>;
  remove(classId: string, studentId: string, dayOfWeek: number): Promise<void>;
  /**
   * Prune every junction row for a class whose `day_of_week` is no longer in
   * the class's `days_of_week` (Q3 resolution / design.md Risk "junction drift
   * when days_of_week shrinks"). Idempotent: rows on still-allowed days are
   * untouched, rows on removed days are deleted, 0 affected rows = success.
   * `allowedDays` comes from the class's current `days_of_week`.
   */
  pruneDays(classId: string, allowedDays: number[]): Promise<void>;
}

export const enrollmentsRepo: EnrollmentsRepo = {
  /** Deterministic order: class, then student, then day. */
  async list(): Promise<ClassEnrollment[]> {
    const { data, error } = await supabaseClient
      .from(TABLE)
      .select('*')
      .order('class_id')
      .order('student_id')
      .order('day_of_week');
    if (error) throw repoError('enrollments.list', error);
    return ((data as EnrollmentRow[] | null) ?? []).map(enrollmentFromRow);
  },

  async upsert(enr: ClassEnrollment, opts?: UpsertOptions): Promise<void> {
    const row = enrollmentToRow(enr);
    if (opts?.updatedAt) row.updated_at = opts.updatedAt;
    const { error } = await supabaseClient
      .from(TABLE)
      .upsert(row, {
        onConflict: 'class_id,student_id,day_of_week',
      });
    if (error) throw repoError('enrollments.upsert', error);
  },

  async remove(classId: string, studentId: string, dayOfWeek: number): Promise<void> {
    const { error } = await supabaseClient
      .from(TABLE)
      .delete()
      .eq('class_id', classId)
      .eq('student_id', studentId)
      .eq('day_of_week', dayOfWeek);
    if (error) throw repoError('enrollments.remove', error);
  },

  async pruneDays(classId: string, allowedDays: number[]): Promise<void> {
    let query = supabaseClient
      .from(TABLE)
      .delete()
      .eq('class_id', classId);
    if (allowedDays.length > 0) {
      query = query.not('day_of_week', 'in', `(${allowedDays.join(',')})`);
    }
    const { error } = await query;
    if (error) throw repoError('enrollments.pruneDays', error);
  },
};
