import { ATTR_BY_ID, GROUPS, attrsIn } from '../../engine/attributes';
import { clubOf, humanOf } from '../../engine/game';
import { POS_BY_ID } from '../../engine/positions';
import { ovrTier } from '../../engine/rating';
import { DIVISIONS } from '../../engine/world';
import { CUP_NAME, HOME_NATION, ACHIEVEMENT_BY_ID } from '../../engine/career';
import { useStore } from '../../state/store';
import { AttrNum, Kit, money, Ovr, Panel } from '../components';

const ordinal = (n: number) => { const s = ['th', 'st', 'nd', 'rd'], v = n % 100; return n + (s[(v - 20) % 10] || s[v] || s[0]); };

export function SeasonEnd() {
  const game = useStore(s => s.game)!;
  const start = useStore(s => s.startSeason);
  const retireNow = useStore(s => s.retireNow);
  const sum = game.summary!;
  const me = humanOf(game);
  const club = clubOf(game, sum.clubId)!;
  const name = (id: string) => game.clubs.find(c => c.id === id)!.name;
  const div = DIVISIONS[sum.division - 1];
  const moved = sum.promoted.includes(club.id) ? 'Promoted' : sum.relegated.includes(club.id) ? 'Relegated' : null;
  const isGK = me.position === 'GK';
  const cs = sum.career;
  const cupRound = cs.cup.reached >= 0 ? game.cup.rounds[cs.cup.reached].name : null;
  const ask = () => { if (window.confirm('Retire from football? This ends your career.')) retireNow(); };

  return (
    <div style={{ height: '100%', overflow: 'auto', padding: 12 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, margin: '2px 2px 12px' }}>
        <h1 style={{ fontSize: 18 }}>Season {sum.season} complete</h1>
        <span className="muted">{me.name}, age {me.age}, {POS_BY_ID[me.position].long.toLowerCase()}</span>
      </div>

      <div className="grid" style={{ gridTemplateColumns: 'repeat(3, minmax(0, 1fr))' }}>
        <div className="stack">
          <Panel title="Your season">
            <dl className="kv">
              <dt>Club</dt><dd><span style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}><Kit club={club} />{club.name}</span></dd>
              <dt>{div.name}</dt><dd>{ordinal(sum.pos)}{moved ? <b style={{ marginLeft: 8, color: moved === 'Promoted' ? 'var(--good)' : 'var(--bad)' }}>{moved}</b> : null}</dd>
              <dt>Appearances</dt><dd className="num">{sum.me.apps} ({sum.me.starts} starts)</dd>
              <dt>Minutes</dt><dd className="num">{sum.me.mins}</dd>
              <dt>Goals / assists</dt><dd className="num">{sum.me.goals} / {sum.me.assists}</dd>
              <dt>Average rating</dt><dd className="num">{sum.me.ratingN ? sum.me.avg.toFixed(2) : '-'}</dd>
              <dt>Player of the match</dt><dd className="num">{sum.me.motm}</dd>
              <dt>Cards</dt><dd className="num">{sum.me.yellow} yellow, {sum.me.red} red</dd>
            </dl>
          </Panel>
          <Panel title={`${div.name}`}>
            <dl className="kv">
              <dt>Champions</dt><dd>{name(sum.champion)}</dd>
              <dt>Top scorer</dt><dd>{sum.boot ? `${sum.boot.name} (${sum.boot.goals})` : '-'}</dd>
              <dt>Player of the season</dt><dd>{sum.poty ? `${sum.poty.name}, ${sum.poty.rating.toFixed(2)}` : '-'}</dd>
            </dl>
            <p className="note" style={{ marginTop: 8 }}>Top three in each lower division go up. Bottom three in each upper division go down.</p>
          </Panel>
          <Panel title={CUP_NAME}>
            <dl className="kv">
              <dt>Winners</dt><dd>{cs.cup.winner ? name(cs.cup.winner) : '-'}</dd>
              <dt>Your club</dt><dd>{cs.cup.won ? <b style={{ color: 'var(--good)' }}>Won the cup</b> : cupRound ? `Reached the ${cupRound.toLowerCase()}` : 'Did not play'}</dd>
              <dt>Your cup record</dt><dd className="num">{game.career.cup.apps} apps, {game.career.cup.goals} goals (career)</dd>
            </dl>
          </Panel>
          {cs.tournament && (
            <Panel title={cs.tournament.name} right={`${HOME_NATION}: ${cs.tournament.result}`}>
              <table>
                <thead><tr><th className="l">Stage</th><th className="l">Opponent</th><th>Score</th></tr></thead>
                <tbody>
                  {cs.tournament.matches.map((m, i) => <tr key={i}><td className="l">{m.stage}</td><td className="l">{m.opp}</td><td className="num">{m.ours}-{m.theirs}{m.pens ? ` (${m.pens[0]}-${m.pens[1]} pens)` : ''}</td></tr>)}
                </tbody>
              </table>
              <p className="note" style={{ marginTop: 8 }}>{cs.tournament.you ? (cs.tournament.you.apps ? `You played ${cs.tournament.you.apps} match${cs.tournament.you.apps === 1 ? '' : 'es'}, scored ${cs.tournament.you.goals} and set up ${cs.tournament.you.assists}.` : 'You were in the squad but did not get on.') : 'You were not in the squad.'}</p>
            </Panel>
          )}
        </div>

        <Panel title="Development" right={<span>Overall <Ovr v={sum.ovrStart} /> to <Ovr v={sum.ovrEnd} /></span>} flush>
          <table>
            <thead><tr><th className="l">Attribute</th><th>Start</th><th>Now</th><th>Change</th></tr></thead>
            <tbody>
              {GROUPS.filter(g => g.id !== 'goalkeeping' || isGK).flatMap(g => attrsIn(g.id)).map(a => {
                const s0 = Math.round(sum.attrsStart[a.id]), s1 = Math.round(sum.attrsEnd[a.id]);
                const d = s1 - s0;
                return (
                  <tr key={a.id}>
                    <td className="l">{ATTR_BY_ID[a.id].label}</td><td><AttrNum v={s0} /></td><td><AttrNum v={s1} /></td>
                    <td style={{ color: d > 0 ? 'var(--good)' : d < 0 ? 'var(--bad)' : 'var(--muted)', fontWeight: 600 }}>{d > 0 ? '+' : ''}{d || '-'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Panel>

        <div className="stack">
          {cs.mustRetire ? (
            <Panel title="The end of the road">
              <p className="t2" style={{ marginBottom: 10 }}>At {me.age} your body has had enough. The time has come to hang up your boots.</p>
              <button className="btn primary" style={{ width: '100%', padding: '10px 14px' }} onClick={retireNow}>Retire and see your legacy</button>
            </Panel>
          ) : sum.contractExpired ? (
            <Panel title="Your contract has expired">
              <p className="note" style={{ marginBottom: 8 }}>You are a free agent. Level now: {ovrTier(sum.ovrEnd)}. Choose where to play next season.</p>
              <div className="stack">
                {game.offers.map((o, i) => {
                  const c = game.clubs.find(x => x.id === o.clubId)!;
                  return (
                    <div key={i} className="panel">
                      <div className="pb">
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                          <span style={{ display: 'inline-flex', gap: 8, alignItems: 'center', fontWeight: 600 }}><Kit club={c} />{c.name}</span>
                          <button className="btn primary sm" onClick={() => start(i)}>{o.stay ? 'Re-sign' : 'Sign'}</button>
                        </div>
                        <dl className="kv" style={{ marginTop: 6 }}>
                          <dt>Division</dt><dd>{DIVISIONS[c.division - 1].name}</dd>
                          <dt>Role</dt><dd>{o.role}</dd>
                          <dt>Wage</dt><dd className="num">{money(o.wage)} a week</dd>
                          <dt>Contract</dt><dd>{o.years} seasons</dd>
                        </dl>
                      </div>
                    </div>
                  );
                })}
              </div>
              {cs.canRetire && <button className="btn" style={{ marginTop: 10, width: '100%' }} onClick={ask}>Retire instead</button>}
            </Panel>
          ) : (
            <Panel title="Next season">
              <dl className="kv">
                <dt>Club</dt><dd>{club.name}{moved ? ` (${moved.toLowerCase()})` : ''}</dd>
                <dt>Contract left</dt><dd>{game.contract!.years} season{game.contract!.years === 1 ? '' : 's'}</dd>
                <dt>Wage</dt><dd className="num">{money(game.contract!.wage)} a week</dd>
              </dl>
              <button className="btn primary" style={{ marginTop: 12, width: '100%', padding: '10px 14px' }} onClick={() => start(null)}>Start season {sum.season + 1}</button>
              {cs.canRetire && <button className="btn" style={{ marginTop: 8, width: '100%' }} onClick={ask}>Retire</button>}
            </Panel>
          )}
          <Panel title="Your awards" right={`Standing ${Math.round(cs.rep.from)} to ${Math.round(cs.rep.to)}`}>
            {cs.awards.length === 0 ? <p className="muted">None this season.</p> : <ul style={{ margin: 0, paddingLeft: 18 }}>{cs.awards.map((a, i) => <li key={i}><b>{a.label}</b></li>)}</ul>}
            {cs.young && <p className="note" style={{ marginTop: 8 }}>Young player of the season: {cs.young.name}.</p>}
            {cs.achievements.length > 0 && <p className="t2" style={{ marginTop: 8 }}>Achievement{cs.achievements.length === 1 ? '' : 's'}: {cs.achievements.map(id => ACHIEVEMENT_BY_ID[id].label).join(', ')}.</p>}
          </Panel>
          <Panel title="Targets" right={`${cs.goals.filter(x => x.met).length} of ${cs.goals.length} met`} flush>
            <table>
              <tbody>
                {cs.goals.map(x => <tr key={x.id}><td className="l" style={{ whiteSpace: 'normal' }}>{x.text}</td><td style={{ color: x.met ? 'var(--good)' : 'var(--bad)', fontWeight: 600 }}>{x.met ? 'Met' : 'Missed'}</td></tr>)}
              </tbody>
            </table>
          </Panel>
          <Panel title="Career" flush>
            <table>
              <thead><tr><th>Season</th><th className="l">Club</th><th>Pos</th><th>Apps</th><th>G</th><th>OVR</th></tr></thead>
              <tbody>
                {game.history.map(h => <tr key={h.season}><td>{h.season}</td><td className="l">{h.clubName}</td><td>{h.pos}</td><td>{h.apps}</td><td>{h.goals}</td><td><Ovr v={h.ovr} /></td></tr>)}
              </tbody>
            </table>
          </Panel>
        </div>
      </div>
    </div>
  );
}
