import React from 'react';
import { createRoot } from 'react-dom/client';
import { GraphViewer } from './components/GraphViewer';

const root = createRoot(document.getElementById('root')!);
root.render(<GraphViewer />);
