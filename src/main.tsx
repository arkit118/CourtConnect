import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Capacitor } from '@capacitor/core';
import { Analytics } from '@vercel/analytics/react';
import App from './App.tsx';
import { ErrorBoundary } from './components/ErrorBoundary.tsx';
import { initNativeApp } from './lib/nativeInit.ts';
import './index.css';

// Vercel Analytics fetches /_vercel/insights/script.js, a route that only
// exists on the Vercel-hosted web deployment - the Capacitor iOS app
// serves its bundle from the capacitor:// scheme, so that request always
// fails there ("Vercel Web Analytics failed to load script..."). Skip
// mounting it entirely on native platforms; the web build is unaffected
// since Capacitor.isNativePlatform() is false there.
const isNativeApp = Capacitor.isNativePlatform();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
    {!isNativeApp && <Analytics />}
  </StrictMode>
);

void initNativeApp();
