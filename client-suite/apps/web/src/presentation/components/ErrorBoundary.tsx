import { Component, type ReactNode, type ErrorInfo } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ErrorBoundary]', error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center h-screen gap-4 p-8">
          <h1 className="text-xl font-semibold text-text-primary">应用出现异常</h1>
          <p className="text-sm text-text-secondary max-w-[480px] text-center">
            {this.state.error?.message ?? '未知错误'}
          </p>
          <button
            onClick={() => { this.setState({ hasError: false, error: null }); }}
            className="px-5 py-2 rounded-lg bg-primary text-white text-sm cursor-pointer border-none"
          >
            重试
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
