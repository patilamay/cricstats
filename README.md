# CricStats

Career stats, leaderboards, records and scorecards for international cricket (men's and women's Tests, ODIs and T20Is) and the major franchise leagues, rebuilt every day from [Cricsheet](https://cricsheet.org) ball-by-ball data.

## How it works

There is no server or database. Once a day a GitHub Action:

1. downloads each competition's zip from Cricsheet,
2. computes every stat from the ball-by-ball records (`pipeline/`),
3. writes the results as static JSON into `public/data/`,
4. builds the React site and publishes it to GitHub Pages.

If a download or test fails, the run stops and the previous version of the site stays live.

```
pipeline/
  competitions.js   which competitions are covered (add a league here)
  parse.js          one match -> scorecard; all the counting rules live here
  aggregate.js      scorecards -> career stats, records, team results, seasons
  leaders.js        home-page leaderboards and qualification rules
  build.js          download, aggregate, write public/data
  test/             unit tests for the counting rules
  sample/           synthetic data generator for offline development
src/                React front end (Vite)
.github/workflows/deploy.yml   daily refresh and deploy
```

## Running it locally

Requires Node 20 or newer.

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

Match data © Cricsheet, available under the [Open Data Commons Attribution License](https://opendatacommons.org/licenses/by/1-0/). The site credits Cricsheet in its footer and About page, as the licence requires.
