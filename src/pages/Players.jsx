import { Link } from 'react-router-dom';
import { useData } from '../data.js';
import { num } from '../format.js';
import { Teams } from '../components/Bits.jsx';
import Avatar from '../components/Avatar.jsx';
import PlayerSearch from '../components/PlayerSearch.jsx';

export default function Players() {
  const { data } = useData('players/index.json');
  return (
    <div className="page players-page">
      <h1>Players</h1>
      <p className="muted">Search {data ? num(data.length) : ''} players by name, for example “Kohli” or “Mandhana”.</p>
      <div className="big-search"><PlayerSearch placeholder="Type a player's name" autoFocus label="Find a player" /></div>
      {data && (
        <section className="player-section" aria-labelledby="most-capped">
          <h2 id="most-capped">Most matches played</h2>
          <ol className="most-capped">
            {data.slice(0, 30).map(([id, n, teams, m, , ph]) => (
              <li key={id}><Avatar photo={ph} name={n} /><Link to={`/player/${id}`}>{n}</Link><span className="muted"><Teams list={String(teams || '').split(', ').filter(Boolean)} /></span><span className="mc-m">{num(m)}</span></li>
            ))}
          </ol>
        </section>
      )}
    </div>
  );
}
