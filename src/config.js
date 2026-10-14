// URL of the Cloudflare Worker that turns questions into SQL (see worker/README.md).
// Set at build time with the VITE_ASK_URL environment variable (a GitHub Actions repository variable).
export const ASK_URL = import.meta.env.VITE_ASK_URL || '';
