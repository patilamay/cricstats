// Historical international matches from Wikipedia's per-match summary boxes.
//
// 1. Find every article that uses a match-box template (list=embeddedin).
// 2. Download them (cached by revision; later runs only fetch changed articles).
// 3. Parse and classify each box (Test / ODI / T20I, men / women), drop tour games and duplicates.
//
// Returns Map(compId -> [match summary]) sorted by date. Matches Cricsheet also has are dropped
// later by the caller, so Cricsheet's full ball-by-ball version always wins.

import fs from 'node:fs';
import path from 'node:path';
import { API, getJson, revisionIds, pageContents } from './wiki.js';
import { findMatchBoxes, parseMatchBox, classify, findFullScorecards } from './matchbox.js';

const TEMPLATES = [
  'Template:Two-innings cricket match',
  'Template:Test match',
  'Template:Single-innings cricket match',
  'Template:Single-innings cricket match collapsible',
  'Template:Limited overs matches',
  'Template:Limited overs international',
  'Template:Cricket match batsman status', // full scorecards for notable matches
];
const PARSER_VERSION = 5;
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), '[history]', ...a);

async function articlesUsing(template) {
  const titles = [];
  let cont = '';
  for (let guard = 0; guard < 200; guard++) {
    const url = `${API}?action=query&format=json&formatversion=2&maxlag=5&list=embeddedin&einamespace=0&eilimit=500&eititle=${encodeURIComponent(template)}${cont}`;
    const json = await getJson(url);
    for (const p of json.query.embeddedin) titles.push(p.title);
    if (!json.continue) break;
    cont = Object.entries(json.continue).map(([k, v]) => `&${k}=${encodeURIComponent(v)}`).join('');
  }
  return titles;
}

// Pick the most complete of several copies of the same match.
const richness = (m) => m.innings.length * 10 + m.innings.reduce((a, i) => a + i.bat.length + i.bowl.length, 0) + (m.cricinfo ? 5 : 0) + (m.venue ? 1 : 0);

// The same match often appears in several articles (tour, trophy, season, ground), sometimes
// with slightly different dates. Teams plus the innings totals identify a match uniquely, so
// copies are merged on that signature, then on ESPNcricinfo id, then on teams within 3 days.
const sig = (m) => `${m.comp}|${[...m.teams].sort().join('|')}|${m.innings.map((i) => `${i.r}/${i.w}`).sort().join(',')}`;
const dayNum = (d) => Math.floor(Date.parse(d) / 86400000);

export function dedupe(matches) {
  const groups = [];
  const bySig = new Map();
  const byId = new Map();
  const byTeams = new Map(); // comp|teams -> groups (for date proximity)
  for (const m of matches) {
    let g = bySig.get(sig(m)) || (m.cricinfo && byId.get(m.cricinfo));
    if (!g) {
      const near = (byTeams.get(`${m.comp}|${[...m.teams].sort().join('|')}`) || [])
        .find((x) => Math.abs(dayNum(x.best.date) - dayNum(m.date)) <= 3 && sameScores(x.best, m));
      g = near;
    }
    if (!g) {
      g = { best: m };
      groups.push(g);
      const tk = `${m.comp}|${[...m.teams].sort().join('|')}`;
      if (!byTeams.has(tk)) byTeams.set(tk, []);
      byTeams.get(tk).push(g);
    } else if (richness(m) > richness(g.best)) {
      g.best = { ...m, cricinfo: m.cricinfo || g.best.cricinfo };
    } else if (!g.best.cricinfo && m.cricinfo) {
      g.best = { ...g.best, cricinfo: m.cricinfo };
    }
    bySig.set(sig(m), g);
    if (m.cricinfo) byId.set(m.cricinfo, g);
  }
  return groups.map((g) => g.best);
}

// Scores agree where both copies have them (one copy may omit an innings).
function sameScores(a, b) {
  const sa = a.innings.map((i) => `${i.team}:${i.r}`);
  const sb = new Set(b.innings.map((i) => `${i.team}:${i.r}`));
  const common = sa.filter((x) => sb.has(x)).length;
  return common >= Math.min(a.innings.length, b.innings.length, 2) || (!a.innings.length || !b.innings.length);
}

export const unknownTeamCodes = new Map(); // codes seen in boxes but not mapped to a team (for reports)

export function extractFromArticle(title, text) {
  const out = [];
  for (const box of findMatchBoxes(text)) {
    let m;
    try { m = parseMatchBox(box, title); } catch { m = null; }
    if (!m || !m.date) continue;
    for (const code of [m.codes && m.codes[0], m.codes && m.codes[1]]) if (code && code.unknown) unknownTeamCodes.set(code.code, (unknownTeamCodes.get(code.code) || 0) + 1);
    delete m.codes;
    const comp = classify(m, title);
    if (!comp) continue;
    delete m.headings;
    out.push({ ...m, comp, article: title });
  }
  return out;
}

export async function fetchHistory({ cacheDir }) {
  const started = Date.now();
  const cacheFile = path.join(cacheDir, 'history-cache.json');
  let cache = {};
  try {
    const c = JSON.parse(fs.readFileSync(cacheFile, 'utf8'));
    if (c.v === PARSER_VERSION) cache = c.pages || {};
  } catch { /* first run */ }

  const titleSet = new Set();
  for (const t of TEMPLATES) {
    const list = await articlesUsing(t);
    log(`${t}: ${list.length} articles`);
    for (const x of list) titleSet.add(x);
  }
  const titles = [...titleSet];
  const revs = await revisionIds(titles);
  const stale = [...new Set([...revs.values()].filter(({ final, rev }) => !cache[final] || cache[final].rev !== rev).map((r) => r.final))];
  log(`${titles.length} articles, ${stale.length} new or changed since last run`);

  await pageContents(stale, (title, rev, text) => {
    let full = [];
    try { full = findFullScorecards(text).filter((c) => c.cricinfo); } catch { full = []; }
    cache[title] = { rev, m: extractFromArticle(title, text), f: full.length ? full : undefined };
  });

  const live = new Set([...revs.values()].map((r) => r.final));
  const pages = Object.fromEntries(Object.entries(cache).filter(([t]) => live.has(t)));
  fs.mkdirSync(cacheDir, { recursive: true });
  fs.writeFileSync(cacheFile, JSON.stringify({ v: PARSER_VERSION, pages }));

  const all = dedupe(Object.values(pages).flatMap((p) => p.m || []));
  // Attach full scorecards (from articles about individual matches) by ESPNcricinfo id.
  const fullById = new Map();
  for (const p of Object.values(pages)) for (const c of p.f || []) if (!fullById.has(c.cricinfo) || c.innings.length > fullById.get(c.cricinfo).innings.length) fullById.set(c.cricinfo, c);
  let attached = 0;
  for (const m of all) {
    const c = m.cricinfo && fullById.get(m.cricinfo);
    if (c) { m.full = c.innings; attached += 1; }
  }
  log(`${fullById.size} full scorecards found, ${attached} attached to matches`);
  const byComp = new Map();
  for (const m of all) {
    if (!byComp.has(m.comp)) byComp.set(m.comp, []);
    byComp.get(m.comp).push(m);
  }
  for (const list of byComp.values()) list.sort((a, b) => a.date.localeCompare(b.date));
  log(`${all.length} international matches from ${live.size} articles in ${Math.round((Date.now() - started) / 1000)}s`);
  return byComp;
}

// "Australia won by 45 runs" -> winner, tie/draw/no-result flags.
export function parseResult(text, teams) {
  const s = (text || '').toLowerCase();
  const winner = teams.find((t) => s.startsWith(t.toLowerCase()) && /\bwon\b/.test(s)) || null;
  return {
    winner,
    tie: !winner && /\btied?\b/.test(s),
    draw: !winner && /\bdrawn?\b/.test(s),
    noResult: !winner && /no result|abandoned|cancelled/.test(s),
  };
}

// The full-scorecard innings that matches summary innings k: the n-th innings of the same team.
export function fullInnings(m, k) {
  if (!m.full) return null;
  const team = m.innings[k].team;
  const nth = m.innings.slice(0, k).filter((i) => i.team === team).length;
  return m.full.filter((f) => f.team === team)[nth] || null;
}
