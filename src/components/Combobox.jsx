import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { Flag } from './Bits.jsx';

// A searchable dropdown in the site's own style (the browser's built-in suggestion list looks
// different on every system). Type to filter, arrow keys to move, Enter to choose, Esc to close.
//   options: [{ value, label, count? }]
//   allLabel: the "everything" choice shown first (value '')
//   freeText: Enter accepts whatever is typed even if it isn't an option (used for Team)
//   flags: show a country flag before each option
export default function Combobox({ label, value, options, onChange, allLabel, placeholder, freeText = false, flags = false, disabled = false, emptyText = 'No matches' }) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const box = useRef(null);
  const input = useRef(null);
  const list = useRef(null);

  const current = options.find((o) => o.value === value);
  const shownText = open ? query : (current ? current.label : value || '');

  const filtered = useMemo(() => {
    const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
    const hit = (o) => terms.every((t) => o.label.toLowerCase().includes(t));
    const rows = terms.length ? options.filter(hit) : options;
    // Names that start with the query come first ("Ind" -> India before West Indies).
    const q = query.trim().toLowerCase();
    const sorted = q ? [...rows].sort((a, b) => Number(b.label.toLowerCase().startsWith(q)) - Number(a.label.toLowerCase().startsWith(q))) : rows;
    const all = allLabel && !q ? [{ value: '', label: allLabel, all: true }] : [];
    return [...all, ...sorted.slice(0, 200)];
  }, [options, query, allLabel]);

  useEffect(() => { setActive(0); }, [query, open]);
  useEffect(() => {
    if (!open) return undefined;
    const away = (e) => { if (box.current && !box.current.contains(e.target)) close(); };
    document.addEventListener('pointerdown', away);
    return () => document.removeEventListener('pointerdown', away);
  });
  useEffect(() => {
    const el = list.current && list.current.children[active];
    if (el) el.scrollIntoView({ block: 'nearest' });
  }, [active]);

  const close = () => { setOpen(false); setQuery(''); };
  const choose = (v) => { onChange(v); close(); input.current && input.current.blur(); };
  const openList = () => { if (!disabled) { setOpen(true); setQuery(''); } };

  const onKey = (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); if (!open) openList(); else setActive((a) => Math.min(a + 1, filtered.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
    else if (e.key === 'Enter') {
      e.preventDefault();
      const pick = filtered[active];
      if (open && pick && (!freeText || !query.trim() || pick.label.toLowerCase().startsWith(query.trim().toLowerCase()))) choose(pick.value);
      else if (freeText) choose(query.trim());
    } else if (e.key === 'Escape') { close(); }
    else if (e.key === 'Tab') { close(); }
  };

  return (
    <div className={`combo${open ? ' open' : ''}${disabled ? ' disabled' : ''}`} ref={box}>
      <label htmlFor={id}>{label}</label>
      <div className="combo-field">
        {flags && !open && value && <Flag name={value} />}
        <input
          id={id} ref={input} type="text" role="combobox" autoComplete="off" spellCheck="false"
          aria-expanded={open} aria-controls={`${id}-list`} aria-autocomplete="list"
          aria-activedescendant={open && filtered[active] ? `${id}-o${active}` : undefined}
          value={shownText} placeholder={open && current ? current.label : placeholder} disabled={disabled}
          onFocus={openList} onClick={() => !open && openList()}
          onChange={(e) => { setQuery(e.target.value); if (!open) setOpen(true); }}
          onKeyDown={onKey}
        />
        {value && !open
          ? <button type="button" className="combo-clear" aria-label={`Clear ${label}`} onClick={() => choose('')}>×</button>
          : <span className="combo-caret" aria-hidden="true" />}
      </div>
      {open && (
        <ul className="combo-list" id={`${id}-list`} role="listbox" ref={list} aria-label={label}>
          {filtered.length ? filtered.map((o, i) => (
            <li
              key={`${o.value}-${i}`} id={`${id}-o${i}`} role="option" aria-selected={o.value === value}
              className={`${i === active ? 'active' : ''}${o.all ? ' all' : ''}`}
              onPointerDown={(e) => e.preventDefault()} onClick={() => choose(o.value)} onMouseEnter={() => setActive(i)}
            >
              {flags && !o.all && <Flag name={o.value} />}
              <span className="combo-label">{o.label}</span>
              {o.count != null && <span className="combo-count">{o.count}</span>}
              {o.value === value && <span className="combo-tick" aria-hidden="true">✓</span>}
            </li>
          )) : (
            <li className="combo-empty" role="option" aria-selected="false" aria-disabled="true">
              {freeText && query.trim() ? <>Press Enter to search for “{query.trim()}”</> : emptyText}
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
