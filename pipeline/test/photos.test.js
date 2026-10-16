import { test } from 'node:test';
import assert from 'node:assert/strict';
import { commonsFileName, commonsPath } from '../wiki.js';
import { flagCode } from '../../src/flags.js';

test('Wikidata image URLs become Commons file names (photos only)', () => {
  assert.equal(commonsFileName('http://commons.wikimedia.org/wiki/Special:FilePath/Sachin%20Tendulkar%20at%20MRF.jpg'), 'Sachin_Tendulkar_at_MRF.jpg');
  assert.equal(commonsFileName('http://commons.wikimedia.org/wiki/Special:FilePath/Signature.svg'), null);
  assert.equal(commonsFileName('http://commons.wikimedia.org/wiki/Special:FilePath/Scan.tif'), null);
  assert.equal(commonsFileName('not a url'), null);
});

test('Commons storage path uses the MD5 of the file name', () => {
  assert.equal(commonsPath('Example.jpg'), 'a9/Example.jpg');
});

test('country names map to flags, women\'s sides included; clubs get none', () => {
  assert.equal(flagCode('India'), 'in');
  assert.equal(flagCode('England Women'), 'gb-eng');
  assert.equal(flagCode('West Indies'), 'wi');
  assert.equal(flagCode('United States of America'), 'us');
  assert.equal(flagCode('Mumbai Indians'), null);
  assert.equal(flagCode(''), null);
});

test('every mapped flag has a file', async () => {
  const fs = await import('node:fs');
  const { FLAG_CODES } = await import('../../src/flags.js');
  for (const code of new Set(Object.values(FLAG_CODES).filter(Boolean))) {
    assert.ok(fs.existsSync(new URL(`../../public/flags/${code}.svg`, import.meta.url)), code);
  }
});
