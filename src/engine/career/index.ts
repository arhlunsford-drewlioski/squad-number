import { makeRng, clamp, type Rng } from '../rng';
import { humanOf, pushMessage, roleAt, type Game } from '../game';
import { ovrOf, avgRating, type Player } from '../player';
import type { MatchReport } from '../match/report';
import type { SeasonSummary } from '../season';
import { checkAchievements } from './achievements';
import { cupAfterWeek } from './cupday';
import { CUP_NAME, makeCup, quickTie, finishRound, roundDone } from './cup';
import { evaluateGoals, cupReached, goalsMessage, makeGoals } from './goals';
import { intlWindow, playTournament, type TournamentResult } from './intl';
import { canRetire, mustRetire } from './legacy';
import { newCareer, type Honour, type HonourKind, type GoalResult } from './types';

export * from './types';
export { CUP_NAME, CUP_ROUNDS } from './cup';
export { ACHIEVEMENTS, ACHIEVEMENT_BY_ID, totals } from './achievements';
export { legacyOf, canRetire, mustRetire } from './legacy';
export { beginCupTie, completeCupTie } from './cupday';
export { playTournament as playTournamentForTest, standing, HOME_NATION, TOURNAMENT_NAME, TOURNAMENT_EVERY, INTL_WEEKS, NATIONS } from './intl';
export type { TournamentResult } from './intl';

/** What the end of a season adds to the summary. */
export interface CareerSummary {
  awards: Honour[];
  goals: GoalResult[];
  tournament: TournamentResult | null;
  cup: { winner: string | null; reached: number; won: boolean };
  young: { name: string; clubId: string; rating: number } | null;
  rep: { from: number; to: number };
  achievements: string[];
  canRetire: boolean;
  mustRetire: boolean;
}

const HONOUR_REP: Partial<Record<HonourKind, number>> = { league: 6, cup: 5, promotion: 3, boot: 4, poty: 5, young: 3, clubPoty: 2, clubBoot: 1, tournament: 8, tournamentFinal: 3 };

/** Brings a game from before cups and careers up to date, and makes sure this season has a cup and targets. */
export function ensureCareer(g: Game): void {
  const me = humanOf(g);
  if (!g.career) {
    g.career = newCareer(ovrOf(me), me.age);
    for (const h of g.history) g.career.peak = h.ovr > g.career.peak.ovr ? { ovr: h.ovr, season: h.season, age: h.age } : g.career.peak;
    g.career.rep = clamp(8 + g.history.length * 6, 8, 60);
  }
  if (!g.cup || (g.cup.season !== g.season && g.phase !== 'seasonEnd')) {
    const rng = makeRng(g.seed ^ (g.season * 2654435761));
    g.cup = makeCup(g, rng);
    // A save from mid-season: rounds already past are settled from strength alone.
    for (let ri = 0; ri < g.cup.rounds.length; ri++) {
      if (g.cup.rounds[ri].after > g.week - 1) break;
      for (const tie of g.cup.rounds[ri].ties) if (!tie.winner) quickTie(g, tie, rng);
      if (roundDone(g.cup, ri)) finishRound(g.cup, ri, rng);
    }
    const mine = me.clubId;
    const out = g.cup.rounds.findIndex(r => r.ties.some(t => t.winner && t.winner !== mine && (t.h === mine || t.a === mine)));
    g.cup.outAt = out >= 0 ? out : null;
  }
  if (g.phase === 'play' && g.career.goals.length === 0 && me.clubId) beginCareerSeason(g);
}

/** Season goals from the agent. Called when a season starts. */
export function beginCareerSeason(g: Game): void {
  const me = humanOf(g);
  if (!me.clubId) return;
  g.career.goals = makeGoals(g, roleAt(g.players, me.clubId, me));
  pushMessage(g, { week: 1, from: 'Agent', subject: `Targets for season ${g.season}`, body: goalsMessage(g.career.goals) });
}

/** A fresh cup for the new season and new targets. */
export function careerNewSeason(g: Game, rng: Rng): void {
  g.cup = makeCup(g, rng);
  g.career.goals = [];
  beginCareerSeason(g);
}

const notePeak = (g: Game) => {
  const me = humanOf(g), o = ovrOf(me);
  if (o > g.career.peak.ovr) g.career.peak = { ovr: o, season: g.season, age: me.age };
};

export function careerAfterMatch(g: Game, report: MatchReport): void {
  ensureCareer(g);
  checkAchievements(g, 'match', { rep: report });
}

/** After each matchday: the cup, international breaks and the record of your peak. */
export function careerAfterWeek(g: Game, played: number, rng: Rng): void {
  ensureCareer(g);
  cupAfterWeek(g, played, rng);
  intlWindow(g, played, rng);
  notePeak(g);
}

const best = (ps: Player[], min: number) => ps.filter(p => p.stats.apps >= min).sort((a, b) => avgRating(b.stats) - avgRating(a.stats))[0];

/** Awards, targets, the tournament and standing at the end of a season. */
export function careerAtSeasonEnd(g: Game, rng: Rng, sum: Omit<SeasonSummary, 'career'>, inDiv: Player[]): CareerSummary {
  ensureCareer(g);
  const me = humanOf(g);
  const club = g.clubs.find(c => c.id === me.clubId)!;
  const c = g.career;
  const repFrom = c.rep;
  const awards: Honour[] = [];
  const add = (kind: HonourKind, label: string) => awards.push({ season: g.season, kind, label, club: club.name, div: club.division });

  if (sum.champion === club.id) add('league', 'League champions');
  if (sum.promoted.includes(club.id)) add('promotion', 'Promoted');
  if (g.cup.winner === club.id) add('cup', `${CUP_NAME} winners`);
  else if (g.cup.rounds[g.cup.rounds.length - 1].ties.some(t => t.h === club.id || t.a === club.id)) add('cupFinal', `${CUP_NAME} runners-up`);
  if (sum.boot?.name === 'You' && me.stats.goals > 0) add('boot', 'Division top scorer');
  if (sum.poty?.name === 'You') add('poty', 'Player of the season');
  const young = best(inDiv.filter(p => p.age <= 21), 15);
  if (young?.human) add('young', 'Young player of the season');
  const mates = g.players.filter(p => p.clubId === club.id);
  if (best(mates, 15)?.id === me.id) add('clubPoty', 'Club player of the season');
  const scorer = [...mates].sort((a, b) => b.stats.goals - a.stats.goals)[0];
  if (scorer?.id === me.id && me.stats.goals >= 5) add('clubBoot', 'Club top scorer');

  // The tournament follows the season. Its honours are yours if you were in the squad.
  const tournament = playTournament(g, rng);
  if (tournament?.you) {
    if (tournament.stage === 4) add('tournament', `${tournament.name} winners`);
    else if (tournament.stage === 3) add('tournamentFinal', `${tournament.name} runners-up`);
  }

  const goals = evaluateGoals(g, sum.pos, sum.ovrEnd);
  c.goalLog.push({ season: g.season, met: goals.filter(x => x.met).length, total: goals.length });
  c.honours.push(...awards);

  const st = me.stats;
  let d = st.apps >= 10 ? (avgRating(st) - 6.4) * 5 : -1;
  d += goals.filter(x => x.met).length * 2;
  d += awards.reduce((s, a) => s + (HONOUR_REP[a.kind] ?? 0), 0);
  d += c.intl.level === 'senior' ? 2 : c.intl.level === 'u21' ? 1 : 0;
  d += club.division === 1 ? 1 : 0;
  c.rep = Math.round(clamp(c.rep * 0.9 + d * 0.6, 0, 100) * 10) / 10;
  notePeak(g);

  const unlocked = checkAchievements(g, 'season');
  return {
    awards, goals, tournament,
    cup: { winner: g.cup.winner, reached: cupReached(g.cup, club.id), won: g.cup.winner === club.id },
    young: young ? { name: young.human ? 'You' : young.name, clubId: young.clubId!, rating: avgRating(young.stats) } : null,
    rep: { from: repFrom, to: c.rep }, achievements: unlocked,
    canRetire: canRetire(g), mustRetire: mustRetire(g, sum.ovrEnd),
  };
}

/** Ends the career. */
export function retire(g: Game): void {
  const me = humanOf(g);
  g.career.retired = true;
  g.phase = 'retired';
  pushMessage(g, { week: g.week, from: 'Club Secretary', subject: 'Retirement', body: `${me.name} has announced retirement from professional football at the age of ${me.age}.` });
}
