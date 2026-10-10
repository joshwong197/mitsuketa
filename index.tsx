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
import Terms from './components/Terms';
import Privacy from './components/Privacy';
import { usesClerk } from './utils/propertyAuthClient';
const ClerkRoot = lazy(() => import('./components/ClerkRoot'));
const AccessPage = lazy(() => import('./components/AccessPage'));


// Search is the landing page; legal documents have their own hash routes.
type Page = 'home' | 'terms' | 'privacy';
function pageFromHash(): Page {
  const h = window.location.hash;

  if (h.indexOf('#/terms') === 0) return 'terms';
  if (h.indexOf('#/privacy') === 0) return 'privacy';
  return 'home';
}

function Root() {
  const [entered, setEntered] = useState(() => pageFromHash() === 'home');
  const [appVisited, setAppVisited] = useState(() => pageFromHash() === 'home');
  const [page, setPage] = useState<Page>(pageFromHash);

  useEffect(() => {
    const onHash = () => {
      const inApp = pageFromHash() === 'home';
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
  const legalPage = page === 'terms' ? <Terms onEnter={onEnter} />
    : page === 'privacy' ? <Privacy onEnter={onEnter} /> : null;
  return <>
    {appVisited && <div style={{ display: entered ? 'contents' : 'none' }} inert={!entered} aria-hidden={!entered}><App /></div>}
    {!entered && legalPage}
  </>;
}

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    {usesClerk() && import.meta.env.VITE_CLERK_PUBLISHABLE_KEY
      ? <Suspense fallback={<p>Loading Mitsuketa…</p>}><ClerkRoot><Root /></ClerkRoot></Suspense>
      : <Root />}
  </React.StrictMode>
);
