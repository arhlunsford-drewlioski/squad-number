import { describe, expect, it } from 'vitest';
import { ensureCareer } from '../src/engine/career';
import { createGame, joinClub } from '../src/engine/game';
import { newsFeed, todayNotes } from '../src/engine/news';
import { autoBuild, BASE_POOL } from '../src/engine/pointbuy';
import { playWeek } from '../src/engine/week';
import { useStore } from '../src/state/store';

describe('navigation history', () => {
  it('remembers where you have been and drops the future when you go somewhere new', () => {
    const st = () => useStore.getState();
    st().go('squad');
    st().selectPlayer('p9');
    st().selectClub('c3');
    expect(st().screen).toBe('club');
    expect(st().selectedClubId).toBe('c3');
    st().back();
    expect(st().screen).toBe('player');
    expect(st().selectedPlayerId).toBe('p9');
    st().back();
    expect(st().screen).toBe('squad');
    st().forward();
    expect(st().screen).toBe('player');
    st().go('cup');
    expect(st().nav.stack[st().nav.stack.length - 1].screen).toBe('cup');
    st().forward();
    expect(st().screen).toBe('cup');
    // Going to the same place twice does not add a second entry.
    const len = st().nav.stack.length;
    st().go('cup');
    expect(st().nav.stack.length).toBe(len);
    // Going to your own club clears the selected club.
    st().go('club');
    expect(st().selectedClubId).toBeNull();
  });
});

describe('news and today', () => {
  it('builds one feed, newest first, and notes what matters', () => {
    const g = createGame(61, { name: 'T', position: 'CM', heightCm: 182, build: 'athletic', foot: 'right', weakFoot: 2, attrs: autoBuild('CM', 182, 'athletic', BASE_POOL), nowLater: 0 });
    joinClub(g, 0);
    ensureCareer(g);
    for (let w = 0; w < 8; w++) { if (g.event) g.event = null; playWeek(g); }
    const feed = newsFeed(g);
    expect(feed.length).toBeGreaterThan(5);
    for (let i = 1; i < feed.length; i++) {
      const a = feed[i - 1], b = feed[i];
      expect(a.season * 100 + a.week).toBeGreaterThanOrEqual(b.season * 100 + b.week);
    }
    expect(feed.some(n => n.kind === 'match')).toBe(true);
    expect(feed.some(n => n.kind === 'transfer')).toBe(true);
    const notes = todayNotes(g);
    expect(Array.isArray(notes)).toBe(true);
  }, 60000);
});
