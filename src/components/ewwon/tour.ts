// Guided tour of the Ewwon mobile app (port of the prototype's tutorial).
// Unlike the prototype, it never sends real messages, reactions or wishes:
// it only opens screens and highlights controls, since data here is live.
import type { MutableRefObject } from 'react';

export interface TourController {
  root: () => HTMLElement | null; phone: () => HTMLElement | null;
  go: (n: number) => void; openFirstRoom: () => void; closeRoom: () => void; roomOpen: () => boolean;
  setDrawer: (o: boolean) => void; drawerOpen: () => boolean; tab: () => number;
  setDraft: (s: string) => void; openSheet: () => void; closeSheet: () => void; setSeg: (k: '7' | '30') => void;
  showPick: () => void; hidePick: () => void; expandFirstNotice: () => void;
}

type Wait = (ms: number) => Promise<void>;
interface Step {
  ui: { tab: number; room?: boolean; drawer?: boolean };
  sel?: string | (() => Element | null | undefined); t: string; d: string; next?: string; logo?: boolean; pad?: number[]; r?: number; pos?: 'bottom';
  act?: (w: Wait, focus: (el: Element | null, pad?: number[], r?: number) => void) => Promise<void>;
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export function runTour(ref: MutableRefObject<TourController | null>, onEnd: () => void): () => void {
  const C = () => ref.current as TourController;
  const root = C().root();
  const phone = C().phone();
  if (!root || !phone) { onEnd(); return () => undefined; }
  const $ = (s: string) => root.querySelector(s);
  const sp = $('#sp') as HTMLElement, fg = $('#fg') as HTMLElement, tc = $('#tc') as HTMLElement;
  const tabEl = (i: number) => $(`#tabs [data-i="${i}"]`);
  const rel = (el: Element) => { const a = el.getBoundingClientRect(), b = phone.getBoundingClientRect(); return { l: a.left - b.left, t: a.top - b.top, w: a.width, h: a.height }; };
  const cl = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

  async function settle(el: Element, w: Wait) {
    let last = '';
    for (let i = 0; i < 24; i++) {
      const r = el.getBoundingClientRect(), k = [r.left, r.top, r.width, r.height].map(Math.round).join();
      if (k === last) return;
      last = k;
      await w(70);
    }
  }
  async function tap(el: Element | null, w: Wait) {
    if (!el) return;
    const r = rel(el);
    fg.style.opacity = '1';
    fg.style.transform = `translate3d(${r.l + r.w / 2}px,${r.t + r.h / 2}px,0)`;
    await w(750);
    fg.classList.add('tap');
    await w(260);
    fg.classList.remove('tap');
  }

  const S: Step[] = [
    { ui: { tab: 0 }, t: 'Bem-vindo ao Ewwon', d: 'Vamos conhecer as 4 áreas do app. Eu aperto os botões por você, é só acompanhar.', next: 'Começar tour', logo: true },
    { ui: { tab: 0 }, sel: '#hero .stage', t: 'Seu painel em 3D', d: 'Camadas 3D com seus dados flutuando: mensagens não lidas, tarefas, reuniões e atrasos.', pad: [6, 6, 6, 6] },
    { ui: { tab: 0 }, sel: '#hstats', t: 'Resumo em números', d: 'Tarefas concluídas hoje, próxima reunião e tarefas atrasadas, sempre à mão.', pad: [6, 6, 6, 6] },
    { ui: { tab: 0 }, sel: '#actcard', t: 'Atividade da semana', d: 'O gráfico de linha mostra quantas mensagens você enviou por dia.' },
    { ui: { tab: 0 }, sel: '#chartcard', t: 'Gráficos que reagem', d: 'Alterne entre 7 e 30 dias para comparar seu desempenho.', act: async (w) => { const b = $('#seg [data-k="30"]'); await tap(b, w); C().setSeg('30'); } },
    { ui: { tab: 0 }, sel: () => tabEl(1), t: 'Aba Chat', d: 'Aqui ficam as conversas com pessoas, setores e grupos.', r: 18, act: async (w) => { await tap(tabEl(1), w); C().go(1); } },
    { ui: { tab: 1 }, sel: '#list .ct', t: 'Abra uma conversa', d: 'Toque na conversa para entrar. As mensagens novas aparecem com um contador.', act: async (w) => { const b = $('#list .ct'); if (!b) return; await tap(b, w); C().openFirstRoom(); } },
    { ui: { tab: 1, room: true }, sel: () => { const all = root.querySelectorAll('#msgs .m'); return all[all.length - 1] || $('#msgs'); }, pad: [64, 8, 8, 8], t: 'Reaja às mensagens', d: 'Segure ou toque duas vezes numa mensagem para escolher um emoji.', act: async (w) => { const all = root.querySelectorAll('#msgs .m:not(.me) .bub'); const b = all[all.length - 1]; if (!b) return; await tap(b, w); C().showPick(); await w(1600); C().hidePick(); } },
    { ui: { tab: 1, room: true }, sel: '.cmp', pad: [6, 6, 6, 6], t: 'Envie mensagens', d: 'Digite e toque no botão de enviar. Você vê quando ela foi entregue (✓✓).', r: 34, act: async (w) => { const i = $('#inp'); await tap(i, w); let s = ''; for (const c of Array.from('Combinado! 👍')) { s += c; C().setDraft(s); await w(70); } await w(500); C().setDraft(''); } },
    { ui: { tab: 1, room: true }, sel: '#gear', t: 'Configurações do chat', d: 'Membros presentes, automações e resumo diário nos grupos; fonte, cor e silenciar em qualquer conversa.', r: 20, act: async (w) => { await tap($('#gear'), w); C().openSheet(); await w(2200); C().closeSheet(); } },
    { ui: { tab: 1 }, sel: () => tabEl(2), t: 'Aba Avisos', d: 'Comunicados enviados pela administração da empresa.', r: 18, act: async (w) => { await tap(tabEl(2), w); C().go(2); } },
    { ui: { tab: 2 }, sel: () => $('.av-i') || $('#v2'), t: 'Leia com um toque', d: 'Toque no aviso para expandir. O ponto vermelho some quando você lê. Avisos fixados pedem confirmação “Ciente”.', act: async (w) => { const c = $('.av-i'); if (!c) return; await tap(c, w); C().expandFirstNotice(); } },
    { ui: { tab: 2 }, sel: () => tabEl(3), t: 'Aba Aniversários', d: 'Veja quem faz aniversário e comemore com a equipe.', r: 18, act: async (w) => { await tap(tabEl(3), w); C().go(3); } },
    { ui: { tab: 3 }, sel: () => ($('#hb:not(.hid) #bd') as Element) || $('#nxg'), t: 'Mande parabéns', d: 'Um toque envia a mensagem direto no chat da pessoa. O sininho cria um lembrete.', r: 28 },
    {
      ui: { tab: 3 }, pos: 'bottom', t: 'Seu menu pessoal', d: 'Em qualquer tela, deslize da esquerda para a direita (ou toque na sua foto no Início). Perfil, status, salas de reunião, configurações e suporte ficam ali.',
      act: async (w, focus) => {
        fg.style.transition = 'none';
        fg.style.transform = `translate3d(28px,${phone.offsetHeight * 0.45}px,0)`;
        fg.style.opacity = '1';
        void fg.offsetWidth;
        fg.style.transition = '';
        await w(300);
        fg.style.transform = `translate3d(${phone.offsetWidth * 0.62}px,${phone.offsetHeight * 0.45}px,0)`;
        await w(250);
        C().setDrawer(true);
        await w(750);
        focus($('#panel'), [0, 0, 0, 0], 30);
      },
    },
    { ui: { tab: 3, drawer: true }, sel: '#stp', t: 'Seu status', d: 'Avise a equipe se está disponível, em reunião, almoçando ou fora do expediente. Todos veem ao tocar na sua foto.', r: 20 },
    { ui: { tab: 0 }, t: 'Tudo pronto!', d: 'Você já sabe usar o Ewwon. Para rever este tour, abra o menu e toque em Ver tutorial.', next: 'Começar a usar', logo: true },
  ];

  let ti = 0, tk = 0, lastSig = '', spT = 0, spv = 0;
  let sg: { l: number; t: number; w: number; h: number; r: number } | null = null;

  function applyUI(u: Step['ui']) {
    const c = C();
    if (u.tab !== c.tab()) c.go(u.tab);
    const ro = c.roomOpen();
    if (u.room && !ro) c.openFirstRoom();
    if (!u.room && ro) c.closeRoom();
    if (!!u.drawer !== c.drawerOpen()) c.setDrawer(!!u.drawer);
  }
  function place(el: Element | null, pad?: number[], rad?: number) {
    window.clearTimeout(spT);
    sp.style.opacity = '0';
    if (!el) sg = null;
    else {
      const r = rel(el), p = pad || [8, 8, 8, 8];
      sg = { l: r.l - p[3], t: r.t - p[0], w: r.w + p[1] + p[3], h: r.h + p[0] + p[2], r: rad || parseFloat(getComputedStyle(el).borderRadius) + 8 || 24 };
    }
    spT = window.setTimeout(() => {
      if (!sg) { sp.classList.add('nt'); sp.style.cssText = 'left:50%;top:50%;width:0;height:0'; }
      else { sp.classList.remove('nt'); sp.style.cssText = `left:${sg.l}px;top:${sg.t}px;width:${sg.w}px;height:${sg.h}px;border-radius:${sg.r}px`; }
      sp.style.opacity = '1';
    }, spv ? 270 : 0);
    spv = 1;
  }
  function placeCard(pos?: 'bottom') {
    const H = phone.offsetHeight, h = tc.offsetHeight;
    let top: number;
    if (!sg || pos === 'bottom') top = pos === 'bottom' ? H - h - 24 : (H - h) / 2;
    else top = sg.t + sg.h / 2 < H * 0.5 ? sg.t + sg.h + 16 : sg.t - h - 16;
    tc.style.top = cl(top, 12, H - h - 12) + 'px';
  }
  async function show(i: number, fwd: boolean) {
    const my = ++tk, s = S[i];
    ti = i;
    const w: Wait = async (ms) => { await sleep(ms); if (tk !== my) throw 0; };
    fg.style.opacity = '0';
    tc.classList.add('hide');
    const sig = JSON.stringify(s.ui), chg = sig !== lastSig;
    lastSig = sig;
    try {
      applyUI(s.ui);
      await w(chg ? 700 : 360);
      const el = s.sel ? (typeof s.sel === 'function' ? s.sel() : $(s.sel)) || null : null;
      if (el) {
        const v = el.closest('.view');
        if (v) {
          const a = el.getBoundingClientRect(), b = v.getBoundingClientRect();
          if (a.top < b.top + 10 || a.bottom > b.bottom - 90) { v.scrollBy({ top: a.top + a.height / 2 - (b.top + b.height / 2), behavior: 'smooth' }); await w(200); }
        }
        await settle(el, w);
      }
      place(el, s.pad, s.r);
      ($('#tpb') as HTMLElement).style.width = ((i + 1) / S.length) * 100 + '%';
      ($('#tn') as HTMLElement).textContent = `Passo ${i + 1} de ${S.length}`;
      ($('#tt') as HTMLElement).textContent = s.t;
      ($('#td') as HTMLElement).textContent = s.d;
      ($('#tlg') as HTMLElement).style.display = s.logo ? 'block' : 'none';
      ($('#tnext') as HTMLElement).textContent = s.next || (i === S.length - 1 ? 'Concluir' : 'Próximo');
      ($('#tback') as HTMLElement).style.display = i ? '' : 'none';
      ($('#tskip') as HTMLElement).style.visibility = i === S.length - 1 ? 'hidden' : 'visible';
      placeCard(s.pos);
      tc.classList.remove('hide');
      if (fwd && s.act) { await w(800); await s.act(w, (e2, p2, r2) => place(e2, p2, r2)); }
      await w(300);
      fg.style.opacity = '0';
    } catch { /* superseded */ }
  }

  let ended = false;
  const end = () => {
    if (ended) return;
    ended = true;
    tk++;
    fg.style.opacity = '0';
    applyUI({ tab: 0 });
    onEnd();
  };
  const next = () => (ti < S.length - 1 ? void show(ti + 1, true) : end());
  const back = () => { if (ti > 0) void show(ti - 1, false); };
  const nb = $('#tnext') as HTMLElement, bb = $('#tback') as HTMLElement, kb = $('#tskip') as HTMLElement;
  nb.onclick = next; bb.onclick = back; kb.onclick = end;
  C().setDrawer(false);
  const t0 = window.setTimeout(() => void show(0, true), 500);
  return () => { window.clearTimeout(t0); tk++; nb.onclick = null; bb.onclick = null; kb.onclick = null; if (!ended) { ended = true; fg.style.opacity = '0'; } };
}
