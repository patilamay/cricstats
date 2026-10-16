import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import PlayerSearch from './PlayerSearch.jsx';
import { useAuth } from '../auth.jsx';

function Account() {
  const { enabled, ready, user, signIn, signOut } = useAuth();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    const away = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    const esc = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('pointerdown', away);
    document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('pointerdown', away); document.removeEventListener('keydown', esc); };
  }, [open]);
  if (!enabled) return null;
  if (!ready) return <span className="account placeholder" aria-hidden="true" />;
  if (!user) return <button type="button" className="account signin" onClick={signIn}>Sign in</button>;
  const initial = (user.name || '?').trim().charAt(0).toUpperCase();
  return (
    <div className="account" ref={ref}>
      <button type="button" className="avatar-btn" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen(!open)} title={user.name}>
        {user.avatar ? <img src={user.avatar} alt="" referrerPolicy="no-referrer" /> : <span>{initial}</span>}
        <span className="visually-hidden">Account menu for {user.name}</span>
      </button>
      {open && (
        <div className="account-menu" role="menu">
          <p className="account-who"><strong>{user.name}</strong>{user.email && user.email !== user.name && <span>{user.email}</span>}</p>
          <Link role="menuitem" to="/ask" onClick={() => setOpen(false)}>Your conversations</Link>
          <Link role="menuitem" to="/privacy" onClick={() => setOpen(false)}>Privacy and your data</Link>
          <button role="menuitem" type="button" onClick={() => { setOpen(false); signOut(); }}>Sign out</button>
        </div>
      )}
    </div>
  );
}

export default function Header() {
  const [open, setOpen] = useState(false);
  const { pathname } = useLocation();
  const close = () => setOpen(false);
  return (
    <header className="site-header">
      <a className="skip" href="#main">Skip to content</a>
      <div className="header-inner">
        <Link to="/" className="wordmark" onClick={close}>
          <svg viewBox="0 0 32 32" aria-hidden="true"><circle cx="16" cy="16" r="10" /><path d="M11 8.5c3.6 5 3.6 10 0 15M21 8.5c-3.6 5-3.6 10 0 15" /></svg>
          CricStats
        </Link>
        <button className="menu-toggle" aria-expanded={open} aria-controls="site-nav" onClick={() => setOpen(!open)}>
          {open ? 'Close' : 'Menu'}
        </button>
        <nav id="site-nav" className={open ? 'open' : ''} aria-label="Main">
          <NavLink to="/ask" onClick={close}>Ask</NavLink>
          <NavLink to="/results" onClick={close}>Results</NavLink>
          <NavLink to="/stats/test-m" onClick={close} className={() => (pathname.startsWith('/stats/') ? 'active' : '')}>Stats</NavLink>
          <NavLink to="/players" onClick={close}>Players</NavLink>
          <NavLink to="/glossary" onClick={close}>Glossary</NavLink>
          <NavLink to="/about" onClick={close}>About</NavLink>
        </nav>
        {pathname !== '/' && pathname !== '/ask' && <PlayerSearch onPick={close} placeholder="Search or ask" />}
        <Account />
      </div>
    </header>
  );
}
