import { Link } from 'react-router-dom';
import { useMeta } from '../App.jsx';
import { date, num } from '../format.js';

export default function About() {
  const meta = useMeta();
  return (
    <div className="page prose">
      <h1>About CricStats</h1>
      <p>
        CricStats turns ball-by-ball records of {num(meta.totals.matches)} matches into career statistics, leaderboards,
        records and scorecards for international cricket and the major franchise leagues. The numbers are rebuilt from scratch every day,
        so new matches appear shortly after <a href="https://cricsheet.org">Cricsheet</a> publishes them.
      </p>

      <h2>Where the data comes from</h2>
      <p>
        All match data comes from Cricsheet, which publishes free ball-by-ball data under the Open Data Commons Attribution License.
        The latest match currently included was played on {date(meta.latestMatch)}.
      </p>

      <h2>What is and isn't covered</h2>
      <p>
        Figures only count matches that Cricsheet has ball-by-ball data for. For older eras, especially Tests and ODIs from before the
        early 2000s, Cricsheet's coverage is incomplete, so career totals for players from those years will be lower than their official figures.
        Recent careers are close to complete.
      </p>
      <ul>
        {meta.competitions.map((c) => (
          <li key={c.id}><Link to={`/stats/${c.id}`}>{c.name}</Link>: {num(c.matches)} matches, {date(c.from)} to {date(c.to)}</li>
        ))}
      </ul>

      <h2>How the numbers are counted</h2>
      <ul>
        <li>Balls faced include no-balls but not wides.</li>
        <li>Bowlers are charged runs off the bat, wides and no-balls, but not byes or leg-byes.</li>
        <li>Bowlers are credited with bowled, caught, lbw, stumped and hit-wicket dismissals. Run outs count for the fielder.</li>
        <li>Retired hurt is not a dismissal. A four or six that was run rather than hit to the boundary does not count as a boundary.</li>
        <li>Super Overs appear on scorecards but are left out of career figures.</li>
        <li>Players are matched across competitions with Cricsheet's player register, so a player's IPL and international careers sit on one page.</li>
      </ul>
      <p>See the <Link to="/glossary">glossary</Link> for what each column means.</p>
    </div>
  );
}
