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
import { AboutPage } from './components/AboutPage';
const RequestAccessPage = lazy(() => import('./components/RequestAccessPage'));
import { usesClerk } from './utils/propertyAuthClient';
const ClerkRoot = lazy(() => import('./components/ClerkRoot'));
const AccessPage = lazy(() => import('./components/AccessPage'));


// Search is the landing page; legal documents have their own hash routes.
type Page = 'home' | 'terms' | 'privacy' | 'about';
function pageFromHash(): Page {
  const h = window.location.hash;

  if (h.indexOf('#/terms') === 0) return 'terms';
  if (h.indexOf('#/privacy') === 0) return 'privacy';
  if (h.indexOf('#/about') === 0) return 'about';
  return 'home';
}

function Root() {
  const [entered, setEntered] = useState(() => window.location.hash === '#/app');
  const [appVisited, setAppVisited] = useState(() => pageFromHash() === 'home');
  const [page, setPage] = useState<Page>(pageFromHash);

  useEffect(() => {
    const onHash = () => {
      const inApp = pageFromHash() === 'home';
      setPage(pageFromHash()); setEntered(window.location.hash === '#/app');
      if (inApp) setAppVisited(true);
    };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);
  useEffect(() => { window.scrollTo(0, 0); }, [page]);

  const access = new URLSearchParams(window.location.search).get('access');
  if (access === 'request') return <Suspense fallback={<p>Loading application…</p>}><RequestAccessPage /></Suspense>;
  if (usesClerk() && access) return <Suspense fallback={<p>Loading Mitsuketa…</p>}><AccessPage mode={access} /></Suspense>;
  const onEnter = () => { window.location.hash = '/app'; setAppVisited(true); setEntered(true); };
  const legalPage = page === 'terms' ? <Terms onEnter={onEnter} />
    : page === 'privacy' ? <Privacy onEnter={onEnter} />
    : page === 'about' ? <AboutPage onClose={() => { window.location.hash = '/'; }} /> : null;
  return <>
    {appVisited && <div style={{ display: page === 'home' ? 'contents' : 'none' }} inert={page !== 'home'} aria-hidden={page !== 'home'}><App entrySearch={!entered && page === 'home'} /></div>}
    {page !== 'home' && legalPage}
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
