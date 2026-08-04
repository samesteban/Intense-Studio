/**
 * Repository contract (design.md Interfaces / DAL-REQ-2).
 *
 * Every Supabase query in the app lives inside a repository. Components and
 * the DataProvider only ever call repo methods — never supabase directly.
 *
 * Note: `class_enrollments` deviates from this interface — its PK is the
 * composite (class_id, student_id, day_of_week), so `remove` takes the three
 * key parts instead of a single id (see enrollments.ts).
 */
/**
 * Optional upsert options.
 *
 * `updatedAt` is the LWW override used by the offline sync replay (PR 4):
 * executors pass the queue item timestamp so the `set_updated_at` guard
 * trigger preserves it instead of stamping now(). Ordinary writes omit it —
 * the trigger stamps now() for them.
 */
export interface UpsertOptions {
  updatedAt?: string;
}

export interface Repo<T> {
  list(): Promise<T[]>;
  upsert(row: T, opts?: UpsertOptions): Promise<void>;
  remove(id: string): Promise<void>;
}

/** Wrap a Supabase PostgrestError into an Error with repo context. */
export function repoError(context: string, error: unknown): Error {
  const message = error instanceof Error ? error.message : String(error);
  return new Error(`${context} failed: ${message}`);
}
