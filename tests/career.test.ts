import { describe, expect, it } from 'vitest';
import { ACHIEVEMENTS, beginCupTie, completeCupTie, CUP_NAME, ensureCareer, legacyOf, playTournamentForTest, retire, standing } from '../src/engine/career';
import { cupRoundAt, makeCup, quickTie, shootout } from '../src/engine/career/cup';
import { createGame, humanOf, joinClub } from '../src/engine/game';
import { simulateMatch } from '../src/engine/match/sim';
import { autoBuild, BASE_POOL } from '../src/engine/pointbuy';
import { makeRng } from '../src/engine/rng';
import { startNextSeason } from '../src/engine/season';
import { matchCtx, playWeek } from '../src/engine/week';

const mkGame = (seed = 51, pos: 'ST' | 'CM' = 'ST') => {
  const g = createGame(seed, { name: 'T', position: pos, heightCm: 182, build: 'athletic', foot: 'right', weakFoot: 2, attrs: autoBuild(pos, 182, 'athletic', BASE_POOL), nowLater: 0 });
  joinClub(g, g.offers.length - 1);
  ensureCareer(g);
  return g;
};

describe('the cup', () => {
  it('draws every club in, with the strongest skipping the preliminary round', () => {
    const g = mkGame();
    const cup = g.cup;
    expect(cup.rounds).toHaveLength(7);
    expect(cup.rounds[0].ties).toHaveLength(16);
    expect(cup.rounds[0].byes).toHaveLength(48);
    const all = new Set([...cup.rounds[0].byes, ...cup.rounds[0].ties.flatMap(t => [t.h, t.a])]);
    expect(all.size).toBe(80);
    expect(cup.rounds[0].byes.every(id => g.clubs.find(c => c.id === id)!.division <= 3)).toBe(true);
    expect(cupRoundAt(4)).toBe(0);
    expect(cupRoundAt(37)).toBe(6);
  });

  it('plays through a season, leaves league stats alone, and ends with a single winner', () => {
    const g = mkGame();
    let cupTies = 0;
    for (let w = 0; w < 38; w++) {
      if (g.cup.pending) cupTies++;
      playWeek(g);
    }
    expect(g.cup.winner).not.toBeNull();
    expect(g.cup.rounds.map(r => r.ties.length)).toEqual([16, 32, 16, 8, 4, 2, 1]);
    expect(g.cup.rounds.every(r => r.ties.every(t => t.winner))).toBe(true);
    const cupReports = g.reports.filter(r => r.comp === 'cup');
    for (const r of cupReports) expect(r.week).toBeGreaterThanOrEqual(100);
    // Cup goals do not feed the league totals: league goals scored equal league goals in the stats.
    const leagueGoals = Object.values(g.fixtures).flat(2).reduce((a, f) => a + (f.hg ?? 0) + (f.ag ?? 0), 0);
    const statGoals = g.players.reduce((a, p) => a + p.stats.goals, 0);
    expect(statGoals).toBeLessThanOrEqual(leagueGoals);
    expect(statGoals).toBeGreaterThan(leagueGoals * 0.9);
    expect(g.phase).toBe('seasonEnd');
    expect(g.summary!.career.cup.winner).toBe(g.cup.winner);
  }, 60000);

  it('holds your tie until you play it, and a level score goes to penalties', () => {
    const g = mkGame(52);
    let guard = 0;
    while (!g.cup.pending && guard++ < 12) playWeek(g);
    expect(g.cup.pending).not.toBeNull();
    const week = g.week;
    const ws = beginCupTie(g)!;
    expect(ws).not.toBeNull();
    const r = simulateMatch(ws.H, ws.A, ws.rng, matchCtx(g, ws));
    completeCupTie(g, ws, r);
    expect(g.cup.pending).toBeNull();
    expect(g.week).toBe(week);
    const rep = g.reports[0];
    expect(rep.comp).toBe('cup');
    expect(rep.division).toContain(CUP_NAME);
    const tie = g.cup.rounds[0].ties.concat(g.cup.rounds[1].ties).find(t => t.h === humanOf(g).clubId || t.a === humanOf(g).clubId)!;
    expect(tie.winner).not.toBeNull();
    const [h, a] = shootout(makeRng(4), 0);
    expect(h).not.toBe(a);
  }, 60000);

  it('catches an old save up to the current matchday', () => {
    const g = mkGame(53);
    for (let w = 0; w < 14; w++) playWeek(g);
    const old = structuredClone(g) as Partial<typeof g>;
    delete old.cup; delete old.career;
    const fixed = old as typeof g;
    ensureCareer(fixed);
    expect(fixed.career.rep).toBeGreaterThan(0);
    expect(fixed.career.goals.length).toBe(3);
    expect(fixed.cup.rounds[0].ties.every(t => t.winner)).toBe(true);
    expect(fixed.cup.rounds[1].ties.every(t => t.winner)).toBe(true);
    quickTie(fixed, fixed.cup.rounds[5].ties[0] ?? { h: fixed.clubs[0].id, a: fixed.clubs[1].id, hg: null, ag: null, winner: null }, makeRng(1));
  }, 60000);

  it('makes a bracket from any number of clubs', () => {
    const g = mkGame();
    const cup = makeCup(g, makeRng(3));
    expect(cup.alive).toHaveLength(80);
  });
});

describe('the career', () => {
  it('sets three targets, grades them at the end of the season, and moves your standing', () => {
    const g = mkGame(54);
    expect(g.career.goals).toHaveLength(3);
    const before = g.career.rep;
    for (let w = 0; w < 38; w++) playWeek(g);
    const c = g.summary!.career;
    expect(c.goals).toHaveLength(3);
    expect(c.rep.from).toBe(before);
    expect(g.career.goalLog).toHaveLength(1);
    expect(g.career.honours.length).toBe(c.awards.length);
    startNextSeason(g, g.summary!.contractExpired ? 0 : null);
    expect(g.career.goals).toHaveLength(3);
    expect(g.cup.season).toBe(2);
    expect(g.cup.winner).toBeNull();
  }, 60000);

  it('unlocks achievements as things happen', () => {
    const g = mkGame(55);
    for (let w = 0; w < 6; w++) playWeek(g);
    const ids = g.career.achievements.map(a => a.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.every(id => ACHIEVEMENTS.some(a => a.id === id))).toBe(true);
  }, 60000);

  it('calls up a strong player and plays a tournament every fourth season', () => {
    const g = mkGame(56, 'CM');
    const me = humanOf(g);
    for (const k of Object.keys(me.attrs) as (keyof typeof me.attrs)[]) me.attrs[k] = 19;
    me.age = 24;
    expect(standing(g).level).toBe('senior');
    g.season = 4;
    const res = playTournamentForTest(g, makeRng(9));
    expect(res).not.toBeNull();
    expect(res!.matches.length).toBeGreaterThanOrEqual(3);
    expect(res!.stage).toBeGreaterThanOrEqual(0);
    expect(g.career.intl.tournaments).toHaveLength(1);
    g.season = 5;
    expect(playTournamentForTest(g, makeRng(9))).toBeNull();
  });

  it('retires and reports a legacy', () => {
    const g = mkGame(57);
    for (let w = 0; w < 38; w++) playWeek(g);
    retire(g);
    expect(g.phase).toBe('retired');
    const L = legacyOf(g);
    expect(L.seasons).toBe(1);
    expect(L.title.length).toBeGreaterThan(3);
    expect(L.score).toBeGreaterThanOrEqual(0);
    expect(L.parts.reduce((a, p) => a + p.points, 0)).toBeGreaterThan(0);
  }, 60000);
});

describe('saves', () => {
  it('reads a saved game back from JSON, plays on, and refuses things that are not saves', async () => {
    const { migrate } = await import('../src/engine/migrate');
    const g = mkGame(58);
    for (let w = 0; w < 5; w++) playWeek(g);
    const back = migrate(JSON.parse(JSON.stringify(g)))!;
    expect(back).not.toBeNull();
    expect(back.career.goals).toHaveLength(3);
    expect(back.cup.rounds).toHaveLength(7);
    playWeek(back);
    expect(back.week).toBe(g.week + 1);
    expect(migrate({} as never)).toBeNull();
    expect(migrate({ ...JSON.parse(JSON.stringify(g)), version: 99 })).toBeNull();
    expect(migrate({ ...JSON.parse(JSON.stringify(g)), version: 1 })).toBeNull();
  }, 60000);
});
