import { useState } from 'react';
import { clubOf, humanOf, WEEKS } from '../../engine/game';
import type { MatchReport, ReportRow } from '../../engine/match/report';
import { POS_BY_ID } from '../../engine/positions';
import { RATING_BASE } from '../../engine/match/sim';
import { useStore } from '../../state/store';
import { Kit, Panel } from '../components';

import { ratingBand } from '../ratingBand';
const Rating = ({ r }: { r: number }) => <span className={`ovr ${ratingBand(r)}`}>{r.toFixed(1)}</span>;

function RatingsTable({ rows, title }: { rows: ReportRow[]; title: string }) {
  return (
    <Panel title={title} flush>
      <table className="ratings">
        <colgroup><col style={{ width: '2.8rem' }} /><col /><col style={{ width: '2.8rem' }} /><col style={{ width: '2rem' }} /><col style={{ width: '2rem' }} /><col style={{ width: '4.2rem' }} /></colgroup>
        <thead><tr><th className="l">Pos</th><th className="l">Player</th><th>Min</th><th>G</th><th>A</th><th>Rating</th></tr></thead>
        <tbody>
          {rows.map(r => (
            <tr key={r.id} className={r.human ? 'me' : ''}>
              <td className="l">{POS_BY_ID[r.pos].label}</td>
              <td className="l">{r.name}{r.sub ? <span className="muted"> (sub)</span> : null}{r.yellow ? <span style={{ color: 'var(--warn)' }}> ▮</span> : null}{r.red ? <span style={{ color: 'var(--bad)' }}> ▮</span> : null}</td>
              <td>{r.min}</td><td>{r.g || ''}</td><td>{r.a || ''}</td><td><Rating r={r.rating} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </Panel>
  );
}

function Report({ rep }: { rep: MatchReport }) {
  const game = useStore(s => s.game)!;
  const watchReport = useStore(s => s.watchReport);
  const home = clubOf(game, rep.h)!, away = clubOf(game, rep.a)!;
  const t = rep.team;
  const stat = (label: string, h: string | number, a: string | number) => (
    <tr><td style={{ textAlign: 'right', width: '38%' }}>{h}</td><td className="muted" style={{ textAlign: 'center' }}>{label}</td><td className="l" style={{ width: '38%' }}>{a}</td></tr>
  );
  const me = rep.me;
  return (
    <div className="stack">
      <Panel title={rep.comp === 'cup' ? rep.division : `${rep.division}, matchday ${rep.week}`} right={<span><button className="btn sm" onClick={() => watchReport(rep.season, rep.week)}>Watch highlights</button> <span style={{ marginLeft: 8 }}>{rep.formation.h} v {rep.formation.a}</span></span>}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'center', gap: 16, fontSize: '1.25rem', fontWeight: 600 }}>
          <span style={{ textAlign: 'right', display: 'inline-flex', gap: 8, justifyContent: 'flex-end', alignItems: 'center' }}>{home.name}<Kit club={home} /></span>
          <span className="num" style={{ fontSize: '1.75rem' }}>{rep.hg} - {rep.ag}</span>
          <span style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }}><Kit club={away} />{away.name}</span>
        </div>
        {rep.pens && <p className="t2" style={{ textAlign: 'center', marginTop: 6 }}>{rep.pens[0] > rep.pens[1] ? home.name : away.name} won {Math.max(...rep.pens)}-{Math.min(...rep.pens)} on penalties</p>}
        {rep.motm && <p className="note" style={{ textAlign: 'center', marginTop: 8 }}>Player of the match: {rep.motm.name} ({rep.motm.club}), <Rating r={rep.motm.rating} /></p>}
      </Panel>

      <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(23rem, 1fr))' }}>
        <div className="stack">
          <Panel title="Your match">
            <p style={{ marginBottom: 10 }}>{rep.note}</p>
            {me ? (
              <dl className="kv">
                <dt>Rating</dt><dd><Rating r={me.rating} /></dd>
                <dt>Minutes</dt><dd className="num">{me.min}{me.start ? ' (started)' : ` (on ${me.on}')`}</dd>
                <dt>Goals / assists</dt><dd className="num">{me.g} / {me.a}</dd>
                <dt>Shots (on target)</dt><dd className="num">{me.sh} ({me.sot})</dd>
                <dt>Key passes</dt><dd className="num">{me.kp}</dd>
                <dt>Passes</dt><dd className="num">{me.passOk} of {me.passes}</dd>
                <dt>Tackles won</dt><dd className="num">{me.tkWon} of {me.tk}</dd>
                <dt>Interceptions</dt><dd className="num">{me.int}</dd>
                {me.sv > 0 && <><dt>Saves</dt><dd className="num">{me.sv}</dd></>}
              </dl>
            ) : <p className="muted">You did not play.</p>}
            {me?.parts && (
              <div style={{ marginTop: 12 }}>
                <div className="lbl" style={{ marginBottom: 4 }}>Where your {me.rating.toFixed(1)} came from</div>
                <table className="parts">
                  <tbody>
                    <tr><td className="l muted">Starting point</td><td className="num">{RATING_BASE.toFixed(2)}</td></tr>
                    {me.parts.map(([label, v]) => (
                      <tr key={label}><td className="l">{label}</td><td className="num" style={{ color: v > 0 ? 'var(--good)' : 'var(--bad)', fontWeight: 600 }}>{v > 0 ? '+' : ''}{v.toFixed(2)}</td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>
          {(rep.moments?.length ?? 0) > 0 && (
            <Panel title="Your decisions" flush>
              <table className="decisions">
                <colgroup><col style={{ width: '3rem' }} /><col style={{ width: '26%' }} /><col style={{ width: '30%' }} /><col /></colgroup>
                <thead><tr><th>Min</th><th className="l">Moment</th><th className="l">You chose</th><th className="l">Result</th></tr></thead>
                <tbody>
                  {rep.moments!.map((m, i) => (
                    <tr key={i}>
                      <td>{m.minute}'</td><td className="l">{m.title}</td>
                      <td className="l">{m.option}{m.auto ? <span className="muted"> (engine)</span> : null}</td>
                      <td className="l" style={{ whiteSpace: 'normal', color: m.tier === 'great' || m.tier === 'good' ? 'var(--good)' : 'var(--bad)' }}>{m.text}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Panel>
          )}
          <Panel title="Team stats" flush>
            <table><tbody>
              {stat('Possession', t.h.possession + '%', t.a.possession + '%')}
              {stat('Shots', t.h.shots, t.a.shots)}
              {stat('On target', t.h.onTarget, t.a.onTarget)}
              {stat('Expected goals', t.h.xg.toFixed(2), t.a.xg.toFixed(2))}
              {stat('Fouls', t.h.fouls, t.a.fouls)}
              {stat('Yellow cards', t.h.yellow, t.a.yellow)}
              {stat('Red cards', t.h.red, t.a.red)}
            </tbody></table>
          </Panel>
        </div>
        <Panel title="Match events" flush>
          <table><tbody>
            {rep.lines.length === 0 && <tr><td className="l muted">Nothing to report.</td></tr>}
            {rep.lines.map((l, i) => (
              <tr key={i} style={l.kind === 'you' ? { background: 'var(--accent-soft)' } : undefined}>
                <td className="muted" style={{ width: '3rem' }}>{l.min}'</td>
                <td className="l" style={{ whiteSpace: 'normal', fontWeight: l.kind === 'goal-us' || l.kind === 'goal-them' ? 600 : 400, color: l.kind === 'goal-them' ? 'var(--bad)' : l.kind === 'goal-us' ? 'var(--good)' : undefined }}>{l.text}</td>
              </tr>
            ))}
          </tbody></table>
        </Panel>
      </div>

      <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(21.5rem, 1fr))' }}>
        <RatingsTable rows={rep.ratings.h} title={home.name} />
        <RatingsTable rows={rep.ratings.a} title={away.name} />
      </div>
    </div>
  );
}

export function Schedule() {
  const game = useStore(s => s.game)!;
  const me = humanOf(game);
  const club = clubOf(game, me.clubId)!;
  const [sel, setSel] = useState<number | null>(null);
  const shown = sel ?? game.reports[0]?.week ?? null;
  const rep = game.reports.find(r => r.week === shown && r.season === game.season) ?? null;

  const rows = Array.from({ length: WEEKS }, (_, i) => {
    const f = game.fixtures[club.division][i].find(x => x.h === club.id || x.a === club.id)!;
    const home = f.h === club.id;
    const opp = clubOf(game, home ? f.a : f.h)!;
    const gf = home ? f.hg : f.ag, ga = home ? f.ag : f.hg;
    const res = gf == null || ga == null ? null : gf > ga ? 'W' : gf < ga ? 'L' : 'D';
    return { week: i + 1, home, opp, gf, ga, res };
  });

  return (
    <div className="grid" style={{ gridTemplateColumns: 'minmax(18rem, 19rem) minmax(0, 1fr)' }}>
      <Panel title="Fixtures and results" right={`Season ${game.season}`} flush>
        <div style={{ maxHeight: 'calc(100vh - 8rem)', overflow: 'auto' }}>
          <table className="fixtures">
            <colgroup><col style={{ width: '2.6rem' }} /><col /><col style={{ width: '2.6rem' }} /><col style={{ width: '5.2rem' }} /></colgroup>
            <thead><tr><th>MD</th><th className="l">Opponent</th><th>H/A</th><th>Result</th></tr></thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.week} className={'click' + (r.week === shown ? ' me' : '')} onClick={() => setSel(r.week)}>
                  <td>{r.week}</td>
                  <td className="l" title={r.opp.name}><Kit club={r.opp} /> {r.opp.name}</td>
                  <td>{r.home ? 'H' : 'A'}</td>
                  <td>{r.res ? <b style={{ color: r.res === 'W' ? 'var(--good)' : r.res === 'L' ? 'var(--bad)' : 'var(--text-2)' }}>{r.res} {r.gf}-{r.ga}</b> : <span className="muted">-</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
      {rep ? <Report rep={rep} /> : <Panel title="Match report"><p className="muted">{shown ? 'Only the last eight match reports are kept.' : 'No matches played yet. Press Continue to play matchday 1.'}</p></Panel>}
    </div>
  );
}
