// Home-page leaderboards for one competition. Rate-based boards (average,
// strike rate, economy) only include players above a minimum qualification,
// scaled down for small competitions so new leagues still get a board.

const QUAL = {
  Test: { batAvgInn: 20, bowlAvgBalls: 2000 },
  ODI: { batAvgInn: 20, batSrBalls: 1000, econBalls: 1200 },
  T20: { batAvgInn: 15, batSrBalls: 300, econBalls: 300 },
  Hundred: { batAvgInn: 8, batSrBalls: 150, econBalls: 150 },
};

const TOP = 5;

function scaled(min, rows, pick) {
  // If fewer than TOP players qualify, halve the bar (down to 1/8) so the board isn't empty.
  let bar = min;
  for (let i = 0; i < 3; i++) {
    if (rows.filter((r) => pick(r) >= bar).length >= TOP) break;
    bar = Math.ceil(bar / 2);
  }
  return bar;
}

const lite = (r, extra) => ({ id: r.id, n: r.n, t: r.t.slice(0, 2), ...extra });

export function buildLeaders(comp, rows, records) {
  const q = QUAL[comp.format] || QUAL.T20;
  const bat = rows.filter((r) => r.b);
  const bowl = rows.filter((r) => r.w);
  const boards = [];

  boards.push({
    key: 'runs', title: 'Most runs', unit: 'runs',
    rows: [...bat].sort((a, b) => b.b.r - a.b.r).slice(0, TOP).map((r) => lite(r, { v: r.b.r, sub: `${r.b.inn} inns, avg ${r.b.avg ?? '—'}` })),
  });
  boards.push({
    key: 'wickets', title: 'Most wickets', unit: 'wkts',
    rows: [...bowl].sort((a, b) => b.w.wk - a.w.wk || a.w.r - b.w.r).slice(0, TOP).map((r) => lite(r, { v: r.w.wk, sub: `${r.w.inn} inns, avg ${r.w.avg ?? '—'}` })),
  });

  const hs = records.highestScores.slice(0, TOP).map((i) => ({ id: i.id, n: i.name, t: [i.team], v: `${i.runs}${i.no ? '*' : ''}`, sub: `${i.balls}b vs ${i.opp}`, match: i.match }));
  boards.push({ key: 'hs', title: 'Highest score', unit: '', rows: hs });

  const bf = records.bestFigures.slice(0, TOP).map((i) => ({ id: i.id, n: i.name, t: [i.team], v: `${i.wkts}/${i.runs}`, sub: `vs ${i.opp}`, match: i.match }));
  boards.push({ key: 'figures', title: 'Best bowling', unit: '', rows: bf });

  {
    const min = scaled(q.batAvgInn, bat, (r) => r.b.inn);
    boards.push({
      key: 'avg', title: 'Best batting average', unit: 'avg', qual: `min ${min} inns`,
      rows: bat.filter((r) => r.b.inn >= min && r.b.avg != null).sort((a, b) => b.b.avg - a.b.avg).slice(0, TOP).map((r) => lite(r, { v: r.b.avg, sub: `${r.b.r} runs` })),
    });
  }
  if (q.batSrBalls) {
    const min = scaled(q.batSrBalls, bat, (r) => r.b.bf);
    boards.push({
      key: 'sr', title: 'Best strike rate', unit: 'SR', qual: `min ${min} balls`,
      rows: bat.filter((r) => r.b.bf >= min).sort((a, b) => b.b.sr - a.b.sr).slice(0, TOP).map((r) => lite(r, { v: r.b.sr, sub: `${r.b.r} runs` })),
    });
  }
  boards.push({
    key: 'sixes', title: 'Most sixes', unit: '6s',
    rows: [...bat].sort((a, b) => b.b.s6 - a.b.s6).slice(0, TOP).map((r) => lite(r, { v: r.b.s6, sub: `${r.b.inn} inns` })),
  });
  if (q.econBalls) {
    const min = scaled(q.econBalls, bowl, (r) => r.w.balls);
    boards.push({
      key: 'econ', title: 'Best economy', unit: 'econ', qual: `min ${min} balls`,
      rows: bowl.filter((r) => r.w.balls >= min).sort((a, b) => a.w.econ - b.w.econ).slice(0, TOP).map((r) => lite(r, { v: r.w.econ, sub: `${r.w.wk} wkts` })),
    });
  }
  if (q.bowlAvgBalls) {
    const min = scaled(q.bowlAvgBalls, bowl, (r) => r.w.balls);
    boards.push({
      key: 'bavg', title: 'Best bowling average', unit: 'avg', qual: `min ${min} balls`,
      rows: bowl.filter((r) => r.w.balls >= min && r.w.avg != null).sort((a, b) => a.w.avg - b.w.avg).slice(0, TOP).map((r) => lite(r, { v: r.w.avg, sub: `${r.w.wk} wkts` })),
    });
  }
  const fld = rows.filter((r) => r.f && r.f.ct);
  boards.push({
    key: 'catches', title: 'Most catches', unit: 'ct',
    rows: fld.sort((a, b) => b.f.ct - a.f.ct).slice(0, TOP).map((r) => lite(r, { v: r.f.ct, sub: `${r.m} matches` })),
  });

  return boards.filter((b) => b.rows.length);
}
