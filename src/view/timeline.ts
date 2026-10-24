import { hashUnit } from '../engine/rng';
import type { Replay, ReplayPlayer } from '../engine/match/replay';
import { shapeTargets, type Pt, type Side } from './geometry';
import type { MomentOutcome, MomentRequest } from '../engine/moments/types';
import { cardScene, isMajor, sample, shotScene, type Key, type Overlay, type Scene } from './scene';
import { outcomeScenes, setupScene } from './momentScenes';

/** How long one match minute lasts between incidents, in milliseconds at normal speed. */
export const MS_PER_MIN = 300;

export interface Item {
  t0: number;
  t1: number;
  m0: number;
  m1: number;
  kind: 'kickoff' | 'gap' | 'scene' | 'halftime' | 'fulltime';
  scene?: Scene;
  /** Ambient play: the sides in possession over the gap, in order. */
  segments?: Side[];
  ball?: Key[];
  overlay?: Overlay;
}

export interface Timeline {
  items: Item[];
  total: number;
  /** Absolute times at which a goal goes in. */
  goals: { t: number; side: Side }[];
  replay: Replay;
  /** While a decision is pending, the time at which playback must stop. */
  pauseT: number | null;
  /** False while a live match is still being generated. */
  complete: boolean;
}

/** Ambient play: the ball moves between the possessing side's players, switching sides as possession changes. */
function ambient(r: Replay, m0: number, dur: number, segments: Side[]): Key[] {
  const keys: Key[] = [];
  const n = Math.max(1, segments.length);
  const seg = dur / n;
  segments.forEach((side, i) => {
    const seed = `${r.h.clubId}${r.a.clubId}${m0}${i}`;
    const pos = shapeTargets(side, (side === 'h' ? r.h : r.a).formation, { x: side === 'h' ? 0.55 : 0.45, y: 0.5 }, true);
    const pick = (salt: string) => 5 + Math.floor(hashUnit(seed + salt) * 6);
    const a = pos[pick('a')], b = pos[pick('b')], c = pos[pick('c')];
    const t = i * seg;
    keys.push({ t, x: a.x, y: a.y }, { t: t + seg * 0.5, x: b.x, y: b.y }, { t: t + seg * 0.95, x: c.x, y: c.y });
  });
  if (keys.length === 0) keys.push({ t: 0, x: 0.5, y: 0.5 });
  return keys;
}

export interface BuilderOpts {
  /** Milliseconds per match minute between incidents. */
  msPerMin: number;
  /** Include the short scenes for minor chances. */
  minor: boolean;
  /** Skip steps produced by decision moments: they are played from the outcome instead. */
  skipMoments: boolean;
}
export const FULL_OPTS: BuilderOpts = { msPerMin: MS_PER_MIN, minor: true, skipMoments: false };
export const HIGHLIGHT_OPTS: BuilderOpts = { msPerMin: 110, minor: false, skipMoments: false };

/** Builds a timeline from a replay, all at once or in segments as a live match produces it. */
export class TimelineBuilder {
  readonly tl: Timeline;
  private t = 0;
  private prev = 0;
  private htDone = false;
  private scan = 0;
  private cards = new Set<unknown>();

  constructor(private r: Replay, private opts: BuilderOpts) {
    this.tl = { items: [], total: 0, goals: [], replay: r, pauseT: null, complete: false };
    this.push({ kind: 'kickoff', m0: 0, m1: 0, overlay: { t: 0, dur: opts.minor ? 1800 : 1200, text: 'Kick off', sub: `${r.h.name} v ${r.a.name}`, tone: 'info' } }, opts.minor ? 1800 : 1200);
  }

  private push(it: Omit<Item, 't0' | 't1'>, dur: number): Item {
    const item = { ...it, t0: this.t, t1: this.t + dur };
    this.tl.items.push(item);
    this.t += dur;
    this.tl.total = this.t;
    return item;
  }

  private score() {
    return `${this.tl.goals.filter(g => g.side === 'h').length} - ${this.tl.goals.filter(g => g.side === 'a').length}`;
  }

  private gapRaw(a: number, b: number, moves: Side[]) {
    const dur = (b - a) * this.opts.msPerMin;
    if (dur <= 0) return;
    const segs: Side[] = moves.length ? moves : [hashUnit(this.r.h.clubId + a) < 0.5 ? 'h' : 'a'];
    this.push({ kind: 'gap', m0: a, m1: b, segments: segs, ball: ambient(this.r, a, dur, segs) }, dur);
  }

  private gap(to: number, moves: { min: number; att: Side }[]) {
    const sides = (a: number, b: number) => moves.filter(m => m.min > a && m.min <= b).map(m => m.att);
    if (!this.htDone && this.prev <= 45 && to > 45) {
      this.gapRaw(this.prev, 45, sides(this.prev, 45));
      const ht = this.opts.minor ? 2200 : 1400;
      this.push({ kind: 'halftime', m0: 45, m1: 45, overlay: { t: 0, dur: ht, text: 'Half time', sub: this.score(), tone: 'info' } }, ht);
      this.htDone = true;
      this.gapRaw(45, to, sides(45, to));
    } else this.gapRaw(this.prev, to, sides(this.prev, to));
    this.prev = Math.max(this.prev, to);
  }

  private scene(minute: number, scene: Scene, pause = false): Item {
    if (scene.goalAt !== undefined && scene.side) this.tl.goals.push({ t: this.t + scene.goalAt, side: scene.side });
    const m = Math.max(minute, this.prev);
    const item = this.push({ kind: 'scene', m0: m, m1: m, scene }, scene.dur);
    if (pause) this.tl.pauseT = item.t1;
    return item;
  }

  /** Add everything that happens up to a minute. Strict: steps at exactly that minute wait until later unless final. */
  addUpTo(minute: number, final = false): void {
    const steps = this.r.steps, events = this.r.events;
    const inRange = (m: number) => (final ? m <= minute : m < minute);
    type Interrupt = { min: number; scene: Scene };
    const interrupts: Interrupt[] = [];
    const moves: { min: number; att: Side }[] = [];
    // Steps arrive in time order from a live match, so scanning forward is enough.
    while (this.scan < steps.length && inRange(steps[this.scan].min)) {
      const s = steps[this.scan++];
      if (s.kind === 'move') moves.push({ min: s.min, att: s.att });
      else if (this.opts.skipMoments && s.moment) continue;
      else if (!this.opts.minor && !isMajor(this.r, s)) continue;
      else interrupts.push({ min: s.min, scene: shotScene(this.r, s) });
    }
    for (const e of events) {
      if ((e.type !== 'yellow' && e.type !== 'red') || this.cards.has(e) || !inRange(e.min)) continue;
      this.cards.add(e);
      interrupts.push({ min: e.min, scene: cardScene(this.r, e) });
    }
    interrupts.sort((a, b) => a.min - b.min);
    for (const it of interrupts) { this.gap(it.min, moves); this.scene(it.min, it.scene); }
    this.gap(final ? Math.min(90, minute) : minute, moves);
  }

  /** The decision scene. Playback stops at its end until the player chooses. */
  addMoment(req: MomentRequest): void {
    this.scene(req.minute, setupScene(this.r, req), true);
  }

  /** What happened after the choice, plus any card it earned. */
  addOutcome(req: MomentRequest, out: MomentOutcome): void {
    this.tl.pauseT = null;
    for (const sc of outcomeScenes(this.r, req, out)) this.scene(out.minute, sc);
    for (const e of this.r.events) {
      if ((e.type === 'yellow' || e.type === 'red') && !this.cards.has(e) && e.min <= out.minute && e.min >= out.minute) {
        this.cards.add(e);
        this.scene(out.minute, cardScene(this.r, e));
      }
    }
  }

  /** In a live match, moment steps are played from their outcome, so the regular pass skips them. */
  skipMoments(): void { this.opts = { ...this.opts, skipMoments: true }; }

  finish(): Timeline {
    this.addUpTo(90, true);
    const ft = this.opts.minor ? 2400 : 1600;
    this.push({ kind: 'fulltime', m0: 90, m1: 90, overlay: { t: 0, dur: ft, text: 'Full time', sub: `${this.r.hg} - ${this.r.ag}`, tone: 'info' } }, ft);
    this.tl.complete = true;
    return this.tl;
  }
}

export function buildTimeline(r: Replay, opts: BuilderOpts = FULL_OPTS): Timeline {
  const b = new TimelineBuilder(r, opts);
  return b.finish();
}

export interface FramePlayer { id: string; side: Side; num: number; x: number; y: number; cast: boolean; human: boolean; name: string; slot: number }
export interface Frame {
  minute: number;
  score: [number, number];
  ball: Pt;
  poss: Side;
  players: FramePlayer[];
  overlay: (Overlay & { age: number }) | null;
  item: Item;
}

const onField = (r: Replay, side: Side, minute: number): ReplayPlayer[] =>
  r.players.filter(p => p.side === side && p.on <= minute && (minute < p.off || (p.off >= 90 && minute >= 90)));

/** Everything needed to draw the pitch at time t. Non-cast players are positioned by team shape; the view smooths them. */
/** The point on the timeline where a match minute is reached. */
export function timeOfMinute(tl: Timeline, minute: number): number {
  for (const i of tl.items) {
    if (i.m1 >= minute) {
      const span = Math.max(1e-6, i.m1 - i.m0);
      return i.t0 + Math.max(0, Math.min(1, (minute - i.m0) / span)) * (i.t1 - i.t0);
    }
  }
  return Math.max(0, tl.total - 1);
}

export function frameAt(tl: Timeline, tRaw: number): Frame {
  const r = tl.replay;
  const t = Math.max(0, Math.min(tl.total - 1, tRaw));
  const item = tl.items.find(i => t >= i.t0 && t < i.t1) ?? tl.items[tl.items.length - 1];
  const local = t - item.t0;
  let ball: Pt = { x: 0.5, y: 0.5 };
  let poss: Side = 'h';
  let minute = item.m0;
  let cast: Record<string, Key[]> = {};
  let overlay: Frame['overlay'] = null;

  if (item.kind === 'scene' && item.scene) {
    ball = sample(item.scene.ball, local);
    poss = item.scene.poss;
    cast = item.scene.cast;
    const o = item.scene.overlays.find(x => local >= x.t && local < x.t + x.dur);
    if (o) overlay = { ...o, age: local - o.t };
  } else if (item.kind === 'gap' && item.ball && item.segments) {
    ball = sample(item.ball, local);
    poss = item.segments[Math.min(item.segments.length - 1, Math.floor((local / Math.max(1, item.t1 - item.t0)) * item.segments.length))];
    minute = item.m0 + (item.m1 - item.m0) * (local / Math.max(1, item.t1 - item.t0));
  } else if (item.overlay) {
    overlay = { ...item.overlay, age: local };
    ball = { x: 0.5, y: 0.5 };
  }

  const m = Math.min(90, Math.floor(minute));
  const players: FramePlayer[] = [];
  for (const side of ['h', 'a'] as Side[]) {
    const team = side === 'h' ? r.h : r.a;
    const targets = shapeTargets(side, team.formation, ball, poss === side);
    for (const p of onField(r, side, m)) {
      const keys = cast[p.id];
      const base = targets[p.idx] ?? { x: 0.5, y: 0.5 };
      const pos = keys ? sample(keys, local) : base;
      players.push({ id: p.id, side, num: p.num, x: pos.x, y: pos.y, cast: !!keys, human: p.human, name: p.name, slot: p.idx });
    }
  }
  const home = tl.goals.filter(g => g.side === 'h' && g.t <= t).length;
  const away = tl.goals.filter(g => g.side === 'a' && g.t <= t).length;
  return { minute, score: [home, away], ball, poss, players, overlay, item };
}
