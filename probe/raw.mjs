import { getJson, API } from '../pipeline/wiki.js';
import { findMatchBoxes, parseMatchBox, classify } from '../pipeline/matchbox.js';
const esc = (s) => s.replace(/%/g, '%25').replace(/\r/g, '').replace(/\n/g, '%0A');
for (const a of ['English cricket team in Australia in 1932–33', '1983 Cricket World Cup final', '1983 Cricket World Cup', 'Australian cricket team in England in 1948', 'Template:Test match']) {
  const j = await getJson(`${API}?action=query&format=json&formatversion=2&prop=revisions&rvprop=content&rvslots=main&redirects=1&titles=${encodeURIComponent(a)}`);
  const pg = j.query.pages[0];
  const text = pg.revisions ? pg.revisions[0].slots.main.content : '';
  const boxes = findMatchBoxes(text);
  const lines = [`${boxes.length} boxes; length ${text.length}`];
  for (const b of boxes.slice(0, 2)) {
    const m = parseMatchBox(b);
    lines.push(`--- kind=${b.kind} headings=${b.headings.join(' > ')} parsed=${m ? `${m.date} ${m.teams.join(' v ')} inns=${m.innings.length} national=${m.national} class=${classify(m, a)}` : 'null'}`);
    lines.push(b.raw.slice(0, 1600));
  }
  if (!boxes.length) {
    const i = text.search(/==\s*(1st Test|First Test|Test series|Tests|Final|Scorecard)/i);
    lines.push(text.slice(Math.max(0, i), Math.max(0, i) + 2500));
  }
  console.log(`::notice title=${a}::${esc(lines.join('\n'))}`);
}
