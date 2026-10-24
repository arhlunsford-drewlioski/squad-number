import type { AttrId } from '../attributes';
import type { Player } from '../player';
import type { Position } from '../positions';
import type { Instructions, SeqStep } from '../match/types';
import type { TraitId } from '../traits';

export type Risk = 'safe' | 'balanced' | 'gamble';
export type Tier = 'great' | 'good' | 'poor' | 'disaster';
export const TIERS: Tier[] = ['great', 'good', 'poor', 'disaster'];
export type Kind = 'attack' | 'build' | 'defend' | 'any';

/** What an option leads to. Shots and chances resolve directly from the option's check. */
export type ResultKind =
  | 'goal' | 'saved' | 'wide' | 'blocked'      // you shoot
  | 'assist' | 'keyPass'                        // a teammate shoots from your pass
  | 'retain' | 'turnover' | 'counter'           // possession
  | 'tackleWon' | 'cleared' | 'oppShot'         // defending
  | 'foulConceded' | 'foulWon' | 'injury' | 'nothing'
  | 'follow';                                   // a second decision

export type Script =
  | 'oneOnOne' | 'wide' | 'crossIn' | 'loose' | 'longRange' | 'freeKick' | 'counter' | 'holdUp' | 'buildUp' | 'secondBall'
  | 'defendRun' | 'defendCross' | 'block' | 'gkThrough' | 'gk1v1' | 'corner' | 'gkBall' | 'protect' | 'inBox' | 'any';

export type Weights = Partial<Record<AttrId, number>>;
/** Who in the opposition the player faces in this moment. */
export type Matchup = 'gk' | 'FB' | 'CB' | 'DM' | 'MID' | 'ATT' | 'DEF' | 'none';
export type MateWho = 'ATT' | 'W' | 'ST' | 'CM' | 'any';

export interface Outcome {
  r: ResultKind;
  text: string;
  /** Chance quality for shots the opposition takes after this outcome. */
  q?: number;
  /** Template id of a follow-up decision. */
  follow?: string;
  /** Match rating change, for outcomes the normal stats do not already reward. */
  rate?: number;
  /** Confidence change. */
  conf?: number;
  /** Chance of a yellow and a red card after a foul. */
  card?: { y: number; r: number };
  how?: 'open' | 'header' | 'long';
  /** For injuries: weeks out after the match. */
  weeks?: number;
}

export interface OptionDef {
  id: string;
  label: string;
  desc: string;
  risk: Risk;
  /** Your attributes that drive the check, as weights. */
  mine: Weights;
  /** The opponent's attributes that drive it, or the keeper, or the opposition's defensive shape. */
  theirs: Weights | 'gk' | 'team';
  /** Added to the edge. Positive makes the option easier. */
  bias?: number;
  /** The option only appears for players with enough of an attribute. */
  needs?: { attr: AttrId; min: number };
  /** The option only appears for players who have learned this trait. */
  trait?: TraitId;
  /** A trait that makes the option easier. */
  traitBonus?: { trait: TraitId; bias: number };
  /** Outcomes for great, good, poor and disaster executions. */
  out: [Outcome, Outcome, Outcome, Outcome];
}

export interface WhenCtx { minute: number; lead: number; slot: Position }

export interface TemplateDef {
  id: string;
  title: string;
  kind: Kind;
  script: Script;
  for: Position[];
  opp: Matchup;
  mate?: MateWho;
  prompt: string;
  /** Composure and Big Matches matter more in this moment. */
  pressure?: boolean;
  followOnly?: boolean;
  when?: (c: WhenCtx) => boolean;
  weight?: (c: WhenCtx) => number;
  options: OptionDef[];
}

export interface MomentCtx {
  minute: number;
  /** Goals scored minus goals conceded by the human's team. */
  lead: number;
  slot: Position;
  me: Player;
  fat: number;
  conf: number;
  opp: Player | null;
  oppFat: number;
  mate: Player | null;
  gk: Player | null;
  /** Average defensive shape rating of the opposition's outfielders. */
  teamShield: number;
  /** Average attributes of the opposition's outfielders, for reads. */
  oppAvg: Weights;
  instr?: Instructions;
}

export type Band = 'likely' | 'even' | 'risky' | 'unclear';

export interface OptionView {
  id: string;
  label: string;
  desc: string;
  risk: Risk;
  band: Band;
  locked: boolean;
  lockText?: string;
}

/** What the decision card shows. Serialisable. */
export interface MomentRequest {
  id: string;
  title: string;
  minute: number;
  script: Script;
  scoreOwn: number;
  scoreOpp: number;
  prompt: string;
  /** True when the human is defending, so the scene is staged in his own half. */
  defending: boolean;
  side: 'h' | 'a';
  humanId: string;
  opp?: { id: string; name: string; pos: Position };
  mate?: { id: string; name: string; pos: Position };
  gk?: { id: string; name: string };
  options: OptionView[];
  tips: string[];
  /** 0 to 1. How well you read the game, from Vision, Decisions and Anticipation. */
  read: number;
  stage: 1 | 2;
}

export interface MomentOutcome {
  id: string;
  title: string;
  minute: number;
  optionId: string;
  optionLabel: string;
  tier: Tier;
  result: ResultKind;
  text: string;
  rate: number;
  conf: number;
  steps: SeqStep[];
  follow: boolean;
  goal: 'own' | 'opp' | null;
}

export interface MomentLog { minute: number; title: string; option: string; tier: Tier; result: ResultKind; text: string; auto: boolean }
