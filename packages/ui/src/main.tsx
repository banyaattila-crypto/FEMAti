import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App.js';
import { ErrorBoundary } from './ErrorBoundary.js';

// Betűtípusok ÖNÁLLÓ kiszolgálása (publikálás előtti audit, 2026-09-06, PRIV-001).
// Korábban az `index.html` a Google Fonts CDN-ről töltötte őket, ami MINDEN
// látogató IP-címét és User-Agentjét elküldte a Google-nek — egy olyan
// alkalmazásnál, ami egyébként semmilyen adatot nem küld sehova (nincs backend,
// nincs analitika). EU-s nyilvános telepítésnél ez ismert GDPR-kockázat is.
// Mellékhatásként megszűnik egy külső, futásidejű hálózati függés, és gyorsul
// az első betöltés (nincs extra DNS + TLS kézfogás).
import '@fontsource/ibm-plex-sans/400.css';
import '@fontsource/ibm-plex-sans/500.css';
import '@fontsource/ibm-plex-sans/600.css';
import '@fontsource/ibm-plex-sans/700.css';
import '@fontsource/jetbrains-mono/400.css';
import '@fontsource/jetbrains-mono/500.css';
import '@fontsource/jetbrains-mono/600.css';
import '@fontsource/jetbrains-mono/700.css';
import '@fontsource/spectral/600.css';
import '@fontsource/spectral/700.css';
import '@fontsource/cormorant-garamond/600.css';
import '@fontsource/cormorant-garamond/700.css';

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
