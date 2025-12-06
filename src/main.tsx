import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css'

console.log("Iniciando aplicação...");

// Error Boundary Simples para capturar erros de renderização
class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean, error: Error | null }> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '20px', fontFamily: 'sans-serif', color: '#333' }}>
          <h1 style={{ color: '#d32f2f' }}>Algo deu errado.</h1>
          <p>Ocorreu um erro ao carregar a aplicação.</p>
          <div style={{ background: '#ffebee', padding: '15px', borderRadius: '5px', overflow: 'auto', border: '1px solid #ffcdd2', marginBottom: '20px' }}>
            <strong style={{ display: 'block', marginBottom: '10px' }}>Erro:</strong>
            <pre style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{this.state.error?.toString()}</pre>
          </div>
          <button 
            onClick={() => window.location.reload()}
            style={{ padding: '10px 20px', background: '#1976d2', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '16px' }}
          >
            Tentar Novamente
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

const rootElement = document.getElementById('root');

if (!rootElement) {
  console.error("Elemento 'root' não encontrado no DOM!");
} else {
  try {
    ReactDOM.createRoot(rootElement).render(
      <React.StrictMode>
        <ErrorBoundary>
          <App />
        </ErrorBoundary>
      </React.StrictMode>,
    )
    console.log("Aplicação montada com sucesso.");
  } catch (e) {
    console.error("Erro fatal ao montar a aplicação:", e);
  }
}
