import { Fragment, useEffect, useMemo, useState } from 'react';
import { Link, Navigate, useSearchParams } from 'react-router-dom';
import { useMeta } from '../App.jsx';
import { load, useData } from '../data.js';
import Combobox from '../components/Combobox.jsx';
import { ResultItem, ResultsTabs, dayLabel } from '../components/ResultItem.jsx';

// Results → Latest: every match, newest first, grouped by day. No filter is applied unless the
// visitor picks it; picked filters show as removable chips. Filters live in the address:
// ?g=<group> &c=<competition> &team=<name> &y=<year>.
// Data: results/years.json + results/<year>.json (every competition); falls back to recent.json.
// Without a year, the newest year loads first and older years load as you ask for more.

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const STEP = 120;
const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const norm = (s) => (s || '').toLowerCase().replace(/\s+/g, ' ').trim();

export default function Results() {
  const meta = useMeta();
  const [params, setParams] = useSearchParams();
  const g = params.get('g') || '';
  const c = params.get('c') || '';
  const team = params.get('team') || '';
  const y = params.get('y') || '';
  const oldSeries = params.get('series'); // old links: series moved to its own tab

  const set = (patch) => {
    const n = new URLSearchParams(params);
    for (const [k, v] of Object.entries(patch)) { if (v) n.set(k, v); else n.delete(k); }
    setParams(n, { replace: true });
  };

  const comps = meta.competitions;
  const compById = useMemo(() => Object.fromEntries(comps.map((x) => [x.id, x])), [comps]);
  const groups = useMemo(() => [...new Set(comps.map((x) => x.group))].map((name) => ({ name, key: slug(name) })), [comps]);
  const groupOf = (id) => (compById[id] ? slug(compById[id].group) : '');

  const { data: years, error: yearsError } = useData('results/years.json');
  const byYear = !!years && !yearsError;

  // Which year files are loaded: the chosen year only, or (any year) the newest plus as many older as asked for.
  const [extra, setExtra] = useState(0);
  useEffect(() => { setExtra(0); }, [y]);
  const loadedYears = useMemo(() => {
    if (!byYear || !years.length) return [];
    if (y) return years.some(([yy]) => String(yy) === y) ? [y] : [];
    return years.slice(0, 1 + extra).map(([yy]) => String(yy));
  }, [byYear, years, y, extra]);
  const olderYear = byYear && !y && years[loadedYears.length] ? String(years[loadedYears.length][0]) : null;

  const [matches, setMatches] = useState(null);
  const [loadError, setLoadError] = useState(null);
  useEffect(() => {
    let live = true;
    if (yearsError) {
      load('recent.json').then((d) => live && setMatches(d), (e) => live && setLoadError(e));
    } else if (loadedYears.length) {
      Promise.all(loadedYears.map((yy) => load(`results/${yy}.json`))).then(
        (lists) => live && setMatches(lists.flat()),
        (e) => live && setLoadError(e),
      );
    }
    return () => { live = false; };
  }, [yearsError, loadedYears]);

  const byComp = useMemo(() => (matches || []).filter((m) => (c ? m.c === c : !g || groupOf(m.c) === g)), [matches, g, c, compById]);
  const shown = useMemo(() => {
    const q = norm(team);
    return q ? byComp.filter((m) => m.teams.some((t) => norm(t).includes(q))) : byComp;
  }, [byComp, team]);
  const teamOptions = useMemo(() => {
    const n = new Map();
    for (const m of byComp) for (const t of m.teams) n.set(t, (n.get(t) || 0) + 1);
    return [...n.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([t]) => ({ value: t, label: t }));
  }, [byComp]);

  const [limit, setLimit] = useState(STEP);
  useEffect(() => { setLimit(STEP); }, [g, c, team, y]);

  // With a team filter there may be only a handful of matches per year: keep loading older years
  // (up to a few at a time) until there's a screenful, so "India" doesn't look empty early in a year.
  useEffect(() => {
    if (matches && team && !y && olderYear && shown.length < 30 && extra < 6) setExtra((e) => e + 1);
  }, [matches, team, y, olderYear, shown.length, extra]);

  const visible = shown.slice(0, limit);
  const days = [];
  for (const m of visible) {
    const last = days[days.length - 1];
    if (last && last.date === m.date) last.items.push(m); else days.push({ date: m.date, items: [m] });
  }
  const months = [];
  if (y) {
    for (const m of shown) {
      const k = m.date.slice(0, 7);
      const last = months[months.length - 1];
      if (last && last.key === k) last.n += 1; else months.push({ key: k, n: 1, first: m.date });
    }
  }
  const jumpTo = (key) => {
    const mo = months.find((x) => x.key === key);
    if (!mo) return;
    const idx = shown.findIndex((m) => m.date === mo.first);
    if (idx >= limit) setLimit(idx + STEP);
    requestAnimationFrame(() => requestAnimationFrame(() => {
      const el = document.getElementById(`d-${mo.first}`);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }));
  };

  if (oldSeries) return <Navigate to={`/series?q=${encodeURIComponent(oldSeries)}`} replace />;

  const groupComps = g ? comps.filter((x) => slug(x.group) === g) : [];
  const loading = !matches && !loadError;
  const span = loadedYears.length > 1 ? `${loadedYears[loadedYears.length - 1]}–${loadedYears[0]}` : loadedYears[0];
  const applied = [
    g && !c && { k: 'g', label: groups.find((x) => x.key === g)?.name, clear: { g: '', c: '' } },
    c && { k: 'c', label: compById[c]?.name || c, clear: { c: '' } },
    team && { k: 'team', label: `Team: ${team}`, clear: { team: '' } },
    y && { k: 'y', label: `Year: ${y}`, clear: { y: '' } },
  ].filter(Boolean);
  const more = () => (shown.length > limit ? setLimit(limit + STEP * 2) : setExtra(extra + 1));
  const canMore = shown.length > limit || !!olderYear;

  return (
    <div className="page results-page">
      <h1>Results</h1>
      <ResultsTabs />

      <div className="res-filters">
        <div className="chip-row" role="group" aria-label="Competitions">
          <button type="button" className={!g ? 'on' : ''} aria-pressed={!g} onClick={() => set({ g: '', c: '' })}>All</button>
          {groups.map((x) => (
            <button key={x.key} type="button" className={g === x.key ? 'on' : ''} aria-pressed={g === x.key} onClick={() => set({ g: x.key, c: '' })}>{x.name}</button>
          ))}
        </div>
        <div className="res-controls filters">
          {g && (
            <label><span>Competition</span>
              <select value={c} onChange={(e) => set({ c: e.target.value })}>
                <option value="">All {groups.find((x) => x.key === g)?.name.toLowerCase()}</option>
                {groupComps.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
              </select>
            </label>
          )}
          <Combobox
            label="Team" value={team} onChange={(v) => set({ team: v })}
            options={teamOptions} allLabel="All teams" placeholder="All teams" freeText flags emptyText="No teams match"
          />
          {byYear && (
            <label className="narrow"><span>Year</span>
              <select value={y} onChange={(e) => set({ y: e.target.value })}>
                <option value="">Any year</option>
                {years.map(([yy, n]) => <option key={yy} value={String(yy)}>{yy} ({n.toLocaleString('en-GB')})</option>)}
              </select>
            </label>
          )}
          {months.length > 1 && (
            <label className="narrow"><span>Jump to</span>
              <select value="" onChange={(e) => jumpTo(e.target.value)}>
                <option value="">Month…</option>
                {months.map((mo) => { const [yy, mm] = mo.key.split('-'); return <option key={mo.key} value={mo.key}>{MONTHS[Number(mm) - 1]} {yy} ({mo.n})</option>; })}
              </select>
            </label>
          )}
        </div>
        <div className="res-summary" role="status">
          <span className="muted">
            {loading ? 'Loading…' : `${shown.length.toLocaleString('en-GB')} ${shown.length === 1 ? 'match' : 'matches'}${byYear && span ? (y ? ` in ${y}` : `, ${span}${olderYear ? ' so far' : ''}`) : ''}`}
          </span>
          {applied.map((a) => (
            <button key={a.k} type="button" className="filter-chip" onClick={() => set(a.clear)} aria-label={`Remove filter ${a.label}`}>
              {a.label}<span aria-hidden="true">×</span>
            </button>
          ))}
          {applied.length > 1 && <button type="button" className="link-btn" onClick={() => setParams(new URLSearchParams(), { replace: true })}>Clear all</button>}
        </div>
      </div>

      {loadError ? <p className="notice">Results could not be loaded.</p>
        : loading ? <p className="loading">Loading results…</p>
          : !shown.length ? (
            <p className="notice">
              No matches {y ? `in ${y}` : 'yet'} for these filters.{' '}
              {y ? <button type="button" className="link-btn" onClick={() => set({ y: '' })}>Search every year</button>
                : olderYear && <button type="button" className="link-btn" onClick={() => setExtra(extra + 1)}>Look further back</button>}
            </p>
          ) : (
            <div className="res-days">
              {days.map((d) => (
                <Fragment key={d.date}>
                  <h2 className="res-day" id={`d-${d.date}`}>{dayLabel(d.date)}</h2>
                  <ul className="res-list">
                    {d.items.map((m) => <ResultItem key={m.id} m={m} comp={compById[m.c]} showComp={!c} />)}
                  </ul>
                </Fragment>
              ))}
            </div>
          )}

      {!loading && !loadError && shown.length > 0 && canMore && (
        <div className="show-more">
          <button type="button" onClick={more}>{shown.length > limit ? 'Show more results' : `Show ${olderYear} results`}</button>
        </div>
      )}

      <p className="muted res-footnote">Cricsheet usually adds matches within a few days of the finish. Looking for a tour or tournament? Try the <Link to="/series">Series</Link> tab.</p>
    </div>
  );
}
