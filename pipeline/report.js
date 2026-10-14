#!/usr/bin/env node
// Prints a short data-quality report as GitHub Actions annotations, so each run's
// all-time figures can be checked at a glance (top 5s and some well-known careers).
import fs from 'node:fs';
import path from 'node:path';

const DATA = path.resolve(process.argv[2] || 'public/data');
const read = (f) => JSON.parse(fs.readFileSync(path.join(DATA, f), 'utf8'));
const esc = (s) => s.replace(/%/g, '%25').replace(/\r/g, '').replace(/\n/g, '%0A');
const notice = (title, lines) => console.log(`::notice title=${title}::${esc(lines.join('\n'))}`);

const meta = read('meta.json');
if (!meta.wiki) {
  console.log('::warning title=Wikipedia::No Wikipedia career data in this build (step skipped or failed); site shows ball-by-ball stats only.');
}
notice('Summary', [
  `latest match ${meta.latestMatch}, ${meta.totals.matches} matches, ${meta.totals.players} players, ${meta.totals.scorecards} scorecards`,
  meta.wiki ? `Wikipedia: ${meta.wiki.players} articles parsed, ${meta.wiki.matched} linked to Cricsheet players, ${meta.wiki.wikiOnly} pre-Cricsheet players` : 'Wikipedia: none',
  meta.wiki ? `per format: ${JSON.stringify(meta.wiki.byComp)}` : '',
  meta.wiki ? `${meta.wiki.rejectedCount} infobox columns rejected by sanity checks; sample:` : '',
  ...((meta.wiki && meta.wiki.rejectedSample) || []).map((r) => `  ${r}`),
]);

const WATCH = {
  'test-m': ['Tendulkar', 'Bradman', 'Anderson', 'Muralitharan', 'Kohli', 'Joe Root', 'Kallis', 'Gavaskar'],
  'odi-m': ['Tendulkar', 'Kohli', 'Muralitharan', 'Viv Richards', 'Aarif Sheikh'],
  't20i-m': ['Kohli', 'Rohit Sharma', 'Babar Azam', 'Rashid Khan'],
  'test-w': ['Mithali', 'Ellyse Perry', 'Heyhoe Flint'],
  'odi-w': ['Mithali', 'Jhulan', 'Charlotte Edwards'],
  't20i-w': ['Suzie Bates', 'Mandhana'],
};
const fmt = (r) => `${r.n} (${r.t.slice(0, 1).join('')}): ${r.m}m ${r.r}r avg ${r.avg ?? '-'} ${r.c100}x100 hs ${r.hs ?? '-'}${r.hsNo ? '*' : ''} | ${r.wk}w avg ${r.bavg ?? '-'} bbi ${r.bbi ?? '-'} | ${r.ct}ct [${r.src}${r.asof ? ` as of ${r.asof}` : ''}]`;

for (const [comp, names] of Object.entries(WATCH)) {
  const file = path.join(DATA, 'alltime', `${comp}.json`);
  if (!fs.existsSync(file)) continue;
  const t = JSON.parse(fs.readFileSync(file, 'utf8'));
  const lines = [`${t.length} players`];
  lines.push('Top runs:');
  for (const r of [...t].sort((a, b) => b.r - a.r).slice(0, 5)) lines.push(`  ${fmt(r)}`);
  lines.push('Top wickets:');
  for (const r of [...t].sort((a, b) => b.wk - a.wk).slice(0, 5)) lines.push(`  ${fmt(r)}`);
  lines.push('Watched:');
  for (const n of names) {
    const hits = t.filter((r) => r.n.toLowerCase().includes(n.toLowerCase())).sort((a, b) => b.m - a.m);
    lines.push(`  ${n}: ${hits.length ? fmt(hits[0]) : 'NOT FOUND'}${hits.length ? ` id=${hits[0].id} teams=${hits[0].t.join('/')}` : ''}`);
    for (const h of hits.slice(1, 3)) lines.push(`      also: ${fmt(h)} id=${h.id} teams=${h.t.join('/')}`);
  }
  notice(`All-time ${comp}`, lines);
}
