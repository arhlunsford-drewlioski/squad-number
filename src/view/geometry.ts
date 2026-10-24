import type { FormationId } from '../engine/match/types';

/**
 * Pitch space: x runs 0 to 1 from the home goal to the away goal, y runs 0 to 1 from top to bottom.
 * Home attacks towards x = 1. Formations and scenes are written in "attack frame" (own goal at 0,
 * opponent goal at 1) and mapped to pitch space with toPitch.
 */
export interface Pt { x: number; y: number }
export type Side = 'h' | 'a';

export const PITCH_ASPECT = 105 / 68;

export function toPitch(side: Side, u: number, v: number): Pt {
  return side === 'h' ? { x: u, y: v } : { x: 1 - u, y: 1 - v };
}
export function toFrame(side: Side, p: Pt): { u: number; v: number } {
  return side === 'h' ? { u: p.x, v: p.y } : { u: 1 - p.x, v: 1 - p.y };
}

type Anchor = [number, number];

// Anchors in slot order, matching FORMATIONS in engine/match/formations.ts.
export const ANCHORS: Record<FormationId, Anchor[]> = {
  '4-4-2': [[.04, .5], [.2, .1], [.17, .37], [.17, .63], [.2, .9], [.44, .08], [.4, .38], [.4, .62], [.44, .92], [.62, .38], [.62, .62]],
  '4-3-3': [[.04, .5], [.2, .1], [.17, .37], [.17, .63], [.2, .9], [.34, .5], [.45, .3], [.45, .7], [.62, .1], [.66, .5], [.62, .9]],
  '4-2-3-1': [[.04, .5], [.2, .1], [.17, .37], [.17, .63], [.2, .9], [.34, .38], [.34, .62], [.52, .1], [.52, .5], [.52, .9], [.68, .5]],
  '3-5-2': [[.04, .5], [.17, .28], [.15, .5], [.17, .72], [.38, .06], [.36, .5], [.46, .33], [.46, .67], [.38, .94], [.64, .4], [.64, .6]],
  '4-1-4-1': [[.04, .5], [.2, .1], [.17, .37], [.17, .63], [.2, .9], [.32, .5], [.5, .08], [.46, .36], [.46, .64], [.5, .92], [.66, .5]],
};

/**
 * Where the eleven slots stand for a given ball position. The team's lines slide up and down with the ball,
 * squeeze towards it from the sides, and push higher when they have it.
 */
export function shapeTargets(side: Side, formation: FormationId, ball: Pt, attacking: boolean): Pt[] {
  const b = toFrame(side, ball);
  return ANCHORS[formation].map(([au, av]) => {
    const line = au < 0.1 ? 0.05 : au < 0.3 ? 0.7 : au < 0.5 ? 1 : 1.1;
    const u = clamp(au + 0.3 * (b.u - 0.5) * line * (attacking ? 1 : 0.8) + (attacking ? 0.05 : -0.05) * line, 0.02, 0.97);
    const v = clamp(av + (b.v - av) * (attacking ? 0.18 : 0.28) * (au < 0.1 ? 0.25 : 1), 0.03, 0.97);
    return toPitch(side, u, v);
  });
}

export const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const ease = (t: number) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
