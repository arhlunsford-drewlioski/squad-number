import { clamp, type Rng } from './rng';
import { generatePlayer, type Player } from './player';
import type { Position } from './positions';
import { FIRST, LAST } from './names';
import { FORMATION_IDS } from './match/formations';
import type { FormationId } from './match/types';

export interface Division {
  id: number;
  name: string;
  /** Range of average starter OVR across the clubs in the division. */
  rating: [number, number];
}

export const DIVISIONS: Division[] = [
  { id: 1, name: 'Crown League', rating: [71, 83] },
  { id: 2, name: 'Crown Division One', rating: [62, 71] },
  { id: 3, name: 'Crown Division Two', rating: [54, 62] },
  { id: 4, name: 'Crown Division Three', rating: [46, 54] },
];

export type ManagerStyle = 'attacking' | 'balanced' | 'defensive';

export interface Manager {
  name: string;
  style: ManagerStyle;
  /** The shape he prefers. The team leans towards it when he can. */
  formation: FormationId;
  /** 0 to 1. How readily he plays young players. */
  youth: number;
  /** The season he took over. */
  since: number;
  /** The matchday he took over, 0 for the summer. */
  week: number;
}

export function makeManager(rng: Rng, season: number, week = 0): Manager {
  const r = rng.next();
  return {
    name: `${rng.pick(FIRST)} ${rng.pick(LAST)}`,
    style: r < 0.3 ? 'attacking' : r < 0.75 ? 'balanced' : 'defensive',
    formation: rng.pick(FORMATION_IDS),
    youth: Math.round(rng.next() * 100) / 100,
    since: season,
    week,
  };
}

export interface Club {
  id: string;
  name: string;
  short: string;
  c1: string;
  c2: string;
  division: number;
  /** Average starter OVR the squad was built around. Emergent from the squad once the world runs. */
  rating: number;
  /** 0.85 to 1.3. How much money the club brings in compared with its league. */
  wealth: number;
  /** Money available for transfers. Falls when clubs overspend, rises when they run a surplus. */
  funds: number;
  mgr: Manager;
}

export interface Fixture { h: string; a: string; hg: number | null; ag: number | null }
export type Fixtures = Record<number, Fixture[][]>;

const TOP_FLIGHT: [string, string, string, string][] = [
  ['Kingsmere United', 'KMU', '#b3122e', '#f2f2f2'],
  ['Thornwick City', 'THC', '#5aa9e6', '#13294b'],
  ['Calderbridge Rovers', 'CAL', '#1f4e9c', '#ffffff'],
  ['Wexmouth Albion', 'WEX', '#0e7c66', '#ffffff'],
  ['Norchester County', 'NOR', '#6a1b9a', '#f5d000'],
  ['Corrington City', 'COR', '#ffb703', '#023047'],
  ['Redcastle Wanderers', 'RED', '#d1495b', '#1a1a1a'],
  ['Brackenfield Athletic', 'BRA', '#2d6a4f', '#e9c46a'],
  ['Port Hollin Athletic', 'PHA', '#264653', '#e76f51'],
  ['Greywater United', 'GRY', '#8d99ae', '#2b2d42'],
  ['Ravensholme Rovers', 'RAV', '#222831', '#eeeeee'],
  ['Ironley Athletic', 'IRN', '#9c6644', '#1b1b1b'],
  ['Sutterby Forest', 'SUT', '#386641', '#f2e8cf'],
  ['Stanmoor Town', 'STA', '#a8201a', '#ec9a29'],
  ['Fenmarket Town', 'FEN', '#f4d35e', '#083d77'],
  ['Hallowell City', 'HAL', '#4361ee', '#f72585'],
  ['Old Saltham', 'OLS', '#3a86ff', '#ffbe0b'],
  ['Copperhythe United', 'COP', '#c17c3a', '#1d1d1d'],
  ['Ellesby County', 'ELL', '#588157', '#dad7cd'],
  ['Wickerley Town', 'WIC', '#bc6c25', '#fefae0'],
];

const PREFIX = ['Alderwick', 'Bramhall', 'Carrowby', 'Dunsley', 'Eastvale', 'Fordham', 'Garsdale', 'Hartmoor', 'Ilkeston', 'Jesmond', 'Kelbrook', 'Lowther', 'Marlby', 'Netherby', 'Oakmere', 'Penrith', 'Quarnby', 'Ravenby', 'Selwick', 'Tarnside', 'Upperby', 'Valeford', 'Whitcombe', 'Yarrowby', 'Ashgrove', 'Birchwood', 'Cranleigh', 'Delmere', 'Elmstead', 'Fernbank', 'Gladwell', 'Holmbury', 'Ivybridge', 'Juniper Hill', 'Kestrel Moor', 'Larkfield', 'Mereside', 'Northwold', 'Orrinsby', 'Pendleford', 'Quillbeck', 'Rushton Heath', 'Stonebeck', 'Thistleby', 'Underhill', 'Westbourne', 'Yewdale', 'Ainsley', 'Bexmoor', 'Coldwater', 'Dalmeny', 'Eskdale', 'Fallowby', 'Greystoke', 'Hawksby', 'Inglemere', 'Kirkdale', 'Lindhurst', 'Moorcross', 'Nethercote'];
const SUFFIX = ['Town', 'City', 'United', 'Athletic', 'Rovers', 'Wanderers', 'County', 'Albion', 'Rangers', 'Borough'];
const KITS: [string, string][] = [['#c8102e', '#ffffff'], ['#003087', '#ffffff'], ['#006747', '#f5f5f5'], ['#f6c000', '#1a1a1a'], ['#5b2c83', '#e9e9e9'], ['#e4572e', '#1c1c1c'], ['#1b998b', '#fdfdfd'], ['#2b2d42', '#ef233c'], ['#7a1f2b', '#f1e3c4'], ['#0b6e99', '#ffd166']];

export function makeClubs(rng: Rng): Club[] {
  const clubs: Club[] = [];
  const used = new Set<string>();
  const ratings = (d: Division, n: number) => Array.from({ length: n }, (_, i) => clamp(d.rating[1] - (i / (n - 1)) * (d.rating[1] - d.rating[0]) + rng.gauss() * 0.8, d.rating[0] - 1, d.rating[1] + 1));
  TOP_FLIGHT.forEach(([name, short, c1, c2], i) => {
    used.add(short);
    clubs.push({ id: 'c' + clubs.length, name, short, c1, c2, division: 1, rating: ratings(DIVISIONS[0], 20)[i], wealth: 0.85 + 0.45 * rng.next(), funds: 0, mgr: makeManager(rng, 1) });
  });
  for (const d of DIVISIONS.slice(1)) {
    const r = ratings(d, 20);
    for (let i = 0; i < 20; i++) {
      let name = '';
      let short = '';
      for (let tries = 0; tries < 50; tries++) {
        name = `${rng.pick(PREFIX)} ${rng.pick(SUFFIX)}`;
        short = name.replace(/[^A-Za-z]/g, '').slice(0, 3).toUpperCase();
        if (!used.has(short) && !clubs.some(c => c.name === name)) break;
      }
      used.add(short);
      const [c1, c2] = rng.pick(KITS);
      clubs.push({ id: 'c' + clubs.length, name, short, c1, c2, division: d.id, rating: r[i], wealth: 0.85 + 0.45 * rng.next(), funds: 0, mgr: makeManager(rng, 1) });
    }
  }
  return clubs;
}

// Squad template: S = first-team starter, B = squad player, Y = youth prospect.
const SQUAD: [Position, 'S' | 'B' | 'Y'][] = [
  ['GK', 'S'], ['GK', 'B'], ['GK', 'Y'],
  ['CB', 'S'], ['CB', 'S'], ['CB', 'B'], ['CB', 'B'],
  ['FB', 'S'], ['FB', 'S'], ['FB', 'B'], ['FB', 'B'],
  ['DM', 'S'], ['DM', 'B'],
  ['CM', 'S'], ['CM', 'S'], ['CM', 'B'],
  ['AM', 'S'], ['AM', 'B'],
  ['W', 'S'], ['W', 'S'], ['W', 'B'],
  ['ST', 'S'], ['ST', 'S'], ['ST', 'B'],
];

export function makeSquad(rng: Rng, club: Club, nextId: () => string): Player[] {
  return SQUAD.map(([pos, role]) => {
    const age = role === 'Y' ? rng.int(17, 19) : role === 'S' ? rng.int(22, 33) : rng.int(19, 32);
    const base = role === 'S' ? club.rating : role === 'B' ? club.rating - 6 : club.rating - 15;
    const target = clamp(base + rng.gauss() * 3 - (age >= 33 ? 2 : 0), 28, 95);
    return generatePlayer(rng, { id: nextId(), position: pos, age, targetOvr: target, clubId: club.id });
  });
}

/** Round-robin fixtures for one division: every club plays every other home and away. */
export function makeDivisionFixtures(rng: Rng, clubIds: string[]): Fixture[][] {
  const ids = clubIds.slice();
  for (let i = ids.length - 1; i > 0; i--) { const j = Math.floor(rng.next() * (i + 1)); [ids[i], ids[j]] = [ids[j], ids[i]]; }
  const n = ids.length;
  const rounds: Fixture[][] = [];
  let arr = ids.slice();
  for (let r = 0; r < n - 1; r++) {
    const rd: Fixture[] = [];
    for (let i = 0; i < n / 2; i++) {
      let h = arr[i];
      let a = arr[n - 1 - i];
      if (i === 0 ? r % 2 === 1 : (i + r) % 2 === 1) [h, a] = [a, h];
      rd.push({ h, a, hg: null, ag: null });
    }
    rounds.push(rd);
    arr = [arr[0], arr[n - 1], ...arr.slice(1, n - 1)];
  }
  const second = rounds.map(rd => rd.map(f => ({ h: f.a, a: f.h, hg: null, ag: null })));
  return rounds.concat(second);
}
