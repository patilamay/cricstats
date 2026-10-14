import { useMemo, useState } from 'react';
import { GLOSSARY } from '../glossary.js';

const STATS_TERMS = [
  { term: 'Average (batting)', definition: 'Runs scored divided by the number of times dismissed. Not-out innings add runs but not dismissals, so a player who is never out has no average.' },
  { term: 'Average (bowling)', definition: 'Runs conceded per wicket taken. Lower is better.' },
  { term: 'Strike rate (batting)', definition: 'Runs scored per 100 balls faced.' },
  { term: 'Strike rate (bowling)', definition: 'Balls bowled per wicket taken. Lower is better.' },
  { term: 'Economy rate', definition: 'Runs conceded per six balls bowled.' },
  { term: 'BBI', definition: 'Best bowling in an innings: most wickets, then fewest runs conceded.' },
  { term: 'BBM', definition: 'Best bowling in a match, combining both innings of a Test.' },
  { term: 'Not out (NO, *)', definition: 'An innings in which the batter was not dismissed. Marked with an asterisk, as in 87*.' },
  { term: 'HS', definition: 'Highest score in a single innings.' },
  { term: 'Dismissals (Dis)', definition: 'Catches plus stumpings taken by a fielder or wicketkeeper.' },
  { term: 'Super Over', definition: 'A one-over-per-side eliminator used to settle tied limited-overs matches. Super Over runs and wickets are not counted in career figures.' },
];

const ALL = [...GLOSSARY, ...STATS_TERMS].sort((a, b) => a.term.localeCompare(b.term));

export default function Glossary() {
  const [q, setQ] = useState('');
  const terms = useMemo(() => {
    const s = q.trim().toLowerCase();
    return s ? ALL.filter((t) => t.term.toLowerCase().includes(s) || t.definition.toLowerCase().includes(s)) : ALL;
  }, [q]);
  return (
    <div className="page glossary-page">
      <h1>Glossary</h1>
      <p className="muted">Cricket terms and the abbreviations used in the stats tables.</p>
      <label className="glossary-search">
        <span className="visually-hidden">Search the glossary</span>
        <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search terms" />
      </label>
      <dl className="glossary">
        {terms.map((t) => (
          <div key={t.term} className="gl-item"><dt>{t.term}</dt><dd>{t.definition}</dd></div>
        ))}
      </dl>
      {!terms.length && <p className="muted">No terms match “{q}”.</p>}
    </div>
  );
}
