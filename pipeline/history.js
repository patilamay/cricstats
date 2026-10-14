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
import { findMatchBoxes, parseMatchBox, classify } from './matchbox.js';

const TEMPLATES = [
  'Template:Two-innings cricket match',
  'Template:Test match',
  'Template:Single-innings cricket match',
  'Template:Single-innings cricket match collapsible',
  'Template:Limited overs matches',
];
const PARSER_VERSION = 2;
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

export function dedupe(matches) {
  const byKey = new Map();
  for (const m of matches) {
    const key = `${m.comp}|${m.date}|${[...m.teams].sort().join('|')}`;
    const prev = byKey.get(key);
    if (!prev || richness(m) > richness(prev)) byKey.set(key, m);
  }
  // A second pass on cricinfo id catches copies with slightly different dates.
  const byId = new Map();
  const out = [];
  for (const m of byKey.values()) {
    if (m.cricinfo) {
      const prev = byId.get(m.cricinfo);
      if (prev) { if (richness(m) > richness(prev)) out[out.indexOf(prev)] = m; byId.set(m.cricinfo, m); continue; }
      byId.set(m.cricinfo, m);
    }
    out.push(m);
  }
  return out;
}

export const unknownTeamCodes = new Map(); // for the coverage report

export function extractFromArticle(title, text) {
  const out = [];
  for (const box of findMatchBoxes(text)) {
    let m;
    try { m = parseMatchBox(box); } catch { m = null; }
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
    cache[title] = { rev, m: extractFromArticle(title, text) };
  });

  const live = new Set([...revs.values()].map((r) => r.final));
  const pages = Object.fromEntries(Object.entries(cache).filter(([t]) => live.has(t)));
  fs.mkdirSync(cacheDir, { recursive: true });
  fs.writeFileSync(cacheFile, JSON.stringify({ v: PARSER_VERSION, pages }));

  const all = dedupe(Object.values(pages).flatMap((p) => p.m || []));
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
