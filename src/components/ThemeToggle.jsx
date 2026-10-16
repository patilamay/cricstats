import { useEffect, useRef, useState } from 'react';

// Light / dark / system. "System" follows the device setting; a choice is remembered in this browser.
const KEY = 'cricstats.theme';
const OPTIONS = [
  { id: 'system', label: 'System' },
  { id: 'light', label: 'Light' },
  { id: 'dark', label: 'Dark' },
];

const read = () => { try { const t = localStorage.getItem(KEY); return t === 'light' || t === 'dark' ? t : 'system'; } catch { return 'system'; } };
const systemDark = () => typeof matchMedia === 'function' && matchMedia('(prefers-color-scheme: dark)').matches;

function apply(choice) {
  const root = document.documentElement;
  if (choice === 'system') delete root.dataset.theme; else root.dataset.theme = choice;
  try { if (choice === 'system') localStorage.removeItem(KEY); else localStorage.setItem(KEY, choice); } catch { /* private mode */ }
  window.dispatchEvent(new CustomEvent('cricstats-theme', { detail: choice }));
}

const Sun = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4.2" /><path d="M12 2.5v2.3M12 19.2v2.3M4.6 4.6l1.6 1.6M17.8 17.8l1.6 1.6M2.5 12h2.3M19.2 12h2.3M4.6 19.4l1.6-1.6M17.8 6.2l1.6-1.6" /></svg>
);
const Moon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 14.6A8.2 8.2 0 0 1 9.4 4a8.2 8.2 0 1 0 10.6 10.6Z" /></svg>
);
const Monitor = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4.5" width="18" height="12" rx="2" /><path d="M9 20h6M12 16.5V20" /></svg>
);
const ICONS = { system: Monitor, light: Sun, dark: Moon };

export default function ThemeToggle({ inline = false }) {
  const [choice, setChoice] = useState(read);
  const [open, setOpen] = useState(false);
  const [, rerender] = useState(0);
  const box = useRef(null);

  // Keep the icon right when the device switches theme while "System" is chosen.
  useEffect(() => {
    if (typeof matchMedia !== 'function') return undefined;
    const mq = matchMedia('(prefers-color-scheme: dark)');
    const on = () => rerender((n) => n + 1);
    const sync = (e) => setChoice(e.detail);
    mq.addEventListener('change', on);
    window.addEventListener('cricstats-theme', sync);
    return () => { mq.removeEventListener('change', on); window.removeEventListener('cricstats-theme', sync); };
  }, []);

  useEffect(() => {
    if (!open) return undefined;
    const away = (e) => { if (box.current && !box.current.contains(e.target)) setOpen(false); };
    const esc = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('pointerdown', away);
    document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('pointerdown', away); document.removeEventListener('keydown', esc); };
  }, [open]);

  const pick = (id) => { apply(id); setChoice(id); setOpen(false); };
  const showing = choice === 'system' ? (systemDark() ? 'dark' : 'light') : choice;
  const Icon = showing === 'dark' ? Moon : Sun;

  if (inline) {
    // Inside the mobile menu: a three-way switch.
    return (
      <div className="theme-inline" role="radiogroup" aria-label="Theme">
        <span className="theme-inline-label">Theme</span>
        {OPTIONS.map((o) => {
          const I = ICONS[o.id];
          return (
            <button key={o.id} type="button" role="radio" aria-checked={choice === o.id} onClick={() => pick(o.id)}>
              <I />{o.label}
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <div className="theme-toggle" ref={box}>
      <button type="button" className="theme-btn" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen(!open)}
        title={`Theme: ${OPTIONS.find((o) => o.id === choice).label}`}>
        <Icon /><span className="visually-hidden">Theme: {OPTIONS.find((o) => o.id === choice).label}</span>
      </button>
      {open && (
        <ul className="theme-menu" role="menu">
          {OPTIONS.map((o) => {
            const I = ICONS[o.id];
            return (
              <li key={o.id} role="none">
                <button type="button" role="menuitemradio" aria-checked={choice === o.id} onClick={() => pick(o.id)}>
                  <I />{o.label}{choice === o.id && <span className="theme-tick" aria-hidden="true">✓</span>}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
