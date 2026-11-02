import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { describe, expect, it } from 'vitest';

const source = readFileSync('public/sw.js', 'utf8');

function handlesRequest(path: string) {
  const listeners: Record<string, (event: unknown) => void> = {};
  let intercepted = false;
  runInNewContext(source, {
    URL,
    self: {
      location: { origin: 'https://app.example' },
      addEventListener: (name: string, handler: (event: unknown) => void) => { listeners[name] = handler; },
    },
  });
  listeners.fetch?.({
    request: { method: 'GET', url: `https://app.example${path}` },
    respondWith: () => { intercepted = true; },
  });
  return intercepted;
}

describe('service worker development module isolation', () => {
  it.each(['/node_modules/.vite/deps/react.js?v=old', '/src/main.tsx', '/@vite/client', '/@react-refresh', '/sw.js'])(
    'never intercepts %s', path => { expect(handlesRequest(path)).toBe(false); },
  );
});