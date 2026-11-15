/* Abertura da página inicial no estilo "motion de letras": fundo escuro, ponto que explode em campo azul,
   palavras gigantes que revelam letra por letra, glitch, desfoque de movimento, telas reais do sistema girando
   em 3D e fechamento com a logo. Toca uma vez por sessão no topo da página; depois entram o título e os botões. */
(function () {
  'use strict';
  var hero = document.querySelector('header.hero');
  if (!hero) return;
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var KEY = 'ewvon-kin-v1', D = '/intro/', BLUE = '#2457F5';

  var WMP = 'M1011,84 1012,91 1045,160 1056,188 1064,202 1104,289 1120,319 1151,390 1159,403 1193,472 1208,507 1223,534 1233,559 1237,564 1246,584 1249,595 1270,635 1282,663 1295,686 1304,710 1319,737 1328,762 1340,786 1353,806 1375,828 1390,839 1410,848 1433,855 1460,856 1482,853 1506,845 1520,838 1540,822 1558,803 1567,791 1583,754 1616,691 1631,655 1670,581 1678,561 1695,530 1738,440 1759,401 1768,394 1775,393 1782,396 1792,408 1822,468 1831,491 1871,566 1952,732 1975,775 1980,788 1999,813 2026,836 2043,845 2071,854 2085,856 2117,855 2149,846 2169,836 2199,810 2213,791 2233,748 2244,730 2282,654 2293,636 2330,560 2349,526 2349,517 2344,508 2312,464 2240,354 2236,350 2233,350 2227,357 2191,431 2178,452 2167,476 2119,565 2109,576 2104,578 2092,579 2085,576 2080,571 1990,391 1985,385 1945,306 1941,295 1923,263 1893,200 1875,168 1857,147 1831,128 1817,121 1790,114 1767,113 1731,120 1708,131 1688,145 1664,173 1614,275 1608,284 1600,304 1584,333 1574,358 1536,431 1520,468 1514,477 1495,519 1480,547 1469,574 1461,585 1456,586 1448,579 1436,553 1431,546 1415,506 1407,493 1391,454 1377,428 1367,401 1345,360 1335,336 1328,324 1319,299 1304,273 1286,232 1279,221 1263,181 1256,171 1243,143 1230,125 1214,109 1197,96 1176,86 1159,81 1024,80 1015,81ZM123,244 97,285 87,309 80,321 72,341 62,384 57,398 55,420 50,443 50,502 55,524 57,547 63,563 73,604 81,623 86,630 89,640 99,660 122,696 163,744 180,761 214,788 252,812 310,838 338,846 395,856 455,858 941,858 957,857 963,853 965,829 964,694 959,688 421,687 401,685 371,677 334,662 298,637 281,621 265,602 250,579 233,541 224,508 222,484 222,452 224,432 233,401 242,379 255,355 276,326 308,297 334,281 354,271 377,263 427,254 669,254 701,259 725,266 742,273 780,296 806,322 820,341 831,363 836,376 836,381 829,386 430,386 405,393 389,402 371,419 361,436 353,459 353,491 355,500 370,535 382,550 391,554 1007,554 1017,551 1020,546 1022,424 1014,363 1004,329 990,290 958,236 932,201 907,176 878,152 829,122 794,106 744,89 712,83 679,80 421,80 393,82 361,88 325,98 287,113 254,129 222,149 179,182 150,212ZM2233,84 2235,89 2248,103 2278,142 2346,245 2360,271 2369,283 2385,311 2399,330 2409,349 2446,406 2456,425 2494,482 2511,513 2519,523 2552,575 2560,591 2600,651 2609,669 2647,728 2658,749 2672,769 2688,797 2709,820 2733,838 2762,850 2790,856 2828,854 2855,846 2868,840 2895,821 2917,795 2959,723 2999,659 3010,638 3028,611 3063,549 3125,449 3167,376 3180,357 3191,335 3224,283 3239,254 3269,207 3304,144 3326,112 3340,88 3340,83 3336,80 3319,79 3185,81 3154,90 3140,97 3113,116 3089,142 3080,160 3041,222 3024,254 3008,277 2974,337 2944,383 2871,509 2858,527 2836,567 2826,577 2808,579 2779,576 2769,567 2760,555 2694,446 2633,352 2622,332 2608,313 2599,295 2583,272 2575,257 2560,236 2525,176 2511,157 2498,135 2482,119 2447,95 2433,89 2401,81 2265,79 2236,81ZM4370,228 4343,269 4314,327 4298,378 4291,415 4288,475 4288,851 4290,855 4297,858 4454,858 4465,854 4467,850 4467,465 4471,432 4485,390 4496,368 4517,338 4542,313 4571,289 4604,270 4642,256 4657,253 4673,247 4713,242 4742,242 4782,247 4818,258 4854,273 4884,292 4913,316 4935,339 4961,379 4974,410 4977,424 4982,435 4985,456 4985,849 4987,854 4998,858 5152,858 5163,853 5164,429 5158,377 5134,302 5109,255 5086,221 5065,195 5033,163 5013,146 4974,119 4940,100 4873,73 4802,58 4750,53 4724,52 4670,57 4627,65 4599,72 4538,95 4489,121 4462,139 4421,172 4397,196ZM3676,58 3644,64 3606,75 3558,94 3509,120 3473,145 3442,171 3416,198 3385,236 3363,270 3336,326 3321,374 3315,401 3310,441 3310,497 3312,520 3320,557 3337,614 3361,662 3392,710 3437,760 3472,790 3507,814 3550,838 3587,853 3639,869 3684,877 3741,881 3792,880 3864,869 3893,861 3952,839 3975,825 3998,814 4034,788 4069,759 4104,722 4133,682 4158,639 4168,610 4175,596 4188,547 4196,486 4196,448 4187,380 4181,356 4158,296 4150,280 4128,245 4104,213 4079,185 4037,148 3999,121 3947,93 3920,82 3888,71 3832,58 3778,51 3738,51ZM3690,248 3733,242 3783,243 3817,248 3883,271 3926,297 3948,316 3974,345 4000,387 4011,417 4017,448 4016,492 4007,533 3984,576 3962,605 3925,638 3901,654 3882,664 3823,686 3780,693 3729,693 3682,685 3624,664 3581,638 3557,617 3542,601 3529,584 3510,553 3495,508 3491,481 3491,454 3496,423 3513,377 3538,339 3557,319 3587,293 3627,270Z';
  function WM(cls, color) { return '<svg class="' + cls + '" viewBox="0 0 5216 928" style="color:' + color + '" role="img" aria-label="Ewvon"><path fill="currentColor" fill-rule="evenodd" d="' + WMP + '"/></svg>'; }
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
    /* palco: só transform e opacity animam (composição na GPU), nada de blur/clip-path animado */
    '.kv{position:absolute;z-index:-1;left:50%;width:100vw;margin-left:-50vw;top:-96px;bottom:0;background:#09090b;overflow:hidden;border-radius:0 0 40px 40px;text-transform:uppercase;color:#fff;contain:layout paint}' +
    '.kv *{backface-visibility:hidden}' +
    '.kvs{position:absolute;inset:0;display:none;overflow:hidden;isolation:isolate}.kvs.on{display:block}.kvs.up{z-index:2}' +
    '.kvp{position:absolute;inset:0;will-change:transform}' +
    '.kvb .kvp{background:' + BLUE + '}.kvd .kvp{background:#09090b}' +
    '.kvb{color:#050c2b}.kvd{color:#fff}' +
    '.kvc{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center}' +
    '.kvw{display:inline-block;text-align:left}' +
    '.kvt{font-family:"Archivo Black","Plus Jakarta Sans",system-ui,sans-serif;font-weight:400;line-height:.9;letter-spacing:-.02em;font-size:clamp(40px,9.2vw,158px);white-space:nowrap;position:relative}' +
    '.kvt.sm{font-size:clamp(18px,3.2vw,52px);letter-spacing:-.01em;margin-bottom:.14em;line-height:1}' +
    '.kvm{display:inline-block;overflow:hidden;vertical-align:top;padding:.04em .02em .1em;margin:-.04em -.02em -.1em}' +
    '.kvl{display:inline-block;transform:translate3d(0,112%,0);animation:kvup .75s cubic-bezier(.16,1,.3,1) forwards;animation-delay:calc(var(--d,0s) + var(--i) * 34ms);will-change:transform}' +
    '@keyframes kvup{to{transform:translate3d(0,0,0)}}' +
    /* saída: rastro de movimento sem blur (esticamento + fade) */
    '.kvs.out .kvc,.kvs.out .kvside{animation:kvout .45s cubic-bezier(.7,0,.84,0) forwards}' +
    '@keyframes kvout{to{opacity:0;transform:translate3d(-14%,0,0) scaleX(1.35)}}' +
    /* S0: ponto */
    '.kvdot{position:absolute;left:50%;top:50%;width:18px;height:18px;margin:-9px;border-radius:50%;background:' + BLUE + ';animation:kvdp .6s ease-in-out infinite alternate}@keyframes kvdp{to{transform:scale(1.8)}}' +
    /* S1: o ponto vira o campo azul (círculo que cresce) */
    '.kv1 .kvp{border-radius:50%;left:50%;top:50%;right:auto;bottom:auto;width:20px;height:20px;margin:-10px;transform:scale(1);animation:kvgrow .8s cubic-bezier(.65,0,.2,1) forwards}' +
    '@keyframes kvgrow{to{transform:scale(260)}}' +
    '.kv1 .kvc{opacity:0;animation:kvfadein .01s linear .35s forwards}@keyframes kvfadein{to{opacity:1}}' +
    /* S3: abre pela linha do meio (painel que cresce) e desfile de telas */
    '.kv3 .kvp{transform:scaleY(.006);animation:kvopen .75s cubic-bezier(.65,0,.2,1) forwards}@keyframes kvopen{to{transform:scaleY(1)}}' +
    '.kvcard{position:absolute;left:50%;top:50%;width:min(50vw,700px);aspect-ratio:1440/860;border-radius:18px;overflow:hidden;background:#fff;box-shadow:0 30px 70px rgba(0,0,0,.5),0 0 0 1px rgba(255,255,255,.14);will-change:transform;transform:translate3d(-50%,-50%,0) perspective(1600px) rotateY(-18deg) rotateX(7deg) rotateZ(-3deg)}' +
    '.kvcard img{display:block;width:100%;height:100%;object-fit:cover;object-position:top}' +
    '.kv3 .kvcard{opacity:0}' +
    '.kv3 .c1{z-index:3;animation:kvr1 1.4s cubic-bezier(.16,1,.3,1) .95s both,kvfl 3.4s ease-in-out 2.5s infinite alternate}' +
    '.kv3 .c2{z-index:2;width:min(36vw,500px);animation:kvr2 1.4s cubic-bezier(.16,1,.3,1) 1.15s both}' +
    '.kv3 .c3{z-index:2;width:min(36vw,500px);animation:kvr3 1.4s cubic-bezier(.16,1,.3,1) 1.35s both}' +
    '@keyframes kvr1{from{opacity:0;transform:translate3d(-50%,60vh,0) perspective(1600px) rotateY(-18deg) rotateX(7deg) rotateZ(-3deg)}to{opacity:1;transform:translate3d(-50%,-50%,0) perspective(1600px) rotateY(-18deg) rotateX(7deg) rotateZ(-3deg)}}' +
    '@keyframes kvr2{from{opacity:0;transform:translate3d(-170%,60vh,0) perspective(1600px) rotateY(-26deg) rotateX(7deg) rotateZ(-6deg)}to{opacity:1;transform:translate3d(-128%,-70%,0) perspective(1600px) rotateY(-26deg) rotateX(7deg) rotateZ(-6deg)}}' +
    '@keyframes kvr3{from{opacity:0;transform:translate3d(70%,60vh,0) perspective(1600px) rotateY(-10deg) rotateX(7deg) rotateZ(0deg)}to{opacity:1;transform:translate3d(28%,-30%,0) perspective(1600px) rotateY(-10deg) rotateX(7deg) rotateZ(0deg)}}' +
    '@keyframes kvfl{to{transform:translate3d(-50%,-53%,0) perspective(1600px) rotateY(-14deg) rotateX(6deg) rotateZ(-2deg)}}' +
    /* S4: logo grande */
    '.kvlogo{width:min(70vw,980px);height:auto;opacity:0;will-change:transform;animation:kvlg 1s cubic-bezier(.16,1,.3,1) .1s forwards}@keyframes kvlg{from{opacity:0;transform:scale(2.4)}to{opacity:.92;transform:none}}' +
    '.kvbar{position:absolute;left:0;right:0;bottom:0;top:0;background:#09090b;transform:scaleY(0);transform-origin:bottom;will-change:transform;animation:kvbar .55s cubic-bezier(.65,0,.2,1) 1.9s forwards}@keyframes kvbar{to{transform:scaleY(1)}}' +
    /* S5: cartão + texto lateral */
    '.kv5 .kvp{transform:translate3d(100%,0,0);animation:kvwipe .65s cubic-bezier(.65,0,.2,1) forwards}@keyframes kvwipe{to{transform:none}}' +
    '.kv5 .kvside,.kv5 .kvring,.kv5 .kvcard{opacity:0;animation:kvfadein .01s linear .4s forwards}' +
    '.kvside{position:absolute;left:7vw;top:50%;transform:translateY(-50%);text-align:left}' +
    '.kvside .kvt{font-size:clamp(38px,7.4vw,126px);color:#fff}.kvside .kvt.sm{font-size:clamp(18px,2.8vw,44px);color:#8fa9ff}' +
    '.kvpair{position:absolute;left:0;top:0;transform:translateY(-50%)}.kvpair.a{animation:kvhide .4s cubic-bezier(.7,0,.84,0) 1.5s forwards}@keyframes kvhide{to{opacity:0;transform:translate3d(-8%,-50%,0)}}' +
    '.kvring{position:absolute;left:73%;top:50%;width:min(44vw,560px);aspect-ratio:1;margin:calc(min(44vw,560px) / -2) 0 0 calc(min(44vw,560px) / -2);border-radius:50%;border:2px dashed rgba(143,169,255,.35);will-change:transform;animation:kvfadein .01s linear .4s forwards,kvspin 16s linear infinite}@keyframes kvspin{to{transform:rotate(360deg)}}' +
    '.kv5 .kvcard{left:73%;width:min(30vw,420px);aspect-ratio:3/4;animation:kvfadein .01s linear .4s forwards,kvfly 1s cubic-bezier(.16,1,.3,1) .45s both}.kv5 .kvcard img{object-position:left top}' +
    '@keyframes kvfly{from{transform:translate3d(60vw,-50%,0) perspective(1600px) rotateY(-45deg) rotateZ(-10deg)}to{transform:translate3d(-50%,-50%,0) perspective(1600px) rotateY(-18deg) rotateX(6deg) rotateZ(-4deg)}}' +
    /* S6: símbolos gigantes que se transformam (só escala, giro e opacidade) */
    '.kvg{position:absolute;left:50%;top:46%;width:min(54vh,46vw,500px);aspect-ratio:1;margin:calc(min(54vh,46vw,500px) / -2) 0 0 calc(min(54vh,46vw,500px) / -2)}' +
    '.kvg>div{position:absolute;inset:0;opacity:0;animation:kvgo 1s linear both;--dl:0s;animation-delay:var(--dl)}.kvg>div:nth-child(2){--dl:.95s}.kvg>div:nth-child(3){--dl:1.9s}' +
    '.kvg svg{will-change:transform;animation:kvgs 1s cubic-bezier(.4,0,.2,1) both;animation-delay:var(--dl)}' +
    '.kvg svg{display:block;width:100%;height:100%}.kvg b{font-family:"Archivo Black","Plus Jakarta Sans",sans-serif;font-weight:400;position:absolute;left:0;right:0;bottom:-14%;text-align:center;font-size:clamp(15px,2vw,28px);letter-spacing:.2em}' +
    '@keyframes kvgo{0%{opacity:0}20%{opacity:1}80%{opacity:1}100%{opacity:0}}@keyframes kvgs{0%{transform:scale(.5) rotate(-16deg)}24%,76%{transform:none}100%{transform:scale(1.5) rotate(12deg)}}' +
    /* S7: palavras em sequência */
    '.kv7 .kvt{position:absolute;left:0;right:0;top:50%;margin-top:-.45em;text-align:center;font-size:clamp(46px,12vw,205px);opacity:0;will-change:transform,opacity;animation:kvslam .95s cubic-bezier(.16,1,.3,1) both}' +
    '.kv7 .kvt:nth-child(2){animation-delay:.95s}.kv7 .kvt:nth-child(3){animation-delay:1.9s;color:' + BLUE + '}' +
    '@keyframes kvslam{0%{opacity:0;transform:scale(1.45)}18%{opacity:1;transform:scale(1)}84%{opacity:1;transform:scale(1.015)}100%{opacity:0;transform:scale(.92)}}' +
    /* S9: logo final */
    '.kvwm{width:min(66vw,900px);height:auto;clip-path:inset(0 100% 0 0);animation:kvwm .9s cubic-bezier(.65,0,.2,1) .1s forwards}@keyframes kvwm{to{clip-path:inset(0 0 0 0)}}' +
    '.kvtag{margin-top:22px;font-weight:700;font-size:clamp(12px,1.5vw,18px);letter-spacing:.3em;color:#c9c9d2;opacity:0;animation:kvfade .8s ease 1s forwards}@keyframes kvfade{to{opacity:1}}' +
    '.kvs.fin .kvc{animation:kvfin .8s ease forwards}@keyframes kvfin{to{opacity:0;transform:scale(.96)}}' +
    /* controles */
    '.kvctl{position:absolute;z-index:6;right:18px;bottom:16px;border:1px solid rgba(255,255,255,.35);background:rgba(0,0,0,.35);color:#fff;border-radius:999px;padding:8px 16px;font:700 12px inherit;cursor:pointer;text-transform:none;letter-spacing:.02em}.kvctl:hover{background:rgba(255,255,255,.18)}' +
    '@media (max-width:640px){.kvt{font-size:10.2vw}.kvt.sm{font-size:5.4vw}.kv7 .kvt{font-size:13.5vw}.kvside .kvt{font-size:9vw}.kvside .kvt.sm{font-size:4.6vw}.kvside{left:5vw}.kvring{left:78%}.kv5 .kvcard{left:78%;width:34vw}.kv3 .c1{width:78vw}.kv3 .c2,.kv3 .c3{width:56vw}.hero.evk{padding-bottom:70px}}' +
    '@media (prefers-reduced-motion:reduce){.kv *{animation-duration:.01s!important;animation-delay:0s!important}}';
  var st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);

  var SV = '<svg viewBox="0 0 200 200" fill="none">';
  var S = [
    /* 0 ponto */ '<div class="kvs kvd"><div class="kvdot"></div></div>',
    /* 1 SEU TRABALHO */ '<div class="kvs kvb kv1"><div class="kvp"></div><div class="kvc"><div class="kvt">' + L('SEU TRABALHO', .4) + '</div></div></div>',
    /* 2 SEM BAGUNÇA */ '<div class="kvs kvb"><div class="kvp"></div><div class="kvc"><div class="kvw"><div class="kvt sm">' + L('SEM', .1) + '</div><div class="kvt">' + L('BAGUNÇA.', .25) + '</div></div></div></div>',
    /* 3 tela em zoom */ '<div class="kvs kvd kv3"><div class="kvp"></div>' + card('tarefas', '', 'c2') + card('calendario', '', 'c3') + card('chat', '', 'c1') + '</div>',
    /* 4 logo */ '<div class="kvs kvb"><div class="kvp"></div><div class="kvc">' + WM('kvlogo', '#050c2b') + '</div><div class="kvbar"></div></div>',
    /* 5 UMA EQUIPE / UM SISTEMA */ '<div class="kvs kvd kv5"><div class="kvp"></div><div class="kvring"></div><div class="kvside"><div class="kvpair a"><div class="kvt sm">' + L('UMA', .5) + '</div><div class="kvt">' + L('EQUIPE.', .6) + '</div></div><div class="kvpair"><div class="kvt sm">' + L('UM', 1.75) + '</div><div class="kvt">' + L('SISTEMA.', 1.85) + '</div></div></div>' + card('tarefas', '', '') + '</div>',
    /* 6 símbolos */ '<div class="kvs kvd kv6"><div class="kvp"></div><div class="kvg">' +
      '<div>' + SV + '<path d="M30 46c0-9 7-16 16-16h108c9 0 16 7 16 16v70c0 9-7 16-16 16H88l-34 30v-30H46c-9 0-16-7-16-16z" fill="' + BLUE + '"/></svg><b>CONVERSAS</b></div>' +
      '<div>' + SV + '<circle cx="100" cy="100" r="72" fill="' + BLUE + '"/><path d="M62 102l26 26 52-56" stroke="#fff" stroke-width="16" stroke-linecap="round" stroke-linejoin="round"/></svg><b>TAREFAS</b></div>' +
      '<div>' + SV + '<rect x="28" y="40" width="144" height="130" rx="18" fill="' + BLUE + '"/><rect x="28" y="40" width="144" height="34" rx="18" fill="#fff" opacity=".9"/><rect x="50" y="26" width="12" height="28" rx="6" fill="#fff"/><rect x="138" y="26" width="12" height="28" rx="6" fill="#fff"/><g fill="#fff"><rect x="50" y="92" width="22" height="20" rx="5"/><rect x="89" y="92" width="22" height="20" rx="5"/><rect x="128" y="92" width="22" height="20" rx="5"/><rect x="50" y="128" width="22" height="20" rx="5"/><rect x="89" y="128" width="22" height="20" rx="5" opacity=".5"/></g></svg><b>REUNIÕES</b></div>' +
      '</div></div>',
    /* 7 CONVERSE ORGANIZE CONCLUA */ '<div class="kvs kvd kv7"><div class="kvp"></div><div class="kvt">CONVERSE.</div><div class="kvt">ORGANIZE.</div><div class="kvt">CONCLUA.</div></div>',
    /* 8 TUDO EM UM LUGAR */ '<div class="kvs kvb"><div class="kvp"></div><div class="kvc"><div class="kvw"><div class="kvt sm">' + L('TUDO', .1) + '</div><div class="kvt">' + L('EM UM LUGAR.', .25) + '</div></div></div></div>',
    /* 9 logo final */ '<div class="kvs kvd kv9"><div class="kvp"></div><div class="kvc">' + WM('kvwm', '#fff') + '<div class="kvtag">Sistema de gestão para equipes</div></div></div>'
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

  /* fonte pesada de título (Archivo Black): espera carregar antes de começar, para as letras não trocarem no meio */
  var lk = document.createElement('link'); lk.rel = 'stylesheet'; lk.href = 'https://fonts.googleapis.com/css2?family=Archivo+Black&display=swap'; document.head.appendChild(lk);
  var fontReady = (document.fonts && document.fonts.load) ? Promise.race([document.fonts.load('1em "Archivo Black"'), new Promise(function (r) { setTimeout(r, 2500); })]) : Promise.resolve();
  var seen = false; try { seen = sessionStorage.getItem(KEY) === '1'; } catch (e) { }
  if (reduce || seen) { sc[0].classList.add('on'); sc[0].querySelector('.kvdot').style.display = 'none'; hero.classList.add('done'); ctl.textContent = '↻ Assistir de novo'; ctl.onclick = function () { play(); }; }
  else fontReady.catch(function () { }).then(function () { return Promise.all(['chat', 'tarefas', 'calendario', 'dash'].map(function (n) { var i = new Image(); i.src = D + n + '.webp'; return i.decode ? i.decode().catch(function () { }) : 0; })); }).then(play);
})();
