import { ATTR_BY_ID, ATTR_IDS, type AttrGroup, type AttrId } from './attributes';
import type { Player } from './player';
import { WEIGHTS, type Position } from './positions';
import { clamp } from './rng';
import { TRAIT_BY_ID, TRAIT_GOAL, TRAIT_RATE, missingPrereq, type TraitId } from './traits';

export type Intensity = 'light' | 'standard' | 'hard';
export type ProgrammeId =
  | 'finishing' | 'longRange' | 'ballMastery' | 'passing' | 'delivery' | 'defensiveShape' | 'tackling' | 'aerial' | 'movement'
  | 'speed' | 'strength' | 'endurance' | 'video' | 'mindset' | 'gkHandling' | 'gkReflexes' | 'smallSided' | 'skillWork';

export interface Programme {
  id: ProgrammeId;
  label: string;
  /** Attributes trained, strongest first. Weights are 1.0 for the lead, 0.6 and 0.4 for the next two. */
  trains: { id: AttrId; w: number }[];
  blurb: string;
}

const P = (id: ProgrammeId, label: string, blurb: string, ...attrs: AttrId[]): Programme => ({
  id, label, blurb, trains: attrs.map((a, i) => ({ id: a, w: [1, 0.6, 0.4, 0.3, 0.3][i] })),
});

export const PROGRAMMES: Programme[] = [
  P('finishing', 'Finishing', 'Shooting drills under pressure.', 'finishing', 'composure', 'offTheBall'),
  P('longRange', 'Long range', 'Shooting from distance and striking the ball cleanly.', 'longShots', 'technique', 'strength'),
  P('ballMastery', 'Ball mastery', 'Close control and running with the ball.', 'firstTouch', 'dribbling', 'technique'),
  P('passing', 'Passing patterns', 'Playing through the thirds and finding the pass.', 'passing', 'vision', 'decisions'),
  P('delivery', 'Delivery', 'Crossing and set-piece delivery.', 'crossing', 'technique', 'passing'),
  P('defensiveShape', 'Defensive shape', 'Holding a line and staying switched on.', 'positioning', 'marking', 'concentration'),
  P('tackling', 'Tackling and duels', 'Winning the ball and winning duels.', 'tackling', 'aggression', 'strength'),
  P('aerial', 'Aerial work', 'Heading and timing the jump.', 'heading', 'jumping', 'strength'),
  P('movement', 'Movement', 'Runs off the ball and reading the play.', 'offTheBall', 'anticipation', 'acceleration'),
  P('speed', 'Speed and agility', 'Sprint mechanics and changes of direction.', 'pace', 'acceleration', 'agility'),
  P('strength', 'Strength and balance', 'Gym work and core stability.', 'strength', 'balance', 'jumping'),
  P('endurance', 'Endurance', 'Running volume and recovery between efforts.', 'stamina', 'workRate'),
  P('video', 'Video analysis', 'Studying opponents and your own decisions.', 'decisions', 'anticipation', 'vision'),
  P('mindset', 'Mindset', 'Concentration and staying calm when it matters.', 'composure', 'concentration'),
  P('gkHandling', 'Keeper: handling', 'Catching, command of the area and one on ones.', 'handling', 'commandOfArea', 'oneOnOnes'),
  P('gkReflexes', 'Keeper: reflexes', 'Shot stopping, reach and distribution.', 'reflexes', 'aerialReach', 'kicking'),
  P('skillWork', 'Skill work', 'Learn a trait. Pick one in the trait panel. It needs the right attributes first.', 'technique', 'firstTouch'),
  P('smallSided', 'Small-sided games', 'Broad work that touches many skills, lightly.', 'passing', 'firstTouch', 'decisions', 'stamina', 'workRate'),
];
export const PROGRAMME_BY_ID = Object.fromEntries(PROGRAMMES.map(p => [p.id, p])) as Record<ProgrammeId, Programme>;

export interface Session { programme: ProgrammeId | 'rest'; intensity: Intensity }
export interface TrainingPlan { sessions: [Session, Session, Session]; focus: AttrId | null; traitFocus: TraitId | null }

export const INTENSITIES: { id: Intensity; label: string; gain: number; cost: number; risk: string }[] = [
  { id: 'light', label: 'Light', gain: 0.65, cost: 1.5, risk: 'Low' },
  { id: 'standard', label: 'Standard', gain: 1, cost: 3, risk: 'Normal' },
  { id: 'hard', label: 'Hard', gain: 1.4, cost: 6, risk: 'Raised' },
];
const INT = Object.fromEntries(INTENSITIES.map(i => [i.id, i])) as Record<Intensity, (typeof INTENSITIES)[number]>;

/** Recommended programmes by position, used for the default plan and for how clubs train their players. */
export const BY_POSITION: Record<Position, ProgrammeId[]> = {
  GK: ['gkHandling', 'gkReflexes', 'mindset'],
  CB: ['defensiveShape', 'tackling', 'aerial'],
  FB: ['speed', 'defensiveShape', 'delivery'],
  DM: ['tackling', 'passing', 'defensiveShape'],
  CM: ['passing', 'ballMastery', 'endurance'],
  AM: ['passing', 'ballMastery', 'finishing'],
  W: ['speed', 'ballMastery', 'delivery'],
  ST: ['finishing', 'movement', 'aerial'],
};

export function defaultPlan(pos: Position): TrainingPlan {
  const [a, b, c] = BY_POSITION[pos];
  const s = (programme: ProgrammeId): Session => ({ programme, intensity: 'standard' });
  return { sessions: [s(a), s(b), s(c)], focus: null, traitFocus: null };
}

// ---- tuning constants (calibrated by scripts/world-sim.ts) ----
/** Attribute points gained per weight-unit per week at full headroom, prime age and average everything else. */
export const UNIT = 0.05;
/** Weight-units a club's own coaching spreads across a player each week. */
export const CLUB_UNITS = 5;
/** Weight-units a full match (90 minutes) adds, spread over the position's key attributes. */
export const MATCH_UNITS = 1.4;
export const FOCUS_UNITS = 0.7;
/** Tuning knobs that scripts may adjust while calibrating. */
export const TUNING = { humanGrowth: 1.1, focusedRoom: 2.5, bellHeight: 1.45, bellWidth: 3.4 };

export function ageCurve(group: AttrGroup, age: number): number {
  if (group === 'physical') return age <= 19 ? 1 : age <= 22 ? 0.75 : age <= 25 ? 0.4 : age <= 27 ? 0.12 : 0;
  if (group === 'mental') return age <= 20 ? 0.8 : age <= 24 ? 0.85 : age <= 28 ? 0.6 : age <= 32 ? 0.35 : 0.15;
  return age <= 20 ? 1 : age <= 24 ? 0.75 : age <= 28 ? 0.4 : age <= 31 ? 0.2 : 0.08;
}

/**
 * How fast your own player develops at each age: a smooth bell. Growth builds through the teens, peaks around 20 or 21 and
 * fades through the mid-twenties. Physical attributes peak earlier and mental ones later.
 */
const PEAK_AGE: Record<AttrGroup, number> = { physical: 20, technical: 21, goalkeeping: 21.5, mental: 22.5 };
export function humanCurve(group: AttrGroup, age: number): number {
  const c = PEAK_AGE[group];
  return TUNING.bellHeight * Math.exp(-((age - c) ** 2) / (2 * TUNING.bellWidth ** 2));
}

export const personality = (p: Player) => 0.6 + 0.025 * p.hidden.professionalism + 0.015 * p.hidden.determination;
/** Coaching quality from the club's standing: 0.85 at the bottom of the pyramid to about 1.2 at the top. */
export const coachFactor = (clubRating: number) => clamp(0.85 + (0.35 * (clubRating - 46)) / 37, 0.8, 1.25);

/**
 * Weekly gain for one attribute. Your own sessions (`focused`) keep paying off closer to the ceiling than a club's
 * general coaching does, so a player who trains with purpose gets within a few points of their potential.
 */
function gain(p: Player, id: AttrId, units: number, coach: number, focused = p.human): number {
  if (units <= 0) return 0;
  const v = p.attrs[id];
  const room = p.ceil[id] - v;
  if (room <= 0) return 0;
  const headroom = focused ? clamp(room / TUNING.focusedRoom, 0.12, 1) : clamp(room / 4, 0.05, 1);
  const diminishing = v > 14 ? Math.max(focused ? 0.65 : 0.5, 1 - (focused ? 0.07 : 0.1) * (v - 14)) : 1;
  const curve = focused ? humanCurve(ATTR_BY_ID[id].group, p.age) : ageCurve(ATTR_BY_ID[id].group, p.age);
  return Math.min(room, UNIT * units * curve * headroom * diminishing * coach * personality(p) * p.devRate);
}

/** Weight-units per attribute from a weekly plan: programme weights, intensity, repeat bonus and individual focus. */
export function planUnits(plan: TrainingPlan): Partial<Record<AttrId, number>> {
  const out: Partial<Record<AttrId, number>> = {};
  const counts: Record<string, number> = {};
  for (const s of plan.sessions) if (s.programme !== 'rest') counts[s.programme] = (counts[s.programme] ?? 0) + 1;
  for (const s of plan.sessions) {
    if (s.programme === 'rest') continue;
    const synergy = counts[s.programme] === 3 ? 1.15 : counts[s.programme] === 2 ? 1.07 : 1;
    for (const t of PROGRAMME_BY_ID[s.programme].trains) out[t.id] = (out[t.id] ?? 0) + t.w * INT[s.intensity].gain * synergy;
  }
  if (plan.focus) out[plan.focus] = (out[plan.focus] ?? 0) + FOCUS_UNITS;
  return out;
}

/** Condition points the week's sessions cost. Rest sessions give a little back. */
export const planCost = (plan: TrainingPlan) => plan.sessions.reduce((a, s) => a + (s.programme === 'rest' ? -3 : INT[s.intensity].cost), 0);
export const planHardCount = (plan: TrainingPlan) => plan.sessions.filter(s => s.programme !== 'rest' && s.intensity === 'hard').length;

/** Expected gain this week for each trained attribute, without applying it. */
export function projectGains(p: Player, plan: TrainingPlan, coach: number): [AttrId, number][] {
  return (Object.entries(planUnits(plan)) as [AttrId, number][])
    .map(([id, u]) => [id, gain(p, id, u, coach * TUNING.humanGrowth, true)] as [AttrId, number])
    .sort((a, b) => b[1] - a[1]);
}

export function applyPlan(p: Player, plan: TrainingPlan, coach: number): [AttrId, number][] {
  const g = projectGains(p, plan, coach);
  for (const [id, v] of g) p.attrs[id] += v;
  return g;
}

/** Clubs train everyone else: the same weekly units, spread across the position's key attributes. */
export function applyClubTraining(p: Player, coach: number): void {
  const w = WEIGHTS[p.position];
  for (const id of ATTR_IDS) if (w[id] >= 0.03) p.attrs[id] += gain(p, id, CLUB_UNITS * w[id] * 1.6, coach);
}

/** Playing matches develops the attributes the position uses. */
export function applyMatchExperience(p: Player, minutes: number, coach: number): void {
  if (minutes < 10) return;
  const w = WEIGHTS[p.position];
  for (const id of ATTR_IDS) if (w[id] >= 0.03) p.attrs[id] += gain(p, id, MATCH_UNITS * (minutes / 90) * w[id] * 1.6, coach);
}

/** Yearly ageing at roll-over: physical decline from 28, technical and mental from 32. */
export function applyAgeing(p: Player, rnd: () => number): void {
  for (const id of ATTR_IDS) {
    const g = ATTR_BY_ID[id].group;
    if (g === 'goalkeeping' && p.position !== 'GK') continue;
    let drop = 0;
    if (g === 'physical' && p.age >= 28) drop = (p.age - 27) * 0.26 * (id === 'strength' || id === 'jumping' ? 0.6 : 1);
    else if (p.age >= 32) drop = (p.age - 31) * 0.16;
    if (drop > 0) p.attrs[id] = Math.max(1, p.attrs[id] - drop * (0.6 + 0.8 * rnd()) * (1.3 - p.hidden.naturalFitness / 40));
  }
}

/**
 * Skill-work sessions move the chosen trait forward each week, provided the attributes are there.
 * Returns the trait if this week unlocked it.
 */
export function applyTraitWork(p: Player, plan: TrainingPlan, progress: Partial<Record<TraitId, number>>): TraitId | null {
  const id = plan.traitFocus;
  if (!id || p.traits.includes(id)) return null;
  const def = TRAIT_BY_ID[id];
  if (missingPrereq(p, def).length) return null;
  let add = 0;
  for (const s of plan.sessions) if (s.programme === 'skillWork') add += TRAIT_RATE * INT[s.intensity].gain * personality(p) * (p.age <= 24 ? 1 : 0.85);
  if (add <= 0) return null;
  progress[id] = Math.min(TRAIT_GOAL, (progress[id] ?? 0) + add);
  if ((progress[id] ?? 0) >= TRAIT_GOAL) { p.traits.push(id); return id; }
  return null;
}
