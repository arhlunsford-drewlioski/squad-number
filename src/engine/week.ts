import { clamp, makeRng, type Rng } from './rng';
import { humanOf, lineupCtx, pushMessage, WEEKS, type Game } from './game';
import { applyMatch, recordHumanMatch, type WeekState } from './matchday';
import { beginCupTie, careerAfterMatch, careerAfterWeek, completeCupTie } from './career';
import { drawEvent } from './events/events';
import { syncHuman } from './economy';
import { reviewManagers } from './market/managers';
import { applyWeeklyFinance, isDeadline, marketPass, windowOf } from './market/transfers';
import { endOfSeason } from './season';
import { applyClubTraining, applyPlan, applyTraitWork, coachFactor, planCost, planHardCount } from './training';
import { TRAIT_BY_ID } from './traits';
import { bestLineup, statusIn } from './match/lineup';
import type { MatchResult } from './match/types';
import { simulateMatch, type SimCtx } from './match/sim';
import { DIVISIONS } from './world';

/**
 * Starts a matchday: training, then every match except the human's. Returns the human's fixture, ready to be
 * played by completeWeek. Does nothing and returns null when no matchday can be played.
 */
export function beginWeek(g: Game): WeekState | null {
  if (g.phase !== 'play' || g.week > WEEKS) return null;
  const rng: Rng = makeRng(g.seed);
  const me = humanOf(g);
  const ctx = lineupCtx(g);
  const justInjured = new Set<string>();
  const justSuspended = new Set<string>();
  const played = new Set<string>();

  // Training comes first: it develops players and costs the human some condition before selection.
  const coach = new Map(g.clubs.map(c => [c.id, coachFactor(c.rating)]));
  const hard = planHardCount(g.training);
  for (const p of g.players) {
    const cf = coach.get(p.clubId ?? '') ?? 1;
    if (!p.human) { applyClubTraining(p, cf); continue; }
    if (p.injuredWeeks > 0) { g.trainingLog = { week: g.week, gains: [] }; continue; }
    g.trainingLog = { week: g.week, gains: applyPlan(p, g.training, cf) };
    p.condition = clamp(p.condition - planCost(g.training), 20, 100);
    const learned = applyTraitWork(p, g.training, g.traitProgress);
    if (learned) {
      pushMessage(g, { week: g.week, from: 'Coach', subject: `You have learned: ${TRAIT_BY_ID[learned].label}`, body: `${TRAIT_BY_ID[learned].desc} You will see new options in matches where it applies.` });
      g.training.traitFocus = null;
    }
  }

  if (g.sitOut && me.injuredWeeks === 0) me.condition = Math.min(100, me.condition + 12);
  let ws: WeekState | null = null;
  const common = { rng, justInjured, justSuspended, played, coach, hard };
  for (const div of DIVISIONS) {
    for (const fx of g.fixtures[div.id][g.week - 1]) {
      const H = bestLineup(g.players, fx.h, { ...ctx, mgr: g.clubs.find(c => c.id === fx.h)!.mgr });
      const A = bestLineup(g.players, fx.a, { ...ctx, mgr: g.clubs.find(c => c.id === fx.a)!.mgr });
      if (fx.h === me.clubId || fx.a === me.clubId) {
        const mySide = fx.h === me.clubId ? 'h' : 'a';
        ws = { ...common, me, fx, division: div.name, H, A, mySide, status: statusIn(mySide === 'h' ? H : A, me, ctx) };
      } else applyMatch(g, common, fx, simulateMatch(H, A, rng));
    }
  }
  return ws;
}

/** Options for the human's match: instructions and, unless the human is out, decision moments. */
export function matchCtx(g: Game, ws: WeekState): SimCtx {
  const playing = ws.status === 'start' || ws.status === 'bench';
  return { humanId: ws.me.id, instr: g.instructions, moments: playing ? { confidence: g.confidence, recent: g.recentMoments } : undefined };
}

export type { WeekState };

/** Finishes a matchday once the human's match has been played: stats, report, recovery, and the end of the season if due. */
export function completeWeek(g: Game, ws: WeekState, r: MatchResult): void {
  const { me } = ws;
  const wasInjured = me.injuredWeeks > 0;
  const motm = applyMatch(g, ws, ws.fx, r);
  if (r.moments && r.moments.injuredWeeks > 0) { me.injuredWeeks = Math.max(me.injuredWeeks, r.moments.injuredWeeks); ws.justInjured.add(me.id); }
  if (!wasInjured && me.injuredWeeks > 0) { g.injuryHandled = false; g.flags['s:injuredAt'] = g.week; }
  const report = recordHumanMatch(g, ws, r, motm, { key: g.week, comp: 'league' });
  careerAfterMatch(g, report);

  g.promise = g.promise === g.week ? null : g.promise;
  g.sitOut = false;
  g.risk = false;
  if ((g.flags['s:reinjury'] ?? 0) > 0) g.flags['s:reinjury']--;
  for (const p of g.players) {
    if (p.suspended > 0 && !ws.justSuspended.has(p.id)) p.suspended--;
    if (p.injuredWeeks > 0 && !ws.justInjured.has(p.id)) p.injuredWeeks--;
    const rec = p.injuredWeeks > 0 ? 20 : p.human ? (ws.played.has(p.id) ? 24 : 28) : ws.played.has(p.id) ? 16 : 20;
    p.condition = Math.min(100, p.condition + rec);
  }
  g.week++;
  g.seed = ws.rng.seed();
  syncHuman(g);
  applyWeeklyFinance(g);
  const played = g.week - 1;
  if (windowOf(played)) marketPass(g, ws.rng, isDeadline(played) ? 3 : 1);
  careerAfterWeek(g, played, ws.rng);
  if (g.week > WEEKS) { g.event = null; endOfSeason(g); } else { reviewManagers(g, ws.rng, 'weekly'); drawEvent(g, ws.rng); }
}

/** Plays one whole matchday without pausing, cup tie first if one is waiting. The engine makes the human's decisions. Used by tests, scripts and instant mode. */
export function playWeek(g: Game): void {
  const tie = g.cup?.pending ? beginCupTie(g) : null;
  if (tie) completeCupTie(g, tie, simulateMatch(tie.H, tie.A, tie.rng, matchCtx(g, tie)));
  const ws = beginWeek(g);
  if (!ws) return;
  completeWeek(g, ws, simulateMatch(ws.H, ws.A, ws.rng, matchCtx(g, ws)));
}
