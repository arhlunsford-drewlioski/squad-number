import { describe, expect, it } from 'vitest';
import { buyCapFor, ceilingFor } from '../src/engine/body';
import { createGame } from '../src/engine/game';
import { bestLineup } from '../src/engine/match/lineup';
import { simulateMatch } from '../src/engine/match/sim';
import { ovrOf } from '../src/engine/player';
import { autoBuild, BASE_POOL, pointsSpent, startAttrs } from '../src/engine/pointbuy';
import { POSITIONS } from '../src/engine/positions';
import { makeRng } from '../src/engine/rng';
import { playWeek } from '../src/engine/week';
import { joinClub, humanOf } from '../src/engine/game';
import { startNextSeason } from '../src/engine/season';
import { applyPlan, coachFactor, defaultPlan, planUnits, projectGains } from '../src/engine/training';
import { DIVISIONS } from '../src/engine/world';

const choices = { name: 'T', position: 'ST' as const, heightCm: 182, build: 'athletic' as const, foot: 'right' as const, weakFoot: 2, attrs: autoBuild('ST', 182, 'athletic', BASE_POOL), nowLater: 0 };
const world = () => createGame(4242, choices);

describe('point buy', () => {
  it('costs nothing at the starting values and never overspends on auto-fill', () => {
    for (const p of POSITIONS) {
      expect(pointsSpent(startAttrs(p.id), p.id, 2)).toBe(0);
      expect(pointsSpent(autoBuild(p.id, 182, 'athletic', BASE_POOL), p.id, 2)).toBeLessThanOrEqual(BASE_POOL);
    }
  });
  it('starts a 17-year-old around 50 overall', () => {
    for (const p of POSITIONS) {
      const g = createGame(1, { ...choices, position: p.id, attrs: autoBuild(p.id, 182, 'athletic', BASE_POOL) });
      const me = g.players.find(x => x.human)!;
      expect(ovrOf(me)).toBeGreaterThanOrEqual(46);
      expect(ovrOf(me)).toBeLessThanOrEqual(54);
    }
  });
  it('height trades ceilings: tall gains aerial, loses quickness', () => {
    expect(ceilingFor('heading', 200, 'athletic')).toBeGreaterThan(ceilingFor('heading', 168, 'athletic'));
    expect(ceilingFor('acceleration', 200, 'athletic')).toBeLessThan(ceilingFor('acceleration', 168, 'athletic'));
    expect(buyCapFor('heading', 200, 'athletic')).toBeLessThanOrEqual(16);
  });
});

describe('world calibration', () => {
  it('puts division starters on the intended bands', () => {
    const g = world();
    const median = (xs: number[]) => xs.sort((a, b) => a - b)[Math.floor(xs.length / 2)];
    const med = DIVISIONS.map(d => median(g.clubs.filter(c => c.division === d.id).flatMap(c => g.players.filter(p => p.clubId === c.id).map(ovrOf).sort((a, b) => b - a).slice(0, 11))));
    expect(med[0]).toBeGreaterThanOrEqual(74);
    expect(med[0]).toBeLessThanOrEqual(81);
    expect(med[3]).toBeGreaterThanOrEqual(47);
    expect(med[3]).toBeLessThanOrEqual(54);
    expect(med[0]).toBeGreaterThan(med[1]);
    expect(med[1]).toBeGreaterThan(med[2]);
    expect(med[2]).toBeGreaterThan(med[3]);
  });
});

describe('match engine', () => {
  it('is deterministic for a seed', () => {
    const g = world();
    const [a, b] = g.clubs;
    const L = (id: string) => bestLineup(g.players, id, { week: 1, trust: 0 });
    const r1 = simulateMatch(L(a.id), L(b.id), makeRng(5));
    const r2 = simulateMatch(L(a.id), L(b.id), makeRng(5));
    expect(r1.hg).toBe(r2.hg);
    expect(r1.ag).toBe(r2.ag);
    expect(r1.events.length).toBe(r2.events.length);
  });
  it('produces football-shaped results', () => {
    const g = world();
    const rng = makeRng(8);
    const lineups = new Map(g.clubs.map(c => [c.id, bestLineup(g.players, c.id, { week: 1, trust: 0 })]));
    let n = 0, goals = 0, hw = 0, aw = 0;
    for (const rd of g.fixtures[2]) for (const f of rd) {
      const r = simulateMatch(lineups.get(f.h)!, lineups.get(f.a)!, rng);
      n++; goals += r.hg + r.ag; if (r.hg > r.ag) hw++; else if (r.hg < r.ag) aw++;
    }
    expect(goals / n).toBeGreaterThan(2.2);
    expect(goals / n).toBeLessThan(3.2);
    expect(hw / n).toBeGreaterThan(0.38);
    expect(hw).toBeGreaterThan(aw);
  });
  it('plays a full matchday across the world and updates fixtures and stats', () => {
    const g = world();
    g.phase = 'play';
    const me = g.players.find(p => p.human)!;
    me.clubId = g.clubs.find(c => c.division === 4)!.id;
    playWeek(g);
    expect(g.week).toBe(2);
    expect(Object.values(g.fixtures).every(f => f[0].every(x => x.hg !== null))).toBe(true);
    expect(g.reports.length).toBe(1);
    expect(g.players.filter(p => p.stats.apps > 0).length).toBeGreaterThan(300);
  });
});

describe('training and progression', () => {
  it('trains only the attributes a programme names, and never past the ceiling', () => {
    const g = world();
    joinClub(g, 0);
    const me = humanOf(g);
    const before = { ...me.attrs };
    const plan = defaultPlan('ST');
    const gains = applyPlan(me, plan, 1);
    const trained = new Set(Object.keys(planUnits(plan)));
    for (const [id, v] of gains) { expect(v).toBeGreaterThan(0); expect(trained.has(id)).toBe(true); expect(me.attrs[id]).toBeLessThanOrEqual(me.ceil[id] + 1e-9); }
    expect(Object.keys(before).filter(k => me.attrs[k as keyof typeof before] !== before[k as keyof typeof before]).every(k => trained.has(k))).toBe(true);
  });
  it('focus adds to the chosen attribute, and a better club coaches faster', () => {
    const g = world();
    const me = humanOf(g);
    const plain = projectGains(me, defaultPlan('ST'), 1);
    const focused = projectGains(me, { ...defaultPlan('ST'), focus: 'strength' }, 1);
    expect(focused.find(([id]) => id === 'strength')![1]).toBeGreaterThan(plain.find(([id]) => id === 'strength')?.[1] ?? 0);
    expect(coachFactor(80)).toBeGreaterThan(coachFactor(48));
  });
  it('rolls a full season over: tables, ageing, squads, promotion and relegation', () => {
    const g = world();
    joinClub(g, 0);
    for (let w = 0; w < 38; w++) playWeek(g);
    expect(g.phase).toBe('seasonEnd');
    const ages = new Map(g.players.map(p => [p.id, p.age]));
    startNextSeason(g, g.summary!.contractExpired ? 0 : null);
    expect(g.season).toBe(2);
    expect(g.week).toBe(1);
    expect(g.phase).toBe('play');
    for (const d of DIVISIONS) expect(g.clubs.filter(c => c.division === d.id).length).toBe(20);
    for (const p of g.players) if (ages.has(p.id)) expect(p.age).toBe(ages.get(p.id)! + 1);
    for (const c of g.clubs) { const n = g.players.filter(p => p.clubId === c.id).length; expect(n).toBeGreaterThanOrEqual(22); expect(n).toBeLessThanOrEqual(28); }
    expect(g.history.length).toBe(1);
    expect(g.players.every(p => p.stats.apps === 0 && p.condition === 100)).toBe(true);
  });
});
