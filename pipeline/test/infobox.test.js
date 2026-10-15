import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseInfobox, clean, columnFormat, asOfDate, toInt, toFloat, implausible } from '../infobox.js';

// Shaped like the real Sachin Tendulkar infobox (markup styles seen on Wikipedia).
const TENDULKAR = `{{Short description|Indian cricketer}}
{{Infobox cricketer
| name = Sachin Tendulkar
| image = Sachin at Castrol Awards.jpg
| country = India
| role = [[Batting (cricket)|Batter]]
| column1 = [[Test cricket|Test]]
| matches1 = 200
| runs1 = 15,921
| bat avg1 = 53.78
| 100s/50s1 = 51/68
| top score1 = 248[[not out|*]]
| deliveries1 = 4,240
| wickets1 = 46
| bowl avg1 = 54.17
| fivefor1 = 0
| tenfor1 = 0
| best bowling1 = 3/10
| catches/stumpings1 = 115/–
| column2 = [[One Day International|ODI]]
| matches2 = 463
| runs2 = 18,426
| bat avg2 = 44.83
| 100s/50s2 = 49/96
| top score2 = 200{{not out}}
| deliveries2 = 8,054
| wickets2 = 154
| bowl avg2 = 44.48
| fivefor2 = 2
| tenfor2 = {{n/a}}
| best bowling2 = 5/32
| catches/stumpings2 = 140/&ndash;
| column3 = [[First-class cricket|FC]]
| matches3 = 310
| runs3 = 25,396
| column4 = [[Twenty20 International|T20I]]
| matches4 = 1
| runs4 = 10
| bat avg4 = 10.00
| 100s/50s4 = 0/0
| top score4 = 10
| deliveries4 = 15
| wickets4 = 1
| bowl avg4 = 12.00
| best bowling4 = 1/12
| catches/stumpings4 = 1/–
| date = 15 November
| year = 2013
| source = http://www.espncricinfo.com/india/content/player/35320.html ESPNcricinfo
}}
'''Sachin Ramesh Tendulkar''' is an Indian former international cricketer...`;

test('parses a full infobox and ignores first-class columns', () => {
  const p = parseInfobox(TENDULKAR);
  assert.equal(p.name, 'Sachin Tendulkar');
  assert.equal(p.country, 'India');
  assert.equal(p.asof, '2013-11-15');
  assert.deepEqual(Object.keys(p.formats).sort(), ['ODI-m', 'T20I-m', 'Test-m']);
  assert.deepEqual(p.formats['Test-m'], {
    m: 200, r: 15921, avg: 53.78, c100: 51, c50: 68, hs: 248, hsNo: true, balls: 4240, wk: 46, bavg: 54.17,
    w5: 0, w10: 0, bbi: { w: 3, r: 10 }, ct: 115, st: 0,
  });
  const odi = p.formats['ODI-m'];
  assert.equal(odi.hs, 200);
  assert.equal(odi.hsNo, true);
  assert.equal(odi.w10, 0);
  assert.equal(odi.ct, 140);
  assert.equal(p.formats['T20I-m'].m, 1);
});

test('women, keepers, padding templates, refs and nested templates', () => {
  const p = parseInfobox(`{{infobox cricketer
| name = Test Keeper<ref>x</ref>
| female = true
| country = {{cr|ENG}} England
| column1 = [[Women's Test cricket|WTest]] | matches1 = {{0}}9
| runs1 = 401 | bat avg1 = {{0}}40.10 | 100s/50s1 = {{nowrap|1/2}} | top score1 = 115
| catches/stumpings1 = 20/5 | deliveries1 = – | wickets1 = – | bowl avg1 = – | best bowling1 = –
| column2 = [[Women's One Day International|WODI]] | matches2 = 1,02{{0}}<!-- comment -->
| runs2 = 2,500 | bat avg2 = 30.00
| column3 = WT20I | matches3 = 50
| date = {{date|2 October 2023}}
}}`);
  assert.equal(p.name, 'Test Keeper');
  assert.deepEqual(Object.keys(p.formats).sort(), ['ODI-w', 'T20I-w', 'Test-w']);
  const t = p.formats['Test-w'];
  assert.equal(t.m, 9);
  assert.equal(t.avg, 40.1);
  assert.equal(t.c100, 1);
  assert.equal(t.c50, 2);
  assert.equal(t.st, 5);
  assert.equal(t.wk, 0);
  assert.equal(t.bavg, null);
  assert.equal(t.bbi, null);
  assert.equal(p.formats['ODI-w'].m, 102);
  assert.equal(p.asof, '2023-10-02');
});

test('no infobox or no international columns returns null', () => {
  assert.equal(parseInfobox('Just text'), null);
  assert.equal(parseInfobox('{{Infobox cricketer | column1 = FC | matches1 = 10 }}'), null);
});

test('helpers', () => {
  assert.deepEqual(columnFormat('[[Twenty20 International|T20I]]'), { format: 'T20I', women: false });
  assert.deepEqual(columnFormat("Women's ODI"), { format: 'ODI', women: true });
  assert.equal(columnFormat('List A'), null);
  assert.equal(columnFormat('T20'), null);
  assert.equal(clean("'''99.94'''"), '99.94');
  assert.equal(asOfDate('March 3, 2020', ''), '2020-03-03');
  assert.equal(asOfDate('', '1948'), '1948-12-31');
  assert.equal(asOfDate('', ''), null);
});

test('implausible columns are rejected, names with links inside templates clean up', () => {
  const p = parseInfobox(`{{Infobox cricketer
| name = Babar Azam {{post-nominals|country=PAK|[[Sitara-e-Imtiaz|SI]]}}
| column1 = ODI | matches1 = 77 | runs1 = 1,604 | bat avg1 = 27.66 | wickets1 = 971 | bowl avg1 = 84.66 | deliveries1 = 2,000
| column2 = T20I | matches2 = 40 | runs2 = 900 | bat avg2 = 30.00 | top score2 = 80
}}`);
  assert.equal(p.name, 'Babar Azam SI');
  assert.deepEqual(Object.keys(p.formats), ['T20I-m']);
  assert.match(p.rejected[0], /ODI: too many wickets per match/);
  const old = parseInfobox('{{Infobox cricketer | column1 = Test | matches1 = 10 | runs1 = 300 | bat avg1 = 20 | deliveries1 = 60 | wickets1 = 30 | bowl avg1 = 15 }}');
  assert.equal(old.formats['Test-m'].wk, 30);
  assert.equal(old.formats['Test-m'].balls, 0);
});

test('footnotes and second numbers are not glued onto a value', () => {
  assert.equal(toInt('248{{refn|23 for Ireland; 225 for England|group=nb}}'), 248);
  assert.equal(toInt('109<br/>54'), 109);
  assert.equal(toInt('7,701'), 7701);
  assert.equal(toInt('40 (24 for Australia)'), 40);
  assert.equal(toInt('–'), null);
  assert.equal(toFloat('39.29{{efn|for England}}'), 39.29);
  assert.equal(toFloat('1,234.5'), 1234.5);
  assert.equal(clean('248{{refn|23 for Ireland|group=nb}}'), '248');
  assert.ok(implausible('ODI', { m: 24823, r: 7701, c100: 0, c50: 0, wk: 0, balls: 0, w5: 0, w10: 0 }));
});
