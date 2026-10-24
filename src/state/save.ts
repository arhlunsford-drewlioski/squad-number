import type { Game } from '../engine/game';

// Saves live in IndexedDB. A world of 2,000+ players with history is too big for localStorage.
const DB = 'squad-number';
const STORE = 'saves';
export const SLOTS = [1, 2, 3] as const;
export type Slot = (typeof SLOTS)[number];

const key = (slot: Slot) => `slot${slot}`;
const metaKey = (slot: Slot) => `slot${slot}:meta`;
const ACTIVE_KEY = 'squad-number-slot';

/** A short description of a save, kept beside it so the menu does not have to load whole worlds. */
export interface SlotMeta {
  slot: Slot;
  name: string;
  club: string;
  division: string;
  season: number;
  week: number;
  age: number;
  position: string;
  ovr: number;
  phase: Game['phase'];
  updated: number;
}

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function put(db: IDBDatabase, entries: [string, unknown][]): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    for (const [k, v] of entries) tx.objectStore(STORE).put(v, k);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

function get<T>(db: IDBDatabase, k: string): Promise<T | null> {
  return new Promise((resolve, reject) => {
    const req = db.transaction(STORE).objectStore(STORE).get(k);
    req.onsuccess = () => resolve((req.result as T | undefined) ?? null);
    req.onerror = () => reject(req.error);
  });
}

export const getActiveSlot = (): Slot => {
  try { const v = Number(localStorage.getItem(ACTIVE_KEY)); return (SLOTS as readonly number[]).includes(v) ? (v as Slot) : 1; } catch { return 1; }
};
export const setActiveSlot = (s: Slot) => { try { localStorage.setItem(ACTIVE_KEY, String(s)); } catch { /* ignore */ } };

export function metaOf(g: Game, slot: Slot, club: string, division: string, ovr: number): SlotMeta {
  const me = g.players.find(p => p.id === g.humanId)!;
  return { slot, name: me.name, club, division, season: g.season, week: g.week, age: me.age, position: me.position, ovr, phase: g.phase, updated: Date.now() };
}

export async function saveGame(g: Game, slot: Slot = getActiveSlot(), meta?: SlotMeta): Promise<void> {
  try {
    const db = await open();
    const entries: [string, unknown][] = [[key(slot), g]];
    if (meta) entries.push([metaKey(slot), meta]);
    await put(db, entries);
  } catch { /* storage unavailable: the game still runs, it just will not persist */ }
}

export async function loadGame(slot: Slot = getActiveSlot()): Promise<Game | null> {
  try { return await get<Game>(await open(), key(slot)); } catch { return null; }
}

export async function listSlots(): Promise<(SlotMeta | null)[]> {
  try {
    const db = await open();
    return await Promise.all(SLOTS.map(async s => {
      const meta = await get<SlotMeta>(db, metaKey(s));
      if (meta) return meta;
      // A save from before slots had descriptions: show it with what is known without loading the world twice.
      const g = await get<Game>(db, key(s));
      if (!g) return null;
      const me = g.players.find(p => p.id === g.humanId)!;
      const club = g.clubs.find(c => c.id === me.clubId);
      return { slot: s, name: me.name, club: club?.name ?? '-', division: '', season: g.season, week: g.week, age: me.age, position: me.position, ovr: 0, phase: g.phase, updated: 0 } as SlotMeta;
    }));
  } catch { return SLOTS.map(() => null); }
}

export async function deleteGame(slot: Slot = getActiveSlot()): Promise<void> {
  try {
    const db = await open();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).delete(key(slot));
      tx.objectStore(STORE).delete(metaKey(slot));
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch { /* ignore */ }
}
