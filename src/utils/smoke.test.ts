import { describe, expect, it } from 'vitest';

// Harness smoke test: proves vitest runs in the node environment and that the
// '@' alias configured in vitest.config.ts resolves at runtime. Deliberately
// trivial — it is a harness proof, not feature coverage (see pricing.test.ts).
//
// Note: the project's '@' alias maps to the repo root (tsconfig paths
// "@/*" -> "./*"), so the alias form of a src path is '@/src/...'.
import { calculateStudentFinances } from '@/src/utils/pricing';

describe('vitest harness smoke test', () => {
  it('runs a pure function in the node environment via the @ alias', () => {
    expect(typeof calculateStudentFinances).toBe('function');
    const summary = calculateStudentFinances('smoke-student', [], []);
    expect(summary.totalCost).toBe(0);
    expect(summary.totalPaid).toBe(0);
    expect(summary.debt).toBe(0);
    expect(summary.status).toBe('al_dia');
  });
});
