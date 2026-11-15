/* Abertura da página inicial no estilo "motion de letras": fundo escuro, ponto que explode em campo azul,
   palavras gigantes que revelam letra por letra, glitch, desfoque de movimento, telas reais do sistema girando
   em 3D e fechamento com a logo. Toca uma vez por sessão no topo da página; depois entram o título e os botões. */
(function () {
  'use strict';
  var hero = document.querySelector('header.hero');
  if (!hero) return;
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var KEY = 'ewvon-kin-v1', D = '/intro/', BLUE = '#2457F5';

  function L(t, d) { return '<span class="kvm">' + t.split('').map(function (c, i) { return '<span class="kvl" style="--i:' + i + ';--d:' + (d || 0) + 's">' + (c === ' ' ? '&nbsp;' : c) + '</span>'; }).join('') + '</span>'; }
  function card(img, st, cls) { return '<div class="kvcard ' + (cls || '') + '" style="' + (st || '') + '"><img alt="" src="' + D + img + '.webp"></div>'; }

  var css = '' +
    '.hero.evk{position:relative;isolation:isolate;color:#fff;min-height:max(640px,calc(100vh - 16px));display:flex;flex-direction:column;justify-content:center;align-items:center;padding-bottom:84px}' +
    '.hero.evk h1{color:#fff}.hero.evk p{color:#c9c9d2}' +
    '.hero.evk .tag{background:rgba(255,255,255,.1);color:#fff;border-color:rgba(255,255,255,.22)}' +
    '.hero.evk .btn{background:#fff;color:#0a0a0b}.hero.evk .btn s{background:#0a0a0b}.hero.evk .btn s svg{color:#fff}' +
    '.hero.evk .btn.o{background:rgba(255,255,255,.08);color:#fff;border:1px solid rgba(255,255,255,.28)}' +
    '.hero.evk>*:not(.kv){transition:opacity 1s ease,transform 1s ease}' +
    '.hero.evk:not(.done)>*:not(.kv){opacity:0!important;transform:translateY(24px)!important;pointer-events:none!important;animation:none!important}' +
    '.hero.evk.done>*:not(.kv){opacity:1;transform:none}' +
    /* barra de navegação sempre preta */
    'nav{--bg:#09090b;--ink:#f5f5f7;--mute:#a4a4ae;--line:#26262c;--c1:#131316;--c2:#1b1b20;--w:#1a1a1f;--inv:1;--gl:rgba(8,8,10,.92);--glb:rgba(8,8,10,.96);background:rgba(8,8,10,.92)!important;color:#f5f5f7;border:1px solid #1f1f24}' +
    'nav .btn{background:#fff;color:#0a0a0b}nav .btn s{background:#0a0a0b}nav .btn.o{background:transparent;color:#fff;border:1px solid #2c2c33}' +
    '.kv{position:absolute;z-index:-1;left:50%;width:100vw;margin-left:-50vw;top:-96px;bottom:0;background:#09090b;overflow:hidden;border-radius:0 0 40px 40px;text-transform:uppercase;color:#fff}' +
    '.kvs{position:absolute;inset:0;display:none;overflow:hidden}.kvs.on{display:block}.kvs.up{z-index:2}' +
    '.kvb{background:' + BLUE + ';color:#050c2b}.kvd{background:#09090b;color:#fff}' +
    '.kvc{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center}' +
    '.kvw{display:inline-block;text-align:left}' +
    '.kvt{font-weight:800;line-height:.88;letter-spacing:-.05em;font-size:clamp(44px,10.2vw,172px);white-space:nowrap;position:relative}' +
    '.kvt.sm{font-size:clamp(20px,3.4vw,56px);letter-spacing:-.03em;margin-bottom:.12em;line-height:1}' +
    '.kvm{display:inline-block;overflow:hidden;vertical-align:top;padding:.05em .03em .12em;margin:-.05em -.03em -.12em}' +
    '.kvl{display:inline-block;opacity:0;transform:translateY(110%);animation:kvup .62s cubic-bezier(.2,.9,.2,1) forwards;animation-delay:calc(var(--d,0s) + var(--i) * 38ms)}' +
    '@keyframes kvup{0%{opacity:0;transform:translateY(110%);filter:blur(10px)}55%{opacity:1}100%{opacity:1;transform:none;filter:none}}' +
    '.kvs.out .kvc,.kvs.out .kvl2{animation:kvout .42s cubic-bezier(.6,0,1,1) forwards}' +
    '@keyframes kvout{to{opacity:0;transform:translateX(-16%) scaleX(1.4);filter:blur(18px)}}' +
    /* S0: ponto */
    '.kvdot{position:absolute;left:50%;top:50%;width:16px;height:16px;margin:-8px;border-radius:50%;background:' + BLUE + ';animation:kvdp .55s ease-in-out infinite alternate}@keyframes kvdp{to{transform:scale(1.9)}}' +
    /* S1: campo azul abre do ponto */
    '.kv1{clip-path:circle(0 at 50% 50%);animation:kvcircle .7s cubic-bezier(.7,0,.2,1) forwards}@keyframes kvcircle{to{clip-path:circle(150% at 50% 50%)}}' +
    /* glitch na palavra */
    '.kvt.gl:before{content:attr(data-t);position:absolute;left:0;top:0;width:100%;clip-path:inset(34% 0 44% 0);color:inherit;opacity:0;animation:kvgl .5s steps(7) 1.15s 1}' +
    '@keyframes kvgl{0%{opacity:1;transform:translateX(-26px)}20%{transform:translateX(22px)}40%{transform:translateX(-12px)}60%{transform:translateX(30px)}80%{transform:translateX(-6px)}100%{opacity:0;transform:none}}' +
    '.kvscan{position:absolute;left:0;right:0;height:3px;background:currentColor;opacity:0;animation:kvsc .55s linear 1.1s 1}@keyframes kvsc{0%{opacity:.9;top:30%}100%{opacity:0;top:78%}}' +
    /* S3: abre pela linha do meio */
    '.kv3{clip-path:inset(49.7% 0 49.7% 0);animation:kvopen .8s cubic-bezier(.7,0,.2,1) .05s forwards}@keyframes kvopen{to{clip-path:inset(0 0 0 0)}}' +
    '.kvcard{position:absolute;left:50%;top:50%;width:min(52vw,720px);aspect-ratio:1440/860;border-radius:20px;overflow:hidden;background:#fff;box-shadow:0 40px 90px rgba(0,0,0,.55),0 0 0 1px rgba(255,255,255,.16);transform:translate(-50%,-50%) perspective(1600px) rotateY(-20deg) rotateX(8deg) rotateZ(-3deg)}' +
    '.kvcard img{display:block;width:100%;height:100%;object-fit:cover;object-position:top}' +
    '.kvcard.z{animation:kvz 1.15s cubic-bezier(.2,.9,.2,1) .35s both}' +
    '@keyframes kvz{from{opacity:0;filter:blur(16px);transform:translate(-50%,-50%) perspective(1600px) rotateY(-55deg) rotateX(14deg) rotateZ(-10deg) scale(3.4)}to{opacity:1;filter:none;transform:translate(-50%,-50%) perspective(1600px) rotateY(-20deg) rotateX(8deg) rotateZ(-3deg) scale(1)}}' +
    '.kvcard.z2{animation:kvz 1.15s cubic-bezier(.2,.9,.2,1) .35s both,kvfl 3.4s ease-in-out 1.6s infinite alternate}' +
    '@keyframes kvfl{to{transform:translate(-50%,-52%) perspective(1600px) rotateY(-14deg) rotateX(6deg) rotateZ(-2deg)}}' +
    /* S4: logo grande */
    '.kvlogo{width:min(48vw,540px);filter:brightness(0);opacity:.92;animation:kvlg 1.1s cubic-bezier(.2,.9,.2,1) .15s both}@keyframes kvlg{from{opacity:0;transform:scale(3);filter:brightness(0) blur(20px)}to{opacity:.92;transform:none;filter:brightness(0)}}' +
    '.kvbar{position:absolute;left:0;right:0;bottom:0;height:0;background:#09090b;animation:kvbar .5s cubic-bezier(.7,0,.2,1) 1.9s forwards}@keyframes kvbar{to{height:100%}}' +
    /* S5: cartão + texto lateral */
    '.kv5{clip-path:inset(0 0 0 100%);animation:kvwipe .6s cubic-bezier(.7,0,.2,1) forwards}@keyframes kvwipe{to{clip-path:inset(0 0 0 0)}}' +
    '.kvside{position:absolute;left:7vw;top:50%;transform:translateY(-50%);text-align:left}' +
    '.kvside .kvt{font-size:clamp(40px,8.2vw,138px);color:#fff}.kvside .kvt.sm{font-size:clamp(20px,3vw,48px);color:#8fa9ff}' +
    '.kvpair{position:absolute;left:0;top:0;transform:translateY(-50%)}.kvpair.a{animation:kvhide .35s ease-in 1.45s forwards}@keyframes kvhide{to{opacity:0;transform:translateY(-50%) translateX(-6%);filter:blur(10px)}}' +
    '.kvring{position:absolute;left:73%;top:50%;width:min(44vw,560px);aspect-ratio:1;margin:calc(min(44vw,560px) / -2) 0 0 calc(min(44vw,560px) / -2);border-radius:50%;border:2px dashed rgba(143,169,255,.35);animation:kvspin 14s linear infinite}@keyframes kvspin{to{transform:rotate(360deg)}}' +
    '.kv5 .kvcard{left:73%;width:min(30vw,420px);aspect-ratio:3/4;animation:kvfly .9s cubic-bezier(.2,.9,.2,1) .3s both}.kv5 .kvcard img{object-position:left top}' +
    '@keyframes kvfly{from{opacity:0;filter:blur(18px);transform:translate(40vw,-50%) perspective(1600px) rotateY(-50deg) rotateZ(-10deg)}to{opacity:1;filter:none;transform:translate(-50%,-50%) perspective(1600px) rotateY(-18deg) rotateX(6deg) rotateZ(-4deg)}}' +
    /* S6: símbolos gigantes que se transformam */
    '.kvg{position:absolute;left:50%;top:46%;width:min(54vh,46vw,500px);aspect-ratio:1;margin:calc(min(54vh,46vw,500px) / -2) 0 0 calc(min(54vh,46vw,500px) / -2)}' +
    '.kvg>div{position:absolute;inset:0;opacity:0;animation:kvgl 1s cubic-bezier(.4,0,.2,1) both}.kvg>div:nth-child(2){animation-delay:.95s}.kvg>div:nth-child(3){animation-delay:1.9s}' +
    '.kvg svg{width:100%;height:100%}.kvg b{position:absolute;left:0;right:0;bottom:-14%;text-align:center;font-size:clamp(16px,2.2vw,30px);letter-spacing:.22em;font-weight:800}' +
    '@keyframes kvgl{0%{opacity:0;transform:scale(.55) rotate(-14deg);filter:blur(18px)}22%{opacity:1;transform:none;filter:none}78%{opacity:1;transform:none;filter:none}100%{opacity:0;transform:scale(1.4) rotate(10deg);filter:blur(20px)}}' +
    '.kv6 .kvcard{width:min(24vw,330px);animation:kvpass 2.9s cubic-bezier(.4,0,.2,1) both}@keyframes kvpass{from{opacity:0;transform:translate(-190%,-50%) perspective(1600px) rotateY(-40deg) rotateZ(-8deg);filter:blur(12px)}20%{opacity:1;filter:none}to{opacity:1;transform:translate(120%,-50%) perspective(1600px) rotateY(-10deg) rotateZ(-2deg);filter:blur(0)}}' +
    /* S7: palavras em sequência */
    '.kv7 .kvt{position:absolute;left:0;right:0;top:50%;margin-top:-.45em;text-align:center;font-size:clamp(50px,13vw,220px);opacity:0;animation:kvslam .95s cubic-bezier(.2,.9,.2,1) both}' +
    '.kv7 .kvt:nth-child(2){animation-delay:.95s}.kv7 .kvt:nth-child(3){animation-delay:1.9s;color:' + BLUE + '}' +
    '@keyframes kvslam{0%{opacity:0;transform:scale(1.7);filter:blur(18px)}16%{opacity:1;transform:scale(1);filter:none}82%{opacity:1;transform:scale(1.02)}100%{opacity:0;transform:scale(.9);filter:blur(12px)}}' +
    '.kv7 .kvcard{z-index:3;width:min(36vw,500px);animation:kvsweep 2.9s linear both}@keyframes kvsweep{from{transform:translate(-190%,-40%) perspective(1600px) rotateY(-30deg) rotateZ(-12deg);opacity:1}to{transform:translate(120%,-60%) perspective(1600px) rotateY(-20deg) rotateZ(-6deg);opacity:1}}' +
    /* S9: logo final */
    '.kvwm{width:min(62vw,660px);animation:kvwm .9s cubic-bezier(.7,0,.2,1) .1s both}@keyframes kvwm{from{clip-path:inset(0 100% 0 0)}to{clip-path:inset(0 0 0 0)}}' +
    '.kvtag{margin-top:22px;font-weight:700;font-size:clamp(12px,1.5vw,18px);letter-spacing:.3em;color:#c9c9d2;opacity:0;animation:kvfade .8s ease 1s forwards}@keyframes kvfade{to{opacity:1}}' +
    '.kvs.fin .kvc{animation:kvfin .8s ease forwards}@keyframes kvfin{to{opacity:0;transform:scale(.96)}}' +
    /* controles */
    '.kvctl{position:absolute;z-index:6;right:18px;bottom:16px;border:1px solid rgba(255,255,255,.35);background:rgba(0,0,0,.35);color:#fff;border-radius:999px;padding:8px 16px;font:700 12px inherit;cursor:pointer;text-transform:none;letter-spacing:.02em}.kvctl:hover{background:rgba(255,255,255,.18)}' +
    '@media (max-width:640px){.kvt{font-size:13vw}.kvt.sm{font-size:6vw}.kv7 .kvt{font-size:16vw}.kvside .kvt{font-size:11vw}.kvside .kvt.sm{font-size:5vw}.kvside{left:5vw}.kvring{left:78%}.kv5 .kvcard{left:78%;width:34vw}.hero.evk{padding-bottom:70px}}' +
    '@media (prefers-reduced-motion:reduce){.kv *{animation-duration:.01s!important;animation-delay:0s!important}}';
  var st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);

  var SV = '<svg viewBox="0 0 200 200" fill="none">';
  var S = [
    /* 0 ponto */ '<div class="kvs kvd"><div class="kvdot"></div></div>',
    /* 1 SEU TRABALHO */ '<div class="kvs kvb kv1"><div class="kvc"><div class="kvt">' + L('SEU TRABALHO', .4) + '</div></div></div>',
    /* 2 SEM BAGUNÇA */ '<div class="kvs kvb"><div class="kvc"><div class="kvw"><div class="kvt sm">' + L('SEM', .1) + '</div><div class="kvt gl" data-t="BAGUNÇA.">' + L('BAGUNÇA.', .25) + '<i class="kvscan"></i></div></div></div></div>',
    /* 3 tela em zoom */ '<div class="kvs kvd kv3">' + card('chat', '', 'z') + '</div>',
    /* 4 logo */ '<div class="kvs kvb"><div class="kvc"><img class="kvlogo" alt="" src="/ewwon/img/logo-mark.png"></div><div class="kvbar"></div></div>',
    /* 5 UMA EQUIPE / UM SISTEMA */ '<div class="kvs kvd kv5"><div class="kvring"></div><div class="kvside"><div class="kvpair a"><div class="kvt sm">' + L('UMA', .5) + '</div><div class="kvt">' + L('EQUIPE.', .6) + '</div></div><div class="kvpair"><div class="kvt sm">' + L('UM', 1.75) + '</div><div class="kvt">' + L('SISTEMA.', 1.85) + '</div></div></div>' + card('tarefas', '', '') + '</div>',
    /* 6 símbolos */ '<div class="kvs kvd kv6"><div class="kvg">' +
      '<div>' + SV + '<path d="M30 46c0-9 7-16 16-16h108c9 0 16 7 16 16v70c0 9-7 16-16 16H88l-34 30v-30H46c-9 0-16-7-16-16z" fill="' + BLUE + '"/></svg><b>CONVERSAS</b></div>' +
      '<div>' + SV + '<circle cx="100" cy="100" r="72" fill="' + BLUE + '"/><path d="M62 102l26 26 52-56" stroke="#fff" stroke-width="16" stroke-linecap="round" stroke-linejoin="round"/></svg><b>TAREFAS</b></div>' +
      '<div>' + SV + '<rect x="28" y="40" width="144" height="130" rx="18" fill="' + BLUE + '"/><rect x="28" y="40" width="144" height="34" rx="18" fill="#fff" opacity=".9"/><rect x="50" y="26" width="12" height="28" rx="6" fill="#fff"/><rect x="138" y="26" width="12" height="28" rx="6" fill="#fff"/><g fill="#fff"><rect x="50" y="92" width="22" height="20" rx="5"/><rect x="89" y="92" width="22" height="20" rx="5"/><rect x="128" y="92" width="22" height="20" rx="5"/><rect x="50" y="128" width="22" height="20" rx="5"/><rect x="89" y="128" width="22" height="20" rx="5" opacity=".5"/></g></svg><b>REUNIÕES</b></div>' +
      '</div>' + card('dash', 'top:50%', '') + '</div>',
    /* 7 CONVERSE ORGANIZE CONCLUA */ '<div class="kvs kvd kv7"><div class="kvt">CONVERSE.</div><div class="kvt">ORGANIZE.</div><div class="kvt">CONCLUA.</div>' + card('calendario', '', '') + '</div>',
    /* 8 TUDO EM UM LUGAR */ '<div class="kvs kvb"><div class="kvc"><div class="kvw"><div class="kvt sm">' + L('TUDO', .1) + '</div><div class="kvt gl" data-t="EM UM LUGAR.">' + L('EM UM LUGAR.', .25) + '<i class="kvscan"></i></div></div></div></div>',
    /* 9 logo final */ '<div class="kvs kvd kv9"><div class="kvc"><img class="kvwm" alt="" src="/ewwon/img/wordmark.png"><div class="kvtag">Sistema de gestão para equipes</div></div></div>'
  ];
  var T = [0, 1500, 4300, 7000, 9700, 12100, 14800, 17900, 20900, 23300]; /* início de cada cena (ms) */
  var END = 26300;

  var bg = document.createElement('div'); bg.className = 'kv'; bg.setAttribute('aria-hidden', 'true'); bg.innerHTML = S.join('');
  var sc = bg.querySelectorAll('.kvs'), ctl = document.createElement('button'); ctl.type = 'button'; ctl.className = 'kvctl';
  bg.appendChild(ctl); hero.classList.add('evk'); hero.insertBefore(bg, hero.firstChild);
  ['inicio', 'chat', 'tarefas', 'dash', 'calendario'].forEach(function (n) { var i = new Image(); i.src = D + n + '.webp'; });

  var timers = [], cur = -1, playing = false;
  function clear() { timers.forEach(clearTimeout); timers = []; }
  function go(n) {
    var prev = cur >= 0 ? sc[cur] : null; cur = n; var el = sc[n];
    el.classList.remove('out', 'fin'); el.classList.add('on', 'up'); void el.offsetWidth;
    if (prev) { prev.classList.add('out'); (function (p) { timers.push(setTimeout(function () { p.classList.remove('on', 'up', 'out'); }, 650)); })(prev); }
    timers.push(setTimeout(function () { el.classList.remove('up'); }, 700));
  }
  function finish(instant) {
    clear(); playing = false; hero.classList.add('done');
    try { sessionStorage.setItem(KEY, '1'); } catch (e) { }
    sc.forEach(function (s) { s.classList.remove('on', 'up', 'out', 'fin'); });
    sc[0].classList.add('on'); sc[0].querySelector('.kvdot').style.display = 'none';
    ctl.textContent = '↻ Assistir de novo'; ctl.onclick = function () { play(); };
  }
  function play() {
    clear(); playing = true; hero.classList.remove('done'); cur = -1;
    /* recria as cenas para reiniciar todas as animações */
    bg.querySelectorAll('.kvs').forEach(function (s) { var c = s.cloneNode(true); s.parentNode.replaceChild(c, s); });
    sc = bg.querySelectorAll('.kvs'); sc[0].querySelector('.kvdot').style.display = '';
    ctl.textContent = 'Pular ▸'; ctl.onclick = function () { finish(); };
    T.forEach(function (t, i) { timers.push(setTimeout(function () { go(i); }, t)); });
    timers.push(setTimeout(function () { sc[9].classList.add('fin'); }, END - 1100));
    timers.push(setTimeout(finish, END));
  }

  var seen = false; try { seen = sessionStorage.getItem(KEY) === '1'; } catch (e) { }
  if (reduce || seen) { sc[0].classList.add('on'); sc[0].querySelector('.kvdot').style.display = 'none'; hero.classList.add('done'); ctl.textContent = '↻ Assistir de novo'; ctl.onclick = function () { play(); }; }
  else play();
})();
