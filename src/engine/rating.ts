import { ATTR_IDS, type Attrs } from './attributes';
import { WEIGHTS, type Position, POSITIONS } from './positions';
import { clamp } from './rng';

/** Position-weighted mean of the attributes, on the 1-20 scale. */
export function weightedAvg(attrs: Attrs, pos: Position): number {
  const w = WEIGHTS[pos];
  let s = 0;
  for (const id of ATTR_IDS) s += attrs[id] * w[id];
  return s;
}

// OVR maps the weighted mean onto 1-99. wavg 8 is about 47, 12 about 66, 15 about 81, 17 about 90.
// These constants are tuned by scripts/calibrate.ts against the division bands.
const OVR_A = 8.6;
const OVR_B = 4.8;

export const ovrFromWavg = (w: number) => OVR_A + OVR_B * w;
export const wavgFromOvr = (o: number) => (o - OVR_A) / OVR_B;

/** Overall rating for a position, unrounded. */
export function ovrAt(attrs: Attrs, pos: Position): number {
  return clamp(ovrFromWavg(weightedAvg(attrs, pos)), 1, 99);
}

export const ovrRounded = (attrs: Attrs, pos: Position) => Math.round(ovrAt(attrs, pos));

export function allPositionOvr(attrs: Attrs): { pos: Position; ovr: number }[] {
  return POSITIONS.map(p => ({ pos: p.id, ovr: ovrRounded(attrs, p.id) }));
}

export type Band = 'bad' | 'low' | 'mid' | 'good' | 'great' | 'elite';

/** Colour band for a 1-20 attribute value. */
export function attrBand(v: number): Band {
  const r = Math.round(v);
  return r <= 5 ? 'bad' : r <= 9 ? 'low' : r <= 12 ? 'mid' : r <= 15 ? 'good' : r <= 18 ? 'great' : 'elite';
}

/** Colour band for an overall rating. */
export function ovrBand(o: number): Band {
  return o < 50 ? 'bad' : o < 60 ? 'low' : o < 70 ? 'mid' : o < 80 ? 'good' : o < 90 ? 'great' : 'elite';
}

export function ovrTier(o: number): string {
  return o < 50 ? 'Academy / non-league' : o < 60 ? 'Fourth division' : o < 70 ? 'Third division' : o < 80 ? 'Second division' : o < 90 ? 'Top flight' : 'World class';
}
