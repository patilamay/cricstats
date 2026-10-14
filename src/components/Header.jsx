import { useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import PlayerSearch from './PlayerSearch.jsx';

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
          <NavLink to="/results" onClick={close}>Results</NavLink>
          <NavLink to="/stats/test-m" onClick={close} className={() => (pathname.startsWith('/stats/') ? 'active' : '')}>Stats</NavLink>
          <NavLink to="/players" onClick={close}>Players</NavLink>
          <NavLink to="/glossary" onClick={close}>Glossary</NavLink>
          <NavLink to="/about" onClick={close}>About</NavLink>
        </nav>
        {pathname !== '/' && <PlayerSearch onPick={close} />}
      </div>
    </header>
  );
}
