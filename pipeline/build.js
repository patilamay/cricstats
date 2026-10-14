#!/usr/bin/env node
// Builds the site's static data from Cricsheet.
//
//   node pipeline/build.js                       download from cricsheet.org (used by the daily GitHub Action)
//   node pipeline/build.js --local <dir>         read <dir>/<competition id>/*.json instead (offline / dev)
//   node pipeline/build.js --only ipl,t20i-m     limit to some competitions
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

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const opt = (name) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : null; };

const LOCAL = opt('--local');
const ONLY = opt('--only') ? new Set(opt('--only').split(',')) : null;
const OUT = path.resolve(opt('--out') || path.join(ROOT, 'public', 'data'));
const CACHE = path.resolve(opt('--cache') || path.join(ROOT, '.cache'));
const RECENT_SCORECARDS = 400; // most recent matches across all competitions
const PER_COMP_SCORECARDS = 120; // plus the most recent N in each competition
const PER_COMP_RESULTS = 250;
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
  return /^[0-9a-f]{2}/.test(id) ? id.slice(0, 2) : 'xx';
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
  const tmpOut = OUT + '.tmp';
  fs.rmSync(tmpOut, { recursive: true, force: true });

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
      try {
        const raw = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
        if (comp.gender && raw.info && raw.info.gender && raw.info.gender !== comp.gender) continue;
        m = parseMatch(raw, path.basename(f, '.json'));
      } catch (err) {
        bad += 1;
        if (bad <= 5) log(`  could not parse ${f}: ${err.message}`);
        continue;
      }
      agg.add(m);
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

    for (const row of result.rows) {
      let p = people.get(row.id);
      if (!p) { p = { n: row.n, comps: {}, recent: [] }; people.set(row.id, p); }
      p.comps[comp.id] = { m: row.m, t: row.t, b: row.b, w: row.w, f: row.f };
    }

    const { id, name, short, group, format, gender, ballsOnly } = comp;
    compMeta.push({
      id, name, short, group, format, gender, ballsOnly: !!ballsOnly, ...result.summary,
      latestSeason: result.seasons[0] ? result.seasons[0].key : null,
      _recent: compSummaries.slice(0, PER_COMP_SCORECARDS).map((s) => s.id),
    });
  }

  if (!compMeta.length) throw new Error('No competitions produced any data — refusing to publish an empty site.');

  // Recent results and scorecards
  allSummaries.sort((a, b) => (b.date || '').localeCompare(a.date || '') || b.id.localeCompare(a.id));
  const seenIds = new Set();
  const recent = allSummaries.filter((s) => (seenIds.has(s.id) ? false : seenIds.add(s.id)));
  writeJson(path.join(tmpOut, 'recent.json'), recent.slice(0, 80));

  const keep = new Set(recent.slice(0, RECENT_SCORECARDS).map((s) => s.id));
  for (const c of compMeta) { for (const id of c._recent) keep.add(id); delete c._recent; }
  fs.mkdirSync(path.join(tmpOut, 'match'), { recursive: true });
  for (const id of keep) {
    const src = path.join(scratch, `${id}.json`);
    if (fs.existsSync(src)) fs.copyFileSync(src, path.join(tmpOut, 'match', `${id}.json`));
  }

  // Players: search index + sharded detail files
  const shards = new Map();
  const index = [];
  for (const [id, p] of people) {
    if (!Object.keys(p.comps).length) continue;
    p.recent.sort((a, b) => (b.d || '').localeCompare(a.d || ''));
    p.recent = p.recent.slice(0, PLAYER_RECENT);
    const teams = new Map();
    let matches = 0;
    for (const c of Object.values(p.comps)) {
      matches += c.m;
      for (const t of c.t || []) teams.set(t, (teams.get(t) || 0) + c.m);
    }
    const topTeams = [...teams.entries()].sort((a, b) => b[1] - a[1]).slice(0, 2).map((t) => t[0]);
    index.push([id, p.n, topTeams.join(', '), matches]);
    const sh = shardOf(id);
    if (!shards.has(sh)) shards.set(sh, {});
    shards.get(sh)[id] = p;
  }
  index.sort((a, b) => b[3] - a[3]);
  writeJson(path.join(tmpOut, 'players', 'index.json'), index);
  for (const [sh, data] of shards) writeJson(path.join(tmpOut, 'players', `${sh}.json`), data);

  writeJson(path.join(tmpOut, 'leaders.json'), leaders);
  writeJson(path.join(tmpOut, 'meta.json'), {
    updatedAt: new Date().toISOString(),
    latestMatch: recent[0] ? recent[0].date : null,
    source: LOCAL ? 'local sample data' : 'cricsheet.org',
    competitions: compMeta,
    totals: { matches: recent.length, players: index.length, scorecards: keep.size },
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
