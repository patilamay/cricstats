import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMeta } from '../App.jsx';
import { date, score } from '../format.js';
import { flagCode } from '../flags.js';

const FLAGS = `${import.meta.env.BASE_URL}flags/`;

// A small flag for a country (or a country's women's side). Renders nothing for clubs and franchises.
export function Flag({ name }) {
  const code = flagCode(name);
  if (!code) return null;
  return <img className="flag" src={`${FLAGS}${code}.svg`} alt="" width="16" height="12" loading="lazy" decoding="async" />;
}

// A team name with its flag in front.
export const Team = ({ name }) => <span className="team-flagged"><Flag name={name} />{name}</span>;

// Several teams, comma separated, each with its flag.
export const Teams = ({ list }) => (
  <>{(list || []).map((t, i) => <span key={t}>{i > 0 && ', '}<Team name={t} /></span>)}</>
);

export const PlayerLink = ({ id, name }) => (id ? <Link to={`/player/${id}`}>{name}</Link> : name);

export function CompLabel({ id }) {
  const meta = useMeta();
  const c = meta && meta.competitions.find((x) => x.id === id);
  return <span className="comp-label">{c ? c.name : id}</span>;
}

// One line per finished match: teams with scores, result, link to the scorecard.
export function ResultRow({ m, showComp = true, hasCard = true }) {
  const byTeam = (team) => m.scores.filter((s) => s.team === team && !s.so).map(score).join(' & ');
  return (
    <li className="result-row">
      <div className="result-meta">
        {showComp && <CompLabel id={m.c} />}
        <span>{date(m.date)}</span>
        {m.stage && <span>{m.stage}</span>}
        {m.city && <span>{m.city}</span>}
      </div>
      <div className="result-teams">
        {m.teams.map((t) => (
          <div key={t} className={`result-team${m.winner === t ? ' won' : ''}`}>
            <span className="team-name"><Team name={t} /></span>
            <span className="team-score">{byTeam(t)}</span>
          </div>
        ))}
      </div>
      <div className="result-line">
        <span>{m.result}</span>
        {hasCard && <Link to={`/match/${m.id}`} className="scorecard-link" aria-label={`Scorecard: ${m.teams.join(' v ')}, ${date(m.date)}`}>Scorecard</Link>}
      </div>
    </li>
  );
}

// Long result lists render in pages of 60 with a "Show more" button.
export function ResultList({ matches, showComp = true, step = 60 }) {
  const [n, setN] = useState(step);
  return (
    <>
      <ul className="results-list">{matches.slice(0, n).map((m) => <ResultRow key={m.id} m={m} showComp={showComp} />)}</ul>
      {matches.length > n && (
        <div className="show-more">
          <button type="button" onClick={() => setN(n + step * 3)}>Show more results</button>
          <span className="muted">{(matches.length - n).toLocaleString('en-GB')} older matches</span>
        </div>
      )}
    </>
  );
}
