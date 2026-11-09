import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
  fallbackDescription?: string;
  onReset?: () => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  showDetails: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
    showDetails: false,
  };

  public static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error,
      errorInfo: null,
      showDetails: false,
    };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[ErrorBoundary caught error]:', error, errorInfo);
    this.setState({ errorInfo });
  }

  private handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      showDetails: false,
    });
    if (this.props.onReset) {
      this.props.onReset();
    }
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="p-6 my-4 rounded-xl border border-destructive/30 bg-destructive/5 text-foreground backdrop-blur-md shadow-lg max-w-2xl mx-auto animate-in fade-in zoom-in-95 duration-200">
          <div className="flex items-start gap-3.5">
            <div className="p-2.5 rounded-lg bg-destructive/10 text-destructive shrink-0">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div className="flex-1 space-y-2">
              <h3 className="text-sm font-bold text-foreground tracking-tight">
                {this.props.fallbackTitle || 'Falha ao carregar este módulo'}
              </h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                {this.props.fallbackDescription ||
                  'Ocorreu uma instabilidade inesperada na renderização destes dados. Você pode tentar recarregar esta seção sem perder seus outros dados.'}
              </p>

              <div className="pt-2 flex items-center gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={this.handleReset}
                  className="h-8 text-xs font-semibold gap-1.5 border-destructive/30 hover:bg-destructive/10 text-destructive"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  Tentar novamente
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => this.setState({ showDetails: !this.state.showDetails })}
                  className="h-8 text-xs text-muted-foreground hover:text-foreground gap-1"
                >
                  {this.state.showDetails ? (
                    <>
                      <ChevronUp className="w-3.5 h-3.5" /> Ocultar detalhes técnicos
                    </>
                  ) : (
                    <>
                      <ChevronDown className="w-3.5 h-3.5" /> Detalhes do erro
                    </>
                  )}
                </Button>
              </div>

              {this.state.showDetails && (
                <div className="mt-3 p-3 rounded-lg bg-black/60 text-emerald-400 font-mono text-[11px] overflow-x-auto max-h-48 border border-border/40 select-all">
                  <div className="font-bold text-red-400 mb-1">
                    {this.state.error?.toString()}
                  </div>
                  <pre className="whitespace-pre-wrap text-[10px] text-neutral-400">
                    {this.state.errorInfo?.componentStack || this.state.error?.stack}
                  </pre>
                </div>
              )}
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
