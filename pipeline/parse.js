// Turns one Cricsheet JSON match into a normalized scorecard.
// All of the cricket counting rules live here, so they can be unit tested.
//
// Rules (match the conventions used by Cricinfo-style scorecards):
// - Balls faced: every delivery except wides (no-balls count as faced).
// - Runs conceded by the bowler: off the bat + wides + no-balls (byes/leg-byes are not charged).
// - Legal balls (for overs): not a wide and not a no-ball.
// - Wickets credited to the bowler: bowled, caught, caught and bowled, lbw, stumped, hit wicket.
// - "retired hurt" / "retired not out" are not dismissals.
// - Boundaries: 4 or 6 off the bat unless runs.non_boundary is set.
// - Super overs are kept in the scorecard but excluded from career statistics.

export const BOWLER_WICKETS = new Set(['bowled', 'caught', 'caught and bowled', 'lbw', 'stumped', 'hit wicket']);
export const NOT_DISMISSED = new Set(['retired hurt', 'retired not out']);

const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

export function parseMatch(match, matchId) {
  const info = match.info || {};
  const people = (info.registry && info.registry.people) || {};
  const idOf = (name) => people[name] || `x-${slug(name)}`;
  const bpo = info.balls_per_over || 6;
  const teams = info.teams || [];
  const dates = info.dates || [];
  const date = dates[0] || null;

  const players = [];
  for (const team of Object.keys(info.players || {})) {
    for (const name of info.players[team]) players.push({ id: idOf(name), name, team });
  }

  const innings = [];
  for (const inn of match.innings || []) {
    innings.push(parseInnings(inn, { idOf, bpo, teams }));
  }

  const pom = (info.player_of_match || []).map((name) => ({ id: idOf(name), name }));

  return {
    id: String(matchId),
    date,
    endDate: dates[dates.length - 1] || date,
    year: date ? date.slice(0, 4) : null,
    season: info.season != null ? String(info.season) : (date ? date.slice(0, 4) : null),
    teams,
    venue: info.venue || null,
    city: info.city || null,
    event: info.event ? info.event.name : null,
    stage: info.event ? info.event.stage || null : null,
    matchNumber: info.event ? info.event.match_number || null : null,
    gender: info.gender,
    matchType: info.match_type,
    teamType: info.team_type,
    bpo,
    toss: info.toss ? { winner: info.toss.winner, decision: info.toss.decision } : null,
    outcome: summarizeOutcome(info.outcome || {}),
    result: resultText(info.outcome || {}),
    pom,
    players,
    innings,
  };
}

function parseInnings(inn, { idOf, bpo, teams }) {
  const team = inn.team;
  const opp = teams.find((t) => t !== team) || null;

  const batters = new Map(); // id -> batting line, in order of first appearance
  const bowlers = new Map(); // id -> bowling line, in order of first appearance
  const fielding = []; // { id, name, kind: 'ct' | 'st' | 'ro' }
  const fow = [];
  const extras = { b: 0, lb: 0, w: 0, nb: 0, p: 0 };
  let runs = 0;
  let wkts = 0;
  let legalBalls = 0;

  const bat = (name) => {
    const id = idOf(name);
    if (!batters.has(id)) {
      batters.set(id, { id, name, runs: 0, balls: 0, fours: 0, sixes: 0, out: false, how: 'not out' });
    }
    return batters.get(id);
  };
  const bowl = (name) => {
    const id = idOf(name);
    if (!bowlers.has(id)) {
      bowlers.set(id, { id, name, balls: 0, runs: 0, wkts: 0, maidens: 0, dots: 0, wides: 0, noballs: 0 });
    }
    return bowlers.get(id);
  };

  for (const over of inn.overs || []) {
    // per-bowler tally inside this over, for maidens
    const overTally = new Map();
    for (const d of over.deliveries || []) {
      const striker = bat(d.batter);
      bat(d.non_striker);
      const bowler = bowl(d.bowler);
      const r = d.runs || {};
      const ex = d.extras || {};
      const offBat = r.batter || 0;
      const wides = ex.wides || 0;
      const noballs = ex.noballs || 0;
      const isWide = wides > 0;
      const isNoBall = noballs > 0;
      const legal = !isWide && !isNoBall;

      runs += r.total || 0;
      extras.b += ex.byes || 0;
      extras.lb += ex.legbyes || 0;
      extras.w += wides;
      extras.nb += noballs;
      extras.p += ex.penalty || 0;

      if (!isWide) {
        striker.balls += 1;
        striker.runs += offBat;
        if (!r.non_boundary) {
          if (offBat === 4) striker.fours += 1;
          if (offBat === 6) striker.sixes += 1;
        }
      }

      const conceded = offBat + wides + noballs;
      bowler.runs += conceded;
      bowler.wides += wides ? 1 : 0;
      bowler.noballs += noballs ? 1 : 0;
      if (legal) {
        bowler.balls += 1;
        legalBalls += 1;
        if ((r.total || 0) === 0) bowler.dots += 1;
      }
      const t = overTally.get(bowler.id) || { legal: 0, conceded: 0 };
      t.legal += legal ? 1 : 0;
      t.conceded += conceded;
      overTally.set(bowler.id, t);

      for (const w of d.wickets || []) {
        const outLine = bat(w.player_out);
        const kind = w.kind;
        const fielders = (w.fielders || []).filter((f) => f && f.name);
        if (NOT_DISMISSED.has(kind)) {
          outLine.how = kind;
          continue;
        }
        wkts += 1;
        outLine.out = true;
        outLine.kind = kind;
        outLine.how = dismissalText(kind, d.bowler, fielders);
        if (BOWLER_WICKETS.has(kind)) {
          bowler.wkts += 1;
          outLine.bowlerId = bowler.id;
        }
        fow.push({ wkt: wkts, runs, batter: w.player_out, over: overString(legalBalls, bpo) });

        if (kind === 'caught') {
          const f = fielders[0];
          if (f && !f.substitute) fielding.push({ id: idOf(f.name), name: f.name, kind: 'ct' });
        } else if (kind === 'caught and bowled') {
          fielding.push({ id: bowler.id, name: d.bowler, kind: 'ct' });
        } else if (kind === 'stumped') {
          const f = fielders[0];
          if (f && !f.substitute) fielding.push({ id: idOf(f.name), name: f.name, kind: 'st' });
        } else if (kind === 'run out') {
          for (const f of fielders) {
            if (!f.substitute) fielding.push({ id: idOf(f.name), name: f.name, kind: 'ro' });
          }
        }
      }
    }
    for (const [id, t] of overTally) {
      if (t.legal >= bpo && t.conceded === 0) bowlers.get(id).maidens += 1;
    }
  }

  // Players dismissed without facing (e.g. timed out) are already added via bat().
  const pen = inn.penalty_runs || {};
  runs += (pen.pre || 0) + (pen.post || 0);

  return {
    team,
    opp,
    superOver: !!inn.super_over,
    declared: !!inn.declared,
    forfeited: !!inn.forfeited,
    runs,
    wkts,
    balls: legalBalls,
    overs: overString(legalBalls, bpo),
    extras,
    target: inn.target || null,
    batting: [...batters.values()],
    bowling: [...bowlers.values()],
    fielding,
    fow,
  };
}

export function overString(balls, bpo = 6) {
  const o = Math.floor(balls / bpo);
  const b = balls % bpo;
  return b ? `${o}.${b}` : `${o}`;
}

function fielderLabel(f) {
  return f.substitute ? `sub (${f.name})` : f.name;
}

export function dismissalText(kind, bowler, fielders = []) {
  const f = fielders[0];
  switch (kind) {
    case 'bowled': return `b ${bowler}`;
    case 'caught':
      if (f && f.name === bowler) return `c & b ${bowler}`;
      return f ? `c ${fielderLabel(f)} b ${bowler}` : `c ? b ${bowler}`;
    case 'caught and bowled': return `c & b ${bowler}`;
    case 'lbw': return `lbw b ${bowler}`;
    case 'stumped': return f ? `st ${fielderLabel(f)} b ${bowler}` : `st b ${bowler}`;
    case 'hit wicket': return `hit wicket b ${bowler}`;
    case 'run out':
      return fielders.length ? `run out (${fielders.map(fielderLabel).join('/')})` : 'run out';
    default: return kind;
  }
}

function summarizeOutcome(o) {
  return {
    winner: o.winner || o.eliminator || o.bowl_out || null,
    tie: o.result === 'tie',
    draw: o.result === 'draw',
    noResult: o.result === 'no result',
  };
}

export function resultText(o) {
  const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;
  const method = o.method ? ` (${o.method === 'D/L' ? 'DLS' : o.method})` : '';
  if (o.winner) {
    const by = o.by || {};
    if (by.innings) return `${o.winner} won by an innings and ${plural(by.runs || 0, 'run')}${method}`;
    if (by.runs != null) return `${o.winner} won by ${plural(by.runs, 'run')}${method}`;
    if (by.wickets != null) return `${o.winner} won by ${plural(by.wickets, 'wicket')}${method}`;
    return `${o.winner} won${method}`;
  }
  if (o.result === 'tie') {
    if (o.eliminator) return `Match tied (${o.eliminator} won the Super Over)`;
    if (o.bowl_out) return `Match tied (${o.bowl_out} won the bowl-out)`;
    return 'Match tied';
  }
  if (o.result === 'draw') return 'Match drawn';
  if (o.result === 'no result') return 'No result';
  return 'Result unknown';
}
