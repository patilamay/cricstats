// The Results page reads one file per year across every competition (results/<year>.json),
// plus results/years.json: [[year, matches], ...] newest first. Built from each competition's
// results.json after historical matches are merged in, so the page can filter by competition,
// team and series without loading every competition's full history.
import fs from 'node:fs';
import path from 'node:path';
import { buildSeries } from './series.js';

const order = (a, b) => (b.date || '').localeCompare(a.date || '') || String(b.id).localeCompare(String(a.id));

export function splitByYear(lists) {
  const seen = new Set();
  const byYear = new Map();
  for (const list of lists) {
    for (const m of list) {
      if (!m || !m.date || seen.has(m.id)) continue;
      seen.add(m.id);
      const y = m.date.slice(0, 4);
      if (!byYear.has(y)) byYear.set(y, []);
      byYear.get(y).push(m);
    }
  }
  const years = [...byYear.keys()].sort((a, b) => b.localeCompare(a));
  for (const y of years) byYear.get(y).sort(order);
  return { years: years.map((y) => [Number(y), byYear.get(y).length]), byYear };
}

export function writeResultYears(outDir, compMeta) {
  const lists = compMeta.map((c) => {
    try { return JSON.parse(fs.readFileSync(path.join(outDir, 'comp', c.id, 'results.json'), 'utf8')); } catch { return []; }
  });
  // Series first, so each match can carry its series id (sid) for linking.
  const seen = new Set();
  const all = lists.flat().filter((m) => m && m.id && !seen.has(m.id) && seen.add(m.id));
  const series = buildSeries(all, {
    compGroup: Object.fromEntries(compMeta.map((c) => [c.id, c.group])),
    leagueComps: new Set(compMeta.filter((c) => /league/i.test(c.group)).map((c) => c.id)),
  });
  const sidOf = new Map();
  for (const s of series) for (const id of s.ids) sidOf.set(id, s.id);
  for (const m of all) { const sid = sidOf.get(m.id); if (sid) m.sid = sid; }

  const { years, byYear } = splitByYear([all]);
  const dir = path.join(outDir, 'results');
  fs.mkdirSync(dir, { recursive: true });
  for (const [y] of years) fs.writeFileSync(path.join(dir, `${y}.json`), JSON.stringify(byYear.get(String(y))));
  fs.writeFileSync(path.join(dir, 'years.json'), JSON.stringify(years));
  // The Series tab's index: everything but the match list (the page reads matches from the year files).
  fs.writeFileSync(path.join(dir, 'series.json'), JSON.stringify(series.map(({ ids, ...rest }) => rest)));
  return { years, series: series.length };
}
