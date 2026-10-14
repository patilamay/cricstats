import { Link } from 'react-router-dom';
import { useMeta } from '../App.jsx';
import { date, score } from '../format.js';

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
            <span className="team-name">{t}</span>
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
