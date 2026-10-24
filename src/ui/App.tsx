import { useEffect } from 'react';
import { useStore } from '../state/store';
import { useUpdateReady } from '../state/update';
import { Shell } from './Shell';
import { Create } from './screens/Create';
import { Offers } from './screens/Offers';
import { SeasonEnd } from './screens/SeasonEnd';
import { Legacy } from './screens/Legacy';
import { Menu } from './screens/Menu';

export function App() {
  const loaded = useStore(s => s.loaded);
  const game = useStore(s => s.game);
  const view = useStore(s => s.view);
  const boot = useStore(s => s.boot);
  useEffect(() => { void boot(); }, [boot]);

  const updateReady = useUpdateReady();
  const banner = updateReady ? <div className="update-banner" role="status"><span>A new version is ready.</span><button className="btn sm" onClick={() => location.reload()}>Reload</button></div> : null;

  if (!loaded) return null;
  const screen = !game ? (view === 'menu' ? <Menu /> : <Create />) : game.phase === 'offers' ? <Offers /> : game.phase === 'seasonEnd' ? <SeasonEnd /> : game.phase === 'retired' ? <Legacy /> : <Shell />;
  return <>{banner}{screen}</>;
}
