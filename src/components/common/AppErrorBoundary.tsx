import React, { Component, type ErrorInfo, type ReactNode } from "react";

interface AppErrorBoundaryProps {
  children: ReactNode;
}

interface AppErrorBoundaryState {
  hasError: boolean;
}

export class AppErrorBoundary extends Component<AppErrorBoundaryProps, AppErrorBoundaryState> {
  state: AppErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): AppErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[Nuvexa] Falha ao renderizar a área principal:", error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <main
          role="alert"
          className="flex min-h-[60vh] flex-col items-center justify-center gap-3 bg-background px-6 text-center text-foreground"
        >
          <h2 className="text-lg font-semibold">Não foi possível carregar esta área</h2>
          <p className="max-w-md text-sm text-muted-foreground">
            O restante do sistema não precisa ser perdido por causa desta falha. Recarregue a área e, se o erro continuar, informe o suporte.
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
          >
            Recarregar sistema
          </button>
        </main>
      );
    }

    return this.props.children;
  }
}
