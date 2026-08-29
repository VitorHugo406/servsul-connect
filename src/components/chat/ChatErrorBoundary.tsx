import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertCircle, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Props { children: ReactNode; }
interface State { hasError: boolean; }

export class ChatErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[Nuvexa Chat] runtime error:', error, errorInfo);
  }

  handleRetry = () => {
    this.setState({ hasError: false });
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div className="flex h-full min-h-0 flex-col items-center justify-center gap-3 p-6 text-center">
        <AlertCircle className="h-10 w-10 text-warning" aria-hidden="true" />
        <div>
          <h3 className="font-display text-lg font-semibold text-foreground">Não foi possível carregar o chat</h3>
          <p className="mt-1 max-w-md text-sm text-muted-foreground">
            O restante do sistema continua disponível. Tente carregar o chat novamente.
          </p>
        </div>
        <Button type="button" variant="outline" onClick={this.handleRetry} className="gap-2">
          <RotateCcw className="h-4 w-4" />
          Tentar novamente
        </Button>
      </div>
    );
  }
}
