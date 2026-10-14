// Writes every match as relational rows (gzipped CSV) for the downloadable database.
// pipeline/make_db.py loads these into DuckDB and Parquet.
//
// Tables: competitions, matches, innings, deliveries, batting, bowling, players, careers

import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { once } from 'node:events';
import { fullInnings } from './history.js';

const COLUMNS = {
  competitions: ['competition_id', 'name', 'group_name', 'format', 'gender'],
  matches: ['match_id', 'competition_id', 'match_type', 'gender', 'team_type', 'season', 'start_date', 'end_date', 'team1', 'team2', 'venue', 'city', 'event', 'event_stage', 'match_number', 'toss_winner', 'toss_decision', 'winner', 'result', 'is_tie', 'is_draw', 'is_no_result', 'player_of_match', 'balls_per_over'],
  innings: ['match_id', 'innings_no', 'batting_team', 'bowling_team', 'runs', 'wickets', 'legal_balls', 'overs', 'is_super_over', 'declared', 'forfeited', 'byes', 'legbyes', 'wides', 'noballs', 'penalty', 'target_runs', 'target_overs'],
  deliveries: ['match_id', 'innings_no', 'over_no', 'ball_in_over', 'legal_ball', 'batter_id', 'batter', 'bowler_id', 'bowler', 'non_striker_id', 'non_striker', 'runs_batter', 'runs_extras', 'runs_total', 'wides', 'noballs', 'byes', 'legbyes', 'penalty', 'non_boundary', 'is_wicket', 'wicket_kind', 'player_out_id', 'player_out', 'fielders'],
  batting: ['match_id', 'innings_no', 'team', 'position', 'player_id', 'player', 'runs', 'balls', 'fours', 'sixes', 'not_out', 'dismissal', 'dismissal_kind'],
  bowling: ['match_id', 'innings_no', 'team', 'player_id', 'player', 'balls', 'overs', 'maidens', 'runs', 'wickets', 'dots', 'wides', 'noballs'],
  players: ['player_id', 'name', 'full_name', 'country', 'cricinfo_id', 'wikipedia_title'],
  history_matches: ['match_id', 'competition_id', 'start_date', 'team1', 'team2', 'venue', 'result', 'toss', 'umpires', 'player_of_match', 'cricinfo_id', 'wikipedia_article', 'has_full_scorecard'],
  history_innings: ['match_id', 'innings_no', 'batting_team', 'runs', 'wickets', 'overs', 'declared'],
  history_performances: ['match_id', 'innings_no', 'batting_team', 'kind', 'player', 'player_id', 'wikipedia_title', 'runs', 'balls', 'fours', 'sixes', 'not_out', 'dismissal', 'overs', 'maidens', 'runs_conceded', 'wickets', 'source'],
  careers: ['player_id', 'player', 'competition_id', 'source', 'wikipedia_as_of', 'matches', 'runs', 'batting_avg', 'hundreds', 'fifties', 'high_score', 'high_score_not_out', 'balls_bowled', 'wickets', 'bowling_avg', 'economy', 'five_wickets', 'ten_wickets', 'best_bowling', 'catches', 'stumpings'],
};

function csvCell(v) {
  if (v == null) return '';
  if (typeof v === 'boolean') return v ? 'true' : 'false';
  const s = String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export class Exporter {
  constructor(dir) {
    this.dir = dir;
    fs.rmSync(dir, { recursive: true, force: true });
    fs.mkdirSync(dir, { recursive: true });
    this.streams = {};
    this.files = {};
    this.buffers = {};
    for (const [t, cols] of Object.entries(COLUMNS)) {
      const gz = zlib.createGzip({ level: 6 });
      const file = fs.createWriteStream(path.join(dir, `${t}.csv.gz`));
      gz.pipe(file);
      this.files[t] = file;
      gz.write(cols.join(',') + '\n');
      this.streams[t] = gz;
      this.buffers[t] = [];
    }
    this.seen = new Set();
    this.pending = [];
  }

  row(table, values) {
    const buf = this.buffers[table];
    buf.push(values.map(csvCell).join(','));
    if (buf.length >= 5000) this.flush(table);
  }

  flush(table) {
    const buf = this.buffers[table];
    if (!buf.length) return;
    const ok = this.streams[table].write(buf.join('\n') + '\n');
    buf.length = 0;
    if (!ok) this.pending.push(once(this.streams[table], 'drain'));
  }

  // Await after each match so compressed output keeps up (bounded memory).
  async drain() {
    if (!this.pending.length) return;
    const p = this.pending;
    this.pending = [];
    await Promise.all(p);
  }

  competition(c) {
    this.row('competitions', [c.id, c.name, c.group, c.format, c.gender]);
  }

  // raw: Cricsheet JSON; m: parsed match (parse.js); compId: competition
  match(raw, m, compId) {
    if (this.seen.has(m.id)) return;
    this.seen.add(m.id);
    const info = raw.info || {};
    const o = m.outcome;
    this.row('matches', [
      m.id, compId, m.matchType, m.gender, m.teamType, m.season, m.date, m.endDate, m.teams[0], m.teams[1], m.venue, m.city,
      m.event, m.stage, m.matchNumber, m.toss && m.toss.winner, m.toss && m.toss.decision, o.winner, m.result,
      o.tie, o.draw, o.noResult, m.pom.map((p) => p.name).join('; '), m.bpo,
    ]);

    m.innings.forEach((inn, i) => {
      const n = i + 1;
      this.row('innings', [
        m.id, n, inn.team, inn.opp, inn.runs, inn.wkts, inn.balls, inn.overs, inn.superOver, inn.declared, inn.forfeited,
        inn.extras.b, inn.extras.lb, inn.extras.w, inn.extras.nb, inn.extras.p,
        inn.target ? inn.target.runs : null, inn.target ? inn.target.overs : null,
      ]);
      inn.batting.forEach((b, pos) => {
        this.row('batting', [m.id, n, inn.team, pos + 1, b.id, b.name, b.runs, b.balls, b.fours, b.sixes, !b.out, b.how, b.kind || null]);
      });
      for (const w of inn.bowling) {
        this.row('bowling', [m.id, n, inn.opp, w.id, w.name, w.balls, `${Math.floor(w.balls / m.bpo)}${w.balls % m.bpo ? `.${w.balls % m.bpo}` : ''}`, w.maidens, w.runs, w.wkts, w.dots, w.wides, w.noballs]);
      }
    });

    const people = (info.registry && info.registry.people) || {};
    const idOf = (name) => (name ? people[name] || null : null);
    (raw.innings || []).forEach((inn, i) => {
      const n = i + 1;
      for (const over of inn.overs || []) {
        let seq = 0;
        let legal = 0;
        for (const d of over.deliveries || []) {
          seq += 1;
          const ex = d.extras || {};
          const isLegal = !ex.wides && !ex.noballs;
          if (isLegal) legal += 1;
          const r = d.runs || {};
          const w = (d.wickets || [])[0];
          this.row('deliveries', [
            m.id, n, over.over, seq, isLegal ? legal : null,
            idOf(d.batter), d.batter, idOf(d.bowler), d.bowler, idOf(d.non_striker), d.non_striker,
            r.batter || 0, r.extras || 0, r.total || 0, ex.wides || 0, ex.noballs || 0, ex.byes || 0, ex.legbyes || 0, ex.penalty || 0,
            !!r.non_boundary, !!w, w ? w.kind : null, w ? idOf(w.player_out) : null, w ? w.player_out : null,
            w && w.fielders ? w.fielders.map((f) => f.name).filter(Boolean).join('; ') : null,
          ]);
        }
      }
    });
  }

  player(id, p, cricinfoId) {
    this.row('players', [id, p.n, p.fn || null, p.country || null, cricinfoId || null, p.wiki || null]);
  }

  career(id, name, compId, c) {
    this.row('careers', [
      id, name, compId, { c: 'cricsheet', w: 'wikipedia', wc: 'wikipedia+cricsheet' }[c.src], c.asof || null,
      c.m, c.r, c.avg, c.c100, c.c50, c.hs, !!c.hsNo, c.balls, c.wk, c.bavg, c.econ, c.w5, c.w10, c.bbi, c.ct, c.st,
    ]);
  }

  // Historical match from Wikipedia (summary scorecard, or full scorecard where one exists).
  historyMatch(id, compId, m, linkId) {
    this.row('history_matches', [id, compId, m.date, m.teams[0], m.teams[1], m.venue, m.result, m.toss, m.umpires, m.pom, m.cricinfo, m.article, !!m.full]);
    m.innings.forEach((i, k) => {
      const n = k + 1;
      this.row('history_innings', [id, n, i.team, i.r, i.w, i.overs, i.dec]);
      const full = fullInnings(m, k);
      if (full) {
        for (const b of full.bat) this.row('history_performances', [id, n, i.team, 'batting', b.name, linkId(b.title), b.title, b.runs, b.balls, b.fours, b.sixes, b.no, b.how, null, null, null, null, 'full scorecard']);
        for (const w of full.bowl) this.row('history_performances', [id, n, i.team, 'bowling', w.name, linkId(w.title), w.title, null, null, null, null, null, null, w.overs, w.maidens, w.runs, w.wkts, 'full scorecard']);
      } else {
        for (const b of i.bat) this.row('history_performances', [id, n, i.team, 'batting', b.name, linkId(b.title), b.title, b.runs, b.balls, null, null, b.no, null, null, null, null, null, 'top performer']);
        for (const w of i.bowl) this.row('history_performances', [id, n, i.team, 'bowling', w.name, linkId(w.title), w.title, null, null, null, null, null, null, w.overs, null, w.r, w.w, 'top performer']);
      }
    });
  }

  async close() {
    await Promise.all(Object.keys(this.streams).map((t) => new Promise((resolve, reject) => {
      this.flush(t);
      this.files[t].on('finish', resolve).on('error', reject);
      this.streams[t].end();
    })));
  }
}
