import { Component, type ReactNode, type ErrorInfo } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class CockpitErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[Cockpit ErrorBoundary]', error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center h-full gap-4 p-8">
          <div className="w-12 h-12 rounded-xl bg-red-500/10 flex items-center justify-center">
            <span className="material-symbols-outlined text-red-400" style={{ fontSize: 28 }}>
              warning
            </span>
          </div>
          <h2 className="text-lg font-semibold text-slate-200">工作台渲染异常</h2>
          <p className="text-sm text-slate-400 max-w-[480px] text-center">
            {this.state.error?.message ?? '未知渲染错误'}
          </p>
          <button
            type="button"
            onClick={() => this.setState({ hasError: false, error: null })}
            className="px-5 py-2 rounded-lg bg-primary text-white text-sm hover:opacity-90 transition-opacity"
          >
            重试
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
