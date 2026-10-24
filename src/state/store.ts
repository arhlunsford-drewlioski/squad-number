import { create } from 'zustand';
import { clubOf, createGame, humanOf, joinClub, WEEKS, type Game, type HumanChoices } from '../engine/game';
import type { Instructions } from '../engine/match/types';
import { beginWeek, completeWeek, matchCtx, type WeekState } from '../engine/week';
import { beginCareerSeason, beginCupTie, completeCupTie, retire } from '../engine/career';
import { migrate } from '../engine/migrate';
import { ovrOf } from '../engine/player';
import { DIVISIONS } from '../engine/world';
import { simulateMatch } from '../engine/match/sim';
import { LiveMatch } from '../view/live';
import { chooseEvent } from '../engine/events/events';
import { startNextSeason } from '../engine/season';
import type { AttrId } from '../engine/attributes';
import type { Session } from '../engine/training';
import type { TraitId } from '../engine/traits';
import { deleteGame, getActiveSlot, listSlots, loadGame, metaOf, saveGame, setActiveSlot, type Slot, type SlotMeta } from './save';

export type ScreenId = 'event' | 'lab' | 'match' | 'inbox' | 'overview' | 'player' | 'training' | 'instructions' | 'squad' | 'club' | 'schedule' | 'competitions' | 'transfers' | 'cup' | 'career' | 'settings' | 'help' | 'news';
/** A place you can go back to: a screen, and who or what it was showing. */
export interface NavEntry { screen: ScreenId; playerId: string | null; clubId: string | null }
export type Theme = 'dark' | 'light';
export type TextSize = 's' | 'm' | 'l';
export type MatchMode = 'full' | 'highlights' | 'instant';
export type Density = 'normal' | 'compact';
export type Contrast = 'normal' | 'high';
export type Motion = 'normal' | 'reduced';
export type Speed = 1 | 2 | 4 | 8;

/** Interface preferences. They belong to the browser, not to a career. */
export interface Prefs { density: Density; contrast: Contrast; motion: Motion; speed: Speed; tourSeen: boolean }

interface Store {
  loaded: boolean;
  game: Game | null;
  screen: ScreenId;
  selectedPlayerId: string | null;
  /** The club shown on the Club screen. Null means your own. */
  selectedClubId: string | null;
  nav: { stack: NavEntry[]; idx: number };
  back(): void;
  forward(): void;
  selectClub(id: string): void;
  theme: Theme;
  size: TextSize;
  setSize(s: TextSize): void;
  prefs: Prefs;
  setPrefs(p: Partial<Prefs>): void;
  /** Which save slot is in use, and what is in each slot. */
  slot: Slot;
  slots: (SlotMeta | null)[];
  /** With no career open: the menu of saves, or the new-career screen. */
  view: 'menu' | 'create';
  openMenu(): void;
  startNew(slot: Slot): void;
  loadSlot(slot: Slot): Promise<string | null>;
  removeSlot(slot: Slot): Promise<void>;
  exportSlot(slot: Slot): Promise<void>;
  importText(slot: Slot, text: string): Promise<string | null>;
  /** How matches are played. Full: every moment, every scene. Highlights: moments and the big chances, faster. Instant: no match view. */
  matchMode: MatchMode;
  setMatchMode(m: MatchMode): void;
  /** The match in progress, played with decisions. Null otherwise. */
  live: LiveMatch | null;
  /** Bumped whenever the live match changes, so views redraw. */
  liveVersion: number;
  /** What happened after the last event answer, until the player dismisses it. */
  eventResult: { title: string; choice: string; result: string } | null;
  answerEvent(optionId: string): void;
  dismissEvent(): void;
  chooseMoment(optionId: string | undefined): void;
  skipMatch(): void;
  leaveMatch(): void;
  /** The report whose replay the match view shows. */
  viewing: { season: number; week: number } | null;
  watchReport(season: number, week: number): void;
  boot(): Promise<void>;
  newCareer(c: HumanChoices): void;
  chooseOffer(i: number): void;
  go(s: ScreenId): void;
  selectPlayer(id: string): void;
  readMessage(id: number): void;
  next(): void;
  setInstructions(patch: Partial<Instructions>): void;
  setSession(i: number, patch: Partial<Session>): void;
  setFocus(a: AttrId | null): void;
  setTraitFocus(t: TraitId | null): void;
  startSeason(offerIdx: number | null): void;
  retireNow(): void;
  resetCareer(): void;
  toggleTheme(): void;
}

const THEME_KEY = 'squad-number-theme';
const readTheme = (): Theme => {
  try { return localStorage.getItem(THEME_KEY) === 'light' ? 'light' : 'dark'; } catch { return 'dark'; }
};
const applyTheme = (t: Theme) => { document.documentElement.dataset.theme = t; };

const MODE_KEY = 'squad-number-mode';
const readMode = (): MatchMode => {
  try { const v = localStorage.getItem(MODE_KEY); return v === 'highlights' || v === 'instant' ? v : 'full'; } catch { return 'full'; }
};

const freshNav = () => ({ stack: [{ screen: 'overview' as ScreenId, playerId: null, clubId: null }], idx: 0 });

type SetFn = (p: Partial<Store>) => void;

/** Goes to a place and remembers it, dropping anything that was ahead in the history. */
function visit(set: SetFn, get: () => Store, e: NavEntry): void {
  const { stack, idx } = get().nav;
  const cur = stack[idx];
  const same = cur && cur.screen === e.screen && cur.playerId === e.playerId && cur.clubId === e.clubId;
  const next = same ? { stack, idx } : { stack: [...stack.slice(0, idx + 1), e].slice(-60), idx: Math.min(idx + 1, 59) };
  set({ nav: next, screen: e.screen, selectedPlayerId: e.playerId, selectedClubId: e.clubId });
}

/** The week in progress while a live match is being played. It is applied to the game when the match ends. */
let pending: { game: Game; ws: WeekState; cup: boolean } | null = null;

const PREFS_KEY = 'squad-number-prefs';
const DEFAULT_PREFS: Prefs = { density: 'normal', contrast: 'normal', motion: 'normal', speed: 1, tourSeen: false };
const readPrefs = (): Prefs => {
  try {
    const raw = JSON.parse(localStorage.getItem(PREFS_KEY) ?? '{}') as Partial<Prefs>;
    const reduced = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
    return { ...DEFAULT_PREFS, motion: reduced ? 'reduced' : 'normal', ...raw };
  } catch { return DEFAULT_PREFS; }
};
const applyPrefs = (p: Prefs) => {
  const d = document.documentElement.dataset;
  d.density = p.density; d.contrast = p.contrast; d.motion = p.motion;
};

/** Writes the game to the current slot, with a short description beside it for the menu. */
function persist(g: Game): void {
  const slot = useStore.getState().slot;
  const me = humanOf(g);
  const club = clubOf(g, me.clubId);
  void saveGame(g, slot, metaOf(g, slot, club?.name ?? '-', club ? DIVISIONS[club.division - 1].name : '', ovrOf(me)));
}

const SIZE_KEY = 'squad-number-size';
const readSize = (): TextSize => {
  try { const v = localStorage.getItem(SIZE_KEY); return v === 's' || v === 'l' ? v : 'm'; } catch { return 'm'; }
};
const applySize = (s: TextSize) => { document.documentElement.dataset.size = s; };

function finalize(live: LiveMatch): void {
  if (!pending || !live.result) return;
  if (pending.cup) completeCupTie(pending.game, pending.ws, live.result); else completeWeek(pending.game, pending.ws, live.result);
  const game = pending.game;
  const rep = game.reports[0];
  pending = null;
  useStore.setState({ game, liveVersion: live.version, viewing: { season: rep.season, week: rep.week } });
  persist(game);
}

export const useStore = create<Store>((set, get) => ({
  loaded: false,
  game: null,
  screen: 'overview',
  selectedPlayerId: null,
  selectedClubId: null,
  nav: { stack: [{ screen: 'overview', playerId: null, clubId: null }], idx: 0 },
  theme: 'dark',
  size: 'm',
  matchMode: 'full',
  prefs: DEFAULT_PREFS,
  slot: 1,
  slots: [null, null, null],
  view: 'menu',
  live: null,
  liveVersion: 0,
  eventResult: null,
  viewing: null,

  setMatchMode(matchMode) {
    try { localStorage.setItem(MODE_KEY, matchMode); } catch { /* ignore */ }
    set({ matchMode });
  },

  watchReport(season, week) { set({ viewing: { season, week }, screen: 'match' }); },

  setSize(size) {
    applySize(size);
    try { localStorage.setItem(SIZE_KEY, size); } catch { /* ignore */ }
    set({ size });
  },

  setPrefs(patch) {
    const prefs = { ...get().prefs, ...patch };
    applyPrefs(prefs);
    try { localStorage.setItem(PREFS_KEY, JSON.stringify(prefs)); } catch { /* ignore */ }
    set({ prefs });
  },

  async boot() {
    const theme = readTheme();
    const size = readSize();
    const prefs = readPrefs();
    applyTheme(theme);
    applySize(size);
    applyPrefs(prefs);
    // Ask the browser not to clear saves when it is short of space.
    try { void navigator.storage?.persist?.(); } catch { /* optional */ }
    const slot = getActiveSlot();
    const raw = await loadGame(slot);
    const game = raw ? migrate(raw) : null;
    const slots = await listSlots();
    set({ loaded: true, theme, size, prefs, matchMode: readMode(), game, slot, slots, view: slots.some(Boolean) ? 'menu' : 'create' });
  },

  openMenu() {
    pending = null;
    set({ game: null, live: null, view: 'menu', screen: 'overview' });
    void listSlots().then(slots => set({ slots }));
  },

  startNew(slot) {
    setActiveSlot(slot);
    set({ slot, game: null, view: 'create' });
  },

  async loadSlot(slot) {
    const raw = await loadGame(slot);
    const game = raw ? migrate(raw) : null;
    if (!game) return 'That save could not be read. It may be from a different version of the game.';
    pending = null;
    setActiveSlot(slot);
    set({ slot, game, live: null, screen: 'overview', selectedPlayerId: game.humanId, selectedClubId: null, nav: freshNav(), eventResult: null });
    return null;
  },

  async removeSlot(slot) {
    await deleteGame(slot);
    set({ slots: await listSlots() });
  },

  async exportSlot(slot) {
    const g = await loadGame(slot);
    if (!g) return;
    const blob = new Blob([JSON.stringify(g)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `squad-number-slot${slot}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  },

  async importText(slot, text) {
    let parsed: Game | null = null;
    try { parsed = JSON.parse(text) as Game; } catch { return 'That file is not a save.'; }
    const game = migrate(parsed);
    if (!game) return 'That file is not a save this version can read.';
    const me = humanOf(game);
    const club = clubOf(game, me.clubId);
    await saveGame(game, slot, metaOf(game, slot, club?.name ?? '-', club ? DIVISIONS[club.division - 1].name : '', ovrOf(me)));
    set({ slots: await listSlots() });
    return null;
  },

  newCareer(c) {
    const game = createGame((Date.now() ^ Math.floor(Math.random() * 1e9)) | 0, c);
    set({ game, screen: 'overview', selectedPlayerId: game.humanId, selectedClubId: null, nav: freshNav() });
    persist(game);
  },

  chooseOffer(i) {
    const game = structuredClone(get().game!);
    joinClub(game, i);
    beginCareerSeason(game);
    set({ game, screen: 'inbox' });
    persist(game);
  },

  go(screen) { visit(set, get, { screen, playerId: get().selectedPlayerId, clubId: screen === 'club' ? null : get().selectedClubId }); },
  selectPlayer(id) { visit(set, get, { screen: 'player', playerId: id, clubId: get().selectedClubId }); },
  selectClub(id) { visit(set, get, { screen: 'club', playerId: get().selectedPlayerId, clubId: id }); },

  back() {
    const { stack, idx } = get().nav;
    if (idx <= 0) return;
    const e = stack[idx - 1];
    set({ nav: { stack, idx: idx - 1 }, screen: e.screen, selectedPlayerId: e.playerId, selectedClubId: e.clubId });
  },
  forward() {
    const { stack, idx } = get().nav;
    if (idx >= stack.length - 1) return;
    const e = stack[idx + 1];
    set({ nav: { stack, idx: idx + 1 }, screen: e.screen, selectedPlayerId: e.playerId, selectedClubId: e.clubId });
  },

  readMessage(id) {
    const game = structuredClone(get().game!);
    const m = game.inbox.find(x => x.id === id);
    if (!m || m.read) return;
    m.read = true;
    set({ game });
    persist(game);
  },

  // Continue plays the next matchday. With decisions on, your match is played live; the rest of the world is simulated first.
  next() {
    const st = get();
    if (st.live && st.live.status !== 'finished') { set({ screen: 'match' }); return; }
    if (st.game!.event) { set({ screen: 'event' }); return; }
    const game = structuredClone(st.game!);
    const cup = !!game.cup.pending;
    if (!cup && game.week > WEEKS) return;
    const ws = cup ? beginCupTie(game) : beginWeek(game);
    if (!ws) return;
    const ctx = matchCtx(game, ws);
    const teams = (() => {
      const t = (id: string, formation: WeekState['H']['formation']) => { const c = game.clubs.find(x => x.id === id)!; return { clubId: id, name: c.name, short: c.short, c1: c.c1, c2: c.c2, formation }; };
      return { h: t(ws.fx.h, ws.H.formation), a: t(ws.fx.a, ws.A.formation) };
    })();
    if (st.matchMode === 'instant' || !ctx.moments) {
      const r = simulateMatch(ws.H, ws.A, ws.rng, ctx);
      if (cup) completeCupTie(game, ws, r); else completeWeek(game, ws, r);
      const rep = game.reports[0];
      set({ game, live: null, viewing: { season: rep.season, week: rep.week }, screen: 'schedule' });
      persist(game);
      return;
    }
    pending = { game, ws, cup };
    const live = new LiveMatch({ H: ws.H, A: ws.A, rng: ws.rng, ctx, teams, mode: st.matchMode });
    // A substitute who is not going to be used has nothing to decide: go straight to the result.
    if (live.replay && !live.replay.players.some(p => p.human)) {
      live.autoFinish();
      finalize(live);
      set({ live: null, screen: 'schedule' });
      return;
    }
    set({ live, liveVersion: live.version, viewing: null, screen: 'match' });
    if (live.status === 'finished') finalize(live);
  },

  answerEvent(optionId) {
    const game = structuredClone(get().game!);
    const res = chooseEvent(game, optionId);
    if (!res) return;
    set({ game, eventResult: res });
    persist(game);
  },

  dismissEvent() { set({ eventResult: null, screen: 'overview' }); },

  chooseMoment(optionId) {
    const live = get().live;
    if (!live) return;
    live.choose(optionId);
    if (live.status === 'finished') finalize(live);
    else set({ liveVersion: live.version });
  },

  skipMatch() {
    const live = get().live;
    if (!live) return;
    live.autoFinish();
    finalize(live);
  },

  leaveMatch() { set({ live: null, screen: 'schedule' }); },

  setInstructions(patch) {
    const game = structuredClone(get().game!);
    game.instructions = { ...game.instructions, ...patch };
    set({ game });
    persist(game);
  },

  setSession(i, patch) {
    const game = structuredClone(get().game!);
    game.training.sessions[i] = { ...game.training.sessions[i], ...patch };
    set({ game });
    persist(game);
  },

  setFocus(a) {
    const game = structuredClone(get().game!);
    game.training.focus = a;
    set({ game });
    persist(game);
  },

  setTraitFocus(t) {
    const game = structuredClone(get().game!);
    game.training.traitFocus = t;
    set({ game });
    persist(game);
  },

  startSeason(offerIdx) {
    const game = structuredClone(get().game!);
    startNextSeason(game, offerIdx);
    set({ game, screen: 'overview' });
    persist(game);
  },

  retireNow() {
    const game = structuredClone(get().game!);
    retire(game);
    set({ game, screen: 'overview' });
    persist(game);
  },

  resetCareer() {
    const slot = get().slot;
    pending = null;
    set({ game: null, screen: 'overview', selectedPlayerId: null, live: null, view: 'menu' });
    void deleteGame(slot).then(listSlots).then(slots => set({ slots, view: slots.some(Boolean) ? 'menu' : 'create' }));
  },

  toggleTheme() {
    const theme: Theme = get().theme === 'dark' ? 'light' : 'dark';
    applyTheme(theme);
    try { localStorage.setItem(THEME_KEY, theme); } catch { /* ignore */ }
    set({ theme });
  },
}));
