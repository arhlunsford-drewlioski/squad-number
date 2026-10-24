import { makeRng, type Rng } from '../rng';
import { clubOf, humanOf, lineupCtx, pushMessage, type Game } from '../game';
import { applyMatch, recordHumanMatch, type MatchCommon, type WeekState } from '../matchday';
import { bestLineup, statusIn } from '../match/lineup';
import { simulateMatch } from '../match/sim';
import type { MatchResult } from '../match/types';
import { coachFactor } from '../training';
import { checkAchievements } from './achievements';
import { cupRoundAt, CUP_NAME, finishRound, roundDone, settleTie } from './cup';
import type { CupTie } from './types';

const involves = (t: CupTie, clubId: string | null) => !!clubId && (t.h === clubId || t.a === clubId);

/** Plays the cup round that falls after this matchday, apart from your own tie, which waits for you. */
export function cupAfterWeek(g: Game, played: number, rng: Rng): void {
  const cup = g.cup;
  if (cup.season !== g.season || cup.pending) return;
  const ri = cupRoundAt(played);
  if (ri < 0 || cup.rounds[ri].ties.length === 0 || roundDone(cup, ri)) return;
  const me = humanOf(g);
  const ctx = lineupCtx(g);
  const common: MatchCommon = { rng, justInjured: new Set(), justSuspended: new Set(), played: new Set(), coach: new Map(g.clubs.map(c => [c.id, coachFactor(c.rating)])), hard: 0 };
  const round = cup.rounds[ri];
  round.ties.forEach((tie, ti) => {
    if (tie.winner) return;
    if (involves(tie, me.clubId)) {
      cup.pending = { round: ri, tie: ti };
      const opp = clubOf(g, tie.h === me.clubId ? tie.a : tie.h)!;
      pushMessage(g, { week: g.week, from: CUP_NAME, subject: `${round.name}: ${clubOf(g, me.clubId)!.short} v ${opp.short}`, body: `Your club has been drawn against ${opp.name} in the ${round.name}${tie.neutral ? ', at a neutral ground' : tie.h === me.clubId ? ', at home' : ', away'}. The tie is played before the next league match.` });
      return;
    }
    const H = bestLineup(g.players, tie.h, { ...ctx, mgr: clubOf(g, tie.h)!.mgr });
    const A = bestLineup(g.players, tie.a, { ...ctx, mgr: clubOf(g, tie.a)!.mgr });
    const r = simulateMatch(H, A, rng);
    applyMatch(g, common, tie, r, false);
    settleTie(tie, r.hg, r.ag, rng, clubOf(g, tie.h)!.rating - clubOf(g, tie.a)!.rating);
  });
  if (!cup.pending && roundDone(cup, ri)) finishRound(cup, ri, rng);
  // A club that is out in the preliminary round has nothing to play; nothing more to do for the human either.
}

/** Sets up your cup tie, ready to be played live or by the engine. Null when there is none. */
export function beginCupTie(g: Game): WeekState | null {
  const cup = g.cup;
  if (!cup.pending || g.phase !== 'play') return null;
  const { round: ri, tie: ti } = cup.pending;
  const tie = cup.rounds[ri].ties[ti];
  const me = humanOf(g);
  const rng = makeRng(g.seed + 7919 * (ri + 1));
  const ctx = lineupCtx(g);
  const H = bestLineup(g.players, tie.h, { ...ctx, mgr: clubOf(g, tie.h)!.mgr });
  const A = bestLineup(g.players, tie.a, { ...ctx, mgr: clubOf(g, tie.a)!.mgr });
  const mySide = tie.h === me.clubId ? 'h' : 'a';
  return {
    rng, me, fx: tie, division: `${CUP_NAME}, ${cup.rounds[ri].name}`, H, A, mySide, status: statusIn(mySide === 'h' ? H : A, me, ctx),
    justInjured: new Set(), justSuspended: new Set(), played: new Set(), coach: new Map(g.clubs.map(c => [c.id, coachFactor(c.rating)])), hard: 0,
  };
}

/** Records your cup tie, then moves the competition on. */
export function completeCupTie(g: Game, ws: WeekState, r: MatchResult): void {
  const cup = g.cup;
  const { round: ri, tie: ti } = cup.pending!;
  const tie = cup.rounds[ri].ties[ti];
  const { me } = ws;
  const wasInjured = me.injuredWeeks > 0;
  const motm = applyMatch(g, ws, tie, r, false);
  if (r.moments && r.moments.injuredWeeks > 0) me.injuredWeeks = Math.max(me.injuredWeeks, r.moments.injuredWeeks);
  if (!wasInjured && me.injuredWeeks > 0) { g.injuryHandled = false; g.flags['s:injuredAt'] = g.week; }
  settleTie(tie, r.hg, r.ag, ws.rng, clubOf(g, tie.h)!.rating - clubOf(g, tie.a)!.rating);
  const report = recordHumanMatch(g, ws, r, motm, { key: 100 + ri, comp: 'cup', pens: tie.pens });

  const pm = report.me;
  if (pm && pm.min > 0) { g.career.cup.apps++; g.career.cup.goals += pm.g; g.career.cup.assists += pm.a; }
  const through = tie.winner === me.clubId;
  if (!through) {
    cup.outAt = ri;
    pushMessage(g, { week: g.week, from: CUP_NAME, subject: `Out of the ${CUP_NAME}`, body: `Your club went out in the ${cup.rounds[ri].name}.` });
  } else if (ri === cup.rounds.length - 1) {
    pushMessage(g, { week: g.week, from: CUP_NAME, subject: `Winners of the ${CUP_NAME}`, body: 'Your club has won the cup.' });
  }
  g.sitOut = false;
  g.risk = false;
  cup.pending = null;
  if (roundDone(cup, ri)) finishRound(cup, ri, ws.rng);
  g.seed = ws.rng.seed();
  checkAchievements(g, 'match', { rep: report, cupFinalGoal: ri === cup.rounds.length - 1 && !!pm && pm.g > 0 });
}
