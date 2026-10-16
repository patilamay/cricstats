import { Link, useParams } from 'react-router-dom';
import { useMeta } from '../App.jsx';
import { playerShard, useData } from '../data.js';
import { date, dec, num, overs } from '../format.js';
import { Teams } from '../components/Bits.jsx';
import Avatar, { commonsPage } from '../components/Avatar.jsx';

export default function Player() {
  const { id } = useParams();
  const meta = useMeta();
  const { data, error } = useData(`players/${playerShard(id)}.json`);

  if (error) return <div className="page"><p className="notice">This player could not be loaded. <Link to="/players">Search for a player</Link></p></div>;
  if (!data) return <div className="page"><p className="loading">Loading player…</p></div>;
  const p = data[id];
  if (!p) return <div className="page"><h1>Player not found</h1><p>There is no player with this ID. <Link to="/players">Search for a player</Link></p></div>;

  const comps = meta.competitions.filter((c) => p.comps[c.id]);
  const compById = Object.fromEntries(meta.competitions.map((c) => [c.id, c]));
  const career = p.career || {};
  const careerComps = meta.competitions.filter((c) => career[c.id]);
  const teams = [...new Set([...(p.country ? [p.country] : []), ...comps.flatMap((c) => p.comps[c.id].t || [])])];
  const batting = comps.filter((c) => p.comps[c.id].b);
  const bowling = comps.filter((c) => p.comps[c.id].w);
  const fielding = comps.filter((c) => p.comps[c.id].f);
  // Totals prefer full careers (Wikipedia + Cricsheet) for international formats.
  const allIds = [...new Set([...comps.map((c) => c.id), ...careerComps.map((c) => c.id)])];
  const pick = (cid, fromCareer, fromComp) => (career[cid] ? fromCareer(career[cid]) : p.comps[cid] ? fromComp(p.comps[cid]) : 0) || 0;
  const matches = allIds.reduce((a, cid) => a + pick(cid, (c) => c.m, (c) => c.m), 0);
  const totalRuns = allIds.reduce((a, cid) => a + pick(cid, (c) => c.r, (c) => c.b && c.b.r), 0);
  const totalWkts = allIds.reduce((a, cid) => a + pick(cid, (c) => c.wk, (c) => c.w && c.w.wk), 0);
  const totalCt = allIds.reduce((a, cid) => a + pick(cid, (c) => c.ct, (c) => c.f && c.f.ct), 0);
  const ballByBall = careerComps.length > 0;
  const wikiUrl = p.wiki ? `https://en.wikipedia.org/wiki/${encodeURIComponent(p.wiki.replace(/ /g, '_'))}` : null;
  const srcNote = (c) => (c.src === 'c' ? 'Ball-by-ball' : c.src === 'w' ? `Wikipedia${c.asof ? `, as of ${date(c.asof)}` : ''}` : `Wikipedia to ${date(c.asof)}, then ball-by-ball`);

  return (
    <div className="page player-page">
      <header className="player-head">
        <div className="player-id">
          <Avatar photo={p.photo && p.photo.f} name={p.fn || p.n} size="lg" />
          <div>
            <h1>{p.fn || p.n}</h1>
            <p className="player-teams"><Teams list={teams} /></p>
          </div>
        </div>
        <p className="muted">{num(matches)} matches in the competitions this site covers</p>
        <ul className="player-chips">
          <li><span className="chip-val">{num(matches)}</span><span className="chip-label">Matches</span></li>
          {totalRuns > 0 && <li><span className="chip-val">{num(totalRuns)}</span><span className="chip-label">Runs</span></li>}
          {totalWkts > 0 && <li><span className="chip-val">{num(totalWkts)}</span><span className="chip-label">Wickets</span></li>}
          {totalCt > 0 && <li><span className="chip-val">{num(totalCt)}</span><span className="chip-label">Catches</span></li>}
        </ul>
        {p.photo && (
          <p className="photo-credit">
            Photo: <a href={commonsPage(p.photo.f)} target="_blank" rel="noopener noreferrer">{p.photo.a || 'Wikimedia Commons'}</a>, {p.photo.l}, via Wikimedia Commons
          </p>
        )}
      </header>

      {careerComps.length > 0 && (
        <section className="player-section" aria-labelledby="p-career">
          <h2 id="p-career">International career</h2>
          <p className="section-note">Complete career figures.{wikiUrl && <> Older matches from <a href={wikiUrl}>Wikipedia</a>, newer ones from ball-by-ball data.</>}</p>
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th className="text" scope="col">Format</th>
                  <th className="num" scope="col" title="Matches">M</th><th className="num" scope="col">Runs</th>
                  <th className="num" scope="col" title="Batting average">Avg</th><th className="num" scope="col">100</th>
                  <th className="num" scope="col">50</th><th className="num" scope="col" title="Highest score">HS</th>
                  <th className="num" scope="col">Wkts</th><th className="num" scope="col" title="Bowling average">Bowl avg</th>
                  <th className="num" scope="col" title="Economy">Econ</th><th className="num" scope="col" title="Best bowling in an innings">BBI</th>
                  <th className="num" scope="col" title="Catches/stumpings">Ct/St</th><th className="text" scope="col">Source</th>
                </tr>
              </thead>
              <tbody>
                {careerComps.map((c) => {
                  const r = career[c.id];
                  return (
                    <tr key={c.id}>
                      <td className="text"><Link to={`/stats/${c.id}/batting`}>{c.name}</Link></td>
                      <td className="num">{r.m}</td><td className="num strong">{num(r.r)}</td><td className="num">{dec(r.avg)}</td>
                      <td className="num">{r.c100}</td><td className="num">{r.c50}</td><td className="num">{r.hs == null ? '–' : `${r.hs}${r.hsNo ? '*' : ''}`}</td>
                      <td className="num strong">{r.wk}</td><td className="num">{dec(r.bavg)}</td><td className="num">{dec(r.econ)}</td>
                      <td className="num">{r.bbi || '–'}</td><td className="num">{r.ct}/{r.st}</td>
                      <td className="text src-cell">{srcNote(r)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {ballByBall && comps.length > 0 && (
        <p className="section-lede">The tables below are built from ball-by-ball data, which covers matches from about 2001 onward.</p>
      )}

      {batting.length > 0 && (
        <section className="player-section" aria-labelledby="p-bat">
          <h2 id="p-bat">{ballByBall ? 'Batting by competition' : 'Batting'}</h2>
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th className="text" scope="col">Competition</th>
                  <th className="num" scope="col" title="Matches">M</th><th className="num" scope="col" title="Innings">Inn</th>
                  <th className="num" scope="col" title="Not outs">NO</th><th className="num" scope="col">Runs</th>
                  <th className="num" scope="col" title="Highest score">HS</th><th className="num" scope="col" title="Average">Avg</th>
                  <th className="num" scope="col" title="Strike rate">SR</th><th className="num" scope="col">100</th>
                  <th className="num" scope="col">50</th><th className="num" scope="col">4s</th><th className="num" scope="col">6s</th>
                </tr>
              </thead>
              <tbody>
                {batting.map((c) => {
                  const s = p.comps[c.id];
                  const b = s.b;
                  return (
                    <tr key={c.id}>
                      <td className="text"><Link to={`/stats/${c.id}`}>{c.name}</Link></td>
                      <td className="num">{s.m}</td><td className="num">{b.inn}</td><td className="num">{b.no}</td>
                      <td className="num strong">{num(b.r)}</td><td className="num">{b.hs}{b.hsNo ? '*' : ''}</td>
                      <td className="num">{dec(b.avg)}</td><td className="num">{dec(b.sr)}</td>
                      <td className="num">{b.c100}</td><td className="num">{b.c50}</td><td className="num">{b.f4}</td><td className="num">{b.s6}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {bowling.length > 0 && (
        <section className="player-section" aria-labelledby="p-bowl">
          <h2 id="p-bowl">{ballByBall ? 'Bowling by competition' : 'Bowling'}</h2>
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th className="text" scope="col">Competition</th>
                  <th className="num" scope="col" title="Innings">Inn</th><th className="num" scope="col">Overs</th>
                  <th className="num" scope="col" title="Maidens">Mdns</th><th className="num" scope="col">Runs</th>
                  <th className="num" scope="col">Wkts</th><th className="num" scope="col" title="Best bowling in an innings">BBI</th>
                  <th className="num" scope="col" title="Average">Avg</th><th className="num" scope="col" title="Economy">Econ</th>
                  <th className="num" scope="col" title="Strike rate">SR</th><th className="num" scope="col">5w</th>
                </tr>
              </thead>
              <tbody>
                {bowling.map((c) => {
                  const w = p.comps[c.id].w;
                  return (
                    <tr key={c.id}>
                      <td className="text"><Link to={`/stats/${c.id}/bowling`}>{c.name}</Link></td>
                      <td className="num">{w.inn}</td><td className="num">{overs(w.balls, c.ballsOnly)}</td>
                      <td className="num">{w.md}</td><td className="num">{num(w.r)}</td><td className="num strong">{w.wk}</td>
                      <td className="num">{w.bbi || '–'}</td><td className="num">{dec(w.avg)}</td><td className="num">{dec(w.econ)}</td>
                      <td className="num">{dec(w.sr, 1)}</td><td className="num">{w.w5}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {fielding.length > 0 && (
        <section className="player-section" aria-labelledby="p-fld">
          <h2 id="p-fld">{ballByBall ? 'Fielding by competition' : 'Fielding'}</h2>
          <div className="table-wrap">
            <table className="data">
              <thead><tr><th className="text" scope="col">Competition</th><th className="num" scope="col">Catches</th><th className="num" scope="col">Stumpings</th><th className="num" scope="col">Run outs</th></tr></thead>
              <tbody>
                {fielding.map((c) => {
                  const f = p.comps[c.id].f;
                  return <tr key={c.id}><td className="text">{c.name}</td><td className="num">{f.ct}</td><td className="num">{f.st}</td><td className="num">{f.ro}</td></tr>;
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {p.recent && p.recent.length > 0 && (
        <section className="player-section" aria-labelledby="p-recent">
          <h2 id="p-recent">Recent matches</h2>
          <div className="table-wrap">
            <table className="data">
              <thead><tr><th className="text" scope="col">Date</th><th className="text" scope="col">Competition</th><th className="text" scope="col">Opponent</th><th className="num" scope="col">Batting</th><th className="num" scope="col">Bowling</th><th className="text" scope="col"><span className="visually-hidden">Scorecard</span></th></tr></thead>
              <tbody>
                {p.recent.map((r) => (
                  <tr key={r.mid}>
                    <td className="text nowrap">{date(r.d)}</td>
                    <td className="text">{compById[r.c] ? compById[r.c].name : r.c}</td>
                    <td className="text">{r.vs}</td>
                    <td className="num">{r.bat ? `${r.bat}${r.bf != null ? ` (${r.bf})` : ''}` : 'Did not bat'}</td>
                    <td className="num">{r.bowl || '–'}</td>
                    <td className="text"><Link to={`/match/${r.mid}`}>Scorecard</Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
