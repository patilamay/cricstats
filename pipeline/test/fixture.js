// A hand-built Cricsheet-format T20 match covering the edge cases the parser
// has to get right. Expected numbers are worked out in parse.test.js.

const d = (batter, bowler, non_striker, batRuns, extra = {}, wicket = null, nonBoundary = false) => {
  const extrasTotal = Object.values(extra).reduce((a, b) => a + b, 0);
  const del = { batter, bowler, non_striker, runs: { batter: batRuns, extras: extrasTotal, total: batRuns + extrasTotal } };
  if (nonBoundary) del.runs.non_boundary = true;
  if (extrasTotal) del.extras = extra;
  if (wicket) del.wickets = [wicket];
  return del;
};

const people = {};
for (const n of ['A1', 'A2', 'A3', 'A4', 'A5', 'A6', 'A7', 'B1', 'B2', 'B3']) {
  people[n] = `${n[0] === 'A' ? 'aa' : 'bb'}00000${n[1]}`;
}

export const fixtureMatch = {
  meta: { data_version: '1.1.0', created: '2026-10-01', revision: 1 },
  info: {
    balls_per_over: 6,
    dates: ['2026-10-01'],
    match_type: 'T20',
    gender: 'male',
    team_type: 'club',
    season: '2026',
    teams: ['Team A', 'Team B'],
    venue: 'Test Ground',
    city: 'Testville',
    event: { name: 'Test League', stage: 'Final' },
    toss: { winner: 'Team A', decision: 'bat' },
    outcome: { winner: 'Team B', by: { wickets: 10 } },
    player_of_match: ['B1'],
    players: {
      'Team A': ['A1', 'A2', 'A3', 'A4', 'A5', 'A6', 'A7'],
      'Team B': ['B1', 'B2', 'B3'],
    },
    registry: { people },
  },
  innings: [
    {
      team: 'Team A',
      overs: [
        {
          over: 0,
          deliveries: [
            d('A1', 'B1', 'A2', 4),
            d('A1', 'B1', 'A2', 0, { wides: 1 }),
            d('A1', 'B1', 'A2', 1),
            d('A2', 'B1', 'A1', 6, { noballs: 1 }),
            d('A2', 'B1', 'A1', 0, { legbyes: 2 }),
            d('A2', 'B1', 'A1', 0, {}, { kind: 'caught', player_out: 'A2', fielders: [{ name: 'B2' }] }),
            d('A3', 'B1', 'A1', 0),
            d('A3', 'B1', 'A1', 4, {}, null, true),
          ],
        },
        {
          over: 1,
          deliveries: [
            d('A3', 'B2', 'A1', 0),
            d('A3', 'B2', 'A1', 0, {}, { kind: 'run out', player_out: 'A1', fielders: [{ name: 'B1' }] }),
            d('A3', 'B2', 'A4', 6),
            d('A3', 'B2', 'A4', 1),
            d('A4', 'B2', 'A3', 0, {}, { kind: 'lbw', player_out: 'A4' }),
            d('A5', 'B2', 'A3', 0, {}, { kind: 'stumped', player_out: 'A5', fielders: [{ name: 'B3' }] }),
          ],
        },
        {
          over: 2,
          deliveries: [
            d('A6', 'B1', 'A3', 0, {}, { kind: 'caught and bowled', player_out: 'A6' }),
            d('A7', 'B1', 'A3', 0),
            d('A7', 'B1', 'A3', 0),
            d('A7', 'B1', 'A3', 0),
            d('A7', 'B1', 'A3', 0),
            d('A7', 'B1', 'A3', 0, {}, { kind: 'retired hurt', player_out: 'A7' }),
          ],
        },
      ],
    },
    {
      team: 'Team B',
      overs: [
        {
          over: 0,
          deliveries: [
            d('B1', 'A1', 'B2', 4), d('B1', 'A1', 'B2', 4), d('B1', 'A1', 'B2', 4),
            d('B1', 'A1', 'B2', 4), d('B1', 'A1', 'B2', 4), d('B1', 'A1', 'B2', 6),
          ],
        },
        {
          over: 1,
          deliveries: [d('B2', 'A2', 'B1', 1), d('B1', 'A2', 'B2', 1)],
        },
      ],
    },
    {
      team: 'Team A',
      super_over: true,
      overs: [{ over: 0, deliveries: [d('A1', 'B2', 'A3', 6)] }],
    },
  ],
};

export const ids = people;
