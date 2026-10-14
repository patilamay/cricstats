import { useMemo, useState } from 'react';
import { Link, Navigate, NavLink, useNavigate, useParams } from 'react-router-dom';
import { useComp, useMeta } from '../App.jsx';
import { useData } from '../data.js';
import { date, dec, num, overs } from '../format.js';
import DataTable from '../components/DataTable.jsx';
import CompPicker from '../components/CompPicker.jsx';
import { PlayerLink, ResultRow } from '../components/Bits.jsx';

const TABS = [
  ['batting', 'Batting'],
  ['bowling', 'Bowling'],
  ['fielding', 'Fielding'],
  ['records', 'Records'],
  ['teams', 'Teams'],
  ['seasons', 'Seasons'],
  ['results', 'Results'],
];

const nameCol = { key: 'name', label: 'Player', text: true, get: (r) => r.n, render: (r) => <PlayerLink id={r.id} name={r.n} /> };
const teamCol = { key: 'team', label: 'Team', text: true, get: (r) => r.t.join(', '), render: (r) => <span className="team-cell">{r.t.join(', ')}</span> };
const matchesCol = { key: 'm', label: 'M', title: 'Matches', get: (r) => r.m };

function battingColumns() {
  const b = (f) => (r) => r.b[f];
  return [
    nameCol, teamCol, matchesCol,
    { key: 'inn', label: 'Inn', title: 'Innings', get: b('inn') },
    { key: 'no', label: 'NO', title: 'Not outs', get: b('no') },
    { key: 'r', label: 'Runs', get: b('r'), render: (r) => num(r.b.r) },
    { key: 'hs', label: 'HS', title: 'Highest score (* = not out)', get: b('hs'), render: (r) => `${r.b.hs}${r.b.hsNo ? '*' : ''}` },
    { key: 'avg', label: 'Avg', title: 'Batting average: runs per dismissal', get: b('avg'), render: (r) => dec(r.b.avg) },
    { key: 'bf', label: 'BF', title: 'Balls faced', get: b('bf'), render: (r) => num(r.b.bf) },
    { key: 'sr', label: 'SR', title: 'Strike rate: runs per 100 balls', get: b('sr'), render: (r) => dec(r.b.sr) },
    { key: 'c100', label: '100', title: 'Hundreds', get: b('c100') },
    { key: 'c50', label: '50', title: 'Fifties', get: b('c50') },
    { key: 'd', label: '0', title: 'Ducks', get: b('d') },
    { key: 'f4', label: '4s', get: b('f4') },
    { key: 's6', label: '6s', get: b('s6') },
  ];
}

function bowlingColumns(comp) {
  const w = (f) => (r) => r.w[f];
  const isTest = comp.format === 'Test';
  const cols = [
    nameCol, teamCol, matchesCol,
    { key: 'inn', label: 'Inn', title: 'Innings bowled in', get: w('inn') },
    { key: 'balls', label: comp.ballsOnly ? 'Balls' : 'Overs', get: w('balls'), render: (r) => overs(r.w.balls, comp.ballsOnly) },
    { key: 'md', label: 'Mdns', title: 'Maidens', get: w('md') },
    { key: 'r', label: 'Runs', title: 'Runs conceded', get: w('r'), render: (r) => num(r.w.r) },
    { key: 'wk', label: 'Wkts', get: w('wk') },
    { key: 'bbi', label: 'BBI', title: 'Best bowling in an innings', get: (r) => (r.w.bbi ? bbiValue(r.w.bbi) : null), render: (r) => r.w.bbi || '–' },
  ];
  if (isTest) cols.push({ key: 'bbm', label: 'BBM', title: 'Best bowling in a match', get: (r) => (r.w.bbm ? bbiValue(r.w.bbm) : null), render: (r) => r.w.bbm || '–' });
  cols.push(
    { key: 'avg', label: 'Avg', title: 'Bowling average: runs per wicket', get: w('avg'), render: (r) => dec(r.w.avg), desc: false },
    { key: 'econ', label: 'Econ', title: 'Economy: runs per six balls', get: w('econ'), render: (r) => dec(r.w.econ), desc: false },
    { key: 'sr', label: 'SR', title: 'Strike rate: balls per wicket', get: w('sr'), render: (r) => dec(r.w.sr, 1), desc: false },
    { key: 'w4', label: '4w', title: 'Four wickets in an innings', get: w('w4') },
    { key: 'w5', label: '5w', title: 'Five or more wickets in an innings', get: w('w5') },
  );
  if (isTest) cols.push({ key: 'w10', label: '10w', title: 'Ten or more wickets in a match', get: w('w10') });
  return cols;
}

// Sort key for "5/23": more wickets first, then fewer runs.
const bbiValue = (s) => { const [wk, r] = s.split('/').map(Number); return wk * 1000 - r; };

const fieldingColumns = [
  nameCol, teamCol, matchesCol,
  { key: 'dis', label: 'Dis', title: 'Dismissals: catches plus stumpings', get: (r) => r.f.ct + r.f.st },
  { key: 'ct', label: 'Ct', title: 'Catches', get: (r) => r.f.ct },
  { key: 'st', label: 'St', title: 'Stumpings', get: (r) => r.f.st },
  { key: 'ro', label: 'RO', title: 'Run outs involved in', get: (r) => r.f.ro },
];

function PlayerTable({ comp, rows, kind }) {
  const [q, setQ] = useState('');
  const [team, setTeam] = useState('');
  const [minInn, setMinInn] = useState('');
  const field = kind === 'batting' ? 'b' : kind === 'bowling' ? 'w' : 'f';

  const base = useMemo(() => rows.filter((r) => r[field]), [rows, field]);
  const teams = useMemo(() => [...new Set(base.flatMap((r) => r.t))].sort(), [base]);
  const filtered = useMemo(() => {
    const terms = q.toLowerCase().split(/\s+/).filter(Boolean);
    const min = Number(minInn) || 0;
    return base.filter((r) => (!team || r.t.includes(team))
      && (!terms.length || terms.every((t) => r.n.toLowerCase().includes(t)))
      && (!min || (field === 'f' ? r.m : r[field].inn) >= min));
  }, [base, q, team, minInn, field]);

  const columns = kind === 'batting' ? battingColumns() : kind === 'bowling' ? bowlingColumns(comp) : fieldingColumns;
  const initialSort = kind === 'batting' ? { key: 'r', desc: true } : kind === 'bowling' ? { key: 'wk', desc: true } : { key: 'dis', desc: true };

  return (
    <>
      <div className="filters">
        <label>
          <span>Player</span>
          <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filter by name" />
        </label>
        <label>
          <span>Team</span>
          <select value={team} onChange={(e) => setTeam(e.target.value)}>
            <option value="">All teams</option>
            {teams.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </label>
        <label className="narrow">
          <span>{field === 'f' ? 'Min matches' : 'Min innings'}</span>
          <input type="number" min="0" inputMode="numeric" value={minInn} onChange={(e) => setMinInn(e.target.value)} placeholder="0" />
        </label>
      </div>
      <DataTable
        key={kind}
        rows={filtered}
        columns={columns}
        initialSort={initialSort}
        noun="players"
        caption={`${comp.name} ${kind}`}
        emptyText="No players match these filters."
      />
    </>
  );
}

function RecordList({ title, rows, render, note }) {
  return (
    <section className="record-block">
      <h3>{title}</h3>
      {note && <p className="qual">{note}</p>}
      <ol className="record-list">
        {rows.map((r, i) => <li key={`${r.match}-${i}`}>{render(r)}</li>)}
        {!rows.length && <li className="muted">None yet.</li>}
      </ol>
    </section>
  );
}

function Records({ comp }) {
  const { data, error } = useData(`comp/${comp.id}/records.json`);
  if (error) return <p className="notice">Records could not be loaded.</p>;
  if (!data) return <p className="loading">Loading records…</p>;
  const when = (r) => <Link to={`/match/${r.match}`} className="rec-when">{date(r.date)}</Link>;
  return (
    <div className="records-grid">
      <RecordList
        title="Highest team totals" rows={data.highestTotals.slice(0, 10)}
        render={(r) => (<><span className="rec-val">{r.runs}{r.allOut ? '' : `/${r.wkts}`}{r.declared ? 'd' : ''}</span><span className="rec-who">{r.team} v {r.opp}</span>{when(r)}</>)}
      />
      <RecordList
        title="Lowest completed totals" rows={data.lowestTotals.slice(0, 10)} note="All out"
        render={(r) => (<><span className="rec-val">{r.runs}</span><span className="rec-who">{r.team} v {r.opp}</span>{when(r)}</>)}
      />
      <RecordList
        title="Highest individual scores" rows={data.highestScores.slice(0, 10)}
        render={(r) => (<><span className="rec-val">{r.runs}{r.no ? '*' : ''}</span><span className="rec-who"><PlayerLink id={r.id} name={r.name} /> <span className="muted">{r.balls}b, {r.team} v {r.opp}</span></span>{when(r)}</>)}
      />
      <RecordList
        title="Best bowling figures" rows={data.bestFigures.slice(0, 10)}
        render={(r) => (<><span className="rec-val">{r.wkts}/{r.runs}</span><span className="rec-who"><PlayerLink id={r.id} name={r.name} /> <span className="muted">{r.team} v {r.opp}</span></span>{when(r)}</>)}
      />
      <RecordList
        title="Most sixes in an innings" rows={data.mostSixesInnings.slice(0, 10)}
        render={(r) => (<><span className="rec-val">{r.sixes}</span><span className="rec-who"><PlayerLink id={r.id} name={r.name} /> <span className="muted">{r.runs}{r.no ? '*' : ''} ({r.balls}b) v {r.opp}</span></span>{when(r)}</>)}
      />
    </div>
  );
}

function Teams({ comp }) {
  const { data, error } = useData(`comp/${comp.id}/teams.json`);
  if (error) return <p className="notice">Team results could not be loaded.</p>;
  if (!data) return <p className="loading">Loading teams…</p>;
  const cols = [
    { key: 'team', label: 'Team', text: true, get: (r) => r.team },
    { key: 'm', label: 'M', title: 'Matches', get: (r) => r.m },
    { key: 'w', label: 'Won', get: (r) => r.w },
    { key: 'l', label: 'Lost', get: (r) => r.l },
    { key: 't', label: 'Tied', get: (r) => r.t },
  ];
  if (comp.format === 'Test') cols.push({ key: 'd', label: 'Drawn', get: (r) => r.d });
  cols.push(
    { key: 'nr', label: 'NR', title: 'No result', get: (r) => r.nr },
    { key: 'pct', label: 'Win %', title: 'Wins as a share of decided matches', get: (r) => r.pct, render: (r) => dec(r.pct, 1) },
  );
  return <DataTable rows={data} columns={cols} initialSort={{ key: 'm', desc: true }} rowKey={(r) => r.team} noun="teams" caption={`${comp.name} team results`} />;
}

function Seasons({ comp }) {
  const { data, error } = useData(`comp/${comp.id}/seasons.json`);
  const [key, setKey] = useState(null);
  if (error) return <p className="notice">Seasons could not be loaded.</p>;
  if (!data) return <p className="loading">Loading seasons…</p>;
  const season = data.find((s) => s.key === key) || data[0];
  if (!season) return <p className="muted">No seasons yet.</p>;
  const label = comp.group === 'Leagues' ? 'Season' : 'Year';
  return (
    <div className="seasons">
      <div className="season-picker" role="group" aria-label={`Choose a ${label.toLowerCase()}`}>
        {data.map((s) => (
          <button key={s.key} type="button" className={s.key === season.key ? 'on' : ''} aria-pressed={s.key === season.key} onClick={() => setKey(s.key)}>{s.key}</button>
        ))}
      </div>
      <div className="season-head">
        <h3>{label} {season.key}</h3>
        <p>{num(season.matches)} matches{season.champion ? `. Champions: ${season.champion}` : ''}</p>
      </div>
      <div className="season-grid">
        <section>
          <h4>Most runs</h4>
          <table className="data compact">
            <thead><tr><th className="text">Player</th><th className="num">Inn</th><th className="num">Runs</th><th className="num">HS</th><th className="num">Avg</th><th className="num">SR</th></tr></thead>
            <tbody>{season.runs.map((p) => (
              <tr key={p.id}><td className="text"><PlayerLink id={p.id} name={p.n} /></td><td className="num">{p.inn}</td><td className="num">{p.r}</td><td className="num">{p.hs}</td><td className="num">{dec(p.avg)}</td><td className="num">{dec(p.sr)}</td></tr>
            ))}</tbody>
          </table>
        </section>
        <section>
          <h4>Most wickets</h4>
          <table className="data compact">
            <thead><tr><th className="text">Player</th><th className="num">{comp.ballsOnly ? 'Balls' : 'Overs'}</th><th className="num">Wkts</th><th className="num">Avg</th><th className="num">Econ</th></tr></thead>
            <tbody>{season.wickets.map((p) => (
              <tr key={p.id}><td className="text"><PlayerLink id={p.id} name={p.n} /></td><td className="num">{overs(p.balls, comp.ballsOnly)}</td><td className="num">{p.wk}</td><td className="num">{dec(p.avg)}</td><td className="num">{dec(p.econ)}</td></tr>
            ))}</tbody>
          </table>
        </section>
      </div>
    </div>
  );
}

function CompResults({ comp }) {
  const { data, error } = useData(`comp/${comp.id}/results.json`);
  if (error) return <p className="notice">Results could not be loaded.</p>;
  if (!data) return <p className="loading">Loading results…</p>;
  return <ul className="results-list">{data.map((m) => <ResultRow key={m.id} m={m} showComp={false} />)}</ul>;
}

const SRC_LABEL = { c: 'Ball-by-ball', w: 'Wikipedia', wc: 'Wikipedia + ball-by-ball' };

function AllTime({ comp }) {
  const { data, error } = useData(`alltime/${comp.id}.json`);
  const [view, setView] = useState('batting');
  const [q, setQ] = useState('');
  const [team, setTeam] = useState('');
  const [minM, setMinM] = useState('');
  const teams = useMemo(() => (data ? [...new Set(data.flatMap((r) => r.t))].sort() : []), [data]);
  const rows = useMemo(() => {
    if (!data) return [];
    const terms = q.toLowerCase().split(/\s+/).filter(Boolean);
    const min = Number(minM) || 0;
    return data.filter((r) => (!team || r.t.includes(team))
      && (!terms.length || terms.every((t) => r.n.toLowerCase().includes(t)))
      && r.m >= min
      && (view === 'batting' || r.balls > 0 || r.ct || r.st));
  }, [data, q, team, minM, view]);

  if (error) return <p className="notice">All-time figures could not be loaded.</p>;
  if (!data) return <p className="loading">Loading all-time figures…</p>;

  const name = { key: 'name', label: 'Player', text: true, get: (r) => r.n, render: (r) => <PlayerLink id={r.id} name={r.n} /> };
  const teamC = { key: 'team', label: 'Team', text: true, get: (r) => r.t.join(', '), render: (r) => <span className="team-cell">{r.t.join(', ')}</span> };
  const m = { key: 'm', label: 'M', title: 'Matches', get: (r) => r.m };
  const src = { key: 'src', label: 'Source', text: true, get: (r) => r.src, render: (r) => <span className={`src-tag src-${r.src}`} title={r.asof ? `Wikipedia figures as of ${date(r.asof)}` : undefined}>{SRC_LABEL[r.src]}</span> };
  const batting = [
    name, teamC, m,
    { key: 'r', label: 'Runs', get: (r) => r.r, render: (r) => num(r.r) },
    { key: 'avg', label: 'Avg', title: 'Batting average', get: (r) => r.avg, render: (r) => dec(r.avg) },
    { key: 'c100', label: '100', title: 'Hundreds', get: (r) => r.c100 },
    { key: 'c50', label: '50', title: 'Fifties', get: (r) => r.c50 },
    { key: 'hs', label: 'HS', title: 'Highest score', get: (r) => r.hs, render: (r) => (r.hs == null ? '–' : `${r.hs}${r.hsNo ? '*' : ''}`) },
    src,
  ];
  const bbiValue = (s) => { if (!s) return null; const [wk, rr] = s.split('/').map(Number); return wk * 1000 - rr; };
  const bowling = [
    name, teamC, m,
    { key: 'balls', label: comp.ballsOnly ? 'Balls' : 'Overs', get: (r) => r.balls, render: (r) => overs(r.balls, comp.ballsOnly) },
    { key: 'wk', label: 'Wkts', get: (r) => r.wk },
    { key: 'bavg', label: 'Avg', title: 'Bowling average', get: (r) => r.bavg, render: (r) => dec(r.bavg), desc: false },
    { key: 'econ', label: 'Econ', title: 'Economy rate', get: (r) => r.econ, render: (r) => dec(r.econ), desc: false },
    { key: 'w5', label: '5w', title: 'Five wickets in an innings', get: (r) => r.w5 },
    ...(comp.format === 'Test' ? [{ key: 'w10', label: '10w', title: 'Ten wickets in a match', get: (r) => r.w10 }] : []),
    { key: 'bbi', label: 'BBI', title: 'Best bowling in an innings', get: (r) => bbiValue(r.bbi), render: (r) => r.bbi || '–' },
    { key: 'ct', label: 'Ct', title: 'Catches', get: (r) => r.ct },
    { key: 'st', label: 'St', title: 'Stumpings', get: (r) => r.st },
    src,
  ];

  return (
    <>
      <p className="section-note">
        Complete careers. Matches before ball-by-ball records began come from players' Wikipedia pages; everything since comes from Cricsheet and is updated daily.
      </p>
      <div className="season-picker" role="group" aria-label="Choose a table">
        <button type="button" className={view === 'batting' ? 'on' : ''} aria-pressed={view === 'batting'} onClick={() => setView('batting')}>Batting</button>
        <button type="button" className={view === 'bowling' ? 'on' : ''} aria-pressed={view === 'bowling'} onClick={() => setView('bowling')}>Bowling and fielding</button>
      </div>
      <div className="filters">
        <label><span>Player</span><input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filter by name" /></label>
        <label>
          <span>Team</span>
          <select value={team} onChange={(e) => setTeam(e.target.value)}>
            <option value="">All teams</option>
            {teams.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </label>
        <label className="narrow"><span>Min matches</span><input type="number" min="0" inputMode="numeric" value={minM} onChange={(e) => setMinM(e.target.value)} placeholder="0" /></label>
      </div>
      <DataTable
        key={view}
        rows={rows}
        columns={view === 'batting' ? batting : bowling}
        initialSort={view === 'batting' ? { key: 'r', desc: true } : { key: 'wk', desc: true }}
        noun="players"
        caption={`${comp.name} all-time ${view}`}
        emptyText="No players match these filters."
      />
    </>
  );
}

export default function Stats() {
  const meta = useMeta();
  const params = useParams();
  const comp = useComp(params.comp);
  const tabs = comp && comp.alltime ? [['alltime', 'All-time'], ...TABS] : TABS;
  const tab = params.tab || tabs[0][0];
  const navigate = useNavigate();
  const needsRows = ['batting', 'bowling', 'fielding'].includes(tab);
  const { data: rows, error } = useData(comp && needsRows ? `comp/${comp.id}/stats.json` : null);

  if (!comp) return <Navigate to={`/stats/${meta.competitions[0].id}`} replace />;
  if (!tabs.some(([t]) => t === tab)) return <Navigate to={`/stats/${comp.id}`} replace />;

  return (
    <div className="page stats-page">
      <div className="stats-head">
        <div>
          <h1>{comp.name}</h1>
          <p className="muted">
            {tab === 'alltime' ? 'Every international career, all-time' : `${num(comp.matches)} matches with ball-by-ball data, ${date(comp.from)} to ${date(comp.to)}`}
          </p>
        </div>
        <CompPicker value={comp.id} onChange={(id) => navigate(`/stats/${id}`)} label="Switch competition" />
      </div>
      <nav className="tabs" aria-label={`${comp.name} sections`}>
        {tabs.map(([t, label]) => (
          <NavLink key={t} to={`/stats/${comp.id}/${t}`} className={t === tab ? 'active' : ''} end>{label}</NavLink>
        ))}
      </nav>
      <div className="tab-body">
        {tab === 'alltime' && <AllTime comp={comp} />}
        {needsRows && (error ? <p className="notice">The {tab} table could not be loaded.</p>
          : !rows ? <p className="loading">Loading {tab}…</p>
            : <PlayerTable comp={comp} rows={rows} kind={tab} />)}
        {tab === 'records' && <Records comp={comp} />}
        {tab === 'teams' && <Teams comp={comp} />}
        {tab === 'seasons' && <Seasons comp={comp} />}
        {tab === 'results' && <CompResults comp={comp} />}
      </div>
    </div>
  );
}
