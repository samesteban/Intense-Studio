import type { AttendanceRecord } from '../../types';
import { attendanceFromRow, attendanceToRow, type AttendanceRow } from '../mappers';
import { supabaseClient } from '../supabaseClient';
import { repoError, type Repo, type UpsertOptions } from './base';

const TABLE = 'attendance_records';

export const attendanceRepo: Repo<AttendanceRecord> = {
  /** Deterministic order: newest date/time first, ties by id. */
  async list(): Promise<AttendanceRecord[]> {
    const { data, error } = await supabaseClient
      .from(TABLE)
      .select('*')
      .order('date', { ascending: false })
      .order('time', { ascending: false })
      .order('id');
    if (error) throw repoError('attendance.list', error);
    return ((data as AttendanceRow[] | null) ?? []).map(attendanceFromRow);
  },

  async upsert(att: AttendanceRecord, opts?: UpsertOptions): Promise<void> {
    const row = attendanceToRow(att);
    if (opts?.updatedAt) row.updated_at = opts.updatedAt;
    const { error } = await supabaseClient
      .from(TABLE)
      .upsert(row, { onConflict: 'id' });
    if (error) throw repoError('attendance.upsert', error);
  },

  async remove(id: string): Promise<void> {
    const { error } = await supabaseClient.from(TABLE).delete().eq('id', id);
    if (error) throw repoError('attendance.remove', error);
  },
};
