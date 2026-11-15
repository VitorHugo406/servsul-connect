/* Fundo da primeira parte da página inicial: telas reais do Ewvon (preto liso) com transição animada,
   palavra gigante letra por letra, descrição digitada e palavras-chave. Só existe no topo da página. */
(function () {
  'use strict';
  var hero = document.querySelector('header.hero');
  if (!hero) return;
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var D = '/intro/';
  var S = [
    { i: 'inicio', t: 'Início', d: 'Seu espaço de trabalho com o resumo do dia.', c: ['Mensagens', 'Tarefas', 'Avisos'] },
    { i: 'chat', t: 'Conversas', d: 'Setores, conversas individuais e grupos, com chamadas.', c: ['Setores', 'Grupos', 'Chamadas'] },
    { i: 'tarefas', t: 'Tarefas', d: 'Quadros com colunas, responsáveis e prazos.', c: ['Quadros', 'Prazos', 'Responsáveis'] },
    { i: 'avisos', t: 'Avisos', d: 'Comunicados da empresa para toda a equipe.', c: ['Fixados', 'Agendados', 'Equipe'] },
    { i: 'calendario', t: 'Calendário', d: 'Reuniões, lembretes e salas sem conflito de horário.', c: ['Reuniões', 'Salas', 'Lembretes'] },
    { i: 'aniversariantes', t: 'Equipe', d: 'Aniversariantes do mês e relatório em PDF.', c: ['Pessoas', 'Setores', 'PDF'] },
    { i: 'dash', t: 'Dashboard 3D', d: 'Seu escritório em 3D, ao vivo, com indicadores.', c: ['Andares', 'Salas', 'Tempo real'] }
  ];

  var css = '' +
    '.hero.evh{position:relative;isolation:isolate;color:#fff;padding-bottom:210px}' +
    '.hero.evh h1{color:#fff}.hero.evh p{color:#c9c9d2}' +
    '.hero.evh .tag{background:rgba(255,255,255,.1);color:#fff;border-color:rgba(255,255,255,.22)}' +
    '.hero.evh .btn{background:#fff;color:#0a0a0b}.hero.evh .btn s{background:#0a0a0b}.hero.evh .btn s svg{color:#fff}' +
    '.hero.evh .btn.o{background:rgba(255,255,255,.08);color:#fff;border:1px solid rgba(255,255,255,.28)}' +
    /* barra de navegação sempre preta */
    'nav{--bg:#09090b;--ink:#f5f5f7;--mute:#a4a4ae;--line:#26262c;--c1:#131316;--c2:#1b1b20;--w:#1a1a1f;--inv:1;--gl:rgba(8,8,10,.92);--glb:rgba(8,8,10,.96);background:rgba(8,8,10,.92)!important;color:#f5f5f7;border:1px solid #1f1f24}' +
    'nav .btn{background:#fff;color:#0a0a0b}nav .btn s{background:#0a0a0b}nav .btn.o{background:transparent;color:#fff;border:1px solid #2c2c33}' +
    '.hv-bg{position:absolute;z-index:-1;left:50%;width:100vw;margin-left:-50vw;top:-96px;bottom:0;background:#000;overflow:hidden;border-radius:0 0 40px 40px}' +
    '.hv-bg .im{position:absolute;inset:0;opacity:0}' +
    '.hv-bg .im img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;object-position:top center;filter:brightness(.42) contrast(1.05);transform-origin:50% 25%}' +
    '.hv-bg .im.on{opacity:1;z-index:2;animation:hvin 1.3s cubic-bezier(.77,0,.18,1) both}' +
    '.hv-bg .im.on img{animation:hvz 8s ease-out both}' +
    '.hv-bg .im.out{opacity:1;z-index:1;animation:hvout 1.3s cubic-bezier(.77,0,.18,1) both}' +
    '@keyframes hvin{from{clip-path:inset(0 0 0 100%)}to{clip-path:inset(0 0 0 0)}}' +
    '@keyframes hvout{from{transform:translateX(0)}to{transform:translateX(-14%)}}' +
    '@keyframes hvz{from{transform:scale(1.18) translateX(3%)}to{transform:scale(1.04) translateX(0)}}' +
    '.hv-bg:after{content:"";position:absolute;inset:0;z-index:3;pointer-events:none;background:radial-gradient(ellipse at 50% 42%,rgba(0,0,0,.78),rgba(0,0,0,.45) 55%,rgba(0,0,0,.25)),linear-gradient(180deg,rgba(0,0,0,.5),transparent 25%,transparent 65%,rgba(0,0,0,.65))}' +
    /* palavra gigante, letra por letra */
    '.hv-w{position:absolute;z-index:4;left:0;right:0;bottom:56px;text-align:center;white-space:nowrap;overflow:hidden;font-weight:800;letter-spacing:-.045em;line-height:1;font-size:clamp(56px,11vw,170px);color:transparent;-webkit-text-stroke:1.5px rgba(255,255,255,.28);pointer-events:none;perspective:600px}' +
    '.hv-w span{display:inline-block;opacity:0;animation:hvl .9s cubic-bezier(.2,.8,.2,1) both}' +
    '@keyframes hvl{from{opacity:0;transform:translateY(70%) rotateX(-70deg);filter:blur(10px)}to{opacity:1;transform:none;filter:none}}' +
    '.hv-w.go span{animation:hvlo .5s ease-in both}@keyframes hvlo{from{opacity:1;transform:none}to{opacity:0;transform:translateY(-60%);filter:blur(8px)}}' +
    /* descrição digitada e palavras-chave */
    '.hv-cap{position:absolute;z-index:5;left:0;right:0;bottom:20px;display:flex;flex-direction:column;align-items:center;gap:10px;padding:0 16px;text-align:center}' +
    '.hv-ch{display:flex;gap:8px;flex-wrap:wrap;justify-content:center;min-height:30px}' +
    '.hv-ch b{font-size:12px;font-weight:700;color:#fff;border:1px solid rgba(255,255,255,.3);background:rgba(255,255,255,.08);border-radius:999px;padding:5px 12px;opacity:0;transform:translateY(10px) scale(.9);animation:hvc .5s cubic-bezier(.2,.8,.2,1) both}' +
    '@keyframes hvc{to{opacity:1;transform:none}}' +
    '.hv-ty{font-size:14.5px;font-weight:600;color:#e6e6ec;min-height:22px}.hv-ty:after{content:"";display:inline-block;width:2px;height:1em;background:#fff;margin-left:3px;vertical-align:-2px;animation:hvk 1s steps(2) infinite}' +
    '@keyframes hvk{50%{opacity:0}}' +
    '.hv-dots{display:flex;gap:6px}.hv-dots i{width:22px;height:3px;border-radius:2px;background:#2b2b30;overflow:hidden;position:relative}.hv-dots i.on:after{content:"";position:absolute;inset:0;background:#fff;transform-origin:left;animation:hvp 5.2s linear both}' +
    '@keyframes hvp{from{transform:scaleX(0)}to{transform:scaleX(1)}}' +
    '@media (max-width:640px){.hero.evh{padding-bottom:150px}.hv-w{bottom:62px}.hero.evh{padding-bottom:190px}.hv-ty{font-size:13px}}' +
    '@media (prefers-reduced-motion:reduce){.hv-bg .im.on,.hv-bg .im.on img,.hv-w span,.hv-ch b{animation-duration:.01s!important}}';
  var st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);

  var bg = document.createElement('div'); bg.className = 'hv-bg'; bg.setAttribute('aria-hidden', 'true');
  var ims = S.map(function (s, k) { var w = document.createElement('div'), im = new Image(); w.className = 'im'; im.alt = ''; im.decoding = 'async'; if (k < 2) im.src = D + s.i + '.webp'; else im.dataset.src = D + s.i + '.webp'; w.appendChild(im); bg.appendChild(w); return w; });
  var word = document.createElement('div'); word.className = 'hv-w'; bg.appendChild(word);
  var cap = document.createElement('div'); cap.className = 'hv-cap';
  cap.innerHTML = '<div class="hv-ch"></div><div class="hv-ty"></div><div class="hv-dots">' + S.map(function () { return '<i></i>'; }).join('') + '</div>';
  bg.appendChild(cap);
  hero.classList.add('evh'); hero.insertBefore(bg, hero.firstChild);
  var ch = cap.querySelector('.hv-ch'), ty = cap.querySelector('.hv-ty'), dots = cap.querySelectorAll('.hv-dots i'), cur = -1, tt = 0;

  function load(im) { var x = im.querySelector('img'); if (x && !x.src && x.dataset.src) x.src = x.dataset.src; }
  function show(n) {
    n = (n + S.length) % S.length; var s = S[n], prev = cur >= 0 ? ims[cur] : null;
    ims.forEach(function (w) { w.classList.remove('out'); });
    if (prev) { prev.classList.remove('on'); prev.classList.add('out'); }
    load(ims[n]); ims[n].classList.remove('out'); void ims[n].offsetWidth; ims[n].classList.add('on'); load(ims[(n + 1) % S.length]);
    /* palavra gigante letra por letra */
    word.classList.remove('go'); word.innerHTML = s.t.split('').map(function (c, k) { return '<span style="animation-delay:' + (.15 + k * .045) + 's">' + (c === ' ' ? '&nbsp;' : c) + '</span>'; }).join('');
    /* palavras-chave, uma a uma */
    ch.innerHTML = s.c.map(function (c, k) { return '<b style="animation-delay:' + (.9 + k * .35) + 's">' + c + '</b>'; }).join('');
    /* descrição digitada */
    clearInterval(tt); ty.textContent = ''; var i = 0; if (reduce) ty.textContent = s.d; else tt = setInterval(function () { ty.textContent = s.d.slice(0, ++i); if (i >= s.d.length) clearInterval(tt); }, 28);
    dots.forEach(function (d, k) { d.classList.remove('on'); if (k === n) { void d.offsetWidth; d.classList.add('on'); } });
    cur = n;
    if (!reduce) setTimeout(function () { if (cur === n) word.classList.add('go'); }, 4600);
  }
  show(0);
  if (!reduce) setInterval(function () { if (!document.hidden) show(cur + 1); }, 5200);
})();
