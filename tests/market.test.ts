import { describe, expect, it } from 'vitest';
import { ensureMarket, marketValue, wageBill, wageFor } from '../src/engine/economy';
import { describeEvent, drawEvent } from '../src/engine/events/events';
import { createGame, humanOf, joinClub } from '../src/engine/game';
import { bestLineup, selScore } from '../src/engine/match/lineup';
import { reviewManagers } from '../src/engine/market/managers';
import { loanPass, marketPass, MIN_POS, POSITION_LIST, SQUAD_MAX, SQUAD_MIN, windowOf } from '../src/engine/market/transfers';
import { ovrOf } from '../src/engine/player';
import { autoBuild, BASE_POOL } from '../src/engine/pointbuy';
import { makeRng } from '../src/engine/rng';
import { startNextSeason } from '../src/engine/season';
import { playWeek } from '../src/engine/week';

const mkGame = (seed = 31) => {
  const g = createGame(seed, { name: 'T', position: 'CM', heightCm: 182, build: 'athletic', foot: 'right', weakFoot: 2, attrs: autoBuild('CM', 182, 'athletic', BASE_POOL), nowLater: 0 });
  joinClub(g, g.offers.length - 1);
  return g;
};
const totalFunds = (g: ReturnType<typeof mkGame>) => g.clubs.reduce((a, c) => a + c.funds, 0);
const squadOk = (g: ReturnType<typeof mkGame>) => g.clubs.every(c => {
  const sq = g.players.filter(p => p.clubId === c.id);
  return sq.length >= SQUAD_MIN && sq.length <= SQUAD_MAX && POSITION_LIST.every(pos => sq.filter(p => p.position === pos).length >= MIN_POS[pos]);
});

describe('economy', () => {
  it('values rise with ability and promise and fall with age and a short contract', () => {
    const g = mkGame();
    const p = g.players.find(x => !x.human && x.age >= 25 && x.age <= 27)!;
    const base = marketValue(p);
    expect(marketValue({ ...p, age: 33 })).toBeLessThan(base);
    expect(marketValue({ ...p, contractYears: 1 })).toBeLessThanOrEqual(marketValue({ ...p, contractYears: 3 }));
    const young = { ...p, age: 19, potential: ovrOf(p) + 15, contractYears: 3 };
    expect(marketValue(young)).toBeGreaterThan(marketValue({ ...young, potential: ovrOf(p) }));
    expect(wageFor(70)).toBeGreaterThan(wageFor(60));
  });
  it('every new player and club starts with a wage, a contract, money and a manager', () => {
    const g = mkGame();
    expect(g.players.every(p => p.wage > 0 || p.human)).toBe(true);
    expect(g.clubs.every(c => c.funds > 0 && c.wealth >= 0.85 && c.mgr.name.length > 3)).toBe(true);
    expect(wageBill(g, g.clubs[0].id)).toBeGreaterThan(0);
  });
  it('fills in an old save, and does it only once', () => {
    const g = mkGame();
    for (const p of g.players) { delete (p as Partial<typeof p>).wage; delete (p as Partial<typeof p>).contractYears; }
    for (const c of g.clubs) { delete (c as Partial<typeof c>).funds; delete (c as Partial<typeof c>).mgr; delete (c as Partial<typeof c>).wealth; }
    ensureMarket(g);
    expect(g.players.every(p => Number.isFinite(p.wage) && Number.isFinite(p.contractYears))).toBe(true);
    expect(g.clubs.every(c => Number.isFinite(c.funds) && c.mgr && c.wealth > 0)).toBe(true);
    const snap = JSON.stringify(g.clubs.map(c => [c.funds, c.mgr.name]));
    ensureMarket(g);
    expect(JSON.stringify(g.clubs.map(c => [c.funds, c.mgr.name]))).toBe(snap);
  });
});

describe('transfers', () => {
  it('windows are the first three matchdays and 19 to 23', () => {
    expect(windowOf(1)).toBe('summer'); expect(windowOf(3)).toBe('summer'); expect(windowOf(4)).toBeNull();
    expect(windowOf(19)).toBe('winter'); expect(windowOf(23)).toBe('winter'); expect(windowOf(24)).toBeNull();
  });
  it('a round of business moves players, keeps squads legal, and moves money rather than creating it', () => {
    const g = mkGame();
    const before = totalFunds(g);
    const owners = new Map(g.players.map(p => [p.id, p.clubId]));
    marketPass(g, makeRng(5), 4);
    const moved = g.players.filter(p => owners.get(p.id) !== undefined && owners.get(p.id) !== p.clubId).length;
    expect(moved).toBeGreaterThan(20);
    expect(Math.abs(totalFunds(g) - before)).toBeLessThan(1);
    expect(squadOk(g)).toBe(true);
    const me = humanOf(g);
    expect(me.clubId).toBe(owners.get(me.id));
    expect(g.deals.length).toBeGreaterThan(20);
  });
  it('loans send young reserves to smaller clubs and bring them home in the summer', () => {
    const g = mkGame();
    for (let i = 0; i < 6; i++) loanPass(g, makeRng(i + 1));
    const loaned = g.players.filter(p => p.loanFrom);
    expect(loaned.length).toBeGreaterThan(3);
    for (const p of loaned) { expect(p.clubId).not.toBe(p.loanFrom); expect(p.age).toBeLessThanOrEqual(21); }
    const home = new Map(loaned.map(p => [p.id, p.loanFrom]));
    for (let w = 0; w < 38; w++) { if (g.event) g.event = null; playWeek(g); }
    startNextSeason(g, g.summary!.contractExpired ? 0 : null);
    // After the summer window nobody is left on last season's loan terms unless a new one was agreed.
    const stillOut = g.players.filter(p => home.has(p.id) && p.loanFrom && p.loanFrom !== home.get(p.id));
    expect(stillOut.length).toBe(0);
  });
});

describe('contracts and the season', () => {
  it('contracts run down, free agents are pooled, and squads are legal after the summer', () => {
    const g = mkGame();
    const years = new Map(g.players.filter(p => !p.human).map(p => [p.id, p.contractYears]));
    for (let w = 0; w < 38; w++) { if (g.event) g.event = null; playWeek(g); }
    startNextSeason(g, g.summary!.contractExpired ? 0 : null);
    const fa = g.players.filter(p => p.clubId === null && !p.human);
    expect(fa.length).toBeLessThanOrEqual(150);
    expect(squadOk(g)).toBe(true);
    // Someone who had one year left either signed again for longer or left.
    const expiring = g.players.filter(p => years.get(p.id) === 1 && !p.human);
    expect(expiring.length).toBeGreaterThan(5);
    expect(expiring.every(p => p.clubId === null || p.contractYears >= 1)).toBe(true);
    expect(g.season).toBe(2);
  });
});

describe('managers', () => {
  it('a manager can be replaced, and the human club gets a reset and an event', () => {
    const g = mkGame();
    const me = humanOf(g);
    const club = g.clubs.find(c => c.id === me.clubId)!;
    const old = club.mgr.name;
    // Make the club the worst in its division for its squad, near the end of the season, then run the season review many times.
    let changed = 0;
    for (let seed = 1; seed <= 60; seed++) {
      const g2 = structuredClone(g);
      g2.week = 38;
      g2.fixtures[club.division].flat().forEach(f => { f.hg = f.h === club.id ? 0 : 3; f.ag = f.a === club.id ? 0 : 3; });
      reviewManagers(g2, makeRng(seed), 'season');
      if (g2.clubs.find(c => c.id === club.id)!.mgr.name !== old) {
        changed++;
        expect(g2.trust).toBe(0.5);
        expect(g2.flags.newMgr).toBeDefined();
        drawEvent(g2, makeRng(1));
        expect(g2.event?.id).toBe('newManager');
        expect(describeEvent(g2)!.options.length).toBe(3);
      }
    }
    expect(changed).toBeGreaterThan(5);
  });
  it('the manager shapes selection: shape, youth and mentality', () => {
    const g = mkGame();
    const me = humanOf(g);
    const club = g.clubs.find(c => c.id === me.clubId)!;
    const base = { week: 1, trust: 0 };
    const att = bestLineup(g.players, club.id, { ...base, mgr: { ...club.mgr, style: 'attacking', formation: '3-5-2' } });
    const def = bestLineup(g.players, club.id, { ...base, mgr: { ...club.mgr, style: 'defensive', formation: '4-3-3' } });
    expect(att.mentBias).toBeGreaterThan(def.mentBias);
    const kid = g.players.find(p => p.clubId === club.id && p.age <= 20 && !p.human)!;
    expect(selScore(kid, kid.position, { ...base, mgr: { ...club.mgr, youth: 1 } })).toBeGreaterThan(selScore(kid, kid.position, { ...base, mgr: { ...club.mgr, youth: 0 } }));
  });
});
