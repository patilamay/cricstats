// Combines Wikipedia career totals with Cricsheet ball-by-ball stats.
//
// For each player and international format:
//   - If Cricsheet has at least as many matches as Wikipedia's total plus any later
//     Cricsheet matches, Cricsheet covers the whole career: use it alone (most detailed).
//   - Otherwise: Wikipedia's totals "as of" the infobox date, plus every Cricsheet match
//     played after that date. This fills in early careers Cricsheet doesn't cover and keeps
//     active players current even when their Wikipedia page lags behind.

const round = (x, dp = 2) => (x == null || !isFinite(x) ? null : Math.round(x * 10 ** dp) / 10 ** dp);

// International competitions and the Wikipedia infobox column each one corresponds to.
export const WIKI_FORMAT = {
  'test-m': 'Test-m', 'odi-m': 'ODI-m', 't20i-m': 'T20I-m',
  'test-w': 'Test-w', 'odi-w': 'ODI-w', 't20i-w': 'T20I-w',
};

const betterBbi = (a, b) => {
  if (!a) return b;
  if (!b) return a;
  return b.w > a.w || (b.w === a.w && b.r < a.r) ? b : a;
};

// Cricsheet aggregate row (from aggregate.js finalize) -> common career shape.
export function fromCricsheet(row) {
  const b = row.b;
  const w = row.w;
  const f = row.f || { ct: 0, st: 0 };
  const bbi = w && w.bbi ? { w: Number(w.bbi.split('/')[0]), r: Number(w.bbi.split('/')[1]) } : null;
  return {
    m: row.m,
    r: b ? b.r : 0,
    outs: b ? b.inn - b.no : 0,
    c100: b ? b.c100 : 0,
    c50: b ? b.c50 : 0,
    hs: b ? b.hs : null,
    hsNo: b ? b.hsNo : false,
    balls: w ? w.balls : 0,
    rc: w ? w.r : 0,
    wk: w ? w.wk : 0,
    w5: w ? w.w5 : 0,
    w10: w && w.w10 ? w.w10 : 0,
    bbi,
    ct: f.ct || 0,
    st: f.st || 0,
  };
}

// Wikipedia infobox column -> common career shape.
export function fromWiki(wf) {
  const outs = wf.avg ? Math.round(wf.r / wf.avg) : 0; // no average means never dismissed
  let rc;
  if (wf.wk > 0 && wf.bavg != null) rc = Math.round(wf.bavg * wf.wk);
  else rc = wf.balls ? null : 0; // runs conceded unknown when balls bowled but no wickets
  return {
    m: wf.m, r: wf.r, outs, c100: wf.c100, c50: wf.c50, hs: wf.hs, hsNo: wf.hsNo,
    balls: wf.balls, rc, wk: wf.wk, w5: wf.w5, w10: wf.w10, bbi: wf.bbi, ct: wf.ct, st: wf.st,
  };
}

function addLines(base, lines) {
  const t = { ...base };
  for (const l of lines) {
    t.m += 1;
    t.r += l.r;
    t.outs += l.out;
    t.c100 += l.n100;
    t.c50 += l.n50;
    if (l.hs >= 0 && (t.hs == null || l.hs > t.hs || (l.hs === t.hs && l.hsNo))) { t.hs = l.hs; t.hsNo = l.hsNo; }
    t.balls += l.bb;
    t.rc = t.rc == null ? null : t.rc + l.rc;
    t.wk += l.wk;
    t.w5 += l.w5;
    if (l.wk >= 10) t.w10 += 1;
    if (l.bbiW > 0) t.bbi = betterBbi(t.bbi, { w: l.bbiW, r: l.bbiR });
    t.ct += l.ct;
    t.st += l.st;
  }
  return t;
}

// Final shape stored in the site data (compact keys, derived rates).
export function finish(t, src, asof) {
  return {
    m: t.m,
    r: t.r,
    avg: t.outs ? round(t.r / t.outs) : null,
    c100: t.c100,
    c50: t.c50,
    hs: t.hs,
    hsNo: t.hsNo || undefined,
    balls: t.balls,
    wk: t.wk,
    bavg: t.wk && t.rc != null ? round(t.rc / t.wk) : null,
    econ: t.balls && t.rc != null ? round((t.rc * 6) / t.balls) : null,
    w5: t.w5,
    w10: t.w10,
    bbi: t.bbi ? `${t.bbi.w}/${t.bbi.r}` : null,
    ct: t.ct,
    st: t.st,
    src,
    asof: asof || undefined,
  };
}

// wiki: infobox column (or null); csRow: Cricsheet aggregate row (or null); ledger: per-match lines.
export function combine({ wiki, csRow, ledger = [] }) {
  if (!wiki) return csRow ? finish(fromCricsheet(csRow), 'c') : null;
  const asof = wiki.asof || null;
  const after = asof ? ledger.filter((l) => l.d && l.d > asof) : [];
  const w = fromWiki(wiki.f);
  const merged = addLines(w, after);
  if (csRow && csRow.m >= merged.m) return finish(fromCricsheet(csRow), 'c');
  return finish(merged, after.length ? 'wc' : 'w', asof);
}
