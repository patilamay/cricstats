import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ask, askEnabled, runExample } from '../ask/client.js';
import { EXAMPLES } from '../../worker/src/prompt.js';

const fmt = (v, kind) => {
  if (v == null) return '–';
  if (kind === 'number' && typeof v === 'number') return Number.isInteger(v) ? v.toLocaleString('en-GB') : v.toLocaleString('en-GB', { maximumFractionDigits: 2 });
  return String(v);
};
const label = (c) => c.replace(/_/g, ' ').replace(/^./, (x) => x.toUpperCase());

function ResultTable({ columns, kinds, rows }) {
  if (!rows.length) return <p className="muted">No matching records.</p>;
  return (
    <div className="table-wrap">
      <table className="data">
        <thead><tr>{columns.map((c, i) => <th key={c} scope="col" className={kinds[i] === 'number' ? 'num' : 'text'}>{label(c)}</th>)}</tr></thead>
        <tbody>
          {rows.slice(0, 50).map((r, i) => (
            <tr key={i}>{r.map((v, j) => <td key={j} className={kinds[j] === 'number' ? 'num' : 'text'}>{fmt(v, kinds[j])}</td>)}</tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// The SQL is only shown with ?debug in the address (handy when checking an answer).
const DEBUG = typeof location !== 'undefined' && new URLSearchParams(location.search).has('debug');

function AnswerCard({ item }) {
  return (
    <article className="answer-card" aria-live="polite">
      <p className="answer-q">{item.question}</p>
      {item.error ? <p className="notice">{item.error}</p> : item.cannot ? <p className="answer-text">{item.note}</p> : (
        <>
          {item.answer && <p className="answer-text">{item.answer}</p>}
          {item.note && <p className="answer-note">How this was counted: {item.note}</p>}
          <ResultTable columns={item.columns} kinds={item.kinds} rows={item.rows} />
          {DEBUG && <details className="answer-sql">
            <summary>Show the query</summary>
            <pre><code>{item.sql}</code></pre>
          </details>}
        </>
      )}
    </article>
  );
}

export default function Ask() {
  const [params, setParams] = useSearchParams();
  const [q, setQ] = useState(params.get('q') || '');
  const [stage, setStage] = useState(null);
  const [items, setItems] = useState([]);
  const asked = useRef(null);
  const enabled = askEnabled();

  const go = async (question, example) => {
    const text = (example ? example.q : question).trim();
    if (!text || stage) return;
    setStage('Starting');
    try {
      const item = example ? await runExample(example, setStage) : await ask(text, setStage);
      setItems((prev) => [item, ...prev].slice(0, 6));
    } catch (err) {
      setItems((prev) => [{ question: text, error: err.message || 'Something went wrong. Try again.' }, ...prev].slice(0, 6));
    } finally {
      setStage(null);
    }
  };

  useEffect(() => {
    const initial = params.get('q');
    if (initial && asked.current !== initial) {
      asked.current = initial;
      setQ(initial);
      const ex = EXAMPLES.find((e) => e.q.toLowerCase() === initial.trim().toLowerCase());
      if (enabled || ex) go(initial, ex);
    }
  }, [params]); // eslint-disable-line react-hooks/exhaustive-deps

  const submit = (e) => {
    e.preventDefault();
    if (!q.trim()) return;
    setParams({ q: q.trim() });
  };

  return (
    <div className="page ask-page">
      <h1>Ask CricStats</h1>
      <p className="muted ask-sub">Ask about players, teams, matches and records. Answers are worked out from the data on this site.</p>

      <form className="ask-form" onSubmit={submit} role="search">
        <label htmlFor="ask-input" className="visually-hidden">Your question</label>
        <input id="ask-input" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Who scored the most T20I runs in 2024?" maxLength={300} autoFocus autoComplete="off" />
        <button type="submit" disabled={!q.trim() || !!stage || !enabled}>Ask</button>
      </form>

      {!enabled && (
        <p className="ask-off">Typed questions aren't switched on yet. The example questions below work now.</p>
      )}

      <div className="ask-examples" role="group" aria-label="Example questions">
        {EXAMPLES.slice(0, 6).map((ex) => (
          <button key={ex.q} type="button" disabled={!!stage} onClick={() => { setQ(ex.q); go(ex.q, ex); }}>{ex.q}</button>
        ))}
      </div>

      {stage && (
        <p className="ask-stage" role="status"><span className="dot" aria-hidden="true" />{stage}…{items.length === 0 && <span className="muted"> The first question loads the data engine, which takes a few seconds.</span>}</p>
      )}

      <div className="answers">
        {items.map((item, i) => <AnswerCard key={`${item.question}-${i}`} item={item} />)}
      </div>

      <p className="muted ask-fine">
        Typed questions are turned into a database query by an AI model (Claude), then run in your browser against this site's data.
        The model can misread a question, so check the "How this was counted" line if a number looks off.
      </p>
    </div>
  );
}
