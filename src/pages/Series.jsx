import { Fragment, useEffect, useMemo, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { useMeta } from '../App.jsx';
import { load, useData } from '../data.js';
import { Flag } from '../components/Bits.jsx';
import { CompTag, ResultItem, ResultsTabs, dayLabel, spanLabel } from '../components/ResultItem.jsx';

// Results → Series: every tour and tournament across all years (results/series.json), searchable.
// Major series (ICC events, leagues, full members) show by default; qualifiers and smaller tours
// are one click away. Each series opens /series/:id with its matches, read from the year files.

const STEP = 60;
const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const norm = (s) => (s || '').toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/['’]/g, '').replace(/\s+/g, ' ').trim();
const title = (s) => (s.s ? `${s.n} ${s.s}` : s.n);

function TeamsLine({ s }) {
  if (s.nt > 4) return <span className="ser-teams">{s.nt} teams</span>;
  return (
    <span className="ser-teams">
      {s.t.map((t, i) => <Fragment key={t}>{i > 0 && (s.nt === 2 ? ' v ' : ', ')}<Flag name={t} />{t}</Fragment>)}
    </span>
  );
}

function SeriesList() {
  const meta = useMeta();
  const [params, setParams] = useSearchParams();
  const q = params.get('q') || '';
  const g = params.get('g') || '';
  const all = params.get('all') === '1';
  const y = params.get('y') || '';
  const [text, setText] = useState(q);
  useEffect(() => { setText(q); }, [q]);
  const set = (patch) => {
    const n = new URLSearchParams(params);
    for (const [k, v] of Object.entries(patch)) { if (v) n.set(k, v); else n.delete(k); }
    setParams(n, { replace: true });
  };
  // Search as you type (address updated after a short pause).
  useEffect(() => {
    if (text === q) return undefined;
    const t = setTimeout(() => set({ q: text.trim() }), 250);
    return () => clearTimeout(t);
  }, [text]);

  const { data, error } = useData('results/series.json');
  const compById = useMemo(() => Object.fromEntries(meta.competitions.map((x) => [x.id, x])), [meta]);
  const groups = useMemo(() => [...new Set(meta.competitions.map((x) => x.group))].map((name) => ({ name, key: slug(name) })), [meta]);
  const years = useMemo(() => (data ? [...new Set(data.map((s) => s.to.slice(0, 4)))].sort((a, b) => b.localeCompare(a)) : []), [data]);

  const { major, minor } = useMemo(() => {
    if (!data) return { major: [], minor: [] };
    const terms = norm(q).split(' ').filter(Boolean);
    const rows = data.filter((s) => (!g || slug(s.g) === g)
      && (!y || (s.from.slice(0, 4) <= y && s.to.slice(0, 4) >= y))
      && (!terms.length || terms.every((t) => norm(`${s.n} ${s.s || ''} ${s.from.slice(0, 4)} ${s.t.join(' ')}`).includes(t))));
    return { major: rows.filter((s) => s.major), minor: rows.filter((s) => !s.major) };
  }, [data, q, g, y]);
  const rows = all ? [...major, ...minor].sort((a, b) => b.to.localeCompare(a.to)) : major;

  const [limit, setLimit] = useState(STEP);
  useEffect(() => { setLimit(STEP); }, [q, g, y, all]);
  const visible = rows.slice(0, limit);
  const byYear = [];
  for (const s of visible) {
    const k = s.to.slice(0, 4);
    const last = byYear[byYear.length - 1];
    if (last && last.year === k) last.items.push(s); else byYear.push({ year: k, items: [s] });
  }

  return (
    <div className="page results-page">
      <h1>Results</h1>
      <ResultsTabs />
      <div className="res-filters">
        <div className="ser-search">
          <label htmlFor="ser-q" className="visually-hidden">Search series</label>
          <input id="ser-q" type="search" value={text} onChange={(e) => setText(e.target.value)} placeholder="Search a series: World Cup, Ashes, India tour, IPL 2024…" autoComplete="off" />
        </div>
        <div className="chip-row" role="group" aria-label="Competitions">
          <button type="button" className={!g ? 'on' : ''} aria-pressed={!g} onClick={() => set({ g: '' })}>All</button>
          {groups.map((x) => (
            <button key={x.key} type="button" className={g === x.key ? 'on' : ''} aria-pressed={g === x.key} onClick={() => set({ g: x.key })}>{x.name}</button>
          ))}
        </div>
        <div className="res-controls filters">
          <label className="narrow"><span>Year</span>
            <select value={y} onChange={(e) => set({ y: e.target.value })}>
              <option value="">Any year</option>
              {years.map((yy) => <option key={yy} value={yy}>{yy}</option>)}
            </select>
          </label>
          <label className="check"><input type="checkbox" checked={all} onChange={(e) => set({ all: e.target.checked ? '1' : '' })} /> Include qualifiers and smaller tours</label>
        </div>
        <div className="res-summary" role="status">
          <span className="muted">{!data ? (error ? '' : 'Loading…') : `${rows.length.toLocaleString('en-GB')} ${rows.length === 1 ? 'series' : 'series'}`}</span>
          {!all && minor.length > 0 && <button type="button" className="link-btn" onClick={() => set({ all: '1' })}>+ {minor.length.toLocaleString('en-GB')} smaller {minor.length === 1 ? 'series' : 'series'}</button>}
          {(q || g || y) && <button type="button" className="link-btn" onClick={() => setParams(new URLSearchParams(all ? { all: '1' } : {}), { replace: true })}>Clear all</button>}
        </div>
      </div>

      {error ? <p className="notice">The series list isn't available yet. It's built with the daily data refresh; meanwhile the <Link to="/results">Latest</Link> tab has every match.</p>
        : !data ? <p className="loading">Loading series…</p>
          : !rows.length ? (
            <p className="notice">No series match{q ? ` “${q}”` : ''}{y ? ` in ${y}` : ''}.{' '}
              {!all && minor.length ? <button type="button" className="link-btn" onClick={() => set({ all: '1' })}>Show smaller series too</button>
                : y ? <button type="button" className="link-btn" onClick={() => set({ y: '' })}>Search every year</button> : null}
            </p>
          ) : (
            byYear.map((grp) => (
              <Fragment key={grp.year}>
                <h2 className="res-day">{grp.year}</h2>
                <ul className="ser-list">
                  {grp.items.map((s) => (
                    <li key={s.id} className={`ser-item${s.major ? '' : ' minor'}`}>
                      <Link to={`/series/${s.id}`} className="ser-name">{title(s)}</Link>
                      <div className="ser-meta">
                        {s.c.map((cid) => <CompTag key={cid} comp={compById[cid]} />)}
                        <span>{spanLabel(s.from, s.to)}</span>
                        <span>{s.m} {s.m === 1 ? 'match' : 'matches'}</span>
                      </div>
                      <div className="ser-line"><TeamsLine s={s} />{s.r && <span className="ser-result">{s.r}</span>}</div>
                    </li>
                  ))}
                </ul>
              </Fragment>
            ))
          )}

      {data && rows.length > limit && (
        <div className="show-more">
          <button type="button" onClick={() => setLimit(limit + STEP * 2)}>Show more series</button>
        </div>
      )}
      <p className="muted res-footnote">Series are listed from about 2002, when ball-by-ball records begin. Older matches are in the <Link to="/results">Latest</Link> tab by year.</p>
    </div>
  );
}

function SeriesPage({ id }) {
  const meta = useMeta();
  const { data, error } = useData('results/series.json');
  const s = data && data.find((x) => x.id === id);
  const compById = useMemo(() => Object.fromEntries(meta.competitions.map((x) => [x.id, x])), [meta]);
  const [matches, setMatches] = useState(null);
  useEffect(() => {
    if (!s) return undefined;
    let live = true;
    const ys = [];
    for (let yy = Number(s.from.slice(0, 4)); yy <= Number(s.to.slice(0, 4)); yy++) ys.push(yy);
    Promise.all(ys.map((yy) => load(`results/${yy}.json`).catch(() => []))).then((lists) => {
      if (live) setMatches(lists.flat().filter((m) => m.sid === id).sort((a, b) => a.date.localeCompare(b.date) || String(a.id).localeCompare(String(b.id))));
    });
    return () => { live = false; };
  }, [s, id]);

  if (error) return <div className="page"><p className="notice">Series could not be loaded. <Link to="/series">All series</Link></p></div>;
  if (!data) return <div className="page"><p className="loading">Loading series…</p></div>;
  if (!s) return <div className="page"><p className="notice">We couldn't find that series. <Link to="/series">Browse all series</Link></p></div>;

  const days = [];
  for (const m of matches || []) {
    const last = days[days.length - 1];
    if (last && last.date === m.date) last.items.push(m); else days.push({ date: m.date, items: [m] });
  }
  const leagues = s.c.filter((cid) => /league/i.test(compById[cid]?.group || ''));

  return (
    <div className="page results-page series-page">
      <p className="crumbs"><Link to="/series">← All series</Link></p>
      <header className="ser-head">
        <h1>{title(s)}</h1>
        <div className="ser-meta">
          {s.c.map((cid) => <CompTag key={cid} comp={compById[cid]} />)}
          <span>{spanLabel(s.from, s.to)}</span>
          <span>{s.m} {s.m === 1 ? 'match' : 'matches'}</span>
        </div>
        <p className="ser-teams-line"><TeamsLine s={s} /></p>
        {s.r && <p className="ser-headline">{s.r}</p>}
        {leagues.length > 0 && <p className="muted ser-links">{leagues.map((cid) => <Link key={cid} to={`/stats/${cid}/seasons`}>{compById[cid].name}: season stats</Link>)}</p>}
      </header>
      {!matches ? <p className="loading">Loading matches…</p> : (
        <>
          {days.map((d) => (
            <Fragment key={d.date}>
              <h2 className="res-day">{dayLabel(d.date, { relative: false })}</h2>
              <ul className="res-list">
                {d.items.map((m) => <ResultItem key={m.id} m={m} comp={compById[m.c]} showComp={s.c.length > 1} showSeries={false} />)}
              </ul>
            </Fragment>
          ))}
        </>
      )}
    </div>
  );
}

export default function Series() {
  const { id } = useParams();
  return id ? <SeriesPage id={id} /> : <SeriesList />;
}
