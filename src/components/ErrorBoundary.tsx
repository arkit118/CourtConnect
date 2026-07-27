import { Component, ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

// Top-level safety net: if anything in the tree throws during render (a
// bad prop, a crashed third-party component, etc.), React would otherwise
// unmount the whole app and leave a blank page with little or no visible
// console signal in production. This catches that and shows a fallback
// instead, with a "reload" affordance and a way back to signing in.
export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: unknown, info: unknown) {
    console.error('CourtConnect crashed:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
          <div className="max-w-md text-center">
            <h1 className="text-2xl font-bold text-secondary-900 mb-2">Something went wrong.</h1>
            <p className="text-secondary-600 mb-6">Please refresh or try signing in again.</p>
            <div className="flex items-center justify-center gap-3">
              <button onClick={() => window.location.reload()} className="btn-primary">
                Refresh Page
              </button>
              <a href="/auth/login" className="btn-outline">
                Sign In Again
              </a>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
