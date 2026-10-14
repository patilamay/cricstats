import { test } from 'node:test';
import assert from 'node:assert/strict';
import { combine } from '../careers.js';

const wikiCol = (o) => ({
  m: 10, r: 500, avg: 50, c100: 1, c50: 3, hs: 120, hsNo: false, balls: 600, wk: 10, bavg: 30,
  w5: 1, w10: 0, bbi: { w: 5, r: 40 }, ct: 4, st: 0, ...o,
});
const csRow = (m, extra = {}) => ({
  id: 'p', n: 'P', t: ['X'], m,
  b: { inn: m, no: 0, r: m * 40, bf: m * 60, hs: 90, hsNo: false, avg: 40, sr: 66.67, c50: 1, c100: 0, d: 0, f4: 0, s6: 0 },
  w: { inn: m, balls: m * 60, r: m * 50, wk: m, md: 0, dots: 0, avg: 50, econ: 5, sr: 60, bbi: '3/20', w4: 0, w5: 0 },
  f: { ct: m, st: 0, ro: 0 },
  ...extra,
});
const line = (d, o = {}) => ({ d, r: 30, out: 1, n100: 0, n50: 0, hs: 30, hsNo: false, bb: 60, rc: 25, wk: 2, w5: 0, bbiW: 2, bbiR: 25, ct: 1, st: 0, ...o });

test('retired legend: Wikipedia only (not in Cricsheet)', () => {
  const c = combine({ wiki: { asof: '1949-01-01', f: wikiCol({ m: 52, r: 6996, avg: 99.94, c100: 29, c50: 13, hs: 334, wk: 2, bavg: 36, balls: 160 }) } });
  assert.equal(c.src, 'w');
  assert.equal(c.m, 52);
  assert.equal(c.r, 6996);
  assert.equal(c.avg, 99.94);
  assert.equal(c.bavg, 36);
});

test('Cricsheet partial career: Wikipedia totals win, nothing added after the as-of date', () => {
  const c = combine({ wiki: { asof: '2024-08-01', f: wikiCol({ m: 188, wk: 704 }) }, csRow: csRow(180), ledger: [line('2024-07-10')] });
  assert.equal(c.src, 'w');
  assert.equal(c.m, 188);
  assert.equal(c.wk, 704);
});

test('active player: Wikipedia as-of total plus later Cricsheet matches', () => {
  const ledger = [line('2025-01-05'), line('2026-02-01', { r: 150, n100: 1, hs: 150, wk: 0, bb: 0, rc: 0, bbiW: -1 }), line('2024-12-01')];
  const c = combine({ wiki: { asof: '2025-01-01', f: wikiCol() }, csRow: csRow(8), ledger });
  assert.equal(c.src, 'wc');
  assert.equal(c.m, 12);
  assert.equal(c.r, 500 + 30 + 150);
  assert.equal(c.c100, 2);
  assert.equal(c.hs, 150);
  assert.equal(c.wk, 12);
  assert.equal(c.ct, 6);
  assert.equal(c.avg, round2(680 / 12));
  assert.equal(c.bavg, round2((300 + 25) / 12));
});

test('Cricsheet covers the whole career: use Cricsheet alone', () => {
  const c = combine({ wiki: { asof: '2020-01-01', f: wikiCol({ m: 5 }) }, csRow: csRow(9), ledger: [line('2021-01-01')] });
  assert.equal(c.src, 'c');
  assert.equal(c.m, 9);
});

test('no Wikipedia page: Cricsheet alone; no date on Wikipedia: no additions', () => {
  assert.equal(combine({ csRow: csRow(3) }).src, 'c');
  assert.equal(combine({}), null);
  const c = combine({ wiki: { asof: null, f: wikiCol({ m: 40 }) }, csRow: csRow(20), ledger: [line('2026-01-01')] });
  assert.equal(c.m, 40);
  assert.equal(c.src, 'w');
});

test('unknown runs conceded (balls bowled, no wickets) leaves bowling average and economy blank', () => {
  const c = combine({ wiki: { asof: '2000-01-01', f: wikiCol({ wk: 0, bavg: null, balls: 30, bbi: null }) } });
  assert.equal(c.bavg, null);
  assert.equal(c.econ, null);
});

function round2(x) { return Math.round(x * 100) / 100; }
