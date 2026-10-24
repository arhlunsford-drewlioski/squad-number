import type { Replay, ReplayPlayer } from '../engine/match/replay';
import type { SeqStep } from '../engine/match/types';
import { shapeTargets, toPitch, type Pt, type Side, ease, lerp } from './geometry';

/** A position at a moment in time, in pitch space. */
export interface Key { t: number; x: number; y: number }

export interface Overlay { t: number; dur: number; text: string; sub?: string; tone: 'goal' | 'chance' | 'card' | 'info' }

export interface Scene {
  dur: number;
  poss: Side;
  ball: Key[];
  /** Positions for the few players the scene is about, by player id. Everyone else keeps their shape. */
  cast: Record<string, Key[]>;
  overlays: Overlay[];
  /** Time inside the scene when a goal is scored, if one is. */
  goalAt?: number;
  side?: Side;
}

export function sample(keys: Key[], t: number): Pt {
  if (keys.length === 0) return { x: 0.5, y: 0.5 };
  if (t <= keys[0].t) return { x: keys[0].x, y: keys[0].y };
  for (let i = 1; i < keys.length; i++) {
    if (t <= keys[i].t) {
      const a = keys[i - 1], b = keys[i];
      const k = ease((t - a.t) / Math.max(1, b.t - a.t));
      return { x: lerp(a.x, b.x, k), y: lerp(a.y, b.y, k) };
    }
  }
  const last = keys[keys.length - 1];
  return { x: last.x, y: last.y };
}

const key = (t: number, p: Pt): Key => ({ t, x: p.x, y: p.y });

/** Slot position (pitch space) for a team with the ball around the middle of the attacking third. */
export function slotPos(r: Replay, side: Side, idx: number, attacking: boolean, ball: Pt = { x: side === 'h' ? 0.62 : 0.38, y: 0.5 }): Pt {
  const team = side === 'h' ? r.h : r.a;
  return shapeTargets(side, team.formation, ball, attacking)[idx] ?? { x: 0.5, y: 0.5 };
}

const find = (r: Replay, id: string | undefined): ReplayPlayer | undefined => (id ? r.players.find(p => p.id === id) : undefined);
const other = (s: Side): Side => (s === 'h' ? 'a' : 'h');

/** Is this sequence worth the long version? Goals, penalties, saves, big chances and anything involving the human player. */
export function isMajor(r: Replay, s: SeqStep): boolean {
  if (s.kind === 'goal' || s.kind.startsWith('pen')) return true;
  if (s.kind === 'save' || (s.xg ?? 0) >= 0.15) return true;
  return [s.shooter, s.creator, s.blocker, s.keeper, s.err].some(id => find(r, id)?.human);
}

const FULL = 4400;
const SHORT = 2300;

/** Choreography for one chance. Written in the attacker's frame, mapped to pitch space with toPitch. */
export function shotScene(r: Replay, s: SeqStep): Scene {
  const att = s.att;
  const def = other(att);
  const major = isMajor(r, s);
  const k = major ? 1 : SHORT / FULL;
  const P = (u: number, v: number) => toPitch(att, u, v);
  const shooter = find(r, s.shooter);
  const creator = find(r, s.creator);
  const blocker = find(r, s.blocker);
  const errP = find(r, s.err);
  const keeperIdx = 0;
  const gkP = r.players.filter(p => p.side === def && p.idx === keeperIdx).find(p => p.on <= s.min && s.min < p.off) ?? r.players.find(p => p.side === def && p.idx === keeperIdx);
  const sp = shooter ? slotPos(r, att, shooter.idx, true) : P(0.7, 0.5);
  const sv = shooter ? Math.min(0.8, Math.max(0.2, 0.5 + (sp.y - 0.5) * (att === 'h' ? 1 : -1) * 0.5)) : 0.5;
  const cast: Record<string, Key[]> = {};
  const ball: Key[] = [];
  const overlays: Overlay[] = [];
  const T = (ms: number) => Math.round(ms * k);

  // Who starts with the ball: the creator, a midfielder, or the defender who made the mistake.
  const mid = r.players.find(p => p.side === att && p.idx !== shooter?.idx && p.idx !== creator?.idx && [5, 6, 7].includes(p.idx) && p.on <= s.min && s.min < p.off);
  const origin = errP ? P(0.7, 0.42) : mid ? slotPos(r, att, mid.idx, true) : P(0.45, 0.5);

  const longShot = s.how === 'long';
  const header = s.how === 'header';
  const pen = s.kind.startsWith('pen');
  let shotAt: number;
  let endAt: number;

  if (pen) {
    shotAt = T(1800);
    endAt = T(2600);
    if (shooter) cast[shooter.id] = [key(0, P(0.78, 0.55)), key(shotAt - 400, P(0.84, 0.5)), key(shotAt, P(0.87, 0.5))];
    ball.push(key(0, P(0.89, 0.5)), key(shotAt, P(0.89, 0.5)));
  } else if (errP) {
    shotAt = T(2500);
    endAt = T(3100);
    cast[errP.id] = [key(0, P(0.7, 0.42)), key(T(800), P(0.66, 0.42))];
    if (shooter) cast[shooter.id] = [key(0, sp), key(T(800), P(0.74, 0.5)), key(T(1900), P(0.86, sv)), key(shotAt, P(0.86, sv))];
    ball.push(key(0, origin), key(T(800), P(0.74, 0.5)), key(T(1900), P(0.86, sv)), key(shotAt, P(0.86, sv)));
  } else if (header) {
    const wide = (creator ? slotPos(r, att, creator.idx, true).y : 0.2) < 0.5 ? 0.08 : 0.92;
    const wideV = att === 'h' ? wide : 1 - wide;
    shotAt = T(2600);
    endAt = T(3200);
    if (creator) cast[creator.id] = [key(0, slotPos(r, att, creator.idx, true)), key(T(1100), P(0.78, wideV)), key(T(1700), P(0.8, wideV))];
    if (shooter) cast[shooter.id] = [key(0, sp), key(T(1600), P(0.88, 0.5)), key(shotAt, P(0.91, 0.5))];
    ball.push(key(0, origin), key(T(1100), P(0.78, wideV)), key(T(1700), P(0.8, wideV)), key(shotAt, P(0.91, 0.5)));
  } else if (longShot) {
    shotAt = T(2000);
    endAt = T(2700);
    if (shooter) cast[shooter.id] = [key(0, sp), key(T(900), P(0.72, 0.5)), key(shotAt, P(0.74, 0.5))];
    ball.push(key(0, origin), key(T(1000), P(0.72, 0.5)), key(shotAt, P(0.74, 0.5)));
  } else {
    shotAt = T(2900);
    endAt = T(3500);
    const cp = creator ? slotPos(r, att, creator.idx, true) : origin;
    if (creator) cast[creator.id] = [key(0, cp), key(T(1100), P(0.66, 0.5 + (cp.y - 0.5) * (att === 'h' ? 1 : -1))), key(T(2200), P(0.74, 0.5 + (cp.y - 0.5) * (att === 'h' ? 1 : -1) * 0.7))];
    if (shooter) cast[shooter.id] = [key(0, sp), key(T(1500), P(0.8, sv)), key(T(2200), P(0.84, sv)), key(shotAt, P(0.85, sv))];
    ball.push(key(0, origin), key(T(1100), creator ? P(0.66, 0.5 + (cp.y - 0.5) * (att === 'h' ? 1 : -1)) : P(0.6, sv)), key(T(2200), P(0.84, sv)), key(shotAt, P(0.85, sv)));
  }

  // Keeper and covering defenders.
  const shotFrom = ball[ball.length - 1];
  const dir = s.kind === 'goal' || s.kind === 'pen-goal' ? (s.min % 2 ? 0.42 : 0.58) : s.kind === 'miss' || s.kind === 'pen-miss' ? (s.min % 2 ? 0.27 : 0.73) : 0.5 + (s.min % 2 ? 0.07 : -0.07);
  let goalAt: number | undefined;
  let text = '';
  let tone: Overlay['tone'] = 'chance';
  const label = shooter ? shooter.name : '';
  if (s.kind === 'goal' || s.kind === 'pen-goal') {
    ball.push(key(endAt, P(1.03, dir)));
    goalAt = endAt;
    text = 'GOAL!'; tone = 'goal';
    if (gkP) cast[gkP.id] = [key(0, P(0.985, 0.5)), key(shotAt, P(0.985, 0.5)), key(endAt, P(0.985, dir < 0.5 ? 0.6 : 0.4))];
  } else if (s.kind === 'save' || s.kind === 'pen-save') {
    const gy = dir;
    ball.push(key(endAt, P(0.985, gy)), key(endAt + T(500), P(0.93, gy < 0.5 ? 0.38 : 0.62)));
    text = 'Save'; tone = 'chance';
    if (gkP) cast[gkP.id] = [key(0, P(0.985, 0.5)), key(shotAt, P(0.985, 0.5)), key(endAt, P(0.985, gy))];
  } else if (s.kind === 'block') {
    const bp = blocker ? slotPos(r, def, blocker.idx, false, P(0.85, 0.5)) : P(0.9, 0.47);
    ball.push(key(endAt, P(0.91, 0.47)), key(endAt + T(500), P(0.86, 0.27)));
    if (blocker) cast[blocker.id] = [key(0, bp), key(shotAt, P(0.92, 0.48)), key(endAt, P(0.91, 0.47))];
    text = 'Blocked'; tone = 'chance';
  } else {
    ball.push(key(endAt, P(1.04, dir)));
    text = s.kind === 'pen-miss' ? 'Penalty missed' : 'Off target'; tone = 'chance';
  }
  void shotFrom;
  const dur = endAt + T(900);
  if (errP) overlays.push({ t: T(300), dur: T(1100), text: 'Mistake', sub: errP.name, tone: 'info' });
  overlays.push({ t: endAt, dur: Math.max(900, T(1500)), text, sub: label, tone });
  return { dur, poss: att, ball, cast, overlays, goalAt, side: att };
}

/** A card shown for a moment: play stops and the offender is picked out. */
export function cardScene(r: Replay, ev: { side: Side; type: string; p: string }): Scene {
  const pl = find(r, ev.p);
  const red = ev.type === 'red';
  const at = pl ? slotPos(r, ev.side, pl.idx, false, { x: 0.5, y: 0.5 }) : { x: 0.5, y: 0.5 };
  return {
    dur: 1700, poss: ev.side, ball: [key(0, at)], cast: pl ? { [pl.id]: [key(0, at)] } : {},
    overlays: [{ t: 150, dur: 1400, text: red ? 'Red card' : 'Yellow card', sub: pl?.name, tone: 'card' }],
  };
}
