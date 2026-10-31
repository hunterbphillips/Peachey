import { useCallback, useEffect, useState } from 'react';
import { api } from './api/index.js';
import { Spinner } from './components/ui.jsx';
import { Composer } from './components/Composer.jsx';
import { SignIn } from './screens/SignIn.jsx';
import { Join } from './screens/Join.jsx';
import { Home } from './screens/Home.jsx';
import { Feed } from './screens/Feed.jsx';
import { EditProfile } from './screens/EditProfile.jsx';
import { Invites } from './screens/Invites.jsx';

const readRoute = () => window.location.hash.replace(/^#/, '') || '/';

export function App() {
  const [userId, setUserId] = useState(undefined); // undefined = still checking
  const [me, setMe] = useState(undefined);
  const [route, setRoute] = useState(readRoute);
  const [composer, setComposer] = useState(null); // null | { editing?: post }
  const [refreshKey, setRefreshKey] = useState(0);

  const loadMe = useCallback(async () => {
    try { setMe(await api.getMe()); } catch { setMe(null); }
  }, []);

  useEffect(() => {
    api.getUserId().then(setUserId);
    return api.onAuthChange((id) => setUserId(id));
  }, []);

  useEffect(() => {
    if (userId === undefined) return;
    if (userId === null) { setMe(null); return; }
    setMe(undefined);
    loadMe();
  }, [userId, loadMe]);

  useEffect(() => {
    const onHash = () => setRoute(readRoute());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  const go = useCallback((path) => { window.location.hash = path; }, []);

  let screen;
  if (userId === undefined || (userId && me === undefined)) {
    screen = <div className="center-fill"><Spinner /></div>;
  } else if (!userId) {
    screen = <SignIn />;
  } else if (!me) {
    screen = <Join onJoined={loadMe} />;
  } else {
    const compose = () => setComposer({});
    const edit = (post) => setComposer({ editing: post });
    const m = route.match(/^\/u\/([^/]+)$/);
    if (m) {
      screen = <Feed key={m[1]} userId={m[1]} me={me} go={go} onCompose={compose} onEdit={edit} refreshKey={refreshKey} />;
    } else if (route === '/me/edit') {
      screen = <EditProfile me={me} go={go} onSaved={loadMe} />;
    } else if (route === '/invites') {
      screen = <Invites me={me} go={go} />;
    } else {
      screen = <Home me={me} go={go} onCompose={compose} refreshKey={refreshKey} />;
    }
  }

  return (
    <div className="app">
      {api.isDemo && (
        <div className="demo-bar">
          Demo: nothing is saved.
          {userId && me && <button className="text-btn inline" onClick={() => api.signOut()}>See sign-in screens</button>}
        </div>
      )}
      {screen}
      {composer && (
        <Composer editing={composer.editing} onClose={() => setComposer(null)}
          onPosted={() => {
            const wasNew = !composer.editing;
            setComposer(null);
            setRefreshKey((k) => k + 1);
            if (wasNew) go(`/u/${me.id}`);
          }} />
      )}
    </div>
  );
}
