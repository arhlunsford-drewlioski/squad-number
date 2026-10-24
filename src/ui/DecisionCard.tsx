import { useEffect } from 'react';
import type { Band, MomentRequest } from '../engine/moments/types';

const BAND: Record<Band, { label: string; color: string }> = {
  likely: { label: 'Likely', color: 'var(--good)' },
  even: { label: 'Even', color: 'var(--warn)' },
  risky: { label: 'Risky', color: 'var(--bad)' },
  unclear: { label: 'Unclear', color: 'var(--muted)' },
};
const RISK = { safe: 'Safe', balanced: 'Balanced', gamble: 'Gamble' } as const;

const readWord = (r: number) => (r < 0.2 ? 'Poor' : r < 0.45 ? 'Fair' : r < 0.7 ? 'Good' : 'Sharp');

/** The decision shown when the match pauses. Number keys choose. */
export function DecisionCard({ req, onChoose }: { req: MomentRequest; onChoose: (id: string | undefined) => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const n = Number(e.key);
      if (n >= 1 && n <= req.options.length) {
        const o = req.options[n - 1];
        if (!o.locked) onChoose(o.id);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [req, onChoose]);

  return (
    <section className="panel decision" aria-label="Your decision">
      <div className="ph">
        <span>{req.title}{req.stage === 2 ? ' (follow-up)' : ''}</span>
        <span className="muted" style={{ fontWeight: 400, fontSize: '0.9rem' }}>{req.minute}' · {req.scoreOwn}-{req.scoreOpp} · Read: <b style={{ color: 'var(--text)' }}>{readWord(req.read)}</b></span>
      </div>
      <div className="pb">
        <p style={{ fontSize: '1rem', lineHeight: 1.4 }}>{req.prompt}</p>
        {req.tips.length > 0 && (
          <p className="t2" style={{ marginTop: 6 }}><b>You notice:</b> {req.tips.join(' ')}</p>
        )}
        {req.read < 0.35 && <p className="note" style={{ marginTop: 6 }}>You cannot read this one well. Vision, Decisions and Anticipation sharpen what you see.</p>}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 8, marginTop: 10 }}>
          {req.options.map((o, i) => (
            <button key={o.id} disabled={o.locked} onClick={() => onChoose(o.id)}
              style={{ textAlign: 'left', background: 'var(--panel-head)', border: '1px solid var(--line-strong)', borderRadius: 3, padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: 4, opacity: o.locked ? 0.45 : 1 }}>
              <span style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                <b>{i + 1}. {o.label}</b>
              </span>
              <span className="t2" style={{ fontSize: '0.88rem', lineHeight: 1.3 }}>{o.desc}</span>
              <span style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <span className="pill">{RISK[o.risk]}</span>
                {o.locked ? <span className="note">{o.lockText}</span> : <span style={{ color: BAND[o.band].color, fontWeight: 700 }}>{BAND[o.band].label}</span>}
              </span>
            </button>
          ))}
        </div>
        <div style={{ marginTop: 10, display: 'flex', gap: 10, alignItems: 'center' }}>
          <button className="btn sm" onClick={() => onChoose(undefined)}>Let the engine decide</button>
          <span className="note">Press 1 to {req.options.length} to choose.</span>
        </div>
      </div>
    </section>
  );
}
