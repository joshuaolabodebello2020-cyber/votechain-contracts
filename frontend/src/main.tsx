import React from 'react';
import ReactDOM from 'react-dom/client';
// i18n must be imported before <App> so translations are ready on first render.
import './i18n';
import App from './App';
import './index.css';

if (import.meta.env.DEV) {
  await import('@axe-core/react').then(({ default: axe }) => {
    axe(React, ReactDOM, 1000);
  });
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
