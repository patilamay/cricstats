import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMeta } from '../App.jsx';
import { useData } from '../data.js';
import { date, num } from '../format.js';
import { PlayerLink, ResultRow } from '../components/Bits.jsx';
import { groupedComps } from '../components/CompPicker.jsx';

const RATE_UNITS = new Set(['avg', 'SR', 'econ']);
const PREF_KEY = 'cricstats.homeComp';
const readPref = () => { try { return localStorage.getItem(PREF_KEY); } catch { return null; } };
const writePref = (v) => { try { localStorage.setItem(PREF_KEY, v); } catch { /* storage unavailable */ } };

function defaultComp(meta) {
  const ids = meta.competitions.map((c) => c.id);
  const saved = readPref();
  if (saved && ids.includes(saved)) return saved;
  return ['t20i-m', 'odi-m', 'test-m'].find((id) => ids.includes(id)) || ids[0];
}

function BoardColumn({ board }) {
  if (!board) return null;
  const max = Math.max(...board.rows.map((r) => r.v), 1);
  return (
    <section className="board-col" aria-labelledby={`board-${board.key}`}>
      <h3 id={`board-${board.key}`}>{board.title}</h3>
      <ol className="board-rows">
        {board.rows.map((r, i) => (
          <li key={r.id + i} className={`board-row${i === 0 ? ' top' : ''}`} style={{ '--share': `${Math.round((r.v / max) * 100)}%` }}>
            <span className="board-rank" aria-hidden="true">{i + 1}</span>
            <span className="board-name">
              <PlayerLink id={r.id} name={r.n} />
              <span className="board-team">{r.t.join(', ')}</span>
            </span>
            <span className="board-val">{num(r.v)}<span className="visually-hidden"> {board.unit}</span></span>
          </li>
        ))}
      </ol>
    </section>
  );
}

function MiniBoard({ board }) {
  return (
    <section className="mini-board">
      <h3>{board.title}</h3>
      {board.qual && <p className="qual">{board.qual}</p>}
      <ol>
        {board.rows.map((r, i) => (
          <li key={r.id + i}>
            <span className="mb-name"><PlayerLink id={r.id} name={r.n} /><span className="mb-sub">{r.sub}</span></span>
            <span className="mb-val">{typeof r.v !== 'number' ? r.v : RATE_UNITS.has(board.unit) ? r.v.toFixed(2) : num(r.v)}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}

export default function Home() {
  const meta = useMeta();
  const [compId, setCompId] = useState(() => defaultComp(meta));
  const comp = meta.competitions.find((c) => c.id === compId);
  const { data: leaders } = useData('leaders.json');
  const { data: recent } = useData('recent.json');
  const boards = leaders ? leaders[compId] || [] : [];
  const get = (k) => boards.find((b) => b.key === k);
  const quick = meta.competitions.filter((c) => c.group !== 'Leagues');
  const leagues = meta.competitions.filter((c) => c.group === 'Leagues');

  const choose = (id) => { setCompId(id); writePref(id); };

  return (
    <div className="home">
      <section className="scoreboard" aria-labelledby="board-title">
        <div className="board-inner">
          <div className="board-head">
            <h1 id="board-title">{comp.name}</h1>
            <p className="board-sub">
              Career leaders across {num(comp.matches)} matches, {comp.from ? comp.from.slice(0, 4) : ''} to {date(comp.to)}
            </p>
          </div>
          <div className="board-switch" role="group" aria-label="Choose a competition">
            {quick.map((c) => (
              <button key={c.id} type="button" className={c.id === compId ? 'on' : ''} aria-pressed={c.id === compId} onClick={() => choose(c.id)}>
                {c.gender === 'female' ? `${c.short} (W)` : c.short}
              </button>
            ))}
            {leagues.length > 0 && (
              <select aria-label="Leagues" value={comp.group === 'Leagues' ? compId : ''} onChange={(e) => e.target.value && choose(e.target.value)} className={comp.group === 'Leagues' ? 'on' : ''}>
                <option value="">Leagues…</option>
                {leagues.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            )}
          </div>
          {!leaders ? (
            <p className="board-loading">Loading leaders…</p>
          ) : (
            <div className="board-grid">
              <BoardColumn board={get('runs')} />
              <BoardColumn board={get('wickets')} />
            </div>
          )}
          <div className="board-foot">
            <Link to={`/stats/${compId}`}>All {comp.name} stats</Link>
            <Link to={`/stats/${compId}/records`}>Records</Link>
            {comp.group === 'Leagues' && <Link to={`/stats/${compId}/seasons`}>Season by season</Link>}
          </div>
        </div>
      </section>

      <div className="page home-body">
        <section className="home-section" aria-labelledby="more-leaders">
          <h2 id="more-leaders">More {comp.name} leaders</h2>
          <div className="mini-grid">
            {boards.filter((b) => !['runs', 'wickets'].includes(b.key)).map((b) => <MiniBoard key={b.key} board={b} />)}
          </div>
        </section>

        <section className="home-section" aria-labelledby="latest">
          <div className="section-head">
            <h2 id="latest">Latest results</h2>
            <Link to="/results">All results</Link>
          </div>
          {recent ? (
            <ul className="results-list">{recent.slice(0, 8).map((m) => <ResultRow key={m.id} m={m} />)}</ul>
          ) : <p className="loading">Loading results…</p>}
        </section>

        <section className="home-section" aria-labelledby="all-comps">
          <h2 id="all-comps">Every competition</h2>
          <div className="comp-index">
            {groupedComps(meta).map(([group, comps]) => (
              <div key={group} className="comp-group">
                <h3>{group}</h3>
                <ul>
                  {comps.map((c) => (
                    <li key={c.id}>
                      <Link to={`/stats/${c.id}`}>{c.name}</Link>
                      <span className="muted">{num(c.matches)} matches since {c.from ? c.from.slice(0, 4) : '–'}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
