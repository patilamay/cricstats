// Competitions the site covers. Each one maps to a Cricsheet download zip
// (https://cricsheet.org/downloads/<zip>). Zips that contain both genders
// (tests, odis, t20s) are split into separate competitions by `gender`.
//
// format:    used for labels and which leaderboards make sense
// seasonBy:  'season' uses info.season (leagues), 'year' uses the first match date
// ballsOnly: show bowling in balls rather than overs (The Hundred)

export const COMPETITIONS = [
  // International, men
  { id: 'test-m', name: "Men's Tests", short: 'Tests', group: "Men's internationals", zip: 'tests_male_json.zip', format: 'Test', gender: 'male', seasonBy: 'year' },
  { id: 'odi-m', name: "Men's ODIs", short: 'ODIs', group: "Men's internationals", zip: 'odis_male_json.zip', format: 'ODI', gender: 'male', seasonBy: 'year' },
  { id: 't20i-m', name: "Men's T20Is", short: 'T20Is', group: "Men's internationals", zip: 't20s_male_json.zip', format: 'T20', gender: 'male', seasonBy: 'year' },

  // International, women
  { id: 'test-w', name: "Women's Tests", short: 'Tests', group: "Women's internationals", zip: 'tests_female_json.zip', format: 'Test', gender: 'female', seasonBy: 'year' },
  { id: 'odi-w', name: "Women's ODIs", short: 'ODIs', group: "Women's internationals", zip: 'odis_female_json.zip', format: 'ODI', gender: 'female', seasonBy: 'year' },
  { id: 't20i-w', name: "Women's T20Is", short: 'T20Is', group: "Women's internationals", zip: 't20s_female_json.zip', format: 'T20', gender: 'female', seasonBy: 'year' },

  // Leagues
  { id: 'ipl', name: 'Indian Premier League', short: 'IPL', group: 'Leagues', zip: 'ipl_male_json.zip', format: 'T20', gender: 'male', seasonBy: 'season' },
  { id: 'wpl', name: "Women's Premier League", short: 'WPL', group: 'Leagues', zip: 'wpl_female_json.zip', format: 'T20', gender: 'female', seasonBy: 'season' },
  { id: 'bbl', name: 'Big Bash League', short: 'BBL', group: 'Leagues', zip: 'bbl_male_json.zip', format: 'T20', gender: 'male', seasonBy: 'season' },
  { id: 'wbbl', name: "Women's Big Bash League", short: 'WBBL', group: 'Leagues', zip: 'wbb_female_json.zip', format: 'T20', gender: 'female', seasonBy: 'season' },
  { id: 'psl', name: 'Pakistan Super League', short: 'PSL', group: 'Leagues', zip: 'psl_male_json.zip', format: 'T20', gender: 'male', seasonBy: 'season' },
  { id: 'cpl', name: 'Caribbean Premier League', short: 'CPL', group: 'Leagues', zip: 'cpl_male_json.zip', format: 'T20', gender: 'male', seasonBy: 'season' },
  { id: 'sa20', name: 'SA20', short: 'SA20', group: 'Leagues', zip: 'sat_male_json.zip', format: 'T20', gender: 'male', seasonBy: 'season' },
  { id: 'ilt20', name: 'International League T20', short: 'ILT20', group: 'Leagues', zip: 'ilt_male_json.zip', format: 'T20', gender: 'male', seasonBy: 'season' },
  { id: 'mlc', name: 'Major League Cricket', short: 'MLC', group: 'Leagues', zip: 'mlc_male_json.zip', format: 'T20', gender: 'male', seasonBy: 'season' },
  { id: 'hnd-m', name: "The Hundred (Men)", short: 'Hundred', group: 'Leagues', zip: 'hnd_male_json.zip', format: 'Hundred', gender: 'male', seasonBy: 'season', ballsOnly: true },
  { id: 'hnd-w', name: "The Hundred (Women)", short: 'Hundred W', group: 'Leagues', zip: 'hnd_female_json.zip', format: 'Hundred', gender: 'female', seasonBy: 'season', ballsOnly: true },
];

export const CRICSHEET_BASE = 'https://cricsheet.org/downloads/';
