#!/usr/bin/env python3
"""Builds the downloadable CricStats database from the CSVs written by build.js --export.

    python3 pipeline/make_db.py <export_dir> <out_dir>

Produces:
    <out_dir>/cricstats.duckdb        DuckDB database (tables + views)
    <out_dir>/parquet/<table>.parquet one Parquet file per table (Power BI, Fabric, pandas, Spark...)
"""
import os
import shutil
import sys
import time

import duckdb

TABLES = ["competitions", "matches", "innings", "deliveries", "batting", "bowling", "players", "careers", "history_matches", "history_innings", "history_performances"]

TYPES = {
    "matches": {"match_id": "VARCHAR", "start_date": "DATE", "end_date": "DATE", "season": "VARCHAR", "match_number": "VARCHAR"},
    "innings": {"match_id": "VARCHAR"},
    "deliveries": {"match_id": "VARCHAR"},
    "batting": {"match_id": "VARCHAR"},
    "bowling": {"match_id": "VARCHAR", "overs": "VARCHAR"},
    "players": {"player_id": "VARCHAR", "cricinfo_id": "VARCHAR"},
    "careers": {"player_id": "VARCHAR", "wikipedia_as_of": "DATE", "best_bowling": "VARCHAR"},
    "history_matches": {"match_id": "VARCHAR", "start_date": "DATE", "cricinfo_id": "VARCHAR"},
    "history_innings": {"match_id": "VARCHAR", "overs": "VARCHAR"},
    "history_performances": {"match_id": "VARCHAR", "player_id": "VARCHAR", "overs": "VARCHAR"},
}

VIEWS = {
    # Career batting/bowling per player per competition, computed from the ball-by-ball era.
    "batting_by_competition": """
        SELECT b.player_id, any_value(b.player) AS player, m.competition_id,
               count(DISTINCT b.match_id) AS matches, count(*) AS innings,
               sum(CASE WHEN b.not_out THEN 1 ELSE 0 END) AS not_outs,
               sum(b.runs) AS runs, max(b.runs) AS high_score, sum(b.balls) AS balls_faced,
               round(sum(b.runs) / nullif(count(*) - sum(CASE WHEN b.not_out THEN 1 ELSE 0 END), 0), 2) AS average,
               round(100.0 * sum(b.runs) / nullif(sum(b.balls), 0), 2) AS strike_rate,
               sum(CASE WHEN b.runs >= 100 THEN 1 ELSE 0 END) AS hundreds,
               sum(CASE WHEN b.runs BETWEEN 50 AND 99 THEN 1 ELSE 0 END) AS fifties,
               sum(b.fours) AS fours, sum(b.sixes) AS sixes
        FROM batting b
        JOIN matches m USING (match_id)
        JOIN innings i ON i.match_id = b.match_id AND i.innings_no = b.innings_no
        WHERE NOT i.is_super_over
        GROUP BY b.player_id, m.competition_id""",
    "bowling_by_competition": """
        SELECT w.player_id, any_value(w.player) AS player, m.competition_id,
               count(DISTINCT w.match_id) AS matches, sum(w.balls) AS balls, sum(w.maidens) AS maidens,
               sum(w.runs) AS runs, sum(w.wickets) AS wickets,
               round(sum(w.runs) / nullif(sum(w.wickets), 0), 2) AS average,
               round(6.0 * sum(w.runs) / nullif(sum(w.balls), 0), 2) AS economy,
               sum(CASE WHEN w.wickets >= 5 THEN 1 ELSE 0 END) AS five_wickets
        FROM bowling w
        JOIN matches m USING (match_id)
        JOIN innings i ON i.match_id = w.match_id AND i.innings_no = w.innings_no
        WHERE NOT i.is_super_over
        GROUP BY w.player_id, m.competition_id""",
}

README = """# CricStats database

Built {built} from Cricsheet ball-by-ball data (ODC-BY 1.0) and Wikipedia career totals (CC BY-SA 4.0).

## Tables
- competitions: the competitions covered
- matches: one row per match (teams, venue, toss, result, player of the match)
- innings: one row per innings (totals, extras, target, super over flag)
- deliveries: one row per ball, the full ball-by-ball record
- batting / bowling: scorecard lines per innings
- players: every player, with ESPNcricinfo ID and Wikipedia article where known
- careers: complete international careers (Wikipedia totals as of a date + Cricsheet matches since)
- history_matches / history_innings / history_performances: international matches without ball-by-ball
  data (mostly before 2002), from Wikipedia match summaries: every innings total, the top performers of
  each innings, and full scorecards for the few matches Wikipedia records in full

## Views
- batting_by_competition, bowling_by_competition: career figures from the ball-by-ball era

## Row counts
{counts}

## Example queries (DuckDB)
    -- Most Test runs, all-time
    SELECT player, matches, runs, batting_avg FROM careers
    WHERE competition_id = 'test-m' ORDER BY runs DESC LIMIT 10;

    -- Lowest Test totals ever, ball-by-ball era and earlier combined
    SELECT batting_team, runs, start_date FROM history_innings JOIN history_matches USING (match_id)
    WHERE competition_id = 'test-m' AND wickets = 10
    UNION ALL
    SELECT batting_team, runs, start_date FROM innings JOIN matches USING (match_id)
    WHERE competition_id = 'test-m' AND wickets = 10
    ORDER BY runs LIMIT 10;

    -- Most sixes in IPL history
    SELECT player, sum(sixes) AS sixes FROM batting JOIN matches USING (match_id)
    WHERE competition_id = 'ipl' GROUP BY player ORDER BY sixes DESC LIMIT 10;

    -- Death-over economy in T20Is (overs 16-20)
    SELECT bowler, count(*) FILTER (WHERE legal_ball IS NOT NULL) AS balls,
           round(6.0 * sum(runs_batter + wides + noballs) / count(*) FILTER (WHERE legal_ball IS NOT NULL), 2) AS econ
    FROM deliveries d JOIN matches m USING (match_id)
    WHERE m.competition_id = 't20i-m' AND d.over_no >= 15
    GROUP BY bowler HAVING balls >= 600 ORDER BY econ LIMIT 10;
"""


def main(export_dir, out_dir):
    t0 = time.time()
    os.makedirs(out_dir, exist_ok=True)
    db_path = os.path.join(out_dir, "cricstats.duckdb")
    pq_dir = os.path.join(out_dir, "parquet")
    for p in (db_path, db_path + ".wal"):
        if os.path.exists(p):
            os.remove(p)
    shutil.rmtree(pq_dir, ignore_errors=True)
    os.makedirs(pq_dir)

    con = duckdb.connect(db_path)
    counts = []
    for t in TABLES:
        src = os.path.join(export_dir, f"{t}.csv.gz")
        types = TYPES.get(t, {})
        type_sql = ", ".join(f"'{k}': '{v}'" for k, v in types.items())
        opts = f", types = {{{type_sql}}}" if types else ""
        con.execute(f"CREATE TABLE {t} AS SELECT * FROM read_csv('{src}', header = true, auto_detect = true, sample_size = -1{opts})")
        n = con.execute(f"SELECT count(*) FROM {t}").fetchone()[0]
        counts.append(f"- {t}: {n:,}")
        con.execute(f"COPY {t} TO '{os.path.join(pq_dir, t + '.parquet')}' (FORMAT parquet, COMPRESSION zstd)")
        print(f"{t}: {n:,} rows", flush=True)

    for name, sql in VIEWS.items():
        con.execute(f"CREATE VIEW {name} AS {sql}")
    con.execute("CHECKPOINT")
    con.close()

    with open(os.path.join(out_dir, "README.md"), "w") as f:
        f.write(README.format(built=time.strftime("%Y-%m-%d"), counts="\n".join(counts)))
    print(f"done in {time.time() - t0:.0f}s -> {out_dir}")


if __name__ == "__main__":
    if len(sys.argv) != 3:
        sys.exit(__doc__)
    main(sys.argv[1], sys.argv[2])
