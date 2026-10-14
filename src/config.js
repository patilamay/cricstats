// URL of the Cloudflare Worker that turns questions into SQL (see worker/README.md).
// Not a secret: the browser calls it directly. The VITE_ASK_URL build variable overrides it;
// set it to an empty value (or clear this default) to switch typed questions off.
export const ASK_URL = import.meta.env.VITE_ASK_URL ?? 'https://cricstats-ask.patilamay.workers.dev';
