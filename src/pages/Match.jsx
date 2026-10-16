import { Link, useParams } from 'react-router-dom';
import { useData } from '../data.js';
import { date, dec } from '../format.js';
import { CompLabel, PlayerLink, Team } from '../components/Bits.jsx';

const cricinfo = (id) => `https://www.espncricinfo.com/ci/engine/match/${id}.html`;

function Innings({ inn, ballsOnly }) {
  const ex = inn.extras;
  const extrasTotal = ex.b + ex.lb + ex.w + ex.nb + ex.p;
  const parts = [ex.b && `b ${ex.b}`, ex.lb && `lb ${ex.lb}`, ex.w && `w ${ex.w}`, ex.nb && `nb ${ex.nb}`, ex.p && `pen ${ex.p}`].filter(Boolean).join(', ');
  const title = `${inn.team}${inn.superOver ? ' (Super Over)' : ''}`;
  const allOut = inn.wkts >= 10;
  const total = `${inn.runs}${allOut ? '' : `/${inn.wkts}`}${inn.declared ? 'd' : ''}`;

  return (
    <section className="innings">
      <div className="innings-head">
        <h2>{title}</h2>
        <p className="innings-total"><strong>{total}</strong> <span className="muted">({ballsOnly ? `${inn.balls} balls` : `${inn.overs} ov`})</span></p>
      </div>
      <div className="table-wrap">
        <table className="data scorecard">
          <thead>
            <tr><th className="text" scope="col">Batter</th><th className="text" scope="col"><span className="visually-hidden">How out</span></th><th className="num" scope="col">R</th><th className="num" scope="col">B</th><th className="num" scope="col">4s</th><th className="num" scope="col">6s</th><th className="num" scope="col">SR</th></tr>
          </thead>
          <tbody>
            {inn.batting.map((b) => (
              <tr key={b.id}>
                <td className="text"><PlayerLink id={b.id} name={b.name} /></td>
                <td className="text how">{b.how}</td>
                <td className="num strong">{b.runs}</td><td className="num">{b.balls}</td>
                <td className="num">{b.fours}</td><td className="num">{b.sixes}</td>
                <td className="num">{b.balls ? dec((b.runs * 100) / b.balls) : '–'}</td>
              </tr>
            ))}
            <tr className="sub-row"><td className="text">Extras</td><td className="text how">{parts}</td><td className="num">{extrasTotal}</td><td colSpan={4} /></tr>
          </tbody>
        </table>
      </div>
      {inn.fow && inn.fow.length > 0 && (
        <p className="fow"><span className="fow-label">Fall of wickets:</span> {inn.fow.map((f) => `${f.runs}-${f.wkt} (${f.batter}, ${f.over})`).join('; ')}</p>
      )}
      <div className="table-wrap">
        <table className="data scorecard">
          <thead>
            <tr><th className="text" scope="col">Bowler</th><th className="num" scope="col">{ballsOnly ? 'B' : 'O'}</th><th className="num" scope="col">M</th><th className="num" scope="col">R</th><th className="num" scope="col">W</th><th className="num" scope="col">Econ</th><th className="num" scope="col">Wd</th><th className="num" scope="col">Nb</th></tr>
          </thead>
          <tbody>
            {inn.bowling.map((w) => (
              <tr key={w.id}>
                <td className="text"><PlayerLink id={w.id} name={w.name} /></td>
                <td className="num">{ballsOnly ? w.balls : `${Math.floor(w.balls / 6)}${w.balls % 6 ? `.${w.balls % 6}` : ''}`}</td>
                <td className="num">{w.maidens}</td><td className="num">{w.runs}</td><td className="num strong">{w.wkts}</td>
                <td className="num">{w.balls ? dec((w.runs * 6) / w.balls) : '–'}</td>
                <td className="num">{w.wides}</td><td className="num">{w.noballs}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

// Matches without ball-by-ball data: a summary scorecard from Wikipedia (innings totals and top
// performers), or the full scorecard where Wikipedia records one.
function HistoryMatch({ m }) {
  const perf = (b) => <><PlayerLink id={b.id} name={b.name} /> {b.runs}{b.no ? '*' : ''}{b.balls != null ? <span className="muted"> ({b.balls})</span> : null}</>;
  const wikiUrl = m.article ? `https://en.wikipedia.org/wiki/${encodeURIComponent(m.article.replace(/ /g, '_'))}` : null;
  return (
    <div className="page match-page">
      <header className="match-head">
        <p className="match-meta"><CompLabel id={m.c} /></p>
        <h1>{m.teams.join(' v ')}</h1>
        <p className="match-result">{m.result || 'Result not recorded'}</p>
        <p className="muted">{date(m.date)}{m.venue ? `, ${m.venue}` : ''}</p>
        <p className="muted">
          {m.toss && `${m.toss} `}
          {m.pomText && <>Player of the match: {m.pomText}. </>}
          {m.umpires && <>Umpires: {m.umpires}.</>}
        </p>
      </header>

      {m.full ? m.full.map((inn, k) => (
        <section className="innings" key={k}>
          <div className="innings-head">
            <h2><Team name={inn.team} /></h2>
            <p className="innings-total"><strong>{inn.total}{inn.wkts != null && inn.wkts < 10 ? `/${inn.wkts}` : ''}{inn.declared ? 'd' : ''}</strong> {inn.overs && <span className="muted">({inn.overs} ov)</span>}</p>
          </div>
          <div className="table-wrap">
            <table className="data scorecard">
              <thead><tr><th className="text" scope="col">Batter</th><th className="text" scope="col"><span className="visually-hidden">How out</span></th><th className="num" scope="col">R</th><th className="num" scope="col">B</th><th className="num" scope="col">4s</th><th className="num" scope="col">6s</th></tr></thead>
              <tbody>
                {inn.bat.map((b, i) => (
                  <tr key={i}><td className="text"><PlayerLink id={b.id} name={b.name} /></td><td className="text how">{b.how}</td><td className="num strong">{b.runs ?? '–'}</td><td className="num">{b.balls ?? '–'}</td><td className="num">{b.fours ?? '–'}</td><td className="num">{b.sixes ?? '–'}</td></tr>
                ))}
                {inn.extras != null && <tr className="sub-row"><td className="text">Extras</td><td /><td className="num">{inn.extras}</td><td colSpan={3} /></tr>}
              </tbody>
            </table>
          </div>
          {inn.bowl.length > 0 && (
            <div className="table-wrap">
              <table className="data scorecard">
                <thead><tr><th className="text" scope="col">Bowler</th><th className="num" scope="col">O</th><th className="num" scope="col">M</th><th className="num" scope="col">R</th><th className="num" scope="col">W</th></tr></thead>
                <tbody>{inn.bowl.map((w, i) => <tr key={i}><td className="text"><PlayerLink id={w.id} name={w.name} /></td><td className="num">{w.overs ?? '–'}</td><td className="num">{w.maidens ?? '–'}</td><td className="num">{w.runs ?? '–'}</td><td className="num strong">{w.wkts ?? '–'}</td></tr>)}</tbody>
              </table>
            </div>
          )}
        </section>
      )) : (
        <section className="summary-card" aria-label="Summary scorecard">
          {m.innings.map((inn, k) => (
            <div className="summary-inn" key={k}>
              <div className="summary-total">
                <span className="summary-team"><Team name={inn.team} /></span>
                <span className="summary-score">{inn.total}{inn.overs ? <span className="muted"> ({inn.overs} ov)</span> : null}</span>
              </div>
              <div className="summary-perf">
                {inn.bat.length > 0 && <p><span className="perf-label">Top scorers</span> {inn.bat.map((b, i) => <span key={i} className="perf">{perf(b)}</span>)}</p>}
                {inn.bowl.length > 0 && <p><span className="perf-label">Top bowling</span> {inn.bowl.map((w, i) => <span key={i} className="perf"><PlayerLink id={w.id} name={w.name} /> {w.w}/{w.r}</span>)}</p>}
              </div>
            </div>
          ))}
        </section>
      )}

      <p className="muted source-note">
        {m.full ? 'Full scorecard' : 'Summary scorecard: innings totals and top performers'} from{' '}
        {wikiUrl ? <a href={wikiUrl}>Wikipedia</a> : 'Wikipedia'} (CC BY-SA 4.0). Ball-by-ball records don't exist for this match.
        {m.cricinfo && <> <a href={cricinfo(m.cricinfo)}>Full scorecard on ESPNcricinfo</a></>}
      </p>
    </div>
  );
}

export default function Match() {
  const { id } = useParams();
  const { data: m, error } = useData(`match/${id}.json`);

  if (error) {
    return (
      <div className="page">
        <h1>Scorecard not available</h1>
        <p>This site keeps full scorecards for recent matches only. <a href={cricinfo(id)}>See this match on ESPNcricinfo</a> or go back to the <Link to="/results">latest results</Link>.</p>
      </div>
    );
  }
  if (!m) return <div className="page"><p className="loading">Loading scorecard…</p></div>;
  if (m.hist) return <HistoryMatch m={m} />;

  const ballsOnly = m.bpo === 5;
  return (
    <div className="page match-page">
      <header className="match-head">
        <p className="match-meta"><CompLabel id={m.c} />{m.event && m.event !== m.teams.join(' v ') && <span>{m.event}</span>}{m.stage && <span>{m.stage}</span>}</p>
        <h1>{m.teams.join(' v ')}</h1>
        <p className="match-result">{m.result}</p>
        <p className="muted">
          {date(m.date)}{m.endDate && m.endDate !== m.date ? ` to ${date(m.endDate)}` : ''}{m.venue ? `, ${m.venue}` : ''}
        </p>
        <p className="muted">
          {m.toss && `${m.toss.winner} won the toss and chose to ${m.toss.decision}. `}
          {m.pom.length > 0 && <>Player of the match: {m.pom.map((p, i) => <span key={p.id}>{i ? ', ' : ''}<PlayerLink id={p.id} name={p.name} /></span>)}</>}
        </p>
      </header>
      {m.innings.filter((i) => !i.forfeited).map((inn, i) => <Innings key={i} inn={inn} ballsOnly={ballsOnly} />)}
      <p className="muted source-note">Ball-by-ball data from Cricsheet. <a href={cricinfo(m.id)}>This match on ESPNcricinfo</a></p>
    </div>
  );
}
