#!/usr/bin/env node
// Builds the site's static data from Cricsheet.
//
//   node pipeline/build.js                       download from cricsheet.org (used by the daily GitHub Action)
//   node pipeline/build.js --local <dir>         read <dir>/<competition id>/*.json instead (offline / dev)
//   node pipeline/build.js --only ipl,t20i-m     limit to some competitions
//   node pipeline/build.js --no-wiki             skip Wikipedia career totals
//   node pipeline/build.js --wiki-local <dir>    read <dir>/people.csv and <dir>/wiki.json instead of downloading
//   node pipeline/build.js --export <dir>        also write database tables as gzipped CSV (see make_db.py)
//   node pipeline/build.js --history-local <f>   historical matches from a local JSON file instead of Wikipedia
//
// Output goes to public/data/ (served as-is by the site).

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { COMPETITIONS, CRICSHEET_BASE } from './competitions.js';
import { parseMatch } from './parse.js';
import { CompetitionAggregator } from './aggregate.js';
import { buildLeaders } from './leaders.js';
import { writeResultYears } from './results-index.js';
import { commonsPath, fetchWikiCareers, parseRegister, photoCredits } from './wiki.js';
import { WIKI_FORMAT, combine } from './careers.js';
import { Exporter } from './export.js';
import { fetchHistory } from './history.js';
import { mergeHistory } from './history-merge.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const opt = (name) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : null; };

const LOCAL = opt('--local');
const ONLY = opt('--only') ? new Set(opt('--only').split(',')) : null;
const OUT = path.resolve(opt('--out') || path.join(ROOT, 'public', 'data'));
const CACHE = path.resolve(opt('--cache') || path.join(ROOT, '.cache'));
const NO_WIKI = args.includes('--no-wiki');
const WIKI_LOCAL = opt('--wiki-local');
const EXPORT = opt('--export'); // also write relational CSVs for the downloadable database
const HISTORY_LOCAL = opt('--history-local'); // JSON { compId: [matches] } instead of fetching from Wikipedia
const PER_COMP_RESULTS = Infinity; // full results history for every competition
const PLAYER_RECENT = 15;

const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);

function writeJson(file, data) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(data));
}

async function download(url, dest) {
  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      const res = await fetch(url, { headers: { 'User-Agent': 'cricstats-site-builder (+https://github.com/patilamay/cricstats)' } });
      if (res.status === 404) return false;
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const buf = Buffer.from(await res.arrayBuffer());
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      fs.writeFileSync(dest, buf);
      return true;
    } catch (err) {
      log(`  download failed (${attempt}/4): ${err.message}`);
      if (attempt === 4) throw err;
      await new Promise((r) => setTimeout(r, attempt * 5000));
    }
  }
  return false;
}

async function sourceDir(comp) {
  if (LOCAL) {
    const dir = path.join(path.resolve(LOCAL), comp.id);
    return fs.existsSync(dir) ? dir : null;
  }
  const zipPath = path.join(CACHE, comp.zip);
  const dir = path.join(CACHE, comp.id);
  log(`downloading ${comp.zip}`);
  const ok = await download(CRICSHEET_BASE + comp.zip, zipPath);
  if (!ok) { log(`  ${comp.zip} not found on Cricsheet, skipping`); return null; }
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
  execFileSync('unzip', ['-q', '-o', zipPath, '*.json', '-d', dir]);
  return dir;
}

function summary(m, compId) {
  return {
    id: m.id,
    c: compId,
    date: m.date,
    teams: m.teams,
    venue: m.venue,
    city: m.city,
    event: m.event,
    stage: m.stage,
    result: m.result,
    winner: m.outcome.winner,
    scores: m.innings.filter((i) => !i.forfeited).map((i) => ({
      team: i.team, r: i.runs, w: i.wkts, o: i.overs, so: i.superOver || undefined, dec: i.declared || undefined,
    })),
  };
}

function shardOf(id) {
  if (/^w\d+$/.test(id)) return `w${Number(id.slice(1)) % 32}`; // Wikipedia-only players
  return /^[0-9a-f]{2}/.test(id) ? id.slice(0, 2) : 'xx';
}

// Display name from Wikipedia: infobox name, else the article title without "(cricketer)" etc.
// Display name: the Wikipedia article title without a disambiguator like "(cricketer)".
// (Infobox names often carry honours and titles: "Sir ...", "... SI", "The Baroness ...".)
function wikiName(w) {
  return w.title.replace(/\s*\([^)]*\)\s*$/, '');
}

async function loadWikiSources() {
  if (WIKI_LOCAL) {
    const dir = path.resolve(WIKI_LOCAL);
    const register = parseRegister(fs.readFileSync(path.join(dir, 'people.csv'), 'utf8'));
    const wiki = new Map(Object.entries(JSON.parse(fs.readFileSync(path.join(dir, 'wiki.json'), 'utf8'))));
    return { register, wiki };
  }
  const regFile = path.join(CACHE, 'people.csv');
  log('downloading Cricsheet player register');
  await download('https://cricsheet.org/register/people.csv', regFile);
  const register = parseRegister(fs.readFileSync(regFile, 'utf8'));
  const wiki = await fetchWikiCareers({ cacheDir: path.join(CACHE, 'wiki') });
  return { register, wiki };
}

async function addWikipediaCareers({ compData, people, leaders, compMeta, tmpOut }) {
  const { register, wiki } = await loadWikiSources();
  log(`register: ${register.size} ESPNcricinfo links; Wikipedia: ${wiki.size} players`);

  // Attach each Wikipedia player to a Cricsheet id, or give them their own id.
  const byPlayer = new Map(); // site player id -> wiki entry
  for (const [cid, w] of wiki) {
    const csId = register.get(cid);
    const id = csId && people.has(csId) ? csId : `w${cid}`;
    if (!byPlayer.has(id)) byPlayer.set(id, w);
  }

  const stats = { matched: 0, wikiOnly: 0, byComp: {} };
  for (const [compId, { comp, rows, ledger }] of compData) {
    const fmt = WIKI_FORMAT[compId];
    if (!fmt) continue;
    const csRows = new Map(rows.map((r) => [r.id, r]));
    const ids = new Set(csRows.keys());
    for (const [id, w] of byPlayer) if (w.formats && w.formats[fmt]) ids.add(id);

    const table = [];
    const src = { c: 0, w: 0, wc: 0 };
    for (const id of ids) {
      const w = byPlayer.get(id);
      const col = w && w.formats ? w.formats[fmt] : null;
      const csRow = csRows.get(id) || null;
      const career = combine({ wiki: col ? { asof: w.asof, f: col } : null, csRow, ledger: ledger.get(id) || [] });
      if (!career) continue;
      src[career.src] += 1;
      const name = w ? wikiName(w) : csRow.n;
      // When Wikipedia supplies most of a career (e.g. matches Cricsheet withholds), lead with the player's country.
      const country = w && w.country && w.country.length < 40 ? w.country : null;
      const csTeams = csRow ? csRow.t : [];
      const teams = country && (career.src !== 'c' || !csTeams.length) ? [country, ...csTeams.filter((t) => t !== country)] : csTeams;
      table.push({ id, n: name, t: teams, ...career });

      let p = people.get(id);
      if (!p) { p = { n: name, comps: {}, recent: [] }; people.set(id, p); }
      if (w) { p.fn = wikiName(w); p.wiki = w.title; if (country) p.country = country; }
      p.career = p.career || {};
      p.career[compId] = career;
    }
    table.sort((a, b) => b.r - a.r);
    writeJson(path.join(tmpOut, 'alltime', `${compId}.json`), table);
    stats.byComp[compId] = { players: table.length, ...src };

    // Home page: all-time runs and wickets leaders replace the ball-by-ball-era ones.
    const top = (key, sub) => [...table].sort((a, b) => b[key] - a[key]).slice(0, 5).map((r) => ({ id: r.id, n: r.n, t: r.t.slice(0, 2), v: r[key], sub: sub(r) }));
    const allTime = [
      { key: 'runs', title: 'Most runs', unit: 'runs', alltime: true, rows: top('r', (r) => `${r.m} matches, avg ${r.avg ?? '–'}`) },
      { key: 'wickets', title: 'Most wickets', unit: 'wkts', alltime: true, rows: top('wk', (r) => `${r.m} matches, avg ${r.bavg ?? '–'}`) },
    ];
    leaders[compId] = [...allTime, ...(leaders[compId] || []).filter((b) => b.key !== 'runs' && b.key !== 'wickets')];
    const cm = compMeta.find((c) => c.id === comp.id);
    if (cm) cm.alltime = true;
  }
  // Photos: Wikimedia Commons images with their credits (a player without a known licence gets none).
  const withImg = [...byPlayer].filter(([id, w]) => w.img && people.has(id));
  if (withImg.length) {
    try {
      const credits = WIKI_LOCAL ? new Map() : await photoCredits(withImg.map(([, w]) => w.img), { cacheDir: path.join(CACHE, 'wiki') });
      let n = 0;
      for (const [id, w] of withImg) {
        const c = credits.get(w.img);
        if (c) { people.get(id).photo = { f: commonsPath(w.img), a: c.a, l: c.l }; n += 1; }
      }
      stats.photos = n;
    } catch (err) {
      log(`photo credits failed, publishing without photos: ${err.message}`);
    }
  }
  for (const id of byPlayer.keys()) { if (people.has(id)) { if (id.startsWith('w')) stats.wikiOnly += 1; else stats.matched += 1; } }
  log(`all-time tables: ${JSON.stringify(stats)}`);
  const rejected = wiki.rejected || [];
  return {
    register,
    meta: { players: wiki.size, matched: stats.matched, wikiOnly: stats.wikiOnly, byComp: stats.byComp, rejectedCount: rejected.length, rejectedSample: rejected.slice(0, 25), fetchedAt: new Date().toISOString() },
  };
}

async function main() {
  const started = Date.now();
  const comps = COMPETITIONS.filter((c) => !ONLY || ONLY.has(c.id));
  const scratch = path.join(CACHE, 'scorecards');
  fs.rmSync(scratch, { recursive: true, force: true });
  fs.mkdirSync(scratch, { recursive: true });

  const allSummaries = [];
  const people = new Map(); // id -> { n, comps: {}, recent: [] }
  const compMeta = [];
  const leaders = {};
  const compData = new Map(); // comp id -> { rows, ledger }
  const tmpOut = OUT + '.tmp';
  fs.rmSync(tmpOut, { recursive: true, force: true });
  const exporter = EXPORT ? new Exporter(path.resolve(EXPORT)) : null;
  let register = null; // cricinfo id -> cricsheet id (filled by the Wikipedia step)

  for (const comp of comps) {
    const dir = await sourceDir(comp);
    if (!dir) continue;
    const files = fs.readdirSync(dir).filter((f) => f.endsWith('.json'));
    log(`${comp.id}: ${files.length} matches`);
    const agg = new CompetitionAggregator(comp);
    const compSummaries = [];
    let bad = 0;

    for (const f of files) {
      let m;
      let raw;
      try {
        raw = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
        if (comp.gender && raw.info && raw.info.gender && raw.info.gender !== comp.gender) continue;
        m = parseMatch(raw, path.basename(f, '.json'));
      } catch (err) {
        bad += 1;
        if (bad <= 5) log(`  could not parse ${f}: ${err.message}`);
        continue;
      }
      agg.add(m);
      if (exporter) { exporter.match(raw, m, comp.id); await exporter.drain(); }
      const s = summary(m, comp.id);
      compSummaries.push(s);
      allSummaries.push(s);
      fs.writeFileSync(path.join(scratch, `${m.id}.json`), JSON.stringify({ ...m, c: comp.id, players: undefined }));

      // per-player recent form, one entry per match
      const perf = new Map();
      const entry = (id, name, team) => {
        if (!perf.has(id)) perf.set(id, { id, name, team });
        return perf.get(id);
      };
      for (const inn of m.innings) {
        if (inn.superOver || inn.forfeited) continue;
        for (const b of inn.batting) {
          const e = entry(b.id, b.name, inn.team);
          e.bat = e.bat || [];
          e.bat.push(b.out ? `${b.runs}` : `${b.runs}*`);
          e.bf = (e.bf || 0) + b.balls;
        }
        for (const w of inn.bowling) {
          const e = entry(w.id, w.name, inn.opp);
          e.bowl = e.bowl || [];
          e.bowl.push(`${w.wkts}/${w.runs}`);
        }
      }
      for (const e of perf.values()) {
        let p = people.get(e.id);
        if (!p) { p = { n: e.name, comps: {}, recent: [] }; people.set(e.id, p); }
        p.recent.push({
          d: m.date, c: comp.id, mid: m.id,
          vs: m.teams.find((t) => t !== e.team) || null, team: e.team,
          bat: e.bat ? e.bat.join(' & ') : undefined, bf: e.bf,
          bowl: e.bowl ? e.bowl.join(' & ') : undefined,
        });
      }
    }
    if (bad) log(`  ${bad} files skipped`);
    if (!agg.matchCount) continue;

    const result = agg.finalize();
    const base = path.join(tmpOut, 'comp', comp.id);
    writeJson(path.join(base, 'stats.json'), result.rows);
    writeJson(path.join(base, 'records.json'), result.records);
    writeJson(path.join(base, 'teams.json'), result.teams);
    writeJson(path.join(base, 'seasons.json'), result.seasons);
    compSummaries.sort((a, b) => (b.date || '').localeCompare(a.date || '') || b.id.localeCompare(a.id));
    writeJson(path.join(base, 'results.json'), compSummaries.slice(0, PER_COMP_RESULTS));
    leaders[comp.id] = buildLeaders(comp, result.rows, result.records);
    compData.set(comp.id, { comp, rows: result.rows, ledger: agg.ledger });

    for (const row of result.rows) {
      let p = people.get(row.id);
      if (!p) { p = { n: row.n, comps: {}, recent: [] }; people.set(row.id, p); }
      p.comps[comp.id] = { m: row.m, t: row.t, b: row.b, w: row.w, f: row.f };
    }

    const { id, name, short, group, format, gender, ballsOnly } = comp;
    compMeta.push({
      id, name, short, group, format, gender, ballsOnly: !!ballsOnly, ...result.summary,
      latestSeason: result.seasons[0] ? result.seasons[0].key : null,
    });
  }

  if (!compMeta.length) throw new Error('No competitions produced any data — refusing to publish an empty site.');

  // Recent results and scorecards
  allSummaries.sort((a, b) => (b.date || '').localeCompare(a.date || '') || b.id.localeCompare(a.id));
  const seenIds = new Set();
  const recent = allSummaries.filter((s) => (seenIds.has(s.id) ? false : seenIds.add(s.id)));
  writeJson(path.join(tmpOut, 'recent.json'), recent.slice(0, 80));

  const keep = new Set(recent.map((s) => s.id)); // every scorecard
  fs.mkdirSync(path.join(tmpOut, 'match'), { recursive: true });
  for (const id of keep) {
    const src = path.join(scratch, `${id}.json`);
    if (fs.existsSync(src)) fs.copyFileSync(src, path.join(tmpOut, 'match', `${id}.json`));
  }

  // All-time international careers: Wikipedia totals for older matches + Cricsheet for newer ones
  let wikiMeta = null;
  if (!NO_WIKI && [...compData.keys()].some((id) => WIKI_FORMAT[id])) {
    try {
      const res = await addWikipediaCareers({ compData, people, leaders, compMeta, tmpOut });
      wikiMeta = res.meta;
      register = res.register;
    } catch (err) {
      log(`Wikipedia step failed, publishing Cricsheet-only stats: ${err.stack || err.message}`);
      console.log(`::warning title=Wikipedia step failed::${String(err.stack || err.message).replace(/\n/g, '%0A')}`);
    }
  }

  // Historical internationals (before ball-by-ball data, plus matches Cricsheet withholds)
  let histStats = null;
  if (!NO_WIKI) {
    try {
      const byComp = HISTORY_LOCAL
        ? new Map(Object.entries(JSON.parse(fs.readFileSync(path.resolve(HISTORY_LOCAL), 'utf8'))))
        : await fetchHistory({ cacheDir: path.join(CACHE, 'wiki') });
      histStats = mergeHistory({ byComp, allSummaries, people, tmpOut, compMeta, exporter });
      log(`historical matches: ${JSON.stringify(histStats)}`);
    } catch (err) {
      log(`History step failed, publishing without historical matches: ${err.stack || err.message}`);
      console.log(`::warning title=History step failed::${String(err.stack || err.message).replace(/\n/g, '%0A')}`);
    }
  }

  // Database export: players and complete careers
  if (exporter) {
    const cricinfoOf = new Map();
    if (register) for (const [ci, csId] of register) if (!cricinfoOf.has(csId)) cricinfoOf.set(csId, ci);
    for (const c of compMeta) exporter.competition(c);
    for (const [id, p] of people) {
      if (!Object.keys(p.comps).length && !p.career) continue;
      exporter.player(id, p, /^w\d+$/.test(id) ? id.slice(1) : cricinfoOf.get(id));
      for (const [cid, c] of Object.entries(p.career || {})) exporter.career(id, p.fn || p.n, cid, c);
      await exporter.drain();
    }
    await exporter.close();
    log(`database tables written to ${path.resolve(EXPORT)}`);
  }

  // Players: search index + sharded detail files
  const shards = new Map();
  const index = [];
  for (const [id, p] of people) {
    if (!Object.keys(p.comps).length && !p.career) continue;
    p.recent.sort((a, b) => (b.d || '').localeCompare(a.d || ''));
    p.recent = p.recent.slice(0, PLAYER_RECENT);
    const teams = new Map();
    let matches = 0;
    for (const [cid, c] of Object.entries(p.comps)) {
      const car = p.career && p.career[cid];
      const m = car ? car.m : c.m;
      matches += m;
      if (car && car.src !== 'c' && p.country) teams.set(p.country, (teams.get(p.country) || 0) + m);
      else for (const t of c.t || []) teams.set(t, (teams.get(t) || 0) + m);
    }
    for (const [cid, c] of Object.entries(p.career || {})) {
      if (p.comps[cid]) continue;
      matches += c.m;
      if (p.country) teams.set(p.country, (teams.get(p.country) || 0) + c.m);
    }
    const topTeams = [...teams.entries()].sort((a, b) => b[1] - a[1]).slice(0, 2).map((t) => t[0]);
    const row = [id, p.fn || p.n, topTeams.join(', '), matches];
    if (p.fn && p.fn !== p.n) row.push(p.n); // Cricsheet's name, also searchable
    index.push(row);
    const sh = shardOf(id);
    if (!shards.has(sh)) shards.set(sh, {});
    shards.get(sh)[id] = p;
  }
  index.sort((a, b) => b[3] - a[3]);
  // The Players page lists the 30 most-capped with photos: only those rows carry one (keeps the index small).
  for (const row of index.slice(0, 30)) {
    const ph = people.get(row[0]).photo;
    if (ph) { if (row.length < 5) row[4] = null; row[5] = ph.f; }
  }
  writeJson(path.join(tmpOut, 'players', 'index.json'), index);
  for (const [sh, data] of shards) writeJson(path.join(tmpOut, 'players', `${sh}.json`), data);

  // Results page: every competition's results, one file per year.
  const resultYears = writeResultYears(tmpOut, compMeta.map((c) => c.id));
  log(`results by year: ${resultYears.length} years, latest ${resultYears[0] ? resultYears[0].join(': ') : 'none'}`);

  // Leader boards carry each player's photo, so the home page needn't load player files.
  for (const boards of Object.values(leaders)) {
    for (const b of boards || []) for (const r of b.rows || []) {
      const ph = r.id && people.get(r.id) && people.get(r.id).photo;
      if (ph) r.ph = ph.f;
    }
  }
  writeJson(path.join(tmpOut, 'leaders.json'), leaders);
  writeJson(path.join(tmpOut, 'meta.json'), {
    updatedAt: new Date().toISOString(),
    latestMatch: recent[0] ? recent[0].date : null,
    source: LOCAL ? 'local sample data' : 'cricsheet.org',
    competitions: compMeta,
    totals: { matches: recent.length, players: index.length, scorecards: keep.size },
    wiki: wikiMeta,
    history: histStats,
  });

  // Swap the new data in only after everything succeeded.
  fs.rmSync(OUT, { recursive: true, force: true });
  fs.renameSync(tmpOut, OUT);
  log(`done: ${recent.length} matches, ${index.length} players, ${keep.size} scorecards in ${Math.round((Date.now() - started) / 1000)}s`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
