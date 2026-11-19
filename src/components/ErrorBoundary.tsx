import { Component, type ReactNode } from 'react';

export class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  componentDidCatch(error: Error) {
    console.error(error);
  }
  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="min-h-full flex items-center justify-center p-6 bg-bg">
        <div className="card p-6 max-w-sm text-center">
          <div className="text-[20px] font-extrabold">Something went wrong</div>
          <p className="text-muted mt-2 text-[15px]">Your data is safe on this device. Reload to continue.</p>
          <pre className="text-left text-[11px] text-muted mt-3 whitespace-pre-wrap break-words max-h-32 overflow-auto">{this.state.error.message}</pre>
          <button className="btn-primary mt-4" onClick={() => location.reload()}>Reload</button>
        </div>
      </div>
    );
  }
}
