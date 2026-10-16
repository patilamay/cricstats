# Notes: things to come back to

Ideas and decisions parked for later. Newest at the top of each section.

## Ask page
- **Loading animations: polish.** They work and are themed (bowling, batting, fielding, stadium),
  but could be smoother: proper run-up and delivery stride for the bowler, follow-through on the
  batter's drive, a wicketkeeper scene, team/player-specific scenes ("teams", "players" themes),
  and a little crowd movement in the stadium. (`src/components/PitchLoader.jsx`, end of `styles.css`)
- **Player photos in Ask answer tables.** Answers carry names but not player ids; the query would
  need to return `player_id` so the table can show a photo next to the name.
- The suggested question "India's Test record at Lord's" is affected by gaps in historical
  results (see Data below); swap it or fix the gaps.

## Data
- **Depending on Cricsheet and Wikipedia.** Safeguards to add:
  - sanity checks before publishing (totals mustn't drop sharply, record holders mustn't vanish),
    and an alert when they fail instead of publishing;
  - keep a snapshot of the raw downloads (in the release) so a bad day can be rolled back;
  - source "adapters" so another source can replace one that disappears;
  - a "known gaps" note on the About page.
- **Historical results gaps:** about 334 of ~361 Ashes Tests have results, so win/loss facts are avoided.
- **Eoin Morgan's team** shows "Ireland, Kolkata Knight Riders" rather than England first.
- **Player photos** come from Wikidata's "image" (P18) on Wikimedia Commons; players without one show
  initials. Could add a manual override list for wrong or missing photos.

## Brand and site
- Logo: tweak the bails in the "Rising stumps" mark.
- Custom domain (instead of patilamay.github.io/cricstats).
- Licence for the code (MIT?) — undecided.

## Accounts
- Sign in with Apple (Google only for now).
