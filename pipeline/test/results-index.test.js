import { test } from 'node:test';
import assert from 'node:assert/strict';
import { splitByYear } from '../results-index.js';

test('results split by year, newest first, without duplicates', () => {
  const a = [{ id: '3', date: '2026-02-01' }, { id: '1', date: '2025-12-30' }];
  const b = [{ id: '2', date: '2026-05-04' }, { id: '3', date: '2026-02-01' }, { id: 'h1', date: '1882-08-28' }, { id: 'x' }];
  const { years, byYear } = splitByYear([a, b]);
  assert.deepEqual(years, [[2026, 2], [2025, 1], [1882, 1]]);
  assert.deepEqual(byYear.get('2026').map((m) => m.id), ['2', '3']);
});
