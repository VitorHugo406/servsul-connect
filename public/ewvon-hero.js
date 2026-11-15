/* Fundo da primeira parte da página inicial: telas reais do Ewvon passando em segundo plano (preto liso),
   com o texto e os botões por cima. Só existe no topo da página; o resto do site segue normal. */
(function () {
  'use strict';
  var hero = document.querySelector('header.hero');
  if (!hero) return;
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var D = '/intro/';
  var S = [['inicio', 'Início'], ['chat', 'Conversas'], ['tarefas', 'Tarefas em quadros'], ['avisos', 'Avisos'], ['calendario', 'Calendário e salas'], ['aniversariantes', 'Aniversariantes'], ['dash', 'Dashboard 3D']];

  var css = '' +
    '.hero.evh{position:relative;isolation:isolate;color:#fff;padding-bottom:64px}' +
    '.hero.evh h1{color:#fff}.hero.evh p{color:#c9c9d2}' +
    '.hero.evh .tag{background:rgba(255,255,255,.1);color:#fff;border-color:rgba(255,255,255,.22)}' +
    '.hero.evh .btn{background:#fff;color:#0a0a0b}.hero.evh .btn s{background:#0a0a0b}.hero.evh .btn s svg{color:#fff}' +
    '.hero.evh .btn.o{background:rgba(255,255,255,.08);color:#fff;border:1px solid rgba(255,255,255,.28)}' +
    '.hv-bg{position:absolute;z-index:-1;left:50%;width:100vw;margin-left:-50vw;top:-96px;bottom:0;background:#000;overflow:hidden;border-radius:0 0 40px 40px}' +
    '.hv-bg img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;object-position:top center;opacity:0;transition:opacity 1.2s ease;transform-origin:50% 20%;filter:brightness(.26) contrast(1.05)}' +
    '.hv-bg img.on{opacity:1;animation:hvz 7s ease-out both}@keyframes hvz{from{transform:scale(1.02)}to{transform:scale(1.1)}}' +
    '.hv-bg:after{content:"";position:absolute;inset:0;background:radial-gradient(ellipse at 50% 45%,rgba(0,0,0,.8),rgba(0,0,0,.5) 55%,rgba(0,0,0,.3)),linear-gradient(180deg,rgba(0,0,0,.5),transparent 25%,transparent 70%,rgba(0,0,0,.55))}' +
    '.hv-cap{position:absolute;left:50%;bottom:18px;transform:translateX(-50%);z-index:2;display:flex;gap:6px;align-items:center;font-size:12px;font-weight:700;color:#d8d8df;letter-spacing:.02em}' +
    '.hv-cap i{width:6px;height:6px;border-radius:50%;background:#3a3a3f;transition:.3s}.hv-cap i.on{background:#fff}.hv-cap b{margin-left:8px;font-weight:700}' +
    'nav{background:rgba(255,255,255,.92)!important}@media (prefers-reduced-motion:reduce){.hv-bg img.on{animation:none}}';
  var st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);

  var bg = document.createElement('div'); bg.className = 'hv-bg'; bg.setAttribute('aria-hidden', 'true');
  var imgs = S.map(function (s, i) { var im = new Image(); im.alt = ''; im.decoding = 'async'; if (i < 2) im.src = D + s[0] + '.webp'; else im.dataset.src = D + s[0] + '.webp'; bg.appendChild(im); return im; });
  var cap = document.createElement('div'); cap.className = 'hv-cap'; cap.setAttribute('aria-hidden', 'true');
  cap.innerHTML = S.map(function () { return '<i></i>'; }).join('') + '<b></b>';
  hero.classList.add('evh'); hero.insertBefore(bg, hero.firstChild); bg.appendChild(cap);
  var dots = cap.querySelectorAll('i'), label = cap.querySelector('b'), cur = -1;

  function show(n) {
    n = (n + S.length) % S.length;
    imgs.forEach(function (im, k) { if (k === n) { if (!im.src && im.dataset.src) im.src = im.dataset.src; im.classList.add('on'); } else im.classList.remove('on'); });
    var nx = imgs[(n + 1) % S.length]; if (nx && !nx.src && nx.dataset.src) nx.src = nx.dataset.src;
    dots.forEach(function (d, k) { d.classList.toggle('on', k === n); }); label.textContent = S[n][1]; cur = n;
  }
  show(0);
  if (!reduce) setInterval(function () { if (!document.hidden) show(cur + 1); }, 4200);
})();
