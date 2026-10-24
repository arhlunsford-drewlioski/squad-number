import { CUP_NAME } from '../engine/career';
import { clubOf, type Game } from '../engine/game';
import type { MatchReport } from '../engine/match/report';
import type { Replay } from '../engine/match/replay';
import { ovrOf } from '../engine/player';
import { POS_BY_ID } from '../engine/positions';
import { ratingBand } from './ratingBand';
import { tableFor } from '../engine/table';
import { DIVISIONS } from '../engine/world';
import { Kit, Ovr } from './components';

const SHOOT = { less: 'Pass first', normal: 'Normal shooting', more: 'Shoot on sight' } as const;
const MOVE = { hold: 'Hold position', normal: 'Normal movement', roam: 'Run in behind' } as const;
const DEF = { drop: 'Drop off', normal: 'Normal defending', press: 'Close down' } as const;

/** Last five results for a club this season, oldest first. */
function form(game: Game, clubId: string): ('w' | 'd' | 'l')[] {
  const div = game.clubs.find(c => c.id === clubId)!.division;
  const out: ('w' | 'd' | 'l')[] = [];
  for (const rd of game.fixtures[div]) {
    const f = rd.find(x => x.h === clubId || x.a === clubId);
    if (!f || f.hg == null || f.ag == null) continue;
    const mine = f.h === clubId ? f.hg : f.ag, theirs = f.h === clubId ? f.ag : f.hg;
    out.push(mine > theirs ? 'w' : mine < theirs ? 'l' : 'd');
  }
  return out.slice(-5);
}

const ordinal = (n: number) => { const s = ['th', 'st', 'nd', 'rd'], v = n % 100; return n + (s[(v - 20) % 10] || s[v] || s[0]); };

/** The team sheet before kick-off: both elevens, where each club stands, and your part in it. */
export function PreMatch({ game, replay, onKickOff }: { game: Game; replay: Replay; onKickOff: () => void }) {
  const home = clubOf(game, replay.h.clubId)!, away = clubOf(game, replay.a.clubId)!;
  const me = replay.players.find(p => p.human) ?? null;
  const cup = game.cup.pending ? game.cup.rounds[game.cup.pending.round].name : null;
  const comp = cup ? `${CUP_NAME}, ${cup}` : `${DIVISIONS[home.division - 1].name}, matchday ${game.week}`;
  const byId = new Map(game.players.map(p => [p.id, p]));
  const start = me && me.on === 0;

  const side = (key: 'h' | 'a') => {
    const club = key === 'h' ? home : away;
    const team = key === 'h' ? replay.h : replay.a;
    const xi = replay.players.filter(p => p.side === key && p.on === 0).sort((a, b) => a.idx - b.idx);
    const bench = replay.players.filter(p => p.side === key && p.on > 0);
    const pos = tableFor(game, club.division).findIndex(r => r.id === club.id) + 1;
    return (
      <section className="panel md-side">
        <div className="ph"><span style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }}><Kit club={club} />{club.name}</span><span className="muted" style={{ fontWeight: 400 }}>{team.formation}</span></div>
        <div className="pb">
          <dl className="kv" style={{ marginBottom: 8 }}>
            <dt>Manager</dt><dd>{club.mgr.name}</dd>
            <dt>Squad level</dt><dd><Ovr v={club.rating} /></dd>
            <dt>League</dt><dd>{pos > 0 ? ordinal(pos) : '-'} in {DIVISIONS[club.division - 1].name}</dd>
            <dt>Form</dt><dd><span className="md-form">{form(game, club.id).map((r, i) => <i key={i} className={r}>{r.toUpperCase()}</i>)}{form(game, club.id).length === 0 && <span className="muted">-</span>}</span></dd>
          </dl>
        </div>
        <table>
          <tbody>
            {xi.map(p => {
              const pl = byId.get(p.id);
              return (
                <tr key={p.id} className={p.human ? 'me' : ''}>
                  <td style={{ width: '2rem' }} className="muted">{p.num}</td>
                  <td className="l">{p.name}{p.human ? <span className="pill" style={{ marginLeft: 8 }}>You</span> : null}</td>
                  <td>{POS_BY_ID[p.pos].label}</td>
                  <td style={{ width: '3rem' }}>{pl ? <Ovr v={ovrOf(pl)} /> : null}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <div className="pb">
          <span className="lbl">Bench</span>
          <div className="t2" style={{ marginTop: 4, fontSize: '0.92rem' }}>
            {bench.map(p => <span key={p.id} className={p.human ? 'you-chip' : ''} style={{ marginRight: 10, whiteSpace: 'nowrap' }}>{p.name}</span>)}
          </div>
        </div>
      </section>
    );
  };

  return (
    <div className="md-full">
      <div className="md-head">
        <div className="lbl">{comp}</div>
        <div className="md-big">{home.name} <span className="muted">v</span> {away.name}</div>
      </div>
      <div className="md-cols md-cols-3">
        {side('h')}
        <section className="panel md-you-panel">
          <div className="ph"><span>Your day</span></div>
          <div className="pb" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div className="md-role">{start ? 'In the starting eleven' : me ? 'On the bench' : 'Not in the squad'}</div>
            <p className="t2" style={{ lineHeight: 1.45 }}>
              {start ? <>You play at <b>{POS_BY_ID[me!.pos].long.toLowerCase()}</b>. Decisions come to you as the ball does. Choose well and your rating, confidence and the manager's trust rise.</>
                : me ? <>You are expected on around the <b>{me.on}th minute</b>. The first part of the match plays through quickly, then you get decisions once you are on.</>
                : <>You are not part of this match.</>}
            </p>
            <div>
              <span className="lbl">Your instructions</span>
              <div className="t2" style={{ marginTop: 4 }}>{SHOOT[game.instructions.shooting]} · {MOVE[game.instructions.movement]} · {DEF[game.instructions.defending]}</div>
            </div>
            <button className="btn primary md-go" autoFocus onClick={onKickOff}>Kick off</button>
            <span className="note" style={{ textAlign: 'center' }}>Press Enter</span>
          </div>
        </section>
        {side('a')}
      </div>
    </div>
  );
}

/** The summary at full time: the score, the goals, your own performance and where the rating came from. */
export function PostMatch({ game, report, onReport, onAgain, onContinue }: { game: Game; report: MatchReport; onReport: () => void; onAgain: () => void; onContinue: () => void }) {
  const home = clubOf(game, report.h)!, away = clubOf(game, report.a)!;
  const me = report.me;
  const goals = report.lines.filter(l => l.kind === 'goal-us' || l.kind === 'goal-them');
  const mine = report.mySide === 'h' ? report.hg : report.ag, theirs = report.mySide === 'h' ? report.ag : report.hg;
  const won = report.pens ? report.pens[report.mySide === 'h' ? 0 : 1] > report.pens[report.mySide === 'h' ? 1 : 0] : mine > theirs;
  const headline = report.result === 'w' ? 'Win' : report.result === 'l' ? 'Defeat' : report.pens ? (won ? 'Through on penalties' : 'Out on penalties') : 'Draw';
  const ds = report.moments ?? [];
  const wellN = ds.filter(m => m.tier === 'great' || m.tier === 'good').length;
  const t = report.team;
  const row = (label: string, h: string | number, a: string | number) => <tr><td className="num" style={{ textAlign: 'right', width: '34%' }}>{h}</td><td className="muted" style={{ textAlign: 'center' }}>{label}</td><td className="l num" style={{ width: '34%' }}>{a}</td></tr>;

  return (
    <div className="md-full">
      <div className="md-head">
        <div className="lbl">Full time · {report.division}</div>
        <div className="md-score">
          <span className="md-sc-team" style={{ justifyContent: 'flex-end' }}>{home.name}<Kit club={home} /></span>
          <span className="md-sc-num num">{report.hg} - {report.ag}</span>
          <span className="md-sc-team"><Kit club={away} />{away.name}</span>
        </div>
        <div className={'md-result ' + report.result}>{headline}{report.pens ? ` (${report.pens[0]}-${report.pens[1]} on penalties)` : ''}</div>
      </div>

      <div className="md-cols md-cols-3">
        <section className="panel">
          <div className="ph"><span>Goals</span></div>
          <table>
            <tbody>
              {goals.length === 0 && <tr><td className="l muted">No goals.</td></tr>}
              {goals.map((l, i) => (
                <tr key={i}>
                  <td className="muted" style={{ width: '2.6rem' }}>{l.min}'</td>
                  <td className="l" style={{ whiteSpace: 'normal', color: l.kind === 'goal-us' ? 'var(--good)' : 'var(--bad)', fontWeight: 600 }}>{l.text.replace(/^GOAL, /, '')}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {report.motm && <div className="pb t2">Player of the match: <b>{report.motm.name}</b> ({report.motm.club}), {report.motm.rating.toFixed(1)}</div>}
          <table style={{ borderTop: '1px solid var(--line)' }}>
            <tbody>
              {row('Possession', t.h.possession + '%', t.a.possession + '%')}
              {row('Shots', t.h.shots, t.a.shots)}
              {row('On target', t.h.onTarget, t.a.onTarget)}
              {row('Expected goals', t.h.xg.toFixed(2), t.a.xg.toFixed(2))}
            </tbody>
          </table>
        </section>

        <section className="panel md-you-panel">
          <div className="ph"><span>Your match</span>{me ? <span className="muted" style={{ fontWeight: 400 }}>{me.min} minutes{me.start ? '' : `, on at ${me.on}'`}</span> : null}</div>
          {me ? (
            <div className="pb" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <span className={`ovr lg ${ratingBand(me.rating)}`}>{me.rating.toFixed(1)}</span>
                <div className="t2">
                  {me.g > 0 ? `${me.g} goal${me.g > 1 ? 's' : ''}. ` : ''}{me.a > 0 ? `${me.a} assist${me.a > 1 ? 's' : ''}. ` : ''}
                  {me.sh} shot{me.sh === 1 ? '' : 's'} ({me.sot} on target), {me.kp} key pass{me.kp === 1 ? '' : 'es'}, {me.passOk} of {me.passes} passes, {me.tkWon} of {me.tk} tackles.
                </div>
              </div>
              {me.parts && (
                <table className="parts">
                  <tbody>
                    {me.parts.map(([label, v]) => <tr key={label}><td className="l">{label}</td><td className="num" style={{ color: v > 0 ? 'var(--good)' : 'var(--bad)', fontWeight: 600 }}>{v > 0 ? '+' : ''}{v.toFixed(2)}</td></tr>)}
                  </tbody>
                </table>
              )}
            </div>
          ) : <div className="pb muted">You did not play.</div>}
        </section>

        <section className="panel">
          <div className="ph"><span>Your decisions</span>{ds.length > 0 && <span className="muted" style={{ fontWeight: 400 }}>{wellN} of {ds.length} went well</span>}</div>
          <table className="decisions">
            <colgroup><col style={{ width: '2.6rem' }} /><col /><col style={{ width: '2.2rem' }} /></colgroup>
            <tbody>
              {ds.length === 0 && <tr><td className="l muted" colSpan={3}>No decisions this match.</td></tr>}
              {ds.map((m, i) => {
                const ok = m.tier === 'great' || m.tier === 'good';
                return (
                  <tr key={i}>
                    <td className="muted">{m.minute}'</td>
                    <td className="l"><b>{m.title}</b><div className="t2">{m.option}{m.auto ? ' (engine)' : ''}. {m.text}</div></td>
                    <td style={{ color: ok ? 'var(--good)' : 'var(--bad)', fontWeight: 700, fontSize: '1.2rem' }}>{ok ? '✓' : '✗'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>
      </div>

      <div className="md-actions">
        <button className="btn" onClick={onAgain}>Watch again</button>
        <button className="btn" onClick={onReport}>Full match report</button>
        <button className="btn primary md-go" autoFocus onClick={onContinue}>Continue</button>
      </div>
    </div>
  );
}
