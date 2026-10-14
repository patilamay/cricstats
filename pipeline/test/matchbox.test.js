import { test } from 'node:test';
import assert from 'node:assert/strict';
import { findMatchBoxes, parseMatchBox, classify, parseScore, parseBatting, parseBowling, parseDate, cricinfoId, teamName, findFullScorecards } from '../matchbox.js';

// Verbatim from the Wikipedia article on the first-ever Test (fetched by the CI probe).
const FIRST_TEST = `==Test series==
===1st Test===
{{Two-innings cricket match
| date = 15–19 March 1877<br />([[Timeless Test]])
| team1 = {{cr-rt|AUS|colonial}}
| team2 = {{cr|ENG}}

| score-team1-inns1 = 245 (169.3 overs)
| runs-team1-inns1 = [[Charles Bannerman]] 165 ([[retired hurt|r/h]])
| wickets-team1-inns1 = [[Alfred Shaw]] 3/51 (55.3 overs)

| score-team2-inns1 = 196 (136.1 overs)
| runs-team2-inns1 = [[Harry Jupp]] 63 (241)
| wickets-team2-inns1 = [[Billy Midwinter]] 5/78 (54 overs)

| score-team1-inns2 = 104 (68 overs)
| runs-team1-inns2 = [[Tom Horan]] 20 (32)
| wickets-team1-inns2 = [[Alfred Shaw]] 5/38 (34 overs)

| score-team2-inns2 = 108 (66.1 overs)
| runs-team2-inns2 = [[John Selby (cricketer)|John Selby]] 38 (81)
| wickets-team2-inns2 = [[Tom Kendall]] 7/55 (33.1 overs)

| result = Australia won by 45 runs
| venue = [[Melbourne Cricket Ground]], [[Melbourne]]
| umpires = [[Curtis Reid (cricketer)|Curtis Reid]] (Aus) and [[Ben Terry]] (Eng)
| motm =
| toss = Australia won the toss and elected to bat.
| report = [http://www.espncricinfo.com/ci/engine/match/62396.html Scorecard]
| rain =
}}
==Tour matches==
{{Two-innings cricket match
| date = 1 April 1877
| team1 = [[Victoria cricket team|Victoria]]
| team2 = {{cr|ENG}}
| score-team1-inns1 = 100
}}`;

const WC75 = `==Group A==
{{Single-innings cricket match
| date = 18 June 1975
| team1 = {{cr-rt|ENG}}
| team2 = {{cr|AUS}}
| score1 = 93 (36.2 overs)
| runs1 = [[Mike Denness]] 27 (60)
| wickets1 = [[Gary Gilmour]] 6/14 (12 overs)
| score2 = 94/6 (28.4 overs)
| runs2 = [[Gary Gilmour]] 28[[not out|*]] (28)
| wickets2 = [[Chris Old]] 3/29 (7 overs)
| result = Australia won by 4 wickets
| report = [http://www.cricinfo.com/ci/engine/match/65047.html Scorecard]
| venue = [[Headingley Cricket Ground|Headingley]], Leeds
| umpires = [[Bill Alley]] (Eng) and [[David Constant]] (Eng)
| motm = [[Gary Gilmour]] (Aus)
}}`;

test('finds boxes with their section headings', () => {
  const boxes = findMatchBoxes(FIRST_TEST);
  assert.equal(boxes.length, 2);
  assert.deepEqual(boxes[0].headings, ['Test series', '1st Test']);
  assert.deepEqual(boxes[1].headings, ['Tour matches']);
});

test('parses the first-ever Test', () => {
  const [box, tour] = findMatchBoxes(FIRST_TEST);
  const m = parseMatchBox(box);
  assert.equal(m.date, '1877-03-15');
  assert.deepEqual(m.teams, ['Australia', 'England']);
  assert.equal(m.national, true);
  assert.equal(m.innings.length, 4);
  assert.deepEqual(m.innings.map((i) => `${i.team} ${i.r}/${i.w}`), ['Australia 245/10', 'England 196/10', 'Australia 104/10', 'England 108/10']);
  assert.deepEqual(m.innings[0].bat[0], { name: 'Charles Bannerman', title: 'Charles Bannerman', runs: 165, no: true, balls: null });
  assert.deepEqual(m.innings[1].bowl[0], { name: 'Billy Midwinter', title: 'Billy Midwinter', w: 5, r: 78, overs: '54' });
  assert.equal(m.innings[3].bat[0].name, 'John Selby');
  assert.equal(m.innings[3].bat[0].title, 'John Selby (cricketer)');
  assert.equal(m.result, 'Australia won by 45 runs');
  assert.equal(m.venue, 'Melbourne Cricket Ground, Melbourne');
  assert.equal(m.cricinfo, '62396');
  assert.equal(classify(m, 'English cricket team in Australia in 1876–77'), 'test-m');
  assert.equal(classify(parseMatchBox(tour) || { national: false }, 'x'), null);
});

test('parses a World Cup ODI box', () => {
  const m = parseMatchBox(findMatchBoxes(WC75)[0]);
  assert.equal(m.date, '1975-06-18');
  assert.deepEqual(m.innings.map((i) => `${i.team} ${i.r}/${i.w} (${i.overs})`), ['England 93/10 (36.2)', 'Australia 94/6 (28.4)']);
  assert.deepEqual(m.innings[1].bat[0], { name: 'Gary Gilmour', title: 'Gary Gilmour', runs: 28, no: true, balls: 28 });
  assert.equal(m.pom, 'Gary Gilmour (Aus)');
  assert.equal(m.cricinfo, '65047');
  assert.equal(classify(m, '1975 Cricket World Cup'), 'odi-m');
});

test('score, performer, date and team helpers', () => {
  assert.deepEqual(parseScore('425/8d (150 overs)'), { r: 425, w: 8, dec: true, overs: '150', fo: false });
  assert.deepEqual(parseScore('107 (f/o)'), { r: 107, w: 10, dec: false, overs: null, fo: true });
  assert.equal(parseScore(''), null);
  assert.deepEqual(parseScore('0/19 (5 overs)'), { r: 19, w: 0, dec: false, overs: '5', fo: false });
  assert.equal(parseScore('3/250').r, 250);
  assert.deepEqual(parseScore('27–0 (6.3 overs)'), { r: 27, w: 0, dec: false, overs: '6.3', fo: false });
  assert.equal(parseScore('480–5d').w, 5);
  assert.equal(parseBatting('[[A B]] 101 (150)<br />[[C D|C. D.]] 55* (60)').length, 2);
  assert.equal(parseBatting('[[C D|C. D.]] 55* (60)')[0].no, true);
  assert.equal(parseBowling('[[E F]] 4/30 (10 overs)<br>[[G H]] 2/20')[1].w, 2);
  assert.equal(parseDate('30 December 1932 – 3 January 1933'), '1932-12-30');
  assert.equal(parseDate('March 1877'), '1877-03-01');
  assert.equal(cricinfoId('[https://www.espncricinfo.com/series/x-123/aus-vs-eng-1st-test-1234567/full-scorecard Scorecard]'), '1234567');
  assert.deepEqual(teamName('{{cr|IND-W}}'), { name: 'India', code: 'IND', women: true, national: true });
  assert.equal(teamName('[[Kent County Cricket Club|Kent]]').national, false);
});

test('dates without a year take it from the article season; more templates and team forms', () => {
  assert.equal(parseDate('2–7 December<br />([[Timeless Test]])', 'English cricket team in Australia in 1932–33'), '1932-12-02');
  assert.equal(parseDate('10–16 February', 'English cricket team in Australia in 1932–33'), '1933-02-10');
  const lo = findMatchBoxes('==Final==\n{{Limited overs international\n |date = 25 June 1983\n |team1 = {{cr-rt|IND}}\n |score1 = 183 (54.4 overs)\n |team2 = {{cr|WIN}}\n |score2 = 140 (52 overs)\n |result = India won by 43 runs\n}}');
  const m = parseMatchBox(lo[0], '1983 Cricket World Cup');
  assert.deepEqual(m.innings.map((i) => `${i.team} ${i.r}`), ['India 183', 'West Indies 140']);
  assert.equal(classify(m, '1983 Cricket World Cup'), 'odi-m');
  assert.equal(teamName('{{cr|India}}').name, 'India');
  assert.equal(teamName('{{cr|India}}').national, true);
  assert.equal(teamName('{{cr|ENG|A}}').national, false);
  assert.equal(teamName('{{cr|GUYANA}}').national, false);
  assert.equal(teamName('{{cr|NGA}}').name, 'Nigeria');
});

test('full scorecards from batting/bowling box templates', () => {
  const text = `==Scorecard==
{{Cricket match batting box begin|title={{cr|IND}} batting<ref name="f">{{cite web |url=https://www.espncricinfo.com/series/prudential-world-cup-1983-60832/india-vs-west-indies-final-65090/full-scorecard}}</ref>}}
{{Cricket match batsman status|player=[[Sunil Gavaskar]]|status=c †Dujon b Roberts|runs=2|balls=12|4s=0|6s=0|strike_rate=16.66}}
{{Cricket match batsman status|player=[[Kapil Dev]] *|status=c Holding b Gomes|runs=15|balls=8|4s=3|6s=0}}
{{Cricket match batsman status|player=[[Balwinder Sandhu]]|status=not out|runs=11|balls=30|4s=1|6s=0}}
{{Cricket match batsman status|player=Extras|status=(b 5, lb 5, w 9, nb 1)|runs=20}}
{{Cricket match batsman status|player='''Total'''|status=(all out; 54.4 overs)|runs='''183'''}}
{{Cricket match box end}}
{{Cricket match bowling box begin|title={{cr|WIN}} bowling}}
{{Cricket match bowler status|bowler=[[Andy Roberts (cricketer)|Andy Roberts]]|overs=10|maiden=3|runs=32|wickets=3|econ=3.20|wides=0|no-balls=0}}
{{Cricket match box end}}`;
  const [card] = findFullScorecards(text);
  assert.equal(card.cricinfo, '65090');
  const inn = card.innings[0];
  assert.equal(inn.team, 'India');
  assert.equal(inn.total, 183);
  assert.equal(inn.wkts, 10);
  assert.equal(inn.overs, '54.4');
  assert.equal(inn.extras, 20);
  assert.deepEqual(inn.bat.map((b) => `${b.name} ${b.runs}${b.no ? '*' : ''} (${b.balls})`), ['Sunil Gavaskar 2 (12)', 'Kapil Dev 15 (8)', 'Balwinder Sandhu 11* (30)']);
  assert.equal(inn.bat[1].captain, true);
  assert.equal(inn.bat[0].how, 'c †Dujon b Roberts');
  assert.deepEqual(inn.bowl[0], { name: 'Andy Roberts', title: 'Andy Roberts (cricketer)', overs: '10', maidens: 3, runs: 32, wkts: 3, wides: 0, noballs: 0 });
});

test('dedupe merges copies of the same match from different articles', async () => {
  const { dedupe } = await import('../history.js');
  const base = { comp: 'test-m', teams: ['A', 'B'], innings: [{ team: 'A', r: 300, w: 10, bat: [], bowl: [] }, { team: 'B', r: 250, w: 10, bat: [], bowl: [] }] };
  const out = dedupe([
    { ...base, date: '2005-01-02', cricinfo: null },
    { ...base, date: '2005-01-03', cricinfo: '111', venue: 'X' },
    { ...base, date: '2005-02-10', innings: [{ team: 'A', r: 100, w: 10, bat: [], bowl: [] }] },
  ]);
  assert.equal(out.length, 2);
  assert.equal(out.find((m) => m.innings.length === 2).cricinfo, '111');
});

test('extractFromArticle keeps Tests, drops tour games', async () => {
  const { extractFromArticle } = await import('../history.js');
  const out = extractFromArticle('English cricket team in Australia in 1876–77', FIRST_TEST);
  assert.equal(out.length, 1);
  assert.equal(out[0].comp, 'test-m');
  assert.equal(out[0].article, 'English cricket team in Australia in 1876–77');
});
