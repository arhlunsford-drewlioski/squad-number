import { useState } from 'react';
import { fmtMoney, marketValue, wageBill, weeklyIncome } from '../../engine/economy';
import { clubOf, humanOf } from '../../engine/game';
import { windowOf } from '../../engine/market/transfers';
import { POS_BY_ID } from '../../engine/positions';
import { ovrOf } from '../../engine/player';
import { useStore } from '../../state/store';
import { ClubLink, Ovr, Panel, PlayerLink } from '../components';
import { useSort } from '../useSort';

type Tab = 'window' | 'deals' | 'free';
const KIND: Record<string, string> = { transfer: 'Transfer', loan: 'Loan', free: 'Free signing', release: 'Released', retired: 'Retired' };

export function Transfers() {
  const game = useStore(s => s.game)!;
  const select = useStore(s => s.selectPlayer);
  const me = humanOf(game);
  const club = clubOf(game, me.clubId)!;
  const [tab, setTab] = useState<Tab>('window');
  const [filter, setFilter] = useState<'all' | 'mine' | 'big'>('all');
  const win = windowOf(game.week);
  const alive = new Set(game.players.map(p => p.id));
  const who = (d: { playerId: string; name: string }) => (alive.has(d.playerId) ? <PlayerLink id={d.playerId}>{d.name}</PlayerLink> : <>{d.name}</>);
  const name = (id: string | null) => (id ? <ClubLink id={id}>{game.clubs.find(c => c.id === id)?.short ?? '?'}</ClubLink> : <>Free agent</>);
  const nextWindow = (() => {
    for (let w = game.week + 1; w <= 38; w++) if (windowOf(w)) return w - game.week;
    return null;
  })();
  const mine = game.deals.filter(d => d.from === club.id || d.to === club.id);
  const deals = game.deals.filter(d => filter === 'all' ? true : filter === 'mine' ? d.from === club.id || d.to === club.id : d.ovr >= 65 || d.fee >= 1e6);
  const free = game.players.filter(p => p.clubId === null && !p.human).sort((a, b) => marketValue(b) - marketValue(a)).slice(0, 40);
  const income = weeklyIncome(game, club.id), bill = wageBill(game, club.id);
  const dealSort = useSort(deals.slice(0, 200), { when: d => d.season * 100 + d.week, name: d => d.name, ovr: d => d.ovr, kind: d => d.kind, fee: d => d.fee }, 'when');
  const freeSort = useSort(free, { pos: p => POS_BY_ID[p.position].label, name: p => p.name, age: p => p.age, ovr: p => ovrOf(p), wage: p => p.wage, value: p => marketValue(p) }, 'ovr');

  return (
    <Panel title="Transfers" right={win ? <b style={{ color: 'var(--good)' }}>Window open</b> : 'Window closed'} flush>
      <div className="tabs">
        <button aria-pressed={tab === 'window'} onClick={() => setTab('window')}>Your club</button>
        <button aria-pressed={tab === 'deals'} onClick={() => setTab('deals')}>Latest deals</button>
        <button aria-pressed={tab === 'free'} onClick={() => setTab('free')}>Free agents</button>
      </div>

      {tab === 'window' && (
        <div className="pb">
          <div className="grid" style={{ gridTemplateColumns: 'minmax(260px, 360px) 1fr' }}>
            <div className="stack">
              <dl className="kv">
                <dt>Window</dt><dd>{win ? `${win === 'summer' ? 'Summer' : 'January'}, open now` : nextWindow ? `Opens in ${nextWindow} matchday${nextWindow === 1 ? '' : 's'}` : 'Opens in the summer'}</dd>
                <dt>Transfer funds</dt><dd className="num" style={{ color: club.funds < 0 ? 'var(--bad)' : undefined }}>{fmtMoney(club.funds)}</dd>
                <dt>Income each week</dt><dd className="num">{fmtMoney(income)}</dd>
                <dt>Wages each week</dt><dd className="num">{fmtMoney(bill)}</dd>
                <dt>Your wage</dt><dd className="num">{game.contract ? fmtMoney(game.contract.wage) : '-'}</dd>
              </dl>
              <p className="note">Windows are the first three matchdays and matchdays 19 to 23. Clubs buy, sell and loan in those weeks and in the summer rush before the season starts. Offers for you arrive as events.</p>
            </div>
            <div>
              <div className="muted" style={{ marginBottom: 6 }}>Your club's recent business</div>
              {mine.length === 0 ? <p className="muted">Nothing yet.</p> : (
                <table>
                  <thead><tr><th>S/MD</th><th className="l">Player</th><th className="l">Type</th><th className="l">Move</th><th>Fee</th></tr></thead>
                  <tbody>
                    {mine.slice(0, 12).map((d, i) => (
                      <tr key={i}><td>{d.season}/{d.week}</td><td className="l">{who(d)} <Ovr v={d.ovr} /></td><td className="l">{KIND[d.kind]}</td><td className="l">{name(d.from)} to {name(d.to)}</td><td className="num">{d.fee ? fmtMoney(d.fee) : '-'}</td></tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}

      {tab === 'deals' && (
        <>
          <div style={{ padding: '8px 12px' }} className="seg" role="group" aria-label="Filter">
            {([['all', 'All'], ['mine', 'Your club'], ['big', 'Big names']] as const).map(([id, l]) => <button key={id} aria-pressed={filter === id} onClick={() => setFilter(id)}>{l}</button>)}
          </div>
          <table>
            <thead><tr>{dealSort.th('when', 'S/MD')}{dealSort.th('name', 'Player', true)}{dealSort.th('ovr', 'OVR')}{dealSort.th('kind', 'Type', true)}<th className="l">From</th><th className="l">To</th>{dealSort.th('fee', 'Fee')}</tr></thead>
            <tbody>
              {dealSort.rows.slice(0, 80).map((d, i) => (
                <tr key={i} className={d.from === club.id || d.to === club.id ? 'me' : ''}>
                  <td>{d.season}/{d.week}</td><td className="l">{who(d)}</td><td><Ovr v={d.ovr} /></td><td className="l">{KIND[d.kind]}</td>
                  <td className="l">{name(d.from)}</td><td className="l">{name(d.to)}</td><td className="num">{d.fee ? fmtMoney(d.fee) : '-'}</td>
                </tr>
              ))}
              {deals.length === 0 && <tr><td className="l muted" colSpan={7}>No deals yet.</td></tr>}
            </tbody>
          </table>
        </>
      )}

      {tab === 'free' && (
        <table>
          <thead><tr>{freeSort.th('pos', 'Pos', true)}{freeSort.th('name', 'Player', true)}{freeSort.th('age', 'Age')}{freeSort.th('ovr', 'OVR')}{freeSort.th('wage', 'Wage ask')}{freeSort.th('value', 'Value')}</tr></thead>
          <tbody>
            {freeSort.rows.map(p => (
              <tr key={p.id} className="click" onClick={() => select(p.id)}>
                <td className="l">{POS_BY_ID[p.position].label}</td><td className="l">{p.name}</td><td>{p.age}</td><td><Ovr v={ovrOf(p)} /></td>
                <td className="num">{fmtMoney(p.wage)} wk</td><td className="num">{fmtMoney(marketValue(p))}</td>
              </tr>
            ))}
            {free.length === 0 && <tr><td className="l muted" colSpan={6}>No free agents right now.</td></tr>}
          </tbody>
        </table>
      )}
    </Panel>
  );
}
