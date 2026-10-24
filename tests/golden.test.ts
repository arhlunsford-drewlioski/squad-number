import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { careerFixture, marketFixture, matchFixture, momentFixture, rngFixture, seasonFixture, worldFixture } from '../scripts/golden-lib';

// If one of these fails after a deliberate engine change, run `npx tsx scripts/golden.ts` and review the diff.
const golden = JSON.parse(readFileSync(new URL('../fixtures/golden.json', import.meta.url), 'utf8'));
const same = (v: unknown) => JSON.parse(JSON.stringify(v));

describe('golden fixtures', () => {
  it('the random number generator matches', () => expect(same(rngFixture())).toEqual(golden.rng));
  it('a new world matches', () => expect(same(worldFixture())).toEqual(golden.world));
  it('seeded matches match', () => expect(same(matchFixture())).toEqual(golden.match));
  it('moment odds and outcomes match', () => expect(same(momentFixture())).toEqual(golden.moments));
  it('a season matches', () => expect(same(seasonFixture())).toEqual(golden.season), 120000);
  it('a summer of market business matches', () => expect(same(marketFixture())).toEqual(golden.market), 120000);
  it('a short career and its legacy match', () => expect(same(careerFixture())).toEqual(golden.career), 120000);
});
