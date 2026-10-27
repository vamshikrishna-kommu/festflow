import { Component, type ErrorInfo, type ReactNode } from 'react'
import { AlertTriangle, RotateCcw, Compass, Home } from 'lucide-react'
import { Button } from '@/components/ui'

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
  errorInfo: ErrorInfo | null
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
  }

  public static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error }
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({ errorInfo })
    console.error('[FestFlow Application Runtime Error]:', error, errorInfo)
  }

  private handleRetry = () => {
    this.setState({ hasError: false, error: null, errorInfo: null })
  }

  public render() {
    if (this.state.hasError) {
      const isDev = Boolean(import.meta.env?.DEV)

      return (
        <div className="min-h-screen flex items-center justify-center bg-[var(--color-surface-0)] p-4 sm:p-6">
          <div className="w-full max-w-lg p-6 sm:p-8 glass rounded-[var(--radius-card)] border border-rose-500/20 text-center shadow-2xl space-y-6">
            <div className="w-16 h-16 rounded-2xl bg-rose-500/10 text-rose-400 flex items-center justify-center mx-auto border border-rose-500/20 shadow-inner">
              <AlertTriangle size={32} />
            </div>

            <div className="space-y-2">
              <h1 className="text-2xl font-bold font-display text-[var(--color-text-primary)] tracking-tight">
                Something went wrong
              </h1>
              <p className="text-sm text-[var(--color-text-secondary)] leading-relaxed max-w-md mx-auto">
                FestFlow encountered an unexpected issue while loading this view. You can retry the action, discover upcoming campus events, or return home.
              </p>
            </div>

            {/* Development-only diagnostics (hidden in production) */}
            {isDev && this.state.error && (
              <div className="text-left bg-rose-950/30 border border-rose-500/30 rounded-xl p-3.5 space-y-2">
                <div className="text-[11px] font-semibold text-rose-300 uppercase tracking-wider flex items-center justify-between">
                  <span>Development Diagnostics</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-300">DEV ONLY</span>
                </div>
                <div className="text-xs font-mono text-rose-200 break-words font-medium">
                  {this.state.error.name}: {this.state.error.message}
                </div>
                {this.state.error.stack && (
                  <pre className="text-[10px] font-mono text-rose-400/90 overflow-x-auto max-h-36 overflow-y-auto whitespace-pre-wrap p-2 rounded bg-black/40">
                    {this.state.error.stack}
                  </pre>
                )}
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <Button
                variant="primary"
                className="w-full justify-center gap-2 shine-on-hover"
                onClick={this.handleRetry}
              >
                <RotateCcw size={15} /> Try Again
              </Button>
              <Button
                variant="outline"
                className="w-full justify-center gap-2 border-[var(--color-brand-cyan)]/30 text-[var(--color-brand-cyan)] hover:bg-[var(--color-brand-cyan)]/10"
                onClick={() => {
                  this.handleRetry()
                  window.location.href = '/discover'
                }}
              >
                <Compass size={15} /> Explore Events
              </Button>
              <Button
                variant="ghost"
                className="w-full justify-center gap-2"
                onClick={() => {
                  this.handleRetry()
                  window.location.href = '/'
                }}
              >
                <Home size={15} /> Home
              </Button>
            </div>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
