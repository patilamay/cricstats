# CricStats Ask service

The **Ask** page lets visitors type questions like *"Who scored the most T20I runs in 2024?"*.

How it works:

1. The page sends the question to this small Cloudflare Worker.
2. The worker asks Claude (Anthropic API) to turn it into one read-only SQL query over the CricStats tables (`src/prompt.js` describes them).
3. The query runs **in the visitor's browser** with DuckDB-WASM, reading the Parquet files the site publishes under `/db/`.
4. The worker asks Claude for a one-sentence answer from the first rows of the result.

The worker never sees the data, and the API key never reaches the browser. Without the worker the Ask page still works for the example questions, which run their saved queries directly.

## One-time setup (about 10 minutes)

You need Node.js 20 or newer, an Anthropic API key and a free Cloudflare account.

1. **Create a Cloudflare account** at <https://dash.cloudflare.com/sign-up>. The free plan is enough (100,000 requests a day).
2. **Log in and deploy** from this folder (PowerShell or any terminal):

   ```sh
   cd worker
   npx wrangler login                        # opens the browser to approve
   npx wrangler secret put ANTHROPIC_API_KEY # paste the key when asked; it is stored encrypted at Cloudflare
   npx wrangler deploy
   ```

   The last command prints the worker's address, something like `https://cricstats-ask.<your-name>.workers.dev`. The first deploy may ask you to pick a `workers.dev` subdomain.
3. **Cap your spending.** In the Anthropic Console, under Settings → Limits, set a monthly spend limit. Each question makes two small calls to Claude Haiku, which typically costs a fraction of a cent.
4. **Point the site at the worker.** In GitHub, go to the repository, then Settings → Secrets and variables → Actions → **Variables** → New repository variable:
   - Name: `ASK_URL`
   - Value: the worker address from step 2, with no trailing slash
5. **Redeploy the site**: Actions → "Refresh data and deploy" → Run workflow. (It also runs every day on its own.) After that, the search box and the Ask page accept any question.

## Limits and safety

- **Who can call it.** Only the origins in `ALLOWED_ORIGINS` (`wrangler.toml`) are accepted: the live site and local dev servers.
- **Rate limit.** Each visitor (by IP) gets at most 16 requests a minute, which is about 8 questions. Change `limit` in `wrangler.toml`.
- **Question length.** Questions are capped at 300 characters.
- **Queries are read-only.** The returned SQL must be a single `SELECT`/`WITH`; anything else is rejected (`src/safe.js`). It runs in the visitor's browser against public data in any case.
- **Turning it off.** Delete the `ASK_URL` variable and redeploy, or run `npx wrangler delete` in this folder.

## Changing things

- **Model.** Edit `MODEL` in `wrangler.toml`, then `npx wrangler deploy`.
- **Teaching it new kinds of questions.** Add worked examples to `EXAMPLES` in `src/prompt.js`. The first six also appear as buttons on the Ask page, so check each query against the real data first.
- **Tests.** Run `npm test` from the repository root (the worker tests mock the Anthropic API).
- **Logs.** `npx wrangler tail` streams live requests and errors.

## Trying the Ask page locally

1. Download `cricstats-parquet.zip` from the repository's **data** release.
2. Unzip the `.parquet` files into `public/db/`.
3. Run `npm run dev`.

To use typed questions locally as well, run `npx wrangler dev` in `worker/` (put `ANTHROPIC_API_KEY=...` in `worker/.dev.vars`, which is git-ignored), then start the site with `VITE_ASK_URL=http://localhost:8787 npm run dev`.
