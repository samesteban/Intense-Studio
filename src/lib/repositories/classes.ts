import type { ClassSchedule } from '../../types';
import { classFromRow, classToRow, type ClassRow } from '../mappers';
import { supabaseClient } from '../supabaseClient';
import { repoError, type Repo } from './base';

const TABLE = 'class_schedules';

export const classesRepo: Repo<ClassSchedule> = {
  /** Deterministic order: by name, ties broken by id. */
  async list(): Promise<ClassSchedule[]> {
    const { data, error } = await supabaseClient
      .from(TABLE)
      .select('*')
      .order('name')
      .order('id');
    if (error) throw repoError('classes.list', error);
    return ((data as ClassRow[] | null) ?? []).map(classFromRow);
  },

  async upsert(cls: ClassSchedule): Promise<void> {
    const { error } = await supabaseClient
      .from(TABLE)
      .upsert(classToRow(cls), { onConflict: 'id' });
    if (error) throw repoError('classes.upsert', error);
  },

  async remove(id: string): Promise<void> {
    const { error } = await supabaseClient.from(TABLE).delete().eq('id', id);
    if (error) throw repoError('classes.remove', error);
  },
};
