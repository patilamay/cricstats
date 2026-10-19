import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ask, askEnabled, historyFrom, runExample } from '../ask/client.js';
import { deleteConversation, listConversations, loadConversation, renameConversation, saveTurns } from '../ask/store.js';
import { PENDING_KEY, useAuth } from '../auth.jsx';
import { EXAMPLES } from '../../worker/src/prompt.js';
import { engineReady } from '../ask/engine.js';
import PitchLoader, { themeOf } from '../components/PitchLoader.jsx';
import { Team } from '../components/Bits.jsx';
import { flagCode } from '../flags.js';
import { useData } from '../data.js';

// Start screen: a few ideas at a time, mixing instant examples (answered from stored queries),
// other good questions, and one about the latest big match.
const EXTRA_IDEAS = [
  'Most ODI wickets for Australia',
  'Highest individual scores in Test cricket',
  'Most sixes in a single T20I innings',
  'Most IPL runs for Mumbai Indians',
  'Most catches by a fielder in ODIs',
  'Best bowling figures in the IPL',
  'Most T20I wickets in 2025',
  "Most runs in women's ODIs",
];
const IDEAS = [
  ...EXAMPLES.filter((e) => !/Lord/i.test(e.q)).map((e) => ({ q: e.q, ex: e })),
  ...EXTRA_IDEAS.map((q) => ({ q })),
];
const MAJOR = new Set(['Afghanistan', 'Australia', 'Bangladesh', 'England', 'India', 'Ireland', 'New Zealand', 'Pakistan', 'South Africa', 'Sri Lanka', 'West Indies', 'Zimbabwe']);
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
function latestIdea(recent) {
  const m = (recent || []).find((x) => x.teams && x.teams.length === 2 && x.teams.every((t) => MAJOR.has(t.replace(/ Women$/, ''))));
  if (!m) return null;
  const [, mm, dd] = m.date.split('-').map(Number);
  return { q: `Top scorers in ${m.teams[0]} v ${m.teams[1]} on ${dd} ${MON[mm - 1]} ${m.date.slice(0, 4)}`, fresh: true };
}
const shuffle = (arr) => { const a = [...arr]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const stillMotion = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;


const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})/;
const TEAM_COL = /(^|_)(team|opponent|opp|country|nation|winner|loser|side|against|home|away|for)$/i;
const PLAIN_NUMBER = /(^|_)(year|season|id)$/; // never "1,955"
const fmt = (v, kind, col) => {
  if (v == null || v === '') return '–';
  if (typeof v === 'string' && ISO_DATE.test(v)) {
    const [, y, m, d] = ISO_DATE.exec(v);
    return `${Number(d)} ${MONTHS[Number(m) - 1]} ${y}`;
  }
  if (typeof v === 'boolean') return v ? 'Yes' : 'No';
  if (typeof v === 'string' && TEAM_COL.test(col) && flagCode(v)) return <Team name={v} />;
  if (kind === 'number' && typeof v === 'number') {
    if (PLAIN_NUMBER.test(col)) return String(v);
    return Number.isInteger(v) ? v.toLocaleString('en-GB') : v.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  return String(v);
};
const LABELS = { sr: 'Strike rate', strike_rate: 'Strike rate', avg: 'Average', batting_avg: 'Batting avg', bowling_avg: 'Bowling avg', hs: 'High score', start_date: 'Date', opp: 'Opponent', not_out: 'Not out', fifties: '50s', hundreds: '100s', five_wickets: '5-wkt hauls' };
const label = (c) => LABELS[c] || c.replace(/_/g, ' ').replace(/^./, (x) => x.toUpperCase());
const same = (a, b) => (a || '').trim().toLowerCase().replace(/[?.!]+$/, '') === (b || '').trim().toLowerCase().replace(/[?.!]+$/, '');
const when = (iso) => {
  const d = new Date(iso);
  const days = Math.floor((Date.now() - d) / 86400000);
  if (days < 1) return 'Today';
  if (days < 2) return 'Yesterday';
  if (days < 7) return `${days} days ago`;
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: d.getFullYear() === new Date().getFullYear() ? undefined : 'numeric' });
};
const store = {
  get: (k) => { try { return sessionStorage.getItem(k); } catch { return null; } },
  set: (k, v) => { try { sessionStorage.setItem(k, v); } catch { /* storage unavailable */ } },
  del: (k) => { try { sessionStorage.removeItem(k); } catch { /* storage unavailable */ } },
};

// The SQL is only shown with ?debug in the address (handy when checking an answer).
const DEBUG = typeof location !== 'undefined' && new URLSearchParams(location.search).has('debug');

function ResultTable({ columns, kinds, rows }) {
  if (!rows || !rows.length) return <p className="muted">No matching records.</p>;
  const ranked = rows.length > 1;
  const align = (i) => (kinds[i] === 'number' && !PLAIN_NUMBER.test(columns[i]) ? 'num' : 'text');
  return (
    <div className="table-wrap answer-table">
      <table className="data">
        <thead>
          <tr>
            {ranked && <th scope="col" className="num rank"><span className="visually-hidden">Rank</span>#</th>}
            {columns.map((c, i) => <th key={c} scope="col" className={align(i)}>{label(c)}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.slice(0, 50).map((r, i) => (
            <tr key={i}>
              {ranked && <td className="num rank">{i + 1}</td>}
              {r.map((v, j) => <td key={j} className={`${align(j)}${j === 0 ? ' lead' : ''}`}>{fmt(v, kinds[j], columns[j])}</td>)}
            </tr>
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
            {DEBUG && item.sql && (
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

function ConversationItem({ c, active, onOpen, onRename, onDelete }) {
  const [mode, setMode] = useState(null); // null | 'rename' | 'delete'
  const [title, setTitle] = useState(c.title);
  if (mode === 'rename') {
    return (
      <li className="conv editing">
        <form onSubmit={(e) => { e.preventDefault(); onRename(c.id, title); setMode(null); }}>
          <label className="visually-hidden" htmlFor={`rn-${c.id}`}>Conversation name</label>
          <input id={`rn-${c.id}`} value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} autoFocus onKeyDown={(e) => e.key === 'Escape' && setMode(null)} />
          <div className="conv-actions"><button type="submit">Save</button><button type="button" onClick={() => setMode(null)}>Cancel</button></div>
        </form>
      </li>
    );
  }
  if (mode === 'delete') {
    return (
      <li className="conv editing">
        <p>Delete “{c.title}”?</p>
        <div className="conv-actions"><button type="button" className="danger" onClick={() => onDelete(c.id)}>Delete</button><button type="button" onClick={() => setMode(null)}>Cancel</button></div>
      </li>
    );
  }
  return (
    <li className={`conv${active ? ' active' : ''}`}>
      <button type="button" className="conv-open" onClick={() => onOpen(c.id)} aria-current={active ? 'true' : undefined}>
        <span className="conv-title">{c.title}</span>
        <span className="conv-when">{when(c.updated_at)}</span>
      </button>
      <span className="conv-tools">
        <button type="button" onClick={() => { setTitle(c.title); setMode('rename'); }} aria-label={`Rename “${c.title}”`} title="Rename">✎</button>
        <button type="button" onClick={() => setMode('delete')} aria-label={`Delete “${c.title}”`} title="Delete">✕</button>
      </span>
    </li>
  );
}

// Used when the answer came without suggestions (e.g. a reopened saved conversation).
const FOLLOW_UPS = ['And for women?', 'Only since 2020', 'Show the top 20'];

export default function Ask() {
  const { enabled: accounts, ready, user, signIn } = useAuth();
  const [params, setParams] = useSearchParams();
  const [q, setQ] = useState('');
  const [stage, setStage] = useState(null);
  const [pendingQ, setPendingQ] = useState(null);
  const [heavy, setHeavy] = useState(false);
  const [theme, setTheme] = useState('bowling');
  const [thread, setThread] = useState([]);
  const [convId, setConvId] = useState(null);
  const [convs, setConvs] = useState(null);
  const [saveError, setSaveError] = useState(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const asked = useRef(null);
  const inputRef = useRef(null);
  const lastRef = useRef(null);
  const enabled = askEnabled();
  const started = thread.length > 0 || !!stage;
  const signedIn = !!user;

  const refreshList = useCallback(() => {
    if (!signedIn) { setConvs(null); return; }
    listConversations().then(setConvs).catch(() => setConvs([]));
  }, [signedIn]);
  useEffect(refreshList, [refreshList]);

  const showConv = (id) => {
    const next = new URLSearchParams(params);
    next.delete('q');
    if (id) next.set('c', id); else next.delete('c');
    setParams(next, { replace: true });
  };

  // Save one or more new turns for a signed-in user.
  const persist = async (id, items) => {
    try {
      const newId = await saveTurns(id, items);
      setSaveError(null);
      if (newId !== id) { setConvId(newId); showConv(newId); }
      refreshList();
      return newId;
    } catch (err) {
      setSaveError(err.message || 'This conversation could not be saved.');
      return id;
    }
  };

  const onStage = (name, meta) => {
    setStage(name);
    if (meta && meta.heavy) setHeavy(true);
  };



  const go = async (question, example, fresh = false) => {
    const text = (example ? example.q : question).trim();
    if (!text || stage) return;
    const base = fresh ? [] : thread;
    const baseId = fresh ? null : convId;
    if (fresh) { setThread([]); setConvId(null); setNotFound(false); }
    setQ('');
    setPendingQ(text);
    setHeavy(false);
    // Animation follows the subject of the question; follow-ups without one keep the last theme.
    const prev = base.length ? base[base.length - 1].theme : null;
    const nextTheme = themeOf(example ? example.q : text, example ? example.sql : '') || prev || 'bowling';
    setTheme(nextTheme);
    setStage('Working out the query');
    let item;
    try {
      item = example ? await runExample(example, onStage) : await ask(text, historyFrom(base), onStage);
    } catch (err) {
      item = { question: text, error: err.message || 'Something went wrong. Try again.' };
    }
    item.theme = themeOf(item.standalone || text, item.sql || '') || nextTheme;
    setThread([...base, item].slice(-100));
    setStage(null);
    setPendingQ(null);
    if (signedIn) await persist(baseId, [item]);
  };

  const openConv = async (id) => {
    if (stage) return;
    setPanelOpen(false);
    setThread([]);
    setStage('Opening the conversation');
    try {
      const conv = await loadConversation(id);
      if (!conv) { setNotFound(true); setThread([]); setConvId(null); showConv(null); return; }
      setNotFound(false);
      setThread(conv.turns);
      setConvId(conv.id);
      showConv(conv.id);
    } catch (err) {
      setSaveError(err.message);
    } finally {
      setStage(null);
    }
  };

  const restart = () => {
    setThread([]); setConvId(null); setQ(''); setNotFound(false); setPanelOpen(false);
    asked.current = null; showConv(null); inputRef.current?.focus();
  };

  // A guest who signs in mid-conversation: keep it across the Google redirect, then save it.
  const signInAndKeep = () => {
    if (thread.length) store.set(PENDING_KEY, JSON.stringify(thread));
    signIn();
  };
  useEffect(() => {
    if (!ready || !signedIn) return;
    const raw = store.get(PENDING_KEY);
    if (!raw) return;
    store.del(PENDING_KEY);
    try {
      const items = JSON.parse(raw);
      if (Array.isArray(items) && items.length) { setThread(items); persist(null, items); }
    } catch { /* ignore */ }
  }, [ready, signedIn]); // eslint-disable-line react-hooks/exhaustive-deps

  // ?q= (from the search box or a shared link) starts a new conversation; ?c= opens a saved one.
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
    const c = params.get('c');
    if (c && ready && signedIn && c !== convId && !stage) openConv(c);
  }, [params, ready, signedIn]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (thread.length || stage) lastRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    if (!stage && thread.length) inputRef.current?.focus({ preventScroll: true });
  }, [thread, stage]);

  const submit = (e) => {
    e.preventDefault();
    if (q.trim()) go(q);
  };

  const onRename = async (id, title) => { try { await renameConversation(id, title); refreshList(); } catch (err) { setSaveError(err.message); } };
  const onDelete = async (id) => {
    try {
      await deleteConversation(id);
      if (id === convId) restart();
      refreshList();
    } catch (err) { setSaveError(err.message); }
  };

  // Start-screen ideas (three at a time, reshuffled on demand) and a placeholder that cycles
  // through example questions until the visitor starts typing.
  const { data: recent } = useData(started ? null : 'recent.json');
  const [seed, setSeed] = useState(0);
  const ideas = useMemo(() => {
    const fresh = latestIdea(recent);
    const picks = shuffle(IDEAS).slice(0, fresh ? 2 : 3);
    return fresh && seed % 2 === 0 ? [fresh, ...picks] : shuffle(IDEAS).slice(0, 3);
  }, [recent, seed]);
  const [hint, setHint] = useState(0);
  useEffect(() => {
    if (started || q || stillMotion()) return undefined;
    const t = setInterval(() => setHint((h) => h + 1), 3500);
    return () => clearInterval(t);
  }, [started, q]);
  const hintText = IDEAS[hint % IDEAS.length].q;

  const wantsSaved = params.get('c');
  const last = thread[thread.length - 1];
  const suggestions = ((last && last.followups && last.followups.length ? last.followups : FOLLOW_UPS))
    .filter((f) => !thread.some((t) => same(t.question, f)));
  const form = (
    <form className="ask-form" onSubmit={submit} role="search">
      <label htmlFor="ask-input" className="visually-hidden">{started ? 'Ask a follow-up' : 'Your question'}</label>
      <input
        id="ask-input" ref={inputRef} type="search" value={q} onChange={(e) => setQ(e.target.value)}
        placeholder={started ? 'Ask a follow-up, e.g. “what about 2023?”' : hintText}
        maxLength={300} autoFocus autoComplete="off" disabled={!enabled && started}
      />
      <button type="submit" disabled={!q.trim() || !!stage || !enabled} aria-label="Ask">
        <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M10 15.5V4.5M4.8 9.7 10 4.5l5.2 5.2" /></svg>
      </button>
    </form>
  );

  const sidebar = accounts && signedIn && (
    <aside className={`ask-side${panelOpen ? ' open' : ''}`} aria-label="Your conversations">
      <div className="ask-side-head">
        <h2>Your conversations</h2>
        <button type="button" className="ask-side-close" onClick={() => setPanelOpen(false)} aria-label="Close">✕</button>
      </div>
      <button type="button" className="ask-new wide" onClick={restart} disabled={!!stage}>+ New conversation</button>
      {convs == null ? <p className="muted small">Loading…</p> : convs.length === 0 ? (
        <p className="muted small">Your questions are saved here as you ask them.</p>
      ) : (
        <ul className="conv-list">
          {convs.map((c) => <ConversationItem key={c.id} c={c} active={c.id === convId} onOpen={openConv} onRename={onRename} onDelete={onDelete} />)}
        </ul>
      )}
    </aside>
  );

  return (
    <div className={`page ask-page${started ? ' chatting' : ''}${sidebar ? ' with-side' : ''}`}>
      {sidebar}
      {panelOpen && <button type="button" className="ask-scrim" aria-label="Close conversations" onClick={() => setPanelOpen(false)} />}
      <div className="ask-main">
        <div className="ask-head">
          {started ? <h1>Ask CricStats</h1> : <span className="ask-eyebrow">Ask CricStats</span>}
          <div className="ask-head-tools">
            {sidebar && <button type="button" className="ask-new ask-side-toggle" onClick={() => setPanelOpen(true)}>Your conversations</button>}
            {started && <button type="button" className="ask-new" onClick={restart} disabled={!!stage}>New conversation</button>}
          </div>
        </div>
        {!started && <h1 className="ask-title">What do you want to know?</h1>}

        {accounts && ready && !signedIn && wantsSaved && !started && (
          <p className="notice">This is a saved conversation. <button type="button" className="linkish" onClick={signInAndKeep}>Sign in with Google</button> to open it.</p>
        )}
        {notFound && <p className="notice">That conversation wasn't found. It may have been deleted.</p>}

        {!started && form}
        {!enabled && <p className="ask-off">Typed questions aren't switched on yet. The example questions below work now.</p>}

        {!started && (
          <div className="ask-ideas" role="group" aria-label="Ideas to try">
            <span className="ask-ideas-label">Try</span>
            {ideas.map((it) => (
              <button key={it.q} type="button" className={it.fresh ? 'fresh' : ''} disabled={!!stage || (!it.ex && !enabled)} onClick={() => go(it.q, it.ex, true)}>
                {it.fresh && <span className="ask-fresh-dot" aria-hidden="true" />}{it.q}
              </button>
            ))}
            <button type="button" className="ask-shuffle" onClick={() => setSeed((n) => n + 1)} aria-label="Show other ideas" title="Other ideas">
              <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M15.5 7.5A6 6 0 0 0 4.6 6.2M4.5 12.5a6 6 0 0 0 10.9 1.3M4.3 3.2v3.3h3.3M15.7 16.8v-3.3h-3.3" /></svg>
            </button>
          </div>
        )}

        {started && (
          <ol className="thread" aria-live="polite">
            {thread.map((item, i) => <Turn key={i} item={item} followUp={i > 0} innerRef={!stage && i === thread.length - 1 ? lastRef : null} />)}
            {stage && (
              <li className="turn pending" ref={lastRef}>
                {pendingQ && <p className="turn-q">{pendingQ}</p>}
                <PitchLoader stage={stage} theme={theme} heavy={heavy} note={thread.length === 0 && !engineReady() && stage !== 'Opening the conversation' ? 'The first question loads the data engine, which takes a few seconds.' : null} />
              </li>
            )}
          </ol>
        )}

        {started && (
          <div className="ask-dock">
            {saveError && <p className="ask-save-note error">{saveError}</p>}
            {accounts && ready && !signedIn && thread.length > 0 && !stage && (
              <p className="ask-save-note"><button type="button" className="linkish" onClick={signInAndKeep}>Sign in with Google</button> to save this conversation and pick it up later.</p>
            )}
            {enabled && !stage && thread.length > 0 && !thread[thread.length - 1].error && (
              <div className="ask-examples follow" role="group" aria-label="Follow-up ideas">
                {suggestions.map((f) => <button key={f} type="button" onClick={() => go(f)}>{f}</button>)}
              </div>
            )}
            {form}
          </div>
        )}

        <details className="ask-fine">
          <summary>Answers are worked out by AI from this site's data. How it works</summary>
          <p>
            Your question is turned into a database query by an AI model (Claude), then run in your browser against this site's data.
            The model can misread a question, so check the "How this was counted" line if a number looks off.
            {accounts && <> Signed-in users' conversations are saved to their account; see <Link to="/privacy">Privacy</Link>.</>}
          </p>
        </details>
      </div>
    </div>
  );
}
