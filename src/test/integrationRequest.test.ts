import { describe, expect, it } from 'vitest';
import { integrationRequestUrl } from '@/lib/integrationRequest';

describe('company API destination', () => {
  it('sends credential creation to the connected Supabase function, not the app host', () => {
    const url = new URL(integrationRequestUrl('https://scslfueixmuolkmgdslk.supabase.co', '/admin/integrations'));
    expect(url.origin).toBe('https://scslfueixmuolkmgdslk.supabase.co');
    expect(url.pathname).toBe('/functions/v1/api-integrations');
    expect(url.searchParams.get('path')).toBe('/admin/integrations');
  });
  it('rejects a missing address instead of posting to a relative app URL', () => {
    expect(() => integrationRequestUrl('undefined', '/admin/integrations')).toThrow();
  });
});