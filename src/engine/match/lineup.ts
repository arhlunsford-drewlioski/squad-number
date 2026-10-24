import { avgOf } from '../util';
import type { Player } from '../player';
import type { Position } from '../positions';
import { ovrAt } from '../rating';
import { hashUnit } from '../rng';
import { FORMATIONS, FORMATION_IDS } from './formations';
import type { Manager } from '../world';
import type { FormationId, Lineup, Slot } from './types';

export const AVG_FORM = 6.4;
export const condFactor = (p: Player) => 0.85 + (0.15 * p.condition) / 100;
export const formOf = (p: Player) => (p.form.length ? avgOf(p.form) : AVG_FORM);

export interface LineupCtx { week: number; trust: number; /** The manager has promised you a start. */ promise?: boolean; /** You are resting. */ sitOut?: boolean; /** The club's manager: his shape, and how readily he plays youngsters. */ mgr?: Manager }
type Ctx = LineupCtx;

/** The manager's view of a player for a slot: ability for that role, condition, recent form and a small hunch. */
export function selScore(p: Player, slot: Position, ctx: Ctx): number {
  return ovrAt(p.attrs, slot) * condFactor(p) + (formOf(p) - AVG_FORM) * 1.2 + hashUnit(p.id + ':' + ctx.week) * 0.8 + (p.human ? ctx.trust * 0.5 + (ctx.promise ? 50 : 0) : 0) + (ctx.mgr && p.age <= 21 ? (ctx.mgr.youth - 0.5) * 3 : 0);
}

function assign(avail: Player[], formation: FormationId, ctx: Ctx): { xi: Slot[]; total: number } {
  const used = new Set<string>();
  const xi: Slot[] = [];
  let total = 0;
  for (const slot of FORMATIONS[formation]) {
    let best: Player | null = null;
    let bestScore = -Infinity;
    for (const p of avail) {
      if (used.has(p.id)) continue;
      // Keepers only play in goal while any keeper is available; outfielders never fill in there if a keeper exists.
      if ((slot === 'GK') !== (p.position === 'GK') && avail.some(q => !used.has(q.id) && ((slot === 'GK') === (q.position === 'GK')))) continue;
      const s = selScore(p, slot, ctx);
      if (s > bestScore) { bestScore = s; best = p; }
    }
    if (!best) break;
    used.add(best.id);
    xi.push({ player: best, slot });
    total += bestScore;
  }
  return { xi, total };
}

/** Pick the formation and eleven that suit the squad best, plus a bench of seven. */
export function bestLineup(players: Player[], clubId: string, ctx: Ctx): Lineup {
  const avail = players.filter(p => p.clubId === clubId && p.injuredWeeks === 0 && p.suspended === 0 && !(p.human && ctx.sitOut));
  let pick: { id: FormationId; xi: Slot[]; total: number } | null = null;
  for (const id of FORMATION_IDS) {
    const r = assign(avail, id, ctx);
    const total = r.total + (ctx.mgr?.formation === id ? 8 : 0);
    if (r.xi.length === 11 && (!pick || total > pick.total)) pick = { id, ...r, total };
  }
  if (!pick) {
    // Not enough fit players for any shape: fall back to the first formation with whoever is left.
    const r = assign(avail, '4-4-2', ctx);
    pick = { id: '4-4-2', ...r };
  }
  const inXI = new Set(pick.xi.map(s => s.player.id));
  const scores: Record<string, number> = {};
  for (const p of avail) scores[p.id] = selScore(p, p.position, ctx);
  const pool = avail.filter(p => !inXI.has(p.id)).sort((a, b) => scores[b.id] - scores[a.id]);
  const bench: Player[] = [];
  const gk = pool.find(p => p.position === 'GK');
  if (gk) bench.push(gk);
  for (const p of pool) { if (bench.length >= 7) break; if (!bench.includes(p)) bench.push(p); }
  return { clubId, formation: pick.id, xi: pick.xi, bench, scores, mentBias: ctx.mgr ? (ctx.mgr.style === 'attacking' ? 3 : ctx.mgr.style === 'defensive' ? -3 : 0) : 0 };
}

export type Status = 'start' | 'bench' | 'out' | 'injured' | 'suspended' | 'rested';

export function statusIn(L: Lineup, p: Player, ctx?: LineupCtx): Status {
  if (p.suspended > 0) return 'suspended';
  if (p.injuredWeeks > 0) return 'injured';
  if (p.human && ctx?.sitOut) return 'rested';
  if (L.xi.some(s => s.player.id === p.id)) return 'start';
  if (L.bench.some(b => b.id === p.id)) return 'bench';
  return 'out';
}

/** Plain-language reason for the manager's selection, in the voice of the match report. */
export function explainSelection(L: Lineup, p: Player, all: Player[], mgr: string, ctx?: LineupCtx): string {
  const st = statusIn(L, p, ctx);
  if (st === 'injured') return `You are injured and expected back in ${p.injuredWeeks} week${p.injuredWeeks === 1 ? '' : 's'}.`;
  if (st === 'suspended') return `You are suspended for ${p.suspended} more match${p.suspended === 1 ? '' : 'es'}.`;
  if (st === 'rested') return 'You are resting this week, as you agreed.';
  const slotOf = L.xi.find(s => s.player.id === p.id)?.slot ?? p.position;
  const rivals = all.filter(q => q.clubId === p.clubId && q.id !== p.id && q.position === p.position && q.injuredWeeks === 0);
  const starters = L.xi.filter(s => s.slot === slotOf && s.player.id !== p.id).map(s => s.player);
  if (st === 'start') {
    const rival = rivals.filter(q => !L.xi.some(s => s.player.id === q.id)).sort((a, b) => (L.scores[b.id] ?? 0) - (L.scores[a.id] ?? 0))[0];
    if (!rival) return `${mgr} had nobody else fit for your position, so you started.`;
    const better = ovrAt(p.attrs, slotOf) >= ovrAt(rival.attrs, slotOf);
    return better
      ? `${mgr} picked you over ${rival.name}: you are rated higher for the role (${Math.round(ovrAt(p.attrs, slotOf))} against ${Math.round(ovrAt(rival.attrs, slotOf))}).`
      : `${mgr} picked you over ${rival.name} on recent form and condition, although ${rival.name} is rated higher for the role.`;
  }
  const rival = [...starters, ...rivals.filter(q => L.xi.some(s => s.player.id === q.id))].sort((a, b) => (L.scores[b.id] ?? 0) - (L.scores[a.id] ?? 0))[0];
  if (!rival) return `${mgr} did not select you this week.`;
  const gap = ovrAt(rival.attrs, slotOf) - ovrAt(p.attrs, slotOf);
  if (gap > 3) return `${rival.name} is clearly ahead of you for the position (${Math.round(ovrAt(rival.attrs, slotOf))} against ${Math.round(ovrAt(p.attrs, slotOf))}).`;
  if (p.condition < 75) return `You are not fully fit (condition ${Math.round(p.condition)}%), and ${rival.name} was picked ahead of you.`;
  return `${rival.name} was picked ahead of you. It was close, and form and condition decided it.`;
}
