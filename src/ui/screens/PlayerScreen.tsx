import { ATTR_BY_ID, GROUPS, attrsIn, type AttrId, type Hidden } from '../../engine/attributes';
import { BUILDS, heightFeetInches } from '../../engine/body';
import { clubOf, humanOf } from '../../engine/game';
import { ovrOf, type Player } from '../../engine/player';
import { keyAttrs, POS_BY_ID } from '../../engine/positions';
import { allPositionOvr, ovrTier } from '../../engine/rating';
import { DIVISIONS } from '../../engine/world';
import { TRAIT_BY_ID } from '../../engine/traits';
import { fmtMoney, marketValue } from '../../engine/economy';
import { useStore } from '../../state/store';
import { AttrNum, ClubLink, Kit, money, Ovr, Panel } from '../components';

const describe = (h: Hidden): string[] => {
  const out: string[] = [];
  if (h.professionalism >= 15) out.push('Model professional'); else if (h.professionalism <= 7) out.push('Lax in training');
  if (h.determination >= 15) out.push('Very determined'); else if (h.determination <= 7) out.push('Easily discouraged');
  if (h.naturalFitness >= 15) out.push('Naturally fit'); else if (h.naturalFitness <= 7) out.push('Tires easily');
  if (h.injuryProneness >= 15) out.push('Injury prone'); else if (h.injuryProneness <= 6) out.push('Rarely injured');
  if (h.consistency >= 15) out.push('Consistent'); else if (h.consistency <= 7) out.push('Inconsistent');
  if (h.bigMatches >= 15) out.push('Thrives in big matches'); else if (h.bigMatches <= 7) out.push('Shrinks in big matches');
  return out.length ? out : ['No standout personality traits'];
};

/** Change since the start of the season, for the player's own attributes. */
function Delta({ p, id }: { p: Player; id: AttrId }) {
  const game = useStore(s => s.game)!;
  if (!p.human) return null;
  const d = Math.round(p.attrs[id]) - Math.round(game.seasonStart.attrs[id]);
  if (!d) return null;
  return <span style={{ color: d > 0 ? 'var(--good)' : 'var(--bad)', fontSize: '0.85em', marginRight: 8, fontWeight: 600 }}>{d > 0 ? '+' : ''}{d}</span>;
}

export function PlayerScreen() {
  const game = useStore(s => s.game)!;
  const selected = useStore(s => s.selectedPlayerId);
  const p = game.players.find(x => x.id === selected) ?? humanOf(game);
  const club = clubOf(game, p.clubId);
  const key = new Set(keyAttrs(p.position, 8));
  const ovr = ovrOf(p);

  return (
    <div className="stack">
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <Ovr v={ovr} lg />
        <div>
          <h2 style={{ fontSize: 18 }}>{p.name}{p.human ? <span className="pill" style={{ marginLeft: 8 }}>You</span> : null}</h2>
          <div className="t2">
            {POS_BY_ID[p.position].long} · age {p.age} · {club ? club.name : 'No club'} · {p.heightCm} cm ({heightFeetInches(p.heightCm)}) · {BUILDS.find(b => b.id === p.build)!.label} · {p.foot === 'left' ? 'Left' : 'Right'} foot, weaker foot {p.weakFoot}
          </div>
        </div>
      </div>

      <div className="grid g-player">
        <div className="stack">
          <Panel title="Details">
            <dl className="kv">
              <dt>Club</dt><dd>{club ? <span style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}><Kit club={club} /><ClubLink id={club.id}>{club.name}</ClubLink></span> : 'None'}</dd>
              {club && <><dt>Division</dt><dd>{DIVISIONS[club.division - 1].name}</dd></>}
              {p.human && game.contract && <><dt>Wage</dt><dd className="num">{money(game.contract.wage)} a week</dd><dt>Contract</dt><dd>{game.contract.years} seasons</dd></>}
              {!p.human && p.clubId && <><dt>Wage</dt><dd className="num">{fmtMoney(p.wage)} a week</dd><dt>Contract</dt><dd>{p.contractYears} season{p.contractYears === 1 ? '' : 's'}{p.loanFrom ? ', on loan' : ''}</dd></>}
              {!p.human && <><dt>Value</dt><dd className="num">{fmtMoney(marketValue(p))}</dd></>}
              <dt>Level</dt><dd>{ovrTier(ovr)}</dd>
              <dt>Ceiling (scout)</dt><dd>{ovrTier(p.potential - 5) === ovrTier(p.potential + 4) ? ovrTier(p.potential) : `${ovrTier(p.potential - 5)} to ${ovrTier(p.potential + 4)}`}</dd>
            </dl>
          </Panel>
          <Panel title="Rating by position" flush>
            <table>
              <tbody>
                {allPositionOvr(p.attrs).sort((a, b) => b.ovr - a.ovr).map(r => (
                  <tr key={r.pos} className={r.pos === p.position ? 'me' : ''}><td className="l">{POS_BY_ID[r.pos].long}</td><td><Ovr v={r.ovr} /></td></tr>
                ))}
              </tbody>
            </table>
          </Panel>
          {p.traits.length > 0 && (
            <Panel title="Traits">
              {p.traits.map(t => <div key={t} style={{ marginBottom: 6 }}><b>{TRAIT_BY_ID[t].label}</b><div className="note">{TRAIT_BY_ID[t].desc}</div></div>)}
            </Panel>
          )}
          {p.human && game.history.length > 0 && (
            <Panel title="Career" flush>
              <table>
                <thead><tr><th>Season</th><th className="l">Club</th><th>Apps</th><th>G</th><th>OVR</th></tr></thead>
                <tbody>{game.history.map(h => <tr key={h.season}><td>{h.season}</td><td className="l">{h.clubName}</td><td>{h.apps}</td><td>{h.goals}</td><td><Ovr v={h.ovr} /></td></tr>)}</tbody>
              </table>
            </Panel>
          )}
          {p.human && (
            <Panel title="Personality">
              <ul style={{ margin: 0, paddingLeft: 18 }}>{describe(p.hidden).map(t => <li key={t}>{t}</li>)}</ul>
              <p className="note" style={{ marginTop: 8 }}>Hidden attributes shape how fast you train and how often you are injured.</p>
            </Panel>
          )}
        </div>

        {GROUPS.filter(g => g.id !== 'goalkeeping').map(g => (
          <Panel key={g.id} title={g.label} flush>
            {attrsIn(g.id).map(d => (
              <div key={d.id} className={'arow' + (key.has(d.id) ? ' key' : '')}>
                <span>{ATTR_BY_ID[d.id].label}</span><span><Delta p={p} id={d.id} /><AttrNum v={p.attrs[d.id]} /></span>
              </div>
            ))}
            {g.id === 'physical' && (
              <>
                <div className="ph" style={{ borderTop: '1px solid var(--line)' }}>Goalkeeping</div>
                {attrsIn('goalkeeping').map(d => (
                  <div key={d.id} className={'arow' + (p.position !== 'GK' ? ' dim' : key.has(d.id) ? ' key' : '')}>
                    <span>{d.label}</span><span><Delta p={p} id={d.id} /><AttrNum v={p.attrs[d.id]} /></span>
                  </div>
                ))}
              </>
            )}
          </Panel>
        ))}
      </div>
      <p className="note">Shaded rows are the attributes that matter most at {POS_BY_ID[p.position].long.toLowerCase()}. Numbers are on a 1 to 20 scale.</p>
    </div>
  );
}
