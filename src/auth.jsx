// Sign-in with Google through Supabase Auth. The Supabase client is loaded after the page renders,
// so visitors who never sign in don't wait for it. Guests can use everything except saving.
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { SUPABASE_ANON_KEY, SUPABASE_URL } from './config.js';

export const authEnabled = !!(SUPABASE_URL && SUPABASE_ANON_KEY);

let clientPromise = null;
export function getClient() {
  if (!authEnabled) return Promise.resolve(null);
  if (!clientPromise) {
    clientPromise = import('@supabase/supabase-js').then(({ createClient }) => createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { flowType: 'pkce', persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    }));
  }
  return clientPromise;
}

const AuthContext = createContext({ enabled: false, ready: true, user: null });
export const useAuth = () => useContext(AuthContext);

// Kept across the Google redirect so a guest's conversation can be saved once they're signed in.
export const PENDING_KEY = 'cricstats.pendingConversation';

function profile(u) {
  if (!u) return null;
  const m = u.user_metadata || {};
  return { id: u.id, email: u.email, name: m.full_name || m.name || u.email, avatar: m.avatar_url || m.picture || null };
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(!authEnabled);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!authEnabled) return undefined;
    let sub = null;
    let alive = true;
    getClient().then(async (sb) => {
      const { data: { session } } = await sb.auth.getSession();
      if (!alive) return;
      setUser(profile(session && session.user));
      setReady(true);
      ({ data: { subscription: sub } } = sb.auth.onAuthStateChange((_event, s) => setUser(profile(s && s.user))));
      // Tidy the address bar after the Google redirect (?code=...).
      const url = new URL(location.href);
      if (url.searchParams.has('code') || url.searchParams.has('error_description')) {
        if (url.searchParams.has('error_description')) setError(url.searchParams.get('error_description'));
        ['code', 'error', 'error_code', 'error_description', 'state'].forEach((k) => url.searchParams.delete(k));
        history.replaceState(history.state, '', url.pathname + url.search + url.hash);
      }
    }).catch(() => { if (alive) { setReady(true); setError('Sign-in is unavailable right now.'); } });
    return () => { alive = false; if (sub) sub.unsubscribe(); };
  }, []);

  const signIn = useCallback(async () => {
    const sb = await getClient();
    // Come back to the same page after Google.
    const back = location.origin + location.pathname + location.search;
    const { error: e } = await sb.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: back } });
    if (e) setError(e.message);
  }, []);

  const signOut = useCallback(async () => {
    const sb = await getClient();
    await sb.auth.signOut();
    setUser(null);
  }, []);

  const deleteAccount = useCallback(async () => {
    const sb = await getClient();
    const { error: e } = await sb.rpc('delete_my_account');
    if (e) throw new Error(e.message);
    await sb.auth.signOut();
    setUser(null);
  }, []);

  const value = useMemo(() => ({ enabled: authEnabled, ready, user, error, signIn, signOut, deleteAccount }), [ready, user, error, signIn, signOut, deleteAccount]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
