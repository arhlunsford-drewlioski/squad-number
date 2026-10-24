import { describe, expect, it } from 'vitest';
import { createGame, joinClub } from '../src/engine/game';
import { bestLineup } from '../src/engine/match/lineup';
import { buildReplay } from '../src/engine/match/replay';
import { matchSession, simulateMatch } from '../src/engine/match/sim';
import { autoBuild, BASE_POOL } from '../src/engine/pointbuy';
import { makeRng } from '../src/engine/rng';
import { buildTimeline, frameAt } from '../src/view/timeline';

const g = createGame(31, { name: 'T', position: 'ST', heightCm: 182, build: 'athletic', foot: 'right', weakFoot: 2, attrs: autoBuild('ST', 182, 'athletic', BASE_POOL), nowLater: 0 });
joinClub(g, 0);
const byId = (id: string) => g.players.find(p => p.id === id)!;
const L = (cid: string) => bestLineup(g.players, cid, { week: 1, trust: 0 });
const team = (i: number) => { const c = g.clubs[i]; return { clubId: c.id, name: c.name, short: c.short, c1: c.c1, c2: c.c2, formation: L(c.id).formation }; };

function replayFor(seed: number) {
  const r = simulateMatch(L(g.clubs[0].id), L(g.clubs[1].id), makeRng(seed));
  return { r, replay: buildReplay(r, team(0), team(1), byId) };
}

describe('match session', () => {
  it('draining the session gives the same match as simulateMatch', () => {
    const a = simulateMatch(L(g.clubs[2].id), L(g.clubs[3].id), makeRng(9));
    const s = matchSession(L(g.clubs[2].id), L(g.clubs[3].id), makeRng(9));
    let n = 0;
    let step = s.next();
    while (!step.done) { n++; step = s.next(); }
    expect(n).toBeGreaterThan(90);
    expect(step.value.hg).toBe(a.hg);
    expect(step.value.ag).toBe(a.ag);
    expect(step.value.steps.length).toBe(a.steps.length);
  });
  it('records a step for every shot and goals match the score', () => {
    const { r } = replayFor(3);
    const goals = r.steps.filter(s => s.kind === 'goal' || s.kind === 'pen-goal').length;
    expect(goals).toBe(r.hg + r.ag);
    expect(r.steps.every((s, i, a) => i === 0 || a[i - 1].min <= s.min)).toBe(true);
  });
});

describe('2D timeline', () => {
  it('has ordered items, a sensible length and one goal moment per goal', () => {
    for (let seed = 1; seed <= 8; seed++) {
      const { r, replay } = replayFor(seed);
      const tl = buildTimeline(replay);
      expect(tl.items.every((it, i, a) => it.t1 >= it.t0 && (i === 0 || it.t0 === a[i - 1].t1))).toBe(true);
      expect(tl.total).toBeGreaterThan(40000);
      expect(tl.total).toBeLessThan(200000);
      expect(tl.goals.length).toBe(r.hg + r.ag);
    }
  });
  it('draws a full, finite frame at any time, and the score ends at the result', () => {
    const { r, replay } = replayFor(5);
    const tl = buildTimeline(replay);
    for (let t = 0; t < tl.total; t += 777) {
      const f = frameAt(tl, t);
      expect(f.players.length).toBeGreaterThanOrEqual(18);
      expect(f.players.length).toBeLessThanOrEqual(22);
      for (const p of f.players) { expect(Number.isFinite(p.x) && Number.isFinite(p.y)).toBe(true); expect(p.x).toBeGreaterThan(-0.1); expect(p.x).toBeLessThan(1.1); }
      expect(f.ball.x).toBeGreaterThan(-0.1); expect(f.ball.x).toBeLessThan(1.1);
    }
    const end = frameAt(tl, tl.total);
    expect(end.score).toEqual([r.hg, r.ag]);
  });
});
