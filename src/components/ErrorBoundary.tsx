import { Component, type ErrorInfo, type ReactNode } from 'react'
import { AlertTriangle, RefreshCw, Home } from 'lucide-react'
import { Button } from '@/components/ui'

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  }

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[FestFlow Application Runtime Error]:', error, errorInfo)
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-[var(--color-surface-0)] p-4">
          <div className="w-full max-w-md p-8 glass rounded-[var(--radius-card)] border border-red-500/20 text-center shadow-2xl space-y-5">
            <div className="w-14 h-14 rounded-2xl bg-red-500/10 text-red-400 flex items-center justify-center mx-auto border border-red-500/20">
              <AlertTriangle size={28} />
            </div>

            <div>
              <h1 className="text-xl font-bold font-display text-[var(--color-text-primary)] mb-1">
                Something went wrong
              </h1>
              <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed">
                An unexpected application error occurred. We've logged this occurrence.
              </p>
            </div>

            {this.state.error && (
              <div className="p-3 bg-red-950/20 border border-red-500/20 rounded-xl text-left text-[11px] text-red-300 font-mono break-words max-h-32 overflow-y-auto">
                {this.state.error.message}
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-2.5 pt-2">
              <Button
                variant="primary"
                className="w-full justify-center gap-2"
                onClick={() => window.location.reload()}
              >
                <RefreshCw size={15} /> Reload Page
              </Button>
              <Button
                variant="ghost"
                className="w-full justify-center gap-2"
                onClick={() => {
                  this.setState({ hasError: false, error: null })
                  window.location.href = '/'
                }}
              >
                <Home size={15} /> Return Home
              </Button>
            </div>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
