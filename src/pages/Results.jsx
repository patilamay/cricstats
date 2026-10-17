import { Fragment, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useMeta } from '../App.jsx';
import { load, useData } from '../data.js';
import { score } from '../format.js';
import { Team } from '../components/Bits.jsx';

// Results: one list, newest first, grouped by day. Filters live in the address so a view can be
// shared: ?g=<group> &c=<competition> &series=<name> &team=<name> &y=<year>.
// Data: results/years.json + results/<year>.json (every competition); falls back to recent.json.

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const STEP = 150;
const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const norm = (s) => (s || '').toLowerCase().replace(/\s+/g, ' ').trim();

const isoDay = (d) => d.toISOString().slice(0, 10);
function dayLabel(iso) {
  const today = new Date();
  if (iso === isoDay(today)) return 'Today';
  const y = new Date(today); y.setDate(y.getDate() - 1);
  if (iso === isoDay(y)) return 'Yesterday';
  const [yy, mm, dd] = iso.split('-').map(Number);
  const dow = DAYS[new Date(Date.UTC(yy, mm - 1, dd)).getUTCDay()];
  return `${dow} ${dd} ${MONTHS[mm - 1].slice(0, 3)}${yy === today.getFullYear() ? '' : ` ${yy}`}`;
}

function compTag(c) {
  if (!c) return '';
  const intlWomen = c.gender === 'female' && /international/i.test(c.group) && !/\bW\b/.test(c.short);
  return intlWomen ? `${c.short} W` : c.short;
}

function ResultItem({ m, comp, showComp }) {
  const byTeam = (team) => m.scores.filter((s) => s.team === team && !s.so).map(score).join(' & ');
  const where = m.venue ? (m.city && !m.venue.includes(m.city) ? `${m.venue}, ${m.city}` : m.venue) : m.city;
  return (
    <li className="res-item">
      <div className="res-meta">
        {showComp && comp && <span className={`res-tag res-tag-${comp.gender === 'female' ? 'w' : 'm'}`} title={comp.name}>{compTag(comp)}</span>}
        <span className="res-where">{[m.event, m.stage, where].filter(Boolean).join(' · ')}</span>
      </div>
      <div className="res-teams">
        {m.teams.map((t) => (
          <div key={t} className={`res-team${m.winner === t ? ' won' : ''}`}>
            <span className="res-name"><Team name={t} /></span>
            <span className="res-score">{byTeam(t) || '–'}</span>
          </div>
        ))}
      </div>
      <div className="res-result">
        <span>{m.result}</span>
        <Link to={`/match/${m.id}`} className="res-card" aria-label={`Scorecard: ${m.teams.join(' v ')}`}>Scorecard</Link>
      </div>
    </li>
  );
}

export default function Results() {
  const meta = useMeta();
  const [params, setParams] = useSearchParams();
  const g = params.get('g') || '';
  const c = params.get('c') || '';
  const series = params.get('series') || '';
  const team = params.get('team') || '';
  const [teamInput, setTeamInput] = useState(team);
  useEffect(() => { setTeamInput(team); }, [team]);

  const set = (patch) => {
    const n = new URLSearchParams(params);
    for (const [k, v] of Object.entries(patch)) { if (v) n.set(k, v); else n.delete(k); }
    setParams(n, { replace: true });
  };

  const comps = meta.competitions;
  const compById = useMemo(() => Object.fromEntries(comps.map((x) => [x.id, x])), [comps]);
  const groups = useMemo(() => [...new Set(comps.map((x) => x.group))].map((name) => ({ name, key: slug(name) })), [comps]);
  const groupOf = (id) => (compById[id] ? slug(compById[id].group) : '');

  // Years available; the list starts at the chosen (or latest) year and can load older ones.
  const { data: years, error: yearsError } = useData('results/years.json');
  const byYear = !!years && !yearsError;
  const latest = byYear && years.length ? String(years[0][0]) : null;
  const y = params.get('y') || latest;
  const [extra, setExtra] = useState(0);
  useEffect(() => { setExtra(0); }, [y]);
  const loadedYears = useMemo(() => {
    if (!byYear || !y) return [];
    const i = years.findIndex(([yy]) => String(yy) === y);
    return i < 0 ? [] : years.slice(i, i + 1 + extra).map(([yy]) => String(yy));
  }, [byYear, years, y, extra]);
  const olderYear = byYear && y ? (() => { const i = years.findIndex(([yy]) => String(yy) === y); return years[i + 1 + extra] ? String(years[i + 1 + extra][0]) : null; })() : null;

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

  // Filters: competition (group or single), then team, then series.
  const byComp = useMemo(() => (matches || []).filter((m) => (c ? m.c === c : !g || groupOf(m.c) === g)), [matches, g, c, compById]);
  const byTeam = useMemo(() => {
    const q = norm(team);
    return q ? byComp.filter((m) => m.teams.some((t) => norm(t).includes(q))) : byComp;
  }, [byComp, team]);
  const seriesList = useMemo(() => {
    const seen = new Map();
    for (const m of byTeam) if (m.event && !seen.has(m.event)) seen.set(m.event, 0);
    for (const m of byTeam) if (m.event) seen.set(m.event, seen.get(m.event) + 1);
    return [...seen.entries()];
  }, [byTeam]);
  const shown = useMemo(() => (series ? byTeam.filter((m) => m.event === series) : byTeam), [byTeam, series]);
  const teamOptions = useMemo(() => {
    const n = new Map();
    for (const m of byComp) for (const t of m.teams) n.set(t, (n.get(t) || 0) + 1);
    return [...n.entries()].sort((a, b) => b[1] - a[1]).slice(0, 300).map(([t]) => t);
  }, [byComp]);

  const [limit, setLimit] = useState(STEP);
  useEffect(() => { setLimit(STEP); }, [g, c, team, series, y]);

  // Group the visible matches by day, and note where each month starts (for the month jump).
  const visible = shown.slice(0, limit);
  const days = [];
  for (const m of visible) {
    const last = days[days.length - 1];
    if (last && last.date === m.date) last.items.push(m); else days.push({ date: m.date, items: [m] });
  }
  const months = [];
  for (const m of shown) {
    const k = m.date.slice(0, 7);
    const last = months[months.length - 1];
    if (last && last.key === k) last.n += 1; else months.push({ key: k, n: 1, first: m.date });
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

  const groupComps = g ? comps.filter((x) => slug(x.group) === g) : [];
  const anyFilter = g || c || team || series || (params.get('y') && params.get('y') !== latest);
  const loading = !matches && !loadError;
  const showComp = !c;

  return (
    <div className="page results-page">
      <h1>Results</h1>

      <div className="res-filters">
        <div className="chip-row" role="group" aria-label="Competitions">
          <button type="button" className={!g ? 'on' : ''} aria-pressed={!g} onClick={() => set({ g: '', c: '', series: '' })}>All</button>
          {groups.map((x) => (
            <button key={x.key} type="button" className={g === x.key ? 'on' : ''} aria-pressed={g === x.key} onClick={() => set({ g: x.key, c: '', series: '' })}>{x.name}</button>
          ))}
        </div>
        <div className="res-controls filters">
          {g && (
            <label><span>Competition</span>
              <select value={c} onChange={(e) => set({ c: e.target.value, series: '' })}>
                <option value="">All {groups.find((x) => x.key === g)?.name.toLowerCase()}</option>
                {groupComps.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
              </select>
            </label>
          )}
          <label><span>Series</span>
            <select value={series} onChange={(e) => set({ series: e.target.value })} disabled={!seriesList.length && !series}>
              <option value="">{seriesList.length ? `All series (${seriesList.length})` : 'No named series'}</option>
              {series && !seriesList.some(([s]) => s === series) && <option value={series}>{series}</option>}
              {seriesList.map(([s, n]) => <option key={s} value={s}>{s} ({n})</option>)}
            </select>
          </label>
          <label className="res-team-filter"><span>Team</span>
            <input type="search" list="res-teams" value={teamInput} placeholder="e.g. India"
              onChange={(e) => { setTeamInput(e.target.value); if (!e.target.value) set({ team: '', series: '' }); }}
              onKeyDown={(e) => { if (e.key === 'Enter') set({ team: teamInput.trim(), series: '' }); }}
              onBlur={() => { if (teamInput.trim() !== team) set({ team: teamInput.trim(), series: '' }); }} />
            <datalist id="res-teams">{teamOptions.map((t) => <option key={t} value={t} />)}</datalist>
          </label>
          {byYear && (
            <label className="narrow"><span>Year</span>
              <select value={y || ''} onChange={(e) => set({ y: e.target.value === latest ? '' : e.target.value, series: '' })}>
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
        <p className="res-summary muted" aria-live="polite">
          {loading ? 'Loading…' : `${shown.length.toLocaleString('en-GB')} ${shown.length === 1 ? 'match' : 'matches'}${byYear && y ? ` in ${loadedYears.length > 1 ? `${loadedYears[loadedYears.length - 1]}–${loadedYears[0]}` : y}` : ''}`}
          {anyFilter && <button type="button" className="link-btn" onClick={() => { setTeamInput(''); setParams(new URLSearchParams(), { replace: true }); }}>Clear filters</button>}
        </p>
      </div>

      {loadError ? <p className="notice">Results could not be loaded.</p>
        : loading ? <p className="loading">Loading results…</p>
          : !shown.length ? (
            <p className="notice">No matches here{olderYear ? '' : ''}. {olderYear && <button type="button" className="link-btn" onClick={() => setExtra(extra + 1)}>Look in {olderYear}</button>}</p>
          ) : (
            <div className="res-days">
              {days.map((d) => (
                <Fragment key={d.date}>
                  <h2 className="res-day" id={`d-${d.date}`}>{dayLabel(d.date)}</h2>
                  <ul className="res-list">
                    {d.items.map((m) => <ResultItem key={m.id} m={m} comp={compById[m.c]} showComp={showComp} />)}
                  </ul>
                </Fragment>
              ))}
            </div>
          )}

      {!loading && !loadError && (shown.length > limit || olderYear) && shown.length > 0 && (
        <div className="show-more">
          {shown.length > limit
            ? <button type="button" onClick={() => setLimit(limit + STEP * 2)}>Show more results</button>
            : <button type="button" onClick={() => setExtra(extra + 1)}>Load {olderYear} results</button>}
          {shown.length > limit && <span className="muted">{(shown.length - limit).toLocaleString('en-GB')} more</span>}
        </div>
      )}

      <p className="muted res-footnote">Cricsheet usually adds matches within a few days of the finish. Older matches come from Wikipedia.</p>
    </div>
  );
}
