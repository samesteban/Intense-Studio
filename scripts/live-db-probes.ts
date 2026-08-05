/**
 * Live-DB probes — deferred verification from sdd-verify (verify report W1).
 *
 * These were blocked on the absence of a real Supabase project for Intense
 * Studio. Now that one exists (option A: paused another project to free the
 * slot), each probe re-verifies a documented acceptance behavior directly
 * against the live PostgREST Data API using the publishable (anon) key — the
 * exact permission surface the app uses. Reads .env (VITE_SUPABASE_URL /
 * VITE_SUPABASE_PUBLISHABLE_KEY); uses dotenv + the app's own supabase client.
 *
 * Probes (see design.md Sequence A/4.4 and spec.md behaviors):
 *   P1 RLS write         — anon role can INSERT a row (push path gate).
 *   P2 Composite upsert  — class_enrollments onConflict(class,student,day)
 *   P3 Guard-trigger LWW — updated_at survives replay when supplied.
 *   P4 Receipt duplicate — payments.receipt_number UNIQUE -> 23505 surfaces as
 *                          a fatal error the queue quarantine badge catches.
 *   P5 pruneDays query   — .not('day_of_week','in',...) shape reaches PostgREST.
 *
 * The connection to the app client is the point: this is not a raw curl; it
 * exercises the same createClient options and REST calls the app makes.
 */
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const url = process.env.VITE_SUPABASE_URL;
const key = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
if (!url || !key) {
  throw new Error('Missing VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY in .env');
}

const client = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
});

const results: { probe: string; pass: boolean; detail: string }[] = [];
function record(probe: string, pass: boolean, detail: string) {
  results.push({ probe, pass, detail });
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${probe}  — ${detail}`);
}

const studentId = `probe-${Date.now()}`;
const classId = `probe-class-${Date.now()}`;

async function main() {
  try {
    // Seed a parent student + class for FK-referencing probes.
    await client.from('students').insert({
      id: studentId,
      name: 'Probe Live DB',
      phone: '+5691000',
      registration_date: '2026-08-05',
      active: true,
    });
    await client.from('class_schedules').insert({
      id: classId,
      name: 'Probe Class',
      start_time: '10:00',
      end_time: '11:00',
      days_of_week: [1, 3, 5],
      max_capacity: 20,
      color: '#7628A6',
    });

    // P1 — RLS anon write is proven by the seeded insert above; assert the row landed.
    {
      const { data, error } = await client
        .from('students')
        .select('id')
        .eq('id', studentId);
      record('P1 RLS anon write', !error && data?.length === 1, error?.message ?? 'row inserted');
    }

    // P2 — composite-key upsert: same key twice -> upsert (single row, no dup).
    {
      const row = { class_id: classId, student_id: studentId, day_of_week: 1, updated_at: '2026-08-05T10:00:00Z' };
      const first = await client.from('class_enrollments').upsert(row, {
        onConflict: 'class_id,student_id,day_of_week',
      });
      const second = await client.from('class_enrollments').upsert(row, {
        onConflict: 'class_id,student_id,day_of_week',
      });
      const { data, error } = await client
        .from('class_enrollments')
        .select('day_of_week')
        .eq('class_id', classId)
        .eq('student_id', studentId);
      const pass = !first.error && !second.error && !error && data?.length === 1;
      record(
        'P2 Composite upsert',
        pass,
        error?.message ?? (data?.length === 1 ? 'single row after double upsert' : `rows=${data?.length}`),
      );
    }

    // P3 — guard-trigger LWW: explicit updated_at must survive (not bumped to now()).
    {
      const supplied = '2026-08-04T08:00:00Z';
      const { error: upErr } = await client
        .from('students')
        .update({ notes: 'lww-probe', updated_at: supplied })
        .eq('id', studentId);
      const { data } = await client.from('students').select('updated_at').eq('id', studentId);
      const stored = data?.[0]?.updated_at;
      // Compare instants, not strings: PostgREST renders timestamptz with a
      // `+00:00` offset while we supplied `Z` — same instant, different text.
      const pass =
        !upErr &&
        stored !== undefined &&
        new Date(stored).getTime() === new Date(supplied).getTime();
      record(
        'P3 Guard-trigger LWW',
        pass,
        upErr?.message ?? `supplied=${supplied} stored=${stored} sameInstant=${pass}`,
      );
    }

    // P4 — receipt_number UNIQUE: second payment with same receipt -> 23505.
    {
      await client.from('payments').insert({
        id: `probe-pay-${Date.now()}`,
        student_id: studentId,
        student_name: 'Probe Live DB',
        amount: 2000,
        payment_method: 'efectivo',
        payment_date: '2026-08-05',
        receipt_number: 'R-PROBE-1',
      });
      const second = await client.from('payments').insert({
        id: `probe-pay-dup-${Date.now()}`,
        student_id: studentId,
        student_name: 'Probe Live DB',
        amount: 2000,
        payment_method: 'efectivo',
        payment_date: '2026-08-05',
        receipt_number: 'R-PROBE-1',
      });
      const code = second.error?.code;
      const pass = !!second.error && (code === '23505' || /duplicate key/i.test(second.error.message));
      record(
        'P4 Receipt duplicate 23505',
        pass,
        second.error?.message ?? 'no error — UNIQUE not enforced?',
      );
    }

    // P5 — pruneDays query shape: .not('day_of_week','in',(2,3)) exercises the
    // exact PostgREST filter. AllowedDays [1,5] -> remove rows on 2,3 (none seeded).
    {
      const { error } = await client
        .from('class_enrollments')
        .delete()
        .eq('class_id', classId)
        .not('day_of_week', 'in', '(1,5)');
      record(
        'P5 pruneDays .not() filter',
        !error,
        error?.message ?? 'filter accepted, 0 rows targeted (expected)',
      );
    }
  } catch (e) {
    record('unexpected error', false, e instanceof Error ? e.message : String(e));
  } finally {
    // Cleanup seeded rows (best-effort; deletes are CASCADE from student/class).
    await client.from('students').delete().eq('id', studentId);
    await client.from('class_schedules').delete().eq('id', classId);
    await client.from('payments').delete().ilike('id', 'probe-pay-%');
  }

  const failed = results.filter((r) => !r.pass).length;
  console.log(`\n${results.length - failed}/${results.length} probes passed`);
  if (failed > 0) process.exitCode = 1;
}

void main();