// Parses the career-statistics block of Wikipedia's {{Infobox cricketer}}.
//
//   | column1 = [[Test cricket|Test]]     | matches1 = 200     | runs1 = 15,921
//   | bat avg1 = 53.78                     | 100s/50s1 = 51/68  | top score1 = 248*
//   | deliveries1 = 4,240                  | wickets1 = 46      | bowl avg1 = 54.17
//   | fivefor1 = 0  | tenfor1 = 0          | best bowling1 = 3/10
//   | catches/stumpings1 = 115/–           | date = 15 November | year = 2013
//
// Only international columns (Test, ODI, T20I, and the women's equivalents) are kept.

const MONTHS = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];

// Find "{{Infobox cricketer ... }}" and return its inner text (balanced braces).
export function extractInfobox(wikitext) {
  const m = /\{\{\s*infobox[ _]cricketer\b/i.exec(wikitext || '');
  if (!m) return null;
  let depth = 0;
  for (let i = m.index; i < wikitext.length - 1; i++) {
    const two = wikitext.slice(i, i + 2);
    if (two === '{{') { depth++; i++; } else if (two === '}}') {
      depth--; i++;
      if (depth === 0) return wikitext.slice(m.index + 2, i - 1);
    }
  }
  return null;
}

// Split template params on top-level "|" (ignoring pipes inside [[...]] and {{...}}).
export function splitParams(inner) {
  const params = {};
  let depthSq = 0;
  let depthCurly = 0;
  let cur = '';
  const parts = [];
  for (let i = 0; i < inner.length; i++) {
    const two = inner.slice(i, i + 2);
    if (two === '[[') { depthSq++; cur += two; i++; continue; }
    if (two === ']]') { depthSq = Math.max(0, depthSq - 1); cur += two; i++; continue; }
    if (two === '{{') { depthCurly++; cur += two; i++; continue; }
    if (two === '}}') { depthCurly = Math.max(0, depthCurly - 1); cur += two; i++; continue; }
    if (inner[i] === '|' && depthSq === 0 && depthCurly === 0) { parts.push(cur); cur = ''; continue; }
    cur += inner[i];
  }
  parts.push(cur);
  for (const p of parts.slice(1)) {
    const eq = p.indexOf('=');
    if (eq < 0) continue;
    const key = p.slice(0, eq).trim().toLowerCase().replace(/\s+/g, ' ');
    params[key] = p.slice(eq + 1);
  }
  return params;
}

const ENTITIES = { '&nbsp;': ' ', '&ndash;': '–', '&mdash;': '—', '&minus;': '-', '&#8211;': '–', '&amp;': '&' };

// Strip wiki markup down to plain text.
export function clean(v) {
  if (v == null) return '';
  let s = String(v);
  s = s.replace(/<!--[\s\S]*?-->/g, '');
  s = s.replace(/<ref[^>]*\/>/gi, '').replace(/<ref[^>]*>[\s\S]*?<\/ref>/gi, '');
  s = s.replace(/<br\s*\/?>/gi, ' ').replace(/<[^>]+>/g, '');
  // Footnotes and citation tags are not part of the value ({{refn|23 for Ireland; 225 for England}}).
  for (let k = 0; k < 3; k++) s = s.replace(/\{\{\s*(refn|efn|efn-[a-z]+|notetag|#tag:ref|sfn|sfnp|r|cn|citation needed|fact|dubious|clarify|when)\b[^{}]*\}\}/gi, '');
  // {{0}} / {{0|00}} are invisible alignment padding — drop entirely.
  s = s.replace(/\{\{\s*0\s*(\|[^{}]*)?\}\}/g, '');
  // Templates that render a symbol.
  s = s.replace(/\{\{\s*(not out|no|asterisk|\*)\s*\}\}/gi, '*');
  s = s.replace(/\{\{\s*(ndash|en dash|snd|spaced ndash)\s*\}\}/gi, '–');
  s = s.replace(/\{\{\s*(nbsp|thinsp|sp)\s*\}\}/gi, ' ');
  // Links first, so pipes inside [[target|label]] don't confuse template argument splitting.
  s = s.replace(/\[\[([^\]|]*)\|([^\]]*)\]\]/g, '$2').replace(/\[\[([^\]]*)\]\]/g, '$1');
  // Repeatedly unwrap remaining templates to their last positional argument ({{nowrap|51/68}} → 51/68).
  for (let k = 0; k < 5 && /\{\{/.test(s); k++) {
    s = s.replace(/\{\{([^{}]*)\}\}/g, (_, body) => {
      const args = body.split('|').map((a) => a.trim()).filter((a) => a && !/^[a-z_ ]+=/i.test(a));
      return args.length > 1 ? args[args.length - 1] : '';
    });
  }
  s = s.replace(/\[https?:\/\/\S+\s+([^\]]*)\]/g, '$1').replace(/\[https?:\/\/[^\]]*\]/g, '');
  s = s.replace(/'''?/g, '');
  for (const [e, r] of Object.entries(ENTITIES)) s = s.split(e).join(r);
  return s.replace(/\s+/g, ' ').trim();
}

const isBlank = (s) => s === '' || /^[–—\-−]+$/.test(s) || /^n\/?a$/i.test(s);

// The first number in the cell. Cells for players who represented two countries hold two numbers
// ("248 (23 for Ireland)", "109<br>54"); joining their digits gave nonsense like 24823.
// Commas between digits are thousands separators.
function firstNumber(v, re) {
  const s = clean(v).replace(/(\d),(?=\d)/g, '$1');
  if (isBlank(s.replace(/\s/g, ''))) return null;
  const m = re.exec(s);
  return m ? m[0] : null;
}

export function toInt(v) {
  const t = firstNumber(v, /\d+/);
  const n = t == null ? NaN : parseInt(t, 10);
  return Number.isFinite(n) ? n : null;
}

export function toFloat(v) {
  const t = firstNumber(v, /\d*\.\d+|\d+/);
  const n = t == null ? NaN : parseFloat(t);
  return Number.isFinite(n) ? n : null;
}

// "51/68" → [51, 68]; "115/–" → [115, 0]
export function pair(v) {
  const s = clean(v).replace(/\s/g, '');
  if (isBlank(s)) return [null, null];
  const [a, b] = s.split('/');
  const n = (x) => (x == null || isBlank(x) ? 0 : parseInt(x.replace(/,/g, ''), 10) || 0);
  return [n(a), n(b)];
}

// "248*" → { hs: 248, no: true }
export function topScore(v) {
  const s = clean(v).replace(/[,\s]/g, '');
  const m = /^(\d+)(\*)?/.exec(s);
  return m ? { hs: Number(m[1]), no: !!m[2] } : null;
}

// "5/32" → { w: 5, r: 32 }
export function bestBowling(v) {
  const s = clean(v).replace(/\s/g, '');
  const m = /^(\d+)\/(\d+)/.exec(s);
  return m ? { w: Number(m[1]), r: Number(m[2]) } : null;
}

// Column label → { format: 'Test' | 'ODI' | 'T20I', women: bool } or null for non-international columns.
export function columnFormat(v) {
  const s = clean(v).toUpperCase().replace(/[\s.'’]/g, '');
  if (!s) return null;
  const women = /^W(?!ICKET)/.test(s) || s.includes('WOMEN');
  const core = s.replace(/^WOMENS?/, '').replace(/^W/, '');
  if (/^(T20I|TWENTY20INTERNATIONAL|T20INTERNATIONAL)$/.test(core)) return { format: 'T20I', women };
  if (/^(ODI|ONEDAYINTERNATIONAL)$/.test(core)) return { format: 'ODI', women };
  if (/^(TEST|TESTCRICKET)$/.test(core)) return { format: 'Test', women };
  return null;
}

// "15 November" + "2013" → "2013-11-15"
export function asOfDate(dateParam, yearParam) {
  const s = `${clean(dateParam)} ${clean(yearParam)}`.trim();
  if (!s) return null;
  let m = /(\d{1,2})\s+([a-z]+)\D*?(\d{4})/i.exec(s);
  if (m && MONTHS.includes(m[2].toLowerCase())) return iso(m[3], MONTHS.indexOf(m[2].toLowerCase()) + 1, m[1]);
  m = /([a-z]+)\s+(\d{1,2}),?\s+(\d{4})/i.exec(s);
  if (m && MONTHS.includes(m[1].toLowerCase())) return iso(m[3], MONTHS.indexOf(m[1].toLowerCase()) + 1, m[2]);
  m = /(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = /([a-z]+)\s+(\d{4})/i.exec(s);
  if (m && MONTHS.includes(m[1].toLowerCase())) return iso(m[2], MONTHS.indexOf(m[1].toLowerCase()) + 1, 28);
  m = /^(\d{4})$/.exec(s);
  if (m) return `${m[1]}-12-31`;
  return null;
}
const iso = (y, mo, d) => `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

// Full parse → { name, country, asof, formats: { 'Test-m': {...}, 'ODI-w': {...} } } or null.
export function parseInfobox(wikitext) {
  const inner = extractInfobox(wikitext);
  if (!inner) return null;
  const p = splitParams(inner);
  const formats = {};
  const rejected = [];
  for (let i = 1; i <= 6; i++) {
    const col = columnFormat(p[`column${i}`]);
    if (!col) continue;
    const g = (k) => p[`${k}${i}`];
    const m = toInt(g('matches'));
    if (!m) continue;
    const [c100, c50] = pair(g('100s/50s'));
    const [ct, st] = pair(g('catches/stumpings'));
    const ts = topScore(g('top score'));
    const bb = bestBowling(g('best bowling'));
    const rec = {
      m,
      r: toInt(g('runs')) ?? 0,
      avg: toFloat(g('bat avg')),
      c100: c100 ?? 0,
      c50: c50 ?? 0,
      hs: ts ? ts.hs : null,
      hsNo: ts ? ts.no : false,
      balls: toInt(g('deliveries')) ?? toInt(g('balls')) ?? 0,
      wk: toInt(g('wickets')) ?? 0,
      bavg: toFloat(g('bowl avg')),
      w5: toInt(g('fivefor')) ?? 0,
      w10: toInt(g('tenfor')) ?? 0,
      bbi: bb,
      ct: ct ?? 0,
      st: st ?? 0,
    };
    // Early Tests used 4-, 5- and 8-ball overs, so balls bowled can look odd next to the average.
    // If balls and bowling average don't fit together, keep everything except balls (economy becomes blank).
    if (rec.wk > 0 && rec.bavg != null && rec.balls > 0) {
      const econ = (rec.bavg * rec.wk * 6) / rec.balls;
      if (econ > 30 || econ < 0.3) rec.balls = 0;
    }
    const problem = implausible(col.format, rec);
    if (problem) { rejected.push(`${col.format}${col.women ? ' (women)' : ''}: ${problem}`); continue; }
    formats[`${col.format}-${col.women ? 'w' : 'm'}`] = rec;
  }
  if (!Object.keys(formats).length) return rejected.length ? { rejected } : null;
  return {
    rejected: rejected.length ? rejected : undefined,
    name: clean(p.name) || null,
    country: clean(p.country) || null,
    asof: asOfDate(p.date, p.year),
    formats,
  };
}

// Sanity checks that catch garbled infoboxes (wrong cell, stray digits). Returns a reason or null.
export function implausible(format, r) {
  const maxInn = format === 'Test' ? 2 * r.m : r.m;
  if (r.m > ({ Test: 250, ODI: 550, T20I: 450 }[format] || 600)) return 'more matches than anyone has played';
  if (r.c100 + r.c50 > maxInn) return 'more 50s/100s than innings';
  if (r.hs != null && r.hs > r.r) return 'top score above career runs';
  if (r.avg != null && r.avg > 0 && r.r / r.avg > maxInn + 0.5) return 'average implies more dismissals than innings';
  if (r.r > maxInn * (format === 'Test' ? 400 : 250)) return 'runs per innings impossible';
  if (r.wk > r.m * (format === 'Test' ? 20 : 10)) return 'too many wickets per match';
  if (r.balls > 0 && r.wk * 1 > r.balls) return 'more wickets than balls';
  if (r.w5 > maxInn || r.w10 > r.m) return 'too many five-wicket hauls';
  return null;
}
