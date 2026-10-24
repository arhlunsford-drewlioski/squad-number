import type { Player } from '../player';
import type { Position } from '../positions';
import type { Status } from './lineup';
import type { Replay } from './replay';
import type { MomentLog } from '../moments/types';
import type { FormationId, MatchEvent, MatchResult, Mentality, PlayerMatch, TeamStats } from './types';

export type LineKind = 'goal-us' | 'goal-them' | 'card' | 'sub' | 'you' | 'note';
export interface ReportLine { min: number; text: string; kind: LineKind }

export interface ReportRow {
  id: string;
  name: string;
  pos: Position;
  rating: number;
  g: number;
  a: number;
  min: number;
  yellow: number;
  red: number;
  sub: boolean;
  human: boolean;
}

export interface MatchReport {
  season: number;
  week: number;
  division: string;
  h: string;
  a: string;
  hg: number;
  ag: number;
  mySide: 'h' | 'a';
  result: 'w' | 'd' | 'l';
  /** Absent on reports saved before cups existed, which are league matches. */
  comp?: 'league' | 'cup';
  /** Penalty shoot-out score, home first, when a cup tie was level after 90 minutes. */
  pens?: [number, number];
  lines: ReportLine[];
  team: { h: TeamStats; a: TeamStats };
  formation: { h: FormationId; a: FormationId };
  mentality: { h: Mentality; a: Mentality };
  ratings: { h: ReportRow[]; a: ReportRow[] };
  status: Status;
  note: string;
  me: PlayerMatch | null;
  replay: Replay;
  /** Your decisions in the match. Absent on reports saved before moments existed. */
  moments?: MomentLog[];
  motm: { name: string; club: string; rating: number } | null;
}

const GOAL = [
  ['finishes low into the corner', 'finish low into the corner'],
  ['heads in at the near post', 'head in at the near post'],
  ['fires in from the edge of the box', 'fire in from the edge of the box'],
  ['rounds the keeper and scores', 'round the keeper and score'],
  ['curls one into the top corner', 'curl one into the top corner'],
  ['taps in at the back post', 'tap in at the back post'],
  ["drills it through the keeper's legs", "drill it through the keeper's legs"],
  ['scores with a volley', 'score with a volley'],
];
const HEADER = [['rises highest and heads in', 'rise highest and head in'], ['powers a header past the keeper', 'power a header past the keeper']];
const LONG = [['hits it from distance and it flies in', 'hit it from distance and it flies in'], ['lets fly from 25 yards and scores', 'let fly from 25 yards and score']];
const NOUN = ['through ball', 'cross', 'cut-back', 'low pass', 'header across goal'];

export function buildLines(r: MatchResult, mySide: 'h' | 'a', humanId: string, nameOf: (id: string) => string, clubName: (side: 'h' | 'a') => string, pick: <T>(a: readonly T[]) => T): ReportLine[] {
  const lines: ReportLine[] = [];
  const you = (id: string) => id === humanId;
  const nm = (id: string) => (you(id) ? 'You' : nameOf(id));
  const poss = (id: string) => (you(id) ? 'your' : nameOf(id) + "'s");
  const verb = (e: MatchEvent) => {
    const set = e.how === 'header' ? HEADER : e.how === 'long' ? LONG : GOAL;
    const v = pick(set);
    return you(e.p) ? v[1] : v[0];
  };
  let h = 0, a = 0;
  for (const e of r.events) {
    if (e.type === 'goal' || e.type === 'penalty') {
      if (e.side === 'h') h++; else a++;
      let t = `GOAL, ${clubName(e.side)} (${h}-${a}). ${nm(e.p)} ${e.type === 'penalty' ? (you(e.p) ? 'score from the spot' : 'scores from the spot') : verb(e)}`;
      if (e.a) t += `, from ${poss(e.a)} ${pick(NOUN)}`;
      if (e.err) t += `. ${you(e.err) ? 'Your' : nameOf(e.err) + "'s"} mistake let them in`;
      lines.push({ min: e.min, text: t + '.', kind: e.side === mySide ? 'goal-us' : 'goal-them' });
    } else if (e.type === 'yellow' || e.type === 'red') {
      lines.push({ min: e.min, text: `${e.type === 'red' ? 'Red card' : 'Yellow card'} for ${nm(e.p)} (${clubName(e.side)}).`, kind: you(e.p) ? 'you' : 'card' });
    } else if (e.type === 'sub') {
      if (you(e.p)) lines.push({ min: e.min, text: `You come on for ${nameOf(e.d!)}.`, kind: 'you' });
      else if (e.d && you(e.d)) lines.push({ min: e.min, text: `You are replaced by ${nameOf(e.p)}.`, kind: 'you' });
    } else if (you(e.p)) {
      const t = e.type === 'save' ? `You ${pick(['force a save from the keeper', 'are denied by the keeper', 'shoot straight at the keeper'])}.` : e.type === 'block' ? `Your shot is blocked by ${nameOf(e.d!)}.` : `You ${pick(['drag a shot wide', 'blaze over the bar', 'hit the post', 'scuff your shot'])}.`;
      lines.push({ min: e.min, text: t, kind: 'you' });
    } else if (e.a && you(e.a)) {
      const out = e.type === 'save' ? 'is denied by the keeper' : e.type === 'block' ? 'sees the shot blocked' : 'misses the target';
      lines.push({ min: e.min, text: `Your ${pick(NOUN)} finds ${nameOf(e.p)}, who ${out}.`, kind: 'you' });
    } else if (e.d && you(e.d)) {
      lines.push({ min: e.min, text: e.type === 'save' ? `You save from ${nameOf(e.p)}.` : `You block ${nameOf(e.p)}'s shot.`, kind: 'you' });
    }
  }
  return lines;
}

export function rowsFor(r: MatchResult, side: 'h' | 'a', byId: (id: string) => Player): ReportRow[] {
  return Object.values(r.players)
    .filter(p => p.side === side)
    .map(p => ({ id: p.id, name: byId(p.id).name, pos: p.pos, rating: p.rating, g: p.g, a: p.a, min: p.min, yellow: p.yellow, red: p.red, sub: !p.start, human: byId(p.id).human }))
    .sort((x, y) => (x.sub === y.sub ? 0 : x.sub ? 1 : -1));
}
