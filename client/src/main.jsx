import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';

import { App } from './App.jsx';

/*
 * ProxiSpeakMeet Global Styles
 *
 * Loading order:
 * 1. Tailwind CSS v4
 * 2. Existing application styles
 * 3. Brand compatibility
 * 4. Responsive overrides
 */

import './tailwind.css';
import './styles.css';
import './styles/brand-compat.css';
import './styles/responsive-overrides.css';

/*
 * Application Bootstrap
 */

const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error(
    'ProxiSpeakMeet: Root element #root was not found.'
  );
}

createRoot(rootElement).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>
);