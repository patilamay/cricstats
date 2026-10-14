import { Link } from 'react-router-dom';

export default function NotFound() {
  return (
    <div className="page">
      <h1>Page not found</h1>
      <p>There's nothing at this address. Try the <Link to="/">home page</Link> or search for a player above.</p>
    </div>
  );
}
