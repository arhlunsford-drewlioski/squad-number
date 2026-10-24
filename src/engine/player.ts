import { ATTR_DEFS, ATTR_IDS, HIDDEN_DEFS, type Attrs, type Hidden } from './attributes';
import { ceilings, HEIGHT_MAX, HEIGHT_MIN, type Build, type Foot } from './body';
import { POS_BY_ID, WEIGHTS, type Position } from './positions';
import { ovrAt } from './rating';
import { clamp, type Rng } from './rng';
import { randomName } from './names';
import { wageFor } from './wages';
import { TRAITS, missingPrereq, type TraitId } from './traits';

export interface SeasonStats {
  apps: number;
  starts: number;
  mins: number;
  goals: number;
  assists: number;
  ratingSum: number;
  ratingN: number;
  yellow: number;
  red: number;
  cleanSheets: number;
  motm: number;
}
export const newSeasonStats = (): SeasonStats => ({ apps: 0, starts: 0, mins: 0, goals: 0, assists: 0, ratingSum: 0, ratingN: 0, yellow: 0, red: 0, cleanSheets: 0, motm: 0 });
export const avgRating = (s: SeasonStats) => (s.ratingN ? s.ratingSum / s.ratingN : 0);

export interface Player {
  id: string;
  name: string;
  age: number;
  position: Position;
  heightCm: number;
  build: Build;
  foot: Foot;
  weakFoot: number;
  attrs: Attrs;
  hidden: Hidden;
  /** Hidden ceiling in OVR terms. Shown to the player only as a fuzzy scout range. */
  potential: number;
  /** Hidden per-attribute ceilings that add up to the potential. Growth slows as an attribute nears its ceiling. */
  ceil: Attrs;
  /** Hidden growth-rate multiplier, about 0.75 to 1.3. */
  devRate: number;
  clubId: string | null;
  human: boolean;
  /** 0-100. Drops with minutes played, recovers each week. Scales performance in matches. */
  condition: number;
  /** Weeks left out injured. */
  injuredWeeks: number;
  /** Last five match ratings, oldest first. */
  form: number[];
  stats: SeasonStats;
  /** Learned skills that unlock options in moments. */
  traits: TraitId[];
  /** Matches left on a ban. */
  suspended: number;
  /** Weekly wage. */
  wage: number;
  /** Seasons left on the contract, counting the current one. */
  contractYears: number;
  /** The club that owns him while he is out on loan. */
  loanFrom: string | null;
}

export function rollHidden(rng: Rng, bias = 0): Hidden {
  return Object.fromEntries(HIDDEN_DEFS.map(([id]) => [id, Math.round(clamp(11 + bias + rng.gauss() * 3.5, 1, 20))])) as Hidden;
}

/** Per-attribute ceilings for a player: the attributes they would reach if they hit their potential, limited by height and build. */
export function makeCeil(attrs: Attrs, pos: Position, height: number, build: Build, potential: number): Attrs {
  const w = WEIGHTS[pos];
  const maxW = Math.max(...ATTR_IDS.map(id => w[id]));
  const bc = ceilings(height, build);
  const body = (id: keyof Attrs) => Math.max(attrs[id], bc[id]);
  const at = (c: number): Attrs => {
    const out = {} as Attrs;
    for (const d of ATTR_DEFS) {
      if (d.group === 'goalkeeping' && pos !== 'GK') { out[d.id] = attrs[d.id]; continue; }
      out[d.id] = clamp(attrs[d.id] + c * (0.35 + (w[d.id] / maxW) * 1.25), attrs[d.id], body(d.id));
    }
    return out;
  };
  const target = Math.max(potential, ovrAt(attrs, pos));
  let lo = 0;
  let hi = 14;
  for (let i = 0; i < 14; i++) {
    const mid = (lo + hi) / 2;
    if (ovrAt(at(mid), pos) < target) lo = mid; else hi = mid;
  }
  return at(hi);
}

/** Established players come with a few traits their attributes support. */
export function rollTraits(rng: Rng, attrs: Attrs, pos: Position): TraitId[] {
  const out: TraitId[] = [];
  for (const t of TRAITS) if (t.suits.includes(pos) && missingPrereq({ attrs }, t).length === 0 && rng.chance(0.35)) out.push(t.id);
  return out;
}

export const rollDevRate = (rng: Rng) => clamp(1.0 + rng.gauss() * 0.14, 0.7, 1.4);

export function rollBuild(rng: Rng): Build {
  const r = rng.next();
  return r < 0.28 ? 'lean' : r < 0.78 ? 'athletic' : 'solid';
}

export function rollHeight(rng: Rng, pos: Position): number {
  const [lo, hi] = POS_BY_ID[pos].height;
  return Math.round(clamp((lo + hi) / 2 + rng.gauss() * ((hi - lo) / 3), HEIGHT_MIN, HEIGHT_MAX));
}

/** Potential from current ability and age. Young players have more headroom. */
export function rollPotential(rng: Rng, ovr: number, age: number): number {
  const room = age <= 20 ? (21 - age) * 3.2 + rng.next() * 9 : age <= 24 ? rng.next() * 7 : age <= 28 ? rng.next() * 2 : 0;
  return Math.round(clamp(ovr + room, ovr, 99));
}

interface GenOpts {
  id: string;
  position: Position;
  age: number;
  targetOvr: number;
  clubId: string | null;
}

/** Build a plausible attribute set for a position that lands on the target overall. */
export function generatePlayer(rng: Rng, o: GenOpts): Player {
  const pos = o.position;
  const height = rollHeight(rng, pos);
  const build = rollBuild(rng);
  const bodyC = ceilings(height, build);
  const w = WEIGHTS[pos];
  const maxW = Math.max(...ATTR_IDS.map(id => w[id]));
  const shape = {} as Attrs;
  const noise = {} as Attrs;
  for (const d of ATTR_DEFS) {
    const rel = w[d.id] / maxW;
    shape[d.id] = rel > 0 ? rel * 6 - 2.4 : -3.2;
    noise[d.id] = rng.gauss() * 1.1;
  }
  const build_ = (c: number): Attrs => {
    const a = {} as Attrs;
    for (const d of ATTR_DEFS) {
      if (d.group === 'goalkeeping' && pos !== 'GK') { a[d.id] = 1; continue; }
      a[d.id] = clamp(c + shape[d.id] + noise[d.id], 1, bodyC[d.id]);
    }
    return a;
  };
  let lo = -6;
  let hi = 24;
  for (let i = 0; i < 16; i++) {
    const mid = (lo + hi) / 2;
    if (ovrAt(build_(mid), pos) < o.targetOvr) lo = mid; else hi = mid;
  }
  const attrs = build_((lo + hi) / 2);
  const ovr = ovrAt(attrs, pos);
  const potential = rollPotential(rng, ovr, o.age);
  return {
    id: o.id,
    name: randomName(rng),
    age: o.age,
    position: pos,
    heightCm: height,
    build,
    foot: rng.chance(0.27) ? 'left' : 'right',
    weakFoot: clamp(Math.round(2.6 + rng.gauss() * 0.9), 1, 5),
    attrs,
    hidden: rollHidden(rng),
    potential,
    ceil: makeCeil(attrs, pos, height, build, potential),
    devRate: rollDevRate(rng),
    clubId: o.clubId,
    human: false,
    condition: 100,
    injuredWeeks: 0,
    form: [],
    stats: newSeasonStats(),
    traits: rollTraits(rng, attrs, pos),
    suspended: 0,
    wage: Math.round((wageFor(Math.round(ovr)) * (0.9 + 0.2 * rng.next())) / 50) * 50,
    contractYears: rng.int(1, 4),
    loanFrom: null,
  };
}

export const ovrOf = (p: Player) => Math.round(ovrAt(p.attrs, p.position));
