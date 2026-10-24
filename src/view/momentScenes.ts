import type { Replay } from '../engine/match/replay';
import type { MomentOutcome, MomentRequest, ResultKind } from '../engine/moments/types';
import { toPitch, type Pt, type Side } from './geometry';
import { shotScene, slotPos, type Key, type Overlay, type Scene } from './scene';

const key = (t: number, p: Pt): Key => ({ t, x: p.x, y: p.y });
const other = (s: Side): Side => (s === 'h' ? 'a' : 'h');

interface Layout {
  /** Positions in the human team's frame (own goal at u = 0). */
  me: [number, number];
  opp?: [number, number];
  mate?: [number, number];
  gk?: [number, number];
  ball: [number, number];
  /** Where the ball is moving to as the scene ends, if it travels. */
  ballTo?: [number, number];
}

/** Where everyone stands for each kind of moment. The attacking set is the human's team in possession; the defending set is staged in their own half. */
function layoutFor(req: MomentRequest, wide: number): Layout {
  const w = wide; // 0.1 or 0.9: the side the player's slot works on
  if (req.defending) {
    switch (req.script) {
      case 'defendRun': return { me: [0.22, 0.5], opp: [0.34, 0.5], ball: [0.34, 0.5], ballTo: [0.28, 0.5] };
      case 'defendCross': return { me: [0.1, 0.5], opp: [0.1, 0.57], ball: [0.16, 0.08], ballTo: [0.1, 0.52], gk: [0.03, 0.5] };
      case 'block': return { me: [0.12, 0.5], opp: [0.17, 0.5], ball: [0.17, 0.5], gk: [0.03, 0.5] };
      case 'corner': return { me: [0.06, 0.5], opp: [0.06, 0.57], ball: [0.01, 0.03], ballTo: [0.08, 0.5], gk: [0.03, 0.5] };
      case 'freeKick': return { me: [0.17, 0.46], opp: [0.23, 0.5], ball: [0.23, 0.5], gk: [0.03, 0.5] };
      case 'loose': return { me: [0.1, 0.45], opp: [0.07, 0.56], ball: [0.07, 0.5], gk: [0.03, 0.5] };
      case 'gkThrough': return { me: [0.04, 0.5], opp: [0.24, 0.5], ball: [0.24, 0.5], ballTo: [0.16, 0.5] };
      case 'gk1v1': return { me: [0.04, 0.5], opp: [0.14, 0.5], ball: [0.14, 0.5] };
      default: return { me: [0.2, 0.5], opp: [0.3, 0.5], ball: [0.3, 0.5] };
    }
  }
  switch (req.script) {
    case 'oneOnOne': return { me: [0.8, 0.5], opp: [0.95, 0.5], gk: [0.95, 0.5], mate: [0.8, 0.28], ball: [0.8, 0.5] };
    case 'wide': return { me: [0.7, w], opp: [0.77, w], mate: [0.88, 0.5], ball: [0.7, w] };
    case 'crossIn': return { me: [0.88, 0.5], opp: [0.9, 0.57], mate: [0.8, 0.08], ball: [0.8, 0.08], ballTo: [0.9, 0.5], gk: [0.985, 0.5] };
    case 'loose': return { me: [0.85, 0.44], opp: [0.9, 0.55], mate: [0.82, 0.62], ball: [0.9, 0.48], gk: [0.985, 0.5] };
    case 'longRange': return { me: [0.7, 0.5], opp: [0.66, 0.5], mate: [0.78, 0.3], ball: [0.7, 0.5], gk: [0.985, 0.5] };
    case 'freeKick': return { me: [0.77, 0.52], opp: [0.86, 0.5], mate: [0.88, 0.4], ball: [0.8, 0.5], gk: [0.985, 0.5] };
    case 'counter': return { me: [0.56, 0.5], opp: [0.68, 0.5], mate: [0.62, 0.3], ball: [0.56, 0.5], ballTo: [0.62, 0.5] };
    case 'holdUp': return { me: [0.66, 0.5], opp: [0.62, 0.5], mate: [0.74, 0.3], ball: [0.5, 0.5], ballTo: [0.66, 0.5] };
    case 'buildUp': return { me: [0.5, 0.5], opp: [0.57, 0.5], mate: [0.66, 0.3], ball: [0.5, 0.5] };
    case 'secondBall': return { me: [0.47, 0.44], opp: [0.53, 0.56], ball: [0.5, 0.5] };
    case 'protect': return { me: [0.9, 0.1], opp: [0.86, 0.15], mate: [0.8, 0.5], ball: [0.9, 0.1] };
    case 'inBox': return { me: [0.86, 0.5], gk: [0.985, 0.5], opp: [0.985, 0.5], mate: [0.86, 0.32], ball: [0.86, 0.5] };
    case 'corner': return { me: [0.9, 0.5], opp: [0.92, 0.57], mate: [0.99, 0.03], ball: [0.99, 0.03], ballTo: [0.9, 0.5], gk: [0.985, 0.5] };
    case 'gkBall': return { me: [0.04, 0.5], opp: [0.12, 0.5], ball: [0.04, 0.5] };
    default: return { me: [0.5, 0.5], ball: [0.5, 0.5] };
  }
}

/** The scene shown while the player decides: everyone moves to their places and the clock stops. */
export function setupScene(r: Replay, req: MomentRequest): Scene {
  const side = req.side;
  const me = r.players.find(p => p.id === req.humanId);
  const mySlot = me ? slotPos(r, side, me.idx, true) : { x: 0.5, y: 0.5 };
  // Which flank the player's own slot works on, in the team's frame.
  const f = side === 'h' ? mySlot.y : 1 - mySlot.y;
  const lay = layoutFor(req, f < 0.5 ? 0.1 : 0.9);
  const P = (a: [number, number]) => toPitch(side, a[0], a[1]);
  const defending = req.defending;
  const oSide = other(side);
  const dur = 2600;
  const cast: Scene['cast'] = {};
  const move = (id: string | undefined, from: Pt, to: [number, number], t0 = 0) => { if (id) cast[id] = [key(0, from), key(dur - 300, P(to))]; void t0; };
  if (me) move(req.humanId, mySlot, lay.me);
  if (req.opp) {
    const op = r.players.find(p => p.id === req.opp!.id);
    if (op && lay.opp) move(op.id, slotPos(r, op.side, op.idx, defending ? true : false), lay.opp);
  }
  if (req.mate && lay.mate) {
    const mp = r.players.find(p => p.id === req.mate!.id);
    if (mp) move(mp.id, slotPos(r, mp.side, mp.idx, true), lay.mate);
  }
  if (req.gk && lay.gk) {
    const gk = r.players.find(p => p.id === req.gk!.id);
    if (gk) move(gk.id, slotPos(r, gk.side, gk.idx, false), lay.gk);
  }
  const ball: Key[] = [key(0, P(lay.ball)), key(dur - 400, P(lay.ball))];
  if (lay.ballTo) ball.push(key(dur, P(lay.ballTo)));
  const overlays: Overlay[] = [{ t: 250, dur: dur - 250, text: req.title, sub: `${req.minute}'  ·  ${req.scoreOwn}-${req.scoreOpp}`, tone: 'info' }];
  return { dur, poss: defending ? oSide : side, ball, cast, overlays, side };
}

const LABEL: Record<ResultKind, string> = {
  goal: 'GOAL!', saved: 'Saved', wide: 'Off target', blocked: 'Blocked', assist: 'Assist', keyPass: 'Key pass', retain: 'Keeps it', turnover: 'Lost it', counter: 'Lost it',
  tackleWon: 'Tackle won', cleared: 'Cleared', oppShot: 'They shoot', foulConceded: 'Foul', foulWon: 'Free kick', injury: 'Knock', nothing: 'Moving on', follow: 'Through',
};
const TIER_LABEL = { great: 'Great', good: 'Good', poor: 'Poor', disaster: 'Costly' } as const;

/** What happens after the choice. Shots reuse the normal shot scene; everything else is a short beat. */
export function outcomeScenes(r: Replay, req: MomentRequest, out: MomentOutcome): Scene[] {
  const scenes: Scene[] = [];
  const stepScenes = out.steps.map(s => shotScene(r, s));
  const side = req.side;
  const me = r.players.find(p => p.id === req.humanId);
  const lay = layoutFor(req, 0.5);
  const P = (a: [number, number]) => toPitch(side, a[0], a[1]);
  const tone: Overlay['tone'] = out.result === 'goal' || out.result === 'assist' ? 'goal' : 'chance';
  if (stepScenes.length) {
    // Label the main shot scene with the tier so the player sees how the decision went.
    const first = stepScenes[0];
    first.overlays.push({ t: 150, dur: 1100, text: TIER_LABEL[out.tier], sub: out.title, tone: 'info' });
    scenes.push(...stepScenes);
    return scenes;
  }
  const dur = 1900;
  const meP = me ? slotPos(r, side, me.idx, true) : P(lay.me);
  const ball: Key[] = [key(0, P(lay.ball))];
  let poss: Side = side;
  switch (out.result) {
    case 'retain': case 'foulWon': case 'follow': ball.push(key(900, P(lay.mate ?? lay.me)), key(dur - 300, P([Math.min(0.9, lay.me[0] + 0.1), lay.me[1]]))); break;
    case 'turnover': case 'counter': ball.push(key(700, P(lay.opp ?? lay.me)), key(dur - 300, P([Math.max(0.1, (lay.opp ?? lay.me)[0] - 0.12), 0.5]))); poss = other(side); break;
    case 'tackleWon': case 'cleared': ball.push(key(700, P(lay.me)), key(dur - 300, P([Math.min(0.5, lay.me[0] + 0.3), 0.4]))); break;
    case 'foulConceded': ball.push(key(500, P(lay.opp ?? lay.me))); poss = other(side); break;
    default: ball.push(key(dur - 300, P(lay.ball)));
  }
  const cast: Scene['cast'] = me ? { [me.id]: [key(0, meP), key(dur - 300, P(lay.me))] } : {};
  const overlays: Overlay[] = [{ t: 150, dur: dur - 300, text: LABEL[out.result], sub: TIER_LABEL[out.tier], tone }];
  scenes.push({ dur, poss, ball, cast, overlays, side });
  return scenes;
}
