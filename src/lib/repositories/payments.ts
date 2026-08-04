import type { Payment } from '../../types';
import { paymentFromRow, paymentToRow, type PaymentRow } from '../mappers';
import { supabaseClient } from '../supabaseClient';
import { repoError, type Repo } from './base';

const TABLE = 'payments';

export const paymentsRepo: Repo<Payment> = {
  /** Deterministic order: newest payment date first, ties by id. */
  async list(): Promise<Payment[]> {
    const { data, error } = await supabaseClient
      .from(TABLE)
      .select('*')
      .order('payment_date', { ascending: false })
      .order('id');
    if (error) throw repoError('payments.list', error);
    return ((data as PaymentRow[] | null) ?? []).map(paymentFromRow);
  },

  async upsert(payment: Payment): Promise<void> {
    const { error } = await supabaseClient
      .from(TABLE)
      .upsert(paymentToRow(payment), { onConflict: 'id' });
    if (error) throw repoError('payments.upsert', error);
  },

  async remove(id: string): Promise<void> {
    const { error } = await supabaseClient.from(TABLE).delete().eq('id', id);
    if (error) throw repoError('payments.remove', error);
  },
};
