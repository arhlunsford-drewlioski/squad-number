import type { Attrs } from '../attributes';
import type { Player } from '../player';
import type { Position } from '../positions';
import { ovrAt } from '../rating';
import { clamp, type Rng } from '../rng';
import { avgOf, sigmoid, sumOf } from '../util';
import { autoPick, buildRequest, DEFAULT_CONF, DEFAULT_RATE, fill } from '../moments/engine';
import { pickTemplate, planMoments } from '../moments/director';
import { rollTier } from '../moments/resolver';
import { TEMPLATE_BY_ID } from '../moments/templates';
import { TIERS, type Kind, type MomentCtx, type MomentLog, type MomentOutcome, type MomentRequest, type Outcome, type TemplateDef, type Weights } from '../moments/types';
import { ATTR_IDS } from '../attributes';
import { numberPlayers, type ReplayPlayer } from './replay';
import type { Instructions, Lineup, MatchEvent, MatchResult, Mentality, PlayerMatch, SeqStep, TeamStats } from './types';

type Side = 'h' | 'a';
type Pos = Position;

interface Entry { p: Player; slot: Pos; idx: number; on: number; off: number; sub: boolean; red: boolean }
interface Team { key: Side; L: Lineup; entries: Entry[]; ment: Mentality }

// ---- what each position contributes to each phase of play ----
const W_CREATE: Record<Pos, number> = { GK: 0, CB: 0.1, FB: 0.5, DM: 0.3, CM: 0.8, AM: 1.4, W: 1.3, ST: 1.2 };
const W_SHIELD: Record<Pos, number> = { GK: 0, CB: 1.5, FB: 1.0, DM: 1.3, CM: 0.6, AM: 0.25, W: 0.3, ST: 0.2 };
const W_BUILD: Record<Pos, number> = { GK: 0.3, CB: 0.6, FB: 0.8, DM: 1.2, CM: 1.4, AM: 1.3, W: 0.9, ST: 0.5 };
const W_PRESS: Record<Pos, number> = { GK: 0, CB: 1.2, FB: 1.0, DM: 1.4, CM: 1.1, AM: 0.6, W: 0.5, ST: 0.5 };
const W_SHOOT: Record<Pos, number> = { GK: 0, CB: 0.5, FB: 0.6, DM: 0.5, CM: 1.2, AM: 2.5, W: 2.5, ST: 5 };
const W_LONG: Record<Pos, number> = { GK: 0, CB: 0.4, FB: 1, DM: 2, CM: 3, AM: 3, W: 2, ST: 1.5 };
const W_MAKE: Record<Pos, number> = { GK: 0, CB: 0.5, FB: 1.6, DM: 1.2, CM: 2.5, AM: 3, W: 3, ST: 1.5 };
const W_BLOCK: Record<Pos, number> = { GK: 0, CB: 3, FB: 2, DM: 2, CM: 1, AM: 0.3, W: 0.4, ST: 0.2 };
const W_ERR: Record<Pos, number> = { GK: 0, CB: 1.4, FB: 1.2, DM: 1, CM: 0.8, AM: 0.3, W: 0.3, ST: 0.2 };

const createOf = (a: Attrs) => a.dribbling * 0.18 + a.passing * 0.14 + a.vision * 0.14 + a.offTheBall * 0.16 + a.pace * 0.1 + a.acceleration * 0.08 + a.technique * 0.1 + a.firstTouch * 0.06 + a.composure * 0.04;
export const shieldOf = (a: Attrs) => a.tackling * 0.2 + a.marking * 0.18 + a.positioning * 0.2 + a.anticipation * 0.14 + a.concentration * 0.08 + a.strength * 0.08 + a.pace * 0.07 + a.heading * 0.05;
const buildOf = (a: Attrs) => a.passing * 0.26 + a.vision * 0.16 + a.firstTouch * 0.16 + a.technique * 0.1 + a.composure * 0.12 + a.decisions * 0.12 + a.workRate * 0.04 + a.stamina * 0.04;
const pressOf = (a: Attrs) => a.tackling * 0.2 + a.positioning * 0.18 + a.anticipation * 0.16 + a.workRate * 0.18 + a.aggression * 0.1 + a.stamina * 0.1 + a.marking * 0.08;
const gkOf = (a: Attrs) => a.handling * 0.28 + a.reflexes * 0.3 + a.oneOnOnes * 0.12 + a.aerialReach * 0.1 + a.commandOfArea * 0.1 + a.positioning * 0.05 + a.concentration * 0.05;
const skillOf = (a: Attrs, how: 'open' | 'header' | 'long') =>
  how === 'open' ? a.finishing * 0.5 + a.composure * 0.3 + a.technique * 0.1 + a.firstTouch * 0.1
    : how === 'header' ? a.heading * 0.5 + a.jumping * 0.25 + a.composure * 0.15 + a.strength * 0.1
      : a.longShots * 0.55 + a.technique * 0.25 + a.composure * 0.2;

const mV = (m: Mentality) => (m === 'attacking' ? 1 : m === 'defensive' ? -1 : 0);

/** Freshness through the match: starting condition, stamina, and time on the pitch. */
function fatigue(e: Entry, minute: number, pressing: boolean): number {
  const c0 = e.p.condition / 100;
  const loss = clamp((1.05 - 0.5 * c0) * (0.32 - 0.0125 * e.p.attrs.stamina) * (pressing ? 1.12 : 1), 0.02, 0.32);
  const t = clamp(minute - e.on, 0, 90) / 90;
  return (1 - loss * Math.pow(t, 1.6)) * (0.9 + 0.1 * c0);
}

interface Agg { create: number; shield: number; build: number; press: number; gk: number; active: Entry[]; fat: Map<string, number> }

function aggregate(t: Team, minute: number, humanId: string | undefined, ins: Instructions | undefined): Agg {
  const active = t.entries.filter(e => e.on < minute && minute <= e.off && !e.red);
  const fat = new Map<string, number>();
  const acc = { create: [0, 0], shield: [0, 0], build: [0, 0], press: [0, 0] };
  let gk = 8;
  for (const e of active) {
    const mine = ins && e.p.id === humanId;
    const f = fatigue(e, minute, !!mine && ins!.defending === 'press');
    fat.set(e.p.id, f);
    const a = e.p.attrs;
    let cm = 1, sm = 1, pm = 1;
    if (mine) {
      if (ins!.movement === 'roam') { cm = 1.1; sm = 0.92; } else if (ins!.movement === 'hold') { cm = 0.92; sm = 1.05; }
      if (ins!.defending === 'press') pm = 1.12; else if (ins!.defending === 'drop') { pm = 0.92; sm *= 1.05; }
    }
    const add = (k: 'create' | 'shield' | 'build' | 'press', w: number, v: number) => { acc[k][0] += w * v * f; acc[k][1] += w; };
    add('create', W_CREATE[e.slot], createOf(a) * cm);
    add('shield', W_SHIELD[e.slot], shieldOf(a) * sm);
    add('build', W_BUILD[e.slot], buildOf(a));
    add('press', W_PRESS[e.slot], pressOf(a) * pm);
    if (e.slot === 'GK') gk = gkOf(a) * f;
  }
  const m = (k: keyof typeof acc) => (acc[k][1] ? acc[k][0] / acc[k][1] : 5);
  return { create: m('create'), shield: m('shield'), build: m('build'), press: m('press'), gk, active, fat };
}

function wpick<T>(rng: Rng, items: T[], w: (x: T) => number): T | null {
  let tot = 0;
  const ws = items.map(i => { const v = Math.max(0, w(i)); tot += v; return v; });
  if (tot <= 0) return items.length ? items[0] : null;
  let r = rng.next() * tot;
  for (let i = 0; i < items.length; i++) { r -= ws[i]; if (r <= 0) return items[i]; }
  return items[items.length - 1];
}

/** Where a quiet, tidy match starts before anything is added or taken away. */
export const RATING_BASE = 6.1;

export function poisson(rng: Rng, l: number): number {
  const L = Math.exp(-l);
  let k = 0;
  let p = 1;
  do { k++; p *= rng.next(); } while (p > L);
  return k - 1;
}

function newPM(e: Entry, side: Side): PlayerMatch {
  return { id: e.p.id, side, idx: e.idx, pos: e.slot, start: !e.sub, on: e.on, off: e.off, min: 0, g: 0, a: 0, sh: 0, sot: 0, xg: 0, kp: 0, sv: 0, bl: 0, err: 0, passes: 0, passOk: 0, tk: 0, tkWon: 0, int: 0, fouls: 0, yellow: 0, red: 0, mom: 0, rating: 6 };
}

export interface SimCtx {
  humanId?: string;
  instr?: Instructions;
  /** Turns on decision moments for the human player. */
  moments?: { confidence: number; recent: string[] };
}

/** What the session reports as it goes. */
export type SessionYield =
  | { kind: 'init'; players: ReplayPlayer[]; steps: SeqStep[]; events: MatchEvent[] }
  | { kind: 'tick'; min: number }
  | { kind: 'moment'; req: MomentRequest }
  | { kind: 'outcome'; out: MomentOutcome };

const other = (s: Side): Side => (s === 'h' ? 'a' : 'h');
/** Tunes how many team chances survive when the human's own chances come from decisions. */
const MOMENT_PS = 0.95;

/**
 * The match as a resumable session. Each yield is a pause point: before a possession sequence, or, with
 * moments on, a decision for the human player. Send the chosen option id back with next(); send undefined
 * to let the engine choose.
 */
export function* matchSession(H: Lineup, A: Lineup, rng: Rng, ctx: SimCtx = {}): Generator<SessionYield, MatchResult, string | undefined> {
  const mkTeam = (L: Lineup, key: Side, ment: Mentality): Team => ({ key, L, ment, entries: L.xi.map((s, i) => ({ p: s.player, slot: s.slot, idx: i, on: 0, off: 90, sub: false, red: false })) });
  const avgOvr = (L: Lineup) => avgOf(L.xi.map(s => ovrAt(s.player.attrs, s.slot)));
  const d = avgOvr(H) - avgOvr(A);
  const mentFor = (x: number): Mentality => (x > 4 ? 'attacking' : x < -4 ? 'defensive' : 'balanced');
  const T: Record<Side, Team> = { h: mkTeam(H, 'h', mentFor(d + 1.5 + (H.mentBias ?? 0))), a: mkTeam(A, 'a', mentFor(-d - 1.5 + (A.mentBias ?? 0))) };
  const events: MatchEvent[] = [];
  const pm: Record<string, PlayerMatch> = {};
  const ins = ctx.instr;
  const hid = ctx.humanId;

  // ---- discipline: fouls, cards and red cards, planned before the match is played ----
  const foulBase: Record<Pos, number> = { GK: 0.1, CB: 1.0, FB: 0.9, DM: 1.2, CM: 0.9, AM: 0.5, W: 0.4, ST: 0.6 };
  for (const t of [T.h, T.a]) {
    for (const e of t.entries) {
      let rate = 0.5 * foulBase[e.slot] * (0.55 + e.p.attrs.aggression / 14) * (0.8 + (20 - e.p.attrs.tackling) / 50);
      if (e.p.id === hid && ins?.defending === 'press') rate *= 1.25;
      const fouls = poisson(rng, rate * (e.off - e.on) / 90);
      let yel = 0;
      for (let i = 0; i < fouls; i++) {
        const minute = rng.int(Math.max(1, e.on + 1), e.off);
        if (e.red) break;
        if (rng.chance(0.003)) { e.red = true; e.off = minute; events.push({ min: minute, side: t.key, type: 'red', p: e.p.id }); continue; }
        if (rng.chance(0.17 + e.p.attrs.aggression * 0.005)) {
          yel++;
          events.push({ min: minute, side: t.key, type: 'yellow', p: e.p.id });
          if (yel === 2) { e.red = true; e.off = minute; events.push({ min: minute, side: t.key, type: 'red', p: e.p.id }); }
        }
      }
      const m = (pm[e.p.id] = newPM(e, t.key));
      m.fouls = fouls; m.yellow = Math.min(yel, 2); m.red = e.red ? 1 : 0;
    }
  }

  // ---- substitutions: up to three, tired outfielders first, same position where possible ----
  for (const t of [T.h, T.a]) {
    const bench = t.L.bench.slice();
    const cands = t.entries
      .filter(e => e.slot !== 'GK' && !e.red)
      .map(e => ({ e, k: e.p.condition + e.p.attrs.stamina * 2.2 + rng.next() * 30 }))
      .sort((x, y) => x.k - y.k);
    let made = 0;
    for (const c of cands) {
      if (made >= 3) break;
      if (made >= 1 && rng.chance(0.2)) continue;
      let i = bench.findIndex(b => b.position === c.e.slot && b.position !== 'GK');
      const hi = bench.findIndex(b => b.human && b.position === c.e.slot);
      if (hi >= 0 && rng.chance(0.45)) i = hi;
      if (i < 0) i = bench.findIndex(b => b.position !== 'GK');
      if (i < 0) break;
      const minute = rng.int(56, 84);
      const incoming = bench.splice(i, 1)[0];
      c.e.off = Math.min(c.e.off, minute);
      const ne: Entry = { p: incoming, slot: c.e.slot, idx: c.e.idx, on: minute, off: 90, sub: true, red: false };
      t.entries.push(ne);
      pm[incoming.id] = newPM(ne, t.key);
      events.push({ min: minute, side: t.key, type: 'sub', p: incoming.id, d: c.e.p.id });
      made++;
    }
  }

  // ---- the human player and the moments plan ----
  const allEntries = [...T.h.entries, ...T.a.entries];
  const hEntry = hid ? allEntries.find(e => e.p.id === hid) : undefined;
  const hSide: Side | undefined = hEntry ? (T.h.entries.includes(hEntry) ? 'h' : 'a') : undefined;
  const mom = ctx.moments && hEntry && hSide ? {
    plan: planMoments(rng, hEntry.slot, hEntry.on, hEntry.off), next: 0, used: new Set<string>(), logs: [] as MomentLog[], conf: ctx.moments.confidence, recent: ctx.moments.recent, injured: 0,
  } : null;

  const steps: SeqStep[] = [];
  const rps = numberPlayers(allEntries.map(e => ({ id: e.p.id, name: e.p.name, side: (T.h.entries.includes(e) ? 'h' : 'a') as Side, idx: e.idx, pos: e.slot, on: e.on, off: e.off, start: !e.sub, human: e.p.human })));
  const rpById = new Map(rps.map(r => [r.id, r]));
  yield { kind: 'init', players: rps, steps, events };

  // ---- the match itself ----
  const seqs = 104 + rng.int(0, 16);
  const minutes = Array.from({ length: seqs }, () => rng.int(1, 90)).sort((x, y) => x - y);
  const penMinutes = Array.from({ length: poisson(rng, 0.12) }, () => rng.int(2, 90)).sort((x, y) => x - y);
  let hg = 0, ag = 0, poss = 0, done = 0;
  const tstat: Record<Side, TeamStats> = {
    h: { possession: 0, shots: 0, onTarget: 0, xg: 0, fouls: 0, yellow: 0, red: 0 },
    a: { possession: 0, shots: 0, onTarget: 0, xg: 0, fouls: 0, yellow: 0, red: 0 },
  };
  const score = (side: Side) => { if (side === 'h') hg++; else ag++; };
  const humanOut = (e: Entry) => !!mom && e.p.id === hid;

  /** Resolve a shot with the normal engine rules: block, target, keeper. */
  const resolveShot = (m: number, att: Side, A_: Agg, D_: Agg, q: number, how: 'open' | 'header' | 'long', shooter: Entry, creator: Entry | null, err: Entry | null, moment = false): void => {
    const outD = D_.active.filter(e => e.slot !== 'GK');
    const sm = pm[shooter.p.id];
    sm.sh++;
    tstat[att].shots++;
    tstat[att].xg += q;
    sm.xg += q;
    if (err) pm[err.p.id].err++;
    const skill = skillOf(shooter.p.attrs, how) * (A_.fat.get(shooter.p.id) ?? 1);
    const blocker = wpick(rng, outD, e => W_BLOCK[e.slot] * shieldOf(e.p.attrs))!;
    const base: Omit<MatchEvent, 'type'> = { min: m, side: att, p: shooter.p.id, a: creator?.p.id, xg: q, err: err?.p.id, how };
    const stepOf = { min: m, att, shooter: shooter.p.id, creator: creator?.p.id, err: err?.p.id, how, xg: q, moment };
    const pBlock = clamp(0.2 * Math.exp(0.03 * (shieldOf(blocker.p.attrs) - skill)), 0.06, 0.4);
    if (rng.chance(pBlock)) {
      pm[blocker.p.id].bl++;
      if (creator) pm[creator.p.id].kp++;
      events.push({ ...base, type: 'block', d: blocker.p.id });
      steps.push({ ...stepOf, kind: 'block', blocker: blocker.p.id });
      return;
    }
    const pTarget = clamp(0.44 * Math.exp(0.03 * (skill - D_.shield)), 0.25, 0.7);
    if (!rng.chance(pTarget)) {
      if (creator) pm[creator.p.id].kp++;
      events.push({ ...base, type: 'miss' });
      steps.push({ ...stepOf, kind: 'miss' });
      return;
    }
    sm.sot++;
    tstat[att].onTarget++;
    const keeper = D_.active.find(e => e.slot === 'GK');
    const pGoal = clamp(q * 2.8 * Math.exp(0.06 * clamp(skill - D_.gk, -10, 10)), 0.03, 0.85);
    if (creator) pm[creator.p.id].kp++;
    if (rng.chance(pGoal)) {
      score(att);
      sm.g++;
      if (creator) pm[creator.p.id].a++;
      events.push({ ...base, type: 'goal' });
      steps.push({ ...stepOf, kind: 'goal', keeper: keeper?.p.id });
    } else {
      if (keeper) pm[keeper.p.id].sv++;
      events.push({ ...base, type: 'save', d: keeper?.p.id });
      steps.push({ ...stepOf, kind: 'save', keeper: keeper?.p.id });
    }
  };

  const pickShooter = (A_: Agg, outA: Entry[], how: 'open' | 'header' | 'long') => wpick(rng, outA, e => {
    if (humanOut(e)) return 0;
    const f = A_.fat.get(e.p.id) ?? 1;
    const a = e.p.attrs;
    const mult = e.p.id === hid && ins ? (ins.shooting === 'more' ? 1.35 : ins.shooting === 'less' ? 0.7 : 1) * (ins.movement === 'roam' ? 1.12 : 1) : 1;
    const base = how === 'long' ? W_LONG[e.slot] * Math.pow(a.longShots / 10, 1.3) : how === 'header' ? W_SHOOT[e.slot] * Math.pow(a.heading / 10, 1.3) * Math.pow(a.jumping / 10, 0.6) : W_SHOOT[e.slot] * Math.pow(a.finishing / 10, 1.1) * Math.pow(a.offTheBall / 10, 0.7);
    return base * f * mult;
  })!;
  const pickCreator = (A_: Agg, outA: Entry[], how: 'open' | 'header' | 'long', not: Entry) => wpick(rng, outA.filter(e => e !== not), e => {
    if (humanOut(e)) return 0;
    const a = e.p.attrs;
    const skill = how === 'header' ? Math.pow(a.crossing / 10, 1.5) : Math.pow((a.passing + a.vision + a.technique) / 30, 1.4);
    return W_MAKE[e.slot] * skill * (A_.fat.get(e.p.id) ?? 1);
  });

  /** A shot that comes out of a moment: a break, a free kick, or the consequence of losing a duel. */
  const autoShot = (side: Side, m: number, q: number, how: 'open' | 'header' | 'long' = 'open', moment = true) => {
    const A_ = aggregate(T[side], m, hid, ins), D_ = aggregate(T[other(side)], m, hid, ins);
    const outA = A_.active.filter(e => e.slot !== 'GK');
    if (!outA.length || !D_.active.some(e => e.slot !== 'GK')) return;
    const shooter = pickShooter(A_, outA, how);
    const creator = rng.chance(how === 'long' ? 0.25 : 0.6) ? pickCreator(A_, outA, how, shooter) : null;
    resolveShot(m, side, A_, D_, q, how, shooter, creator, null, moment);
  };

  const doPenalty = (m: number, forced?: Side, moment = false) => {
    const att: Side = forced ?? (rng.chance(done ? poss / done : 0.5) ? 'h' : 'a');
    const A_ = aggregate(T[att], m, hid, ins), D_ = aggregate(T[other(att)], m, hid, ins);
    const taker = wpick(rng, A_.active.filter(e => e.slot !== 'GK' && !(att === hSide && humanOut(e))), e => Math.pow(skillOf(e.p.attrs, 'open'), 2.2));
    if (!taker) return;
    pm[taker.p.id].sh++;
    pm[taker.p.id].xg += 0.76;
    tstat[att].shots++; tstat[att].xg += 0.76;
    const goal = rng.chance(clamp(0.76 + 0.012 * clamp(skillOf(taker.p.attrs, 'open') - D_.gk, -8, 8), 0.5, 0.92));
    const keeper = D_.active.find(e => e.slot === 'GK');
    const base: Omit<MatchEvent, 'type'> = { min: m, side: att, p: taker.p.id, xg: 0.76, how: 'penalty' };
    tstat[att].onTarget += goal || keeper ? 1 : 0;
    const pstep = { min: m, att, shooter: taker.p.id, keeper: keeper?.p.id, how: 'penalty' as const, xg: 0.76, moment };
    if (goal) { score(att); pm[taker.p.id].g++; pm[taker.p.id].sot++; events.push({ ...base, type: 'penalty' }); steps.push({ ...pstep, kind: 'pen-goal' }); }
    else if (keeper) { pm[keeper.p.id].sv++; events.push({ ...base, type: 'save', d: keeper.p.id }); steps.push({ ...pstep, kind: 'pen-save' }); }
    else { events.push({ ...base, type: 'miss' }); steps.push({ ...pstep, kind: 'pen-miss' }); }
  };

  // ---- moments: the human's decisions ----
  const sendOff = (e: Entry, m: number) => {
    e.red = true; e.off = m;
    pm[e.p.id].red = 1;
    const rp = rpById.get(e.p.id); if (rp) rp.off = m;
    events.push({ min: m, side: allEntries.indexOf(e) < T.h.entries.length ? 'h' : 'a', type: 'red', p: e.p.id });
  };
  const bookHuman = (e: Entry, m: number, y: number, r: number) => {
    const x = pm[e.p.id];
    if (rng.chance(r)) { sendOff(e, m); return; }
    if (rng.chance(y)) {
      x.yellow++;
      events.push({ min: m, side: hSide!, type: 'yellow', p: e.p.id });
      if (x.yellow >= 2) sendOff(e, m);
    }
  };

  const activeHuman = (m: number) => !!hEntry && hEntry.on < m && m <= hEntry.off && !hEntry.red;

  function* runMoment(tpl: TemplateDef, m: number, stage: 1 | 2): Generator<SessionYield, void, string | undefined> {
    const hs = hSide!, os = other(hs), he = hEntry!;
    const AH = aggregate(T[hs], m, hid, ins), AO = aggregate(T[os], m, hid, ins);
    const outO = AO.active.filter(e => e.slot !== 'GK');
    const keeper = AO.active.find(e => e.slot === 'GK');
    const mates = AH.active.filter(e => e !== he && e.slot !== 'GK');
    const pickBy = (list: Entry[], slots: Pos[]) => { const c = list.filter(e => slots.includes(e.slot)); return c.length ? c[Math.floor(rng.next() * c.length)] : null; };
    let opp: Entry | null = null;
    switch (tpl.opp) {
      case 'gk': opp = keeper ?? null; break;
      case 'FB': opp = pickBy(outO, ['FB']) ?? pickBy(outO, ['CB', 'DM']); break;
      case 'CB': opp = pickBy(outO, ['CB']) ?? pickBy(outO, ['FB', 'DM']); break;
      case 'DM': opp = pickBy(outO, ['DM']) ?? pickBy(outO, ['CM', 'CB']); break;
      case 'MID': opp = pickBy(outO, ['DM', 'CM', 'AM']) ?? pickBy(outO, ['FB', 'W']); break;
      case 'DEF': opp = pickBy(outO, ['CB', 'FB', 'DM']); break;
      case 'ATT': opp = wpick(rng, outO, e => W_SHOOT[e.slot] * Math.pow(e.p.attrs.finishing / 10, 1)); break;
      default: opp = null;
    }
    const mateSlots: Record<string, Pos[]> = { ATT: ['ST', 'W', 'AM'], W: ['W', 'AM', 'ST'], ST: ['ST', 'AM', 'W'], CM: ['CM', 'AM', 'DM'], any: ['ST', 'W', 'AM', 'CM', 'DM', 'FB', 'CB'] };
    const mate = tpl.mate ? (pickBy(mates, mateSlots[tpl.mate]) ?? pickBy(mates, mateSlots.any)) : null;
    const oppAvg: Weights = {};
    for (const k of ATTR_IDS) oppAvg[k] = outO.length ? outO.reduce((a, e) => a + e.p.attrs[k], 0) / outO.length : 8;
    const lead = hs === 'h' ? hg - ag : ag - hg;
    const c: MomentCtx = {
      minute: m, lead, slot: he.slot, me: he.p, fat: AH.fat.get(he.p.id) ?? 1, conf: mom!.conf,
      opp: opp?.p ?? null, oppFat: opp ? AO.fat.get(opp.p.id) ?? 1 : 1, mate: mate?.p ?? null, gk: keeper?.p ?? null,
      teamShield: AO.shield, oppAvg, instr: ins,
    };
    const built = buildRequest(tpl, c, { side: hs, humanId: he.p.id, scoreOwn: hs === 'h' ? hg : ag, scoreOpp: hs === 'h' ? ag : hg, stage, seed: `${he.p.id}:${m}:${stage}` });
    const sent: string | undefined = yield { kind: 'moment', req: built.req };
    const valid = sent ? tpl.options.find(o => o.id === sent && !built.req.options.find(v => v.id === o.id)!.locked) : undefined;
    const auto = !valid;
    const pickedId = valid ? valid.id : autoPick(tpl, built.s, built.req, rng);
    const chosen = tpl.options.find(o => o.id === pickedId) ?? tpl.options.find(o => !built.req.options.find(v => v.id === o.id)!.locked) ?? tpl.options[0];
    const tier = rollTier(built.s[chosen.id], chosen.risk, rng);
    const out: Outcome = chosen.out[TIERS.indexOf(tier)];
    const tok = { opp: c.opp, mate: c.mate, gk: c.gk, minute: m };
    const text = fill(out.text, tok);
    const before = steps.length, hgB = hg, agB = ag;
    applyOutcome(out, tpl, m, he, os, opp, mate, keeper);
    for (let i = before; i < steps.length; i++) steps[i].moment = true;
    // A well-executed decision is worth something on top of what it led to, and a botched one costs.
    const rate = (out.rate ?? DEFAULT_RATE[out.r] ?? 0) + ({ great: 0.08, good: 0.04, poor: -0.04, disaster: -0.12 }[tier] ?? 0);
    const conf = out.conf ?? DEFAULT_CONF[out.r] ?? 0;
    pm[he.p.id].mom += rate;
    mom!.conf = clamp(mom!.conf + conf, 5, 95);
    const ownGoals = hs === 'h' ? hg - hgB : ag - agB, oppGoals = hs === 'h' ? ag - agB : hg - hgB;
    mom!.logs.push({ minute: m, title: tpl.title, option: fill(chosen.label, tok), tier, result: out.r, text, auto });
    const follow = out.r === 'follow' && out.follow ? TEMPLATE_BY_ID[out.follow] : undefined;
    yield { kind: 'outcome', out: { id: tpl.id, title: tpl.title, minute: m, optionId: chosen.id, optionLabel: fill(chosen.label, tok), tier, result: out.r, text, rate, conf, steps: steps.slice(before), follow: !!follow, goal: ownGoals ? 'own' : oppGoals ? 'opp' : null } };
    if (follow) yield* runMoment(follow, m, 2);
  }

  /** Apply what an outcome does to the match: shots, stats, cards. */
  function applyOutcome(out: Outcome, tpl: TemplateDef, m: number, he: Entry, os: Side, opp: Entry | null, mate: Entry | null, keeper: Entry | undefined): void {
    const hs = hSide!;
    const hp = pm[he.p.id];
    const q = out.q ?? 0.35;
    const shot = (kind: 'goal' | 'save' | 'miss' | 'block') => {
      hp.sh++; tstat[hs].shots++; tstat[hs].xg += q; hp.xg += q;
      const base = { min: m, side: hs, p: he.p.id, xg: q, how: out.how ?? 'open' } as const;
      const st = { min: m, att: hs, shooter: he.p.id, how: out.how ?? 'open', xg: q, moment: true } as const;
      if (kind !== 'miss' && kind !== 'block') { hp.sot++; tstat[hs].onTarget++; }
      if (kind === 'goal') { score(hs); hp.g++; events.push({ ...base, type: 'goal' }); steps.push({ ...st, kind: 'goal', keeper: keeper?.p.id }); }
      else if (kind === 'save') { if (keeper) pm[keeper.p.id].sv++; events.push({ ...base, type: 'save', d: keeper?.p.id }); steps.push({ ...st, kind: 'save', keeper: keeper?.p.id }); }
      else if (kind === 'block') { if (opp) pm[opp.p.id].bl++; events.push({ ...base, type: 'block', d: opp?.p.id }); steps.push({ ...st, kind: 'block', blocker: opp?.p.id }); }
      else { events.push({ ...base, type: 'miss' }); steps.push({ ...st, kind: 'miss' }); }
    };
    const mateShot = (kind: 'goal' | 'save' | 'miss' | 'block') => {
      const mp = pm[mate!.p.id];
      mp.sh++; tstat[hs].shots++; tstat[hs].xg += q; mp.xg += q; hp.kp++;
      const base = { min: m, side: hs, p: mate!.p.id, a: he.p.id, xg: q, how: 'open' } as const;
      const st = { min: m, att: hs, shooter: mate!.p.id, creator: he.p.id, how: 'open', xg: q, moment: true } as const;
      if (kind === 'goal' || kind === 'save') { mp.sot++; tstat[hs].onTarget++; }
      if (kind === 'goal') { score(hs); mp.g++; hp.a++; events.push({ ...base, type: 'goal' }); steps.push({ ...st, kind: 'goal', keeper: keeper?.p.id }); }
      else if (kind === 'save') { if (keeper) pm[keeper.p.id].sv++; events.push({ ...base, type: 'save', d: keeper?.p.id }); steps.push({ ...st, kind: 'save', keeper: keeper?.p.id }); }
      else if (kind === 'block') { if (opp) pm[opp.p.id].bl++; events.push({ ...base, type: 'block', d: opp?.p.id }); steps.push({ ...st, kind: 'block', blocker: opp?.p.id }); }
      else { events.push({ ...base, type: 'miss' }); steps.push({ ...st, kind: 'miss' }); }
    };
    switch (out.r) {
      case 'goal': shot('goal'); break;
      case 'saved': shot('save'); break;
      case 'wide': shot('miss'); break;
      case 'blocked': shot('block'); break;
      case 'assist': if (mate) { const f = mate.p.attrs.finishing; const gkq = keeper ? keeper.p.attrs.reflexes : 8; mateShot(rng.chance(clamp(0.62 + 0.03 * (f - gkq), 0.35, 0.85)) ? 'goal' : rng.chance(0.7) ? 'save' : 'miss'); } break;
      case 'keyPass': if (mate) { const r = rng.next(); mateShot(r < 0.55 ? 'save' : r < 0.85 ? 'miss' : 'block'); } else hp.kp++; break;
      case 'tackleWon': hp.tk++; hp.tkWon++; break;
      case 'cleared': if (he.slot === 'GK') hp.sv++; else if (tpl.id === 'lastBlock') hp.bl++; else hp.int++; break;
      case 'oppShot': if ((out.q ?? 0) >= 0.7) doPenalty(m, os, true); else autoShot(os, m, out.q ?? 0.25, out.how ?? 'open'); break;
      case 'counter': autoShot(os, m, out.q ?? 0.2, 'open'); break;
      case 'foulConceded':
        hp.fouls++;
        if (out.card) bookHuman(he, m, out.card.y, out.card.r);
        if ((out.q ?? 0) >= 0.7) doPenalty(m, os, true); else if ((out.q ?? 0) > 0) autoShot(os, m, out.q!, 'long');
        break;
      case 'foulWon': autoShot(hs, m, 0.06, 'long'); break;
      case 'injury': mom!.injured = Math.max(mom!.injured, out.weeks ?? 1); break;
      default: break;
    }
  }

  /** Is a moment due, and does this possession sequence suit one? Runs it if so. Returns true when it replaced the sequence. */
  function* tryMoment(m: number, att: Side, shoot: boolean): Generator<SessionYield, boolean, string | undefined> {
    const slot = mom!.plan.slots[mom!.next];
    if (!slot || slot.min > m || !activeHuman(m)) return false;
    const mine = att === hSide;
    const feasible: Kind[] = [];
    if (mine && shoot) feasible.push('attack');
    if (mine && !shoot) feasible.push('build');
    if (!mine && shoot) feasible.push('defend');
    const waited = m - slot.min;
    let kind: Kind;
    if (slot.want === 'any' || (waited > 10 && !feasible.includes(slot.want) && !feasible.length)) kind = 'any';
    else if (feasible.includes(slot.want)) kind = slot.want;
    else if (waited > 10 && feasible.length) kind = feasible[0];
    else return false;
    const lead = hSide === 'h' ? hg - ag : ag - hg;
    const tpl = pickTemplate(rng, kind, hEntry!.slot, { minute: m, lead, slot: hEntry!.slot }, mom!.used, mom!.recent);
    if (!tpl) { if (waited > 12) mom!.next++; return false; }
    mom!.next++;
    mom!.used.add(tpl.id);
    yield* runMoment(tpl, m, 1);
    return kind !== 'any';
  }

  for (const m of minutes) {
    yield { kind: 'tick', min: m };
    while (penMinutes.length && penMinutes[0] <= m) doPenalty(penMinutes.shift()!);
    done++;
    const ah = aggregate(T.h, m, hid, ins), aa = aggregate(T.a, m, hid, ins);
    const agg: Record<Side, Agg> = { h: ah, a: aa };
    const share = sigmoid(0.07 * ((ah.build - aa.press) - (aa.build - ah.press)) + 0.1 + 0.15 * (mV(T.h.ment) - mV(T.a.ment)));
    const att: Side = rng.chance(share) ? 'h' : 'a';
    if (att === 'h') poss++;
    const def: Side = att === 'h' ? 'a' : 'h';
    const A_ = agg[att], D_ = agg[def];
    const outA = A_.active.filter(e => e.slot !== 'GK');
    const outD = D_.active.filter(e => e.slot !== 'GK');
    if (!outA.length || !outD.length) continue;

    const rel = ((A_.create - D_.shield) - (D_.create - A_.shield)) / 2;
    const ps = clamp(0.2 * Math.exp(0.07 * rel) * (1 + 0.1 * mV(T[att].ment) + 0.06 * mV(T[def].ment)) * (mom && att === hSide && hEntry && ['ST', 'AM', 'W', 'CM'].includes(hEntry.slot) ? MOMENT_PS : 1), 0.05, 0.5);

    let err: Entry | null = null;
    let shoot = false;
    let q = 0.03 + 0.225 * Math.pow(rng.next(), 2);
    if (rng.chance(0.013)) {
      err = wpick(rng, outD, e => W_ERR[e.slot] * (22 - e.p.attrs.concentration - e.p.attrs.composure * 0.5)) ?? null;
      shoot = true;
      q = 0.22 + 0.25 * rng.next();
    } else if (rng.chance(ps)) shoot = true;

    if (mom && (yield* tryMoment(m, att, shoot))) continue;
    if (!shoot) { steps.push({ min: m, att, kind: 'move' }); continue; }

    const r = rng.next();
    const how: 'open' | 'header' | 'long' = r < 0.18 ? 'header' : r < 0.34 ? 'long' : 'open';
    const shooter = pickShooter(A_, outA, how);
    let creator: Entry | null = null;
    if (!err && rng.chance(how === 'long' ? 0.25 : how === 'header' ? 0.92 : 0.82)) creator = pickCreator(A_, outA, how, shooter);
    resolveShot(m, att, A_, D_, q, how, shooter, creator, err);
  }
  while (penMinutes.length) doPenalty(penMinutes.shift()!);

  // ---- derived per-player stats and ratings ----
  const shareOf: Record<Side, number> = { h: poss / Math.max(1, seqs), a: 1 - poss / Math.max(1, seqs) };
  const baseTk: Record<Pos, number> = { GK: 0, CB: 3.2, FB: 2.8, DM: 3.5, CM: 2.3, AM: 1.0, W: 1.2, ST: 0.8 };
  const baseInt: Record<Pos, number> = { GK: 0.2, CB: 2.4, FB: 1.9, DM: 2.4, CM: 1.5, AM: 0.7, W: 0.6, ST: 0.4 };
  const basePass: Record<Pos, number> = { GK: 22, CB: 48, FB: 42, DM: 52, CM: 55, AM: 40, W: 30, ST: 20 };
  const res = hg > ag ? 'h' : hg < ag ? 'a' : 'd';
  for (const t of [T.h, T.a]) {
    const oppShare = 1 - shareOf[t.key];
    const lvl = (k: 'passing' | 'vision' | 'composure') => avgOf(t.entries.filter(e => !e.sub).map(e => e.p.attrs[k]));
    const teamPassRate = clamp(0.56 + 0.02 * lvl('passing') + 0.008 * lvl('vision') + 0.006 * lvl('composure'), 0.5, 0.96);
    const conceded = t.key === 'h' ? ag : hg;
    for (const e of t.entries) {
      const m = pm[e.p.id];
      m.off = e.off; m.on = e.on;
      m.min = Math.max(0, e.off - e.on);
      if (m.min <= 0) continue;
      const frac = m.min / 90;
      const a = e.p.attrs;
      m.tk += poisson(rng, frac * baseTk[e.slot] * Math.pow(a.tackling / 10, 0.8) * oppShare * 2);
      m.tkWon = Math.min(m.tk, m.tkWon + poisson(rng, m.tk * clamp(0.45 + 0.03 * (a.tackling - 10) * 0.5, 0.3, 0.8)));
      m.int += poisson(rng, frac * baseInt[e.slot] * Math.pow(a.anticipation / 10, 0.9) * oppShare * 2);
      m.passes = Math.max(0, Math.round(frac * basePass[e.slot] * shareOf[t.key] * 2 * (0.7 + a.passing / 30) + rng.gauss() * 3));
      m.passOk = Math.round(m.passes * clamp(0.56 + 0.02 * a.passing + 0.008 * a.vision + 0.006 * a.composure + rng.gauss() * 0.02, 0.5, 0.96));
      const pGoals = 0.95 * m.g + 0.5 * m.a, pChances = 0.15 * m.sot + 0.12 * m.kp, pDefending = 0.07 * m.tkWon + 0.05 * m.int + 0.22 * m.sv + 0.1 * m.bl;
      const pPassing = m.passes ? (m.passOk / m.passes - teamPassRate) * 2.2 : 0;
      const pMistakes = -0.65 * m.err - 0.2 * m.yellow - 1.5 * m.red - 0.04 * m.fouls;
      let pTeam = res === t.key ? 0.35 : res === 'd' ? 0 : -0.3;
      if (e.slot === 'GK' || e.slot === 'CB' || e.slot === 'FB' || e.slot === 'DM') pTeam += conceded === 0 ? 0.45 : -0.14 * conceded;
      const pDecisions = clamp(m.mom, -1.5, 2);
      // A short appearance says less about you, so every part counts for less.
      const k = m.min < 15 ? 0.3 : m.min < 30 ? 0.55 : m.min < 45 ? 0.8 : 1;
      const noise = rng.gauss() * 0.22;
      m.rating = clamp(RATING_BASE + k * (pGoals + pChances + pDefending + pPassing + pMistakes + pTeam + pDecisions + noise), 3, 10);
      if (e.p.id === hid) {
        const rows: [string, number][] = [['Goals and assists', pGoals], ['Chances created and shots', pChances], ['Defending', pDefending], ['Passing', pPassing], ['Mistakes and discipline', pMistakes], ['Team result', pTeam], ['Your decisions', pDecisions], ['Form on the day', noise]];
        m.parts = rows.map(([label, v]) => [label, Math.round(v * k * 100) / 100] as [string, number]).filter(x => Math.abs(x[1]) >= 0.04);
      }
    }
    tstat[t.key].fouls = sumOf(t.entries.map(e => pm[e.p.id].fouls));
    tstat[t.key].yellow = sumOf(t.entries.map(e => pm[e.p.id].yellow));
    tstat[t.key].red = sumOf(t.entries.map(e => pm[e.p.id].red));
  }
  tstat.h.possession = Math.round(shareOf.h * 100);
  tstat.a.possession = 100 - tstat.h.possession;

  for (const id of Object.keys(pm)) if (pm[id].min <= 0) delete pm[id];
  events.sort((x, y) => x.min - y.min);
  steps.sort((x, y) => x.min - y.min);
  return {
    hg, ag, events, players: pm, team: tstat, mentality: { h: T.h.ment, a: T.a.ment }, steps,
    moments: mom ? { logs: mom.logs, confidence: mom.conf, used: [...mom.used], injuredWeeks: mom.injured } : undefined,
  };
}

/** Plays a whole match without pausing. Moments, if on, are decided by the engine. */
export function simulateMatch(H: Lineup, A: Lineup, rng: Rng, ctx: SimCtx = {}): MatchResult {
  const session = matchSession(H, A, rng, ctx);
  let r = session.next();
  while (!r.done) r = session.next(undefined);
  return r.value;
}
