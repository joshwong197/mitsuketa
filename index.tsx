import React, { useState } from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import Landing from './components/Landing';

// Landing gate: the public homepage shows first; "Start searching" enters the
// app. State-only (a reload returns to the landing), which is what we want while
// this is in review.
function Root() {
  const [entered, setEntered] = useState(false);
  return entered ? <App /> : <Landing onEnter={() => setEntered(true)} />;
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
