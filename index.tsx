import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
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

// Marketing pages route off the URL hash (#/about, #/terms); everything else is
// Home. "Start searching" leaves the marketing site and mounts the app.
type Page = 'home' | 'about' | 'terms';
function pageFromHash(): Page {
  const h = window.location.hash;
  if (h.indexOf('#/about') === 0) return 'about';
  if (h.indexOf('#/terms') === 0) return 'terms';
  return 'home';
}

function Root() {
  const [entered, setEntered] = useState(() => window.location.hash === '#/app');
  const [page, setPage] = useState<Page>(pageFromHash);

  useEffect(() => {
    const onHash = () => setPage(pageFromHash());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);
  useEffect(() => { window.scrollTo(0, 0); }, [page]);

  if (entered) return <App />;
  const onEnter = () => { window.location.hash = '/app'; setEntered(true); };
  if (page === 'about') return <About onEnter={onEnter} />;
  if (page === 'terms') return <Terms onEnter={onEnter} />;
  return <Landing onEnter={onEnter} />;
}

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>
);
