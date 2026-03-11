import React from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { ErrorBoundary } from './components/ErrorBoundary';

const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(
    <ErrorBoundary
      onError={(error, errorInfo) => {
        // Log errors to console in development
        if (process.env.NODE_ENV === 'development') {
          console.error('Application Error:', error, errorInfo);
        }
      }}
    >
      <App />
    </ErrorBoundary>
  );
}


