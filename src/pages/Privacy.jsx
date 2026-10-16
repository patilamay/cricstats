import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth.jsx';

export default function Privacy() {
  const { enabled, user, signIn, deleteAccount } = useAuth();
  const [confirm, setConfirm] = useState(false);
  const [status, setStatus] = useState(null);

  const doDelete = async () => {
    setStatus('Deleting…');
    try {
      await deleteAccount();
      setStatus('Your account and all your saved conversations have been deleted.');
      setConfirm(false);
    } catch (err) {
      setStatus(`Something went wrong: ${err.message}. Try again in a moment.`);
    }
  };

  return (
    <div className="page prose privacy-page">
      <h1>Privacy and your data</h1>
      <p>CricStats is a free hobby site. You can browse every page and ask questions without an account. Signing in is optional and only used to save your Ask conversations.</p>

      <h2>Without an account</h2>
      <ul>
        <li>Nothing about you is stored. There are no ads, no analytics and no tracking cookies.</li>
        <li>When you type a question on the <Link to="/ask">Ask</Link> page, the question and the first rows of its answer are sent to Anthropic's Claude model to work out the query and write the answer sentence. They are not stored by this site. Your internet address is used briefly to limit how many questions can be asked per minute.</li>
      </ul>

      {enabled && (
        <>
          <h2>If you sign in with Google</h2>
          <ul>
            <li>We store your name, email address and Google profile picture, so the site can show who is signed in.</li>
            <li>We store the conversations you have on the Ask page: your questions, the answers and the tables shown, until you delete them.</li>
            <li>Only you can see your conversations. They're kept in a Supabase database, protected so that each account can only read its own.</li>
            <li>We never see your Google password, and we don't use your email for anything else or share it with anyone.</li>
            <li>You can rename or delete any conversation from the Ask page, and delete your whole account below.</li>
          </ul>

          <h2>Delete your account</h2>
          {user ? (
            <>
              <p>This permanently deletes your account and every saved conversation. It can't be undone. You can still use the site as a guest, or sign in again later to start fresh.</p>
              {!confirm ? (
                <button type="button" className="btn danger" onClick={() => { setConfirm(true); setStatus(null); }}>Delete my account</button>
              ) : (
                <p className="confirm-row">
                  <span>Delete {user.email || 'your account'} and all conversations?</span>
                  <button type="button" className="btn danger" onClick={doDelete}>Yes, delete everything</button>
                  <button type="button" className="btn" onClick={() => setConfirm(false)}>Cancel</button>
                </p>
              )}
            </>
          ) : (
            <p>{status ? '' : 'You are not signed in. '}{!status && <button type="button" className="linkish" onClick={signIn}>Sign in</button>}{!status && ' to manage or delete your account.'}</p>
          )}
          {status && <p className="notice" role="status">{status}</p>}
        </>
      )}

      <h2>Contact</h2>
      <p>Questions or a data request: open an issue on the site's <a href="https://github.com/patilamay/cricstats/issues">GitHub page</a>.</p>
    </div>
  );
}
