import { Link, NavLink } from 'react-router-dom';
import { score } from '../format.js';
import { Team } from './Bits.jsx';

// Shared by the Results "Latest" list and series pages.

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const isoDay = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export function dayLabel(iso, { relative = true } = {}) {
  const today = new Date();
  if (relative) {
    if (iso === isoDay(today)) return 'Today';
    const y = new Date(today); y.setDate(y.getDate() - 1);
    if (iso === isoDay(y)) return 'Yesterday';
  }
  const [yy, mm, dd] = iso.split('-').map(Number);
  const dow = DAYS[new Date(Date.UTC(yy, mm - 1, dd)).getUTCDay()];
  return `${dow} ${dd} ${MONTHS[mm - 1]}${yy === today.getFullYear() ? '' : ` ${yy}`}`;
}

export function spanLabel(from, to) {
  const [fy, fm, fd] = from.split('-').map(Number);
  const [ty, tm, td] = to.split('-').map(Number);
  if (from === to) return `${fd} ${MONTHS[fm - 1]} ${fy}`;
  if (fy === ty && fm === tm) return `${fd}–${td} ${MONTHS[fm - 1]} ${fy}`;
  if (fy === ty) return `${fd} ${MONTHS[fm - 1]} – ${td} ${MONTHS[tm - 1]} ${fy}`;
  return `${fd} ${MONTHS[fm - 1]} ${fy} – ${td} ${MONTHS[tm - 1]} ${ty}`;
}

export function compTag(c) {
  if (!c) return '';
  const intlWomen = c.gender === 'female' && /international/i.test(c.group) && !/\bW\b/.test(c.short);
  return intlWomen ? `${c.short} W` : c.short;
}

export const CompTag = ({ comp }) => (comp
  ? <span className={`res-tag res-tag-${comp.gender === 'female' ? 'w' : 'm'}`} title={comp.name}>{compTag(comp)}</span>
  : null);

export function ResultItem({ m, comp, showComp = true, showSeries = true }) {
  const byTeam = (team) => m.scores.filter((s) => s.team === team && !s.so).map(score).join(' & ');
  const where = m.venue ? (m.city && !m.venue.includes(m.city) ? `${m.venue}, ${m.city}` : m.venue) : m.city;
  const series = showSeries && m.event
    ? (m.sid ? <Link to={`/series/${m.sid}`} className="res-series">{m.event}</Link> : <span>{m.event}</span>)
    : null;
  const rest = [m.stage, where].filter(Boolean).join(' · ');
  return (
    <li className="res-item">
      <div className="res-meta">
        {showComp && <CompTag comp={comp} />}
        <span className="res-where">{series}{series && rest ? ' · ' : ''}{rest}</span>
      </div>
      <div className="res-teams">
        {m.teams.map((t) => (
          <div key={t} className={`res-team${m.winner === t ? ' won' : ''}`}>
            <span className="res-name"><Team name={t} /></span>
            <span className="res-score">{byTeam(t) || '–'}</span>
          </div>
        ))}
      </div>
      <div className="res-result">
        <span>{m.result}</span>
        <Link to={`/match/${m.id}`} className="res-card" aria-label={`Scorecard: ${m.teams.join(' v ')}`}>Scorecard</Link>
      </div>
    </li>
  );
}

export const ResultsTabs = () => (
  <nav className="tabs res-tabs" aria-label="Results views">
    <NavLink to="/results" end>Latest</NavLink>
    <NavLink to="/series">Series</NavLink>
  </nav>
);
