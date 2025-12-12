import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css'

// --- SISTEMA DE DIAGNÓSTICO DE ERROS CRÍTICOS ---
// Isso garante que se a tela ficar branca, o erro será mostrado.

function renderError(title: string, message: any, stack?: string) {
  const root = document.getElementById('root');
  if (root) {
    root.innerHTML = `
      <div style="
        position: fixed; top: 0; left: 0; width: 100%; height: 100%;
        background: #1a1a1a; color: #ff6b6b; padding: 40px;
        font-family: monospace; overflow: auto; z-index: 9999;
      ">
        <h1 style="font-size: 24px; margin-bottom: 20px; border-bottom: 1px solid #333; padding-bottom: 10px;">
          🛑 Erro Crítico de Inicialização
        </h1>
        <div style="background: #2a2a2a; padding: 20px; border-radius: 8px; border: 1px solid #444;">
          <h2 style="margin-top: 0; color: #fff; font-size: 18px;">${title}</h2>
          <p style="font-size: 16px; line-height: 1.5; color: #ff8787;">${message}</p>
          ${stack ? `<pre style="margin-top: 20px; padding: 15px; background: #000; border-radius: 4px; overflow-x: auto; color: #ccc; font-size: 12px;">${stack}</pre>` : ''}
        </div>
        <button onclick="window.location.reload()" style="
          margin-top: 30px; padding: 12px 24px; background: #3b82f6; color: white;
          border: none; border-radius: 6px; cursor: pointer; font-size: 16px; font-weight: bold;
        ">
          Tentar Recarregar Página
        </button>
      </div>
    `;
  }
  console.error('CRITICAL ERROR:', message);
}

window.onerror = function(msg, source, lineno, colno, error) {
  renderError('Erro de Script (Global)', `${msg}\n\nSource: ${source}:${lineno}:${colno}`, error?.stack);
};

window.onunhandledrejection = function(event) {
  renderError('Promessa Rejeitada (Unhandled Rejection)', event.reason);
};

// --- INICIALIZAÇÃO DO REACT ---

try {
  const rootElement = document.getElementById('root');
  if (!rootElement) throw new Error("Elemento 'root' não encontrado no HTML.");

  ReactDOM.createRoot(rootElement).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  )
} catch (error: any) {
  renderError('Falha ao Montar React', error.message, error.stack);
}
