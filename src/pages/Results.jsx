import { useState } from 'react';
import { useMeta } from '../App.jsx';
import { useData } from '../data.js';
import { ResultRow } from '../components/Bits.jsx';

export default function Results() {
  const meta = useMeta();
  const [comp, setComp] = useState('all');
  const path = comp === 'all' ? 'recent.json' : `comp/${comp}/results.json`;
  const { data, error } = useData(path);

  return (
    <div className="page">
      <div className="stats-head">
        <div>
          <h1>Results</h1>
          <p className="muted">Most recent first. Cricsheet usually adds matches within a few days of the finish.</p>
        </div>
        <div className="comp-picker">
          <label htmlFor="res-comp">Show</label>
          <select id="res-comp" value={comp} onChange={(e) => setComp(e.target.value)}>
            <option value="all">All competitions</option>
            {meta.competitions.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
      </div>
      {error ? <p className="notice">Results could not be loaded.</p>
        : !data ? <p className="loading">Loading results…</p>
          : <ul className="results-list">{data.map((m) => <ResultRow key={m.id} m={m} showComp={comp === 'all'} />)}</ul>}
    </div>
  );
}
