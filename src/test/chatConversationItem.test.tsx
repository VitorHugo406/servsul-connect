import { fireEvent, render, screen, waitFor, cleanup } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { ChatConversationItem } from '../components/chat/ChatConversationItem';
import { chatUnreadStorageKey, parseUnreadMarks } from '../lib/chatUnread';

vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ profile: { id: 'person', company_id: 'company' } }) }));

beforeEach(() => {
  localStorage.clear();
  window.HTMLElement.prototype.hasPointerCapture = () => false;
  window.HTMLElement.prototype.setPointerCapture = () => {};
  window.HTMLElement.prototype.releasePointerCapture = () => {};
});
afterEach(cleanup);

it('the unread menu saves a reminder, preserves it on remount, and opening clears it', async () => {
  const conversation = () => <ChatConversationItem conversationKey="dm:partner"><button>Conversa</button></ChatConversationItem>;
  const view = render(conversation());
  fireEvent.pointerDown(screen.getByRole('button', { name: 'Opções da conversa' }), { button: 0, ctrlKey: false, pointerType: 'mouse' });
  fireEvent.click(await screen.findByRole('menuitem', { name: 'Marcar como não lida' }));
  const key = chatUnreadStorageKey('company', 'person');
  await waitFor(() => expect(parseUnreadMarks(localStorage.getItem(key))).toEqual(['dm:partner']));
  view.unmount();
  render(conversation());
  fireEvent.pointerDown(screen.getByRole('button', { name: 'Opções da conversa' }), { button: 0, ctrlKey: false, pointerType: 'mouse' });
  expect(await screen.findByRole('menuitem', { name: 'Marcar como lida' })).toBeTruthy();
  fireEvent.keyDown(screen.getByRole('menu'), { key: 'Escape' });
  fireEvent.click(screen.getByRole('button', { name: 'Conversa' }));
  expect(parseUnreadMarks(localStorage.getItem(key))).toEqual([]);
});