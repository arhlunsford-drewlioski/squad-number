import { clubOf, humanOf, WEEKS } from '../engine/game';
import { DIVISIONS } from '../engine/world';
import { useStore, type ScreenId } from '../state/store';
import { Kit } from './components';
import { TextSizeControl } from './TextSize';
import { Competitions } from './screens/Competitions';
import { Inbox } from './screens/Inbox';
import { Overview } from './screens/Overview';
import { PlayerScreen } from './screens/PlayerScreen';
import { Squad } from './screens/Squad';
import { Instructions } from './screens/Instructions';
import { Schedule } from './screens/Schedule';
import { MatchView } from './screens/MatchView';
import { Training } from './screens/Training';
import { Lab } from './screens/Lab';
import { EventScreen } from './screens/EventScreen';
import { Transfers } from './screens/Transfers';
import { ClubScreen } from './screens/ClubScreen';
import { Cup } from './screens/Cup';
import { Career } from './screens/Career';
import { Settings } from './screens/Settings';
import { Help } from './screens/Help';
import { News } from './screens/News';
import { Tour } from './Tour';
import { useEffect, useState } from 'react';
import { windowOf } from '../engine/market/transfers';

const NAV: { group: string; items: { id: ScreenId; label: string; soon?: boolean }[] }[] = [
  { group: 'Home', items: [{ id: 'overview', label: 'Overview' }, { id: 'news', label: 'News' }, { id: 'inbox', label: 'Inbox' }] },
  { group: 'Player', items: [{ id: 'player', label: 'Profile' }, { id: 'training', label: 'Training' }, { id: 'instructions', label: 'Instructions' }, { id: 'career', label: 'Career' }] },
  { group: 'Team', items: [{ id: 'squad', label: 'Squad' }, { id: 'club', label: 'Club' }, { id: 'transfers', label: 'Transfers' }] },
  { group: 'Competitions', items: [{ id: 'schedule', label: 'Schedule' }, { id: 'competitions', label: 'Leagues' }, { id: 'cup', label: 'Cup' }] },
  { group: 'More', items: [{ id: 'settings', label: 'Settings' }, { id: 'help', label: 'Help' }, { id: 'lab', label: 'Moment lab' }] },
];

function Screen({ id }: { id: ScreenId }) {
  switch (id) {
    case 'inbox': return <Inbox />;
    case 'overview': return <Overview />;
    case 'player': return <PlayerScreen />;
    case 'squad': return <Squad />;
    case 'competitions': return <Competitions />;
    case 'training': return <Training />;
    case 'instructions': return <Instructions />;
    case 'club': return <ClubScreen />;
    case 'schedule': return <Schedule />;
    case 'match': return <MatchView />;
    case 'lab': return <Lab />;
    case 'event': return <EventScreen />;
    case 'transfers': return <Transfers />;
    case 'cup': return <Cup />;
    case 'career': return <Career />;
    case 'settings': return <Settings />;
    case 'help': return <Help />;
    case 'news': return <News />;
  }
}

/** Keys that work anywhere: Ctrl or Cmd + Enter continues, ? opens help. */
function useGlobalKeys() {
  useEffect(() => {
    const on = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)) return;
      const st = useStore.getState();
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); st.next(); }
      else if (e.altKey && e.key === 'ArrowLeft') { e.preventDefault(); st.back(); }
      else if (e.altKey && e.key === 'ArrowRight') { e.preventDefault(); st.forward(); }
      else if (e.key === '?' && !e.ctrlKey && !e.metaKey) { st.go('help'); }
    };
    window.addEventListener('keydown', on);
    return () => window.removeEventListener('keydown', on);
  }, []);
}

const ICON: Record<string, string> = {
  home: 'M3 11l9-8 9 8v10h-6v-6H9v6H3z',
  squad: 'M8 11a3 3 0 100-6 3 3 0 000 6zm8 0a3 3 0 100-6 3 3 0 000 6zM2 20c0-3 3-5 6-5s6 2 6 5zm12 0c0-1.5-.6-2.8-1.6-3.8.5-.1 1-.2 1.6-.2 3 0 6 2 6 5z',
  train: 'M4 10v4M7 7v10M17 7v10M20 10v4M7 12h10',
  more: 'M5 12h.01M12 12h.01M19 12h.01',
  play: 'M8 5l12 7-12 7z',
};
const Ico = ({ n }: { n: keyof typeof ICON }) => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill={n === 'play' || n === 'home' || n === 'squad' ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={n === 'more' ? 3.4 : 2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={ICON[n]} /></svg>
);

export function Shell() {
  useGlobalKeys();
  const [more, setMore] = useState(false);
  const { game, screen, go, next, openMenu, live, nav, back, forward } = useStore();
  const g = game!;
  const me = humanOf(g);
  const club = clubOf(g, me.clubId)!;
  const unread = g.inbox.filter(m => !m.read).length;
  const cupTie = g.cup.pending ? g.cup.rounds[g.cup.pending.round].ties[g.cup.pending.tie] : null;
  const fx = cupTie ?? g.fixtures[club.division][g.week - 1]?.find(f => f.h === club.id || f.a === club.id);
  const opp = fx ? clubOf(g, fx.h === club.id ? fx.a : fx.h) : null;
  const cta = live && live.status !== 'finished' ? 'Back to match' : g.event ? 'Decision needed' : cupTie ? 'Play cup tie' : 'Continue';
  const tabs: { id: ScreenId; label: string; icon: keyof typeof ICON }[] = [{ id: 'overview', label: 'Home', icon: 'home' }, { id: 'squad', label: 'Squad', icon: 'squad' }];
  const tabs2: { id: ScreenId; label: string; icon: keyof typeof ICON }[] = [{ id: 'training', label: 'Train', icon: 'train' }];
  const inTabs = new Set<ScreenId>(['overview', 'squad', 'training']);

  return (
    <div className="app">
      <a className="skip" href="#main" onClick={e => { e.preventDefault(); document.getElementById('main')?.focus(); }}>Skip to content</a>
      <Tour />
      <header className="top">
        <div className="club"><Kit club={club} />{club.name}{g.loan ? <span className="muted" style={{ fontWeight: 400 }}> (loan)</span> : null}</div>
        <div className="ctx">
          <span className="hide-m">Season <b>{g.season}</b></span>
          <span className="hide-m">Matchday <b>{g.week}</b> of {WEEKS}</span>
          <span className="show-m">S{g.season} · MD <b>{g.week}</b>/{WEEKS}</span>
          <span className="hide-m">{DIVISIONS[club.division - 1].name}</span>
          {windowOf(g.week) && <span className="hide-m" style={{ color: 'var(--good)' }}>Transfer window open</span>}
          {opp && <span>Next: <b>{opp.short}</b> ({cupTie?.neutral ? 'N' : fx!.h === club.id ? 'H' : 'A'}){cupTie ? ' cup' : ''}</span>}
        </div>
        <div className="spacer" />
        <div className="seg hide-m" role="group" aria-label="History">
          <button onClick={back} disabled={nav.idx <= 0} title="Back (Alt + Left)" aria-label="Back">‹</button>
          <button onClick={forward} disabled={nav.idx >= nav.stack.length - 1} title="Forward (Alt + Right)" aria-label="Forward">›</button>
        </div>
        <span className="hide-m"><TextSizeControl /></span>
        <button className="btn sm hide-m" onClick={openMenu}>Menu</button>
        <button className="btn primary hide-m" onClick={next}>{cta}</button>
      </header>
      <nav className="side" aria-label="Sections">
        {NAV.map(sec => (
          <div key={sec.group}>
            <h4>{sec.group}</h4>
            {sec.items.map(it => (
              <button key={it.id} className={it.soon ? 'soon' : ''} aria-current={screen === it.id ? 'page' : undefined} onClick={() => go(it.id)}>
                <span>{it.label}</span>
                {it.id === 'inbox' && unread > 0 ? <span className="count">{unread}</span> : null}
              </button>
            ))}
          </div>
        ))}
      </nav>
      <main className="main" id="main" tabIndex={-1}><Screen id={screen} /></main>
      <nav className="tabbar" aria-label="Main">
        {tabs.map(t => <button key={t.id} aria-current={screen === t.id ? 'page' : undefined} onClick={() => go(t.id)}><Ico n={t.icon} /><span>{t.label}</span></button>)}
        <button className="play" onClick={next} aria-label={cta}><Ico n="play" /><span>{g.event ? 'Decide' : cupTie ? 'Cup' : live && live.status !== 'finished' ? 'Match' : 'Play'}</span></button>
        {tabs2.map(t => <button key={t.id} aria-current={screen === t.id ? 'page' : undefined} onClick={() => go(t.id)}><Ico n={t.icon} /><span>{t.label}</span></button>)}
        <button aria-current={!inTabs.has(screen) ? 'page' : undefined} onClick={() => setMore(true)}><Ico n="more" /><span>More{unread > 0 ? ` (${unread})` : ''}</span></button>
      </nav>
      {more && (
        <div className="sheet-back" onClick={() => setMore(false)}>
          <div className="more-sheet" role="dialog" aria-label="More" onClick={e => e.stopPropagation()}>
            <div className="more-grid">
              {NAV.flatMap(s => s.items).filter(it => it.id !== 'overview' && it.id !== 'squad' && it.id !== 'training').map(it => (
                <button key={it.id} onClick={() => { go(it.id); setMore(false); }}>{it.label}{it.id === 'inbox' && unread > 0 ? ` (${unread})` : ''}</button>
              ))}
              <button onClick={() => { setMore(false); openMenu(); }}>Main menu</button>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginTop: 12 }}>
              <TextSizeControl />
              <span style={{ display: 'inline-flex', gap: 8 }}>
                <button className="btn" onClick={back} disabled={nav.idx <= 0}>Back</button>
                <button className="btn" onClick={() => setMore(false)}>Close</button>
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
