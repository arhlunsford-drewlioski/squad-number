// A diligent player for simulations: picks the weekly training that closes the most useful gap, and eases off when tired.
import type { AttrId } from '../src/engine/attributes';
import type { Game } from '../src/engine/game';
import { humanOf } from '../src/engine/game';
import { WEIGHTS, keyAttrs } from '../src/engine/positions';
import { PROGRAMMES, type ProgrammeId } from '../src/engine/training';

export function trainSmart(g: Game): void {
  const me = humanOf(g);
  const w = WEIGHTS[me.position];
  const room = (a: AttrId) => Math.max(0, me.ceil[a] - me.attrs[a]);
  const score = (id: ProgrammeId) => PROGRAMMES.find(p => p.id === id)!.trains.reduce((s, t) => s + t.w * w[t.id] * room(t.id), 0);
  const pool = PROGRAMMES.filter(p => p.id !== 'skillWork' && p.id !== 'smallSided' && !(p.id.startsWith('gk') && me.position !== 'GK')).map(p => p.id);
  const best = pool.sort((a, b) => score(b) - score(a)).slice(0, 3);
  const intensity = me.condition >= 78 ? 'hard' : me.condition >= 62 ? 'standard' : 'light';
  g.training.sessions = best.map(programme => ({ programme, intensity })) as typeof g.training.sessions;
  g.training.focus = keyAttrs(me.position, 8).sort((a, b) => room(b) - room(a))[0] ?? null;
}
