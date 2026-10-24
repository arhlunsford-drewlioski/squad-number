import { humanOf } from '../../engine/game';
import { ovrOf } from '../../engine/player';
import { POS_BY_ID } from '../../engine/positions';
import { ovrAt } from '../../engine/rating';
import { DIVISIONS } from '../../engine/world';
import { useStore } from '../../state/store';
import { Kit, money, Ovr, Panel } from '../components';

export function Offers() {
  const game = useStore(s => s.game)!;
  const choose = useStore(s => s.chooseOffer);
  const me = humanOf(game);

  return (
    <div style={{ height: '100%', overflow: 'auto', padding: 12 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, margin: '2px 2px 12px' }}>
        <h1 style={{ fontSize: 18 }}>Contract offers</h1>
        <span className="muted">{me.name}, {POS_BY_ID[me.position].long.toLowerCase()}, age {me.age}, rated <Ovr v={ovrOf(me)} />. Three clubs want to sign you.</span>
      </div>
      <div className="stack">
        {game.offers.map((o, i) => {
          const club = game.clubs.find(c => c.id === o.clubId)!;
          const rivals = game.players
            .filter(p => p.clubId === club.id && p.position === me.position)
            .sort((a, b) => ovrAt(b.attrs, b.position) - ovrAt(a.attrs, a.position));
          return (
            <Panel key={club.id} title={<span style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }}><Kit club={club} />{club.name}</span>} right={DIVISIONS[club.division - 1].name}>
              <div className="grid" style={{ gridTemplateColumns: '260px 1fr auto' }}>
                <dl className="kv">
                  <dt>Role offered</dt><dd>{o.role}</dd>
                  <dt>Wage</dt><dd className="num">{money(o.wage)} a week</dd>
                  <dt>Contract</dt><dd>{o.years} seasons</dd>
                  <dt>Squad level</dt><dd><Ovr v={club.rating} /></dd>
                </dl>
                <div style={{ maxWidth: 420 }}>
                  <div className="muted" style={{ marginBottom: 4 }}>Your competition at {POS_BY_ID[me.position].long.toLowerCase()}</div>
                  <table>
                    <tbody>
                      {rivals.map(r => (
                        <tr key={r.id}><td className="l">{r.name}</td><td>{r.age}</td><td><Ovr v={ovrOf(r)} /></td></tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <button className="btn primary" onClick={() => choose(i)}>Sign for {club.short}</button>
              </div>
            </Panel>
          );
        })}
      </div>
    </div>
  );
}
