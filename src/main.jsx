import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './index.css';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('Aledha App Error caught by boundary:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center p-4 bg-slate-950 text-white selection:bg-amber-400 selection:text-black">
          <div className="arcade-card text-center p-6 sm:p-8 max-w-md w-full space-y-4">
            <div className="text-4xl animate-bounce">⚠️</div>
            <h2 className="text-xl sm:text-2xl font-black text-amber-400">
              Something went wrong!
            </h2>
            <p className="text-slate-300 text-xs sm:text-sm font-semibold">
              {this.state.error?.message || 'An unexpected error occurred during the round.'}
            </p>
            <button
              onClick={() => window.location.reload()}
              className="btn-arcade btn-arcade-gold w-full text-base py-3 shadow-[3px_3px_0px_#000]"
            >
              Reload Game 🔄
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);
