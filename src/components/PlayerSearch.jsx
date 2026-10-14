import { useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { load } from '../data.js';

const norm = (s) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

export function searchPlayers(index, q, limit = 8) {
  const terms = norm(q).split(/\s+/).filter(Boolean);
  if (!terms.length) return [];
  const out = [];
  for (const row of index) {
    const name = norm(row[4] ? `${row[1]} ${row[4]}` : row[1]);
    if (terms.every((t) => name.includes(t))) {
      out.push(row);
      if (out.length >= limit) break;
    }
  }
  return out;
}

const QUESTION = /\?|^(who|what|which|how|when|where|most|best|highest|lowest|top|list|show|compare|fastest|average|biggest)\b/i;
export const looksLikeQuestion = (q) => QUESTION.test(q.trim()) || q.trim().split(/\s+/).length > 3;

export default function PlayerSearch({ onPick, placeholder = 'Search players or ask a question', autoFocus = false, label = 'Search players or ask a question' }) {
  const [index, setIndex] = useState(null);
  const [q, setQ] = useState('');
  const [active, setActive] = useState(0);
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const listId = useRef(`ps-${Math.random().toString(36).slice(2, 8)}`).current;

  const ensureIndex = () => { if (!index) load('players/index.json').then(setIndex, () => setIndex([])); };
  const items = useMemo(() => {
    const text = q.trim();
    if (!text) return [];
    const players = (index ? searchPlayers(index, text, 6) : []).map((r) => ({ kind: 'player', row: r }));
    const askItem = { kind: 'ask', text };
    return looksLikeQuestion(text) || !players.length ? [askItem, ...players] : [...players, askItem];
  }, [index, q]);

  const go = (item) => {
    setQ(''); setOpen(false);
    if (onPick) onPick();
    if (item.kind === 'ask') navigate(`/ask?q=${encodeURIComponent(item.text)}`);
    else navigate(`/player/${item.row[0]}`);
  };

  const onKey = (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => Math.min(a + 1, items.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
    else if (e.key === 'Enter' && items[active]) { e.preventDefault(); go(items[active]); }
    else if (e.key === 'Escape') { setOpen(false); }
  };

  const showList = open && q.trim().length > 0;

  return (
    <div className="player-search" role="combobox" aria-expanded={showList} aria-owns={listId} aria-haspopup="listbox">
      <label className="visually-hidden" htmlFor={`${listId}-input`}>{label}</label>
      <input
        id={`${listId}-input`}
        type="search"
        value={q}
        placeholder={placeholder}
        autoComplete="off"
        autoFocus={autoFocus}
        aria-autocomplete="list"
        aria-controls={listId}
        aria-activedescendant={showList && items[active] ? `${listId}-${active}` : undefined}
        onFocus={() => { ensureIndex(); setOpen(true); }}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onChange={(e) => { setQ(e.target.value); setActive(0); setOpen(true); }}
        onKeyDown={onKey}
      />
      {showList && (
        <ul id={listId} role="listbox" className="search-results">
          {items.map((it, i) => (
            <li
              key={it.kind === 'ask' ? 'ask' : it.row[0]}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={i === active}
              className={`${i === active ? 'active' : ''}${it.kind === 'ask' ? ' sr-ask' : ''}`}
              onMouseDown={(e) => { e.preventDefault(); go(it); }}
              onMouseEnter={() => setActive(i)}
            >
              {it.kind === 'ask' ? (
                <><span className="sr-name">Ask: “{it.text}”</span><span className="sr-team">Get an answer worked out from the stats</span></>
              ) : (
                <><span className="sr-name">{it.row[1]}</span><span className="sr-team">{it.row[2]}</span></>
              )}
            </li>
          ))}
          {!index && <li className="muted">Loading players…</li>}
        </ul>
      )}
    </div>
  );
}
