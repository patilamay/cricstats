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

import { buildSeries, seasonLabel, summarise } from '../series.js';

const mk = (id, date, teams, event, extra = {}) => ({ id, date, teams, event, c: 'odi-m', winner: null, result: '', ...extra });

test('a series is one event name plus a continuous run of matches', () => {
  const list = [
    // An Ashes across New Year stays one series
    mk('a1', '2025-11-21', ['Australia', 'England'], 'The Ashes', { winner: 'Australia' }),
    mk('a2', '2025-12-26', ['Australia', 'England'], 'The Ashes', { winner: 'Australia' }),
    mk('a3', '2026-01-04', ['Australia', 'England'], 'The Ashes', { winner: 'England' }),
    // The same tour name in two different years: two series
    mk('t1', '2023-07-01', ['England', 'Sri Lanka'], 'Sri Lanka tour of England'),
    mk('t2', '2024-08-21', ['England', 'Sri Lanka'], 'Sri Lanka tour of England'),
    mk('x', '2024-01-01', ['Nepal', 'Oman'], null),
  ];
  const s = buildSeries(list);
  assert.equal(s.length, 3);
  const ashes = s.find((x) => x.n === 'The Ashes');
  assert.equal(ashes.id, 'the-ashes-2025-26');
  assert.equal(ashes.m, 3);
  assert.equal(ashes.r, 'Australia 2, England 1');
  assert.equal(ashes.major, 1);
  assert.deepEqual(s.filter((x) => x.n === 'Sri Lanka tour of England').map((x) => x.id).sort(), ['sri-lanka-tour-of-england-2023', 'sri-lanka-tour-of-england-2024']);
});

test('tournaments report the final; qualifiers are not major', () => {
  const list = [
    mk('w1', '2026-02-10', ['India', 'Pakistan'], "ICC Men's T20 World Cup", { winner: 'India' }),
    mk('w2', '2026-03-08', ['India', 'South Africa'], "ICC Men's T20 World Cup", { winner: 'India', stage: 'Final' }),
    mk('w3', '2026-02-11', ['Australia', 'England'], "ICC Men's T20 World Cup"),
    mk('q1', '2026-10-14', ['Nepal', 'Oman'], "ICC Men's T20 World Cup Sub Regional Asia Qualifier B"),
    mk('r1', '2025-07-01', ['Italy', 'Jersey'], "ICC Men's T20 World Cup Europe Region Final"),
  ];
  const s = buildSeries(list);
  const wc = s.find((x) => x.n === "ICC Men's T20 World Cup");
  assert.equal(wc.r, 'India won the final');
  assert.equal(wc.major, 1);
  assert.equal(s.find((x) => /Qualifier/.test(x.n)).major, 0);
  assert.equal(s.find((x) => /Region Final/.test(x.n)).major, 0);
  assert.equal(seasonLabel('2026-02-10', '2026-03-08'), '2026');
  assert.equal(summarise([mk('z', '2026-01-01', ['A', 'B'], 'x', { result: 'A won by 3 runs', winner: 'A' })]).text, 'A won by 3 runs');
});
