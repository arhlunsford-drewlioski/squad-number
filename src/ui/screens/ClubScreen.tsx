import { fmtMoney, marketValue, wageBill, weeklyIncome } from '../../engine/economy';
import { clubOf, humanOf } from '../../engine/game';
import { styleWord } from '../../engine/market/managers';
import { ovrOf } from '../../engine/player';
import { POS_BY_ID } from '../../engine/positions';
import { DIVISIONS } from '../../engine/world';
import { useStore } from '../../state/store';
import { Kit, Ovr, Panel, PlayerLink } from '../components';
import { useSort } from '../useSort';

export function ClubScreen() {
  const game = useStore(s => s.game)!;
  const select = useStore(s => s.selectPlayer);
  const go = useStore(s => s.go);
  const me = humanOf(game);
  const shownId = useStore(s => s.selectedClubId);
  const club = clubOf(game, shownId ?? me.clubId) ?? clubOf(game, me.clubId)!;
  const own = club.id === me.clubId;
  const div = DIVISIONS[club.division - 1];
  const income = weeklyIncome(game, club.id), bill = wageBill(game, club.id);
  const squad = game.players.filter(p => p.clubId === club.id).sort((a, b) => b.wage - a.wage);
  const wageSort = useSort(squad, { pos: p => POS_BY_ID[p.position].label, name: p => p.name, age: p => p.age, ovr: p => ovrOf(p), wage: p => p.wage, years: p => p.contractYears, value: p => (p.human ? 0 : marketValue(p)) }, 'wage');
  const m = club.mgr;
  const tenure = game.season === m.since ? Math.max(0, game.week - m.week) : (game.season - m.since) * 38 + game.week - m.week;
  const rich = club.wealth >= 1.15 ? 'Wealthy' : club.wealth >= 0.95 ? 'Comfortable' : 'Tight';
  const rank = [...game.clubs].filter(c => c.division === club.division).sort((a, b) => b.funds - a.funds).findIndex(c => c.id === club.id) + 1;

  return (
    <div className="grid" style={{ gridTemplateColumns: 'minmax(280px, 380px) 1fr' }}>
      <div className="stack">
        <Panel title={<span style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }}><Kit club={club} />{club.name}{own ? '' : <button className="btn sm" onClick={() => go('club')}>Your club</button>}</span>} right={div.name}>
          <dl className="kv">
            <dt>Squad level</dt><dd><Ovr v={club.rating} /></dd>
            <dt>Players</dt><dd className="num">{squad.length}</dd>
          </dl>
        </Panel>
        <Panel title="Finances">
          <dl className="kv">
            <dt>Transfer funds</dt><dd className="num" style={{ color: club.funds < 0 ? 'var(--bad)' : undefined }}>{fmtMoney(club.funds)}</dd>
            <dt>Income each week</dt><dd className="num">{fmtMoney(income)}</dd>
            <dt>Wages each week</dt><dd className="num">{fmtMoney(bill)}</dd>
            <dt>Left over each week</dt><dd className="num" style={{ color: income - bill < 0 ? 'var(--bad)' : 'var(--good)' }}>{fmtMoney(income - bill)}</dd>
            <dt>Wage bill share</dt><dd className="num">{Math.round((bill / income) * 100)}% of income</dd>
            <dt>Backing</dt><dd>{rich}</dd>
            <dt>Funds rank in division</dt><dd className="num">{rank} of 20</dd>
          </dl>
          <p className="note" style={{ marginTop: 8 }}>Clubs only spend what they have. Rich clubs sign better players, and clubs that overspend sell.</p>
        </Panel>
        <Panel title="Manager">
          <dl className="kv">
            <dt>Name</dt><dd>{m.name}</dd>
            <dt>Style</dt><dd>{styleWord(m.style)}</dd>
            <dt>Favoured shape</dt><dd>{m.formation}</dd>
            <dt>Young players</dt><dd>{m.youth > 0.6 ? 'Gives them a chance' : m.youth < 0.35 ? 'Prefers experience' : 'Picks on merit'}</dd>
            <dt>In charge for</dt><dd className="num">{tenure} matchdays</dd>
            {own && <><dt>Trust in you</dt><dd className="num">{game.trust.toFixed(1)}</dd></>}
          </dl>
        </Panel>
      </div>
      <Panel title="Wages and contracts" right={`${fmtMoney(bill)} a week`} flush>
        <table>
          <thead><tr>{wageSort.th('pos', 'Pos', true)}{wageSort.th('name', 'Player', true)}{wageSort.th('age', 'Age')}{wageSort.th('ovr', 'OVR')}{wageSort.th('wage', 'Wage')}{wageSort.th('years', 'Contract')}{wageSort.th('value', 'Value')}</tr></thead>
          <tbody>
            {wageSort.rows.map(p => (
              <tr key={p.id} className={'click' + (p.human ? ' me' : '')} onClick={() => select(p.id)}>
                <td className="l">{POS_BY_ID[p.position].label}</td>
                <td className="l"><PlayerLink id={p.id}>{p.name}</PlayerLink>{p.loanFrom ? <span className="muted"> (loan)</span> : null}</td>
                <td>{p.age}</td><td><Ovr v={ovrOf(p)} /></td>
                <td className="num">{fmtMoney(p.wage)}</td>
                <td className="num" style={{ color: p.contractYears <= 1 ? 'var(--warn)' : undefined }}>{p.contractYears} season{p.contractYears === 1 ? '' : 's'}</td>
                <td className="num">{p.human ? '-' : fmtMoney(marketValue(p))}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>
    </div>
  );
}
