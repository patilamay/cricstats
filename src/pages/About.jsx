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

      <h2>Asking questions</h2>
      <p>
        On the <Link to="/ask">Ask</Link> page you can type a question in plain English. An AI model (Claude, by Anthropic) turns it into a database query,
        which then runs in your browser against the same data as the rest of the site. The model sees your question and the first rows of the result, nothing else about you.
        Each answer says how it was counted, because the model can misread a question.
      </p>

      <h2>Complete careers: Cricsheet plus Wikipedia</h2>
      <p>
        Ball-by-ball records only exist for international matches from about 2001 onward. For full careers in Tests, ODIs and T20Is,
        the site combines two sources: each player's career totals from their{' '}
        <a href="https://en.wikipedia.org/">Wikipedia</a> page, as of the date the page gives, plus every match Cricsheet has recorded
        since that date. When Cricsheet covers a player's whole career, its figures are used on their own.
        These combined figures appear in the All-time tables, the home page leaders and the International career table on player pages.
      </p>
      <p>
        This also covers matches Cricsheet doesn't publish. Cricsheet withholds a few hundred matches, including many of Afghanistan's
        internationals, so for those players the Wikipedia totals carry most of the career.
      </p>
      <p>
        Wikipedia figures are maintained by volunteers and can occasionally be out of date or wrong. Wikipedia content is available under{' '}
        <a href="https://creativecommons.org/licenses/by-sa/4.0/">CC BY-SA 4.0</a>.
        {meta.wiki && ` Career totals currently come from ${num(meta.wiki.players)} Wikipedia articles.`}
      </p>

      <h2>Matches before ball-by-ball records</h2>
      <p>
        For international matches without ball-by-ball data, mostly before 2002, the site uses the match summaries on Wikipedia's
        series and tournament articles. They give every innings total, the top scorers and bowlers of each innings, the result,
        venue, umpires and toss, back to the first Test in 1877. A small number of famous matches have a full scorecard on
        Wikipedia, and those are shown in full. These matches appear in results, team records and the all-time records lists.
        {meta.history && ` Currently ${num(Object.values(meta.history).reduce((a, h) => a + h.added, 0))} such matches are included.`}
      </p>

      <h2>What is and isn't covered</h2>
      <p>
        Season tables, most-sixes records, and the batting, bowling and fielding tables count only matches with ball-by-ball data.
        For Tests and ODIs that means roughly 2001 onward; leagues are covered from their first season. Full player-by-player
        scorecards for older matches exist only in commercial archives.
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
