// Instructions for turning a cricket question into one DuckDB SQL query over the CricStats tables.
// The model only sees the schema and the question; the query runs in the visitor's browser.

export const SCHEMA = `
Tables (DuckDB). Ball-by-ball tables cover international matches from about 2001 and leagues from their first season.

competitions(competition_id, name, group_name, format, gender)
  competition_id values: 'test-m' Men's Tests, 'odi-m' Men's ODIs, 't20i-m' Men's T20Is, 'test-w' Women's Tests,
  'odi-w' Women's ODIs, 't20i-w' Women's T20Is, 'ipl' Indian Premier League, 'wpl' Women's Premier League,
  'bbl' Big Bash League, 'wbbl' Women's Big Bash, 'psl' Pakistan Super League, 'cpl' Caribbean Premier League,
  'sa20' SA20, 'ilt20' International League T20, 'mlc' Major League Cricket, 'hnd-m' / 'hnd-w' The Hundred.

matches(match_id, competition_id, match_type, gender, team_type, season, start_date DATE, end_date DATE, team1, team2,
  venue, city, event, event_stage, match_number, toss_winner, toss_decision, winner, result, is_tie, is_draw,
  is_no_result, player_of_match, balls_per_over)
  - season is text: '2024' for internationals, '2023/24' style for some leagues (IPL uses '2024'). For "in 2024" prefer year(start_date) = 2024.
  - event_stage 'Final' marks finals. result is human-readable text ("India won by 7 wickets").

innings(match_id, innings_no, batting_team, bowling_team, runs, wickets, legal_balls, overs DOUBLE, is_super_over,
  declared, forfeited, byes, legbyes, wides, noballs, penalty, target_runs, target_overs)

batting(match_id, innings_no, team, position, player_id, player, runs, balls, fours, sixes, not_out BOOLEAN,
  dismissal, dismissal_kind)   -- one row per batter per innings (scorecard line)
bowling(match_id, innings_no, team, player_id, player, balls, overs TEXT, maidens, runs, wickets, dots, wides, noballs)
  -- one row per bowler per innings; team = the bowling side; runs = runs conceded; wickets credited to the bowler

deliveries(match_id, innings_no, over_no, ball_in_over, legal_ball, batter_id, batter, bowler_id, bowler,
  non_striker_id, non_striker, runs_batter, runs_extras, runs_total, wides, noballs, byes, legbyes, penalty,
  non_boundary, is_wicket, wicket_kind, player_out_id, player_out, fielders)
  - over_no is 0-based (over_no 0 = 1st over; death overs in T20 = over_no >= 15; powerplay = over_no <= 5).
  - legal_ball is NULL for wides and no-balls. Balls faced = count where wides = 0. Balls bowled = count(legal_ball).
  - Runs conceded by bowler = runs_batter + wides + noballs. Boundaries: runs_batter IN (4, 6) AND NOT non_boundary.
  - Bowler wickets: wicket_kind IN ('bowled','caught','caught and bowled','lbw','stumped','hit wicket').
  - deliveries is large (~5.7M rows): prefer batting/bowling for totals; use deliveries only for phase/ball-level questions.

players(player_id, name, full_name, country, cricinfo_id, wikipedia_title)
  - batting.player / bowling.player / deliveries names are short scorecard names ("V Kohli", "JM Anderson").
    players.full_name holds full names ("Virat Kohli") when known. Display coalesce(p.full_name, b.player).
  - To find a named player, match both: (p.full_name ILIKE '%kohli%' OR b.player ILIKE '%kohli%').

careers(player_id, player, competition_id, source, wikipedia_as_of, matches, runs, batting_avg, hundreds, fifties,
  high_score, high_score_not_out, balls_bowled, wickets, bowling_avg, economy, five_wickets, ten_wickets,
  best_bowling, catches, stumpings)
  - COMPLETE international careers (all eras, e.g. Bradman, Tendulkar) for 'test-m','odi-m','t20i-m','test-w','odi-w','t20i-w'.
  - Use careers for all-time career totals in international cricket. player here is already the full name.
  - careers has no team column. For a country, JOIN players p USING (player_id) and filter p.country = 'India'.
    Wikipedia-based totals can include a few matches for composite sides (World XI, Asia XI).

history_matches(match_id, competition_id, start_date, team1, team2, venue, result, toss, umpires, player_of_match,
  cricinfo_id, wikipedia_article, has_full_scorecard)
history_innings(match_id, innings_no, batting_team, runs, wickets, overs TEXT, declared)
history_performances(match_id, innings_no, batting_team, kind, player, player_id, wikipedia_title, runs, balls, fours,
  sixes, not_out, dismissal, overs, maidens, runs_conceded, wickets, source)
  - International matches WITHOUT ball-by-ball data (mostly before 2002, back to 1877). Only innings totals and the
    top performers of each innings (kind = 'batting' or 'bowling'), so they are incomplete for player totals.
  - For team results, match records, highest/lowest totals or "all-time" team questions in international cricket,
    UNION the matches/innings tables with the history tables. The two never contain the same match.
`;

export const RULES = `
Rules:
- Return exactly one read-only DuckDB SELECT (WITH ... SELECT allowed). No DDL/DML, no PRAGMA, no file functions.
- Always exclude super overs when joining innings: NOT i.is_super_over.
- Group players by player_id, not by name. Show readable column names (player, team, matches, runs, wickets, average...).
- Order results so the answer is in the first row. LIMIT 10 unless the question asks for more (max 50).
- Averages: batting average = sum(runs) / nullif(dismissals, 0) where dismissals = count of innings with NOT not_out.
  Strike rate = 100.0 * runs / balls. Economy = 6.0 * runs / balls. Round rates to 2 decimals.
- batting, bowling and deliveries only cover ball-by-ball matches (men's internationals mostly from 2002, earlier
  greats are missing). Any career or all-time total in Tests/ODIs/T20Is with no date, venue, opponent or phase filter
  (most runs, wickets, hundreds, best average; overall or for a country) MUST come from careers.
  Use batting/bowling for seasons, years, venues, opponents or leagues.
- "T20I" alone means men's ('t20i-m') unless women are mentioned; same for Tests and ODIs.
- If the question is not about cricket data in these tables, or cannot be answered from them, set sql to null and explain why.
`;

export const EXAMPLES = [
  {
    q: 'Who scored the most T20I runs in 2024?',
    sql: `SELECT coalesce(any_value(p.full_name), any_value(b.player)) AS player, any_value(b.team) AS team,
  count(*) AS innings, sum(b.runs) AS runs, round(100.0 * sum(b.runs) / nullif(sum(b.balls), 0), 2) AS strike_rate
FROM batting b
JOIN matches m USING (match_id)
JOIN innings i ON i.match_id = b.match_id AND i.innings_no = b.innings_no
LEFT JOIN players p ON p.player_id = b.player_id
WHERE m.competition_id = 't20i-m' AND year(m.start_date) = 2024 AND NOT i.is_super_over
GROUP BY b.player_id
ORDER BY runs DESC
LIMIT 10`,
  },
  {
    q: 'Best economy in IPL death overs since 2020 (min 300 balls)',
    sql: `SELECT coalesce(any_value(p.full_name), any_value(d.bowler)) AS player,
  count(d.legal_ball) AS balls, sum(d.runs_batter + d.wides + d.noballs) AS runs,
  round(6.0 * sum(d.runs_batter + d.wides + d.noballs) / count(d.legal_ball), 2) AS economy
FROM deliveries d
JOIN matches m USING (match_id)
JOIN innings i ON i.match_id = d.match_id AND i.innings_no = d.innings_no
LEFT JOIN players p ON p.player_id = d.bowler_id
WHERE m.competition_id = 'ipl' AND year(m.start_date) >= 2020 AND d.over_no >= 15 AND NOT i.is_super_over
GROUP BY d.bowler_id
HAVING count(d.legal_ball) >= 300
ORDER BY economy
LIMIT 10`,
  },
  {
    q: 'Most Test hundreds of all time',
    sql: `SELECT player, matches, runs, hundreds, batting_avg
FROM careers
WHERE competition_id = 'test-m'
ORDER BY hundreds DESC, runs DESC
LIMIT 10`,
  },
  {
    q: "India's Test record at Lord's",
    sql: `WITH all_matches AS (
  SELECT start_date, team1, team2, venue, result FROM matches WHERE competition_id = 'test-m'
  UNION ALL
  SELECT start_date, team1, team2, venue, result FROM history_matches WHERE competition_id = 'test-m'
)
SELECT count(*) AS matches,
  count(*) FILTER (WHERE result ILIKE 'India won%') AS won,
  count(*) FILTER (WHERE result ILIKE '%won%' AND result NOT ILIKE 'India won%') AS lost,
  count(*) FILTER (WHERE result NOT ILIKE '%won%') AS drawn_or_other
FROM all_matches
WHERE 'India' IN (team1, team2) AND venue ILIKE '%Lord%'`,
  },
  {
    q: 'Lowest team totals in Test history',
    sql: `SELECT batting_team AS team, runs, start_date FROM (
  SELECT i.batting_team, i.runs, m.start_date FROM innings i JOIN matches m USING (match_id)
  WHERE m.competition_id = 'test-m' AND i.wickets = 10 AND NOT i.is_super_over
  UNION ALL
  SELECT h.batting_team, h.runs, hm.start_date FROM history_innings h JOIN history_matches hm USING (match_id)
  WHERE hm.competition_id = 'test-m' AND h.wickets = 10
)
ORDER BY runs
LIMIT 10`,
  },
  {
    q: 'How many sixes has Rohit Sharma hit in the IPL?',
    sql: `SELECT coalesce(any_value(p.full_name), any_value(b.player)) AS player, count(*) AS innings, sum(b.sixes) AS sixes, sum(b.runs) AS runs
FROM batting b
JOIN matches m USING (match_id)
LEFT JOIN players p ON p.player_id = b.player_id
WHERE m.competition_id = 'ipl' AND (p.full_name ILIKE '%rohit sharma%' OR b.player ILIKE '%RG Sharma%')
GROUP BY b.player_id
ORDER BY sixes DESC
LIMIT 5`,
  },
  // Examples below the first six are not shown as buttons; they only teach the model.
  {
    q: "Who has taken the most ODI wickets for India?",
    sql: `SELECT c.player, c.matches, c.wickets, c.bowling_avg, c.best_bowling
FROM careers c
JOIN players p USING (player_id)
WHERE c.competition_id = 'odi-m' AND p.country = 'India'
ORDER BY c.wickets DESC NULLS LAST
LIMIT 10`,
  },
];

export function systemPrompt() {
  const ex = EXAMPLES.map((e) => `Question: ${e.q}\nSQL:\n${e.sql}`).join('\n\n');
  return `You answer questions about cricket statistics by writing one DuckDB SQL query over the CricStats database.
${SCHEMA}
${RULES}
Examples:

${ex}`;
}
