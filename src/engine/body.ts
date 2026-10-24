import { ATTR_IDS, type AttrId } from './attributes';
import { clamp } from './rng';
import { POS_BY_ID, type Position } from './positions';

export type Build = 'lean' | 'athletic' | 'solid';
export type Foot = 'left' | 'right';

export const HEIGHT_MIN = 160;
export const HEIGHT_MAX = 205;
export const HEIGHT_AVG = 182;

export const BUILDS: { id: Build; label: string; effect: string }[] = [
  { id: 'lean', label: 'Lean', effect: 'Higher Pace, Agility and Stamina ceilings. Lower Strength and Balance ceilings.' },
  { id: 'athletic', label: 'Athletic', effect: 'No penalties, no bonuses. The balanced build.' },
  { id: 'solid', label: 'Solid', effect: 'Higher Strength ceiling. Lower Pace, Acceleration, Agility and Stamina ceilings.' },
];

/** Long-run ceiling for a bought attribute before height and build. */
export const BASE_CEILING = 18;
/** Highest value that can be bought at the start of a career. */
export const START_CAP = 16;

const TALL_UP: AttrId[] = ['heading', 'jumping', 'strength', 'aerialReach'];
const TALL_DOWN: AttrId[] = ['acceleration', 'agility', 'balance'];

/** Per-attribute change to the ceiling from height (cm) and build. */
export function ceilingMods(height: number, build: Build): Partial<Record<AttrId, number>> {
  const h = clamp((height - HEIGHT_AVG) / 18, -1, 1);
  const tall = Math.max(0, h);
  const short = Math.max(0, -h);
  const m: Partial<Record<AttrId, number>> = {};
  const add = (id: AttrId, v: number) => { m[id] = (m[id] ?? 0) + v; };
  for (const id of TALL_UP) { add(id, Math.round(2 * tall)); add(id, -Math.round(4 * short)); }
  for (const id of TALL_DOWN) { add(id, -Math.round(4 * tall)); add(id, Math.round(2 * short)); }
  add('pace', -Math.round(1.5 * tall));
  if (build === 'lean') { add('pace', 1); add('agility', 1); add('stamina', 1); add('strength', -3); add('balance', -1); }
  if (build === 'solid') { add('strength', 2); add('pace', -2); add('acceleration', -2); add('agility', -2); add('stamina', -1); }
  return m;
}

export function ceilingFor(id: AttrId, height: number, build: Build): number {
  return clamp(BASE_CEILING + (ceilingMods(height, build)[id] ?? 0), 8, 20);
}

export const buyCapFor = (id: AttrId, height: number, build: Build) => Math.min(START_CAP, ceilingFor(id, height, build));

export function ceilings(height: number, build: Build): Record<AttrId, number> {
  return Object.fromEntries(ATTR_IDS.map(id => [id, ceilingFor(id, height, build)])) as Record<AttrId, number>;
}

export function heightFeetInches(cm: number): string {
  const totalIn = cm / 2.54;
  const ft = Math.floor(totalIn / 12);
  const inch = Math.round(totalIn - ft * 12);
  return inch === 12 ? `${ft + 1}'0"` : `${ft}'${inch}"`;
}

/** Plain-language note on how the chosen height sits against the position's usual range. */
export function heightNote(pos: Position, height: number): { text: string; tone: 'ok' | 'warn' } {
  const [lo, hi] = POS_BY_ID[pos].height;
  if (height < lo) return { text: `Short for a ${POS_BY_ID[pos].long.toLowerCase()} (usual ${lo}-${hi} cm). Managers will question the aerial game.`, tone: 'warn' };
  if (height > hi) return { text: `Tall for a ${POS_BY_ID[pos].long.toLowerCase()} (usual ${lo}-${hi} cm). Expect to be questioned on agility and quickness.`, tone: 'warn' };
  return { text: `Within the usual ${lo}-${hi} cm for a ${POS_BY_ID[pos].long.toLowerCase()}.`, tone: 'ok' };
}
