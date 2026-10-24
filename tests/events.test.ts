import { describe, expect, it } from 'vitest';
import { chooseEvent, describeEvent, drawEvent, EVENTS, ctxFor } from '../src/engine/events/events';
import { createGame, humanOf, joinClub } from '../src/engine/game';
import { bestLineup } from '../src/engine/match/lineup';
import { simulateMatch } from '../src/engine/match/sim';
import { autoBuild, BASE_POOL } from '../src/engine/pointbuy';
import { makeRng } from '../src/engine/rng';
import { startNextSeason } from '../src/engine/season';
import { beginWeek, completeWeek, matchCtx, playWeek } from '../src/engine/week';

const mkGame = () => {
  const g = createGame(77, { name: 'T', position: 'ST', heightCm: 182, build: 'athletic', foot: 'right', weakFoot: 2, attrs: autoBuild('ST', 182, 'athletic', BASE_POOL), nowLater: 0 });
  joinClub(g, 0);
  const me = humanOf(g);
  for (const k of Object.keys(me.attrs) as (keyof typeof me.attrs)[]) if (k !== 'handling' && k !== 'reflexes') me.attrs[k] = 14;
  return g;
};

/** Plays a week, forcing a card on the human's record first. */
function weekWithCard(g: ReturnType<typeof mkGame>, card: { yellow?: number; red?: number }) {
  const ws = beginWeek(g)!;
  const r = simulateMatch(ws.H, ws.A, ws.rng, matchCtx(g, ws));
  const pm = r.players[humanOf(g).id];
  expect(pm, 'the human should have played').toBeDefined();
  pm.yellow = card.yellow ?? 0; pm.red = card.red ?? 0;
  completeWeek(g, ws, r);
}

describe('suspensions', () => {
  it('a red card brings a ban of two or more matches, and a second yellow one match', () => {
    const g = mkGame();
    weekWithCard(g, { red: 1 });
    expect(humanOf(g).suspended).toBeGreaterThanOrEqual(2);
    expect(g.flags['s:banAt']).toBeDefined();
    const g2 = mkGame();
    weekWithCard(g2, { yellow: 2, red: 1 });
    expect(humanOf(g2).suspended).toBe(1);
  });
  it('the fifth yellow of the season is a one-match ban', () => {
    const g = mkGame();
    humanOf(g).stats.yellow = 4;
    weekWithCard(g, { yellow: 1 });
    expect(humanOf(g).suspended).toBe(1);
  });
  it('a banned player is left out and serves the ban week by week', () => {
    const g = mkGame();
    weekWithCard(g, { red: 1 });
    const me = humanOf(g);
    const before = me.suspended;
    const L = bestLineup(g.players, me.clubId!, { week: g.week, trust: 0 });
    expect(L.xi.some(s => s.player.id === me.id) || L.bench.some(b => b.id === me.id)).toBe(false);
    g.event = null;
    playWeek(g);
    expect(me.suspended).toBe(before - 1);
  });
});

describe('events', () => {
  it('an injury raises the physio at once, and each rehab choice does what it says', () => {
    const run = (choice: string) => {
      const g = mkGame();
      const me = humanOf(g);
      me.injuredWeeks = 6; g.injuryHandled = false;
      drawEvent(g, makeRng(1));
      expect(g.event?.id).toBe('injuryDiagnosis');
      expect(describeEvent(g)!.options.length).toBe(3);
      chooseEvent(g, choice);
      return { g, me };
    };
    const intense = run('intense');
    expect(intense.me.injuredWeeks).toBeLessThan(6);
    expect(intense.g.flags['s:reinjury']).toBeGreaterThan(0);
    const spec = run('specialist');
    expect(spec.me.injuredWeeks).toBeLessThan(6);
    expect(spec.g.trust).toBeLessThan(0.5);
    const std = run('standard');
    expect(std.me.injuredWeeks).toBe(6);
    expect(std.g.injuryHandled).toBe(true);
  });
  it('a ban raises a hearing, and appealing can cut a long ban', () => {
    let cut = 0;
    for (let seed = 1; seed <= 25; seed++) {
      const g = mkGame();
      const me = humanOf(g);
      me.suspended = 3; g.flags['s:banAt'] = g.week;
      g.seed = seed;
      drawEvent(g, makeRng(seed));
      expect(g.event?.id).toBe('hearing');
      chooseEvent(g, 'appeal');
      if (me.suspended === 2) cut++;
    }
    expect(cut).toBeGreaterThan(1);
    expect(cut).toBeLessThan(23);
  });
  it('contract talks change the contract the way each answer promises', () => {
    const base = (id: string, seed = 1) => {
      const g = mkGame();
      g.seed = seed;
      g.contract = { years: 1, wage: 1000 };
      g.week = 20;
      g.event = { id: 'contractOffer', week: 20, data: { base: 1000 } };
      chooseEvent(g, id);
      return g;
    };
    const a = base('sign3');
    expect(a.contract).toEqual({ years: 4, wage: 1250 });
    const b = base('sign1');
    expect(b.contract!.years).toBe(2);
    expect(b.contract!.wage).toBe(1100);
    const r = base('refuse');
    expect(r.contract!.years).toBe(1);
    expect(r.trust).toBeLessThan(0.5);
    const outcomes = new Set<number>();
    for (let seed = 1; seed <= 30; seed++) outcomes.add(base('counter', seed).contract!.wage);
    expect(outcomes.size).toBeGreaterThanOrEqual(2);
  });
  it('a loan moves you to a smaller club and you return in the summer', () => {
    const g = mkGame();
    const me = humanOf(g);
    const home = me.clubId!;
    const c = ctxFor(g, makeRng(3));
    const lower = g.clubs.find(x => x.division > c.club.division)!;
    g.event = { id: 'loanOffer', week: 10, data: { clubId: lower.id } };
    chooseEvent(g, 'go');
    expect(me.clubId).toBe(lower.id);
    expect(g.loan).toEqual({ from: home, to: lower.id, trust: expect.any(Number) });
    for (let w = 0; w < 38; w++) { if (g.event) chooseEvent(g, describeEvent(g)!.options[0].id); playWeek(g); }
    expect(g.phase).toBe('seasonEnd');
    startNextSeason(g, g.summary!.contractExpired ? 0 : null);
    if (!g.summary) expect(me.clubId).toBeTruthy();
    expect(g.loan).toBeNull();
  });
  it('every event can be described and every option applied without errors', () => {
    for (const def of EVENTS) {
      const g = mkGame();
      const me = humanOf(g);
      me.injuredWeeks = 6; me.suspended = 2; g.flags['s:banAt'] = 3; g.contract = { years: 1, wage: 900 }; g.week = 20; g.injuryHandled = def.id === 'rehabProgress';
      g.flags['s:injuredAt'] = 10;
      const c = ctxFor(g, makeRng(9));
      const data = def.data ? def.data(c) : {};
      for (const o of def.options(c, data)) {
        const g2 = structuredClone(g);
        g2.event = { id: def.id, week: g2.week, data: structuredClone(data) };
        expect(def.body(ctxFor(g2, makeRng(1)), data).length).toBeGreaterThan(10);
        const res = chooseEvent(g2, o.id);
        expect(res, `${def.id}/${o.id}`).not.toBeNull();
        expect(res!.result.length).toBeGreaterThan(3);
        expect(g2.event).toBeNull();
      }
    }
  });
  it('a season with every event answered stays healthy and raises a sensible number of events', () => {
    const g = mkGame();
    let fired = 0;
    for (let w = 0; w < 38; w++) {
      if (g.event) { fired++; chooseEvent(g, describeEvent(g)!.options[0].id); }
      playWeek(g);
      expect(Number.isFinite(g.trust)).toBe(true);
      expect(g.confidence).toBeGreaterThanOrEqual(5);
      expect(g.confidence).toBeLessThanOrEqual(95);
    }
    expect(fired).toBeGreaterThanOrEqual(4);
    expect(fired).toBeLessThanOrEqual(24);
    expect(g.eventLog.length).toBe(Math.min(40, fired));
  });
});
