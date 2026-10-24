import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { dataFiles, toJson } from '../scripts/export-data';

// If this fails, run `npx tsx scripts/export-data.ts` to refresh data/*.json.
describe('exported data', () => {
  for (const [name, value] of Object.entries(dataFiles())) {
    it(`data/${name} is current`, () => {
      expect(readFileSync(new URL(`../data/${name}`, import.meta.url), 'utf8')).toBe(toJson(value));
    });
  }
  it('lists every position with weights that sum to one', () => {
    const pos = JSON.parse(readFileSync(new URL('../data/positions.json', import.meta.url), 'utf8')) as { weights: Record<string, number> }[];
    expect(pos).toHaveLength(8);
    for (const p of pos) expect(Object.values(p.weights).reduce((a, b) => a + b, 0)).toBeCloseTo(1, 4);
  });
});
