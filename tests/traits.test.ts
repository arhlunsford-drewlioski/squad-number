import { describe, expect, it } from 'vitest';
import { createGame, joinClub, humanOf } from '../src/engine/game';
import { buildRequest } from '../src/engine/moments/engine';
import { DEFAULT_SETUP, labCtx, libraryHealth, reportFor } from '../src/engine/moments/lab';
import { TEMPLATE_BY_ID, TEMPLATES } from '../src/engine/moments/templates';
import { autoBuild, BASE_POOL } from '../src/engine/pointbuy';
import { applyTraitWork, defaultPlan } from '../src/engine/training';
import { missingPrereq, TRAIT_BY_ID, TRAIT_GOAL, TRAITS } from '../src/engine/traits';
import { beginWeek } from '../src/engine/week';

const mkGame = () => {
  const g = createGame(55, { name: 'T', position: 'ST', heightCm: 182, build: 'athletic', foot: 'right', weakFoot: 2, attrs: autoBuild('ST', 182, 'athletic', BASE_POOL), nowLater: 0 });
  joinClub(g, 0);
  return g;
};

describe('library size and health', () => {
  it('has close to 100 moments, with trait options, and no balance warnings', () => {
    expect(TEMPLATES.filter(t => !t.followOnly).length).toBeGreaterThanOrEqual(95);
    expect(TEMPLATES.flatMap(t => t.options).filter(o => o.trait).length).toBeGreaterThanOrEqual(10);
    const h = libraryHealth();
    expect(h.issues).toEqual([]);
  });
  it('every trait unlocks at least one option', () => {
    for (const t of TRAITS) expect(TEMPLATES.some(x => x.options.some(o => o.trait === t.id)), t.id).toBe(true);
  });
});

describe('traits in moments', () => {
  it('lock an option until the trait is learned', () => {
    const tpl = TEMPLATE_BY_ID.oneOnOne;
    const meta = { side: 'h' as const, humanId: 'x', scoreOwn: 0, scoreOpp: 0, stage: 1 as const, seed: 's' };
    const without = buildRequest(tpl, labCtx({ ...DEFAULT_SETUP, myLevel: 14 }), meta).req.options.find(o => o.id === 'finesse')!;
    const withIt = buildRequest(tpl, labCtx({ ...DEFAULT_SETUP, myLevel: 14, traits: ['finesseShot'] }), meta).req.options.find(o => o.id === 'finesse')!;
    expect(without.locked).toBe(true);
    expect(without.lockText).toMatch(/Finesse shot/);
    expect(withIt.locked).toBe(false);
  });
  it('a trait bonus makes the matching option easier', () => {
    const tpl = TEMPLATE_BY_ID.crossIncoming;
    const plain = reportFor(tpl, { ...DEFAULT_SETUP, slot: 'ST' }).find(r => r.id === 'header')!;
    const trait = reportFor(tpl, { ...DEFAULT_SETUP, slot: 'ST', traits: ['aerialThreat'] }).find(r => r.id === 'header')!;
    expect(trait.s).toBeGreaterThan(plain.s);
  });
  it('the reader trait improves what you see', () => {
    const tpl = TEMPLATE_BY_ID.secondBall;
    const meta = { side: 'h' as const, humanId: 'x', scoreOwn: 0, scoreOpp: 0, stage: 1 as const, seed: 's' };
    const a = buildRequest(tpl, labCtx({ ...DEFAULT_SETUP, myLevel: 8 }), meta).req.read;
    const b = buildRequest(tpl, labCtx({ ...DEFAULT_SETUP, myLevel: 8, traits: ['reader'] }), meta).req.read;
    expect(b).toBeGreaterThan(a);
  });
});

describe('learning a trait', () => {
  it('makes no progress without the attributes, then unlocks after enough skill work', () => {
    const g = mkGame();
    const me = humanOf(g);
    g.training = { ...defaultPlan('ST'), traitFocus: 'finesseShot', sessions: [{ programme: 'skillWork', intensity: 'standard' }, { programme: 'skillWork', intensity: 'standard' }, { programme: 'skillWork', intensity: 'standard' }] };
    expect(missingPrereq(me, TRAIT_BY_ID.finesseShot).length).toBeGreaterThan(0);
    expect(applyTraitWork(me, g.training, g.traitProgress)).toBeNull();
    expect(g.traitProgress.finesseShot ?? 0).toBe(0);
    me.attrs.technique = 12; me.attrs.finishing = 10;
    let weeks = 0, got = null as string | null;
    while (!got && weeks < 60) { got = applyTraitWork(me, g.training, g.traitProgress); weeks++; }
    expect(got).toBe('finesseShot');
    expect(me.traits).toContain('finesseShot');
    expect(weeks).toBeGreaterThan(3);
    expect(weeks).toBeLessThan(25);
    expect(g.traitProgress.finesseShot).toBe(TRAIT_GOAL);
  });
  it('is applied in the weekly loop and announced', () => {
    const g = mkGame();
    const me = humanOf(g);
    me.attrs.technique = 13; me.attrs.finishing = 11;
    g.training = { ...defaultPlan('ST'), traitFocus: 'finesseShot', sessions: [{ programme: 'skillWork', intensity: 'hard' }, { programme: 'skillWork', intensity: 'hard' }, { programme: 'skillWork', intensity: 'hard' }] };
    g.traitProgress.finesseShot = 95;
    beginWeek(g);
    expect(me.traits).toContain('finesseShot');
    expect(g.inbox.some(m => m.subject.includes('Finesse shot'))).toBe(true);
    expect(g.training.traitFocus).toBeNull();
  });
});
