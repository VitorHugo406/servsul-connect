/** Teams-style tab strip in the conversation header. "Chat" is the current view; "Arquivos" opens the existing media sheet. */
export function ChatHeaderTabs({ files = true }: { files?: boolean }) {
  const openFiles = (el: HTMLElement) => el.closest('.chat-thread-header')?.querySelector<HTMLElement>('[title="Mídia e arquivos"]')?.click();
  return <div className="chat-head-tabs" role="tablist" aria-label="Seções da conversa">
    <button type="button" role="tab" aria-selected="true" className="chat-head-tab">Chat</button>
    {files ? <button type="button" role="tab" aria-selected="false" className="chat-head-tab" onClick={(e) => openFiles(e.currentTarget)}>Arquivos</button> : null}
  </div>;
}
