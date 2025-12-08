import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css'

// --- Global Error Handling for Startup ---
window.onerror = function(message, source, lineno, colno, error) {
  const root = document.getElementById('root');
  if (root) {
    root.innerHTML = `
      <div style="color: #ef4444; padding: 20px; font-family: monospace; background: #1a1a1a; min-height: 100vh;">
        <h1 style="font-size: 24px; margin-bottom: 10px;">Application Error</h1>
        <p style="margin-bottom: 20px;">An error occurred during startup:</p>
        <pre style="background: #262626; padding: 15px; border-radius: 8px; overflow: auto;">${error?.toString() || message}</pre>
        <p style="margin-top: 20px; color: #a3a3a3;">Source: ${source}:${lineno}:${colno}</p>
      </div>
    `;
  }
};

window.onunhandledrejection = function(event) {
  const root = document.getElementById('root');
  if (root) {
    root.innerHTML = `
      <div style="color: #ef4444; padding: 20px; font-family: monospace; background: #1a1a1a; min-height: 100vh;">
        <h1 style="font-size: 24px; margin-bottom: 10px;">Unhandled Promise Rejection</h1>
        <pre style="background: #262626; padding: 15px; border-radius: 8px; overflow: auto;">${event.reason}</pre>
      </div>
    `;
  }
};

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
