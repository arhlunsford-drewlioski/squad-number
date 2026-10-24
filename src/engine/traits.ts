import type { AttrId } from './attributes';
import type { Player } from './player';
import type { Position } from './positions';

export type TraitId =
  | 'finesseShot' | 'chipShot' | 'trickster' | 'pressResistant' | 'aerialThreat' | 'setPiece' | 'sweeperKeeper'
  | 'reader' | 'hardTackler' | 'poacher' | 'playmaker' | 'shotStopper';

export interface TraitDef {
  id: TraitId;
  label: string;
  desc: string;
  /** Attribute minimums needed before the trait can be learned. */
  prereq: Partial<Record<AttrId, number>>;
  /** Positions the trait suits, for suggestions. */
  suits: Position[];
}

export const TRAITS: TraitDef[] = [
  { id: 'finesseShot', label: 'Finesse shot', desc: 'Curl the ball round the keeper. Opens a curling option on shots.', prereq: { technique: 12, finishing: 10 }, suits: ['ST', 'AM', 'W', 'CM'] },
  { id: 'chipShot', label: 'Chip', desc: 'Lift the ball over a keeper or defender with a delicate touch.', prereq: { technique: 11, composure: 10 }, suits: ['ST', 'AM', 'W'] },
  { id: 'trickster', label: 'Trickster', desc: 'Skill moves to beat a defender. Opens flair options in one-on-ones.', prereq: { dribbling: 13, agility: 12 }, suits: ['W', 'AM', 'ST', 'FB'] },
  { id: 'pressResistant', label: 'Press resistant', desc: 'Stay calm and turn away when closed down. Helps you escape pressure.', prereq: { composure: 12, firstTouch: 12, balance: 10 }, suits: ['CM', 'DM', 'AM', 'CB', 'GK'] },
  { id: 'aerialThreat', label: 'Aerial threat', desc: 'Dominant in the air. Opens back-post options and helps in aerial duels.', prereq: { heading: 13, jumping: 12 }, suits: ['ST', 'CB', 'DM'] },
  { id: 'setPiece', label: 'Set-piece specialist', desc: 'Deadly from dead balls. Opens curling free kicks and helps deliveries.', prereq: { technique: 12, crossing: 12 }, suits: ['AM', 'CM', 'W', 'FB'] },
  { id: 'sweeperKeeper', label: 'Sweeper keeper', desc: 'Command the space behind the defence. Opens high sweeping options.', prereq: { commandOfArea: 12, kicking: 11, anticipation: 10 }, suits: ['GK'] },
  { id: 'reader', label: 'Reads the game', desc: 'See situations a step earlier. You read moments better and can intercept.', prereq: { anticipation: 14, vision: 12 }, suits: ['CM', 'DM', 'CB', 'AM'] },
  { id: 'hardTackler', label: 'Hard tackler', desc: 'Win the ball with a crunching challenge. Opens sliding tackles.', prereq: { tackling: 13, aggression: 11 }, suits: ['CB', 'DM', 'FB', 'CM'] },
  { id: 'poacher', label: 'Poacher', desc: 'Always in the right place. Opens sharper movement in the box.', prereq: { offTheBall: 13, finishing: 12 }, suits: ['ST', 'W', 'AM'] },
  { id: 'playmaker', label: 'Playmaker', desc: 'The pass others do not see. Opens inch-perfect passing options.', prereq: { vision: 13, passing: 13 }, suits: ['CM', 'AM', 'DM'] },
  { id: 'shotStopper', label: 'Shot stopper', desc: 'Sharp on the line. Helps in saves and opens a reaction option.', prereq: { reflexes: 14, handling: 11 }, suits: ['GK'] },
];
export const TRAIT_BY_ID = Object.fromEntries(TRAITS.map(t => [t.id, t])) as Record<TraitId, TraitDef>;

export const hasTrait = (p: { traits?: TraitId[] }, id: TraitId) => !!p.traits && p.traits.includes(id);

/** Which prerequisites a player does not yet meet. */
export function missingPrereq(p: Pick<Player, 'attrs'>, t: TraitDef): { attr: AttrId; need: number; have: number }[] {
  return (Object.entries(t.prereq) as [AttrId, number][])
    .filter(([a, n]) => Math.round(p.attrs[a]) < n)
    .map(([attr, need]) => ({ attr, need, have: Math.round(p.attrs[attr]) }));
}

/** Progress points per session each week. 100 unlocks the trait. */
export const TRAIT_RATE = 9;
export const TRAIT_GOAL = 100;
