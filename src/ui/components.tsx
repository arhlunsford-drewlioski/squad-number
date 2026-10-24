import type { ReactNode } from 'react';
import { useStore } from '../state/store';
import { attrBand, ovrBand } from '../engine/rating';
import type { Club } from '../engine/world';

export function Panel({ title, right, flush, children }: { title: ReactNode; right?: ReactNode; flush?: boolean; children: ReactNode }) {
  return (
    <section className="panel">
      <div className="ph"><span>{title}</span>{right ? <span className="muted" style={{ fontWeight: 400 }}>{right}</span> : null}</div>
      <div className={'pb' + (flush ? ' flush' : '')}>{children}</div>
    </section>
  );
}

/** A 1-20 attribute value, coloured by band. */
export const AttrNum = ({ v }: { v: number }) => <span className={`attr b-${attrBand(v)}`}>{Math.round(v)}</span>;

/** An overall rating chip, coloured by band. */
export const Ovr = ({ v, lg }: { v: number; lg?: boolean }) => <span className={`ovr b-${ovrBand(v)}${lg ? ' lg' : ''}`}>{Math.round(v)}</span>;

export const Kit = ({ club }: { club: Club }) => <span className="kit" style={{ background: `linear-gradient(90deg, ${club.c1} 60%, ${club.c2} 60%)` }} aria-hidden />;

/** A player's name as a link to their page. Safe inside clickable rows. */
export function PlayerLink({ id, children }: { id: string; children: ReactNode }) {
  const select = useStore(s => s.selectPlayer);
  return <button className="link" onClick={e => { e.stopPropagation(); select(id); }}>{children}</button>;
}

/** A club's name as a link to its page. */
export function ClubLink({ id, children }: { id: string; children: ReactNode }) {
  const select = useStore(s => s.selectClub);
  return <button className="link" onClick={e => { e.stopPropagation(); select(id); }}>{children}</button>;
}

export const money = (v: number) => '£' + Math.round(v).toLocaleString('en-GB');
