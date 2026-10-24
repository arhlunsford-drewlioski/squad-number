// Writes the engine's static tables to data/*.json, for the Godot port and for anyone reading them without TypeScript.
// Functions in the source (conditions, weights, event text) cannot be exported; they appear as { "$fn": true } so a port
// knows where code is needed. Run `npx tsx scripts/export-data.ts`; tests/data.test.ts checks the files are current.
import { writeFileSync, mkdirSync } from 'node:fs';
import { ACHIEVEMENTS } from '../src/engine/career';
import { CUP_ROUNDS } from '../src/engine/career/cup';
import { NATIONS, INTL_WEEKS, TOURNAMENT_EVERY } from '../src/engine/career/intl';
import { ATTR_DEFS, GROUPS } from '../src/engine/attributes';
import { FORMATIONS } from '../src/engine/match/formations';
import { TEMPLATES } from '../src/engine/moments/templates';
import { POSITIONS, WEIGHTS } from '../src/engine/positions';
import { BY_POSITION, INTENSITIES, PROGRAMMES } from '../src/engine/training';
import { TRAITS } from '../src/engine/traits';
import { DIVISIONS } from '../src/engine/world';
import { WEEKS } from '../src/engine/game';

const r6 = (v: number) => Math.round(v * 1e6) / 1e6;

export function dataFiles(): Record<string, unknown> {
  return {
    'attributes.json': { groups: GROUPS, attributes: ATTR_DEFS },
    'positions.json': POSITIONS.map(p => ({ ...p, weights: Object.fromEntries(Object.entries(WEIGHTS[p.id]).filter(([, w]) => w > 0).map(([k, w]) => [k, r6(w)])) })),
    'formations.json': FORMATIONS,
    'traits.json': TRAITS,
    'training.json': { programmes: PROGRAMMES, intensities: INTENSITIES, byPosition: BY_POSITION },
    'world.json': { weeks: WEEKS, divisions: DIVISIONS, cupRounds: CUP_ROUNDS, intlWeeks: INTL_WEEKS, tournamentEvery: TOURNAMENT_EVERY, nations: NATIONS.map(([name, offset]) => ({ name, offset })) },
    'achievements.json': ACHIEVEMENTS.map(a => ({ id: a.id, label: a.label, desc: a.desc, when: a.when, check: { $fn: true } })),
    'moments.json': TEMPLATES,
  };
}

/** JSON text with functions replaced by a marker. */
export const toJson = (v: unknown) => JSON.stringify(v, (_k, x) => (typeof x === 'function' ? { $fn: true } : x), 1) + '\n';

if (process.argv[1]?.endsWith('export-data.ts')) {
  mkdirSync(new URL('../data/', import.meta.url), { recursive: true });
  for (const [name, v] of Object.entries(dataFiles())) writeFileSync(new URL(`../data/${name}`, import.meta.url), toJson(v));
  console.log('wrote', Object.keys(dataFiles()).join(', '));
}
