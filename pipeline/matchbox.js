// Parses Wikipedia's per-match summary boxes:
//   {{Two-innings cricket match}} / {{Test match}}          (Tests and other two-innings matches)
//   {{Single-innings cricket match}} (+ "collapsible")       (ODIs, T20Is, other one-day matches)
//   {{Limited overs matches}}                                 (older one-day tables)
// Each box gives innings totals, the top scorers and bowlers of each innings, result, venue,
// umpires, toss, player of the match and (usually) an ESPNcricinfo scorecard link.

import { splitParams, clean } from './infobox.js';

const TEMPLATE_RE = /\{\{\s*(two-innings cricket match|test match|single-innings cricket match(?: collapsible)?|limited overs matches)\s*\|/gi;
const MONTHS = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];

// {{cr|AUS}} codes used by Wikipedia's national-team templates -> Cricsheet team names.
export const TEAM_CODES = {
  AUS: 'Australia', ENG: 'England', IND: 'India', PAK: 'Pakistan', NZ: 'New Zealand', NZL: 'New Zealand',
  SA: 'South Africa', RSA: 'South Africa', SAF: 'South Africa', WI: 'West Indies', WIN: 'West Indies',
  SL: 'Sri Lanka', SRI: 'Sri Lanka', CEY: 'Sri Lanka', ZIM: 'Zimbabwe', RHO: 'Rhodesia', BAN: 'Bangladesh', BAN1: 'Bangladesh',
  AFG: 'Afghanistan', IRE: 'Ireland', IRL: 'Ireland', SCO: 'Scotland', NED: 'Netherlands', HOL: 'Netherlands', KEN: 'Kenya',
  CAN: 'Canada', UAE: 'United Arab Emirates', NAM: 'Namibia', NEP: 'Nepal', OMA: 'Oman', USA: 'United States of America',
  HK: 'Hong Kong', HKG: 'Hong Kong', PNG: 'Papua New Guinea', BER: 'Bermuda', EAF: 'East Africa', ICC: 'ICC World XI',
  WXI: 'ICC World XI', 'WORLD XI': 'ICC World XI', ASIA: 'Asia XI', AFR: 'Africa XI', DEN: 'Denmark', JER: 'Jersey',
  UGA: 'Uganda', TAN: 'Tanzania', THA: 'Thailand', MAS: 'Malaysia', MAL: 'Malaysia', SIN: 'Singapore', QAT: 'Qatar',
  KUW: 'Kuwait', JPN: 'Japan', CHN: 'China', ITA: 'Italy', GER: 'Germany', FRA: 'France', ESP: 'Spain', NGR: 'Nigeria',
  BOT: 'Botswana', RWA: 'Rwanda', ARG: 'Argentina', BRA: 'Brazil', MEX: 'Mexico', VAN: 'Vanuatu', SAM: 'Samoa',
  FIJ: 'Fiji', CAY: 'Cayman Islands', JAM: 'Jamaica', TT: 'Trinidad and Tobago', INT: 'International XI', YOR: 'Young England',
};

// Find each match box with the section headings it sits under.
export function findMatchBoxes(wikitext) {
  const out = [];
  if (!wikitext) return out;
  const headings = []; // [{ level, text, index }]
  const hRe = /^(={2,5})\s*(.+?)\s*\1\s*$/gm;
  let h;
  while ((h = hRe.exec(wikitext))) headings.push({ level: h[1].length, text: clean(h[2]), index: h.index });

  TEMPLATE_RE.lastIndex = 0;
  let m;
  while ((m = TEMPLATE_RE.exec(wikitext))) {
    let depth = 0;
    let end = -1;
    for (let i = m.index; i < wikitext.length - 1; i++) {
      const two = wikitext.slice(i, i + 2);
      if (two === '{{') { depth++; i++; } else if (two === '}}') { depth--; i++; if (depth === 0) { end = i + 1; break; } }
    }
    if (end < 0) break;
    const before = headings.filter((x) => x.index < m.index);
    // heading path: nearest heading at each level above
    const path = [];
    for (let lvl = 2; lvl <= 5; lvl++) {
      const last = [...before].reverse().find((x) => x.level === lvl);
      if (last) path.push(last);
    }
    // keep only headings that are still "open" (a later, shallower heading closes deeper ones)
    const open = [];
    for (const x of path.sort((a, b) => a.index - b.index)) {
      while (open.length && open[open.length - 1].level >= x.level) open.pop();
      open.push(x);
    }
    out.push({ kind: m[1].toLowerCase(), raw: wikitext.slice(m.index, end), headings: open.map((x) => x.text), offset: m.index });
    TEMPLATE_RE.lastIndex = end;
  }
  return out;
}

export function teamName(v) {
  const raw = String(v || '');
  const tpl = /\{\{\s*(?:cr|cr-rt|cricon|crw|crw-rt|cr-w|cr-w-rt)\s*\|\s*([^|}]+)(?:\|([^}]*))?\}\}/i.exec(raw);
  let women = /women|\bW\b|-W\b/i.test(raw) || /\{\{\s*crw/i.test(raw);
  if (tpl) {
    let code = tpl[1].trim().toUpperCase();
    if (/-W$/.test(code)) { women = true; code = code.replace(/-W$/, ''); }
    const name = TEAM_CODES[code] || null;
    return { name: name || code, code, women, national: !!name };
  }
  const text = clean(raw).replace(/\s*\(.*?\)\s*/g, ' ').trim();
  const known = Object.values(TEAM_CODES).find((n) => text.toLowerCase().replace(/ women'?s?$/, '') === n.toLowerCase());
  return { name: known || text, code: null, women: women || /women/i.test(text), national: !!known };
}

// "245 (169.3 overs)", "334/4 (60 overs)", "425/8d", "425/8 dec.", "107 (f/o)" -> { r, w, overs, dec }
export function parseScore(v) {
  const s = clean(v);
  if (!s) return null;
  const m = /(\d+)(?:\s*\/\s*(\d+))?\s*(d\b|dec\.?|declared)?/i.exec(s);
  if (!m) return null;
  const ov = /(\d+(?:\.\d)?)\s*overs?/i.exec(s);
  return {
    r: Number(m[1]),
    w: m[2] != null ? Number(m[2]) : 10,
    dec: !!m[3] || /\bdec/i.test(s),
    overs: ov ? ov[1] : null,
    fo: /f\/o|follow/i.test(s),
  };
}

const splitLines = (v) => String(v || '').split(/<br\s*\/?>|\n\*|\{\{\s*(?:plainlist|ubl)\s*\|/i).map((x) => x.trim()).filter(Boolean);

// "[[Charles Bannerman]] 165 ([[retired hurt|r/h]])" / "[[Gary Gilmour]] 28[[not out|*]] (28)"
export function parseBatting(v) {
  const out = [];
  for (const line of splitLines(v)) {
    const link = /\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/.exec(line);
    const text = clean(line);
    const m = /(\d+)\s*(\*)?\s*(?:\(([^)]*)\))?/.exec(text.replace(/^[^\d]*?(?=\d+\s*\*?\s*(\(|$))/, ''));
    if (!m) continue;
    const name = link ? clean(link[2] || link[1]) : text.slice(0, text.indexOf(m[1])).trim();
    if (!name || /^\d/.test(name)) continue;
    const paren = m[3] || '';
    const balls = /^\d+$/.test(paren.trim()) ? Number(paren.trim()) : null;
    out.push({ name, title: link ? link[1].trim() : null, runs: Number(m[1]), no: !!m[2] || /r\/h|retired|not out/i.test(paren), balls });
  }
  return out;
}

// "[[Alfred Shaw]] 3/51 (55.3 overs)"
export function parseBowling(v) {
  const out = [];
  for (const line of splitLines(v)) {
    const link = /\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/.exec(line);
    const text = clean(line);
    const m = /(\d+)\s*\/\s*(\d+)(?:\s*\(([\d.]+)\s*overs?\))?/i.exec(text);
    if (!m) continue;
    const name = link ? clean(link[2] || link[1]) : text.slice(0, text.indexOf(m[0])).trim();
    if (!name) continue;
    out.push({ name, title: link ? link[1].trim() : null, w: Number(m[1]), r: Number(m[2]), overs: m[3] || null });
  }
  return out;
}

export function parseDate(v) {
  const s = clean(v).replace(/\(.*?\)/g, ' ');
  const day = /\b(\d{1,2})(?:st|nd|rd|th)?\b/.exec(s);
  const mon = new RegExp(`\\b(${MONTHS.join('|')})\\b`, 'i').exec(s);
  const yr = /\b(18[5-9]\d|19\d\d|20\d\d)\b/.exec(s);
  if (!yr) return null;
  const mo = mon ? MONTHS.indexOf(mon[1].toLowerCase()) + 1 : 1;
  const d = day && (!mon || day.index < mon.index + 20) ? Math.min(31, Number(day[1])) : 1;
  return `${yr[1]}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

// ESPNcricinfo match id from the report link (also the id Cricsheet uses for most matches).
export function cricinfoId(v) {
  const s = String(v || '');
  const m = /espncricinfo\.com\/[^\s\]]*?(?:\/match\/|engine\/match\/|scorecard\/|-)(\d{4,8})(?:\.html|\/|\s|\]|$)/i.exec(s)
    || /cricinfo\.com\/[^\s\]]*?(\d{5,8})\.html/i.exec(s);
  return m ? m[1] : null;
}

// One parsed box -> match summary (or null if it isn't a usable match).
export function parseMatchBox(box) {
  const inner = box.raw.slice(2, -2);
  const p = splitParams(inner);
  const t1 = teamName(p.team1);
  const t2 = teamName(p.team2);
  if (!t1.name || !t2.name) return null;
  const date = parseDate(p.date);
  const innings = [];
  if (box.kind === 'two-innings cricket match' || box.kind === 'test match') {
    // Order of play: team1 inns1, team2 inns1, then the two second innings (follow-on order is not
    // recorded reliably, so team1's second innings is listed first unless team2 followed on).
    const keys = [['team1', 1], ['team2', 1], ['team1', 2], ['team2', 2]];
    for (const [t, n] of keys) {
      const sc = parseScore(p[`score-${t}-inns${n}`]);
      if (!sc) continue;
      innings.push({
        team: t === 'team1' ? t1.name : t2.name,
        n,
        ...sc,
        bat: parseBatting(p[`runs-${t}-inns${n}`]),
        bowl: parseBowling(p[`wickets-${t}-inns${n}`]), // bowlers of the side that bowled in this innings
      });
    }
    const fo = innings.find((i) => i.n === 2 && i.team === t2.name && i.fo);
    if (fo) innings.sort((a, b) => (a.n - b.n) || 0);
  } else {
    for (const [i, team] of [[1, t1], [2, t2]]) {
      const sc = parseScore(p[`score${i}`]);
      if (!sc) continue;
      innings.push({ team: team.name, n: 1, ...sc, bat: parseBatting(p[`runs${i}`]), bowl: parseBowling(p[`wickets${i}`]) });
    }
  }
  if (!innings.length) return null;
  return {
    kind: box.kind,
    date,
    teams: [t1.name, t2.name],
    national: t1.national && t2.national,
    women: t1.women || t2.women,
    innings,
    result: clean(p.result) || null,
    venue: clean(p.venue) || null,
    umpires: clean(p.umpires) || null,
    toss: clean(p.toss) || null,
    pom: clean(p.motm || p.mom || p['player of the match']) || null,
    cricinfo: cricinfoId(p.report),
    headings: box.headings,
    codes: [t1, t2].map((t) => ({ code: t.code, unknown: !!t.code && !t.national })),
  };
}

// Decide what kind of match a box is, from the box type, teams, section headings and article title.
export function classify(match, articleTitle) {
  if (!match.national) return null;
  const ctx = `${articleTitle} ${match.headings.join(' ')}`;
  if (/\b(tour matches?|warm[- ]?ups?|practice|first-class|list a|youth|under-?19|u-?19|\bA\b team|emerging|development|legends|masters|veterans|exhibition|unofficial)\b/i.test(match.headings.join(' '))) return null;
  if (/under-?19|U19|youth|\bA cricket team|emerging|legends|masters/i.test(articleTitle)) return null;
  const women = match.women || /women/i.test(articleTitle);
  if (match.kind === 'two-innings cricket match' || match.kind === 'test match') {
    if (/\btests?\b|test series|test match/i.test(ctx) || /test/i.test(match.kind)) return women ? 'test-w' : 'test-m';
    return null;
  }
  if (/t20i|twenty20 international|t20 international|t20 world cup|world twenty20/i.test(ctx)) return women ? 't20i-w' : 't20i-m';
  if (/\bodis?\b|one day international|one-day international|cricket world cup|champions trophy|world series cup|asia cup|odi series/i.test(ctx)) return women ? 'odi-w' : 'odi-m';
  return null;
}
