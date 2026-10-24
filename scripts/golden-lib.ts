// Golden fixtures: seeded outputs of the engine, recorded as plain numbers and strings. A port to another language
// (the Godot move) must reproduce these exactly, and the test in tests/golden.test.ts keeps this engine honest meanwhile.
import { legacyOf, retire } from '../src/engine/career';
import { createGame, humanOf, joinClub, lineupCtx, type Game } from '../src/engine/game';
import { bestLineup } from '../src/engine/match/lineup';
import { simulateMatch } from '../src/engine/match/sim';
import { DEFAULT_SETUP, reportFor, sampleOutcome } from '../src/engine/moments/lab';
import { TEMPLATES } from '../src/engine/moments/templates';
import { ovrOf } from '../src/engine/player';
import { autoBuild, BASE_POOL } from '../src/engine/pointbuy';
import { makeRng } from '../src/engine/rng';
import { startNextSeason } from '../src/engine/season';
import { tableFor } from '../src/engine/table';
import { playWeek } from '../src/engine/week';

const r4 = (v: number) => Math.round(v * 1e4) / 1e4;

function newGame(seed: number, pos: 'ST' | 'CM' | 'CB'): Game {
  const g = createGame(seed, { name: 'Golden', position: pos, heightCm: 182, build: 'athletic', foot: 'right', weakFoot: 2, attrs: autoBuild(pos, 182, 'athletic', BASE_POOL), nowLater: 0 });
  joinClub(g, 0);
  return g;
}

export function rngFixture() {
  return Object.fromEntries([1, 42, 2024].map(seed => {
    const r = makeRng(seed);
    return [seed, { next: Array.from({ length: 6 }, () => r.next()).map(v => Math.round(v * 1e9) / 1e9), ints: Array.from({ length: 6 }, () => r.int(1, 100)), gauss: Array.from({ length: 4 }, () => r.gauss()).map(v => Math.round(v * 1e9) / 1e9), chance: Array.from({ length: 6 }, () => r.chance(0.3)) }];
  }));
}

export function worldFixture(seed = 7) {
  const g = newGame(seed, 'ST');
  const me = humanOf(g);
  const club = g.clubs.find(c => c.id === me.clubId)!;
  return {
    players: g.players.length,
    clubs: g.clubs.length,
    firstClubs: g.clubs.slice(0, 3).map(c => [c.name, c.division, r4(c.rating), r4(c.wealth)]),
    firstSquad: g.players.filter(p => p.clubId === 'c0').slice(0, 4).map(p => [p.name, p.age, p.position, ovrOf(p)]),
    human: { club: club.name, ovr: ovrOf(me), pot: me.potential, wage: g.contract!.wage },
    round1: g.fixtures[1][0].slice(0, 4).map(f => [f.h, f.a]),
    cup: { prelim: g.cup.rounds[0].ties.slice(0, 3).map(t => [t.h, t.a]), byes: g.cup.rounds[0].byes.slice(0, 5) },
    offersTotal: g.offers.length,
  };
}

export function matchFixture(seed = 7) {
  const g = newGame(seed, 'CM');
  const ctx = lineupCtx(g);
  const fx = g.fixtures[1][0][0];
  const H = bestLineup(g.players, fx.h, { ...ctx, mgr: g.clubs.find(c => c.id === fx.h)!.mgr });
  const A = bestLineup(g.players, fx.a, { ...ctx, mgr: g.clubs.find(c => c.id === fx.a)!.mgr });
  return [5, 6, 7].map(s => {
    const r = simulateMatch(H, A, makeRng(s));
    const ratings = Object.values(r.players).slice(0, 4).map(p => [p.pos, r4(p.rating), p.g, p.a, p.min]);
    return { seed: s, hg: r.hg, ag: r.ag, steps: r.steps.length, events: r.events.length, shots: [r.team.h.shots, r.team.a.shots], xg: [r4(r.team.h.xg), r4(r.team.a.xg)], formations: [H.formation, A.formation], ratings };
  });
}

export function momentFixture() {
  const picks = [TEMPLATES[0], TEMPLATES[Math.floor(TEMPLATES.length / 2)], TEMPLATES[TEMPLATES.length - 1]];
  return picks.map(t => ({
    id: t.id,
    options: reportFor(t, DEFAULT_SETUP).map(o => [o.id, r4(o.s), o.tiers.map(r4)]),
    sample: t.options.slice(0, 2).map(o => { const x = sampleOutcome(t, o.id, DEFAULT_SETUP, makeRng(11)); return [o.id, x.tier, x.result]; }),
  }));
}

export function seasonFixture(seed = 7) {
  const g = newGame(seed, 'ST');
  for (let w = 0; w < 38; w++) { if (g.event) g.event = null; playWeek(g); }
  const me = humanOf(g);
  const table = tableFor(g, g.clubs.find(c => c.id === g.summary!.clubId)!.division);
  return {
    phase: g.phase,
    table: table.slice(0, 5).map(r => [r.id, r.p, r.pts, r.gf, r.ga]),
    human: { apps: me.stats.apps, starts: me.stats.starts, goals: me.stats.goals, assists: me.stats.assists, rating: r4(me.stats.ratingN ? me.stats.ratingSum / me.stats.ratingN : 0), ovr: ovrOf(me) },
    cupWinner: g.cup.winner,
    cupRounds: g.cup.rounds.map(r => r.ties.length),
    goals: g.summary!.career.goals.map(x => [x.id, x.target, r4(x.actual), x.met]),
    awards: g.summary!.career.awards.map(a => a.kind),
    rep: g.summary!.career.rep,
    reports: g.reports.map(r => [r.week, r.hg, r.ag, r.comp ?? 'league']),
    totalGoals: Object.values(g.fixtures).flat(2).reduce((a, f) => a + (f.hg ?? 0) + (f.ag ?? 0), 0),
  };
}

export function marketFixture(seed = 7) {
  const g = newGame(seed, 'CB');
  for (let w = 0; w < 38; w++) { if (g.event) g.event = null; playWeek(g); }
  startNextSeason(g, g.summary!.contractExpired ? 0 : null);
  const kinds: Record<string, number> = {};
  for (const d of g.deals) kinds[d.kind] = (kinds[d.kind] ?? 0) + 1;
  return {
    season: g.season,
    players: g.players.length,
    free: g.players.filter(p => p.clubId === null && !p.human).length,
    deals: kinds,
    funds: Math.round(g.clubs.reduce((a, c) => a + c.funds, 0)),
    divisionSizes: [1, 2, 3, 4].map(d => g.clubs.filter(c => c.division === d).length),
    managers: g.clubs.slice(0, 4).map(c => [c.mgr.name, c.mgr.style, c.mgr.formation]),
    humanContract: g.contract,
  };
}

export function careerFixture(seed = 7) {
  const g = newGame(seed, 'ST');
  for (let s = 0; s < 2; s++) {
    for (let w = 0; w < 38; w++) { if (g.event) g.event = null; playWeek(g); }
    if (s === 0) startNextSeason(g, g.summary!.contractExpired ? 0 : null);
  }
  retire(g);
  const L = legacyOf(g);
  return { score: L.score, title: L.title, seasons: L.seasons, apps: L.apps, goals: L.goals, peak: L.peak, parts: L.parts.map(p => [p.label, p.points]), achievements: g.career.achievements.map(a => a.id) };
}

export function allFixtures() {
  return { version: 1, rng: rngFixture(), world: worldFixture(), match: matchFixture(), moments: momentFixture(), season: seasonFixture(), market: marketFixture(), career: careerFixture() };
}
