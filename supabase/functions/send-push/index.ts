// Web Push for the installed app (PWA). Called by the enqueue_web_push() trigger
// (pg_net) for every new DM, sector message, group message and notice. Picks the
// recipients, skips the author and muted chats, and sends a WhatsApp-like payload:
// title = person / group / sector, body = message preview, icon = photo.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import webpush from 'npm:web-push@3.6.7'

// Large icon per type (Android shows it next to the text); ?v busts old cached logos.
const SITE = 'https://ewvon.vercel.app'
const IC = {
  person: `${SITE}/icons/notify-person.png?v=3`, group: `${SITE}/icons/notify-group.png?v=3`, sector: `${SITE}/icons/notify-sector.png?v=3`,
  notice: `${SITE}/icons/notify-notice.png?v=3`, birthday: `${SITE}/icons/notify-birthday.png?v=3`,
}
const BADGE = `${SITE}/icons/badge-96.png?v=3`
const photo = (u: unknown) => (typeof u === 'string' && /^https:\/\//.test(u) ? u : null)
const GERAL = '00000000-0000-0000-0000-000000000001'
const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { 'Content-Type': 'application/json' } })

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = Record<string, any>

function preview(content: string): string {
  const c = String(content || '').trim()
  if (/^✨ sticker:/.test(c)) return '✨ Figurinha'
  const lines = c.split('\n')
  const text = lines.filter((l) => !/^(📷|📎) \[.+?\]\(.+?\)$/.test(l) && !/^(📝|🏷️|⚡|📅|📌) /.test(l)).join(' ').replace(/^📋 Card #\d+ — /, '📋 ').trim()
  if (text) return text.length > 140 ? text.slice(0, 139) + '…' : text
  const imgs = lines.filter((l) => l.startsWith('📷 ')).length
  if (imgs) return imgs > 1 ? `📷 ${imgs} fotos` : '📷 Foto'
  const file = c.match(/^📎 \[(.+?)\]/m)
  return file ? `📎 ${file[1]}` : 'Nova mensagem'
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'method' }, 405)
  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
  const secret = req.headers.get('x-push-secret') || ''
  const { data: cfg } = await admin.rpc('push_config', { _secret: secret })
  const keys = Array.isArray(cfg) ? cfg[0] : cfg
  if (!keys?.private_key) return json({ error: 'Unauthorized' }, 401)
  webpush.setVapidDetails('mailto:ewvonsuporte@gmail.com', keys.public_key, keys.private_key)

  const { table, record: r } = await req.json().catch(() => ({})) as { table?: string; record?: Row }
  if (!table || !r) return json({ error: 'bad request' }, 400)

  const profile = async (id: string) => (await admin.from('profiles').select('id, name, display_name, avatar_url, company_id, sector_id').eq('id', id).maybeSingle()).data as Row | null
  const nm = (p: Row | null) => (p ? p.display_name || p.name : 'Alguém')
  let recipients: string[] = []
  let chatKey: (rid: string) => string | null = () => null
  let payload: Row

  if (table === 'direct_messages') {
    const from = await profile(r.sender_id)
    recipients = [r.receiver_id]
    chatKey = () => `dm:${r.sender_id}`
    payload = { kind: 'message', title: nm(from), body: preview(r.content), icon: photo(from?.avatar_url) || IC.person, tag: `dm:${r.sender_id}`, url: `/?chat=${encodeURIComponent(`dm:${r.sender_id}`)}`, group: nm(from) }
  } else if (table === 'private_group_messages') {
    const [from, { data: g }, { data: mem }] = await Promise.all([
      profile(r.sender_id),
      admin.from('private_groups').select('id, name, avatar_url').eq('id', r.group_id).maybeSingle(),
      admin.from('private_group_members').select('profile_id').eq('group_id', r.group_id),
    ])
    recipients = (mem || []).map((m: Row) => m.profile_id)
    chatKey = () => `group:${r.group_id}`
    payload = { kind: 'message', title: g?.name || 'Grupo', body: `${nm(from).split(' ')[0]}: ${preview(r.content)}`, icon: photo(g?.avatar_url) || IC.group, tag: `group:${r.group_id}`, url: `/?chat=${encodeURIComponent(`group:${r.group_id}`)}`, sender: nm(from) }
  } else if (table === 'messages') {
    const [from, { data: sector }] = await Promise.all([profile(r.author_id), admin.from('sectors').select('id, name').eq('id', r.sector_id).maybeSingle()])
    let q = admin.from('profiles').select('id').eq('company_id', r.company_id).eq('is_active', true)
    if (r.sector_id !== GERAL) q = q.eq('sector_id', r.sector_id)
    recipients = ((await q).data || []).map((p: Row) => p.id)
    chatKey = () => `sector:${r.sector_id}`
    payload = { kind: 'message', title: sector?.name || 'Setor', body: `${nm(from).split(' ')[0]}: ${preview(r.content)}`, icon: IC.sector, tag: `sector:${r.sector_id}`, url: `/?chat=${encodeURIComponent(`sector:${r.sector_id}`)}`, sender: nm(from) }
  } else if (table === 'announcements') {
    if (r.start_at && new Date(r.start_at).getTime() > Date.now() + 60_000) return json({ skipped: 'scheduled' })
    const [{ data: people }, { data: company }] = await Promise.all([
      admin.from('profiles').select('id').eq('company_id', r.company_id).eq('is_active', true),
      admin.from('companies').select('name, logo_url').eq('id', r.company_id).maybeSingle(),
    ])
    recipients = (people || []).map((p: Row) => p.id)
    const urgent = r.priority === 'urgent' || r.priority === 'high' || r.is_pinned
    payload = { kind: 'notice', title: `📢 ${r.title}`, body: String(r.content || '').replace(/\s+/g, ' ').slice(0, 180), icon: IC.notice, tag: `notice:${r.id}`, url: '/?tab=notices', urgent, company: company?.name || 'ewvon' }
  } else if (table === 'birthday_daily') {
    // Called once a day by pg_cron: everyone in the company hears about today's birthdays.
    const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }))
    const md = `${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
    const { data: all } = await admin.from('profiles').select('id, name, display_name, company_id, birth_date').eq('is_active', true).not('birth_date', 'is', null)
    const today = (all || []).filter((p: Row) => String(p.birth_date).slice(5, 10) === md)
    let sentAll = 0
    for (const companyId of [...new Set(today.map((p: Row) => p.company_id))]) {
      const people = today.filter((p: Row) => p.company_id === companyId)
      const names = people.map((p: Row) => nm(p))
      const ids = (all || []).filter((p: Row) => p.company_id === companyId).map((p: Row) => p.id)
      const { data: subs } = await admin.from('web_push_subscriptions').select('endpoint, p256dh, auth, profile_id').in('profile_id', ids)
      for (const s of subs || []) {
        const own = people.some((p: Row) => p.id === s.profile_id)
        const others = names.filter((_, i) => people[i].id !== s.profile_id)
        const body = own && !others.length ? 'Feliz aniversário! 🎉 A equipe toda deseja um dia incrível.'
          : `Hoje é aniversário de ${others.join(', ').replace(/, ([^,]*)$/, ' e $1')}. Mande os parabéns! 🎉`
        try {
          await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, JSON.stringify({ kind: 'birthday', title: own && !others.length ? '🎂 Parabéns!' : '🎂 Aniversário hoje', body, icon: IC.birthday, badge: BADGE, tag: `birthday:${md}`, url: '/?tab=birthdays', at: Date.now() }), { TTL: 60 * 60 * 12 })
          sentAll++
        } catch (e) {
          const code = (e as { statusCode?: number }).statusCode
          if (code === 404 || code === 410) await admin.from('web_push_subscriptions').delete().eq('endpoint', s.endpoint)
        }
      }
    }
    return json({ sent: sentAll, birthdays: today.length })
  } else {
    return json({ skipped: table })
  }

  const author = r.sender_id || r.author_id
  recipients = [...new Set(recipients)].filter((id) => id && id !== author)
  if (!recipients.length) return json({ sent: 0 })

  // Respect muted conversations (chat_member_prefs).
  if (payload.kind === 'message') {
    const { data: prefs } = await admin.from('chat_member_prefs').select('profile_id, chat_key, muted, muted_until').in('profile_id', recipients).eq('muted', true)
    const muted = new Set((prefs || []).filter((p: Row) => !p.muted_until || new Date(p.muted_until).getTime() > Date.now()).filter((p: Row) => p.chat_key === chatKey(p.profile_id)).map((p: Row) => p.profile_id))
    recipients = recipients.filter((id) => !muted.has(id))
  }

  const { data: subs } = await admin.from('web_push_subscriptions').select('endpoint, p256dh, auth, profile_id').in('profile_id', recipients)
  const body = JSON.stringify({ ...payload, badge: BADGE, at: Date.now() })
  let sent = 0
  await Promise.all((subs || []).map(async (s: Row) => {
    try {
      await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, body, { TTL: 60 * 60 * 24, urgency: payload.kind === 'notice' || payload.kind === 'message' ? 'high' : 'normal', topic: undefined })
      sent++
    } catch (e) {
      const code = (e as { statusCode?: number }).statusCode
      if (code === 404 || code === 410) await admin.from('web_push_subscriptions').delete().eq('endpoint', s.endpoint)
      else console.error('push error', code, (e as Error).message)
    }
  }))
  return json({ sent, devices: subs?.length || 0 })
})
