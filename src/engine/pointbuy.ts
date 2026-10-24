import { ATTR_DEFS, ATTR_IDS, type AttrId, type Attrs, emptyAttrs } from './attributes';
import { buyCapFor, type Build } from './body';
import { WEIGHTS, type Position } from './positions';

export const BASE_POOL = 45;
export const AGE_START = 17;
export const WEAK_FOOT_BASE = 2;
export const NOW_LATER_MAX = 10;

/** Points needed to raise an attribute from v to v + 1. */
export const stepCost = (v: number) => (v < 10 ? 1 : v < 13 ? 2 : 3);

/** Points between two values. Negative when below the base, which refunds points. */
export function cumCost(base: number, value: number): number {
  let c = 0;
  if (value >= base) for (let v = base; v < value; v++) c += stepCost(v);
  else for (let v = value; v < base; v++) c -= stepCost(v);
  return c;
}

/** Everyone starts here. Outfielders have no goalkeeping ability, goalkeepers have weak technical skills. */
export function startAttrs(pos: Position): Attrs {
  const a = emptyAttrs(1);
  for (const d of ATTR_DEFS) {
    if (d.group === 'technical') a[d.id] = pos === 'GK' ? 3 : 4;
    else if (d.group === 'mental') a[d.id] = 4;
    else if (d.group === 'physical') a[d.id] = 5;
    else a[d.id] = pos === 'GK' ? 4 : 1;
  }
  return a;
}

export const isLocked = (id: AttrId, pos: Position) => pos !== 'GK' && ATTR_DEFS.find(d => d.id === id)!.group === 'goalkeeping';

export const weakFootCost = (wf: number) => (wf >= WEAK_FOOT_BASE ? (wf - WEAK_FOOT_BASE) * 3 : -(WEAK_FOOT_BASE - wf) * 2);

/** More "now" means more starting points and a lower ceiling. More "later" is the reverse. */
export const poolFor = (nowLater: number) => BASE_POOL + Math.round(nowLater * 1.2);

/** Centre of the potential distribution in OVR terms. */
export const potentialCenter = (nowLater: number) => 79 - 0.9 * nowLater;

export function pointsSpent(attrs: Attrs, pos: Position, weakFoot: number): number {
  const base = startAttrs(pos);
  let s = weakFootCost(weakFoot);
  for (const id of ATTR_IDS) s += cumCost(base[id], attrs[id]);
  return s;
}

/** Greedy auto-spend: buys the attributes that matter most for the position until the pool runs out. */
export function autoBuild(pos: Position, height: number, build: Build, budget: number): Attrs {
  const attrs = startAttrs(pos);
  const w = WEIGHTS[pos];
  let left = budget;
  for (;;) {
    let best: AttrId | null = null;
    let bestScore = 0;
    for (const id of ATTR_IDS) {
      if (isLocked(id, pos)) continue;
      const v = attrs[id];
      if (v >= buyCapFor(id, height, build)) continue;
      const cost = stepCost(v);
      if (cost > left) continue;
      const score = w[id] / cost;
      if (score > bestScore) { bestScore = score; best = id; }
    }
    if (!best) break;
    left -= stepCost(attrs[best]);
    attrs[best] += 1;
  }
  return attrs;
}
