import type { OptionDef, Outcome, ResultKind, Risk, Weights } from './types';

export const O = (r: ResultKind, text: string, extra: Partial<Outcome> = {}): Outcome => ({ r, text, ...extra });
export const GOAL = (text: string, how?: Outcome['how']) => O('goal', text, how ? { how } : {});
export const SAVE = (text: string) => O('saved', text);
export const WIDE = (text: string) => O('wide', text);
export const BLOCK = (text: string) => O('blocked', text);
export const ASSIST = (text: string) => O('assist', text);
export const KEY = (text: string) => O('keyPass', text);
export const KEEP = (text: string, rate?: number) => O('retain', text, rate ? { rate } : {});
export const LOSE = (text: string, rate?: number) => O('turnover', text, rate ? { rate } : {});
export const BREAK = (text: string, q = 0.2) => O('counter', text, { q });
export const WIN = (text: string) => O('tackleWon', text);
export const CLEAR = (text: string, rate?: number) => O('cleared', text, rate ? { rate } : {});
export const SHOT = (text: string, q: number, how?: Outcome['how']) => O('oppShot', text, how ? { q, how } : { q });
export const FOUL = (text: string, y: number, r: number, q: number) => O('foulConceded', text, { card: { y, r }, q });
export const WON = (text: string) => O('foulWon', text);
export const FOLLOW = (text: string) => O('follow', text, { follow: 'inTheBox' });
export const NOTHING = (text: string, conf = 0, rate = 0) => O('nothing', text, { conf, rate });
export const HURT = (text: string, weeks: number) => O('injury', text, { weeks, rate: -0.3, conf: -3 });

export const opt = (id: string, label: string, desc: string, risk: Risk, mine: Weights, theirs: Weights | 'gk' | 'team', bias: number, out: [Outcome, Outcome, Outcome, Outcome], extra: Partial<OptionDef> = {}): OptionDef =>
  ({ id, label, desc, risk, mine, theirs, bias, out, ...extra });

export const FIN = { finishing: 0.4, composure: 0.35, technique: 0.15, firstTouch: 0.1 };
export const PASSER = { passing: 0.4, vision: 0.3, composure: 0.2, decisions: 0.1 };
export const RUNNER = { dribbling: 0.3, acceleration: 0.25, technique: 0.15, balance: 0.15, composure: 0.15 };
export const CHASE = { pace: 0.4, acceleration: 0.2, anticipation: 0.2, positioning: 0.2 };
export const DUEL_DEF = { tackling: 0.3, pace: 0.25, anticipation: 0.2, balance: 0.1, agility: 0.15 };
export const SHOOTER = { finishing: 0.4, composure: 0.3, technique: 0.3 };
export const AERIAL: Weights = { heading: 0.35, jumping: 0.3, strength: 0.2, anticipation: 0.15 };
export const MARK: Weights = { marking: 0.35, positioning: 0.3, anticipation: 0.2, concentration: 0.15 };
