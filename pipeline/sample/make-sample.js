#!/usr/bin/env node
// Generates SYNTHETIC matches in Cricsheet JSON format for local development
// (fake teams and players). Real data comes from cricsheet.org in CI.
//
//   node pipeline/sample/make-sample.js .cache/sample
//   node pipeline/build.js --local .cache/sample

import fs from 'node:fs';
import path from 'node:path';

const outDir = path.resolve(process.argv[2] || '.cache/sample');
let seed = 42;
const rand = () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; };
const pick = (a) => a[Math.floor(rand() * a.length)];

const FIRST = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'J', 'K', 'L', 'M', 'N', 'P', 'R', 'S', 'T', 'V', 'W'];
const LAST = ['Ashby', 'Barlow', 'Crane', 'Dalton', 'Ellery', 'Fenwick', 'Garrow', 'Hale', 'Irwin', 'Jessop', 'Keane', 'Lockett', 'Marsh', 'Nash', 'Orme', 'Pryor', 'Quill', 'Rook', 'Steyne', 'Thorne', 'Upton', 'Vance', 'Wren', 'Yeats', 'Ziegler', 'Moreau', 'Okafor', 'Rahane', 'Siddiq', 'Tanaka', 'Varma', 'Kapoor', 'Mendis', 'Hossain', 'Pillai', 'Rana'];

let idCounter = 1;
const registry = new Map();
const person = () => {
  let name;
  do { name = `${pick(FIRST)} ${pick(LAST)}`; } while (registry.has(name));
  registry.set(name, (0x10000000 + idCounter++ * 7919).toString(16).slice(-8));
  return name;
};
const squad = () => Array.from({ length: 11 }, person);

const SETS = {
  'test-m': { teams: ['Avalon', 'Borealis', 'Caledon', 'Dravia'], type: 'Test', overs: null, n: 24, team_type: 'international', gender: 'male' },
  'odi-m': { teams: ['Avalon', 'Borealis', 'Caledon', 'Dravia', 'Estmark'], type: 'ODI', overs: 50, n: 40, team_type: 'international', gender: 'male' },
  't20i-m': { teams: ['Avalon', 'Borealis', 'Caledon', 'Dravia', 'Estmark', 'Fairhaven'], type: 'T20', overs: 20, n: 60, team_type: 'international', gender: 'male' },
  't20i-w': { teams: ['Avalon Women', 'Borealis Women', 'Caledon Women'], type: 'T20', overs: 20, n: 30, team_type: 'international', gender: 'female' },
  ipl: { teams: ['Harbour Kings', 'Riverside Royals', 'Summit Strikers', 'Coastal Capitals', 'Plains Panthers', 'Valley Titans'], type: 'T20', overs: 20, n: 70, team_type: 'club', gender: 'male', event: 'Sample Premier League', seasons: ['2024', '2025', '2026'] },
};

const squads = new Map();
const squadFor = (team) => { if (!squads.has(team)) squads.set(team, squad()); return squads.get(team); };

function ballOutcome(type) {
  const r = rand();
  const p = type === 'T20' ? [0.30, 0.36, 0.08, 0.01, 0.14, 0.07, 0.04] // dot,1,2,3,4,6,wkt
    : type === 'ODI' ? [0.45, 0.33, 0.07, 0.01, 0.09, 0.02, 0.03]
      : [0.62, 0.20, 0.05, 0.01, 0.09, 0.005, 0.025];
  const labels = [0, 1, 2, 3, 4, 6, 'W'];
  let acc = 0;
  for (let i = 0; i < p.length; i++) { acc += p[i]; if (r < acc) return labels[i]; }
  return 0;
}

function playInnings(battingTeam, bowlingTeam, type, maxOvers, target) {
  const bat = squadFor(battingTeam);
  const bowlers = squadFor(bowlingTeam).slice(6);
  const keeper = squadFor(bowlingTeam)[5];
  let striker = 0, nonStriker = 1, next = 2, wkts = 0, total = 0;
  const overs = [];
  const oversCap = maxOvers || 130;
  for (let o = 0; o < oversCap && wkts < 10; o++) {
    const bowler = bowlers[o % bowlers.length];
    const deliveries = [];
    let legal = 0;
    while (legal < 6 && wkts < 10) {
      const del = { batter: bat[striker], bowler, non_striker: bat[nonStriker], runs: { batter: 0, extras: 0, total: 0 } };
      if (rand() < 0.03) { // wide
        del.runs = { batter: 0, extras: 1, total: 1 }; del.extras = { wides: 1 };
        deliveries.push(del); total += 1;
        if (target && total >= target) break;
        continue;
      }
      legal++;
      const out = ballOutcome(type);
      if (out === 'W') {
        const kind = pick(['caught', 'caught', 'caught', 'bowled', 'lbw', 'run out', 'stumped', 'caught and bowled']);
        const w = { player_out: bat[striker], kind };
        if (kind === 'caught') w.fielders = [{ name: pick(squadFor(bowlingTeam).filter((n) => n !== bowler)) }];
        if (kind === 'stumped') w.fielders = [{ name: keeper }];
        if (kind === 'run out') w.fielders = [{ name: pick(squadFor(bowlingTeam)) }];
        del.wickets = [w];
        wkts++;
        deliveries.push(del);
        if (next < 11) striker = next++;
      } else {
        del.runs = { batter: out, extras: 0, total: out };
        deliveries.push(del);
        total += out;
        if (out % 2 === 1) [striker, nonStriker] = [nonStriker, striker];
      }
      if (target && total >= target) break;
    }
    overs.push({ over: o, deliveries });
    [striker, nonStriker] = [nonStriker, striker];
    if (target && total >= target) break;
  }
  return { team: battingTeam, overs, _total: total, _wkts: wkts };
}

function makeMatch(cfg, i) {
  const [t1, t2] = (() => { const a = pick(cfg.teams); let b; do { b = pick(cfg.teams); } while (b === a); return [a, b]; })();
  const season = cfg.seasons ? cfg.seasons[Math.floor((i / cfg.n) * cfg.seasons.length)] : String(2023 + Math.floor((i / cfg.n) * 4));
  const month = String(1 + Math.floor(rand() * 11)).padStart(2, '0');
  const day = String(1 + Math.floor(rand() * 27)).padStart(2, '0');
  let date = `${season}-${month}-${day}`;
  if (date > '2026-10-12') date = `2026-${String(1 + (i % 9)).padStart(2, '0')}-${day}`;
  const innings = [];
  let outcome;
  if (cfg.type === 'Test') {
    const i1 = playInnings(t1, t2, 'Test'); const i2 = playInnings(t2, t1, 'Test');
    const i3 = playInnings(t1, t2, 'Test');
    const target = i1._total + i3._total - i2._total + 1;
    const i4 = playInnings(t2, t1, 'Test', 90, target);
    innings.push(i1, i2, i3, i4);
    if (i4._total >= target) outcome = { winner: t2, by: { wickets: 10 - i4._wkts } };
    else if (i4._wkts >= 10) outcome = { winner: t1, by: { runs: target - 1 - i4._total } };
    else outcome = { result: 'draw' };
  } else {
    const i1 = playInnings(t1, t2, cfg.type, cfg.overs);
    const i2 = playInnings(t2, t1, cfg.type, cfg.overs, i1._total + 1);
    innings.push(i1, i2);
    if (i2._total > i1._total) outcome = { winner: t2, by: { wickets: 10 - i2._wkts } };
    else if (i2._total < i1._total) outcome = { winner: t1, by: { runs: i1._total - i2._total } };
    else outcome = { result: 'tie' };
  }
  for (const inn of innings) { delete inn._total; delete inn._wkts; }
  const players = { [t1]: squadFor(t1), [t2]: squadFor(t2) };
  const people = {};
  for (const n of [...players[t1], ...players[t2]]) people[n] = registry.get(n);
  const lastOfSeason = cfg.seasons && (i + 1) % Math.ceil(cfg.n / cfg.seasons.length) === 0;
  return {
    meta: { data_version: '1.1.0', created: date, revision: 1 },
    info: {
      balls_per_over: 6, dates: [date], match_type: cfg.type, gender: cfg.gender, team_type: cfg.team_type,
      season, teams: [t1, t2], venue: pick(['Northfield Oval', 'Harbour Park', 'Summit Ground', 'Riverside Stadium']),
      city: pick(['Northfield', 'Port Ellis', 'Summit', 'Riverton']),
      event: { name: cfg.event || `${t1} v ${t2} series`, ...(lastOfSeason ? { stage: 'Final' } : {}) },
      toss: { winner: t1, decision: 'bat' }, outcome,
      player_of_match: [pick(players[outcome.winner || t1])],
      players, registry: { people },
    },
    innings,
  };
}

fs.rmSync(outDir, { recursive: true, force: true });
let count = 0;
for (const [compId, cfg] of Object.entries(SETS)) {
  const dir = path.join(outDir, compId);
  fs.mkdirSync(dir, { recursive: true });
  for (let i = 0; i < cfg.n; i++) {
    const id = 9000000 + count++;
    fs.writeFileSync(path.join(dir, `${id}.json`), JSON.stringify(makeMatch(cfg, i)));
  }
}
console.log(`wrote ${count} synthetic matches to ${outDir}`);
