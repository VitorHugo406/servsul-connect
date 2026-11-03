export function integrationRequestUrl(supabaseUrl: string, path: string) {
  const url = new URL('/functions/v1/api-integrations', supabaseUrl);
  if (url.protocol !== 'https:' && url.hostname !== 'localhost') throw new Error('Endereço da API inválido.');
  url.searchParams.set('path', path);
  return url.toString();
}