import type { Rng } from '../rng';
import type { Game } from '../game';
import type { CupRound, CupState, CupTie } from './types';

export const CUP_NAME = 'Crown Cup';

/** The rounds, each played after the given league matchday. */
export const CUP_ROUNDS: { name: string; after: number }[] = [
  { name: 'Preliminary round', after: 4 },
  { name: 'First round', after: 9 },
  { name: 'Second round', after: 14 },
  { name: 'Round of 16', after: 20 },
  { name: 'Quarter-final', after: 26 },
  { name: 'Semi-final', after: 31 },
  { name: 'Final', after: 37 },
];

const BRACKET = 64;

export const cupRoundAt = (played: number) => CUP_ROUNDS.findIndex(r => r.after === played);

function pair(ids: string[], rng: Rng, neutral: boolean): CupTie[] {
  const a = ids.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng.next() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  const ties: CupTie[] = [];
  for (let i = 0; i + 1 < a.length; i += 2) ties.push({ h: a[i], a: a[i + 1], hg: null, ag: null, winner: null, neutral: neutral || undefined });
  return ties;
}

/** A new cup: every club enters. The strongest clubs skip the preliminary round. */
export function makeCup(g: Game, rng: Rng): CupState {
  const order = [...g.clubs].sort((x, y) => x.division - y.division || y.rating - x.rating).map(c => c.id);
  const preTies = Math.max(0, order.length - BRACKET);
  const byes = order.slice(0, order.length - preTies * 2);
  const preliminary = order.slice(order.length - preTies * 2);
  const rounds: CupRound[] = CUP_ROUNDS.map((r, i) => ({ name: r.name, after: r.after, ties: [], byes: i === 0 ? byes : [] }));
  rounds[0].ties = pair(preliminary, rng, false);
  const cup: CupState = { season: g.season, rounds, alive: order, winner: null, pending: null, outAt: null };
  if (preTies === 0) { rounds[0].ties = []; cup.alive = order; drawRound(cup, 1, rng); }
  return cup;
}

/** Draws a round from the clubs still in. */
export function drawRound(cup: CupState, ri: number, rng: Rng): void {
  cup.rounds[ri].ties = pair(cup.alive, rng, ri >= 5);
}

/** Wins a shoot-out: five kicks each, then sudden death. */
export function shootout(rng: Rng, edgeH: number): [number, number] {
  const pH = Math.min(0.82, Math.max(0.68, 0.76 + edgeH * 0.002)), pA = Math.min(0.82, Math.max(0.68, 0.76 - edgeH * 0.002));
  let h = 0, a = 0;
  for (let i = 0; i < 5; i++) { if (rng.chance(pH)) h++; if (rng.chance(pA)) a++; }
  let guard = 0;
  while (h === a && guard++ < 20) { if (rng.chance(pH)) h++; if (rng.chance(pA)) a++; }
  if (h === a) h++;
  return [h, a];
}

/** Settles a tie from its score, going to penalties when it is level. */
export function settleTie(tie: CupTie, hg: number, ag: number, rng: Rng, ratingEdge: number): void {
  tie.hg = hg; tie.ag = ag;
  if (hg !== ag) { tie.winner = hg > ag ? tie.h : tie.a; return; }
  tie.pens = shootout(rng, ratingEdge);
  tie.winner = tie.pens[0] > tie.pens[1] ? tie.h : tie.a;
}

/** Closes a round once every tie has a winner and draws the next one. */
export function finishRound(cup: CupState, ri: number, rng: Rng): void {
  const winners = cup.rounds[ri].ties.map(t => t.winner!);
  cup.alive = ri === 0 ? [...cup.rounds[0].byes, ...winners] : winners;
  if (ri === cup.rounds.length - 1) { cup.winner = winners[0] ?? null; cup.alive = winners; return; }
  drawRound(cup, ri + 1, rng);
}

export const roundDone = (cup: CupState, ri: number) => cup.rounds[ri].ties.length > 0 && cup.rounds[ri].ties.every(t => t.winner);

/** The round the cup is waiting to play, or -1 when it is over. */
export function currentRound(cup: CupState): number {
  for (let i = 0; i < cup.rounds.length; i++) if (!roundDone(cup, i) && (cup.rounds[i].ties.length > 0 || i === 0)) return i;
  return -1;
}

/** A quick result for a tie nobody plays, from club strength alone. Used to catch an old save up. */
export function quickTie(g: Game, tie: CupTie, rng: Rng): void {
  const rating = (id: string) => g.clubs.find(c => c.id === id)!.rating;
  const edge = rating(tie.h) - rating(tie.a);
  const goals = (e: number) => { const l = 1.3 * Math.exp(0.07 * e); let k = 0, p = Math.exp(-l), s = p; const u = rng.next(); while (u > s && k < 8) { k++; p *= l / k; s += p; } return k; };
  settleTie(tie, goals(edge), goals(-edge), rng, edge);
}

export const roundName = (cup: CupState, ri: number) => cup.rounds[ri].name;
