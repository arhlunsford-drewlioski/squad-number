import type { Game } from './game';
import { ovrOf } from './player';

export interface TableRow { id: string; p: number; w: number; d: number; l: number; gf: number; ga: number; pts: number }

export function tableFor(g: Game, division: number): TableRow[] {
  const rows: Record<string, TableRow> = {};
  for (const c of g.clubs.filter(x => x.division === division)) rows[c.id] = { id: c.id, p: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, pts: 0 };
  for (const rd of g.fixtures[division]) for (const f of rd) {
    if (f.hg == null || f.ag == null) continue;
    const h = rows[f.h], a = rows[f.a];
    if (!h || !a) continue;
    h.p++; a.p++; h.gf += f.hg; h.ga += f.ag; a.gf += f.ag; a.ga += f.hg;
    if (f.hg > f.ag) { h.w++; a.l++; h.pts += 3; } else if (f.hg < f.ag) { a.w++; h.l++; a.pts += 3; } else { h.d++; a.d++; h.pts++; a.pts++; }
  }
  const strength = (id: string) => g.clubs.find(c => c.id === id)!.rating;
  return Object.values(rows).sort((x, y) => y.pts - x.pts || (y.gf - y.ga) - (x.gf - x.ga) || y.gf - x.gf || strength(y.id) - strength(x.id));
}

/** Average OVR of a club's best eleven. */
export function squadLevel(g: Game, clubId: string): number {
  const top = g.players.filter(p => p.clubId === clubId).map(ovrOf).sort((a, b) => b - a).slice(0, 11);
  return top.reduce((a, b) => a + b, 0) / Math.max(1, top.length);
}
