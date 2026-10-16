// URL of the Cloudflare Worker that turns questions into SQL (see worker/README.md).
// Not a secret: the browser calls it directly. The VITE_ASK_URL build variable overrides it;
// set it to an empty value (or clear this default) to switch typed questions off.
export const ASK_URL = import.meta.env.VITE_ASK_URL ?? 'https://cricstats-ask.patilamay.workers.dev';

// Supabase project for sign-in and saved conversations (see supabase/README.md).
// Both values are public by design: the anon key only allows what the database's row-level
// security rules allow (each signed-in user can reach their own conversations, nothing else).
// While either is empty, sign-in is hidden and the site works exactly as before.
export const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL ?? 'https://puubaktguofxrvlrekji.supabase.co';
export const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY ?? 'sb_publishable_RGVho6jrI0k-EvqmiVi0sg_33uQCFDa';
