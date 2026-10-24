import { useState } from 'react';
import { ATTR_BY_ID, GROUPS, attrsIn, type AttrId } from '../../engine/attributes';
import { clubOf, humanOf } from '../../engine/game';
import { WEIGHTS } from '../../engine/positions';
import { coachFactor, INTENSITIES, planCost, planHardCount, PROGRAMMES, PROGRAMME_BY_ID, projectGains, type Intensity, type ProgrammeId, type Programme } from '../../engine/training';
import { missingPrereq, TRAIT_BY_ID, TRAIT_GOAL, TRAITS, type TraitId } from '../../engine/traits';
import { useStore } from '../../state/store';
import { AttrNum, Panel } from '../components';

const ROLE = ['Primary', 'Secondary', 'Third', 'Minor', 'Minor'];
const f2 = (v: number) => (v >= 0 ? '+' : '') + v.toFixed(2);

/** How much a programme would help this player: the gap to their ceiling on what it trains, weighted by how much the position needs it. */
function usefulness(prog: Programme, me: ReturnType<typeof humanOf>): number {
  const w = WEIGHTS[me.position];
  return prog.trains.reduce((a, t) => a + t.w * (0.02 + w[t.id]) * Math.max(0, me.ceil[t.id] - me.attrs[t.id]), 0);
}

export function Training() {
  const game = useStore(s => s.game)!;
  const setSession = useStore(s => s.setSession);
  const setFocus = useStore(s => s.setFocus);
  const setTraitFocus = useStore(s => s.setTraitFocus);
  const [tab, setTab] = useState<'plan' | 'attrs'>('plan');
  const me = humanOf(game);
  const club = clubOf(game, me.clubId)!;
  const plan = game.training;
  const coach = coachFactor(club.rating);
  const proj = projectGains(me, plan, coach);
  const cost = planCost(plan);
  const hard = planHardCount(plan);
  const isGK = me.position === 'GK';
  const focusOptions = GROUPS.filter(g => isGK || g.id !== 'goalkeeping').flatMap(g => attrsIn(g.id));
  const advice = [...PROGRAMMES]
    .filter(p => (isGK ? true : !p.id.startsWith('gk')))
    .map(p => ({ p, v: usefulness(p, me) }))
    .sort((a, b) => b.v - a.v)
    .slice(0, 3);
  const projMap = new Map(proj);
  const log = game.trainingLog;
  const injured = me.injuredWeeks > 0;

  return (
    <div className="stack">
      <div className="tabs" style={{ border: '1px solid var(--line)', borderRadius: 3 }}>
        <button aria-pressed={tab === 'plan'} onClick={() => setTab('plan')}>Weekly plan</button>
        <button aria-pressed={tab === 'attrs'} onClick={() => setTab('attrs')}>Development</button>
      </div>

      {tab === 'plan' && (
        <div className="grid" style={{ gridTemplateColumns: 'minmax(0, 3fr) minmax(300px, 1.2fr)' }}>
          <div className="stack">
            {injured && <div className="panel"><div className="pb"><b>You are injured</b> ({me.injuredWeeks} week{me.injuredWeeks === 1 ? '' : 's'}). Training is on hold while you recover.</div></div>}
            <div className="grid" style={{ gridTemplateColumns: 'repeat(3, minmax(0, 1fr))' }}>
              {plan.sessions.map((s, i) => {
                const prog = s.programme === 'rest' ? null : PROGRAMME_BY_ID[s.programme];
                return (
                  <div key={i} className="sess"><Panel title={`Session ${i + 1}`} right={s.programme === 'rest' ? 'Recover' : undefined}>
                    <div className="field">
                      <label htmlFor={`prog${i}`}>Programme</label>
                      <select id={`prog${i}`} value={s.programme} onChange={e => setSession(i, { programme: e.target.value as ProgrammeId | 'rest' })}>
                        <option value="rest">Rest</option>
                        {PROGRAMMES.filter(p => isGK || !p.id.startsWith('gk')).map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
                      </select>
                    </div>
                    <div className="field">
                      <span className="lbl">Intensity</span>
                      <div className="seg">
                        {INTENSITIES.map(n => <button key={n.id} disabled={s.programme === 'rest'} aria-pressed={s.intensity === n.id} onClick={() => setSession(i, { intensity: n.id as Intensity })}>{n.label}</button>)}
                      </div>
                    </div>
                    {prog ? (
                      <>
                        <p className="note" style={{ marginBottom: 8 }}>{prog.blurb}</p>
                        {prog.trains.map((t, k) => (
                          <div key={t.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 0' }}>
                            <span>{ATTR_BY_ID[t.id].label} <span className="muted">{ROLE[k]}</span></span>
                            <AttrNum v={me.attrs[t.id]} />
                          </div>
                        ))}
                      </>
                    ) : <p className="note">A rest session gives back some condition for the match.</p>}
                  </Panel></div>
                );
              })}
            </div>

            <Panel title="Individual focus">
              <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                <select style={{ maxWidth: 260 }} value={plan.focus ?? ''} onChange={e => setFocus((e.target.value || null) as AttrId | null)} aria-label="Individual focus attribute">
                  <option value="">No individual focus</option>
                  {focusOptions.map(a => <option key={a.id} value={a.id}>{a.label} ({Math.round(me.attrs[a.id])})</option>)}
                </select>
                <span className="note">Extra one-to-one work on a single attribute every week, on top of the three sessions.</span>
              </div>
            </Panel>
            <Panel title="Skills" right={me.traits.length ? `${me.traits.length} learned` : undefined}>
              {(() => {
                const def = plan.traitFocus ? TRAIT_BY_ID[plan.traitFocus] : null;
                const missing = def ? missingPrereq(me, def) : [];
                const progress = plan.traitFocus ? Math.round(game.traitProgress[plan.traitFocus] ?? 0) : 0;
                const hasSession = plan.sessions.some(x => x.programme === 'skillWork');
                return (
                  <>
                    <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                      <select style={{ maxWidth: 280 }} value={plan.traitFocus ?? ''} onChange={e => setTraitFocus((e.target.value || null) as TraitId | null)} aria-label="Skill to learn">
                        <option value="">No skill chosen</option>
                        {TRAITS.filter(t => !me.traits.includes(t.id)).map(t => <option key={t.id} value={t.id}>{t.label}{missingPrereq(me, t).length ? ' (needs more)' : ''}</option>)}
                      </select>
                      <span className="note">Set one session to Skill work and pick a skill to learn. It unlocks options in matches.</span>
                    </div>
                    {def && (
                      <div style={{ marginTop: 10 }}>
                        <p className="t2">{def.desc}</p>
                        <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginTop: 6 }}>
                          {(Object.entries(def.prereq) as [keyof typeof me.attrs, number][]).map(([a, need]) => {
                            const have = Math.round(me.attrs[a]);
                            return <span key={a} style={{ color: have >= need ? 'var(--good)' : 'var(--bad)' }}>{ATTR_BY_ID[a].label} {have} of {need}</span>;
                          })}
                        </div>
                        {missing.length === 0 ? (
                          <div style={{ marginTop: 8 }}>
                            <div className="pool"><i style={{ width: `${(progress / TRAIT_GOAL) * 100}%` }} /></div>
                            <div className="note" style={{ marginTop: 4 }}>{progress} of {TRAIT_GOAL}{hasSession ? '' : '. Add a Skill work session to make progress.'}</div>
                          </div>
                        ) : <p className="note warn" style={{ marginTop: 8 }}>Build the attributes above first. Progress does not start until you have them.</p>}
                      </div>
                    )}
                    {me.traits.length > 0 && (
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 10 }}>
                        {me.traits.map(t => <span key={t} className="pill" title={TRAIT_BY_ID[t].desc}>{TRAIT_BY_ID[t].label}</span>)}
                      </div>
                    )}
                  </>
                );
              })()}
            </Panel>
          </div>

          <div className="stack">
            <Panel title="This week">
              <dl className="kv">
                <dt>Condition cost</dt><dd className="num">{cost >= 0 ? '-' : '+'}{Math.abs(cost).toFixed(1)}</dd>
                <dt>Condition now</dt><dd className="num">{Math.round(me.condition)}%</dd>
                <dt>Before the match</dt><dd className="num">{Math.round(Math.max(20, Math.min(100, me.condition - (injured ? 0 : cost))))}%</dd>
                <dt>Injury risk</dt><dd>{hard === 0 ? 'Normal' : hard === 1 ? 'Slightly raised' : 'Raised'}</dd>
                <dt>Club coaching</dt><dd>{coach >= 1.1 ? 'Excellent' : coach >= 1 ? 'Good' : coach >= 0.9 ? 'Average' : 'Basic'}</dd>
              </dl>
              <p className="note" style={{ marginTop: 8 }}>Hard sessions develop you faster but cost condition, and a tired player performs and is picked less.</p>
            </Panel>
            <Panel title="Expected progress this week" flush>
              <table>
                <thead><tr><th className="l">Attribute</th><th>Now</th><th>Gain</th></tr></thead>
                <tbody>
                  {proj.map(([id, g]) => (
                    <tr key={id}><td className="l">{ATTR_BY_ID[id].label}</td><td><AttrNum v={me.attrs[id]} /></td><td className="num">{g > 0 ? f2(g) : <span className="muted">at limit</span>}</td></tr>
                  ))}
                  {proj.length === 0 && <tr><td className="l muted" colSpan={3}>Nothing scheduled.</td></tr>}
                </tbody>
              </table>
            </Panel>
            <Panel title="Coach's suggestions">
              {advice.map(a => (
                <div key={a.p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '3px 0' }}>
                  <span>{a.p.label} <span className="muted">({a.p.trains.slice(0, 2).map(t => ATTR_BY_ID[t.id].label).join(', ')})</span></span>
                  <button className="btn sm" onClick={() => setSession(0, { programme: a.p.id })}>Session 1</button>
                </div>
              ))}
              <p className="note" style={{ marginTop: 6 }}>Ranked by how much room you have left on what each programme trains, weighted by your position.</p>
            </Panel>
            {log && (
              <Panel title={`Last week, matchday ${log.week}`}>
                {log.gains.length ? log.gains.slice(0, 6).map(([id, g]) => (
                  <div key={id} style={{ display: 'flex', justifyContent: 'space-between' }}><span>{ATTR_BY_ID[id].label}</span><span className="num">{f2(g)}</span></div>
                )) : <p className="muted">No training last week.</p>}
              </Panel>
            )}
          </div>
        </div>
      )}

      {tab === 'attrs' && (
        <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))' }}>
          {GROUPS.filter(g => g.id !== 'goalkeeping' || isGK).map(g => (
            <Panel key={g.id} title={g.label} flush>
              <table>
                <thead><tr><th className="l">Attribute</th><th>Now</th><th>This season</th><th className="l hide-m">Note</th></tr></thead>
                <tbody>
                  {attrsIn(g.id).map(a => {
                    const d = me.attrs[a.id] - game.seasonStart.attrs[a.id];
                    const room = me.ceil[a.id] - me.attrs[a.id];
                    const next = me.attrs[a.id] - Math.floor(me.attrs[a.id]);
                    return (
                      <tr key={a.id}>
                        <td className="l">{a.label}{(() => { const note = room < 0.6 ? 'Near your limit' : projMap.has(a.id) && next > 0.7 ? 'Close to improving' : ''; return note ? <div className="note show-m">{note}</div> : null; })()}</td>
                        <td><AttrNum v={me.attrs[a.id]} /> <span className="muted num" style={{ fontSize: '0.85em' }}>{me.attrs[a.id].toFixed(1)}</span></td>
                        <td className="num" style={{ color: d > 0.05 ? 'var(--good)' : d < -0.05 ? 'var(--bad)' : undefined }}>{Math.abs(d) < 0.05 ? '-' : f2(d)}</td>
                        <td className="l muted hide-m">{room < 0.6 ? 'Near your limit' : projMap.has(a.id) && next > 0.7 ? 'Close to improving' : ''}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </Panel>
          ))}
        </div>
      )}
    </div>
  );
}
