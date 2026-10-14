// Accumulates parsed matches into career stats, records, team results and
// season leaders for one competition.

const round = (x, dp = 2) => (x == null || !isFinite(x) ? null : Math.round(x * 10 ** dp) / 10 ** dp);

function newPlayer(id, name) {
  return {
    id, name, teams: new Set(), m: 0,
    bat: { inn: 0, no: 0, runs: 0, bf: 0, hs: -1, hsNo: false, c50: 0, c100: 0, ducks: 0, f4: 0, s6: 0 },
    bowl: { inn: 0, balls: 0, runs: 0, wkts: 0, maid: 0, dots: 0, bbiW: -1, bbiR: 0, bbmW: -1, bbmR: 0, w4: 0, w5: 0, w10m: 0 },
    fld: { ct: 0, st: 0, ro: 0 },
  };
}

export class CompetitionAggregator {
  constructor(comp) {
    this.comp = comp;
    this.players = new Map();
    this.teams = new Map();
    this.seasons = new Map();
    this.teamInnings = [];
    this.batInnings = [];
    this.bowlInnings = [];
    this.matchCount = 0;
    this.firstDate = null;
    this.lastDate = null;
    this.seen = new Set();
  }

  player(id, name) {
    let p = this.players.get(id);
    if (!p) { p = newPlayer(id, name); this.players.set(id, p); }
    return p;
  }

  seasonKey(m) {
    return this.comp.seasonBy === 'year' ? m.year : m.season;
  }

  season(key) {
    let s = this.seasons.get(key);
    if (!s) { s = { key, matches: 0, champion: null, players: new Map() }; this.seasons.set(key, s); }
    return s;
  }

  seasonPlayer(s, id, name) {
    let p = s.players.get(id);
    if (!p) { p = { id, name, inn: 0, no: 0, runs: 0, bf: 0, hs: -1, s6: 0, wkts: 0, balls: 0, rc: 0 }; s.players.set(id, p); }
    return p;
  }

  add(m) {
    if (this.seen.has(m.id)) return;
    this.seen.add(m.id);
    this.matchCount += 1;
    if (m.date && (!this.firstDate || m.date < this.firstDate)) this.firstDate = m.date;
    if (m.endDate && (!this.lastDate || m.endDate > this.lastDate)) this.lastDate = m.endDate;

    const sKey = this.seasonKey(m);
    const season = this.season(sKey);
    season.matches += 1;
    if (m.stage && /^final$/i.test(m.stage) && m.outcome.winner) season.champion = m.outcome.winner;

    for (const pl of m.players) {
      const p = this.player(pl.id, pl.name);
      p.m += 1;
      p.teams.add(pl.team);
    }

    this.addTeamResult(m);

    const matchBowl = new Map(); // id -> { w, r } for best match figures
    for (const inn of m.innings) {
      if (inn.superOver) continue;
      if (inn.forfeited) continue;
      const allOut = inn.wkts >= 10;
      this.teamInnings.push({
        team: inn.team, opp: inn.opp, runs: inn.runs, wkts: inn.wkts, overs: inn.overs,
        declared: inn.declared, allOut, date: m.date, season: sKey, match: m.id,
      });

      for (const b of inn.batting) {
        const p = this.player(b.id, b.name);
        const bt = p.bat;
        bt.inn += 1;
        if (!b.out) bt.no += 1;
        bt.runs += b.runs;
        bt.bf += b.balls;
        bt.f4 += b.fours;
        bt.s6 += b.sixes;
        if (b.runs >= 100) bt.c100 += 1;
        else if (b.runs >= 50) bt.c50 += 1;
        if (b.runs === 0 && b.out) bt.ducks += 1;
        if (b.runs > bt.hs || (b.runs === bt.hs && !b.out)) { bt.hs = b.runs; bt.hsNo = !b.out; }
        this.batInnings.push({
          id: b.id, name: b.name, team: inn.team, opp: inn.opp, runs: b.runs, balls: b.balls,
          no: !b.out, fours: b.fours, sixes: b.sixes, date: m.date, season: sKey, match: m.id,
        });

        const sp = this.seasonPlayer(season, b.id, b.name);
        sp.inn += 1; if (!b.out) sp.no += 1; sp.runs += b.runs; sp.bf += b.balls; sp.s6 += b.sixes;
        if (b.runs > sp.hs) sp.hs = b.runs;
      }

      for (const w of inn.bowling) {
        const p = this.player(w.id, w.name);
        const bw = p.bowl;
        bw.inn += 1;
        bw.balls += w.balls;
        bw.runs += w.runs;
        bw.wkts += w.wkts;
        bw.maid += w.maidens;
        bw.dots += w.dots;
        if (w.wkts >= 5) bw.w5 += 1; else if (w.wkts >= 4) bw.w4 += 1;
        if (w.wkts > bw.bbiW || (w.wkts === bw.bbiW && w.runs < bw.bbiR)) { bw.bbiW = w.wkts; bw.bbiR = w.runs; }
        const mb = matchBowl.get(w.id) || { w: 0, r: 0 };
        mb.w += w.wkts; mb.r += w.runs;
        matchBowl.set(w.id, mb);
        this.bowlInnings.push({
          id: w.id, name: w.name, team: inn.opp, opp: inn.team, wkts: w.wkts, runs: w.runs,
          balls: w.balls, date: m.date, season: sKey, match: m.id,
        });

        const sp = this.seasonPlayer(season, w.id, w.name);
        sp.wkts += w.wkts; sp.balls += w.balls; sp.rc += w.runs;
      }

      for (const f of inn.fielding) {
        const p = this.player(f.id, f.name);
        p.fld[f.kind] += 1;
      }
    }

    for (const [id, mb] of matchBowl) {
      const bw = this.players.get(id).bowl;
      if (mb.w > bw.bbmW || (mb.w === bw.bbmW && mb.r < bw.bbmR)) { bw.bbmW = mb.w; bw.bbmR = mb.r; }
      if (mb.w >= 10) bw.w10m += 1;
    }
  }

  addTeamResult(m) {
    const o = m.outcome;
    for (const t of m.teams) {
      let r = this.teams.get(t);
      if (!r) { r = { team: t, m: 0, w: 0, l: 0, t: 0, d: 0, nr: 0 }; this.teams.set(t, r); }
      r.m += 1;
      if (o.winner) { if (o.winner === t) r.w += 1; else r.l += 1; }
      else if (o.tie) r.t += 1;
      else if (o.draw) r.d += 1;
      else r.nr += 1;
    }
  }

  finalize({ recordsLimit = 25, seasonLimit = 10 } = {}) {
    const isTest = this.comp.format === 'Test';
    const rows = [];
    for (const p of this.players.values()) {
      const b = p.bat;
      const w = p.bowl;
      const outs = b.inn - b.no;
      const row = { id: p.id, n: p.name, t: [...p.teams], m: p.m };
      if (b.inn > 0) {
        row.b = {
          inn: b.inn, no: b.no, r: b.runs, bf: b.bf, hs: b.hs, hsNo: b.hsNo,
          avg: outs ? round(b.runs / outs) : null,
          sr: b.bf ? round((b.runs * 100) / b.bf) : null,
          c50: b.c50, c100: b.c100, d: b.ducks, f4: b.f4, s6: b.s6,
        };
      }
      if (w.inn > 0 && w.balls > 0) {
        row.w = {
          inn: w.inn, balls: w.balls, r: w.runs, wk: w.wkts, md: w.maid, dots: w.dots,
          avg: w.wkts ? round(w.runs / w.wkts) : null,
          econ: round((w.runs * 6) / w.balls),
          sr: w.wkts ? round(w.balls / w.wkts, 1) : null,
          bbi: w.bbiW >= 0 ? `${w.bbiW}/${w.bbiR}` : null,
          w4: w.w4, w5: w.w5,
        };
        if (isTest) {
          row.w.bbm = w.bbmW >= 0 ? `${w.bbmW}/${w.bbmR}` : null;
          row.w.w10 = w.w10m;
        }
      }
      if (p.fld.ct || p.fld.st || p.fld.ro) row.f = { ...p.fld };
      rows.push(row);
    }
    rows.sort((a, b) => ((b.b && b.b.r) || 0) - ((a.b && a.b.r) || 0));

    const byDesc = (k) => (a, b) => b[k] - a[k];
    const records = {
      highestTotals: [...this.teamInnings].sort((a, b) => b.runs - a.runs || a.wkts - b.wkts).slice(0, recordsLimit),
      lowestTotals: this.teamInnings.filter((i) => i.allOut).sort((a, b) => a.runs - b.runs).slice(0, recordsLimit),
      highestScores: [...this.batInnings].sort((a, b) => b.runs - a.runs || a.balls - b.balls).slice(0, recordsLimit),
      bestFigures: [...this.bowlInnings].sort((a, b) => b.wkts - a.wkts || a.runs - b.runs).slice(0, recordsLimit),
      mostSixesInnings: [...this.batInnings].filter((i) => i.sixes > 0).sort(byDesc('sixes')).slice(0, recordsLimit),
    };

    const teams = [...this.teams.values()]
      .map((t) => ({ ...t, pct: t.w + t.l ? round((t.w * 100) / (t.w + t.l), 1) : null }))
      .sort((a, b) => b.m - a.m);

    const seasons = [...this.seasons.values()]
      .sort((a, b) => (a.key < b.key ? 1 : -1))
      .map((s) => {
        const ps = [...s.players.values()];
        return {
          key: s.key,
          matches: s.matches,
          champion: s.champion,
          runs: ps.filter((p) => p.inn).sort((a, b) => b.runs - a.runs).slice(0, seasonLimit).map((p) => ({
            id: p.id, n: p.name, inn: p.inn, r: p.runs, hs: p.hs, s6: p.s6,
            avg: p.inn - p.no ? round(p.runs / (p.inn - p.no)) : null,
            sr: p.bf ? round((p.runs * 100) / p.bf) : null,
          })),
          wickets: ps.filter((p) => p.balls).sort((a, b) => b.wkts - a.wkts || a.rc - b.rc).slice(0, seasonLimit).map((p) => ({
            id: p.id, n: p.name, wk: p.wkts, balls: p.balls, r: p.rc,
            econ: round((p.rc * 6) / p.balls),
            avg: p.wkts ? round(p.rc / p.wkts) : null,
          })),
        };
      });

    return {
      summary: {
        id: this.comp.id,
        matches: this.matchCount,
        players: rows.length,
        from: this.firstDate,
        to: this.lastDate,
        seasons: this.seasons.size,
      },
      rows,
      records,
      teams,
      seasons,
    };
  }
}
