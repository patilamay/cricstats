import { Link } from 'react-router-dom';
import { useMeta } from '../App.jsx';
import { date } from '../format.js';

export default function Footer() {
  const meta = useMeta();
  return (
    <footer className="site-footer">
      <div className="footer-inner">
        <p>
          Ball-by-ball data from <a href="https://cricsheet.org">Cricsheet</a>, made available under the{' '}
          <a href="https://opendatacommons.org/licenses/by/1-0/">Open Data Commons Attribution License</a>.
        </p>
        {meta && (
          <p>
            Includes matches up to {date(meta.latestMatch)}. Data refreshed {date(meta.updatedAt.slice(0, 10))}.{' '}
            <Link to="/about">How the numbers are counted</Link>
          </p>
        )}
      </div>
    </footer>
  );
}
