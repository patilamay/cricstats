import { useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { load } from '../data.js';

const norm = (s) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

export function searchPlayers(index, q, limit = 8) {
  const terms = norm(q).split(/\s+/).filter(Boolean);
  if (!terms.length) return [];
  const out = [];
  for (const row of index) {
    const name = norm(row[1]);
    if (terms.every((t) => name.includes(t))) {
      out.push(row);
      if (out.length >= limit) break;
    }
  }
  return out;
}

export default function PlayerSearch({ onPick, placeholder = 'Find a player', autoFocus = false }) {
  const [index, setIndex] = useState(null);
  const [q, setQ] = useState('');
  const [active, setActive] = useState(0);
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const listId = useRef(`ps-${Math.random().toString(36).slice(2, 8)}`).current;

  const ensureIndex = () => { if (!index) load('players/index.json').then(setIndex, () => setIndex([])); };
  const results = useMemo(() => (index ? searchPlayers(index, q) : []), [index, q]);

  const go = (row) => {
    setQ(''); setOpen(false);
    if (onPick) onPick();
    navigate(`/player/${row[0]}`);
  };

  const onKey = (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => Math.min(a + 1, results.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
    else if (e.key === 'Enter' && results[active]) { e.preventDefault(); go(results[active]); }
    else if (e.key === 'Escape') { setOpen(false); }
  };

  const showList = open && q.trim().length > 0;

  return (
    <div className="player-search" role="combobox" aria-expanded={showList} aria-owns={listId} aria-haspopup="listbox">
      <label className="visually-hidden" htmlFor={`${listId}-input`}>Find a player</label>
      <input
        id={`${listId}-input`}
        type="search"
        value={q}
        placeholder={placeholder}
        autoComplete="off"
        autoFocus={autoFocus}
        aria-autocomplete="list"
        aria-controls={listId}
        aria-activedescendant={showList && results[active] ? `${listId}-${active}` : undefined}
        onFocus={() => { ensureIndex(); setOpen(true); }}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onChange={(e) => { setQ(e.target.value); setActive(0); setOpen(true); }}
        onKeyDown={onKey}
      />
      {showList && (
        <ul id={listId} role="listbox" className="search-results">
          {!index && <li className="muted">Loading players…</li>}
          {index && !results.length && <li className="muted">No player matches “{q}”.</li>}
          {results.map((r, i) => (
            <li
              key={r[0]}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={i === active}
              className={i === active ? 'active' : ''}
              onMouseDown={(e) => { e.preventDefault(); go(r); }}
              onMouseEnter={() => setActive(i)}
            >
              <span className="sr-name">{r[1]}</span>
              <span className="sr-team">{r[2]}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
