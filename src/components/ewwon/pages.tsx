// Full-screen pages of the Ewwon mobile app (#pg stack).
import { useEffect, useRef, useState } from 'react';
import type { EwApi } from './EwwonApp';
import { Av, Seg, Tg, avStyle, covStyle } from './EwwonApp';
import * as D from './data';
import type { Chat, Summary } from './data';
import * as N from './notify';
import { I, Chev } from './icons';
import { ST, StatusKey, fitTextarea } from './util';
import { MyEvaluationsBox, EvaluationPage } from './evals';
import { InstallAppBox } from './installapp';

export type PageSpec =
  | { kind: 'profile'; id: string }
  | { kind: 'members'; key: string; tab: number }
  | { kind: 'summary'; key: string }
  | { kind: 'groupEdit'; key: string }
  | { kind: 'settings' }
  | { kind: 'muted' }
  | { kind: 'support' }
  | { kind: 'ticket'; id: number; label: string; staff: boolean; title?: string }
  | { kind: 'eval'; id: string };

export function EwwonPage({ spec, api }: { spec: PageSpec; api: EwApi }) {
  switch (spec.kind) {
    case 'profile': return <ProfilePage id={spec.id} api={api} />;
    case 'members': return <MembersPage chatKey={spec.key} initialTab={spec.tab} api={api} />;
    case 'summary': return <SummaryPage chatKey={spec.key} api={api} />;
    case 'groupEdit': return <GroupEditPage chatKey={spec.key} api={api} />;
    case 'settings': return <SettingsPage api={api} />;
    case 'muted': return <MutedPage api={api} />;
    case 'support': return <SupportPage api={api} />;
    case 'ticket': return <TicketChat spec={spec} api={api} />;
    case 'eval': return <EvaluationPage id={spec.id} api={api} />;
    default: return null;
  }
}

const DAYS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];

function ProfilePage({ id, api }: { id: string; api: EwApi }) {
  const p = api.people[id];
  const [uploading, setUploading] = useState<string | null>(null);
  if (!p) return <div className="hint" style={{ padding: 40 }}>Perfil indisponível</div>;
  const me = id === api.me.id;
  const s = ST[p.st];
  const showHours = me || api.prefs.showhr !== 0 || true;
  const now = new Date();
  const working = (() => {
    const idx = (now.getDay() + 6) % 7;
    if (!p.days[idx]) return false;
    const m = now.getHours() * 60 + now.getMinutes();
    const t = (x: string) => +x.slice(0, 2) * 60 + +x.slice(3, 5);
    return m >= t(p.h[0]) && m <= t(p.h[1]) && p.st !== 'fora';
  })();
  const dash = api.boot.dashboard;
  const stats = [dash.meetToday, dash.open, dash.doneMonth];

  const upload = (kind: 'avatar' | 'cover') => api.pickImg(async (file, dataUrl) => {
    setUploading(kind);
    api.patchPerson(p.id, (x) => (kind === 'avatar' ? { ...x, photo: dataUrl } : { ...x, cover: dataUrl }));
    const url = await api.sv(D.uploadImage(file, kind, kind === 'avatar' ? 512 : 1400));
    if (url) {
      api.patchPerson(p.id, (x) => (kind === 'avatar' ? { ...x, photo: url } : { ...x, cover: url }));
      await api.sv(D.setMyImage(kind, url));
      api.toast(kind === 'avatar' ? 'Foto atualizada' : 'Capa atualizada');
    }
    setUploading(null);
  });

  return (
    <>
      <div className="cov" style={covStyle(p)}>
        {me ? <button className="btn sm cvb" id="cvb" onClick={() => upload('cover')} disabled={!!uploading}><I n="camera" />{uploading === 'cover' ? 'Enviando…' : 'Capa'}</button> : null}
      </div>
      <div className="pfh">
        <div className="avw"><Av p={p} cls="xxl" st={p.st} />{me ? <button className="cam" id="avb" aria-label="Alterar foto" onClick={() => upload('avatar')}><I n="camera" /></button> : null}</div>
        <div className="pfn"><h2>{p.n}</h2><p>{p.role} · {p.dept}</p></div>
      </div>
      <div className="pbody">
        {me ? (
          <div className="box"><h4>Meu status</h4>
            <div className="stc">{(Object.keys(ST) as StatusKey[]).map((k) => <button key={k} className={k === p.st ? 'on' : ''} onClick={() => api.setStatus(k)}><i style={{ background: ST[k][1] }} />{ST[k][0]}</button>)}</div>
          </div>
        ) : (
          <>
            <div className="spill"><i style={{ background: s[1] }} />{s[0]}</div>
            <div className="acts"><button className="btn" onClick={() => api.openDm(p.id)}><I n="chat" />Mensagem</button></div>
          </>
        )}
        {me ? <div className="ps"><div><b>{stats[0]}</b><span>reuniões hoje</span></div><div><b>{stats[1]}</b><span>tarefas abertas</span></div><div><b>{stats[2]}</b><span>concluídas no mês</span></div></div> : null}
        <div className="box"><h4>Sobre</h4>
          {me ? <textarea id="bio" maxLength={140} rows={3} value={p.bio} placeholder="Conte um pouco sobre você" onChange={(e) => api.saveMe({ ...p, bio: e.target.value })} /> : <p>{p.bio || 'Sem descrição'}</p>}
        </div>
        {showHours ? (
          <div className="box"><h4>Horário de expediente</h4>
            {me ? (
              <div className="hrs">
                <label>Início<input type="time" id="h0" value={p.h[0]} onChange={(e) => api.saveMe({ ...p, h: [e.target.value, p.h[1]] })} /></label>
                <label>Fim<input type="time" id="h1" value={p.h[1]} onChange={(e) => api.saveMe({ ...p, h: [p.h[0], e.target.value] })} /></label>
              </div>
            ) : (
              <div className="hr"><b>{p.h[0]} – {p.h[1]}</b><span className="live" style={{ color: working ? '#46d37b' : 'var(--mu)' }}>{working ? 'Trabalhando agora' : 'Fora do expediente'}</span></div>
            )}
            <div className="dy">{DAYS.map((d, i) => <button key={d} className={p.days[i] ? 'on' : ''} disabled={!me} onClick={() => { const days = [...p.days]; days[i] = days[i] ? 0 : 1; api.saveMe({ ...p, days }); }}>{d}</button>)}</div>
          </div>
        ) : null}
        {me ? <InstallAppBox api={api} /> : null}
        {me ? <MyEvaluationsBox api={api} /> : null}
        <div className="box"><h4>Contato</h4>
          <div className="cr"><span>E-mail</span><b>{p.mail || '—'}</b></div>
          <div className="cr"><span>Setor</span><b>{p.dept}</b></div>
          <div className="cr"><span>Na empresa desde</span><b>{p.since}</b></div>
        </div>
      </div>
    </>
  );
}

function MembersPage({ chatKey, initialTab, api }: { chatKey: string; initialTab: number; api: EwApi }) {
  const [mtab, setMtab] = useState(initialTab);
  const [mq, setMq] = useState('');
  const c = api.chats.find((x) => x.key === chatKey);
  if (!c) return null;
  const P = api.people;
  const on = c.mem.filter((id) => P[id] && P[id].st !== 'fora');
  const list = c.mem.map((id) => P[id]).filter(Boolean)
    .filter((p) => (mtab === 0 ? p.st !== 'fora' : mtab === 2 ? c.adm.includes(p.id) : true) && p.n.toLowerCase().includes(mq.toLowerCase()))
    .sort((a, b) => Number(b.st !== 'fora') - Number(a.st !== 'fora') || a.n.localeCompare(b.n));
  const canManage = c.kind === 'group' && c.canEdit;
  return (
    <>
      <div className="mh"><div><b>{on.length} presentes agora</b><small>de {c.mem.length} membros · {c.n}</small></div>
        <div className="stk">{on.slice(0, 4).map((id) => <Av key={id} p={P[id]} st={P[id].st} />)}</div></div>
      {canManage ? <div className="mact"><button className="btn" id="madd" onClick={() => api.gsOpen({ kind: 'add' })}>+ Adicionar</button><button className="btn" id="mlink" onClick={() => {
        const url = `${location.origin}/?chat=${encodeURIComponent(c.key)}`;
        void navigator.clipboard?.writeText(url).then(() => api.toast('Link copiado'), () => api.toast(url));
      }}>Link de convite</button></div> : null}
      <Seg id="ms" items={[`Presentes · ${on.length}`, `Todos · ${c.mem.length}`, `Admins · ${c.adm.length}`]} value={mtab} onChange={setMtab} />
      <label className="srch" style={{ margin: '12px 0' }}><I n="search" /><input id="mq" placeholder="Buscar membro" value={mq} onChange={(e) => setMq(e.target.value)} /></label>
      <div id="mlist">
        {list.length ? (
          <div className="grp">{list.map((p) => (
            <div className="mr" key={p.id} onClick={() => api.pgShow({ kind: 'profile', id: p.id })}>
              <Av p={p} st={p.st} />
              <div className="mm"><b>{p.n}{p.me ? <em> (você)</em> : null}</b><small>{ST[p.st][0]} · {p.role}</small></div>
              {c.adm.includes(p.id) ? <span className="rl">Admin</span> : null}
              <button className="mo" aria-label="Opções" onClick={(e) => { e.stopPropagation(); api.gsOpen({ kind: 'member', id: p.id }); }}><I n="dots" /></button>
            </div>
          ))}</div>
        ) : <div className="hint" style={{ padding: 30 }}>Ninguém por aqui</div>}
      </div>
    </>
  );
}

const SI: [keyof Summary['it'], string, string][] = [
  ['msg', 'Mensagens enviadas', 'Total do dia, por pessoa'],
  ['pend', 'Tarefas pendentes', 'A fazer e em andamento'],
  ['late', 'Tarefas atrasadas', 'Com prazo vencido'],
  ['done', 'Tarefas concluídas', 'No prazo e com atraso'],
];

function SummaryPage({ chatKey, api }: { chatKey: string; api: EwApi }) {
  const c = api.chats.find((x) => x.key === chatKey);
  const [timer, setTimer] = useState<number>();
  if (!c || !c.sum) return null;
  const s = c.sum;
  const save = (ns: Summary) => {
    api.patchChat(c.key, (x) => ({ ...x, sum: ns }));
    window.clearTimeout(timer);
    setTimer(window.setTimeout(async () => {
      const id = await api.sv(D.saveSummary(c, ns, api.boot.companyId));
      if (id && !ns.id) api.patchChat(c.key, (x) => ({ ...x, sum: { ...(x.sum as Summary), id } }));
    }, 600));
  };
  const its = SI.filter((x) => s.it[x[0]]);
  const P = api.people;
  return (
    <>
      <Tg t="Enviar resumo diário" d={`Mensagem automática no ${c.kind === 'sector' ? 'setor' : 'grupo'}`} on={s.on} onChange={(v) => save({ ...s, on: v })} />
      <div id="sumb" className={s.on ? '' : 'dim'}>
        <div className="sl">Horário de envio</div><Seg id="sh" items={['08:00', '12:00', '18:00']} value={s.h} onChange={(v) => save({ ...s, h: v })} />
        <div className="sl">Dias</div><Seg id="sd" items={['Segunda a sexta', 'Todos os dias']} value={s.d} onChange={(v) => save({ ...s, d: v })} />
        <div className="sl">O que aparece no resumo</div>
        {SI.map((x) => <Tg key={x[0]} t={x[1]} d={x[2]} on={!!s.it[x[0]]} onChange={(v) => save({ ...s, it: { ...s.it, [x[0]]: v } })} />)}
        <div className="sl">Pré-visualização</div>
        <div className="prv" id="prv">
          <div className="ph"><b>Resumo de hoje</b><span>{['08:00', '12:00', '18:00'][s.h]} · {s.d ? 'todos os dias' : 'seg a sex'}</span></div>
          {its.length ? its.map((x) => <div className="pr" key={x[0]}><span>{x[1].toLowerCase()}</span><b>•</b></div>) : <div className="hint" style={{ padding: 12, color: '#a2a2ad' }}>Nada selecionado</div>}
          {its.length ? <div className="pu"><small>Por pessoa</small>{c.mem.slice(0, 3).map((id) => P[id] ? <span key={id}>{P[id].n.split(' ')[0]}</span> : null)}</div> : null}
        </div>
      </div>
    </>
  );
}

function GroupEditPage({ chatKey, api }: { chatKey: string; api: EwApi }) {
  const c = api.chats.find((x) => x.key === chatKey);
  const [name, setName] = useState(c?.n || '');
  const [desc, setDesc] = useState(c?.desc || '');
  const [busy, setBusy] = useState(false);
  if (!c) return null;
  const up = (kind: 'photo' | 'cover' | 'wp') => api.pickImg(async (file, dataUrl) => {
    api.patchChat(c.key, (x) => ({ ...x, [kind]: dataUrl }));
    const url = await api.sv(D.uploadImage(file, `group-${kind}`, kind === 'photo' ? 512 : 1400));
    if (url) api.patchChat(c.key, (x) => ({ ...x, [kind]: url }));
  });
  return (
    <>
      <div className="cov" style={covStyle(c)}><button className="btn sm cvb" id="cvb" onClick={() => up('cover')}><I n="camera" />Capa</button></div>
      <div className="pfh">
        <div className="avw"><Av p={{ photo: c.photo, hue: c.hue, i: c.i }} cls="xxl" /><button className="cam" id="avb" aria-label="Alterar foto" onClick={() => up('photo')}><I n="camera" /></button></div>
        <div className="pfn"><h2>{name || c.n}</h2><p>{c.s}</p></div>
      </div>
      <div className="pbody">
        <div className="box"><h4>Nome</h4><input className="fld" id="gn" value={name} maxLength={30} onChange={(e) => setName(e.target.value)} /></div>
        <div className="box"><h4>Descrição</h4><textarea id="gd" maxLength={160} rows={3} value={desc} onChange={(e) => setDesc(e.target.value)} /><div className="cnt" id="gc">{desc.length}/160</div></div>
        <div className="box"><h4>Fundo do chat</h4>
          <div className="wl">
            {['Nenhum', 'Pontos', 'Cor'].map((x, i) => <button key={x} className={!c.wp && c.set.wall === i ? 'on' : ''} onClick={() => api.patchChat(c.key, (y) => ({ ...y, wp: null, set: { ...y.set, wall: i } }))}><i className={'w' + i} />{x}</button>)}
            <button id="wph" className={c.wp ? 'on' : ''} onClick={() => up('wp')}><i style={c.wp ? { background: `url("${c.wp}") center/cover` } : undefined} />Foto</button>
          </div>
        </div>
        <button className="btn full" id="gsv" disabled={busy || !name.trim()} onClick={async () => {
          setBusy(true);
          const ok = await api.sv(D.updateGroup(c, { name: name.trim(), description: desc, photo: isData(c.photo) ? null : c.photo, cover: isData(c.cover) ? null : c.cover, wall: c.set.wall, wp: isData(c.wp) ? null : c.wp, welcome: c.welcome }).then(() => true));
          setBusy(false);
          if (ok) {
            api.patchChat(c.key, (x) => ({ ...x, n: name.trim(), desc }));
            api.toast('Alterações salvas');
            api.pgBack();
          }
        }}>{busy ? 'Salvando…' : 'Salvar alterações'}</button>
      </div>
    </>
  );
}
const isData = (u: string | null) => !!u && u.startsWith('data:');

function SettingsPage({ api }: { api: EwApi }) {
  const C = api.prefs;
  const set = (k: string, v: number) => { api.setPrefs({ ...C, [k]: v }); };
  const tg = (k: string, t: string, d: string) => <Tg key={k} t={t} d={d} on={!!C[k]} onChange={(v) => { set(k, v ? 1 : 0); api.toast(v ? 'Ativado' : 'Desativado'); }} />;
  const muted = api.chats.filter(N.isChatMuted).length;
  const me = api.me;
  return (
    <>
      <div className="mh" style={{ cursor: 'pointer' }} onClick={() => api.pgShow({ kind: 'profile', id: me.id })}>
        <div className="who"><Av p={me} st={me.st} /><div><b>{me.n}</b><small>{me.mail}</small></div></div><Chev />
      </div>
      <div className="sl">Notificações</div>
      <div className="opt"><div>Notificações do aparelho<small>{api.perm === 'granted' ? 'Você receberá alertas' : api.perm === 'denied' ? 'Bloqueadas nas configurações do aparelho' : 'Ative para receber avisos e mensagens'}</small></div>
        {api.perm === 'granted' ? <span className="vv">Ativadas</span> : <button className="btn sm" id="permb" onClick={api.askPerm}>Ativar</button>}</div>
      {tg('nm', 'Mensagens', 'Novas mensagens e respostas')}
      {tg('ndm', 'Conversas individuais', 'Mensagens de pessoas')}
      {tg('ngrp', 'Grupos e setores', 'Mensagens de grupos e setores')}
      <div className="opt" onClick={() => api.pgShow({ kind: 'muted' })}><div>Conversas silenciadas</div>{muted ? <span className="vv">{muted}</span> : null}<Chev /></div>
      {tg('n', 'Avisos da administração', 'Comunicados importantes')}
      {tg('nr', 'Reuniões e lembretes', 'Aviso antes de cada reunião')}
      {tg('ns', 'Aniversários', 'Lembrete diário dos aniversariantes')}
      {tg('quiet', 'Silenciar fora do expediente', 'Sem alertas fora do seu horário')}
      {tg('prev', 'Mostrar prévia da mensagem', 'Exibe o texto na notificação')}
      {tg('snd', 'Som', 'Toca som ao receber')}
      {tg('vib', 'Vibração', 'Vibra ao receber')}
      <div className="sl">Aparência</div>
      <Seg id="theme" items={['Escuro', 'Claro', 'Automático']} value={C.theme ?? 0} onChange={(v) => set('theme', v)} />
      <div style={{ height: 8 }} />
      {tg('red', 'Reduzir animações', 'Transições mais simples')}
      <div className="note"><I n="lock" /><span>Suas reuniões, tarefas e métricas pessoais ficam visíveis apenas para você e para a administração.</span></div>
      <div className="sl">Conversas</div>
      {tg('enter', 'Enviar com Enter', 'Desligado: use Ctrl + Enter')}
      <div className="sl">Sobre</div>
      <div className="opt"><div>Versão do app<small>ewvon 1.0.0</small></div></div>
    </>
  );
}

function MutedPage({ api }: { api: EwApi }) {
  const L = api.chats.filter(N.isChatMuted);
  if (!L.length) return <div className="hint" style={{ padding: 40 }}>Nenhuma conversa silenciada</div>;
  const P = api.people;
  return (
    <div className="grp">
      {L.map((c: Chat) => (
        <div className="mr" key={c.key}>
          <div className="av" style={avStyle(c.p ? P[c.p] : c)}>{(c.p ? P[c.p]?.photo : c.photo) ? '' : c.i}</div>
          <div className="mm"><b>{c.n}</b><small>{c.set.muteUntil ? 'Até ' + new Date(c.set.muteUntil).toTimeString().slice(0, 5) : 'Até você reativar'}</small></div>
          <button className="btn sm sec" onClick={() => {
            const s = { ...c.set, mute: false, muteUntil: 0 };
            api.patchChat(c.key, (x) => ({ ...x, set: s }));
            void api.sv(D.saveChatPrefs(c, s, api.me.id, api.boot.companyId));
            api.toast('Notificações reativadas');
          }}>Reativar</button>
        </div>
      ))}
    </div>
  );
}

const CATS: [string, string][] = [['Erro no sistema', 'bug'], ['Lentidão', 'clock'], ['Sugestão', 'bulb'], ['Outro assunto', 'info']];
const AREAS = ['Início', 'Chat', 'Avisos', 'Aniversários', 'Perfil e menu', 'Outra área'];

function SupportPage({ api }: { api: EwApi }) {
  const [tab, setTab] = useState(0);
  const [cat, setCat] = useState(0);
  const [area, setArea] = useState(1);
  const [sev, setSev] = useState(1);
  const [desc, setDesc] = useState('');
  const [shot, setShot] = useState<string | null>(null);
  const [dev, setDev] = useState(true);
  const [sent, setSent] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const TK = api.tickets;
  const admin = api.people[api.me.id]?.role === 'Administrador';
  const contact = (
    <>
      <div className="sl">Contato direto</div>
      {admin ? null : <div className="opt" onClick={() => { const a = Object.values(api.people).find((p) => p.role === 'Administrador' && !p.me && !p.sys); if (a) api.openDm(a.id); else api.toast('Nenhum administrador disponível'); }}><div>Falar com o administrador<small>Abre uma conversa direta</small></div><Chev /></div>}
      <div className="opt" onClick={() => api.toast('Abra o menu e toque em Ver tutorial para rever o guia')}><div>Central de ajuda<small>Guias e perguntas frequentes</small></div><Chev /></div>
    </>
  );
  let body: JSX.Element;
  if (tab === 1) {
    body = (
      <>
        {TK.length ? <div className="grp">{TK.map((k) => <div className="tkr" key={k.id} style={{ cursor: k.num ? 'pointer' : undefined }} onClick={() => { if (k.num) api.pgShow({ kind: 'ticket', id: k.num, label: k.id, staff: false, title: k.t }); }}><div><b>{k.t}</b><small>{k.id} · {k.d}{k.who ? ` · atendido por ${k.who}` : ''}</small></div><span className="tst"><i style={{ background: k.c }} />{k.s}</span></div>)}</div> : <div className="hint" style={{ padding: 30 }}>Você ainda não abriu chamados</div>}
        {contact}
      </>
    );
  } else if (sent) {
    body = (
      <div className="okt"><div className="okc"><I n="check" /></div><h3>Relatório enviado</h3><p>Obrigado por avisar! A equipe vai analisar e você acompanha o andamento em Meus chamados.</p><span className="pr2">{sent}</span>
        <button className="btn" id="ssee" onClick={() => { setSent(null); setTab(1); }}>Ver meus chamados</button>
        <button className="btn sec" id="snew" onClick={() => { setSent(null); setTab(0); }}>Reportar outro problema</button></div>
    );
  } else {
    body = (
      <>
        <div className="note" style={{ marginTop: 0 }}><I n="warn" /><span>Encontrou um erro ou algo estranho? Conte o que aconteceu para a equipe corrigir.</span></div>
        <div className="sl">O que aconteceu?</div>
        <div className="cats">{CATS.map((c, i) => <button key={c[0]} className={i === cat ? 'on' : ''} onClick={() => setCat(i)}><I n={c[1]} />{c[0]}</button>)}</div>
        <div className="sl">Em qual área?</div>
        <select className="fld" id="sa" value={area} onChange={(e) => setArea(+e.target.value)}>{AREAS.map((a, i) => <option key={a} value={i}>{a}</option>)}</select>
        <div className="sl">O quanto atrapalha?</div>
        <Seg id="sv" items={['Leve', 'Moderado', 'Crítico']} value={sev} onChange={setSev} />
        <div className="sl">Descreva o problema</div>
        <textarea className="fld" id="sd" rows={5} maxLength={500} placeholder="O que você estava fazendo? O que esperava que acontecesse?" value={desc} onChange={(e) => setDesc(e.target.value)} />
        <div className="cnt" id="sc">{desc.length}/500</div>
        <div className="sl">Captura de tela (opcional)</div>
        {shot ? <div className="shot" style={{ background: `url("${shot}") center/cover` }}><button id="shotx" aria-label="Remover" onClick={() => setShot(null)}><I n="x" /></button></div>
          : <button className="up" id="shot" onClick={() => api.pickImg((_f, u) => setShot(u))}><I n="upload" />Anexar imagem</button>}
        <div style={{ height: 10 }} />
        <Tg id="dev" t="Incluir informações do aparelho" d="Versão do app e tamanho da tela. Nenhuma conversa é enviada." on={dev} onChange={setDev} />
        <button className="btn full" id="ssend" style={{ marginTop: 6 }} disabled={busy || desc.trim().length < 10} onClick={async () => {
          setBusy(true);
          const t = await api.sv(D.createTicket({
            category: CATS[cat][0], area: AREAS[area], severity: ['Leve', 'Moderado', 'Crítico'][sev], description: desc.trim(), screenshot: shot,
            device: dev ? { app: '1.0.0', screen: `${innerWidth}x${innerHeight}`, platform: N.isNative() ? 'android' : 'web', ua: navigator.userAgent.slice(0, 160) } : null,
          }, api.me.id, api.boot.companyId));
          setBusy(false);
          if (t) { api.setTickets([t, ...TK]); setSent(t.id); setDesc(''); setShot(null); setCat(0); }
        }}>{busy ? 'Enviando…' : 'Enviar relatório'}</button>
        {contact}
      </>
    );
  }
  return (
    <>
      {sent && tab === 0 ? null : <><Seg id="st" items={['Reportar problema', `Meus chamados (${TK.length})`]} value={tab} onChange={setTab} /><div style={{ height: 14 }} /></>}
      {body}
    </>
  );
}

/** Conversation between the ticket reporter and the support staff. */
function TicketChat({ spec, api }: { spec: Extract<PageSpec, { kind: 'ticket' }>; api: EwApi }) {
  const [msgs, setMsgs] = useState<D.TicketMsg[] | null>(null);
  const [info, setInfo] = useState<D.TicketInfo | null>(null);
  const [text, setText] = useState('');
  const taRef = useRef<HTMLTextAreaElement>(null);
  useEffect(() => { fitTextarea(taRef.current); }, [text]);
  const [busy, setBusy] = useState(false);
  const [stars, setStars] = useState(0);
  const [note, setNote] = useState('');
  const box = useRef<HTMLDivElement>(null);
  const meId = api.me.id;
  const closed = D.ticketClosed(info?.status);
  const toBottom = () => window.setTimeout(() => { const b = box.current; if (b) b.scrollTop = b.scrollHeight; }, 60);

  useEffect(() => {
    let alive = true;
    const loadInfo = () => { D.ticketInfo(spec.id).then((i) => { if (alive) setInfo(i); }).catch(() => undefined); };
    loadInfo();
    D.listTicketMessages(spec.id, meId).then((m) => { if (alive) setMsgs(m); }).catch(() => { if (alive) setMsgs([]); });
    const unsub = D.subscribeTicketMessages(spec.id, (r) => {
      setMsgs((m) => (m && !m.some((x) => x.id === r.id) ? [...m, { id: r.id, body: r.body, at: r.created_at, mine: r.author_profile_id === meId, staff: !!r.from_staff, author: r.author_name || (r.from_staff ? 'Suporte' : 'Usuário') }] : m));
    });
    const unsubRow = D.subscribeTicket(spec.id, loadInfo);
    return () => { alive = false; unsub(); unsubRow(); };
  }, [spec.id, meId]);
  useEffect(() => { toBottom(); }, [msgs?.length, closed]);

  const send = async () => {
    const v = text.trim();
    if (!v || busy || closed) return;
    setBusy(true);
    const tmp: D.TicketMsg = { id: 'tmp-' + Date.now(), body: v, at: new Date().toISOString(), mine: true, staff: spec.staff, author: api.me.n };
    setMsgs((m) => [...(m || []), tmp]);
    setText('');
    try {
      const r = await D.sendTicketMessage(spec.id, v, meId, spec.staff);
      setMsgs((m) => (m || []).map((x) => (x.id === tmp.id ? { ...x, id: r.id, at: r.created_at } : x)).filter((x, i, a) => a.findIndex((y) => y.id === x.id) === i));
    } catch {
      setMsgs((m) => (m || []).filter((x) => x.id !== tmp.id));
      setText(v);
      api.toast('Mensagem não enviada');
      void D.ticketInfo(spec.id).then(setInfo).catch(() => undefined);
    } finally { setBusy(false); }
  };

  const rate = async () => {
    if (!stars || busy) return;
    setBusy(true);
    try {
      await D.rateTicket(spec.id, stars, note);
      setInfo((i) => (i ? { ...i, rating: stars, ratingComment: note.trim() || null, ratedAt: new Date().toISOString() } : i));
      api.toast('Obrigado pela avaliação!');
    } catch (e) { api.toast((e as Error).message || 'Não foi possível enviar a avaliação'); } finally { setBusy(false); }
  };

  const LABELS = ['', 'Muito ruim', 'Ruim', 'Regular', 'Bom', 'Excelente'];
  return (
    <div className="ewx-tchat">
      <div className="ewx-tchat-h">
        <div className="ewx-tchat-ht"><b>{spec.label}</b>{info ? <span className="tst"><i style={{ background: D.TICKET_COLOR[info.status] || '#7cc6ff' }} />{info.status}</span> : null}</div>
        <small>{spec.title || ''}</small>
        <span>{closed ? 'Chamado encerrado' : spec.staff ? 'Você está atendendo como suporte' : info?.assigneeName ? `Atendido por ${info.assigneeName}` : 'Converse com quem está atendendo seu chamado'}</span>
      </div>
      <div className="ewx-tchat-list" ref={box}>
        {msgs === null ? <div className="ewx-skel">{[60, 42, 54].map((w, i) => <div key={i} className={'ewx-skel-b' + (i === 1 ? ' me' : '')} style={{ width: w + '%' }} />)}</div> : null}
        {msgs && !msgs.length ? <div className="hint" style={{ padding: 24 }}>{closed ? 'Nenhuma mensagem neste chamado.' : spec.staff ? 'Escreva para quem abriu o chamado.' : 'Envie uma mensagem para a equipe de suporte. Você recebe a resposta aqui.'}</div> : null}
        {msgs?.map((m) => (
          <div key={m.id} className={'ewx-tm' + (m.mine ? ' me' : '')}>
            {!m.mine ? <small className="ewx-tm-a">{m.author}{m.staff ? ' · Suporte' : ''}</small> : null}
            <div className="ewx-tm-b">{m.body}</div>
            <small className="ewx-tm-t">{new Date(m.at).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</small>
          </div>
        ))}
        {closed ? <div className="ewx-tclosed"><I n="check" />Este chamado foi encerrado. Para um novo problema, abra outro chamado.</div> : null}
      </div>
      {!closed ? (
        <div className="cmp ewx-tchat-cmp">
          <textarea ref={taRef} rows={1} name="ew-ticket-message" placeholder="Escreva uma mensagem" autoComplete="off" autoCorrect="on" autoCapitalize="sentences" spellCheck enterKeyHint="send" value={text} maxLength={2000} onFocus={toBottom} onChange={(e) => { setText(e.target.value); fitTextarea(e.target); }} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void send(); } }} />
          <button className="snd" aria-label="Enviar" disabled={busy || !text.trim()} onClick={() => void send()}><I n="send" /></button>
        </div>
      ) : info?.rating ? (
        <div className="ewx-trate done">
          <b>{info.isReporter ? 'Você avaliou este atendimento' : 'Avaliação do atendimento'}</b>
          <div className="ewx-stars ro">{[1, 2, 3, 4, 5].map((n) => <span key={n} className={n <= (info.rating || 0) ? 'on' : ''}>★</span>)}<em>{LABELS[info.rating || 0]}</em></div>
          {info.ratingComment ? <p>“{info.ratingComment}”</p> : null}
        </div>
      ) : info?.isReporter ? (
        <div className="ewx-trate">
          <b>Como foi o atendimento?</b>
          <div className="ewx-stars">{[1, 2, 3, 4, 5].map((n) => <button key={n} aria-label={`${n} estrelas`} className={n <= stars ? 'on' : ''} onClick={() => setStars(n)}>★</button>)}<em>{LABELS[stars] || 'Toque nas estrelas'}</em></div>
          {stars ? <textarea rows={2} maxLength={1000} value={note} onFocus={toBottom} onChange={(e) => setNote(e.target.value)} placeholder="Quer deixar um comentário? (opcional)" /> : null}
          <button className="btn full" disabled={!stars || busy} onClick={() => void rate()}>Enviar avaliação</button>
        </div>
      ) : info ? (
        <div className="ewx-trate done"><b>Aguardando a avaliação de quem abriu o chamado</b></div>
      ) : null}
    </div>
  );
}
