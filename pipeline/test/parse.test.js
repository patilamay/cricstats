import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseMatch, resultText, dismissalText, overString } from '../parse.js';
import { CompetitionAggregator } from '../aggregate.js';
import { buildLeaders } from '../leaders.js';
import { fixtureMatch, ids } from './fixture.js';

const m = parseMatch(fixtureMatch, '999001');
const inn1 = m.innings[0];
const bat = (n) => inn1.batting.find((b) => b.name === n);
const bowl = (n) => inn1.bowling.find((b) => b.name === n);

test('innings totals include extras, exclude retired hurt from wickets', () => {
  assert.equal(inn1.runs, 26);
  assert.equal(inn1.wkts, 5);
  assert.equal(inn1.balls, 18);
  assert.equal(inn1.overs, '3');
  assert.deepEqual(inn1.extras, { b: 0, lb: 2, w: 1, nb: 1, p: 0 });
});

test('batting: wides not faced, no-balls faced, non-boundary 4 is not a four', () => {
  assert.deepEqual(
    (({ runs, balls, fours, sixes, out }) => ({ runs, balls, fours, sixes, out }))(bat('A1')),
    { runs: 5, balls: 2, fours: 1, sixes: 0, out: true },
  );
  assert.equal(bat('A1').how, 'run out (B1)');
  assert.equal(bat('A2').runs, 6);
  assert.equal(bat('A2').balls, 3);
  assert.equal(bat('A2').sixes, 1);
  assert.equal(bat('A2').how, 'c B2 b B1');
  assert.equal(bat('A3').runs, 11);
  assert.equal(bat('A3').balls, 6);
  assert.equal(bat('A3').fours, 0);
  assert.equal(bat('A3').out, false);
  assert.equal(bat('A4').how, 'lbw b B2');
  assert.equal(bat('A5').how, 'st B3 b B2');
  assert.equal(bat('A6').how, 'c & b B1');
  assert.equal(bat('A7').out, false);
  assert.equal(bat('A7').how, 'retired hurt');
  assert.equal(bat('A7').balls, 5);
  assert.deepEqual(inn1.batting.map((b) => b.name), ['A1', 'A2', 'A3', 'A4', 'A5', 'A6', 'A7']);
});

test('bowling: byes/leg-byes not charged, run outs not credited, maidens', () => {
  const b1 = bowl('B1');
  assert.equal(b1.balls, 12);
  assert.equal(b1.runs, 17);
  assert.equal(b1.wkts, 2);
  assert.equal(b1.maidens, 1);
  assert.equal(b1.dots, 8);
  const b2 = bowl('B2');
  assert.equal(b2.balls, 6);
  assert.equal(b2.runs, 7);
  assert.equal(b2.wkts, 2);
  assert.equal(b2.maidens, 0);
});

test('fielding credits', () => {
  const f = inn1.fielding.map((x) => `${x.name}:${x.kind}`).sort();
  assert.deepEqual(f, ['B1:ct', 'B1:ro', 'B2:ct', 'B3:st']);
});

test('result and dismissal text', () => {
  assert.equal(m.result, 'Team B won by 10 wickets');
  assert.equal(resultText({ winner: 'X', by: { innings: 1, runs: 1 } }), 'X won by an innings and 1 run');
  assert.equal(resultText({ winner: 'X', by: { runs: 12 }, method: 'D/L' }), 'X won by 12 runs (DLS)');
  assert.equal(resultText({ result: 'tie', eliminator: 'Y' }), 'Match tied (Y won the Super Over)');
  assert.equal(resultText({ result: 'draw' }), 'Match drawn');
  assert.equal(resultText({ result: 'no result' }), 'No result');
  assert.equal(dismissalText('caught', 'Bow', [{ name: 'Sub', substitute: true }]), 'c sub (Sub) b Bow');
  assert.equal(dismissalText('run out', 'Bow', [{ name: 'F1' }, { name: 'F2' }]), 'run out (F1/F2)');
  assert.equal(overString(19, 6), '3.1');
  assert.equal(overString(100, 5), '20');
});

test('aggregator: super overs excluded, duplicates ignored, season champion', () => {
  const agg = new CompetitionAggregator({ id: 'x', format: 'T20', seasonBy: 'season' });
  agg.add(m);
  agg.add(m); // same match id twice
  const out = agg.finalize();
  assert.equal(out.summary.matches, 1);
  const row = (n) => out.rows.find((r) => r.n === n);

  const a1 = row('A1');
  assert.equal(a1.id, ids.A1);
  assert.equal(a1.m, 1);
  assert.equal(a1.b.r, 5); // super-over six not counted
  assert.equal(a1.b.inn, 1);
  assert.equal(a1.b.no, 0);
  assert.equal(a1.b.sr, 250);
  assert.equal(a1.w.balls, 6);
  assert.equal(a1.w.r, 26);
  assert.equal(a1.w.econ, 26);

  const a3 = row('A3');
  assert.equal(a3.b.no, 1);
  assert.equal(a3.b.avg, null);
  assert.equal(a3.b.hs, 11);
  assert.equal(a3.b.hsNo, true);

  assert.equal(row('A4').b.d, 1); // duck
  assert.equal(row('A7').b.d, 0); // retired hurt on 0 is not a duck

  const b1 = row('B1');
  assert.equal(b1.b.r, 27);
  assert.equal(b1.b.f4, 5);
  assert.equal(b1.w.wk, 2);
  assert.equal(b1.w.bbi, '2/17');
  assert.equal(b1.w.md, 1);
  assert.deepEqual(b1.f, { ct: 1, st: 0, ro: 1 });
  assert.deepEqual(row('B3').f, { ct: 0, st: 1, ro: 0 });

  const teamB = out.teams.find((t) => t.team === 'Team B');
  assert.deepEqual([teamB.w, teamB.l], [1, 0]);
  assert.equal(out.seasons[0].champion, 'Team B');
  assert.equal(out.seasons[0].runs[0].n, 'B1');
  assert.equal(out.records.highestTotals[0].runs, 28);
  assert.equal(out.records.lowestTotals.length, 0); // nobody was all out
  assert.equal(out.records.bestFigures[0].name, 'B2'); // 2/7 beats 2/17

  const leaders = buildLeaders({ format: 'T20' }, out.rows, out.records);
  assert.equal(leaders.find((b) => b.key === 'runs').rows[0].n, 'B1');
  assert.equal(leaders.find((b) => b.key === 'hs').rows[0].v, '27*');
});
