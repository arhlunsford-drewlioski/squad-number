import type { Game } from './game';
import { ovrOf, type Player } from './player';
import { hashUnit, makeRng } from './rng';
import { wageFor } from './wages';
import { DIVISIONS, makeManager } from './world';

export { wageFor };

/** What a club would pay for a player: ability, age, promise and how long his contract has to run. */
export function marketValue(p: Pick<Player, 'age' | 'potential' | 'contractYears'> & { attrs: Player['attrs']; position: Player['position'] }): number {
  const ovr = ovrOf(p as Player);
  const base = wageFor(ovr) * 52 * 2.5;
  const promise = p.age <= 23 ? 1 + Math.max(0, p.potential - ovr) * 0.04 : 1;
  const ageMult = p.age <= 24 ? 1.1 : p.age <= 28 ? 1 : p.age <= 31 ? 0.7 : p.age <= 33 ? 0.4 : 0.2;
  const contract = p.contractYears <= 1 ? 0.7 : 1;
  return Math.max(500, Math.round((base * promise * ageMult * contract) / 500) * 500);
}

export const fmtMoney = (v: number) => (Math.abs(v) >= 1e6 ? `£${(v / 1e6).toFixed(v >= 1e7 ? 0 : 1)}m` : Math.abs(v) >= 1e3 ? `£${Math.round(v / 1e3)}k` : `£${Math.round(v)}`);

export const wageBill = (g: Game, clubId: string) => g.players.reduce((a, p) => (p.clubId === clubId ? a + p.wage : a), 0);

/** Each division's income per week for an average club, set from what its clubs actually pay. */
export function computeLeagueMoney(g: Game): Record<number, number> {
  const out: Record<number, number> = {};
  for (const d of DIVISIONS) {
    const clubs = g.clubs.filter(c => c.division === d.id);
    const bills = clubs.map(c => wageBill(g, c.id));
    out[d.id] = (bills.reduce((a, b) => a + b, 0) / Math.max(1, bills.length)) * 1.3;
  }
  return out;
}

/** What a club takes in each week: league money, scaled by how big the club is and how well it is run. */
export function weeklyIncome(g: Game, clubId: string): number {
  const c = g.clubs.find(x => x.id === clubId)!;
  const d = DIVISIONS[c.division - 1];
  const strength = Math.min(1, Math.max(0, (c.rating - d.rating[0]) / (d.rating[1] - d.rating[0])));
  return g.leagueMoney[c.division] * c.wealth * (0.8 + 0.4 * strength);
}

/** Fills in anything a game is missing: wages and contracts, club money, managers. Safe to call on old saves. */
export function ensureMarket(g: Game): void {
  for (const p of g.players) {
    if (p.wage === undefined) {
      p.wage = Math.round((wageFor(ovrOf(p)) * (0.9 + 0.2 * hashUnit(p.id + 'w'))) / 50) * 50;
      p.contractYears = 1 + Math.floor(hashUnit(p.id + 'c') * 4);
    }
    p.loanFrom ??= null;
  }
  const me = g.players.find(p => p.id === g.humanId);
  if (me && g.contract) { me.wage = g.contract.wage; me.contractYears = g.contract.years; }
  g.deals ??= [];
  g.leagueMoney ??= computeLeagueMoney(g);
  for (const c of g.clubs) {
    c.wealth ??= 0.85 + 0.45 * hashUnit(c.id + 'wealth');
    c.mgr ??= makeManager(makeRng(Math.floor(hashUnit(c.id + 'mgr') * 2147483647)), g.season);
    c.funds ??= Math.round(wageBill(g, c.id) * 38 * 0.4 * c.wealth);
  }
}

/** Opening money for a new world: a quarter of a season's wages, scaled by how rich the club is. */
export function initClubMoney(g: Game): void {
  g.leagueMoney = computeLeagueMoney(g);
  for (const c of g.clubs) c.funds = Math.round(wageBill(g, c.id) * 38 * 0.4 * c.wealth);
}

/** The human's wage and contract live on the game; mirror them onto the player so club wage bills include them. */
export function syncHuman(g: Game): void {
  const me = g.players.find(p => p.id === g.humanId);
  if (me && g.contract) { me.wage = g.contract.wage; me.contractYears = g.contract.years; }
}
