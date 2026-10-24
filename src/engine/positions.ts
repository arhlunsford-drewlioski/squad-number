import { ATTR_IDS, type AttrId } from './attributes';

export type Position = 'GK' | 'CB' | 'FB' | 'DM' | 'CM' | 'AM' | 'W' | 'ST';

export const POSITIONS: { id: Position; label: string; long: string; height: [number, number] }[] = [
  { id: 'GK', label: 'GK', long: 'Goalkeeper', height: [185, 200] },
  { id: 'CB', label: 'CB', long: 'Centre Back', height: [182, 198] },
  { id: 'FB', label: 'FB', long: 'Full Back', height: [168, 184] },
  { id: 'DM', label: 'DM', long: 'Defensive Midfielder', height: [175, 190] },
  { id: 'CM', label: 'CM', long: 'Central Midfielder', height: [170, 188] },
  { id: 'AM', label: 'AM', long: 'Attacking Midfielder', height: [166, 184] },
  { id: 'W', label: 'W', long: 'Winger', height: [165, 182] },
  { id: 'ST', label: 'ST', long: 'Striker', height: [172, 196] },
];
export const POS_BY_ID = Object.fromEntries(POSITIONS.map(p => [p.id, p])) as Record<Position, (typeof POSITIONS)[number]>;

// Relative importance of each attribute for a position. Normalised to sum to 1 below.
const raw: Record<Position, Partial<Record<AttrId, number>>> = {
  GK: { handling: 5, reflexes: 5, aerialReach: 3, commandOfArea: 3, oneOnOnes: 3, kicking: 2, positioning: 3, concentration: 3, composure: 2, decisions: 2, anticipation: 2, agility: 2, jumping: 1 },
  CB: { tackling: 5, marking: 5, heading: 4, positioning: 5, strength: 3, jumping: 3, anticipation: 3, concentration: 2, pace: 2, aggression: 1.5, composure: 2, decisions: 2, passing: 1 },
  FB: { tackling: 3.5, marking: 3, pace: 3.5, stamina: 3, crossing: 2.5, positioning: 3, workRate: 2.5, acceleration: 2.5, anticipation: 2, dribbling: 1.5, passing: 1.5, agility: 1 },
  DM: { tackling: 4, positioning: 4, anticipation: 3.5, passing: 3, workRate: 3, decisions: 3, stamina: 3, marking: 2.5, composure: 2, strength: 2, concentration: 2, firstTouch: 1.5, aggression: 1.5 },
  CM: { passing: 5, vision: 3.5, decisions: 3.5, firstTouch: 3, stamina: 3, workRate: 3, tackling: 2, technique: 2.5, composure: 2.5, offTheBall: 2, positioning: 1.5, longShots: 1.5, dribbling: 1.5 },
  AM: { vision: 4, passing: 4, technique: 3.5, dribbling: 3.5, firstTouch: 3.5, offTheBall: 3, composure: 3, decisions: 3, longShots: 2, finishing: 2, agility: 1.5, acceleration: 1.5 },
  W: { pace: 4, acceleration: 4, dribbling: 4, crossing: 3, agility: 3, offTheBall: 2.5, technique: 2.5, firstTouch: 2.5, stamina: 2, finishing: 1.5, passing: 1.5, balance: 1.5, workRate: 1.5 },
  ST: { finishing: 6, offTheBall: 4, composure: 3.5, pace: 3, acceleration: 2.5, firstTouch: 2.5, heading: 2.5, dribbling: 2, strength: 2, anticipation: 2, decisions: 1.5, technique: 1.5, balance: 1, jumping: 1 },
};

export type Weights = Record<AttrId, number>;

export const WEIGHTS: Record<Position, Weights> = Object.fromEntries(
  (Object.keys(raw) as Position[]).map(pos => {
    const r = raw[pos];
    const total = Object.values(r).reduce((a, b) => a + (b ?? 0), 0);
    const w = Object.fromEntries(ATTR_IDS.map(id => [id, (r[id] ?? 0) / total])) as Weights;
    return [pos, w];
  }),
) as Record<Position, Weights>;

/** Attributes that matter most for a position, strongest first. */
export function keyAttrs(pos: Position, n = 6): AttrId[] {
  const w = WEIGHTS[pos];
  return [...ATTR_IDS].sort((a, b) => w[b] - w[a]).slice(0, n);
}
