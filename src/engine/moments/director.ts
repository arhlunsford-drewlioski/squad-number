import type { Position } from '../positions';
import { clamp, type Rng } from '../rng';
import { TEMPLATES } from './templates';
import type { Kind, TemplateDef, WhenCtx } from './types';

export interface MomentSlot {
  /** The earliest minute the moment can happen. It waits for a sequence that fits. */
  min: number;
  /** The kind of moment this slot wants. It waits for a possession sequence that suits it. */
  want: Kind;
}
export interface MomentPlan { slots: MomentSlot[] }

/** What kind of moments suit each position. */
const KIND_MIX: Record<Position, Partial<Record<Kind, number>>> = {
  ST: { attack: 0.6, build: 0.2, defend: 0.15, any: 0.05 },
  AM: { attack: 0.6, build: 0.25, defend: 0.1, any: 0.05 },
  W: { attack: 0.6, build: 0.2, defend: 0.15, any: 0.05 },
  CM: { attack: 0.35, build: 0.35, defend: 0.2, any: 0.1 },
  DM: { attack: 0.15, build: 0.3, defend: 0.45, any: 0.1 },
  FB: { attack: 0.25, build: 0.25, defend: 0.4, any: 0.1 },
  CB: { attack: 0.05, build: 0.25, defend: 0.6, any: 0.1 },
  GK: { attack: 0, build: 0.2, defend: 0.75, any: 0.05 },
};

function sampleKind(rng: Rng, mix: Partial<Record<Kind, number>>): Kind {
  const kinds = Object.keys(mix) as Kind[];
  let r = rng.next() * kinds.reduce((a, k) => a + (mix[k] ?? 0), 0);
  for (const k of kinds) { r -= mix[k] ?? 0; if (r <= 0) return k; }
  return kinds[0];
}

/** Four or five moments for a starter, two or three for a substitute, spread across the time on the pitch. */
export function planMoments(rng: Rng, position: Position, on: number, off: number): MomentPlan {
  const starter = on === 0;
  const n = starter ? rng.int(4, 5) : rng.int(2, 3);
  const from = on + (starter ? 5 : 2);
  const to = Math.max(from + 2, Math.min(off, 90) - 3);
  const slots: MomentSlot[] = [];
  for (let i = 0; i < n; i++) {
    const base = from + ((to - from) / n) * (i + 0.5);
    slots.push({ min: Math.round(clamp(base + (rng.next() - 0.5) * 7, from, to)), want: sampleKind(rng, KIND_MIX[position]) });
  }
  slots.sort((a, b) => a.min - b.min);
  return { slots };
}

/** Choose a template for the moment: fits the position and the game state, and avoids repeats. */
export function pickTemplate(rng: Rng, kind: Kind, slot: Position, state: WhenCtx, used: Set<string>, recent: string[]): TemplateDef | null {
  const base = TEMPLATES.filter(t => !t.followOnly && t.kind === kind && t.for.includes(slot) && (!t.when || t.when(state)));
  const fresh = base.filter(t => !used.has(t.id));
  const pool = fresh.filter(t => !recent.includes(t.id));
  const list = pool.length ? pool : fresh;
  if (!list.length) return null;
  const w = list.map(t => Math.max(0, t.weight ? t.weight(state) : 1));
  let r = rng.next() * w.reduce((a, b) => a + b, 0);
  for (let i = 0; i < list.length; i++) { r -= w[i]; if (r <= 0) return list[i]; }
  return list[list.length - 1];
}
