"""Builds public/data/facts.json: the rotating "did you know" facts on the home page.

Run after make_db.py:  python3 pipeline/facts.py <parquet dir> <site data dir>

Every fact is computed from the database, so it's as accurate as the rest of the site. Only kinds
of fact the data covers completely are used: big individual performances (Wikipedia's match
summaries always list each innings' top scorers and bowlers), complete career totals, and recent
Cricsheet matches. Win/loss counts between teams are avoided because older match coverage has gaps.

Output:
  { generated, facts: [Fact], onThisDay: { "MM-DD": [Fact] } }
  Fact = { id, kind, tag, text, to, link, ask }
"""
import datetime as dt
import json
import os
import sys

import duckdb

PARQUET, OUT = sys.argv[1], sys.argv[2]
TABLES = ['matches', 'innings', 'batting', 'bowling', 'careers', 'history_matches', 'history_innings',
          'history_performances', 'players', 'competitions']
FULL = ('India', 'Australia', 'England', 'South Africa', 'New Zealand', 'Pakistan', 'Sri Lanka', 'West Indies',
        'Bangladesh', 'Afghanistan', 'Zimbabwe', 'Ireland')
INTL = ('test-m', 'odi-m', 't20i-m', 'test-w', 'odi-w', 't20i-w')
FMT = {'test-m': 'Test', 'odi-m': 'ODI', 't20i-m': 'T20I', 'test-w': "women's Test", 'odi-w': "women's ODI", 't20i-w': "women's T20I"}
FMT_PL = {'test-m': 'Tests', 'odi-m': 'ODIs', 't20i-m': 'T20Is', 'test-w': "women's Tests", 'odi-w': "women's ODIs", 't20i-w': "women's T20Is"}

db = duckdb.connect()
for t in TABLES:
    db.execute(f"CREATE VIEW {t} AS SELECT * FROM read_parquet('{os.path.join(PARQUET, t + '.parquet')}')")

# Links only to pages that exist.
try:
    with open(os.path.join(OUT, 'players', 'index.json')) as f:
        PLAYER_PAGES = {row[0] for row in json.load(f)}
except FileNotFoundError:
    PLAYER_PAGES = set()
MATCH_PAGES = {r[0] for r in db.execute('SELECT match_id FROM matches').fetchall()}
COMP_NAMES = dict(db.execute('SELECT competition_id, name FROM competitions').fetchall())


def rows(sql, *params):
    cur = db.execute(sql, params)
    cols = [d[0] for d in cur.description]
    return [dict(zip(cols, r)) for r in cur.fetchall()]


def num(n):
    return f'{int(n):,}'


def ordinal(n):
    return f"{n}{'th' if 11 <= n % 100 <= 13 else {1: 'st', 2: 'nd', 3: 'rd'}.get(n % 10, 'th')}"


def nth(rank):
    return 'the' if rank == 1 else f'the {ordinal(rank)}'


def city_of(venue):
    if not venue:
        return None
    parts = [p.strip() for p in venue.split(',')]
    return parts[-1] if len(parts) > 1 else parts[0]


def player_link(pid, name):
    if pid in PLAYER_PAGES:
        return {'to': f'/player/{pid}', 'link': f'See {name}'}
    return None


def fact(kind, tag, text, ask, link=None, fallback=None, key=None):
    lk = link or fallback or {}
    return {'id': f'{kind}:{key or text[:60]}', 'kind': kind, 'tag': tag, 'text': text,
            'to': lk.get('to'), 'link': lk.get('link'), 'ask': ask}


def records_link(comp):
    return {'to': f'/stats/{comp}/records', 'link': f'All {FMT_PL.get(comp, COMP_NAMES.get(comp, comp))} records'}


# ---------------------------------------------------------------------------------------------
# Every big international innings and spell, from both sources, with dates and opponents.
db.execute("""
CREATE TEMP TABLE perf AS
WITH cs AS (
  SELECT m.match_id, m.competition_id AS comp, m.start_date, m.end_date, m.venue, m.city, i.innings_no,
         b.player_id, coalesce(p.full_name, b.player) AS name, b.team,
         CASE WHEN b.team = m.team1 THEN m.team2 ELSE m.team1 END AS opp,
         'bat' AS kind, b.runs, b.balls, b.not_out, NULL::INT AS wkts, NULL::INT AS conceded
  FROM batting b JOIN matches m USING (match_id)
  JOIN innings i ON i.match_id = b.match_id AND i.innings_no = b.innings_no
  LEFT JOIN players p ON p.player_id = b.player_id
  WHERE m.competition_id IN {intl} AND NOT i.is_super_over
  UNION ALL
  SELECT m.match_id, m.competition_id, m.start_date, m.end_date, m.venue, m.city, i.innings_no,
         w.player_id, coalesce(p.full_name, w.player), w.team,
         CASE WHEN w.team = m.team1 THEN m.team2 ELSE m.team1 END,
         'bowl', NULL, w.balls, NULL, w.wickets, w.runs
  FROM bowling w JOIN matches m USING (match_id)
  JOIN innings i ON i.match_id = w.match_id AND i.innings_no = w.innings_no
  LEFT JOIN players p ON p.player_id = w.player_id
  WHERE m.competition_id IN {intl} AND NOT i.is_super_over
), hs AS (
  SELECT h.match_id, m.competition_id, m.start_date, NULL::DATE, m.venue, NULL, h.innings_no,
         h.player_id, coalesce(p.full_name, h.wikipedia_title, h.player),
         CASE WHEN h.kind = 'batting' THEN h.batting_team
              ELSE CASE WHEN h.batting_team = m.team1 THEN m.team2 ELSE m.team1 END END,
         CASE WHEN h.kind = 'batting' THEN CASE WHEN h.batting_team = m.team1 THEN m.team2 ELSE m.team1 END
              ELSE h.batting_team END,
         CASE WHEN h.kind = 'batting' THEN 'bat' ELSE 'bowl' END,
         h.runs, h.balls, coalesce(h.not_out, false), h.wickets, h.runs_conceded
  FROM history_performances h JOIN history_matches m USING (match_id)
  LEFT JOIN players p ON p.player_id = h.player_id
  WHERE m.competition_id IN {intl}
)
SELECT * FROM cs UNION ALL SELECT * FROM hs
""".format(intl=INTL))

# Rank of each score / spell in its format (1 = best ever).
db.execute("""
CREATE TEMP TABLE ranked AS
SELECT *,
  CASE WHEN kind = 'bat' THEN rank() OVER (PARTITION BY comp, kind ORDER BY runs DESC) END bat_rank,
  CASE WHEN kind = 'bowl' THEN rank() OVER (PARTITION BY comp, kind ORDER BY wkts DESC, conceded ASC) END bowl_rank
FROM perf
WHERE (kind = 'bat' AND runs IS NOT NULL) OR (kind = 'bowl' AND wkts IS NOT NULL)
""")


def perf_text(r, lead):
    """'Anil Kumble took 10/74 for India against Pakistan in Delhi'."""
    if r.get('city'):
        where = f" in {r['city']}"
    elif r.get('venue') and ',' in r['venue']:
        where = f" in {city_of(r['venue'])}"
    elif r.get('venue'):
        where = f" at {r['venue']}"
    else:
        where = ''
    if r['kind'] == 'bat':
        star = '*' if r['not_out'] else ''
        balls = f" off {r['balls']} balls" if r.get('balls') and r['comp'] not in ('test-m', 'test-w') else ''
        what = f"{r['name']} made {r['runs']}{star}{balls}"
    else:
        what = f"{r['name']} took {r['wkts']}/{r['conceded']}" if r.get('conceded') is not None else f"{r['name']} took {r['wkts']} wickets"
    return f"{lead}{what} for {r['team']} against {r['opp']}{where}"


def rank_note(r):
    rank = r['bat_rank'] if r['kind'] == 'bat' else r['bowl_rank']
    if rank is None or rank > 10:
        return ''
    best = 'score' if r['kind'] == 'bat' else 'figures'
    if rank == 1:
        return f" — still the best {best} in {FMT_PL[r['comp']]}" if r['kind'] == 'bowl' else f" — still the highest score in {FMT_PL[r['comp']]}"
    return f" — {nth(rank)}-{'highest score' if r['kind'] == 'bat' else 'best figures'} in {FMT_PL[r['comp']]}"


def perf_link(r):
    if r['match_id'] in MATCH_PAGES:
        return {'to': f"/match/{r['match_id']}", 'link': 'See the scorecard'}
    return player_link(r['player_id'], r['name']) or records_link(r['comp'])


facts = []

# 1. Last few days: the standout performance of the most recent matches (any competition).
latest = db.execute('SELECT max(start_date) FROM matches').fetchone()[0]
recent = rows("""
WITH b AS (
  SELECT m.match_id, m.competition_id AS comp, m.start_date, m.venue, m.city, coalesce(p.full_name, b.player) AS name, b.player_id,
         b.team, CASE WHEN b.team = m.team1 THEN m.team2 ELSE m.team1 END AS opp, 'bat' AS kind,
         b.runs, b.balls, b.not_out, NULL::INT AS wkts, NULL::INT AS conceded,
         b.runs * 1.0 / 100 AS score
  FROM batting b JOIN matches m USING (match_id) LEFT JOIN players p ON p.player_id = b.player_id
  WHERE m.start_date >= ? - INTERVAL 3 DAY AND b.runs >= 50
  UNION ALL
  SELECT m.match_id, m.competition_id, m.start_date, m.venue, m.city, coalesce(p.full_name, w.player), w.player_id,
         w.team, CASE WHEN w.team = m.team1 THEN m.team2 ELSE m.team1 END, 'bowl',
         NULL, w.balls, NULL, w.wickets, w.runs,
         w.wickets / 4.0 - w.runs / 400.0
  FROM bowling w JOIN matches m USING (match_id) LEFT JOIN players p ON p.player_id = w.player_id
  WHERE m.start_date >= ? - INTERVAL 3 DAY AND w.wickets >= 4
)
SELECT * FROM b
ORDER BY score * CASE WHEN team IN {full} OR opp IN {full} OR comp NOT IN {intl} THEN 2 ELSE 1 END DESC
LIMIT 6
""".format(full=FULL, intl=INTL), latest, latest)
for r in recent:
    r['bat_rank'] = r['bowl_rank'] = None
    if r['comp'] in INTL:
        col = 'bat_rank' if r['kind'] == 'bat' else 'bowl_rank'
        hit = db.execute(f"SELECT {col} FROM ranked WHERE match_id = ? AND player_id = ? AND kind = ? ORDER BY {col} LIMIT 1",
                         [r['match_id'], r['player_id'], r['kind']]).fetchone()
        if hit:
            r[col] = hit[0]
    when = f"On {r['start_date'].strftime('%a %-d %b')}"
    comp_name = COMP_NAMES.get(r['comp'], r['comp'])
    text = perf_text(r, f'{when}, ') + f" ({comp_name})" + rank_note(r) + '.'
    ask = f"Highest individual scores in {comp_name}" if r['kind'] == 'bat' else f"Best bowling figures in {comp_name}"
    facts.append(fact('recent', 'Latest', text, ask, perf_link(r), key=f"{r['match_id']}:{r['player_id']}:{r['kind']}"))

# 2. Records: the all-time top of each international format.
for comp in INTL:
    for kind, col, label in (('bat', 'bat_rank', 'highest score'), ('bowl', 'bowl_rank', 'best figures')):
        top = rows(f"SELECT * FROM ranked WHERE comp = ? AND kind = ? AND {col} <= 2 ORDER BY {col}, start_date LIMIT 2", comp, kind)
        if not top:
            continue
        r = top[0]
        what = f"{r['runs']}{'*' if r['not_out'] else ''}" if kind == 'bat' else f"{r['wkts']}/{r['conceded']}"
        text = f"The {label} in {FMT_PL[comp]} {'are' if kind == 'bowl' else 'is'} {what}, by {r['name']} for {r['team']} against {r['opp']} in {r['start_date'].year}."
        if len(top) > 1:
            s = top[1]
            nxt = f"{s['runs']}{'*' if s['not_out'] else ''}" if kind == 'bat' else f"{s['wkts']}/{s['conceded']}"
            text = text[:-1] + f". Next best: {s['name']}'s {nxt}."
        ask = f"{'Highest individual scores' if kind == 'bat' else 'Best bowling figures in an innings'} in {FMT_PL[comp]}"
        facts.append(fact('record', 'Record', text, ask, player_link(r['player_id'], r['name']), records_link(comp), key=f'{comp}:{kind}'))

# Lowest team totals (complete: every innings total is in either source).
for comp in ('test-m', 'odi-m', 't20i-m'):
    low = rows("""
      WITH t AS (
        SELECT m.start_date, i.batting_team AS team, CASE WHEN i.batting_team = m.team1 THEN m.team2 ELSE m.team1 END AS opp, i.runs
        FROM innings i JOIN matches m USING (match_id)
        WHERE m.competition_id = ? AND NOT i.is_super_over AND NOT i.declared AND NOT i.forfeited AND i.wickets = 10
        UNION ALL
        SELECT m.start_date, i.batting_team, CASE WHEN i.batting_team = m.team1 THEN m.team2 ELSE m.team1 END, i.runs
        FROM history_innings i JOIN history_matches m USING (match_id)
        WHERE m.competition_id = ? AND i.wickets = 10 AND NOT coalesce(i.declared, false)
      ) SELECT * FROM t ORDER BY runs, start_date LIMIT 1""", comp, comp)
    if low:
        r = low[0]
        facts.append(fact('record', 'Record', f"The lowest all-out total in {FMT_PL[comp]} is {r['runs']}, by {r['team']} against {r['opp']} in {r['start_date'].year}.",
                          f"Lowest team totals in {FMT_PL[comp]}", records_link(comp), key=f'{comp}:low'))

# 3. Careers: leaders, and active players closing in on milestones or records.
active = {(r['player_id'], r['comp']) for r in rows("""
  SELECT DISTINCT b.player_id, m.competition_id AS comp FROM batting b JOIN matches m USING (match_id)
  WHERE m.start_date >= ? - INTERVAL 300 DAY
  UNION SELECT DISTINCT w.player_id, m.competition_id FROM bowling w JOIN matches m USING (match_id)
  WHERE m.start_date >= ? - INTERVAL 300 DAY""", latest, latest)}

for comp in INTL:
    for stat, word, step, near in (('runs', 'runs', 1000, 0.08), ('wickets', 'wickets', 50, 0.08)):
        lead = rows(f"SELECT player_id, player, matches, {stat} v FROM careers WHERE competition_id = ? AND {stat} IS NOT NULL ORDER BY {stat} DESC LIMIT 10", comp)
        if not lead:
            continue
        top = lead[0]
        facts.append(fact('career', 'Career', f"{top['player']} has the most {FMT[comp]} {word}: {num(top['v'])} in {top['matches']} matches.",
                          f"Most {word} in {FMT_PL[comp]}", player_link(top['player_id'], top['player']), records_link(comp), key=f'{comp}:{stat}:top'))
        # Active players chasing the record (within 15%).
        for r in lead[1:]:
            if (r['player_id'], comp) in active and r['v'] >= top['v'] * 0.85:
                gap = top['v'] - r['v'] + 1
                facts.append(fact('milestone', 'Chasing a record',
                                  f"{r['player']} needs {num(gap)} more {FMT[comp]} {word if gap != 1 else word[:-1]} to pass {top['player']}'s record of {num(top['v'])}.",
                                  f"{r['player']} {FMT[comp]} career {word}", player_link(r['player_id'], r['player']), key=f'{comp}:{stat}:{r["player_id"]}:chase'))
        # Active players near a round number.
        for r in rows(f"SELECT player_id, player, {stat} v FROM careers WHERE competition_id = ? AND {stat} >= ? ORDER BY {stat} DESC LIMIT 200", comp, step):
            if (r['player_id'], comp) not in active:
                continue
            target = (r['v'] // step + 1) * step
            gap = target - r['v']
            if gap <= max(step * near, 1) and target >= step * 2:
                facts.append(fact('milestone', 'Milestone watch',
                                  f"{r['player']} is {num(gap)} {word if gap != 1 else word[:-1]} away from {num(target)} {FMT[comp]} {word}.",
                                  f"{r['player']} {FMT[comp]} career", player_link(r['player_id'], r['player']), key=f'{comp}:{stat}:{r["player_id"]}:{target}'))

# 4. Oddities that the career data proves.
for comp in ('test-m', 'odi-m'):
    r = rows("SELECT player_id, player, matches, runs FROM careers WHERE competition_id = ? AND hundreds = 0 ORDER BY runs DESC NULLS LAST LIMIT 1", comp)
    if r:
        r = r[0]
        facts.append(fact('oddity', 'Did you know?', f"{r['player']} made {num(r['runs'])} {FMT[comp]} runs without ever scoring a hundred — the most by anyone.",
                          f"Most {FMT[comp]} runs without a hundred", player_link(r['player_id'], r['player']), key=f'{comp}:no100'))
r = rows("SELECT player_id, player, wickets, matches FROM careers WHERE competition_id = 'test-m' AND five_wickets = 0 ORDER BY wickets DESC NULLS LAST LIMIT 1")
if r:
    r = r[0]
    facts.append(fact('oddity', 'Did you know?', f"{r['player']} took {r['wickets']} Test wickets without a single five-wicket haul — the most by anyone.",
                      'Most Test wickets without a five-wicket haul', player_link(r['player_id'], r['player']), key='test:no5'))
r = rows("""SELECT b.player_id, coalesce(any_value(p.full_name), any_value(b.player)) AS name, sum(b.runs) AS runs,
              round(100.0 * sum(b.runs) / sum(b.balls), 1) AS sr
            FROM batting b JOIN matches m USING (match_id) LEFT JOIN players p ON p.player_id = b.player_id
            WHERE m.competition_id = 't20i-m' GROUP BY b.player_id HAVING sum(b.runs) >= 1500 ORDER BY sr DESC LIMIT 1""")
if r:
    r = r[0]
    facts.append(fact('oddity', 'Did you know?', f"Among men with 1,500+ T20I runs, {r['name']} scores fastest: a strike rate of {r['sr']}.",
                      'Best T20I strike rate, minimum 1,500 runs', player_link(r['player_id'], r['name']), key='t20i:sr'))

# 5. On this day: the biggest performances, keyed by every calendar day the match was played.
thresholds = {'test-m': (200, 8), 'odi-m': (150, 6), 't20i-m': (100, 5), 'test-w': (150, 7), 'odi-w': (130, 6), 't20i-w': (90, 5)}
big = []
for comp, (runs, wkts) in thresholds.items():
    big += rows("""SELECT * FROM ranked WHERE comp = ? AND start_date IS NOT NULL
                   AND ((kind = 'bat' AND runs >= ?) OR (kind = 'bowl' AND wkts >= ?))""", comp, runs, wkts)
on_this_day = {}
for r in big:
    rank = r['bat_rank'] if r['kind'] == 'bat' else r['bowl_rank']
    test = r['comp'] in ('test-m', 'test-w')
    start = r['start_date']
    end = r['end_date'] or (start + dt.timedelta(days=4 if test else 0))
    end = min(end, start + dt.timedelta(days=5))
    lead = f"This week in {start.year}, " if test else f"On this day in {start.year}, "
    text = perf_text(r, lead) + rank_note(r) + '.'
    ask = f"Highest individual scores in {FMT_PL[r['comp']]}" if r['kind'] == 'bat' else f"Best bowling figures in {FMT_PL[r['comp']]}"
    f = fact('onthisday', 'On this day', text, ask, perf_link(r), key=f"{r['match_id']}:{r['player_id']}:{r['kind']}")
    f['_rank'] = rank
    d = start
    while d <= end:
        on_this_day.setdefault(d.strftime('%m-%d'), []).append(f)
        d += dt.timedelta(days=1)
for k, lst in on_this_day.items():
    lst.sort(key=lambda f: f['_rank'])
    seen, keep = set(), []
    for f in lst:
        if f['id'] not in seen:
            seen.add(f['id'])
            keep.append({x: y for x, y in f.items() if x != '_rank'})
    on_this_day[k] = keep[:4]

# Only the coming fortnight is needed: the data is rebuilt every night.
today = dt.date.today()
window = {(today + dt.timedelta(days=d)).strftime('%m-%d') for d in range(-2, 15)}
on_this_day = {k: v for k, v in on_this_day.items() if k in window}

# De-duplicate and write.
uniq = {}
for f in facts:
    uniq.setdefault(f['id'], f)
out = {'generated': dt.date.today().isoformat(), 'latestMatch': latest.isoformat(), 'facts': list(uniq.values()), 'onThisDay': dict(sorted(on_this_day.items()))}
os.makedirs(OUT, exist_ok=True)
with open(os.path.join(OUT, 'facts.json'), 'w') as fh:
    json.dump(out, fh, ensure_ascii=False, separators=(',', ':'))
print(f"facts.json: {len(out['facts'])} facts, on-this-day for {len(on_this_day)} days")
