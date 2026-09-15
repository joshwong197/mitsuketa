import React, { useState, useEffect, lazy, Suspense } from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import './components/sumi-surfaces.css';
import './components/entity-record.css';
import 'reactflow/dist/style.css';
import '@fontsource/shippori-mincho/500.css';
import '@fontsource/shippori-mincho/700.css';
import '@fontsource/zen-kaku-gothic-new/400.css';
import '@fontsource/zen-kaku-gothic-new/500.css';
import '@fontsource/zen-kaku-gothic-new/700.css';
import App from './App';
import Landing from './components/Landing';
import About from './components/About';
import Terms from './components/Terms';
import Privacy from './components/Privacy';
import { usesClerk } from './utils/propertyAuthClient';
const ClerkRoot = lazy(() => import('./components/ClerkRoot'));
const AccessPage = lazy(() => import('./components/AccessPage'));
const ReviewOverlay = import.meta.env.DEV ? lazy(() => import('./components/ReviewOverlay')) : null;

// Marketing pages route off the URL hash (#/about, #/terms); everything else is
// Home. "Start searching" leaves the marketing site and mounts the app.
type Page = 'home' | 'about' | 'terms' | 'privacy';
function pageFromHash(): Page {
  const h = window.location.hash;
  if (h.indexOf('#/about') === 0) return 'about';
  if (h.indexOf('#/terms') === 0) return 'terms';
  if (h.indexOf('#/privacy') === 0) return 'privacy';
  return 'home';
}

function Root() {
  const [entered, setEntered] = useState(() => window.location.hash === '#/app');
  const [appVisited, setAppVisited] = useState(() => window.location.hash === '#/app');
  const [page, setPage] = useState<Page>(pageFromHash);

  useEffect(() => {
    const onHash = () => {
      const inApp = window.location.hash === '#/app';
      setPage(pageFromHash()); setEntered(inApp);
      if (inApp) setAppVisited(true);
    };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);
  useEffect(() => { window.scrollTo(0, 0); }, [page]);

  const access = new URLSearchParams(window.location.search).get('access');
  if (usesClerk() && access) return <Suspense fallback={<p>Loading Mitsuketa…</p>}><AccessPage mode={access} /></Suspense>;
  const onEnter = () => { window.location.hash = '/app'; setAppVisited(true); setEntered(true); };
  const marketingPage = page === 'about' ? <About onEnter={onEnter} />
    : page === 'terms' ? <Terms onEnter={onEnter} />
    : page === 'privacy' ? <Privacy onEnter={onEnter} /> : <Landing onEnter={onEnter} />;
  return <>
    {appVisited && <div style={{ display: entered ? 'contents' : 'none' }} inert={!entered} aria-hidden={!entered}><App /></div>}
    {!entered && marketingPage}
  </>;
}

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    {ReviewOverlay && <Suspense fallback={null}><ReviewOverlay /></Suspense>}
    {usesClerk() && import.meta.env.VITE_CLERK_PUBLISHABLE_KEY
      ? <Suspense fallback={<p>Loading Mitsuketa…</p>}><ClerkRoot><Root /></ClerkRoot></Suspense>
      : <Root />}
  </React.StrictMode>
);
