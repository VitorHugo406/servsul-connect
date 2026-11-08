// Keeps a broken or outdated tab from freezing the whole app: shows a small message with
// "Tentar de novo" / "Atualizar" instead of an endless loading screen.
import { Component } from 'react';
import type { ReactNode } from 'react';
import { isChunkError, reloadForNewVersion } from '@/lib/lazyRetry';

interface State { error: Error | null }
export class SectionBoundary extends Component<{ children: ReactNode; resetKey?: string }, State> {
  state: State = { error: null };
  static getDerivedStateFromError(error: Error): State { return { error }; }
  componentDidCatch(error: Error) {
    console.error('Section error:', error);
    if (isChunkError(error)) reloadForNewVersion();
  }
  componentDidUpdate(prev: { resetKey?: string }) {
    if (prev.resetKey !== this.props.resetKey && this.state.error) this.setState({ error: null });
  }
  render() {
    if (!this.state.error) return this.props.children;
    const outdated = isChunkError(this.state.error);
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3 p-8 text-center" role="alert">
        <p className="text-base font-semibold text-foreground">{outdated ? 'Há uma nova versão do ewvon' : 'Esta tela não carregou'}</p>
        <p className="max-w-sm text-sm text-muted-foreground">{outdated ? 'Atualize a página para carregar a versão mais recente.' : 'Tente de novo. Se continuar, atualize a página.'}</p>
        <div className="flex gap-2">
          {!outdated ? <button type="button" className="rounded-xl border px-4 py-2 text-sm font-medium" onClick={() => this.setState({ error: null })}>Tentar de novo</button> : null}
          <button type="button" className="rounded-xl bg-foreground px-4 py-2 text-sm font-medium text-background" onClick={() => window.location.reload()}>Atualizar página</button>
        </div>
      </div>
    );
  }
}
