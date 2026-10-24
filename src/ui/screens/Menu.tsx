import { useRef, useState } from 'react';
import { POS_BY_ID, type Position } from '../../engine/positions';
import { SLOTS, type Slot, type SlotMeta } from '../../state/save';
import { useStore } from '../../state/store';
import { Ovr } from '../components';
import { TextSizeControl } from '../TextSize';

function when(t: number): string {
  if (!t) return '';
  const d = new Date(t);
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) + ', ' + d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}

function SlotCard({ slot, meta }: { slot: Slot; meta: SlotMeta | null }) {
  const { loadSlot, startNew, removeSlot, exportSlot, importText } = useStore();
  const [msg, setMsg] = useState<string | null>(null);
  const file = useRef<HTMLInputElement>(null);

  const pickFile = async (f: File | undefined) => {
    if (!f) return;
    setMsg(await importText(slot, await f.text()));
  };

  return (
    <section className="panel" aria-label={`Save slot ${slot}`}>
      <div className="ph"><span>Slot {slot}</span>{meta ? <span className="muted" style={{ fontWeight: 400 }}>{when(meta.updated)}</span> : null}</div>
      <div className="pb" style={{ minHeight: '11rem', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {meta ? (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              {meta.ovr > 0 && <Ovr v={meta.ovr} lg />}
              <div>
                <div style={{ fontWeight: 700, fontSize: '1.15rem' }}>{meta.name}</div>
                <div className="t2">{POS_BY_ID[meta.position as Position]?.long ?? meta.position}, age {meta.age}</div>
              </div>
            </div>
            <dl className="kv">
              <dt>Club</dt><dd>{meta.club}</dd>
              {meta.division && <><dt>Division</dt><dd>{meta.division}</dd></>}
              <dt>Season</dt><dd className="num">{meta.phase === 'retired' ? 'Retired' : meta.phase === 'seasonEnd' ? `${meta.season}, season over` : `${meta.season}, matchday ${meta.week}`}</dd>
            </dl>
            <div style={{ display: 'flex', gap: 8, marginTop: 'auto' }}>
              <button className="btn primary" onClick={async () => setMsg(await loadSlot(slot))}>{meta.phase === 'retired' ? 'View legacy' : 'Continue'}</button>
              <button className="btn" onClick={() => void exportSlot(slot)}>Export</button>
              <button className="btn" onClick={() => { if (window.confirm(`Delete the career in slot ${slot}? This cannot be undone.`)) void removeSlot(slot); }}>Delete</button>
            </div>
          </>
        ) : (
          <>
            <p className="muted">Empty.</p>
            <div style={{ display: 'flex', gap: 8, marginTop: 'auto' }}>
              <button className="btn primary" onClick={() => startNew(slot)}>New career</button>
              <button className="btn" onClick={() => file.current?.click()}>Import a save</button>
              <input ref={file} type="file" accept="application/json,.json" hidden onChange={e => { void pickFile(e.target.files?.[0]); e.target.value = ''; }} />
            </div>
          </>
        )}
        {msg && <p className="err" role="alert">{msg}</p>}
      </div>
    </section>
  );
}

export function Menu() {
  const slots = useStore(s => s.slots);
  return (
    <div style={{ height: '100%', overflow: 'auto', padding: 12 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, margin: '2px 2px 14px' }}>
        <h1 style={{ fontSize: 18 }}>Squad Number</h1>
        <span className="muted">A career as one footballer, from the lower leagues to retirement.</span>
        <span style={{ marginLeft: 'auto' }}><TextSizeControl /></span>
      </div>
      <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(20rem, 1fr))', maxWidth: '84rem' }}>
        {SLOTS.map((s, i) => <SlotCard key={s} slot={s} meta={slots[i] ?? null} />)}
      </div>
      <p className="note" style={{ margin: '14px 2px', maxWidth: '60ch' }}>Careers are saved in this browser after every matchday. Use Export to keep a copy as a file, and Import to bring one back or move it to another browser.</p>
    </div>
  );
}
