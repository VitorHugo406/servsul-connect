// Link preview for the chat (WhatsApp-like card): reads Open Graph / <title> / description
// of a public web page. Only for signed-in users (verify_jwt), only http(s) on public hosts,
// HTML only, max 400 KB, 6 s timeout.
const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}
const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { ...cors, 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=86400' } })

function blockedHost(h: string) {
  const host = h.toLowerCase().replace(/^\[|\]$/g, '')
  if (host === 'localhost' || host.endsWith('.local') || host.endsWith('.internal') || host.endsWith('.localhost') || !host.includes('.')) return true
  if (/^\d+\.\d+\.\d+\.\d+$/.test(host)) {
    const [a, b] = host.split('.').map(Number)
    return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127) || a >= 224
  }
  if (host.includes(':')) return true // IPv6 literals: not needed for previews
  return false
}

const decode = (s: string) => s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;|&#x27;/g, "'").replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n)).trim()
function meta(html: string, keys: string[]) {
  for (const k of keys) {
    const re = new RegExp(`<meta[^>]+(?:property|name)=["']${k}["'][^>]*>`, 'i')
    const tag = html.match(re)?.[0]
    const content = tag?.match(/content=["']([^"']*)["']/i)?.[1]
    if (content) return decode(content)
  }
  return ''
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  try {
    const { url } = await req.json().catch(() => ({})) as { url?: string }
    let u: URL
    try { u = new URL(String(url || '')) } catch { return json({ error: 'URL inválida' }, 400) }
    if (!/^https?:$/.test(u.protocol) || blockedHost(u.hostname) || (u.port && !['80', '443', ''].includes(u.port))) return json({ error: 'URL não permitida' }, 400)

    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), 6000)
    const res = await fetch(u.toString(), { signal: ctrl.signal, redirect: 'follow', headers: { 'User-Agent': 'Mozilla/5.0 (compatible; ewvon-link-preview/1.0)', 'Accept': 'text/html,application/xhtml+xml', 'Accept-Language': 'pt-BR,pt;q=0.9,en;q=0.6' } })
    const final = new URL(res.url || u.toString())
    if (blockedHost(final.hostname)) { clearTimeout(timer); return json({ error: 'URL não permitida' }, 400) }
    const type = res.headers.get('content-type') || ''
    if (!res.ok || !/text\/html|application\/xhtml/i.test(type)) { clearTimeout(timer); return json({ url: final.toString(), site: final.hostname.replace(/^www\./, '') }) }

    // Read at most 400 KB.
    const reader = res.body!.getReader()
    const chunks: Uint8Array[] = []
    let size = 0
    while (size < 400_000) {
      const { done, value } = await reader.read()
      if (done || !value) break
      chunks.push(value); size += value.length
      if (new TextDecoder().decode(value).includes('</head>')) break
    }
    try { await reader.cancel() } catch { /* ignore */ }
    clearTimeout(timer)
    const html = new TextDecoder().decode(chunks.reduce((a, c) => { const m = new Uint8Array(a.length + c.length); m.set(a); m.set(c, a.length); return m }, new Uint8Array()))

    const title = meta(html, ['og:title', 'twitter:title']) || decode(html.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1] || '')
    const description = meta(html, ['og:description', 'twitter:description', 'description'])
    let image = meta(html, ['og:image', 'og:image:url', 'twitter:image', 'twitter:image:src'])
    if (image) { try { image = new URL(image, final).toString() } catch { image = '' } }
    if (image && !/^https:\/\//.test(image)) image = ''
    const site = meta(html, ['og:site_name']) || final.hostname.replace(/^www\./, '')
    return json({ url: final.toString(), title: title.slice(0, 160), description: description.slice(0, 300), image, site: site.slice(0, 60) })
  } catch {
    return json({ error: 'Não foi possível gerar a prévia' }, 200)
  }
})
