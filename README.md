# CricStats

Career stats, leaderboards, records and scorecards for international cricket (men's and women's Tests, ODIs and T20Is) and the major franchise leagues, rebuilt every day from [Cricsheet](https://cricsheet.org) ball-by-ball data.

## How it works

There is no server or database. Once a day a GitHub Action:

1. downloads each competition's zip from Cricsheet,
2. computes every stat from the ball-by-ball records (`pipeline/`),
3. for international formats, adds complete careers: each player's totals from their Wikipedia infobox (as of the date it gives) plus every Cricsheet match since that date (`pipeline/wiki.js`, `pipeline/careers.js`),
4. adds historical internationals without ball-by-ball data (mostly before 2002) from Wikipedia's per-match summary boxes: innings totals, top performers, result, venue, and full scorecards where Wikipedia has them (`pipeline/matchbox.js`, `pipeline/history.js`),
5. writes the results as static JSON into `public/data/`, and the downloadable DuckDB/Parquet database,
6. builds the React site and publishes it to GitHub Pages, with the Parquet tables under `/db/`.

## Ask (questions in plain English)

The Ask page (`/ask`, also reached from the search box) answers questions like "Who scored the most T20I runs in 2024?". A small Cloudflare Worker (`worker/`) has Claude turn the question into SQL, and the query runs in the visitor's browser with DuckDB-WASM over the site's Parquet files. Setup and limits are in [worker/README.md](worker/README.md).

## Download the database

Every day the full dataset is published as the [`data` release](https://github.com/patilamay/cricstats/releases/tag/data):
`cricstats.duckdb.gz` (DuckDB; gunzip first) and `cricstats-parquet.zip` (one Parquet file per table, for Power BI, Fabric,
pandas or Spark). Tables: matches, innings, deliveries (ball by ball), batting, bowling, players, careers, and history_* for
older matches. Build it yourself with `pip install duckdb` then `npm run db` (writes `db/`).

If a download or test fails, the run stops and the previous version of the site stays live.

```
pipeline/
  competitions.js   which competitions are covered (add a league here)
  parse.js          one match -> scorecard; all the counting rules live here
  aggregate.js      scorecards -> career stats, records, team results, seasons
  leaders.js        home-page leaderboards and qualification rules
  infobox.js        parses career stats from Wikipedia's {{Infobox cricketer}}
  wiki.js           Wikidata + Wikipedia download (cached; only changed pages refetched)
  careers.js        merges Wikipedia totals with Cricsheet matches after their date
  report.js         prints a data-quality summary in the GitHub Actions run
  build.js          download, aggregate, write public/data
  test/             unit tests for the counting rules
  sample/           synthetic data generator for offline development
src/                React front end (Vite)
.github/workflows/deploy.yml   daily refresh and deploy
```

## Running it locally

Requires Node 22 or newer.

```bash
npm install
npm run data          # download real data from Cricsheet (a few minutes)
# or, offline:
npm run data:sample   # generate synthetic matches with fake teams and players
npm run dev           # open http://localhost:5173
npm test              # check the stats rules
```

## Adding a competition

Add an entry to `pipeline/competitions.js` with the zip name from [cricsheet.org/downloads](https://cricsheet.org/downloads/). It shows up everywhere on the next run.

## Counting rules

Balls faced include no-balls but not wides. Bowlers are charged runs off the bat, wides and no-balls, but not byes or leg-byes, and are credited with bowled, caught, lbw, stumped and hit-wicket dismissals. Retired hurt is not a dismissal. Super Overs appear on scorecards but are excluded from career figures. Coverage for older eras is incomplete, so some historical careers are partial.

## Data licence

Match data © Cricsheet, available under the [Open Data Commons Attribution License](https://opendatacommons.org/licenses/by/1-0/). Career totals for older matches come from Wikipedia, available under [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/). The site credits both in its footer and About page.
