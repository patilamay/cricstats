// Fetches international career totals from English Wikipedia's cricketer infoboxes.
//
// 1. Wikidata: every item with an ESPNcricinfo player ID (P2697) and an English article.
// 2. Wikipedia API: current revision IDs in batches of 50; only pages that changed since
//    the cached copy are downloaded again (the first run downloads everything once).
// 3. Each infobox is parsed with ./infobox.js.
//
// Returns Map(cricinfoId -> { title, name, country, asof, formats }).
// Wikipedia text is CC BY-SA; the site credits Wikipedia wherever these figures appear.

import fs from 'node:fs';
import path from 'node:path';
import { parseInfobox } from './infobox.js';

export const UA = 'CricStatsBot/1.0 (https://github.com/patilamay/cricstats; data refresh for a cricket stats site) node/22';
const SPARQL = 'https://query.wikidata.org/sparql';
export const API = 'https://en.wikipedia.org/w/api.php';
const BATCH = 50;
const CONCURRENCY = 2; // Wikimedia asks unauthenticated clients to keep concurrency low
const PARSER_VERSION = 6; // bump to force re-parsing of cached pages after parser changes

const log = (...a) => console.log(new Date().toISOString().slice(11, 19), '[wiki]', ...a);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export async function getJson(url, init = {}, tries = 6) {
  for (let attempt = 1; ; attempt++) {
    let res;
    try {
      res = await fetch(url, { ...init, headers: { 'User-Agent': UA, 'Api-User-Agent': UA, Accept: 'application/json', ...(init.headers || {}) } });
    } catch (err) {
      if (attempt >= tries) throw err;
      await sleep(2000 * attempt);
      continue;
    }
    if (res.ok) {
      const json = await res.json();
      if (json && json.error && json.error.code === 'maxlag' && attempt < tries) {
        await sleep(5000 * attempt);
        continue;
      }
      return json;
    }
    if ((res.status === 429 || res.status >= 500) && attempt < tries) {
      const retry = Math.max(5, Number(res.headers.get('retry-after')) || 5 * attempt);
      await sleep(retry * 1000);
      continue;
    }
    throw new Error(`HTTP ${res.status} for ${url.slice(0, 120)}`);
  }
}

async function cricinfoTitles() {
  const query = `SELECT ?cid ?title WHERE {
    ?item wdt:P2697 ?cid .
    ?article schema:about ?item ; schema:isPartOf <https://en.wikipedia.org/> ; schema:name ?title .
  }`;
  const json = await getJson(SPARQL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/sparql-results+json' },
    body: `query=${encodeURIComponent(query)}`,
  });
  const byTitle = new Map(); // title -> Set(cid)
  for (const b of json.results.bindings) {
    const cid = String(b.cid.value).trim();
    if (!/^\d+$/.test(cid)) continue;
    const title = b.title.value;
    if (!byTitle.has(title)) byTitle.set(title, new Set());
    byTitle.get(title).add(cid);
  }
  return byTitle;
}

export async function inPool(items, worker, concurrency = CONCURRENCY) {
  let i = 0;
  const run = async () => {
    while (i < items.length) {
      const idx = i++;
      await worker(items[idx], idx);
    }
  };
  await Promise.all(Array.from({ length: concurrency }, run));
}

export function chunks(arr, n) {
  const out = [];
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
  return out;
}

// Resolve normalization/redirects so results map back to the titles we asked for.
function finalTitleMap(query, asked) {
  const map = new Map(asked.map((t) => [t, t]));
  const apply = (list) => {
    for (const { from, to } of list || []) {
      for (const [k, v] of map) if (v === from) map.set(k, to);
    }
  };
  apply(query.normalized);
  apply(query.redirects);
  return map;
}

export async function revisionIds(titles) {
  const revs = new Map(); // asked title -> { final, rev }
  let done = 0;
  await inPool(chunks(titles, BATCH), async (batch) => {
    const url = `${API}?action=query&format=json&formatversion=2&maxlag=5&redirects=1&prop=info&titles=${encodeURIComponent(batch.join('|'))}`;
    const json = await getJson(url);
    const q = json.query || {};
    const fin = finalTitleMap(q, batch);
    const pageRev = new Map((q.pages || []).filter((p) => !p.missing).map((p) => [p.title, p.lastrevid]));
    for (const t of batch) {
      const f = fin.get(t);
      if (pageRev.has(f)) revs.set(t, { final: f, rev: pageRev.get(f) });
    }
    done += batch.length;
    if (done % 5000 < BATCH) log(`revision check ${done}/${titles.length}`);
  });
  return revs;
}

// Downloads page text in batches of 50. Large batches come back in parts (a "continue" marker),
// so keep asking until every page in the batch has been delivered.
export async function pageContents(titles, onPage) {
  let done = 0;
  await inPool(chunks(titles, BATCH), async (batch) => {
    let cont = '';
    for (let guard = 0; guard < 60; guard++) {
      const url = `${API}?action=query&format=json&formatversion=2&maxlag=5&prop=revisions&rvprop=ids%7Ccontent&rvslots=main&titles=${encodeURIComponent(batch.join('|'))}${cont}`;
      const json = await getJson(url);
      for (const p of (json.query && json.query.pages) || []) {
        const r = p.revisions && p.revisions[0];
        if (r && (r.slots ? r.slots.main && r.slots.main.content != null : r.content != null)) onPage(p.title, r.revid, r.slots ? r.slots.main.content : r.content);
      }
      if (!json.continue) break;
      cont = Object.entries(json.continue).map(([k, v]) => `&${k}=${encodeURIComponent(v)}`).join('');
    }
    done += batch.length;
    if (done % 2500 < BATCH) log(`downloaded ${done}/${titles.length} pages`);
  });
}

export async function fetchWikiCareers({ cacheDir }) {
  const started = Date.now();
  const cacheFile = path.join(cacheDir, 'wiki-cache.json');
  let cache = {};
  try {
    const c = JSON.parse(fs.readFileSync(cacheFile, 'utf8'));
    if (c.v === PARSER_VERSION) cache = c.pages || {};
  } catch { /* no cache yet */ }

  log('querying Wikidata for cricketers with an ESPNcricinfo ID');
  const byTitle = await cricinfoTitles();
  const titles = [...byTitle.keys()];
  log(`${titles.length} English Wikipedia articles`);

  const revs = await revisionIds(titles);
  const stale = [...new Set([...revs.values()].filter(({ final, rev }) => !cache[final] || cache[final].rev !== rev).map((r) => r.final))];
  log(`${stale.length} pages new or changed since last run`);

  await pageContents(stale, (title, rev, text) => {
    let parsed = null;
    try { parsed = parseInfobox(text); } catch { parsed = null; }
    cache[title] = { rev, d: parsed };
  });

  const result = new Map();
  const rejected = [];
  for (const [asked, { final }] of revs) {
    const entry = cache[final];
    if (!entry || !entry.d) continue;
    if (entry.d.rejected) rejected.push(`${final} — ${entry.d.rejected.join('; ')}`);
    if (!entry.d.formats) continue;
    for (const cid of byTitle.get(asked)) {
      if (!result.has(cid)) result.set(cid, { title: final, ...entry.d });
    }
  }

  fs.mkdirSync(cacheDir, { recursive: true });
  // keep only pages still referenced, so the cache doesn't grow forever
  const live = new Set([...revs.values()].map((r) => r.final));
  const pruned = Object.fromEntries(Object.entries(cache).filter(([t]) => live.has(t)));
  fs.writeFileSync(cacheFile, JSON.stringify({ v: PARSER_VERSION, pages: pruned }));
  log(`${result.size} players with international career stats in ${Math.round((Date.now() - started) / 1000)}s; ${rejected.length} infobox columns failed sanity checks`);
  result.rejected = [...new Set(rejected)];
  return result;
}

// Cricsheet's player register: cricsheet id <-> ESPNcricinfo id.
export function parseRegister(csvText) {
  const rows = parseCsv(csvText);
  const header = rows.shift().map((h) => h.trim());
  const idCol = header.indexOf('identifier');
  const ciCols = header.map((h, i) => (/^key_cricinfo/.test(h) ? i : -1)).filter((i) => i >= 0);
  const map = new Map(); // cricinfo -> cricsheet id
  for (const r of rows) {
    const id = r[idCol];
    if (!id) continue;
    for (const c of ciCols) {
      const v = (r[c] || '').trim();
      if (/^\d+$/.test(v) && !map.has(v)) map.set(v, id);
    }
  }
  return map;
}

export function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; } else q = false;
      } else field += ch;
    } else if (ch === '"') q = true;
    else if (ch === ',') { row.push(field); field = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(field); field = '';
      if (row.length > 1 || row[0] !== '') rows.push(row);
      row = [];
    } else field += ch;
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  return rows;
}
