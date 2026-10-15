import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ask, askEnabled, historyFrom, runExample } from '../ask/client.js';
import { EXAMPLES } from '../../worker/src/prompt.js';

const fmt = (v, kind) => {
  if (v == null) return '–';
  if (kind === 'number' && typeof v === 'number') return Number.isInteger(v) ? v.toLocaleString('en-GB') : v.toLocaleString('en-GB', { maximumFractionDigits: 2 });
  return String(v);
};
const label = (c) => c.replace(/_/g, ' ').replace(/^./, (x) => x.toUpperCase());
const same = (a, b) => (a || '').trim().toLowerCase().replace(/[?.!]+$/, '') === (b || '').trim().toLowerCase().replace(/[?.!]+$/, '');

// The SQL is only shown with ?debug in the address (handy when checking an answer).
const DEBUG = typeof location !== 'undefined' && new URLSearchParams(location.search).has('debug');

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

function Turn({ item, followUp, innerRef }) {
  const readAs = followUp && item.standalone && !same(item.standalone, item.question);
  return (
    <li className="turn" ref={innerRef}>
      <p className="turn-q">{item.question}</p>
      <article className="answer-card">
        {readAs && <p className="answer-readas">Read as: {item.standalone}</p>}
        {item.error ? <p className="notice">{item.error}</p> : item.cannot ? <p className="answer-text">{item.note}</p> : (
          <>
            {item.answer && <p className="answer-text">{item.answer}</p>}
            {item.note && <p className="answer-note">How this was counted: {item.note}</p>}
            <ResultTable columns={item.columns} kinds={item.kinds} rows={item.rows} />
            {DEBUG && (
              <details className="answer-sql">
                <summary>Show the query</summary>
                <pre><code>{item.sql}</code></pre>
              </details>
            )}
          </>
        )}
      </article>
    </li>
  );
}

const FOLLOW_UPS = ['And for women?', 'Only since 2020', 'Show the top 20'];

export default function Ask() {
  const [params] = useSearchParams();
  const [q, setQ] = useState('');
  const [stage, setStage] = useState(null);
  const [thread, setThread] = useState([]);
  const asked = useRef(null);
  const inputRef = useRef(null);
  const lastRef = useRef(null);
  const enabled = askEnabled();
  const started = thread.length > 0 || !!stage;

  const go = async (question, example, fresh = false) => {
    const text = (example ? example.q : question).trim();
    if (!text || stage) return;
    const base = fresh ? [] : thread;
    if (fresh) setThread([]);
    setQ('');
    setStage('Starting');
    let item;
    try {
      item = example ? await runExample(example, setStage) : await ask(text, historyFrom(base), setStage);
    } catch (err) {
      item = { question: text, error: err.message || 'Something went wrong. Try again.' };
    }
    setThread([...base, item].slice(-12));
    setStage(null);
  };

  // A question in the address (from the search box or a shared link) starts a new conversation.
  useEffect(() => {
    const initial = params.get('q');
    if (initial && asked.current !== initial) {
      asked.current = initial;
      const ex = EXAMPLES.find((e) => same(e.q, initial));
      if (enabled || ex) go(initial, ex, true);
      else setQ(initial);
    }
  }, [params]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    // Bring the newest question and answer into view (from its top, so long tables start where they should).
    if (thread.length || stage) lastRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    if (!stage && thread.length) inputRef.current?.focus({ preventScroll: true });
  }, [thread, stage]);

  const submit = (e) => {
    e.preventDefault();
    if (q.trim()) go(q);
  };

  const restart = () => { setThread([]); setQ(''); asked.current = null; inputRef.current?.focus(); };

  const form = (
    <form className="ask-form" onSubmit={submit} role="search">
      <label htmlFor="ask-input" className="visually-hidden">{started ? 'Ask a follow-up' : 'Your question'}</label>
      <input
        id="ask-input" ref={inputRef} type="search" value={q} onChange={(e) => setQ(e.target.value)}
        placeholder={started ? 'Ask a follow-up, e.g. “what about 2023?”' : 'Who scored the most T20I runs in 2024?'}
        maxLength={300} autoFocus autoComplete="off" disabled={!enabled && started}
      />
      <button type="submit" disabled={!q.trim() || !!stage || !enabled}>Ask</button>
    </form>
  );

  return (
    <div className={`page ask-page${started ? ' chatting' : ''}`}>
      <div className="ask-head">
        <h1>Ask CricStats</h1>
        {started && <button type="button" className="ask-new" onClick={restart} disabled={!!stage}>New conversation</button>}
      </div>
      {!started && <p className="muted ask-sub">Ask about players, teams, matches and records, then ask follow-ups. Answers are worked out from the data on this site.</p>}

      {!started && form}
      {!enabled && <p className="ask-off">Typed questions aren't switched on yet. The example questions below work now.</p>}

      {!started && (
        <div className="ask-examples" role="group" aria-label="Example questions">
          {EXAMPLES.slice(0, 6).map((ex) => (
            <button key={ex.q} type="button" disabled={!!stage} onClick={() => go(ex.q, ex, true)}>{ex.q}</button>
          ))}
        </div>
      )}

      {started && (
        <ol className="thread" aria-live="polite">
          {thread.map((item, i) => <Turn key={i} item={item} followUp={i > 0} innerRef={!stage && i === thread.length - 1 ? lastRef : null} />)}
          {stage && (
            <li className="turn pending" ref={lastRef}>
              <p className="ask-stage" role="status"><span className="dot" aria-hidden="true" />{stage}…{thread.length === 0 && <span className="muted"> The first question loads the data engine, which takes a few seconds.</span>}</p>
            </li>
          )}
        </ol>
      )}

      {started && (
        <div className="ask-dock">
          {enabled && !stage && thread.length > 0 && !thread[thread.length - 1].error && (
            <div className="ask-examples follow" role="group" aria-label="Follow-up ideas">
              {FOLLOW_UPS.filter((f) => !thread.some((t) => same(t.question, f))).map((f) => <button key={f} type="button" onClick={() => go(f)}>{f}</button>)}
            </div>
          )}
          {form}
        </div>
      )}

      <p className="muted ask-fine">
        Typed questions are turned into a database query by an AI model (Claude), then run in your browser against this site's data.
        The model can misread a question, so check the "How this was counted" line if a number looks off.
      </p>
    </div>
  );
}
