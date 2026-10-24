import { describe, expect, it } from 'vitest';
import { createGame, joinClub, humanOf } from '../src/engine/game';
import { bestLineup } from '../src/engine/match/lineup';
import { simulateMatch } from '../src/engine/match/sim';
import { fill } from '../src/engine/moments/engine';
import { bandOf, readQuality, tierProbs } from '../src/engine/moments/resolver';
import { TEMPLATES } from '../src/engine/moments/templates';
import { TIERS } from '../src/engine/moments/types';
import { autoBuild, BASE_POOL } from '../src/engine/pointbuy';
import { POSITIONS } from '../src/engine/positions';
import { makeRng } from '../src/engine/rng';
import { playWeek, beginWeek, matchCtx, completeWeek } from '../src/engine/week';
import { LiveMatch } from '../src/view/live';

const mkGame = (pos: 'ST' | 'CB' | 'GK' | 'CM' = 'ST') => {
  const g = createGame(101, { name: 'T', position: pos, heightCm: 182, build: 'athletic', foot: 'right', weakFoot: 2, attrs: autoBuild(pos, 182, 'athletic', BASE_POOL), nowLater: 0 });
  joinClub(g, 0);
  return g;
};

describe('moment library', () => {
  it('has at least 50 templates with unique ids and four outcomes per option', () => {
    expect(TEMPLATES.length).toBeGreaterThanOrEqual(50);
    expect(new Set(TEMPLATES.map(t => t.id)).size).toBe(TEMPLATES.length);
    for (const t of TEMPLATES) {
      expect(t.options.length).toBeGreaterThanOrEqual(2);
      expect(new Set(t.options.map(o => o.id)).size).toBe(t.options.length);
      for (const o of t.options) {
        expect(o.out.length).toBe(4);
        if (o.needs) expect(o.needs.min).toBeGreaterThan(0);
        for (const out of o.out) if (out.follow) expect(TEMPLATES.some(x => x.id === out.follow && x.followOnly)).toBe(true);
      }
    }
  });
  it('covers every position with plenty of choice, including defending and building', () => {
    for (const p of POSITIONS) {
      const mine = TEMPLATES.filter(t => !t.followOnly && t.for.includes(p.id));
      expect(mine.length).toBeGreaterThanOrEqual(8);
      expect(mine.some(t => t.kind === 'defend')).toBe(true);
    }
  });
  it('fills every text token', () => {
    const tok = { minute: 50 };
    for (const t of TEMPLATES) {
      expect(fill(t.prompt, tok)).not.toMatch(/[{}]/);
      for (const o of t.options) { expect(fill(o.label, tok)).not.toMatch(/[{}]/); expect(fill(o.desc, tok)).not.toMatch(/[{}]/); for (const out of o.out) expect(fill(out.text, tok)).not.toMatch(/[{}]/); }
    }
  });
});

describe('resolver', () => {
  it('tier probabilities add to one and better execution means better tiers', () => {
    for (const risk of ['safe', 'balanced', 'gamble'] as const) {
      let prevGreat = -1;
      for (const s of [0.1, 0.3, 0.5, 0.7, 0.9]) {
        const p = tierProbs(s, risk);
        expect(p.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 6);
        expect(p[0]).toBeGreaterThanOrEqual(prevGreat);
        prevGreat = p[0];
      }
    }
  });
  it('a sharp reader sees the odds and a newcomer does not', () => {
    const sharp = { attrs: { vision: 16, decisions: 16, anticipation: 16 } } as never;
    const dull = { attrs: { vision: 4, decisions: 4, anticipation: 4 } } as never;
    expect(readQuality(sharp)).toBeGreaterThan(0.7);
    expect(readQuality(dull)).toBeLessThan(0.2);
    expect(bandOf(0.9, readQuality(dull), 'x')).toBe('unclear');
    expect(bandOf(0.9, readQuality(sharp), 'x')).toBe('likely');
    expect(bandOf(0.1, readQuality(sharp), 'x')).toBe('risky');
  });
});

describe('moments in a match', () => {
  it('gives a starter several moments, is deterministic, and keeps the books straight', () => {
    const g = mkGame('ST');
    const me = humanOf(g);
    const ctx = { week: 1, trust: 0 };
    const club = g.clubs.find(c => c.id === me.clubId)!;
    const opp = g.clubs.find(c => c.division === club.division && c.id !== club.id)!;
    me.attrs.finishing = 14; me.attrs.composure = 12; me.attrs.pace = 12;
    const H = bestLineup(g.players, club.id, ctx), A = bestLineup(g.players, opp.id, ctx);
    let total = 0, n = 0;
    for (let seed = 1; seed <= 25; seed++) {
      const mctx = { humanId: me.id, moments: { confidence: 50, recent: [] as string[] } };
      const a = simulateMatch(H, A, makeRng(seed), mctx);
      const b = simulateMatch(H, A, makeRng(seed), mctx);
      expect(a.hg).toBe(b.hg); expect(a.ag).toBe(b.ag);
      expect(a.moments?.logs.map(l => l.text)).toEqual(b.moments?.logs.map(l => l.text));
      const goals = Object.values(a.players).reduce((s, p) => s + p.g, 0);
      expect(goals).toBe(a.hg + a.ag);
      if (a.players[me.id]?.start) { total += a.moments?.logs.length ?? 0; n++; }
    }
    if (n) expect(total / n).toBeGreaterThan(2.5);
  });
  it('plays a full matchday through begin and complete, with a report that lists the decisions', () => {
    const g = mkGame('CM');
    const ws = beginWeek(g)!;
    const r = simulateMatch(ws.H, ws.A, ws.rng, matchCtx(g, ws));
    completeWeek(g, ws, r);
    expect(g.week).toBe(2);
    expect(g.reports[0].moments).toBeDefined();
    expect(g.confidence).toBeGreaterThan(4);
    expect(g.confidence).toBeLessThan(96);
  });
  it('a full season with engine-made decisions still runs and ends cleanly', () => {
    const g = mkGame('CB');
    for (let w = 0; w < 38; w++) playWeek(g);
    expect(g.phase).toBe('seasonEnd');
  });
});

describe('live match', () => {
  it('pauses for decisions, takes choices, and finishes with a complete timeline', () => {
    const g = mkGame('ST');
    const me = humanOf(g);
    for (const k of Object.keys(me.attrs) as (keyof typeof me.attrs)[]) if (k !== 'handling' && k !== 'reflexes') me.attrs[k] = 14;
    let decisions = 0, finished = 0;
    for (let seed = 0; seed < 8; seed++) {
      g.seed = 500 + seed;
      const ws = beginWeek(structuredClone(g))!;
      const club = (id: string) => ({ clubId: id, name: id, short: id, c1: '#c00', c2: '#fff', formation: '4-4-2' as const });
      const live = new LiveMatch({ H: ws.H, A: ws.A, rng: ws.rng, ctx: matchCtx(g, ws), teams: { h: { ...club(ws.fx.h), formation: ws.H.formation }, a: { ...club(ws.fx.a), formation: ws.A.formation } }, mode: 'full' });
      let guard = 0;
      while (live.status === 'decision' && guard++ < 20) {
        decisions++;
        expect(live.request!.options.length).toBeGreaterThanOrEqual(2);
        expect(live.tl.pauseT).not.toBeNull();
        live.choose(live.request!.options.find(o => !o.locked)!.id);
      }
      expect(live.status).toBe('finished');
      finished++;
      expect(live.tl.complete).toBe(true);
      expect(live.tl.pauseT).toBeNull();
      expect(live.tl.goals.length).toBe(live.result!.hg + live.result!.ag);
      expect((live.result!.moments?.logs ?? []).every(l => TIERS.includes(l.tier))).toBe(true);
    }
    expect(finished).toBe(8);
    expect(decisions).toBeGreaterThan(8);
  });
  it('autoFinish plays out the rest with the engine deciding', () => {
    const g = mkGame('CM');
    const ws = beginWeek(g)!;
    const club = (id: string, f: never) => ({ clubId: id, name: id, short: id, c1: '#c00', c2: '#fff', formation: f });
    const live = new LiveMatch({ H: ws.H, A: ws.A, rng: ws.rng, ctx: matchCtx(g, ws), teams: { h: club(ws.fx.h, ws.H.formation as never), a: club(ws.fx.a, ws.A.formation as never) }, mode: 'highlights' });
    live.autoFinish();
    expect(live.status).toBe('finished');
    expect(live.tl.complete).toBe(true);
  });
});
