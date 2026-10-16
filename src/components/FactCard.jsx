// "Did you know?" card on the home page. Facts are computed from the database every night
// (pipeline/facts.py); one is picked at random on each visit, avoiding ones seen recently.
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useData } from '../data.js';

const SEEN_KEY = 'cricstats.seenFacts';
const WEIGHT = { onthisday: 3, recent: 2, milestone: 2, oddity: 2, record: 1, career: 1 };

const readSeen = () => { try { return JSON.parse(localStorage.getItem(SEEN_KEY)) || []; } catch { return []; } };
const writeSeen = (ids) => { try { localStorage.setItem(SEEN_KEY, JSON.stringify(ids.slice(-20))); } catch { /* storage unavailable */ } };

const todayKey = () => {
  const d = new Date();
  return `${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

function pick(pool, avoid) {
  const fresh = pool.filter((f) => !avoid.includes(f.id));
  const from = fresh.length ? fresh : pool;
  const total = from.reduce((s, f) => s + (WEIGHT[f.kind] || 1), 0);
  let r = Math.random() * total;
  for (const f of from) { r -= WEIGHT[f.kind] || 1; if (r <= 0) return f; }
  return from[from.length - 1];
}

export default function FactCard() {
  const { data } = useData('facts.json');
  const pool = useMemo(() => {
    if (!data) return [];
    return [...(data.onThisDay?.[todayKey()] || []), ...(data.facts || [])];
  }, [data]);
  const [fact, setFact] = useState(null);
  const [n, setN] = useState(0);

  useEffect(() => {
    if (!pool.length) return;
    const seen = readSeen();
    const f = pick(pool, seen);
    setFact(f);
    writeSeen([...seen.filter((id) => id !== f.id), f.id]);
  }, [pool, n]);

  if (!fact) return <div className="fact-card placeholder" aria-hidden="true" />;
  return (
    <aside className="fact-card" aria-live="polite" aria-label="Did you know?">
      <p className="fact-tag">{fact.tag}</p>
      <p className="fact-text" key={fact.id}>{fact.text}</p>
      <div className="fact-actions">
        {fact.to && <Link className="fact-btn primary" to={fact.to}>{fact.link || 'Explore'} →</Link>}
        {fact.ask && <Link className="fact-btn" to={`/ask?q=${encodeURIComponent(fact.ask)}`}>Ask about this</Link>}
        {pool.length > 1 && <button type="button" className="fact-btn ghost" onClick={() => setN(n + 1)}>Another one <span aria-hidden="true">↻</span></button>}
      </div>
    </aside>
  );
}
