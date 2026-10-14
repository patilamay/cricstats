// Coverage report for the Wikipedia match-box extraction (run in CI; prints GitHub annotations).
import { fetchHistory, unknownTeamCodes } from './history.js';

const esc = (s) => s.replace(/%/g, '%25').replace(/\r/g, '').replace(/\n/g, '%0A');
const notice = (t, lines) => console.log(`::notice title=${t}::${esc(lines.join('\n'))}`);

const byComp = await fetchHistory({ cacheDir: '.cache/wiki' });
const lines = [];
for (const [comp, list] of [...byComp.entries()].sort()) {
  const dec = {};
  for (const m of list) { const d = `${m.date.slice(0, 3)}0s`; dec[d] = (dec[d] || 0) + 1; }
  const withId = list.filter((m) => m.cricinfo).length;
  const withPerf = list.filter((m) => m.innings.some((i) => i.bat.length)).length;
  const withFull = list.filter((m) => m.full).length;
  const fullPre = list.filter((m) => m.full && m.date < '2002-01-01').length;
  lines.push(`${comp}: ${list.length} matches (${withId} with cricinfo id, ${withPerf} with top performers, ${withFull} full scorecards, ${fullPre} of them before 2002)`);
  lines.push(`  by decade: ${Object.entries(dec).sort().map(([d, n]) => `${d} ${n}`).join(', ')}`);
  const pre = list.filter((m) => m.date < '2002-01-01').length;
  lines.push(`  before 2002: ${pre}`);
}
notice('History coverage', lines);
notice('Unknown team codes', [[...unknownTeamCodes.entries()].sort((a, b) => b[1] - a[1]).slice(0, 60).map(([c, n]) => `${c}:${n}`).join(', ')]);
for (const [comp, list] of byComp) {
  const sample = [list[0], list[Math.floor(list.length / 3)], list[Math.floor(list.length * 0.66)]].filter(Boolean);
  notice(`Sample ${comp}`, sample.map((m) => `${m.date} ${m.teams.join(' v ')} | ${m.innings.map((i) => `${i.team} ${i.r}/${i.w}${i.dec ? 'd' : ''} [${i.bat.map((b) => `${b.name} ${b.runs}${b.no ? '*' : ''}`).join(', ')}] [${i.bowl.map((b) => `${b.name} ${b.w}/${b.r}`).join(', ')}]`).join(' ; ')} | ${m.result} | ${m.venue} | ci=${m.cricinfo} | ${m.article}`));
}
// Specific famous matches to eyeball
const want = [['test-m', '1960-12-09', 'Tied Test'], ['odi-m', '1983-06-25', 'WC final 1983'], ['test-m', '1932-12-02', 'Bodyline 1st'], ['test-m', '1948-06-10', '1948 1st Test'], ['odi-m', '1996-03-17', 'WC final 1996'], ['test-m', '1981-07-16', 'Botham Headingley'], ['test-m', '2001-03-11', 'Kolkata 2001'], ['test-m', '1994-04-16', 'Lara 375']];
notice('Spot checks', want.map(([c, d, label]) => { const m = (byComp.get(c) || []).find((x) => x.date === d); return `${label} ${d}: ${m ? `${m.teams.join(' v ')} ${m.innings.map((i) => `${i.r}/${i.w}`).join(' ')} ${m.result}${m.full ? ` FULL: ${m.full.map((i) => `${i.team} ${i.total} (${i.bat.length} bat, ${i.bowl.length} bowl)`).join('; ')}` : ''}` : 'MISSING'}`; }));
const fulls = [...byComp.values()].flat().filter((m) => m.full && m.date < '2002-01-01').slice(0, 12);
notice('Full scorecards before 2002 (sample)', fulls.map((m) => `${m.date} ${m.teams.join(' v ')} (${m.comp}) ${m.article}`));
