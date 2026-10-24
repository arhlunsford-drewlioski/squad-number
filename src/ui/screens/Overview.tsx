import { ATTR_BY_ID } from '../../engine/attributes';
import { clubOf, humanOf, lineupCtx, roleAt } from '../../engine/game';
import { ovrOf } from '../../engine/player';
import { keyAttrs, POS_BY_ID } from '../../engine/positions';
import { DIVISIONS } from '../../engine/world';
import { CUP_NAME } from '../../engine/career';
import { newsFeed, todayNotes } from '../../engine/news';
import { useStore } from '../../state/store';
import { AttrNum, ClubLink, Kit, money, Ovr, Panel } from '../components';
import { tableFor } from '../../engine/table';
import { bestLineup, explainSelection, statusIn } from '../../engine/match/lineup';
import { PROGRAMME_BY_ID } from '../../engine/training';

export function Overview() {
  const game = useStore(s => s.game)!;
  const go = useStore(s => s.go);
  const next = useStore(s => s.next);
  const me = humanOf(game);
  const club = clubOf(game, me.clubId)!;
  const div = DIVISIONS[club.division - 1];
  const cupTie = game.cup.pending ? game.cup.rounds[game.cup.pending.round].ties[game.cup.pending.tie] : null;
  const fx = cupTie ?? game.fixtures[club.division][game.week - 1]?.find(f => f.h === club.id || f.a === club.id);
  const home = fx?.h === club.id;
  const opp = fx ? clubOf(game, home ? fx.a : fx.h) : null;
  const table = tableFor(game, club.division);
  const pos = table.findIndex(r => r.id === club.id) + 1;
  const first = Math.min(Math.max(0, pos - 4), table.length - 7);
  const near = table.slice(first, first + 7);
  const lctx = lineupCtx(game);
  const L = bestLineup(game.players, club.id, lctx);
  const st = statusIn(L, me, lctx);
  const outlook = `${{ start: 'Expected to start.', bench: 'Expected on the bench.', out: 'Expected to be left out.', injured: 'Injured.', suspended: 'Suspended.', rested: 'Resting.' }[st]} ${explainSelection(L, me, game.players, 'The manager', lctx)}`;

  return (
    <div className="grid g-overview">
      <div className="stack">
        <div className="ov ov-today"><Panel title="Today" right={<button className="btn sm" onClick={() => go('news')}>All news</button>}>
          {(() => {
            const notes = todayNotes(game);
            const news = newsFeed(game).slice(0, 4);
            return (
              <>
                {notes.length > 0 ? <ul style={{ margin: 0, paddingLeft: 18 }}>{notes.map((n, i) => <li key={i}>{n}</li>)}</ul> : <p className="muted">Nothing needs your attention.</p>}
                {news.length > 0 && <div style={{ marginTop: 10, borderTop: '1px solid var(--line)', paddingTop: 8 }}>{news.map(n => <div key={n.key} className="t2" style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}><span>{n.title}</span><span className="muted">MD{n.week}</span></div>)}</div>}
              </>
            );
          })()}
        </Panel></div>
        {game.event && (<div className="ov ov-event">
          <Panel title="Decision needed" right={<button className="btn primary sm" onClick={() => go('event')}>Respond</button>}>
            <p className="t2">Something has come up and it needs an answer before you can play on.</p>
          </Panel></div>
        )}
        <div className="ov ov-next"><Panel title="Next match" right={cupTie ? `Cup, before matchday ${game.week}` : `Matchday ${game.week} of 38`}>
          {opp ? (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 15, fontWeight: 600 }}>
                <Kit club={opp} /><ClubLink id={opp.id}>{opp.name}</ClubLink><span className="muted" style={{ fontWeight: 400 }}>{cupTie?.neutral ? 'neutral ground' : home ? 'home' : 'away'}</span>
              </div>
              <dl className="kv" style={{ marginTop: 10 }}>
                <dt>Competition</dt><dd>{cupTie ? `${CUP_NAME}, ${game.cup.rounds[game.cup.pending!.round].name}` : div.name}</dd>
                <dt>Their squad level</dt><dd><Ovr v={opp.rating} /></dd>
                <dt>Your squad level</dt><dd><Ovr v={club.rating} /></dd>
              </dl>
            </>
          ) : <p className="muted">No fixture.</p>}
          <button className="btn primary show-m hero-play" onClick={next}>{cupTie ? 'Play cup tie' : 'Play matchday'}</button>
        </Panel></div>
      </div>

      <div className="stack">
        <div className="ov ov-player"><Panel title={me.name} right={<button className="btn sm" onClick={() => go('player')}>Full profile</button>}>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 10 }}>
            <Ovr v={ovrOf(me)} lg />
            <div className="t2">{POS_BY_ID[me.position].long}, age {me.age}</div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2px 18px' }}>
            {keyAttrs(me.position, 8).map(id => (
              <div key={id} style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span className="t2">{ATTR_BY_ID[id].label}</span><AttrNum v={me.attrs[id]} />
              </div>
            ))}
          </div>
        </Panel></div>
        <div className="ov ov-train"><Panel title="Training this week" right={<button className="btn sm" onClick={() => go('training')}>Change</button>}>
          {game.training.sessions.map((t, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Session {i + 1}</span>
              <span className="t2">{t.programme === 'rest' ? 'Rest' : `${PROGRAMME_BY_ID[t.programme].label}, ${t.intensity}`}</span>
            </div>
          ))}
          {game.training.focus && <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Focus</span><span className="t2">{ATTR_BY_ID[game.training.focus].label}</span></div>}
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6 }}><span className="muted">Condition</span><span className="num">{Math.round(me.condition)}%</span></div>
        </Panel></div>
      </div>

      <div className="stack">
      <div className="ov ov-table"><Panel title={div.name} right={`Position ${pos}`} flush>
        <table>
          <thead><tr><th>#</th><th className="l">Club</th><th>P</th><th>GD</th><th>Pts</th></tr></thead>
          <tbody>
            {near.map(r => (
              <tr key={r.id} className={r.id === club.id ? 'me' : ''}>
                <td>{table.indexOf(r) + 1}</td>
                <td className="l">{game.clubs.find(x => x.id === r.id)!.name}</td>
                <td>{r.p}</td><td>{r.gf - r.ga}</td><td><b>{r.pts}</b></td>
              </tr>
            ))}
          </tbody>
        </table>
      </Panel></div>
        <div className="ov ov-role"><Panel title="Your role" right={roleAt(game.players, club.id, me)}>
          <dl className="kv">
            <dt>Position</dt><dd>{POS_BY_ID[me.position].long}</dd>
            <dt>Status</dt><dd>{me.suspended > 0 ? `Suspended, ${me.suspended} match${me.suspended === 1 ? '' : 'es'}` : me.injuredWeeks > 0 ? `Injured, ${me.injuredWeeks} week${me.injuredWeeks === 1 ? '' : 's'}` : 'Fit'}</dd>
            {game.loan && <><dt>On loan from</dt><dd>{clubOf(game, game.loan.from)!.name}</dd></>}
            <dt>Wage</dt><dd className="num">{game.contract ? money(game.contract.wage) + ' a week' : '-'}</dd>
            <dt>Contract</dt><dd>{game.contract ? `${game.contract.years} season${game.contract.years === 1 ? '' : 's'}` : '-'}</dd>
          </dl>
          <p className="t2" style={{ marginTop: 8 }}>{outlook}</p>
        </Panel></div>
      </div>
    </div>
  );
}
