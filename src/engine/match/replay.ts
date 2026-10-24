import type { Player } from '../player';
import type { Position } from '../positions';
import type { FormationId, MatchEvent, MatchResult, SeqStep } from './types';

export interface ReplayPlayer {
  id: string;
  name: string;
  num: number;
  side: 'h' | 'a';
  idx: number;
  pos: Position;
  on: number;
  off: number;
  human: boolean;
}

export interface ReplayTeam { clubId: string; name: string; short: string; c1: string; c2: string; formation: FormationId }

/** Everything the 2D view needs to replay a match, self-contained so a stored report can be watched again. */
export interface Replay {
  h: ReplayTeam;
  a: ReplayTeam;
  players: ReplayPlayer[];
  steps: SeqStep[];
  events: MatchEvent[];
  hg: number;
  ag: number;
}

const NUMBERS: Record<Position, number[]> = {
  GK: [1], FB: [2, 3], CB: [5, 4, 6], DM: [6, 4], CM: [8, 10, 7], AM: [10], W: [7, 11], ST: [9, 10],
};

export interface PlayerInfo { id: string; name: string; side: 'h' | 'a'; idx: number; pos: Position; on: number; off: number; start: boolean; human: boolean }

/** Shirt numbers: starters by position, substitutes from 12. */
export function numberPlayers(list: PlayerInfo[]): ReplayPlayer[] {
  const out: ReplayPlayer[] = [];
  for (const side of ['h', 'a'] as const) {
    const used = new Set<number>();
    const mine = list.filter(p => p.side === side).sort((x, y) => Number(y.start) - Number(x.start) || x.idx - y.idx);
    let sub = 12;
    for (const p of mine) {
      let num = p.start ? NUMBERS[p.pos].find(n => !used.has(n)) ?? 0 : 0;
      if (!num) { while (used.has(sub)) sub++; num = sub++; }
      used.add(num);
      out.push({ id: p.id, name: p.name, num, side, idx: p.idx, pos: p.pos, on: p.on, off: p.off, human: p.human });
    }
  }
  return out;
}

export function buildReplay(r: MatchResult, h: ReplayTeam, a: ReplayTeam, byId: (id: string) => Player): Replay {
  const players = numberPlayers(Object.values(r.players).map(pm => ({ id: pm.id, name: byId(pm.id).name, side: pm.side, idx: pm.idx, pos: pm.pos, on: pm.on, off: pm.off, start: pm.start, human: byId(pm.id).human })));
  return { h, a, players, steps: r.steps, events: r.events, hg: r.hg, ag: r.ag };
}
