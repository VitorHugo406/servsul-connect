/* Apresentação de abertura do Ewvon: telas reais do sistema (modo de teste), logo real e nomes reais das áreas,
   sobre fundo preto liso. Toca uma vez por sessão do navegador, pode ser pulada e termina na frase de efeito. */
(function () {
  'use strict';
  var KEY = 'ewvon-intro-v2';
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var running = false, host = null;

  var CSS = '' +
    '#evi{position:fixed;inset:0;background:#000;color:#fff;font-family:"Plus Jakarta Sans",system-ui,-apple-system,"Segoe UI",sans-serif;overflow:hidden;opacity:1;transition:opacity .8s ease}' +
    '#evi.out{opacity:0;pointer-events:none}#evi *{box-sizing:border-box}' +
    '#evi .sc{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:26px;padding:56px 24px 64px;opacity:0;visibility:hidden;transition:opacity .6s ease}' +
    '#evi .sc.on{opacity:1;visibility:visible}' +
    '#evi .shot{position:relative;width:min(1080px,92vw);max-height:62vh;aspect-ratio:1440/900;border-radius:16px;overflow:hidden;border:1px solid #2a2a2e;background:#fff;box-shadow:0 24px 70px rgba(0,0,0,.8)}' +
    '#evi .shot img{display:block;width:100%;height:100%;object-fit:cover;object-position:top;transform-origin:50% 30%}' +
    '#evi .sc.on .shot img{animation:evzm 4.6s ease-out both}@keyframes evzm{from{transform:scale(1)}to{transform:scale(1.045)}}' +
    '#evi .sc.on .shot{animation:evin .8s cubic-bezier(.2,.8,.2,1) both}@keyframes evin{from{opacity:0;transform:translateY(26px)}to{opacity:1;transform:none}}' +
    '#evi .cap{text-align:center;max-width:720px}' +
    '#evi .cap h2{margin:0 0 8px;font-size:clamp(26px,4.4vw,46px);font-weight:800;letter-spacing:-.025em;line-height:1.1}' +
    '#evi .cap p{margin:0;font-size:clamp(14px,1.8vw,18px);color:#a8a8b0;line-height:1.5}' +
    '#evi .sc.on .cap>*{animation:evup .7s cubic-bezier(.2,.7,.2,1) .25s both}#evi .sc.on .cap>*+*{animation-delay:.4s}' +
    '@keyframes evup{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:none}}' +
    '#evi .wm{width:min(420px,70vw);height:auto;display:block;margin:0 auto}' +
    '#evi .sc.on .wm{animation:evup .9s ease both}' +
    '#evi .tag{margin-top:10px;font-size:clamp(15px,2vw,20px);color:#a8a8b0}#evi .sc.on .tag{animation:evup .8s ease .7s both}' +
    '#evi .big{font-size:clamp(34px,8vw,92px);font-weight:800;letter-spacing:-.035em;line-height:1.06;text-align:center}' +
    '#evi .big span{display:inline-block;opacity:0}#evi .sc.on .big span{animation:evup .8s cubic-bezier(.2,.8,.2,1) both}#evi .sc.on .big span:nth-child(2){animation-delay:.5s}#evi .sc.on .big span:nth-child(3){animation-delay:1s}' +
    '#evi .skip{position:absolute;top:18px;right:18px;z-index:5;background:#111;border:1px solid #333;color:#fff;border-radius:999px;padding:9px 18px;font:700 13px inherit;cursor:pointer}#evi .skip:hover{background:#222}' +
    '#evi .pr{position:absolute;left:0;right:0;bottom:0;height:3px;background:#141414}#evi .pr i{display:block;height:100%;width:0;background:#fff}' +
    '#evi .cnt{position:absolute;bottom:18px;left:0;right:0;display:flex;justify-content:center;gap:7px;z-index:4}#evi .cnt i{width:6px;height:6px;border-radius:50%;background:#333;transition:.3s}#evi .cnt i.on{background:#fff}' +
    '@media (max-width:640px){#evi .shot{max-height:46vh;aspect-ratio:4/3}#evi .shot img{object-position:left top}}' +
    '@media (prefers-reduced-motion:reduce){#evi *{animation-duration:.01s!important}}';

  var D = '/intro/';
  var SC = [
    { d: 2800, html: '<img class="wm" src="/ewwon/img/wordmark.png" alt="Ewvon"><div class="tag">Converse. Organize. Conclua.</div>' },
    { d: 3000, img: 'inicio', h: 'Início', p: 'Seu espaço de trabalho: mensagens, tarefas e avisos do dia em um só lugar.' },
    { d: 3200, img: 'chat', h: 'Conversas', p: 'Setores, conversas individuais e grupos, com chamadas de voz e vídeo.' },
    { d: 3200, img: 'tarefas', h: 'Tarefas em quadros', p: 'Quadros com colunas, responsáveis, prazos e acompanhamento da equipe.' },
    { d: 2800, img: 'avisos', h: 'Avisos', p: 'Comunicados da empresa para toda a equipe, com avisos fixados.' },
    { d: 3000, img: 'calendario', h: 'Calendário e salas', p: 'Reuniões, lembretes e prazos organizados, sem conflito de horário.' },
    { d: 2800, img: 'aniversariantes', h: 'Aniversariantes', p: 'Felicitações do mês e relatório pronto para baixar em PDF.' },
    { d: 3400, img: 'dash', h: 'Dashboard 3D', p: 'Seu escritório em 3D, com a equipe, as salas e os indicadores ao vivo.' },
    { d: 4400, html: '<div class="big"><span>Conversa.</span> <span>Tarefas.</span> <span>Reuniões.</span></div><img class="wm" style="width:min(220px,50vw);margin-top:26px" src="/ewwon/img/wordmark.png" alt="Ewvon">' }
  ];

  function build() {
    host = document.createElement('div'); host.id = 'evi-host'; host.style.cssText = 'position:fixed;inset:0;z-index:99999';
    var sr = host.attachShadow({ mode: 'open' }), st = document.createElement('style'); st.textContent = CSS; sr.appendChild(st);
    var el = document.createElement('div'); el.id = 'evi'; el.setAttribute('role', 'region'); el.setAttribute('aria-label', 'Apresentação do Ewvon');
    var h = '<button class="skip" type="button">Pular apresentação</button>';
    SC.forEach(function (s) {
      if (s.html) h += '<div class="sc"><div style="text-align:center">' + s.html + '</div></div>';
      else h += '<div class="sc"><div class="shot"><img src="' + D + s.img + '.webp" alt="' + s.h + '"></div><div class="cap"><h2>' + s.h + '</h2><p>' + s.p + '</p></div></div>';
    });
    h += '<div class="cnt">' + SC.map(function () { return '<i></i>'; }).join('') + '</div><div class="pr"><i></i></div>';
    el.innerHTML = h; sr.appendChild(el); document.body.appendChild(host); return el;
  }

  function play() {
    if (running) return; running = true;
    var el = build(), sc = el.querySelectorAll('.sc'), dots = el.querySelectorAll('.cnt i'), bar = el.querySelector('.pr i');
    var total = SC.reduce(function (a, s) { return a + s.d; }, 0), t0 = Date.now(), timers = [], i = -1, done = false;
    document.documentElement.style.overflow = 'hidden';
    function show(n) {
      if (i >= 0) sc[i].classList.remove('on');
      i = n; sc[i].classList.add('on');
      dots.forEach(function (d, k) { d.classList.toggle('on', k === i); });
      timers.push(setTimeout(function () { if (i < SC.length - 1) show(i + 1); else finish(); }, SC[i].d));
    }
    function tick() { if (done) return; bar.style.width = Math.min(100, (Date.now() - t0) / total * 100) + '%'; requestAnimationFrame(tick); }
    function finish() {
      if (done) return; done = true; timers.forEach(clearTimeout);
      try { sessionStorage.setItem(KEY, '1'); } catch (e) { }
      el.classList.add('out');
      setTimeout(function () { host.remove(); document.documentElement.style.overflow = ''; running = false; }, 900);
    }
    el.querySelector('.skip').addEventListener('click', finish);
    document.addEventListener('keydown', function esc(e) { if (e.key === 'Escape' && !done) { finish(); document.removeEventListener('keydown', esc); } });
    show(0); tick();
  }

  window.ewvonIntro = function () { play(); };

  function start() {
    var seen = false; try { seen = sessionStorage.getItem(KEY) === '1'; } catch (e) { }
    if (reduce || seen) return;
    /* carrega as primeiras imagens antes de começar para a abertura não piscar */
    var n = 0, started = false, go = function () { if (!started && ++n >= 3) { started = true; play(); } };
    ['/ewwon/img/wordmark.png', D + 'inicio.webp', D + 'chat.webp'].forEach(function (u) { var im = new Image(); im.onload = im.onerror = go; im.src = u; });
    setTimeout(function () { if (!started) { started = true; play(); } }, 2500);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
