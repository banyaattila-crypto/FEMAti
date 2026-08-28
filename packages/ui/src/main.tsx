import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App.js';
import { ErrorBoundary } from './ErrorBoundary.js';

import './design/tokens.css';
import './design/base.css';
import './components/components.css';
import './shell/shell.css';

const host = document.getElementById('root');
if (!host) throw new Error('A #root elem hiányzik az index.html-ből.');

createRoot(host).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);
