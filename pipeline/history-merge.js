// Merges historical matches (Wikipedia match boxes) into the site data for international formats:
// results lists, summary scorecard pages, all-time records and team results.
// Matches Cricsheet already has are skipped, so the ball-by-ball version always wins.

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { WIKI_FORMAT } from './careers.js';
import { parseResult, fullInnings } from './history.js';

const RECORDS_LIMIT = 25;
const dayNum = (d) => Math.floor(Date.parse(d) / 86400000);
const readJson = (f, dflt) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return dflt; } };
const writeJson = (f, d) => { fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, JSON.stringify(d)); };

export function historyId(m) {
  if (m.cricinfo) return `h${m.cricinfo}`;
  const h = crypto.createHash('sha1').update(`${m.comp}|${m.date}|${m.teams.join('|')}|${m.innings.map((i) => i.r).join(',')}`).digest('hex').slice(0, 6);
  return `h${m.date.replace(/-/g, '')}${h}`;
}

// innings total as a scorecard string, e.g. 245 or 425/8d
const total = (i) => `${i.r}${i.w < 10 ? `/${i.w}` : ''}${i.dec ? 'd' : ''}`;

export function mergeHistory({ byComp, allSummaries, people, tmpOut, compMeta, exporter }) {
  // Wikipedia article title -> site player id, to link top performers to player pages.
  const byTitle = new Map();
  for (const [id, p] of people) if (p.wiki) byTitle.set(p.wiki, id);
  const linkId = (title) => (title ? byTitle.get(title) || null : null);

  const stats = {};
  for (const [compId, list] of byComp) {
    if (!WIKI_FORMAT[compId]) continue;
    const base = path.join(tmpOut, 'comp', compId);
    if (!fs.existsSync(base)) continue;

    // Cricsheet's matches in this competition, for de-duplication.
    const csIds = new Set();
    const csByTeams = new Map();
    for (const s of allSummaries) {
      if (s.c !== compId) continue;
      csIds.add(String(s.id));
      const k = [...s.teams].sort().join('|');
      if (!csByTeams.has(k)) csByTeams.set(k, []);
      csByTeams.get(k).push(dayNum(s.date));
    }
    const inCricsheet = (m) => (m.cricinfo && csIds.has(m.cricinfo))
      || (csByTeams.get([...m.teams].sort().join('|')) || []).some((d) => Math.abs(d - dayNum(m.date)) <= 2);

    const extra = list.filter((m) => !inCricsheet(m));
    const results = readJson(path.join(base, 'results.json'), []);
    const records = readJson(path.join(base, 'records.json'), null);
    const teams = readJson(path.join(base, 'teams.json'), []);
    const teamRow = (t) => {
      let r = teams.find((x) => x.team === t);
      if (!r) { r = { team: t, m: 0, w: 0, l: 0, t: 0, d: 0, nr: 0 }; teams.push(r); }
      return r;
    };

    for (const m of extra) {
      const id = historyId(m);
      const out = parseResult(m.result, m.teams);
      const season = m.date.slice(0, 4);

      results.push({
        id, c: compId, date: m.date, teams: m.teams, venue: m.venue, city: null, event: null, stage: null,
        result: m.result || 'Result not recorded', winner: out.winner, hist: true,
        scores: m.innings.map((i) => ({ team: i.team, r: i.r, w: i.w, o: i.overs || undefined, dec: i.dec || undefined })),
      });

      const opp = (team) => m.teams.find((t) => t !== team) || null;
      writeJson(path.join(tmpOut, 'match', `${id}.json`), {
        id, c: compId, hist: true, date: m.date, teams: m.teams, venue: m.venue, result: m.result, toss: m.toss,
        umpires: m.umpires, pomText: m.pom, cricinfo: m.cricinfo, article: m.article,
        innings: m.innings.map((i) => ({
          team: i.team, runs: i.r, wkts: i.w, overs: i.overs, declared: i.dec, total: total(i),
          bat: i.bat.map((b) => ({ ...b, id: linkId(b.title) })),
          bowl: i.bowl.map((b) => ({ ...b, id: linkId(b.title) })),
        })),
        full: m.full ? m.full.map((i) => ({
          ...i,
          bat: i.bat.map((b) => ({ ...b, id: linkId(b.title) })),
          bowl: i.bowl.map((b) => ({ ...b, id: linkId(b.title) })),
        })) : null,
      });

      if (records) {
        for (const [k, i] of m.innings.entries()) {
          records.highestTotals.push({ team: i.team, opp: opp(i.team), runs: i.r, wkts: i.w, overs: i.overs, declared: i.dec, allOut: i.w >= 10 && !i.dec, date: m.date, season, match: id, hist: true });
          // Top performers from the summary, or every line when a full scorecard exists.
          const full = fullInnings(m, k);
          for (const b of full ? full.bat : i.bat) {
            if (b.runs == null) continue;
            records.highestScores.push({ id: linkId(b.title), name: b.name, team: i.team, opp: opp(i.team), runs: b.runs, balls: b.balls, no: b.no, date: m.date, season, match: id, hist: true });
          }
          for (const w of full ? full.bowl : i.bowl) {
            if (w.wkts == null && w.w == null) continue;
            records.bestFigures.push({ id: linkId(w.title), name: w.name, team: opp(i.team), opp: i.team, wkts: w.w ?? w.wkts, runs: w.r ?? w.runs, date: m.date, season, match: id, hist: true });
          }
        }
      }

      for (const t of m.teams) {
        const r = teamRow(t);
        r.m += 1;
        if (out.winner) { if (out.winner === t) r.w += 1; else r.l += 1; } else if (out.tie) r.t += 1; else if (out.draw) r.d += 1; else r.nr += 1;
      }

      if (exporter) exporter.historyMatch(id, compId, m, linkId);
    }

    results.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    writeJson(path.join(base, 'results.json'), results);
    if (records) {
      records.highestTotals = records.highestTotals.sort((a, b) => b.runs - a.runs || a.wkts - b.wkts).slice(0, RECORDS_LIMIT);
      const histAllOut = extra.flatMap((m) => m.innings.filter((i) => i.w >= 10 && !i.dec).map((i) => ({
        team: i.team, opp: m.teams.find((t) => t !== i.team), runs: i.r, wkts: i.w, overs: i.overs, allOut: true,
        date: m.date, season: m.date.slice(0, 4), match: historyId(m), hist: true,
      })));
      records.lowestTotals = [...(records.lowestTotals || []), ...histAllOut].sort((a, b) => a.runs - b.runs).slice(0, RECORDS_LIMIT);
      records.highestScores = records.highestScores.sort((a, b) => b.runs - a.runs || (a.balls ?? 1e9) - (b.balls ?? 1e9)).slice(0, RECORDS_LIMIT);
      records.bestFigures = records.bestFigures.sort((a, b) => b.wkts - a.wkts || a.runs - b.runs).slice(0, RECORDS_LIMIT);
      records.allTime = true;
      writeJson(path.join(base, 'records.json'), records);
    }
    for (const r of teams) r.pct = r.w + r.l ? Math.round((r.w * 1000) / (r.w + r.l)) / 10 : null;
    teams.sort((a, b) => b.m - a.m);
    writeJson(path.join(base, 'teams.json'), teams);

    const cm = compMeta.find((c) => c.id === compId);
    if (cm && extra.length) {
      cm.histMatches = extra.length;
      cm.firstMatch = extra.reduce((a, m) => (m.date < a ? m.date : a), cm.from || '9999');
    }
    stats[compId] = { found: list.length, added: extra.length, full: extra.filter((m) => m.full).length };
  }
  return stats;
}
