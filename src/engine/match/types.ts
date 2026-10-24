import type { Player } from '../player';
import type { Position } from '../positions';

export type FormationId = '4-4-2' | '4-3-3' | '4-2-3-1' | '3-5-2' | '4-1-4-1';
export type Mentality = 'defensive' | 'balanced' | 'attacking';

/** The human player's instructions. They bend how the match engine involves and uses the player. */
export interface Instructions {
  shooting: 'less' | 'normal' | 'more';
  movement: 'hold' | 'normal' | 'roam';
  defending: 'drop' | 'normal' | 'press';
}
export const DEFAULT_INSTRUCTIONS: Instructions = { shooting: 'normal', movement: 'normal', defending: 'normal' };

export interface Slot { player: Player; slot: Position }

export interface Lineup {
  clubId: string;
  formation: FormationId;
  xi: Slot[];
  bench: Player[];
  /** Selection score per player id, used to explain choices. */
  scores: Record<string, number>;
  /** The manager's lean: positive for attacking football, negative for cautious. */
  mentBias: number;
}

export type EventType = 'goal' | 'save' | 'block' | 'miss' | 'yellow' | 'red' | 'sub' | 'penalty';

export interface MatchEvent {
  min: number;
  side: 'h' | 'a';
  type: EventType;
  /** Main player: shooter, carded player, or player coming on. */
  p: string;
  /** Assister or creator. */
  a?: string;
  /** Defender (blocker), keeper (saves), or player replaced. */
  d?: string;
  xg?: number;
  /** Defender whose mistake created the chance. */
  err?: string;
  how?: 'open' | 'header' | 'long' | 'penalty';
}

export interface PlayerMatch {
  id: string;
  side: 'h' | 'a';
  /** Index of the formation slot the player occupies. A substitute takes the slot of the player they replace. */
  idx: number;
  pos: Position;
  start: boolean;
  on: number;
  off: number;
  min: number;
  g: number; a: number; sh: number; sot: number; xg: number; kp: number; sv: number; bl: number; err: number;
  /** Where the rating came from, for the human only: label and points. */
  parts?: [string, number][];
  passes: number; passOk: number; tk: number; tkWon: number; int: number; fouls: number; yellow: number; red: number;
  /** Rating change from the human's decisions in moments. */
  mom: number;
  rating: number;
}

export interface TeamStats { possession: number; shots: number; onTarget: number; xg: number; fouls: number; yellow: number; red: number }

/** One possession sequence, as the 2D view needs it. Sequences that end in nothing are plain 'move' steps. */
export interface SeqStep {
  min: number;
  att: 'h' | 'a';
  kind: 'move' | 'goal' | 'save' | 'block' | 'miss' | 'pen-goal' | 'pen-save' | 'pen-miss';
  shooter?: string;
  creator?: string;
  blocker?: string;
  keeper?: string;
  err?: string;
  how?: 'open' | 'header' | 'long' | 'penalty';
  xg?: number;
  /** Produced by a decision moment. */
  moment?: boolean;
}

export interface MatchResult {
  hg: number;
  ag: number;
  events: MatchEvent[];
  players: Record<string, PlayerMatch>;
  team: { h: TeamStats; a: TeamStats };
  mentality: { h: Mentality; a: Mentality };
  /** Every possession sequence in order, for replay. */
  steps: SeqStep[];
  /** The human's decisions, when moments were on. */
  moments?: { logs: import('../moments/types').MomentLog[]; confidence: number; used: string[]; injuredWeeks: number };
}
