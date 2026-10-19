import { Link } from 'react-router-dom';
import { useMeta } from '../App.jsx';
import { date } from '../format.js';

// One line: sources with their licences (short form; full credits on About), freshness, links.
export default function Footer() {
  const meta = useMeta();
  return (
    <footer className="site-footer">
      <div className="footer-inner">
        <p className="footer-line">
          <span>
            Data: <a href="https://cricsheet.org">Cricsheet</a> (<a href="https://opendatacommons.org/licenses/by/1-0/">ODC-BY</a>)
            {meta && meta.wiki && <> and <a href="https://en.wikipedia.org/">Wikipedia</a> (<a href="https://creativecommons.org/licenses/by-sa/4.0/">CC BY-SA</a>)</>}
          </span>
          {meta && <span title={`Includes matches up to ${date(meta.latestMatch)}`}>Updated {date(meta.updatedAt.slice(0, 10))}</span>}
          <span className="footer-links"><Link to="/about">About &amp; credits</Link><Link to="/privacy">Privacy</Link></span>
        </p>
      </div>
    </footer>
  );
}
