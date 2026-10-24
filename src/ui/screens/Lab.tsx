import { useMemo, useState } from 'react';
import { humanOf } from '../../engine/game';
import { bestLineup } from '../../engine/match/lineup';
import { simulateMatch } from '../../engine/match/sim';
import { DEFAULT_SETUP, libraryHealth, reportFor, sampleOutcome, type LabSetup } from '../../engine/moments/lab';
import { TEMPLATES } from '../../engine/moments/templates';
import type { Kind, ResultKind } from '../../engine/moments/types';
import { POSITIONS, type Position } from '../../engine/positions';
import { makeRng } from '../../engine/rng';
import { TRAITS, type TraitId } from '../../engine/traits';
import { useStore } from '../../state/store';
import { Panel } from '../components';

const TIER_COLOR = ['var(--good)', 'var(--b-great)', 'var(--warn)', 'var(--bad)'];
const TIER_NAME = ['Great', 'Good', 'Poor', 'Disaster'];
const pc = (v: number) => `${Math.round(v * 100)}%`;

function Slider({ label, value, min, max, step = 1, onChange, show }: { label: string; value: number; min: number; max: number; step?: number; onChange: (v: number) => void; show?: string }) {
  return (
    <div className="field" style={{ marginBottom: 8 }}>
      <label style={{ display: 'flex', justifyContent: 'space-between' }}><span>{label}</span><span className="num">{show ?? value}</span></label>
      <input type="range" min={min} max={max} step={step} value={value} onChange={e => onChange(+e.target.value)} />
    </div>
  );
}

export function Lab() {
  const game = useStore(s => s.game)!;
  const me = humanOf(game);
  const [setup, setSetup] = useState<LabSetup>({ ...DEFAULT_SETUP, slot: me.position });
  const [useMine, setUseMine] = useState(true);
  const [kind, setKind] = useState<Kind | 'all'>('all');
  const [pos, setPos] = useState<Position | 'all'>('all');
  const [q, setQ] = useState('');
  const [sel, setSel] = useState('oneOnOne');
  const [rolled, setRolled] = useState<Record<string, string>>({});
  const [check, setCheck] = useState<string | null>(null);
  const health = useMemo(() => libraryHealth(), []);

  const list = TEMPLATES.filter(t => !t.followOnly && (kind === 'all' || t.kind === kind) && (pos === 'all' || t.for.includes(pos)) && (!q || t.title.toLowerCase().includes(q.toLowerCase()) || t.id.toLowerCase().includes(q.toLowerCase())));
  const tpl = TEMPLATES.find(t => t.id === sel) ?? TEMPLATES[0];
  const eff: LabSetup = { ...setup, me: useMine ? me : undefined, slot: useMine ? me.position : setup.slot };
  const rows = reportFor(tpl, eff);
  const set = (p: Partial<LabSetup>) => setSetup(s => ({ ...s, ...p }));
  const toggleTrait = (t: TraitId) => set({ traits: setup.traits.includes(t) ? setup.traits.filter(x => x !== t) : [...setup.traits, t] });

  const runCheck = () => {
    const ctx = { week: game.week, trust: game.trust };
    const club = game.clubs.find(c => c.id === me.clubId)!;
    const opps = game.clubs.filter(c => c.division === club.division && c.id !== club.id);
    let n = 0, withG = 0, withoutG = 0, moments = 0, hg = 0, rating = 0;
    for (let i = 0; i < 40; i++) {
      const opp = opps[i % opps.length];
      const H = bestLineup(game.players, club.id, ctx), A = bestLineup(game.players, opp.id, ctx);
      const slot = H.xi.find(s => s.player.id === me.id);
      if (!slot) { setCheck('You are not in the starting eleven right now, so there is nothing to measure. Improve your standing first, or try again next week.'); return; }
      const base = simulateMatch(H, A, makeRng(900 + i));
      const r = simulateMatch(H, A, makeRng(900 + i), { humanId: me.id, moments: { confidence: 50, recent: [] } });
      n++; withoutG += base.hg; withG += r.hg; moments += r.moments?.logs.length ?? 0;
      const pm = r.players[me.id]; if (pm) { hg += pm.g; rating += pm.rating; }
    }
    setCheck(`${n} home matches against the rest of your division: your team scores ${(withG / n).toFixed(2)} a match with moments and ${(withoutG / n).toFixed(2)} without. You get ${(moments / n).toFixed(1)} moments a match, score ${(hg / n).toFixed(2)} goals and average a ${(rating / n).toFixed(2)} rating when the engine decides.`);
  };

  return (
    <div className="stack">
      <Panel title="Library" right={<button className="btn sm" onClick={runCheck}>Run a match check</button>}>
        <div style={{ display: 'flex', gap: 28, flexWrap: 'wrap' }}>
          <div><b className="num" style={{ fontSize: '1.4rem' }}>{health.selectable}</b><div className="muted">moments</div></div>
          <div><b className="num" style={{ fontSize: '1.4rem' }}>{health.options}</b><div className="muted">options</div></div>
          <div><b className="num" style={{ fontSize: '1.4rem' }}>{health.traitOptions}</b><div className="muted">trait options</div></div>
          {Object.entries(health.byKind).map(([k, v]) => <div key={k}><b className="num" style={{ fontSize: '1.4rem' }}>{v}</b><div className="muted">{k}</div></div>)}
          <div><b className="num" style={{ fontSize: '1.4rem', color: health.issues.length ? 'var(--bad)' : 'var(--good)' }}>{health.issues.length}</b><div className="muted">issues</div></div>
        </div>
        {health.issues.length > 0 && <ul style={{ margin: '10px 0 0', paddingLeft: 18 }}>{health.issues.slice(0, 12).map((i, k) => <li key={k}><b>{i.template}</b>: {i.message}</li>)}</ul>}
        {check && <p className="t2" style={{ marginTop: 10 }}>{check}</p>}
      </Panel>

      <div className="grid" style={{ gridTemplateColumns: 'minmax(16rem, 21rem) minmax(0, 1fr)' }}>
        <div className="stack">
          <Panel title="Situation">
            <label style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 10 }}>
              <input type="checkbox" checked={useMine} onChange={e => setUseMine(e.target.checked)} /> Use my player ({me.name})
            </label>
            {!useMine && (
              <>
                <Slider label="Your level" value={setup.myLevel} min={1} max={20} onChange={v => set({ myLevel: v })} />
                <div className="field" style={{ marginBottom: 8 }}>
                  <span className="lbl">Position</span>
                  <select value={setup.slot} onChange={e => set({ slot: e.target.value as Position })}>{POSITIONS.map(p => <option key={p.id} value={p.id}>{p.long}</option>)}</select>
                </div>
                <div className="field" style={{ marginBottom: 8 }}>
                  <span className="lbl">Traits</span>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {TRAITS.map(t => <button key={t.id} className="btn sm" aria-pressed={setup.traits.includes(t.id)} style={setup.traits.includes(t.id) ? { background: 'var(--accent)', color: 'var(--accent-ink)' } : undefined} onClick={() => toggleTrait(t.id)}>{t.label}</button>)}
                  </div>
                </div>
              </>
            )}
            <Slider label="Opponent level" value={setup.oppLevel} min={1} max={20} onChange={v => set({ oppLevel: v })} />
            <Slider label="Confidence" value={setup.conf} min={5} max={95} onChange={v => set({ conf: v })} />
            <Slider label="Freshness" value={Math.round(setup.fat * 100)} min={75} max={100} onChange={v => set({ fat: v / 100 })} show={`${Math.round(setup.fat * 100)}%`} />
            <Slider label="Minute" value={setup.minute} min={1} max={90} onChange={v => set({ minute: v })} />
            <Slider label="Lead" value={setup.lead} min={-3} max={3} onChange={v => set({ lead: v })} show={setup.lead > 0 ? `+${setup.lead}` : String(setup.lead)} />
          </Panel>
          <Panel title="Moments" flush>
            <div style={{ padding: 10, display: 'grid', gap: 8 }}>
              <input type="text" placeholder="Search" value={q} onChange={e => setQ(e.target.value)} />
              <div style={{ display: 'flex', gap: 8 }}>
                <select value={kind} onChange={e => setKind(e.target.value as Kind | 'all')}>
                  <option value="all">All kinds</option><option value="attack">Attack</option><option value="build">Build-up</option><option value="defend">Defend</option><option value="any">Anywhere</option>
                </select>
                <select value={pos} onChange={e => setPos(e.target.value as Position | 'all')}>
                  <option value="all">All positions</option>{POSITIONS.map(p => <option key={p.id} value={p.id}>{p.long}</option>)}
                </select>
              </div>
            </div>
            <div style={{ maxHeight: '26rem', overflow: 'auto' }}>
              <table><tbody>
                {list.map(t => (
                  <tr key={t.id} className={'click' + (t.id === tpl.id ? ' me' : '')} onClick={() => setSel(t.id)}>
                    <td className="l">{t.title}</td><td className="muted">{t.kind}</td><td className="muted">{t.options.length}</td>
                  </tr>
                ))}
                {list.length === 0 && <tr><td className="l muted">No moments match.</td></tr>}
              </tbody></table>
            </div>
          </Panel>
        </div>

        <Panel title={tpl.title} right={`${tpl.kind} · ${tpl.script} · ${tpl.for.join(' ')}`}>
          <p style={{ marginBottom: 12 }}>{tpl.prompt}</p>
          <div className="scroll-x"><table>
            <thead><tr><th className="l">Option</th><th>Risk</th><th>You</th><th>Them</th><th>Chance</th><th className="l" style={{ minWidth: 220 }}>Execution</th><th>Value</th><th className="l">Most likely results</th><th /></tr></thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.id} style={r.locked ? { opacity: 0.5 } : undefined}>
                  <td className="l">{r.label}{r.locked ? <div className="note">{r.lockText}</div> : null}</td>
                  <td>{r.risk}</td>
                  <td className="num">{r.mine.toFixed(1)}</td><td className="num">{r.theirs.toFixed(1)}</td>
                  <td className="num"><b>{pc(r.s)}</b></td>
                  <td className="l">
                    <div style={{ display: 'flex', height: 12, borderRadius: 2, overflow: 'hidden', minWidth: 200 }} title={r.tiers.map((p, i) => `${TIER_NAME[i]} ${pc(p)}`).join(', ')}>
                      {r.tiers.map((p, i) => <i key={i} style={{ width: `${p * 100}%`, background: TIER_COLOR[i] }} />)}
                    </div>
                  </td>
                  <td className="num">{r.ev.toFixed(2)}</td>
                  <td className="l" style={{ whiteSpace: 'normal' }}>{(Object.entries(r.results) as [ResultKind, number][]).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k, v]) => `${k} ${pc(v)}`).join(', ')}</td>
                  <td><button className="btn sm" disabled={r.locked} onClick={() => { const o = sampleOutcome(tpl, r.id, eff, makeRng((Math.random() * 1e9) | 0)); setRolled(x => ({ ...x, [r.id]: `${o.tier}: ${o.text}` })); }}>Roll</button></td>
                </tr>
              ))}
            </tbody>
          </table></div>
          {Object.keys(rolled).length > 0 && (
            <div style={{ marginTop: 12 }}>
              {tpl.options.filter(o => rolled[o.id]).map(o => <p key={o.id} className="t2"><b>{o.label.replace(/\{[a-z]+\}/g, '...')}</b>: {rolled[o.id]}</p>)}
            </div>
          )}
          <p className="note" style={{ marginTop: 12 }}>Chance is the odds of a good execution. The bar shows great, good, poor and disastrous execution. Value is the average worth of the option, used by the engine when it decides for you.</p>
        </Panel>
      </div>
    </div>
  );
}
