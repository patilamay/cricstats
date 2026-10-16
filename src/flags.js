// Country name -> flag file in public/flags/ (SVGs from flag-icons 7.5.0, MIT; see public/flags/LICENSE).
// Names are as Cricsheet and Wikipedia write them. Women's sides ("India Women") use the same flag.
// West Indies has no national flag, so it gets a small neutral badge instead (wi.svg, drawn here).
export const FLAG_CODES = {
  Afghanistan: 'af', Argentina: 'ar', Australia: 'au', Austria: 'at', Bahamas: 'bs', Bahrain: 'bh',
  Bangladesh: 'bd', Belgium: 'be', Belize: 'bz', Bermuda: 'bm', Bhutan: 'bt', Botswana: 'bw', Brazil: 'br',
  Bulgaria: 'bg', Cambodia: 'kh', Cameroon: 'cm', Canada: 'ca', 'Cayman Islands': 'ky', Chile: 'cl',
  China: 'cn', 'Cook Islands': 'ck', 'Costa Rica': 'cr', Croatia: 'hr', Cyprus: 'cy', 'Czech Republic': 'cz',
  Czechia: 'cz', Denmark: 'dk', England: 'gb-eng', Estonia: 'ee', Eswatini: 'sz', Fiji: 'fj', Finland: 'fi',
  France: 'fr', Gambia: 'gm', 'The Gambia': 'gm', Germany: 'de', Ghana: 'gh', Gibraltar: 'gi', Greece: 'gr',
  Guernsey: 'gg', 'Hong Kong': 'hk', Hungary: 'hu', India: 'in', Indonesia: 'id', Iran: 'ir', Ireland: 'ie',
  'Isle of Man': 'im', Israel: 'il', Italy: 'it', Japan: 'jp', Jersey: 'je', Kenya: 'ke', Kuwait: 'kw',
  Lesotho: 'ls', Luxembourg: 'lu', Malawi: 'mw', Malaysia: 'my', Maldives: 'mv', Mali: 'ml', Malta: 'mt',
  Mexico: 'mx', Mongolia: 'mn', Mozambique: 'mz', Myanmar: 'mm', Namibia: 'na', Nepal: 'np',
  Netherlands: 'nl', 'New Zealand': 'nz', Nigeria: 'ng', Norway: 'no', Oman: 'om', Pakistan: 'pk',
  Panama: 'pa', 'Papua New Guinea': 'pg', Peru: 'pe', Philippines: 'ph', Portugal: 'pt', Qatar: 'qa',
  Romania: 'ro', Rwanda: 'rw', Samoa: 'ws', 'Saudi Arabia': 'sa', Scotland: 'gb-sct', Serbia: 'rs',
  Seychelles: 'sc', 'Sierra Leone': 'sl', Singapore: 'sg', Slovenia: 'si', 'South Africa': 'za',
  'South Korea': 'kr', Spain: 'es', 'Sri Lanka': 'lk', 'St Helena': 'sh', 'Saint Helena': 'sh',
  Sweden: 'se', Switzerland: 'ch', Tanzania: 'tz', Thailand: 'th', Turkey: 'tr', Türkiye: 'tr',
  Uganda: 'ug', 'United Arab Emirates': 'ae', UAE: 'ae', 'United States of America': 'us', USA: 'us',
  'United States': 'us', Vanuatu: 'vu', Wales: 'gb-wls', 'West Indies': 'wi', Zambia: 'zm', Zimbabwe: 'zw',
  // Historical sides
  'East Africa': null, 'ICC World XI': null, 'World XI': null,
};

const SUFFIX = /\s+(Women|Men|A|U19|Under-19s?)$/i;

export function flagCode(name) {
  if (!name || typeof name !== 'string') return null;
  const n = name.trim();
  if (n in FLAG_CODES) return FLAG_CODES[n];
  const base = n.replace(SUFFIX, '');
  return FLAG_CODES[base] ?? null;
}
