import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Public sign-up for the free test program (page /teste-gratuito.html). Open until 15/12/2026
// (São Paulo time). Each sign-up is delivered by "Comunicados" only to the main super admin
// of the Admin company. No login is needed, so every field is validated and limited here.
const DEADLINE = Date.parse('2026-12-16T03:00:00Z') // 16/12/2026 00:00 in São Paulo
const SYSTEM_SENDER_ID = '00000000-0000-0000-0000-0000000000c1'
const ADMIN_COMPANY_ID = '00000000-0000-0000-0000-0000000000a1'
const ALLOWED_ORIGINS = ['https://ewvon.vercel.app', 'http://localhost:8080', 'http://localhost:5173']
const TEAM = ['1 a 10 pessoas', '11 a 30 pessoas', '31 a 100 pessoas', 'Mais de 100 pessoas']
const FUNCS = ['Chat', 'Tarefas em quadro', 'Calendário e reuniões', 'Salas de reunião', 'War Room', 'Aniversariantes', 'Anotações', 'Atalhos do sistema', 'Painel individual', 'Feedbacks por e-mail e chat', 'App mobile']

const cors = (origin: string | null) => ({
  'Access-Control-Allow-Origin': origin && (ALLOWED_ORIGINS.includes(origin) || /^https:\/\/[a-z0-9-]+\.vercel\.app$/.test(origin)) ? origin : ALLOWED_ORIGINS[0],
  'Access-Control-Allow-Headers': 'content-type, accept',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  Vary: 'Origin',
})

// Plain text only: remove control chars and the characters the chat uses for formatting/links.
const clean = (v: unknown, max: number) =>
  typeof v === 'string' ? v.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/[*_~`[\]<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, max) : ''

// Small per-instance limiter (bots); the DB unique e-mail is the real guard against duplicates.
const hits = new Map<string, number[]>()
const limited = (ip: string) => {
  const now = Date.now(), list = (hits.get(ip) ?? []).filter((t) => now - t < 10 * 60e3)
  list.push(now); hits.set(ip, list)
  return list.length > 5
}

Deno.serve(async (req) => {
  const headers = { ...cors(req.headers.get('Origin')), 'Content-Type': 'application/json' }
  const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers })
  if (req.method === 'OPTIONS') return new Response(null, { headers })
  if (req.method !== 'POST') return reply({ error: 'Método não permitido' }, 405)
  if (Date.now() >= DEADLINE) return reply({ error: 'As inscrições foram encerradas.' }, 410)

  const ip = (req.headers.get('x-forwarded-for') ?? '').split(',')[0].trim() || 'unknown'
  if (limited(ip)) return reply({ error: 'Muitas tentativas. Tente mais tarde.' }, 429)

  let body: any
  try {
    const raw = await req.text()
    if (raw.length > 8000) return reply({ error: 'Dados muito grandes' }, 413)
    body = JSON.parse(raw)
  } catch { return reply({ error: 'Dados inválidos' }, 400) }

  const nome = clean(body?.nome, 120)
  const email = clean(body?.email, 160).toLowerCase()
  const telefone = clean(body?.telefone, 30)
  const empresa = clean(body?.empresa, 120)
  const cargo = clean(body?.cargo, 80)
  const equipe = TEAM.includes(body?.equipe) ? body.equipe : TEAM[0]
  const funcoes = Array.isArray(body?.funcoes) ? body.funcoes.filter((f: unknown) => typeof f === 'string' && FUNCS.includes(f)).slice(0, FUNCS.length) : []
  const uso = typeof body?.uso === 'string' ? body.uso.replace(/[\u0000-\u0009\u000b-\u001f\u007f]/g, ' ').replace(/[*_~`[\]<>]/g, '').trim().slice(0, 500) : ''
  const c = body?.consentimentos ?? {}
  const digits = telefone.replace(/\D/g, '')

  if (nome.length < 3) return reply({ error: 'Informe seu nome.' }, 400)
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return reply({ error: 'Informe um e-mail válido.' }, 400)
  if (digits.length < 10 || digits.length > 15) return reply({ error: 'Informe um WhatsApp ou telefone válido.' }, 400)
  if (empresa.length < 2) return reply({ error: 'Informe a empresa.' }, 400)
  if (c.ciencia_fase_de_testes !== true || c.sem_dados_confidenciais !== true || c.termos_e_privacidade !== true) {
    return reply({ error: 'Aceite os termos para continuar.' }, 400)
  }

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
  try {
    const record = {
      email, nome, telefone, empresa, cargo, equipe, funcoes, uso,
      novidades: c.novidades_lancamento === true,
      termos_versao: clean(body?.termos_versao, 10), aceito_em: new Date().toISOString(),
    }
    const { error: insertError } = await admin.from('beta_signups').insert(record)
    if (insertError?.code === '23505') return reply({ ok: true, duplicate: true }) // same e-mail already signed up
    if (insertError && !['42P01', 'PGRST205'].includes(insertError.code ?? '')) throw insertError // table not created yet: still deliver

    const { data: supers } = await admin.from('user_roles').select('user_id').eq('role', 'super_admin')
    const ids = (supers ?? []).map((r: any) => r.user_id)
    const { data: target } = ids.length
      ? await admin.from('profiles').select('id').in('user_id', ids).eq('company_id', ADMIN_COMPANY_ID).order('created_at').limit(1).maybeSingle()
      : { data: null }
    if (!target) throw new Error('super admin not found')

    const lines = [
      '*Nova inscrição no teste gratuito*',
      '',
      `Nome: ${nome}`,
      `E-mail: ${email}`,
      `WhatsApp/telefone: ${telefone}`,
      `Empresa: ${empresa}`,
      cargo ? `Cargo: ${cargo}` : '',
      `Equipe: ${equipe}`,
      funcoes.length ? `Funções de interesse: ${funcoes.join(', ')}` : '',
      uso ? `Como pretende usar: ${uso}` : '',
      `Quer novidades do lançamento: ${record.novidades ? 'sim' : 'não'}`,
      `Termos aceitos (versão ${record.termos_versao || '1.0'}) em ${new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}`,
    ].filter((l, i) => l !== '' || i === 1)
    const { error: dmError } = await admin.from('direct_messages').insert({
      sender_id: SYSTEM_SENDER_ID, receiver_id: target.id, content: lines.join('\n'), company_id: ADMIN_COMPANY_ID,
    })
    if (dmError) throw dmError
    return reply({ ok: true })
  } catch (error) {
    console.error('beta-signup error:', error)
    return reply({ error: 'Não foi possível enviar agora.' }, 500)
  }
})
