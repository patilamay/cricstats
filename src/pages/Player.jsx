import { Link, useParams } from 'react-router-dom';
import { useMeta } from '../App.jsx';
import { playerShard, useData } from '../data.js';
import { date, dec, num, overs } from '../format.js';

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
  const teams = [...new Set(comps.flatMap((c) => p.comps[c.id].t || []))];
  const matches = comps.reduce((a, c) => a + p.comps[c.id].m, 0);
  const batting = comps.filter((c) => p.comps[c.id].b);
  const bowling = comps.filter((c) => p.comps[c.id].w);
  const fielding = comps.filter((c) => p.comps[c.id].f);

  return (
    <div className="page player-page">
      <header className="player-head">
        <h1>{p.n}</h1>
        <p className="player-teams">{teams.join(', ')}</p>
        <p className="muted">{num(matches)} matches in {comps.length} {comps.length === 1 ? 'competition' : 'competitions'} covered by this site</p>
      </header>

      {batting.length > 0 && (
        <section className="player-section" aria-labelledby="p-bat">
          <h2 id="p-bat">Batting</h2>
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
          <h2 id="p-bowl">Bowling</h2>
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
          <h2 id="p-fld">Fielding</h2>
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

      {p.recent.length > 0 && (
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
