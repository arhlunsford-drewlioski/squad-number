import type { Attrs } from './attributes';
import { marketValue, syncHuman } from './economy';
import { humanOf, makeOffers, pushMessage, wageFor, type Game } from './game';
import { reviewManagers } from './market/managers';
import { logDeal, marketPass, MIN_POS, POSITION_LIST, releasePlayer, STARTERS } from './market/transfers';
import { avgRating, generatePlayer, ovrOf, newSeasonStats, type SeasonStats } from './player';
import { keyAttrs } from './positions';
import { clamp, makeRng } from './rng';
import { squadLevel, tableFor } from './table';
import { applyAgeing } from './training';
import { careerAtSeasonEnd, careerNewSeason, type CareerSummary } from './career';
import { DIVISIONS, makeDivisionFixtures } from './world';

export const PROMOTION_SPOTS = 3;

export interface SeasonSummary {
  season: number;
  division: number;
  clubId: string;
  pos: number;
  champion: string;
  promoted: string[];
  relegated: string[];
  boot: { name: string; clubId: string; goals: number } | null;
  poty: { name: string; clubId: string; rating: number } | null;
  me: SeasonStats & { avg: number };
  ovrStart: number;
  ovrEnd: number;
  attrsStart: Attrs;
  attrsEnd: Attrs;
  contractExpired: boolean;
  retiring: number;
  /** Awards, targets, the cup and the tournament. Absent on summaries saved before careers existed. */
  career: CareerSummary;
}

export interface SeasonRecord {
  season: number;
  clubName: string;
  division: string;
  pos: number;
  age: number;
  apps: number;
  goals: number;
  assists: number;
  avg: number;
  ovr: number;
}

/** Closes the season: final tables, promotion and relegation, awards, the human's record and contract status. */
export function endOfSeason(g: Game): void {
  const rng = makeRng(g.seed);
  const me = humanOf(g);
  const club = g.clubs.find(c => c.id === me.clubId)!;
  const tables = Object.fromEntries(DIVISIONS.map(d => [d.id, tableFor(g, d.id)]));
  const promoted: string[] = [];
  const relegated: string[] = [];
  for (const d of DIVISIONS) {
    const t = tables[d.id];
    if (d.id > 1) promoted.push(...t.slice(0, PROMOTION_SPOTS).map(r => r.id));
    if (d.id < DIVISIONS.length) relegated.push(...t.slice(-PROMOTION_SPOTS).map(r => r.id));
  }
  const mine = tables[club.division];
  const inDiv = g.players.filter(p => p.clubId && g.clubs.find(c => c.id === p.clubId)!.division === club.division);
  const boot = [...inDiv].sort((a, b) => b.stats.goals - a.stats.goals)[0];
  const poty = inDiv.filter(p => p.stats.apps >= 20).sort((a, b) => avgRating(b.stats) - avgRating(a.stats))[0];
  const ovrEnd = ovrOf(me);
  g.contract!.years--;
  const expired = g.contract!.years <= 0;

  const partial: Omit<SeasonSummary, 'career'> = {
    season: g.season, division: club.division, clubId: club.id, pos: mine.findIndex(r => r.id === club.id) + 1, champion: mine[0].id, promoted, relegated,
    boot: boot ? { name: boot.human ? 'You' : boot.name, clubId: boot.clubId!, goals: boot.stats.goals } : null,
    poty: poty ? { name: poty.human ? 'You' : poty.name, clubId: poty.clubId!, rating: avgRating(poty.stats) } : null,
    me: { ...me.stats, avg: avgRating(me.stats) },
    ovrStart: g.seasonStart.ovr, ovrEnd, attrsStart: g.seasonStart.attrs, attrsEnd: { ...me.attrs },
    contractExpired: expired, retiring: g.players.filter(p => !p.human && p.age >= 34).length,
  };
  g.summary = { ...partial, career: careerAtSeasonEnd(g, rng, partial, inDiv) };
  g.history.push({
    season: g.season, clubName: club.name, division: DIVISIONS[club.division - 1].name, pos: g.summary.pos, age: me.age,
    apps: me.stats.apps, goals: me.stats.goals, assists: me.stats.assists, avg: avgRating(me.stats), ovr: ovrEnd,
  });
  g.offers = expired ? makeOffers(g, rng, g.loan?.from ?? club.id) : [];
  g.phase = 'seasonEnd';
  g.seed = rng.seed();
}

const retireChance = (age: number) => (age < 34 ? 0 : age === 34 ? 0.15 : age === 35 ? 0.4 : age === 36 ? 0.75 : 1);

/** Youth intake is anchored to the division, with a little influence from the club, so it does not chase a club's current signings. */
export const intakeLevel = (club: { division: number }, rating: number) => {
  const d = DIVISIONS[club.division - 1];
  const mid = (d.rating[0] + d.rating[1]) / 2;
  return mid - 17 + 0.3 * (rating - mid);
};

/** Rolls the world into the next season: contracts, ageing, retirements, youth intake, the summer window, new fixtures. */
export function startNextSeason(g: Game, offerIdx: number | null): void {
  const rng = makeRng(g.seed);
  const me = humanOf(g);
  const sum = g.summary!;
  if (g.loan) { me.clubId = g.loan.from; g.trust = g.loan.trust; g.loan = null; }

  // Managers are judged on the season just finished, before clubs move up and down.
  reviewManagers(g, rng, 'season');

  if (sum.contractExpired && offerIdx !== null) {
    const o = g.offers[offerIdx];
    if (o.clubId !== me.clubId) g.trust = 0.5;
    me.clubId = o.clubId;
    g.contract = { years: o.years, wage: o.wage };
  } else if (!sum.contractExpired && g.contract) {
    g.contract.wage = Math.max(g.contract.wage, wageFor(sum.ovrEnd) * 0.9);
  }
  g.offers = [];

  for (const id of sum.promoted) g.clubs.find(c => c.id === id)!.division -= 1;
  for (const id of sum.relegated) g.clubs.find(c => c.id === id)!.division += 1;

  // Players out on loan go home.
  for (const p of g.players) if (p.loanFrom) { p.clubId = p.loanFrom; p.loanFrom = null; }

  // Ageing, development drift, growth spurts, retirements. Free agents age too.
  for (const p of g.players) {
    p.age++;
    applyAgeing(p, rng.next);
    p.devRate = clamp(p.devRate + rng.gauss() * 0.04, 0.7, 1.4);
    if (p.age <= 22 && rng.chance(0.1)) {
      for (const id of keyAttrs(p.position, 8).filter(() => rng.chance(0.4))) p.attrs[id] = Math.min(p.ceil[id], p.attrs[id] + 0.5 + rng.next() * 0.7);
    }
    p.stats = newSeasonStats();
    p.suspended = 0;
    p.condition = 100;
    p.injuredWeeks = 0;
    p.form = [];
  }
  const retired = g.players.filter(p => !p.human && rng.chance(retireChance(p.age)));
  for (const p of retired) if (ovrOf(p) >= 60) logDeal(g, 'retired', p, p.clubId, null, 0);
  const gone = new Set(retired.map(p => p.id));
  g.players = g.players.filter(p => !gone.has(p.id));

  // Contracts run down. Clubs keep the players they want and let the rest go.
  g.season++;
  g.week = 1;
  for (const club of g.clubs) {
    const squad = g.players.filter(p => p.clubId === club.id);
    for (const p of squad) {
      if (p.human) continue;
      p.contractYears--;
      if (p.contractYears > 0) continue;
      const rank = squad.filter(q => q.position === p.position && q.id !== p.id && ovrOf(q) > ovrOf(p)).length;
      const wanted = rank <= STARTERS[p.position] || (p.age <= 23 && p.potential - ovrOf(p) >= 6);
      if (wanted && rng.chance(0.85)) {
        p.contractYears = rng.int(2, 4);
        p.wage = Math.max(50, Math.round((wageFor(ovrOf(p)) * (0.95 + 0.2 * rng.next())) / 50) * 50);
      } else {
        releasePlayer(g, p, club.id, rng);
      }
    }
  }
  // The free agent pool keeps the best of those without a club.
  const free = g.players.filter(p => p.clubId === null && !p.human).sort((a, b) => marketValue(b) - marketValue(a));
  const drop = new Set(free.slice(150).map(p => p.id));
  g.players = g.players.filter(p => !drop.has(p.id));

  // Youth intake: two or three prospects a club, in the positions where they are thinnest.
  const rating = new Map(g.clubs.map(c => [c.id, squadLevel(g, c.id)]));
  for (const club of g.clubs) {
    const n = rng.int(2, 3);
    for (let i = 0; i < n; i++) {
      const squad = g.players.filter(p => p.clubId === club.id);
      const thin = POSITION_LIST.map(pos => ({ pos, v: squad.filter(p => p.position === pos).length - MIN_POS[pos] })).sort((a, b) => a.v - b.v);
      const pos = thin[Math.min(thin.length - 1, rng.int(0, 2))].pos;
      const prospect = generatePlayer(rng, { id: 'p' + g.nextId++, position: pos, age: rng.int(17, 18), targetOvr: clamp(intakeLevel(club, rating.get(club.id) ?? club.rating) + rng.gauss() * 3, 30, 90), clubId: club.id });
      prospect.contractYears = 3;
      g.players.push(prospect);
    }
  }
  for (const c of g.clubs) c.rating = squadLevel(g, c.id);
  for (const d of DIVISIONS) g.fixtures[d.id] = makeDivisionFixtures(rng, g.clubs.filter(c => c.division === d.id).map(c => c.id));

  g.reports = [];
  g.event = null; g.promise = null; g.sitOut = false; g.risk = false; g.injuryHandled = true;
  for (const k of Object.keys(g.flags)) if (k.startsWith('s:')) delete g.flags[k];
  g.trainingLog = null;
  g.summary = null;
  g.seasonStart = { attrs: { ...me.attrs }, ovr: ovrOf(me) };
  g.phase = 'play';

  // The summer window: a long round of business before the first match.
  syncHuman(g);
  marketPass(g, rng, 6);
  for (const c of g.clubs) c.rating = squadLevel(g, c.id);

  careerNewSeason(g, rng);
  const club = g.clubs.find(c => c.id === me.clubId)!;
  pushMessage(g, {
    week: 1, from: 'Club Secretary', subject: `Season ${g.season} begins`,
    body: `You are ${me.age} and at ${club.name} in the ${DIVISIONS[club.division - 1].name}. The transfer window is open for the first three matchdays. Your first match is on matchday 1.`,
  });
  g.seed = rng.seed();
}
