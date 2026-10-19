// Series and tournaments for the Results page's "Series" tab.
//
// Cricsheet names each match's event ("West Indies tour of India", "ICC Men's T20 World Cup",
// "Indian Premier League") but the same name comes back every tour or season. A series is
// therefore one event name plus one continuous run of matches: a gap of more than GAP_DAYS
// between matches with the same name starts a new series. That keeps cross-year events such as
// an Ashes in Nov-Jan together, and splits the IPL into seasons.
//
// Historical (Wikipedia) matches carry no event name, so series start around 2002.

const GAP_DAYS = 45;
const DAY = 86400000;

export const FULL_MEMBERS = new Set(['Afghanistan', 'Australia', 'Bangladesh', 'England', 'India', 'Ireland',
  'New Zealand', 'Pakistan', 'South Africa', 'Sri Lanka', 'West Indies', 'Zimbabwe']);
const baseTeam = (t) => String(t || '').replace(/\s+Women$/i, '');
const MINOR_EVENT = /qualif|sub[- ]?regional|\bregion(al)? final|challenge league|league 2\b|cwc league|division|pathway|emerging|\bA tour\b|\bA team\b|under[- ]?19|u19|associate/i;

const days = (a, b) => (Date.parse(b) - Date.parse(a)) / DAY;
const slug = (s) => s.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

export function seasonLabel(from, to) {
  const a = from.slice(0, 4);
  const b = to.slice(0, 4);
  return a === b ? a : `${a}-${b.slice(2)}`;
}

// Is this series one most fans would look for? (ICC events, leagues, full members' series.)
export function isMajor({ name, comps, teams, leagueComps }) {
  if (comps.some((c) => leagueComps.has(c))) return true;
  if (MINOR_EVENT.test(name)) return false;
  if (/^ICC\b|world cup|champions trophy|world test championship|asia cup/i.test(name)) return true;
  const full = teams.filter((t) => FULL_MEMBERS.has(baseTeam(t)));
  return full.length >= 2 || (teams.length === 2 && full.length === 1);
}

// Result line: a final's winner for tournaments, a win tally for two-team series.
export function summarise(matches) {
  const teams = new Map();
  for (const m of matches) for (const t of m.teams) teams.set(t, (teams.get(t) || 0) + 1);
  const names = [...teams.keys()];
  const final = [...matches].reverse().find((m) => /^final$/i.test(String(m.stage || '').trim()));
  if (final) {
    if (final.winner) return { kind: 'final', text: `${final.winner} won the final`, winner: final.winner };
    return { kind: 'final', text: final.result || 'Final: no result' };
  }
  if (names.length === 2) {
    const wins = Object.fromEntries(names.map((t) => [t, 0]));
    let other = 0;
    for (const m of matches) { if (m.winner && m.winner in wins) wins[m.winner] += 1; else other += 1; }
    const [a, b] = names.sort((x, y) => wins[y] - wins[x]);
    const tally = `${a} ${wins[a]}, ${b} ${wins[b]}${other ? `, ${other} drawn or no result` : ''}`;
    if (matches.length === 1) return { kind: 'single', text: matches[0].result || '' };
    return { kind: 'tally', text: tally, leader: wins[a] > wins[b] ? a : null };
  }
  return null;
}

// matches: every result (any competition), each with id, c, date, teams, event, stage, winner, result.
// compGroup: comp id -> group name; leagueComps: Set of comp ids that are leagues.
export function buildSeries(matches, { compGroup = {}, leagueComps = new Set() } = {}) {
  const byName = new Map();
  for (const m of matches) {
    if (!m.event || !m.date) continue;
    if (!byName.has(m.event)) byName.set(m.event, []);
    byName.get(m.event).push(m);
  }
  const out = [];
  for (const [name, list] of byName) {
    list.sort((a, b) => a.date.localeCompare(b.date) || String(a.id).localeCompare(String(b.id)));
    let run = [];
    const flush = () => { if (run.length) out.push(make(name, run)); run = []; };
    for (const m of list) {
      if (run.length && days(run[run.length - 1].date, m.date) > GAP_DAYS) flush();
      run.push(m);
    }
    flush();
  }

  function make(name, run) {
    const from = run[0].date;
    const to = run[run.length - 1].date;
    const comps = [...new Set(run.map((m) => m.c))];
    const teamCount = new Map();
    for (const m of run) for (const t of m.teams) teamCount.set(t, (teamCount.get(t) || 0) + 1);
    const teams = [...teamCount.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([t]) => t);
    const groups = new Map();
    for (const m of run) { const g = compGroup[m.c] || ''; groups.set(g, (groups.get(g) || 0) + 1); }
    const group = [...groups.entries()].sort((a, b) => b[1] - a[1])[0][0];
    const season = seasonLabel(from, to);
    const sum = summarise(run);
    return {
      id: null, n: name, s: /\b(19|20)\d{2}\b/.test(name) ? null : season, from, to, m: run.length,
      c: comps, g: group, t: teams.slice(0, 6), nt: teams.length,
      major: isMajor({ name, comps, teams, leagueComps }) ? 1 : 0,
      r: sum ? sum.text : null,
      ids: run.map((m) => m.id),
    };
  }

  // Newest first; stable, readable ids ("west-indies-tour-of-india-2026").
  out.sort((a, b) => b.to.localeCompare(a.to) || a.n.localeCompare(b.n));
  const used = new Set();
  for (const s of out) {
    let id = `${slug(s.n)}-${seasonLabel(s.from, s.to)}`;
    for (let k = 2; used.has(id); k++) id = `${slug(s.n)}-${seasonLabel(s.from, s.to)}-${k}`;
    used.add(id);
    s.id = id;
  }
  return out;
}
