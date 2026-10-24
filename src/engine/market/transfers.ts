import { fmtMoney, marketValue, wageBill, weeklyIncome } from '../economy';
import { humanOf, pushMessage, type Game } from '../game';
import { generatePlayer, ovrOf, type Player } from '../player';
import type { Position } from '../positions';
import { clamp, type Rng } from '../rng';
import { wageFor } from '../wages';
import { DIVISIONS, type Club } from '../world';

const DIV_MID: Record<number, number> = Object.fromEntries(DIVISIONS.map(d => [d.id, (d.rating[0] + d.rating[1]) / 2]));
import type { Deal, DealKind } from './types';

export const POSITION_LIST: Position[] = ['GK', 'CB', 'FB', 'DM', 'CM', 'AM', 'W', 'ST'];
/** The least a club will carry in each position. */
export const MIN_POS: Record<Position, number> = { GK: 2, CB: 3, FB: 3, DM: 1, CM: 2, AM: 1, W: 2, ST: 2 };
/** How many of each usually start. */
export const STARTERS: Record<Position, number> = { GK: 1, CB: 2, FB: 2, DM: 1, CM: 2, AM: 1, W: 2, ST: 2 };
export const SQUAD_MIN = 22;
export const SQUAD_MAX = 28;

/** Transfers are only done in two windows: the start of the season and January. */
export function windowOf(week: number): 'summer' | 'winter' | null {
  return week <= 3 ? 'summer' : week >= 19 && week <= 23 ? 'winter' : null;
}
/** The last week of each window, when clubs rush to finish their business. */
export const isDeadline = (week: number) => week === 3 || week === 23;

/** Good players will not drop far below their level, unless they are near the end of their careers. */
const ambitionOk = (p: Player, club: Club) => ovrOf(p) <= DIV_MID[club.division] + 7 || p.age >= 33;

const squadOf = (g: Game, id: string) => g.players.filter(p => p.clubId === id);
const roundWage = (w: number) => Math.max(50, Math.round(w / 50) * 50);

export function logDeal(g: Game, kind: DealKind, p: Player, from: string | null, to: string | null, fee: number): void {
  const d: Deal = { season: g.season, week: g.week, kind, playerId: p.id, name: p.name, ovr: ovrOf(p), from, to, fee };
  g.deals.unshift(d);
  if (g.deals.length > 200) g.deals.length = 200;
}

const clubName = (g: Game, id: string | null) => (id ? g.clubs.find(c => c.id === id)?.name ?? 'Unknown' : 'free agents');

/** News about the human's own club only, so the inbox stays readable. */
function news(g: Game, kind: DealKind, p: Player, from: string | null, to: string | null, fee: number): void {
  const mine = humanOf(g).clubId;
  if (!mine || (from !== mine && to !== mine) || p.human) return;
  const into = to === mine;
  const subject = kind === 'loan' ? `${p.name} ${into ? 'arrives on loan' : 'goes out on loan'}` : into ? `${p.name} signs` : kind === 'release' ? `${p.name} released` : `${p.name} leaves`;
  const body = kind === 'free' ? `${p.name} (${p.position}, rated ${ovrOf(p)}) joins from ${clubName(g, from)} as a free agent.`
    : kind === 'loan' ? `${p.name} (${p.position}, rated ${ovrOf(p)}) ${into ? `joins from ${clubName(g, from)}` : `joins ${clubName(g, to)}`} on loan until the summer.`
      : kind === 'release' ? `${p.name} (${p.position}, rated ${ovrOf(p)}) has been released.`
        : `${p.name} (${p.position}, rated ${ovrOf(p)}) ${into ? `joins from ${clubName(g, from)} for ${fmtMoney(fee)}` : `leaves for ${clubName(g, to)} for ${fmtMoney(fee)}`}.`;
  pushMessage(g, { week: g.week, from: 'Transfers', subject, body });
}

const rankAt = (squad: Player[], p: Player) => squad.filter(q => q.position === p.position && q.id !== p.id && ovrOf(q) > ovrOf(p)).length;

/** Would the seller let this player go? Surplus players go easily, regulars at a price, and clubs short of money sell. */
function willSell(g: Game, seller: Club, p: Player, rng: Rng, buyer?: Club): boolean {
  if (p.human || p.loanFrom) return false;
  const squad = squadOf(g, seller.id);
  const atPos = squad.filter(q => q.position === p.position).length;
  if (atPos - 1 < MIN_POS[p.position]) return false;
  const r = rankAt(squad, p);
  const need = STARTERS[p.position];
  if (seller.funds < -wageBill(g, seller.id) * 2) return r >= need ? rng.chance(0.8) : rng.chance(0.3);
  const up = buyer && buyer.division < seller.division ? 1 : 0;
  if (r > need) return rng.chance(0.85);
  if (r === need) return rng.chance(up ? 0.7 : 0.35);
  return rng.chance(up ? 0.3 : 0.08);
}

/** One club looks for a signing. Holes in the squad come first, then clear upgrades and young talent. */
function tryBuy(g: Game, club: Club, rng: Rng): boolean {
  const squad = squadOf(g, club.id);
  let need: Position | null = null;
  let hole = false;
  for (const pos of [...POSITION_LIST].sort(() => rng.next() - 0.5)) {
    if (squad.filter(p => p.position === pos).length < MIN_POS[pos]) { need = pos; hole = true; break; }
  }
  if (!need) {
    if (!rng.chance(0.5)) return false;
    const weights = POSITION_LIST.map(p => STARTERS[p]);
    let r = rng.next() * weights.reduce((a, b) => a + b, 0);
    need = POSITION_LIST[0];
    for (let i = 0; i < POSITION_LIST.length; i++) { r -= weights[i]; if (r <= 0) { need = POSITION_LIST[i]; break; } }
  }
  const atPos = squad.filter(p => p.position === need).sort((a, b) => ovrOf(b) - ovrOf(a));
  const threshold = hole ? club.rating - 10 : ovrOf(atPos[Math.min(STARTERS[need] - 1, atPos.length - 1)] ?? atPos[0]);
  const room = weeklyIncome(g, club.id) * 1.05 - wageBill(g, club.id);

  const pool = g.players.filter(p => p.position === need && !p.human && p.clubId !== club.id && !p.loanFrom);
  const free = pool.filter(p => p.clubId === null);
  const owned = pool.filter(p => p.clubId !== null);
  const sample = [...free, ...owned.sort(() => rng.next() - 0.5).slice(0, 40)];

  let best: { p: Player; fee: number; wage: number; score: number } | null = null;
  for (const p of sample) {
    if (!ambitionOk(p, club)) continue;
    const ovr = ovrOf(p);
    const promising = p.age <= 21 && p.potential >= threshold + 8 && ovr >= threshold - 4;
    if (!hole && ovr < threshold + 3 && !promising) continue;
    const seller = p.clubId ? g.clubs.find(c => c.id === p.clubId)! : null;
    const regular = seller ? rankAt(squadOf(g, seller.id), p) < STARTERS[p.position] : false;
    const fee = seller ? Math.round(marketValue(p) * (regular ? 1.3 : 1)) : 0;
    if (fee > Math.max(0, club.funds)) continue;
    const wage = roundWage(wageFor(ovr) * (seller ? 1.1 : 0.95));
    if (wage > room) continue;
    if (seller && !willSell(g, seller, p, rng, club)) continue;
    const score = (ovr - threshold) * 10 + (p.age <= 23 ? (p.potential - ovr) * 3 : 0) - (fee / (Math.max(0, club.funds) + 1)) * 12 - (wage / (room + 1)) * 4;
    if (!best || score > best.score) best = { p, fee, wage, score };
  }
  if (!best) return false;

  const { p, fee, wage } = best;
  const from = p.clubId;
  if (from) { g.clubs.find(c => c.id === from)!.funds += fee; }
  club.funds -= fee;
  p.clubId = club.id;
  p.wage = wage;
  p.contractYears = rng.int(2, 4);
  p.form = [];
  p.loanFrom = null;
  const kind: DealKind = from ? 'transfer' : 'free';
  logDeal(g, kind, p, from, club.id, fee);
  news(g, kind, p, from, club.id, fee);
  return true;
}

/** Surplus players leave when a squad is too big; holes are filled from the free agents, then from the club's own youth. */
export function enforceSquads(g: Game, rng: Rng): void {
  for (const club of g.clubs) {
    let squad = squadOf(g, club.id);
    // Too many: release the least useful surplus.
    while (squad.length > SQUAD_MAX) {
      const spare = squad.filter(p => !p.human && !p.loanFrom && squad.filter(q => q.position === p.position).length > MIN_POS[p.position]);
      if (!spare.length) break;
      const out = spare.sort((a, b) => marketValue(a) - marketValue(b))[0];
      release(g, out, club.id, rng);
      squad = squadOf(g, club.id);
    }
    // In trouble: shed a high earner who is not needed.
    if (club.funds < -wageBill(g, club.id) * 6) {
      const spare = squad.filter(p => !p.human && !p.loanFrom && squad.filter(q => q.position === p.position).length > MIN_POS[p.position] && rankAt(squad, p) >= STARTERS[p.position]);
      const out = spare.sort((a, b) => b.wage - a.wage)[0];
      if (out) { release(g, out, club.id, rng); squad = squadOf(g, club.id); }
    }
    // Too few, or a hole in a position.
    const fill = (pos: Position) => {
      const room = weeklyIncome(g, club.id) * 1.1 - wageBill(g, club.id);
      const fa = g.players.filter(p => p.clubId === null && !p.human && p.position === pos && ambitionOk(p, club) && roundWage(wageFor(ovrOf(p)) * 0.95) <= Math.max(room, 0) + 400).sort((a, b) => ovrOf(b) - ovrOf(a))[0];
      if (fa) {
        fa.clubId = club.id; fa.wage = roundWage(wageFor(ovrOf(fa)) * 0.95); fa.contractYears = rng.int(1, 3); fa.form = [];
        logDeal(g, 'free', fa, null, club.id, 0);
        news(g, 'free', fa, null, club.id, 0);
      } else {
        const prospect = generatePlayer(rng, { id: 'p' + g.nextId++, position: pos, age: rng.int(17, 19), targetOvr: clamp(DIV_MID[club.division] - 17 + 0.3 * (club.rating - DIV_MID[club.division]) + rng.gauss() * 3, 30, 90), clubId: club.id });
        prospect.contractYears = 3;
        g.players.push(prospect);
      }
      squad = squadOf(g, club.id);
    };
    for (const pos of POSITION_LIST) {
      while (squad.filter(p => p.position === pos).length < MIN_POS[pos] && squad.length < SQUAD_MAX) fill(pos);
    }
    while (squad.length < SQUAD_MIN) fill(weakestPosition(squad));
  }
}

function weakestPosition(squad: Player[]): Position {
  return POSITION_LIST.map(p => ({ p, n: squad.filter(q => q.position === p).length - MIN_POS[p] })).sort((a, b) => a.n - b.n)[0].p;
}

function release(g: Game, p: Player, from: string, rng: Rng): void {
  p.clubId = null;
  p.loanFrom = null;
  p.wage = roundWage(wageFor(ovrOf(p)) * (0.9 + 0.1 * rng.next()));
  p.contractYears = 0;
  logDeal(g, 'release', p, from, null, 0);
  news(g, 'release', p, from, null, 0);
}
export { release as releasePlayer };

/** Young players who are not playing go out on loan to smaller clubs where they would. */
export function loanPass(g: Game, rng: Rng): void {
  const onLoanOut = (id: string) => g.players.filter(p => p.loanFrom === id).length;
  const onLoanIn = (id: string) => g.players.filter(p => p.loanFrom && p.clubId === id).length;
  for (const parent of [...g.clubs].sort(() => rng.next() - 0.5)) {
    if (onLoanOut(parent.id) >= 2) continue;
    const squad = squadOf(g, parent.id);
    const cands = squad.filter(p => !p.human && !p.loanFrom && p.age <= 21 && rankAt(squad, p) >= STARTERS[p.position] + 1 && squad.filter(q => q.position === p.position).length - 1 >= MIN_POS[p.position]);
    if (!cands.length || !rng.chance(0.4)) continue;
    const p = cands.sort((a, b) => b.potential - a.potential)[0];
    const hosts = g.clubs.filter(c => c.id !== parent.id && c.division >= parent.division && onLoanIn(c.id) < 2 && wageBill(g, c.id) + p.wage < weeklyIncome(g, c.id) * 1.1)
      .filter(c => {
        const at = squadOf(g, c.id).filter(q => q.position === p.position).sort((a, b) => ovrOf(b) - ovrOf(a));
        return (at[Math.min(STARTERS[p.position], at.length) - 1] ? ovrOf(at[Math.min(STARTERS[p.position], at.length) - 1]) : 0) <= ovrOf(p) + 1;
      });
    if (!hosts.length) continue;
    const host = rng.pick(hosts);
    p.clubId = host.id;
    p.loanFrom = parent.id;
    p.form = [];
    logDeal(g, 'loan', p, parent.id, host.id, 0);
    news(g, 'loan', p, parent.id, host.id, 0);
  }
}

/** Everyone brings in and pays out each week. */
export function applyWeeklyFinance(g: Game): void {
  for (const c of g.clubs) {
    const bill = wageBill(g, c.id);
    c.funds += weeklyIncome(g, c.id) - bill;
    // Owners take out anything beyond about three seasons of wages.
    c.funds = Math.min(c.funds, bill * 38 * 3);
  }
}

/** Runs a round or more of business: signings, loans, then squads are tidied. */
export function marketPass(g: Game, rng: Rng, rounds: number): void {
  for (let r = 0; r < rounds; r++) {
    for (const club of [...g.clubs].sort(() => rng.next() - 0.5)) tryBuy(g, club, rng);
    loanPass(g, rng);
  }
  enforceSquads(g, rng);
}
