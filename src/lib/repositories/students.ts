import type { Student } from '../../types';
import { studentFromRow, studentToRow, type StudentRow } from '../mappers';
import { supabaseClient } from '../supabaseClient';
import { repoError, type Repo } from './base';

const TABLE = 'students';

export const studentsRepo: Repo<Student> = {
  /** Deterministic order (DAL-REQ-2): by name, ties broken by id. */
  async list(): Promise<Student[]> {
    const { data, error } = await supabaseClient
      .from(TABLE)
      .select('*')
      .order('name')
      .order('id');
    if (error) throw repoError('students.list', error);
    return ((data as StudentRow[] | null) ?? []).map(studentFromRow);
  },

  async upsert(student: Student): Promise<void> {
    const { error } = await supabaseClient
      .from(TABLE)
      .upsert(studentToRow(student), { onConflict: 'id' });
    if (error) throw repoError('students.upsert', error);
  },

  async remove(id: string): Promise<void> {
    const { error } = await supabaseClient.from(TABLE).delete().eq('id', id);
    if (error) throw repoError('students.remove', error);
  },
};
