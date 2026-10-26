import { Component } from 'react';

export default class ErrorBoundary extends Component {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error) {
    console.error('[ui] render error:', error);
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-6">
        <div className="max-w-sm text-center">
          <h1 className="font-display font-semibold text-xl text-navy-950">Something went wrong</h1>
          <p className="mt-2 text-sm text-gray-500">An unexpected error occurred. Reloading usually fixes it.</p>
          <button
            onClick={() => window.location.assign('/dashboard')}
            className="mt-5 rounded-lg bg-spotter-blue px-4 py-2 text-sm font-medium text-white hover:bg-spotter-blue-dark"
          >
            Reload
          </button>
        </div>
      </div>
    );
  }
}
