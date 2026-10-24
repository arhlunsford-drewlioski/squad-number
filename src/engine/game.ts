import type { Attrs } from './attributes';
import type { SeasonSummary, SeasonRecord } from './season';
import type { EventLogEntry, PendingEvent } from './events/types';
import { ensureMarket, initClubMoney } from './economy';
import type { Deal } from './market/types';
import { newCareer, type Career, type CupState } from './career/types';
import { makeCup } from './career/cup';
import type { Build, Foot } from './body';
import { DEFAULT_INSTRUCTIONS, type Instructions } from './match/types';
import type { MatchReport } from './match/report';
import type { LineupCtx } from './match/lineup';
import { potentialCenter } from './pointbuy';
import { makeCeil, newSeasonStats, rollDevRate, rollHidden, type Player, ovrOf } from './player';
import { defaultPlan, type TrainingPlan } from './training';
import type { AttrId } from './attributes';
import type { TraitId } from './traits';
import type { Position } from './positions';
import { ovrAt } from './rating';
import { clamp, makeRng, type Rng } from './rng';
import { DIVISIONS, makeClubs, makeDivisionFixtures, makeSquad, type Club, type Fixtures } from './world';

export const GAME_VERSION = 3;
export const WEEKS = 38;

export interface HumanChoices {
  name: string;
  position: Position;
  heightCm: number;
  build: Build;
  foot: Foot;
  weakFoot: number;
  attrs: Attrs;
  nowLater: number;
}

export interface Offer {
  clubId: string;
  role: 'Starter' | 'Rotation' | 'Squad player';
  wage: number;
  years: number;
  /** An offer to stay at the current club. */
  stay?: boolean;
}

export interface Message {
  id: number;
  week: number;
  from: string;
  subject: string;
  body: string;
  read: boolean;
}

export interface Game {
  version: number;
  seed: number;
  season: number;
  week: number;
  phase: 'offers' | 'play' | 'seasonEnd' | 'retired';
  humanId: string;
  players: Player[];
  clubs: Club[];
  fixtures: Fixtures;
  offers: Offer[];
  contract: { years: number; wage: number } | null;
  inbox: Message[];
  /** Manager's trust in the player, -5 to 5. Feeds selection. */
  trust: number;
  /** 0 to 100. Rises with success in moments, falls with errors, drifts back to 50. */
  confidence: number;
  /** Moment templates seen recently, so the next matches vary. */
  recentMoments: string[];
  instructions: Instructions;
  /** Most recent match reports for the human's club, newest first. */
  reports: MatchReport[];
  training: TrainingPlan;
  /** What last week's training changed, for the human player. */
  trainingLog: { week: number; gains: [AttrId, number][] } | null;
  /** Progress towards each trait being learned, 0 to 100. */
  traitProgress: Partial<Record<TraitId, number>>;
  /** Snapshot at the start of the season, to show change over the year. */
  seasonStart: { attrs: Attrs; ovr: number };
  summary: SeasonSummary | null;
  history: SeasonRecord[];
  /** Recent transfers, loans and releases across the league, newest first. */
  deals: Deal[];
  /** Weekly league money for an average club in each division. */
  leagueMoney: Record<number, number>;
  /** The event waiting for an answer. */
  event: PendingEvent | null;
  eventLog: EventLogEntry[];
  /** Cooldowns and one-off markers. Keys starting with s: reset each season. */
  flags: Record<string, number>;
  /** The matchday the manager has promised you a start. */
  promise: number | null;
  /** You are resting for the next match. */
  sitOut: boolean;
  /** You are playing through a knock in the next match. */
  risk: boolean;
  /** Set while you are on loan: the club you belong to and the manager's trust there. */
  loan: { from: string; to: string; trust: number } | null;
  /** False from a new injury until you have answered the physio. */
  injuryHandled: boolean;
  /** The domestic cup this season. */
  cup: CupState;
  /** Honours, targets, standing, international record and achievements. */
  career: Career;
  nextId: number;
}

/** Adds a message to the top of the inbox with a unique id. */
export function pushMessage(g: Game, m: { week: number; from: string; subject: string; body: string }): void {
  const id = g.inbox.reduce((mx, x) => Math.max(mx, x.id), 0) + 1;
  g.inbox.unshift({ id, read: false, ...m });
  if (g.inbox.length > 60) g.inbox.length = 60;
}

export { wageFor } from './wages';
import { wageFor } from './wages';

export function roleAt(players: Player[], clubId: string, p: Player): Offer['role'] {
  const o = ovrAt(p.attrs, p.position);
  const same = players.filter(q => q.clubId === clubId && q.position === p.position);
  const rank = same.filter(q => ovrAt(q.attrs, q.position) > o).length;
  const starters = p.position === 'GK' ? 1 : p.position === 'DM' || p.position === 'AM' ? 1 : 2;
  return rank < starters ? 'Starter' : rank < starters + 1 ? 'Rotation' : 'Squad player';
}

/** Offers from three tiers around the player's level: a step up, a fair fit and a step down. */
export function makeOffers(g: Game, rng: Rng, stayAt?: string): Offer[] {
  const human = g.players.find(p => p.id === g.humanId)!;
  const ovr = ovrOf(human);
  const avg = (d: number) => {
    const cs = g.clubs.filter(c => c.division === d);
    return cs.reduce((a, c) => a + c.rating, 0) / cs.length;
  };
  // The division whose clubs are closest to the player's level.
  let fit = 4;
  for (const d of [1, 2, 3, 4]) if (Math.abs(avg(d) - ovr) < Math.abs(avg(fit) - ovr)) fit = d;
  const tiers = [...new Set([Math.max(1, fit - 1), fit, Math.min(4, fit + 1)])];
  const repFactor = 1 + ((g.career?.rep ?? 8) - 30) / 700;
  const offers: Offer[] = [];
  for (const div of tiers) {
    const pool = g.clubs.filter(c => c.division === div && c.id !== stayAt);
    const club = rng.pick(pool);
    offers.push({ clubId: club.id, role: roleAt(g.players, club.id, human), wage: Math.round((wageFor(ovr) * (1 + (4 - div) * 0.12) * repFactor) / 50) * 50, years: rng.int(2, 3) });
  }
  if (stayAt) offers.unshift({ clubId: stayAt, role: roleAt(g.players, stayAt, human), wage: Math.round((wageFor(ovr) * 1.1) / 50) * 50, years: rng.int(2, 3), stay: true });
  return offers;
}

export function createGame(seed: number, c: HumanChoices): Game {
  const rng = makeRng(seed);
  let n = 1;
  const nextId = () => 'p' + n++;
  const clubs = makeClubs(rng);
  const players: Player[] = [];
  for (const club of clubs) players.push(...makeSquad(rng, club, nextId));
  const fixtures: Fixtures = {};
  for (const d of DIVISIONS) fixtures[d.id] = makeDivisionFixtures(rng, clubs.filter(cl => cl.division === d.id).map(cl => cl.id));

  const cur = ovrAt(c.attrs, c.position);
  const pot = clamp(Math.round(potentialCenter(c.nowLater) + rng.gauss() * 5), Math.round(cur) + 8, 97);
  const human: Player = {
    id: nextId(), name: c.name, age: 17, position: c.position, heightCm: c.heightCm, build: c.build, foot: c.foot, weakFoot: c.weakFoot,
    attrs: { ...c.attrs }, hidden: rollHidden(rng, 1), potential: pot, ceil: makeCeil(c.attrs, c.position, c.heightCm, c.build, pot), devRate: rollDevRate(rng),
    clubId: null, human: true, condition: 100, injuredWeeks: 0, form: [], stats: newSeasonStats(), traits: [], suspended: 0, wage: 0, contractYears: 0, loanFrom: null,
  };
  players.push(human);

  const g: Game = {
    version: GAME_VERSION, seed: 0, season: 1, week: 1, phase: 'offers', humanId: human.id, players, clubs, fixtures,
    offers: [], contract: null, inbox: [], trust: 0.5, confidence: 50, recentMoments: [], instructions: { ...DEFAULT_INSTRUCTIONS }, reports: [], training: defaultPlan(c.position), trainingLog: null, traitProgress: {},
    seasonStart: { attrs: { ...c.attrs }, ovr: cur }, summary: null, history: [], deals: [], leagueMoney: {}, event: null, eventLog: [], flags: {}, promise: null, sitOut: false, risk: false, loan: null, injuryHandled: true,
    cup: { season: 1, rounds: [], alive: [], winner: null, pending: null, outAt: null }, career: newCareer(cur, 17), nextId: n,
  };
  g.cup = makeCup(g, rng);
  initClubMoney(g);
  ensureMarket(g);
  g.offers = makeOffers(g, rng);
  g.seed = rng.seed();
  return g;
}

export function joinClub(g: Game, idx: number): void {
  const o = g.offers[idx];
  const human = g.players.find(p => p.id === g.humanId)!;
  const club = g.clubs.find(c => c.id === o.clubId)!;
  human.clubId = club.id;
  g.contract = { years: o.years, wage: o.wage };
  g.offers = [];
  g.phase = 'play';
  pushMessage(g, {
    week: 1, from: 'Club Secretary', subject: `Welcome to ${club.name}`,
    body: `Your contract has been registered. You are a ${o.role.toLowerCase()} at ${club.name}, who play in the ${DIVISIONS[club.division - 1].name}. Your first match is on matchday 1.`,
  });
}

export const humanOf = (g: Game) => g.players.find(p => p.id === g.humanId)!;
export const clubOf = (g: Game, id: string | null) => g.clubs.find(c => c.id === id) ?? null;

/** What the manager takes into account when picking the team this week. */
export const lineupCtx = (g: Game): LineupCtx => ({ week: g.week, trust: g.trust, promise: g.promise === g.week, sitOut: g.sitOut, mgr: g.clubs.find(c => c.id === g.players.find(p => p.id === g.humanId)?.clubId)?.mgr });
