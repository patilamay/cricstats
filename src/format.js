export const num = (v) => (v == null ? '–' : typeof v === 'number' ? v.toLocaleString('en-GB') : v);
export const dec = (v, dp = 2) => (v == null ? '–' : v.toFixed(dp));

export function overs(balls, ballsOnly = false) {
  if (balls == null) return '–';
  if (ballsOnly) return String(balls);
  const o = Math.floor(balls / 6);
  const b = balls % 6;
  return b ? `${o}.${b}` : `${o}`;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export function date(d, withYear = true) {
  if (!d) return '';
  const [y, m, day] = d.split('-');
  return `${Number(day)} ${MONTHS[Number(m) - 1]}${withYear ? ` ${y}` : ''}`;
}

export function score(s) {
  if (!s) return '';
  const w = s.w >= 10 ? '' : `/${s.w}`;
  return `${s.r}${w}${s.dec ? 'd' : ''}`;
}

export function relDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const days = Math.floor((Date.now() - d.getTime()) / 86400000);
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  return `${days} days ago`;
}
