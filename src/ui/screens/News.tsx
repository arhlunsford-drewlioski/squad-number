import { useState } from 'react';
import { NEWS_KINDS, newsFeed, type NewsKind } from '../../engine/news';
import { useStore } from '../../state/store';
import { ClubLink, Panel, PlayerLink } from '../components';

export function News() {
  const game = useStore(s => s.game)!;
  const read = useStore(s => s.readMessage);
  const [kind, setKind] = useState<NewsKind | 'all'>('all');
  const [open, setOpen] = useState<string | null>(null);
  const feed = newsFeed(game).filter(n => kind === 'all' || n.kind === kind);

  return (
    <Panel title="News" right={`${feed.length} items`} flush>
      <div style={{ padding: '8px 12px' }} className="seg" role="group" aria-label="Filter news">
        {NEWS_KINDS.map(k => <button key={k.id} aria-pressed={kind === k.id} onClick={() => setKind(k.id)}>{k.label}</button>)}
      </div>
      <table>
        <tbody>
          {feed.map(n => (
            <tr key={n.key} className={n.body ? 'click' : ''} onClick={() => { if (!n.body) return; setOpen(open === n.key ? null : n.key); if (n.msgId && n.unread) read(n.msgId); }}>
              <td className="l" style={{ whiteSpace: 'normal' }}>
                <span style={{ fontWeight: n.unread ? 700 : 400 }}>{n.title}</span>
                <div className="muted" style={{ fontSize: '0.85rem' }}>
                  {n.from}
                  {n.playerId && <> · <PlayerLink id={n.playerId}>player</PlayerLink></>}
                  {n.clubId && <> · <ClubLink id={n.clubId}>club</ClubLink></>}
                </div>
                {open === n.key && n.body && <p className="t2" style={{ marginTop: 6, maxWidth: '70ch', whiteSpace: 'pre-line' }}>{n.body}</p>}
              </td>
              <td className="muted" style={{ verticalAlign: 'top' }}>S{n.season} MD{n.week}</td>
            </tr>
          ))}
          {feed.length === 0 && <tr><td className="l muted">Nothing here yet.</td></tr>}
        </tbody>
      </table>
    </Panel>
  );
}
