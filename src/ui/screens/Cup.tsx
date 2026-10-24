import { useState } from 'react';
import { clubOf, humanOf } from '../../engine/game';
import { CUP_NAME } from '../../engine/career';
import type { CupTie } from '../../engine/career';
import { useStore } from '../../state/store';
import { ClubLink, Kit, Panel } from '../components';

function Tie({ tie, mine, game }: { tie: CupTie; mine: boolean; game: ReturnType<typeof useStore.getState>['game'] & object }) {
  const h = clubOf(game, tie.h)!, a = clubOf(game, tie.a)!;
  const done = tie.winner !== null;
  const cell = (c: typeof h, won: boolean) => <span style={{ display: 'inline-flex', gap: 6, alignItems: 'center', fontWeight: done && won ? 700 : 400, color: done && !won ? 'var(--muted)' : undefined }}><Kit club={c} /><ClubLink id={c.id}>{c.name}</ClubLink></span>;
  return (
    <tr className={mine ? 'me' : ''}>
      <td className="l">{cell(h, tie.winner === tie.h)}</td>
      <td className="num" style={{ textAlign: 'center' }}>{done ? `${tie.hg} - ${tie.ag}` : 'v'}</td>
      <td className="l">{cell(a, tie.winner === tie.a)}</td>
      <td className="muted">{tie.pens ? `${tie.pens[0]}-${tie.pens[1]} on pens` : tie.neutral ? 'neutral' : ''}</td>
    </tr>
  );
}

export function Cup() {
  const game = useStore(s => s.game)!;
  const watch = useStore(s => s.watchReport);
  const cup = game.cup;
  const me = humanOf(game);
  const club = clubOf(game, me.clubId)!;
  const firstOpen = Math.max(0, cup.rounds.findIndex(r => r.ties.length === 0 || r.ties.some(t => !t.winner)));
  const [sel, setSel] = useState<number | null>(null);
  const shown = sel ?? (cup.winner ? cup.rounds.length - 1 : firstOpen);
  const round = cup.rounds[shown];
  const winner = cup.winner ? clubOf(game, cup.winner) : null;
  const myTie = (r: typeof round) => r.ties.find(t => t.h === club.id || t.a === club.id);
  const hasReport = game.reports.some(r => r.comp === 'cup' && r.week === 100 + shown && r.season === game.season);
  const status = winner ? `Won by ${winner.name}` : cup.outAt !== null ? `Your club went out in the ${cup.rounds[cup.outAt].name}` : cup.pending ? `Your tie in the ${cup.rounds[cup.pending.round].name} is next` : 'Your club is still in';

  return (
    <div className="grid" style={{ gridTemplateColumns: 'minmax(240px, 300px) 1fr' }}>
      <div className="stack">
        <Panel title={CUP_NAME} right={`Season ${game.season}`}>
          <p className="t2" style={{ marginBottom: 8 }}>{status}.</p>
          <p className="note">Every club in the four divisions enters. The 48 strongest skip the preliminary round. Level after 90 minutes goes to penalties. The semi-finals and the final are at neutral grounds.</p>
        </Panel>
        <Panel title="Rounds" flush>
          <table>
            <tbody>
              {cup.rounds.map((r, i) => {
                const mine = myTie(r);
                const state = r.ties.length === 0 ? `After matchday ${r.after}` : r.ties.every(t => t.winner) ? (mine ? (mine.winner === club.id ? 'Through' : 'Out') : cup.outAt !== null && cup.outAt < i ? '' : 'Played') : 'To play';
                return (
                  <tr key={r.name} className={'click' + (i === shown ? ' me' : '')} onClick={() => setSel(i)}>
                    <td className="l">{r.name}</td><td className="muted">{state}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Panel>
      </div>
      <Panel title={round.name} right={hasReport ? <button className="btn sm" onClick={() => watch(game.season, 100 + shown)}>Watch your tie</button> : `After matchday ${round.after}`} flush>
        {round.ties.length === 0 ? (
          <div className="pb"><p className="muted">The draw is made once the previous round is finished.</p></div>
        ) : (
          <div style={{ maxHeight: 'calc(100vh - 9rem)', overflow: 'auto' }}>
            {round.byes.length > 0 && <p className="note" style={{ padding: '8px 12px' }}>{round.byes.length} clubs have a bye to the next round.</p>}
            <table>
              <tbody>
                {[...round.ties].sort((a, b) => Number(!!myTie({ ...round, ties: [b] })) - Number(!!myTie({ ...round, ties: [a] }))).map((t, i) => <Tie key={i} tie={t} mine={t.h === club.id || t.a === club.id} game={game} />)}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  );
}
