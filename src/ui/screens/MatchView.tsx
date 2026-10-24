import { useEffect, useMemo, useRef, useState } from 'react';
import { clubOf } from '../../engine/game';
import type { LineKind } from '../../engine/match/report';
import type { Replay } from '../../engine/match/replay';
import type { MomentRequest } from '../../engine/moments/types';
import { POS_BY_ID } from '../../engine/positions';
import { useStore, type MatchMode } from '../../state/store';
import { drawFrame, drawPitch, type Palette, type Smoothed } from '../../view/draw';
import { PITCH_ASPECT } from '../../view/geometry';
import { timeOfMinute } from '../../view/timeline';
import { PostMatch, PreMatch } from '../MatchStages';
import { buildTimeline, frameAt, FULL_OPTS, HIGHLIGHT_OPTS, type Timeline } from '../../view/timeline';
import { Kit, Panel } from '../components';
import { DecisionCard } from '../DecisionCard';

const SPEEDS = [1, 2, 4, 8];
const MODES: { id: MatchMode; label: string; hint: string }[] = [
  { id: 'full', label: 'Full', hint: 'Every moment, every chance, at normal pace.' },
  { id: 'highlights', label: 'Highlights', hint: 'Your moments and the big chances, faster.' },
  { id: 'instant', label: 'Instant', hint: 'No match view. The engine makes your decisions.' },
];

const rgb = (hex: string) => { const h = hex.replace('#', ''); const n = parseInt(h.length === 3 ? h.split('').map(c => c + c).join('') : h, 16); return [n >> 16, (n >> 8) & 255, n & 255]; };
const dist = (a: string, b: string) => { const x = rgb(a), y = rgb(b); return Math.hypot(x[0] - y[0], x[1] - y[1], x[2] - y[2]); };

function palette(r: Replay): Palette {
  const hc1 = r.h.c1, hc2 = r.h.c2;
  let ac1 = r.a.c1, ac2 = r.a.c2;
  if (dist(hc1, ac1) < 110) { [ac1, ac2] = [ac2, ac1]; }
  if (dist(hc1, ac1) < 110) ac1 = '#222222';
  return { grass1: '#2f6b3f', grass2: '#2b6339', line: 'rgba(255,255,255,0.75)', hc1, hc2, ac1, ac2, text: '#fff', accent: '#f5c84c' };
}

interface Line { min: number; text: string; kind: LineKind }

export function MatchView() {
  const game = useStore(s => s.game)!;
  const viewing = useStore(s => s.viewing);
  const go = useStore(s => s.go);
  const live = useStore(s => s.live);
  useStore(s => s.liveVersion);
  const matchMode = useStore(s => s.matchMode);
  const setMatchMode = useStore(s => s.setMatchMode);
  const chooseMoment = useStore(s => s.chooseMoment);
  const skipMatch = useStore(s => s.skipMatch);
  const leaveMatch = useStore(s => s.leaveMatch);

  const report = game.reports.find(r => viewing && r.season === viewing.season && r.week === viewing.week) ?? game.reports[0];
  const replay: Replay | undefined = live ? live.replay : report?.replay;
  const [run, setRun] = useState(0);
  const tl: Timeline | null = useMemo(() => {
    if (live) return live.tl ?? null;
    return report?.replay ? buildTimeline(report.replay, matchMode === 'highlights' ? HIGHLIGHT_OPTS : FULL_OPTS) : null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [live, report?.replay, run]);
  const pal = useMemo(() => (replay ? palette(replay) : null), [replay]);

  const wrap = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const tRef = useRef(0);
  const defaultSpeed = useStore(st => st.prefs.speed);
  const speedRef = useRef<number>(defaultSpeed);
  const playRef = useRef(true);
  const [speed, setSpeed] = useState<number>(defaultSpeed);
  const [playing, setPlaying] = useState(true);
  const [done, setDone] = useState(false);
  const [atPause, setAtPause] = useState(false);
  const [hud, setHud] = useState({ minute: 0, h: 0, a: 0 });
  const meP = replay?.players.find(p => p.human) ?? null;
  const entrance = meP && meP.on > 0 ? meP.on : null;
  // A live match waits for you to press Kick off. Replays of finished matches just play.
  const [kickedFor, setKickedFor] = useState<unknown>(null);
  const kicked = !live || kickedFor === live;
  const ffRef = useRef<{ target: number; factor: number } | null>(null);
  const [ffOn, setFfOn] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const toastedFor = useRef<unknown>(null);

  useEffect(() => { speedRef.current = speed; }, [speed]);
  useEffect(() => { playRef.current = playing && !atPause && kicked; }, [playing, atPause, kicked]);

  useEffect(() => {
    if (!tl || !pal || !canvas.current || !wrap.current) return;
    const cv = canvas.current;
    const ctx = cv.getContext('2d')!;
    const pos = new Map<string, Smoothed>();
    const ball: Smoothed = { x: 0.5, y: 0.5 };
    let raf = 0;
    let last = performance.now();
    let lastHud = 0;
    tRef.current = 0;
    setDone(false);
    setAtPause(false);
    setPlaying(true);

    const fit = () => {
      const w = Math.max(320, Math.floor(wrap.current!.clientWidth));
      const h = Math.floor(w / PITCH_ASPECT);
      const dpr = window.devicePixelRatio || 1;
      cv.width = Math.floor(w * dpr); cv.height = Math.floor(h * dpr);
      cv.style.width = w + 'px'; cv.style.height = h + 'px';
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      return { w, h };
    };
    let size = fit();
    const ro = new ResizeObserver(() => { size = fit(); });
    ro.observe(wrap.current);

    const tick = (now: number) => {
      const dt = Math.min(64, now - last);
      last = now;
      const stopAt = tl.pauseT ?? tl.total - 1;
      const ff = ffRef.current;
      if (playRef.current && tRef.current < stopAt) {
        tRef.current = Math.min(ff ? Math.min(ff.target, stopAt) : stopAt, tRef.current + dt * (ff ? ff.factor : speedRef.current));
      }
      if (ff && tRef.current >= Math.min(ff.target, stopAt) - 1) { ffRef.current = null; setFfOn(false); }
      if (tl.pauseT !== null && tRef.current >= tl.pauseT - 1) { setAtPause(p => (p ? p : true)); }
      else if (tl.pauseT === null && tl.complete && tRef.current >= tl.total - 1) { setDone(d => (d ? d : true)); setPlaying(false); }
      const f = frameAt(tl, tRef.current);
      const k = 1 - Math.exp(-(dt / 1000) * 4.5 * Math.min(speedRef.current, 4));
      const seen = new Set<string>();
      for (const p of f.players) {
        seen.add(p.id);
        const q = pos.get(p.id);
        if (!q) pos.set(p.id, { x: p.x, y: p.y });
        else if (p.cast) { q.x = p.x; q.y = p.y; }
        else { q.x += (p.x - q.x) * k; q.y += (p.y - q.y) * k; }
      }
      for (const id of [...pos.keys()]) if (!seen.has(id)) pos.delete(id);
      const kb = 1 - Math.exp(-(dt / 1000) * 14);
      ball.x += (f.ball.x - ball.x) * kb; ball.y += (f.ball.y - ball.y) * kb;

      drawPitch(ctx, size.w, size.h, pal);
      drawFrame(ctx, size.w, size.h, f, pos, pal, ball);
      if (now - lastHud > 90) {
        lastHud = now;
        setHud(prev => (prev.minute === Math.floor(f.minute) && prev.h === f.score[0] && prev.a === f.score[1] ? prev : { minute: Math.floor(f.minute), h: f.score[0], a: f.score[1] }));
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => { cancelAnimationFrame(raf); ro.disconnect(); };
  }, [tl, pal]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (el && (el.tagName === 'INPUT' || el.tagName === 'SELECT' || el.tagName === 'TEXTAREA')) return;
      if (e.code === 'Space') { e.preventDefault(); setPlaying(p => !p); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // The moment you come on from the bench is announced once.
  useEffect(() => {
    if (!live || !meP || !entrance || !kicked || hud.minute < entrance || toastedFor.current === live) return;
    toastedFor.current = live;
    const off = replay?.players.find(p => p.side === meP.side && p.idx === meP.idx && p.off === meP.on && !p.human);
    setToast(`${entrance}' You come on${off ? ` for ${off.name}` : ''}`);
    window.setTimeout(() => setToast(null), 4500);
  }, [live, meP, entrance, kicked, hud.minute, replay]);

  if (!replay || !tl || !pal) {
    return <Panel title="Match"><p className="muted">No match to show yet. Press Continue to play the next matchday.</p></Panel>;
  }

  const home = clubOf(game, replay.h.clubId)!, away = clubOf(game, replay.a.clubId)!;
  const raw: Line[] = live ? [...live.lines].sort((a, b) => a.min - b.min) : (report?.lines ?? []);
  const goalLines = raw.filter(l => l.kind === 'goal-us' || l.kind === 'goal-them');
  const shown = raw.filter(l => (l.kind === 'goal-us' || l.kind === 'goal-them' ? goalLines.indexOf(l) < hud.h + hud.a : l.min < hud.minute || done)).reverse();
  const starters = (side: 'h' | 'a') => replay.players.filter(p => p.side === side && p.on === 0).sort((a, b) => a.idx - b.idx);
  const subs = (side: 'h' | 'a') => replay.players.filter(p => p.side === side && p.on > 0);
  const half = hud.minute < 45 ? '1st half' : hud.minute < 90 ? '2nd half' : 'Full time';
  const req: MomentRequest | null = live && live.status === 'decision' && atPause ? live.request : null;
  const choose = (id: string | undefined) => { setAtPause(false); setPlaying(true); chooseMoment(id); };
  const kickOff = () => {
    setKickedFor(live);
    // On the bench there is nothing to decide until you come on, so the first part of the match plays through quickly.
    if (live && entrance) {
      const target = Math.min(timeOfMinute(tl, Math.max(0, entrance - 1)), (tl.pauseT ?? tl.total) - 1);
      ffRef.current = { target, factor: Math.max(10, target / 2200) };
      setFfOn(true);
    }
  };
  const skipAhead = () => { if (ffRef.current) tRef.current = ffRef.current.target; };
  const leave = () => {
    if (live && live.status !== 'finished') {
      if (!window.confirm('Leave the match? The engine plays out the rest and makes your decisions.')) return;
      skipMatch();
      leaveMatch();
    } else if (live) leaveMatch();
    else go('schedule');
  };

  return (
    <div className="matchday">
      {live && !kicked && <PreMatch game={game} replay={replay} onKickOff={kickOff} />}
      {done && report && report.h === replay.h.clubId && report.a === replay.a.clubId && (
        <PostMatch game={game} report={report} onReport={() => { if (live) leaveMatch(); else go('schedule'); }}
          onAgain={() => { if (live) useStore.setState({ live: null }); setRun(r => r + 1); }}
          onContinue={() => { useStore.setState({ live: null }); go('overview'); }} />
      )}
      <div className="md-top">
        <span className="md-title">{live ? 'Matchday' : 'Replay'} <b>{clubOf(game, replay.h.clubId)!.short} v {clubOf(game, replay.a.clubId)!.short}</b></span>
        <button className="btn sm" onClick={leave}>{live && live.status !== 'finished' ? 'Leave match' : 'Close'}</button>
      </div>
    <div className="grid" style={{ gridTemplateColumns: 'minmax(0, 1fr) minmax(19rem, 24rem)' }}>
      <div className="stack">
        <div className="panel">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'center', gap: 16, padding: '10px 14px' }}>
            <span style={{ textAlign: 'right', fontWeight: 600, fontSize: '1.15rem', display: 'inline-flex', gap: 8, justifyContent: 'flex-end', alignItems: 'center' }}>{home.name}<Kit club={home} /></span>
            <span style={{ textAlign: 'center' }}>
              <span className="num" style={{ fontSize: '2.6rem', fontWeight: 800, lineHeight: 1.1 }}>{hud.h} - {hud.a}</span>
              <div className="muted num">{hud.minute}' · {half}</div>
            </span>
            <span style={{ fontWeight: 600, fontSize: '1.15rem', display: 'inline-flex', gap: 8, alignItems: 'center' }}><Kit club={away} />{away.name}</span>
          </div>
        </div>

        {live && kicked && meP && entrance && (ffOn || hud.minute < entrance) && (
          <div className="panel md-note">
            <span><b>You are on the bench.</b> {ffOn ? `The match plays through quickly to the ${entrance}th minute, when you come on.` : `You come on in the ${entrance}th minute.`}</span>
            <span style={{ marginLeft: 'auto', display: 'inline-flex', gap: 8 }}>
              {ffOn && <button className="btn sm" onClick={skipAhead}>Skip ahead</button>}
              <button className="btn sm" onClick={() => { ffRef.current = null; setFfOn(false); tRef.current = 0; }}>Watch from kick-off</button>
            </span>
          </div>
        )}
        <div ref={wrap} style={{ position: 'relative', width: '100%', maxWidth: `calc((100vh - 14rem) * ${PITCH_ASPECT.toFixed(3)})`, minWidth: 360, margin: '0 auto' }}>
          <canvas ref={canvas} style={{ display: 'block', borderRadius: 3, border: '1px solid var(--line)' }} aria-label="Match view" />
          {toast && <div className="md-toast" role="status">{toast}</div>}
        </div>

        {(
          <div className="panel">
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '8px 12px', flexWrap: 'wrap' }}>
              <button className="btn" style={{ minWidth: 84 }} onClick={() => { if (done) { if (live) useStore.setState({ live: null }); setRun(r => r + 1); } else setPlaying(p => !p); }}>{done ? 'Replay' : playing ? 'Pause' : 'Play'}</button>
              <div className="seg" role="group" aria-label="Speed">
                {SPEEDS.map(s => <button key={s} aria-pressed={speed === s} onClick={() => setSpeed(s)}>{s}x</button>)}
              </div>
              <button className="btn" onClick={() => { if (live && live.status !== 'finished') skipMatch(); tRef.current = tl.total - 1; }}>
                {live && live.status !== 'finished' ? 'Skip (engine decides)' : 'Skip to full time'}
              </button>
              <span style={{ marginLeft: 'auto', display: 'inline-flex', gap: 8, alignItems: 'center' }}>
                <span className="muted">Next match</span>
                <div className="seg" role="group" aria-label="Match mode">
                  {MODES.map(m => <button key={m.id} aria-pressed={matchMode === m.id} title={m.hint} onClick={() => setMatchMode(m.id)}>{m.label}</button>)}
                </div>
              </span>
            </div>
          </div>
        )}
      </div>

      <div className="stack">
        {req ? <DecisionCard req={req} onChoose={choose} /> : <Panel title="Commentary" flush>
          <div style={{ maxHeight: '22rem', overflow: 'auto' }}>
            <table><tbody>
              {shown.length === 0 && <tr><td className="l muted">Kick off.</td></tr>}
              {shown.map((l, i) => (
                <tr key={i} style={l.kind === 'you' ? { background: 'var(--accent-soft)' } : undefined}>
                  <td className="muted" style={{ width: '2.6rem' }}>{l.min}'</td>
                  <td className="l" style={{ whiteSpace: 'normal', fontWeight: l.kind.startsWith('goal') ? 600 : 400, color: l.kind === 'goal-them' ? 'var(--bad)' : l.kind === 'goal-us' ? 'var(--good)' : undefined }}>{l.text}</td>
                </tr>
              ))}
            </tbody></table>
          </div>
        </Panel>}
        {(['h', 'a'] as const).map(side => (
          <Panel key={side} title={side === 'h' ? home.name : away.name} right={side === 'h' ? replay.h.formation : replay.a.formation} flush>
            <table><tbody>
              {starters(side).map(p => <tr key={p.id} className={p.human ? 'me' : ''}><td style={{ width: '2rem' }}>{p.num}</td><td className="l">{p.name}</td><td>{POS_BY_ID[p.pos].label}</td></tr>)}
              {subs(side).map(p => <tr key={p.id} className={p.human ? 'me' : ''}><td className="muted" style={{ width: '2rem' }}>{p.num}</td><td className="l muted">{p.name} (on {p.on}')</td><td className="muted">{POS_BY_ID[p.pos].label}</td></tr>)}
            </tbody></table>
          </Panel>
        ))}
      </div>
    </div>
    </div>
  );
}
