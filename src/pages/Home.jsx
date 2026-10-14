import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMeta } from '../App.jsx';
import { useData } from '../data.js';
import { date, num } from '../format.js';
import { PlayerLink, ResultRow } from '../components/Bits.jsx';
import PlayerSearch from '../components/PlayerSearch.jsx';

const PREF_KEY = 'cricstats.homeLeaders';
const readPref = () => { try { return JSON.parse(localStorage.getItem(PREF_KEY)) || null; } catch { return null; } };
const writePref = (v) => { try { localStorage.setItem(PREF_KEY, JSON.stringify(v)); } catch { /* storage unavailable */ } };

const FORMATS = [['test', 'Tests'], ['odi', 'ODIs'], ['t20i', 'T20Is']];

function LeaderList({ board }) {
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

export default function Home() {
  const meta = useMeta();
  const ids = new Set(meta.competitions.map((c) => c.id));
  const saved = readPref();
  const [fmt, setFmt] = useState(saved && saved.fmt ? saved.fmt : 'test');
  const [gender, setGender] = useState(saved && saved.gender ? saved.gender : 'm');
  const compId = ids.has(`${fmt}-${gender}`) ? `${fmt}-${gender}` : meta.competitions[0].id;
  const comp = meta.competitions.find((c) => c.id === compId);
  const { data: leaders } = useData('leaders.json');
  const { data: recent } = useData('recent.json');
  const boards = leaders ? leaders[compId] || [] : [];
  const runs = boards.find((b) => b.key === 'runs');
  const wkts = boards.find((b) => b.key === 'wickets');
  const leagues = meta.competitions.filter((c) => c.group === 'Leagues');

  const choose = (f, g) => { setFmt(f); setGender(g); writePref({ fmt: f, gender: g }); };

  return (
    <div className="home">
      <section className="hero" aria-labelledby="hero-title">
        <div className="hero-inner">
          <h1 id="hero-title">Cricket stats, from Bradman to last night</h1>
          <p className="hero-sub">
            Careers, records and scorecards for {num(meta.totals.players)} players across international cricket and the big leagues. Updated every day.
          </p>
          <div className="hero-search"><PlayerSearch placeholder="Search for a player, like Kohli or Mandhana" /></div>
          <nav className="hero-links" aria-label="Browse by format">
            <Link to="/stats/test-m">Tests</Link>
            <Link to="/stats/odi-m">ODIs</Link>
            <Link to="/stats/t20i-m">T20Is</Link>
            <Link to="/stats/odi-w">Women's cricket</Link>
            {leagues[0] && <Link to={`/stats/${leagues[0].id}`}>Leagues</Link>}
          </nav>
        </div>
      </section>

      <div className="page home-body">
        <section className="leaders-card" aria-labelledby="leaders-title">
          <div className="leaders-head">
            <div>
              <h2 id="leaders-title">{comp.alltime ? 'All-time leaders' : 'Leaders'}</h2>
              <p className="muted">{comp.name}{comp.alltime ? `, updated to ${date(comp.to)}` : ''}</p>
            </div>
            <div className="leaders-switch">
              <div className="seg" role="group" aria-label="Format">
                {FORMATS.map(([f, label]) => (
                  <button key={f} type="button" className={f === fmt ? 'on' : ''} aria-pressed={f === fmt} onClick={() => choose(f, gender)}>{label}</button>
                ))}
              </div>
              <div className="seg" role="group" aria-label="Men or women">
                <button type="button" className={gender === 'm' ? 'on' : ''} aria-pressed={gender === 'm'} onClick={() => choose(fmt, 'm')}>Men</button>
                <button type="button" className={gender === 'w' ? 'on' : ''} aria-pressed={gender === 'w'} onClick={() => choose(fmt, 'w')}>Women</button>
              </div>
            </div>
          </div>
          {!leaders ? <p className="loading">Loading leaders…</p> : (
            <div className="board-grid">
              <LeaderList board={runs} />
              <LeaderList board={wkts} />
            </div>
          )}
          <p className="leaders-foot"><Link to={`/stats/${compId}`}>See every {comp.name} career</Link></p>
        </section>

        <section className="home-section" aria-labelledby="latest">
          <div className="section-head">
            <h2 id="latest">Latest results</h2>
            <Link to="/results">All results</Link>
          </div>
          {recent ? (
            <ul className="results-list results-row">{recent.slice(0, 4).map((m) => <ResultRow key={m.id} m={m} />)}</ul>
          ) : <p className="loading">Loading results…</p>}
        </section>

        <section className="home-section explore" aria-labelledby="explore">
          <h2 id="explore">Explore</h2>
          <div className="explore-grid">
            <Link to="/stats/test-m/records" className="explore-link">
              <strong>Records</strong>
              <span>Highest totals, biggest scores, best bowling</span>
            </Link>
            <Link to="/stats/ipl/seasons" className="explore-link">
              <strong>League seasons</strong>
              <span>Champions and top performers, season by season</span>
            </Link>
            <Link to="/players" className="explore-link">
              <strong>Players</strong>
              <span>Search {num(meta.totals.players)} careers, from 1877 to today</span>
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}
