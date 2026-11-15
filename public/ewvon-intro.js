/* Apresentação animada do ewvon: roda sozinha nos primeiros instantes da página inicial, mostra as funções
   com jogo de luz e termina na frase de efeito. Pode ser pulada e só toca uma vez por sessão do navegador. */
(function () {
  'use strict';
  var KEY = 'ewvon-intro-v1';
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var running = false;

  var CSS = '' +
    '#evi{position:fixed;inset:0;z-index:9999;background:#05060b;color:#f5f6fa;font-family:"Plus Jakarta Sans",system-ui,-apple-system,"Segoe UI",sans-serif;overflow:hidden;opacity:1;transition:opacity .9s ease}' +
    '#evi.out{opacity:0;pointer-events:none}' +
    '#evi *{box-sizing:border-box}' +
    '#evi .lt{position:absolute;border-radius:50%;filter:blur(70px);opacity:.55;will-change:transform}' +
    '#evi .l1{width:46vmax;height:46vmax;left:-12vmax;top:-18vmax;background:radial-gradient(circle,#2f5bd8,transparent 65%);animation:evd1 9s ease-in-out infinite alternate}' +
    '#evi .l2{width:42vmax;height:42vmax;right:-14vmax;bottom:-16vmax;background:radial-gradient(circle,#7a4bdb,transparent 65%);animation:evd2 11s ease-in-out infinite alternate}' +
    '#evi .l3{width:26vmax;height:26vmax;left:38%;top:30%;background:radial-gradient(circle,#2bb3a3,transparent 65%);opacity:.28;animation:evd3 7s ease-in-out infinite alternate}' +
    '@keyframes evd1{to{transform:translate(14vmax,10vmax) scale(1.15)}}@keyframes evd2{to{transform:translate(-12vmax,-8vmax) scale(1.1)}}@keyframes evd3{to{transform:translate(-14vmax,8vmax) scale(1.3)}}' +
    '#evi .grid{position:absolute;inset:0;background-image:linear-gradient(rgba(255,255,255,.045) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.045) 1px,transparent 1px);background-size:56px 56px;mask-image:radial-gradient(ellipse at center,#000 20%,transparent 75%);-webkit-mask-image:radial-gradient(ellipse at center,#000 20%,transparent 75%)}' +
    '#evi .beam{position:absolute;top:-20%;bottom:-20%;width:22vmax;left:-30vmax;background:linear-gradient(100deg,transparent,rgba(255,255,255,.12),transparent);transform:skewX(-18deg);animation:evbm 5.2s linear infinite}' +
    '@keyframes evbm{to{left:130vw}}' +
    '#evi .sc{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:34px;padding:28px 24px 70px;opacity:0;visibility:hidden;transition:opacity .55s ease,transform .55s ease;transform:scale(.97)}' +
    '#evi .sc.on{opacity:1;visibility:visible;transform:none}' +
    '#evi .sc.gone{opacity:0;transform:scale(1.03)}' +
    '#evi .tx{text-align:center;max-width:620px}' +
    '#evi .kk{display:inline-block;font-size:12px;font-weight:800;letter-spacing:.16em;text-transform:uppercase;color:#9db4ff;border:1px solid rgba(157,180,255,.35);border-radius:999px;padding:6px 14px;margin-bottom:16px;background:rgba(47,91,216,.12)}' +
    '#evi h2{margin:0 0 12px;font-size:clamp(30px,5.4vw,56px);line-height:1.08;font-weight:800;letter-spacing:-.025em;background:linear-gradient(100deg,#fff 30%,#a9bcff 48%,#fff 66%);background-size:250% 100%;-webkit-background-clip:text;background-clip:text;color:transparent;animation:evsh 2.6s ease-out both}' +
    '@keyframes evsh{from{background-position:120% 0}to{background-position:-30% 0}}' +
    '#evi .tx p{margin:0;font-size:clamp(15px,2vw,19px);color:#b8bdd0;line-height:1.55}' +
    '#evi .sc.on .tx>*{animation:evup .7s cubic-bezier(.2,.7,.2,1) both}#evi .sc.on .tx>*:nth-child(2){animation-delay:.1s}#evi .sc.on .tx>*:nth-child(3){animation-delay:.2s}' +
    '@keyframes evup{from{opacity:0;transform:translateY(18px)}to{opacity:1;transform:none}}' +
    '#evi .vs{position:relative;width:min(560px,88vw);height:min(300px,34vh);display:flex;align-items:center;justify-content:center}' +
    '#evi .sc.on .vs{animation:evpop .8s cubic-bezier(.2,.8,.2,1) .15s both}' +
    '@keyframes evpop{from{opacity:0;transform:translateY(30px) scale(.94)}to{opacity:1;transform:none}}' +
    '#evi .win{width:100%;height:100%;border-radius:20px;background:linear-gradient(160deg,rgba(255,255,255,.1),rgba(255,255,255,.04));border:1px solid rgba(255,255,255,.14);box-shadow:0 30px 80px rgba(0,0,0,.5),0 0 60px rgba(70,110,255,.18);backdrop-filter:blur(8px);padding:18px;position:relative;overflow:hidden}' +
    '#evi .win:after{content:"";position:absolute;inset:0;background:linear-gradient(115deg,transparent 35%,rgba(255,255,255,.1) 50%,transparent 65%);transform:translateX(-120%);animation:evgl 2.4s ease-in-out .8s infinite}' +
    '@keyframes evgl{to{transform:translateX(120%)}}' +
    '#evi .dots{display:flex;gap:6px;margin-bottom:14px}#evi .dots i{width:9px;height:9px;border-radius:50%;background:rgba(255,255,255,.25)}' +
    /* chat */
    '#evi .chips{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px}#evi .chip{font-size:12px;font-weight:700;padding:5px 11px;border-radius:999px;background:rgba(255,255,255,.1);color:#dfe4f5}#evi .chip.a{background:#2358c3;color:#fff}' +
    '#evi .bub{max-width:72%;padding:10px 14px;border-radius:16px;font-size:14px;margin-bottom:9px;opacity:0;background:rgba(255,255,255,.12);color:#eef1fb}#evi .bub.r{margin-left:auto;background:#2358c3;color:#fff}' +
    '#evi .sc.on .bub{animation:evup .6s ease var(--d,.6s) both}' +
    '#evi .typ{display:inline-flex;gap:4px;margin-top:2px;opacity:0}#evi .sc.on .typ{animation:evup .4s ease 1.9s both}#evi .typ i{width:7px;height:7px;border-radius:50%;background:#9db4ff;animation:evbl 1s infinite}#evi .typ i:nth-child(2){animation-delay:.15s}#evi .typ i:nth-child(3){animation-delay:.3s}' +
    '@keyframes evbl{50%{transform:translateY(-5px);opacity:.5}}' +
    /* chamada */
    '#evi .call{display:flex;align-items:center;justify-content:center;gap:34px;height:100%;flex-direction:column}#evi .av{display:flex;gap:26px}' +
    '#evi .ap{position:relative;width:74px;height:74px;border-radius:50%;display:grid;place-items:center;font-weight:800;font-size:24px;color:#fff}' +
    '#evi .ap:before,#evi .ap:after{content:"";position:absolute;inset:0;border-radius:50%;border:2px solid currentColor;opacity:0;animation:evrg 2.2s ease-out infinite}#evi .ap:after{animation-delay:1.1s}' +
    '@keyframes evrg{from{transform:scale(1);opacity:.7}to{transform:scale(2);opacity:0}}' +
    '#evi .pill{padding:8px 16px;border-radius:999px;background:rgba(18,160,114,.18);color:#62e0b0;font-weight:700;font-size:14px;display:flex;gap:8px;align-items:center}#evi .pill b{width:8px;height:8px;border-radius:50%;background:#33d69f;animation:evbl 1.2s infinite}' +
    /* kanban */
    '#evi .kb{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;height:calc(100% - 22px)}#evi .col{background:rgba(255,255,255,.06);border-radius:12px;padding:10px;position:relative}' +
    '#evi .col h6{margin:0 0 9px;font-size:11px;letter-spacing:.1em;text-transform:uppercase;color:#a6adc4}' +
    '#evi .cd{height:34px;border-radius:9px;background:rgba(255,255,255,.14);margin-bottom:8px;position:relative}#evi .cd:before{content:"";position:absolute;left:10px;top:11px;width:55%;height:6px;border-radius:3px;background:rgba(255,255,255,.4)}' +
    '#evi .cd.m{background:#2358c3;box-shadow:0 0 24px rgba(60,110,255,.6);z-index:2;animation:evmv 2.4s ease-in-out .5s infinite alternate}' +
    '@keyframes evmv{0%{transform:translate(0,0)}45%{transform:translate(calc(100% + 12px),0)}100%{transform:translate(calc(200% + 24px),0)}}' +
    /* calendário */
    '#evi .cal{display:grid;grid-template-columns:repeat(5,1fr);gap:8px;height:calc(100% - 22px)}#evi .dy{background:rgba(255,255,255,.05);border-radius:10px;padding:8px;position:relative}#evi .dy h6{margin:0 0 8px;font-size:11px;color:#a6adc4;font-weight:700}' +
    '#evi .ev{border-radius:8px;padding:6px 8px;font-size:11px;font-weight:700;margin-bottom:6px;color:#fff;opacity:0}#evi .sc.on .ev{animation:evup .5s ease both}' +
    '#evi .ev.b{background:#2358c3}#evi .ev.v{background:#7a4bdb}#evi .ev.g{background:#12a072}#evi .ev.t{height:46px}' +
    /* avisos */
    '#evi .nt{display:flex;flex-direction:column;gap:10px}#evi .nc{display:flex;gap:12px;align-items:center;padding:12px 14px;border-radius:14px;background:rgba(255,255,255,.09);opacity:0;font-size:14px}#evi .sc.on .nc{animation:evup .6s ease both}#evi .nc:nth-child(2){animation-delay:.5s!important}#evi .nc:nth-child(3){animation-delay:.9s!important}' +
    '#evi .ic{width:38px;height:38px;border-radius:11px;display:grid;place-items:center;flex:none;font-size:18px;font-weight:800}' +
    '#evi .cf{position:absolute;width:7px;height:12px;border-radius:2px;opacity:0;animation:evcf 2.4s ease-out infinite}@keyframes evcf{0%{opacity:1;transform:translateY(0) rotate(0)}100%{opacity:0;transform:translateY(170px) rotate(360deg)}}' +
    /* avaliações */
    '#evi .doc{display:flex;gap:18px;height:100%}#evi .pg{flex:1;background:#fff;border-radius:10px;padding:14px;color:#1a1d29;position:relative}#evi .pg h6{margin:0 0 10px;font-size:12px;font-weight:800;letter-spacing:.04em}' +
    '#evi .br{display:flex;align-items:center;gap:8px;margin-bottom:8px;font-size:10px;font-weight:700;color:#5c6378}#evi .br i{flex:1;height:8px;border-radius:4px;background:#e7e9f0;overflow:hidden;position:relative}#evi .br i:after{content:"";position:absolute;inset:0;width:0;background:#2358c3;border-radius:4px}' +
    '#evi .sc.on .br i:after{animation:evbr 1.4s ease-out var(--d,0s) forwards}' +
    '@keyframes evbr{to{width:var(--w,70%)}}' +
    '#evi .qr{width:54px;height:54px;background:conic-gradient(#1a1d29 25%,#fff 0 50%,#1a1d29 0 75%,#fff 0) 0 0/14px 14px;border:3px solid #1a1d29;border-radius:4px;position:absolute;right:14px;bottom:14px}' +
    '#evi .stp{position:absolute;right:16px;top:12px;border:2px solid #2358c3;color:#2358c3;font-size:11px;font-weight:800;padding:3px 8px;border-radius:6px;transform:rotate(8deg);opacity:0}#evi .sc.on .stp{animation:evst .5s ease 1.6s both}@keyframes evst{from{opacity:0;transform:rotate(8deg) scale(2)}to{opacity:1;transform:rotate(8deg) scale(1)}}' +
    '#evi .sd{width:150px;display:flex;flex-direction:column;gap:10px;justify-content:center}#evi .sd div{padding:10px 12px;border-radius:12px;background:rgba(255,255,255,.1);font-size:12px;font-weight:700}' +
    /* dash 3d */
    '#evi .iso{position:relative;width:260px;height:260px;transform:rotateX(58deg) rotateZ(-40deg);transform-style:preserve-3d;animation:evfl 4s ease-in-out infinite alternate}' +
    '@keyframes evfl{to{transform:rotateX(58deg) rotateZ(-30deg) translateZ(10px)}}' +
    '#evi .fl{position:absolute;inset:0;border-radius:10px;border:2px solid rgba(255,255,255,.5);background:rgba(120,150,255,.16);box-shadow:0 0 40px rgba(80,120,255,.35)}' +
    '#evi .fl.f1{transform:translateZ(0)}#evi .fl.f2{transform:translateZ(46px)}#evi .fl.f3{transform:translateZ(92px)}#evi .fl.f4{transform:translateZ(138px);background:rgba(160,120,255,.2)}' +
    '#evi .sc.on .fl{animation:evfd 1.2s cubic-bezier(.2,.8,.2,1) both}#evi .sc.on .f2{animation-delay:.2s}#evi .sc.on .f3{animation-delay:.4s}#evi .sc.on .f4{animation-delay:.6s}' +
    '@keyframes evfd{from{opacity:0;margin-top:-80px}to{opacity:1;margin-top:0}}' +
    '#evi .fl b{position:absolute;width:14px;height:14px;border-radius:4px;background:#ffd166;box-shadow:0 0 12px #ffd166}' +
    /* ia */
    '#evi .orb{width:128px;height:128px;border-radius:50%;background:radial-gradient(circle at 35% 30%,#fff,#8fb0ff 30%,#6a4cff 60%,#1b1e5e);box-shadow:0 0 80px rgba(110,130,255,.8),0 0 160px rgba(120,80,255,.4);animation:evor 3s ease-in-out infinite alternate}' +
    '@keyframes evor{to{transform:scale(1.12);box-shadow:0 0 110px rgba(110,130,255,.95),0 0 200px rgba(120,80,255,.55)}}' +
    '#evi .orbit{position:absolute;inset:0;animation:evrt 12s linear infinite}@keyframes evrt{to{transform:rotate(360deg)}}' +
    '#evi .orbit span{position:absolute;padding:7px 13px;border-radius:999px;background:rgba(255,255,255,.12);border:1px solid rgba(255,255,255,.2);font-size:12px;font-weight:700;white-space:nowrap;animation:evrt 12s linear infinite reverse}' +
    /* app e seguranca */
    '#evi .ph{width:118px;height:236px;border-radius:24px;border:3px solid rgba(255,255,255,.5);background:linear-gradient(170deg,rgba(255,255,255,.14),rgba(255,255,255,.04));position:relative;padding:12px 9px;box-shadow:0 0 50px rgba(80,120,255,.3)}' +
    '#evi .ph i{display:block;height:26px;border-radius:8px;background:rgba(255,255,255,.16);margin-bottom:8px}#evi .ph i.n{background:#2358c3;opacity:0}#evi .sc.on .ph i.n{animation:evup .6s ease 1s both}' +
    '#evi .sh{width:130px;height:150px;margin-left:46px;display:grid;place-items:center;background:linear-gradient(160deg,#2f5bd8,#7a4bdb);clip-path:polygon(50% 0,100% 16%,100% 58%,50% 100%,0 58%,0 16%);box-shadow:0 0 40px rgba(100,120,255,.6);font-size:54px;font-weight:800}' +
    /* abertura e final */
    '#evi .logo{font-size:clamp(54px,11vw,128px);font-weight:800;letter-spacing:-.04em;background:linear-gradient(100deg,#fff 30%,#9db4ff 50%,#fff 70%);background-size:250% 100%;-webkit-background-clip:text;background-clip:text;color:transparent}' +
    '#evi .sc.on .logo{animation:evsh 2.4s ease-out both,evup .9s ease both}#evi .sub{color:#b8bdd0;font-size:clamp(15px,2vw,20px);margin-top:6px;opacity:0}#evi .sc.on .sub{animation:evup .8s ease .8s both}' +
    '#evi .big{font-size:clamp(34px,8vw,92px);font-weight:800;letter-spacing:-.035em;line-height:1.05;text-align:center}' +
    '#evi .big span{display:inline-block;opacity:0;background:linear-gradient(100deg,#fff 30%,#a9bcff 55%,#fff);-webkit-background-clip:text;background-clip:text;color:transparent;padding-bottom:.08em}' +
    '#evi .sc.on .big span{animation:evwd .9s cubic-bezier(.2,.8,.2,1) both}#evi .sc.on .big span:nth-child(2){animation-delay:.55s}#evi .sc.on .big span:nth-child(3){animation-delay:1.1s}' +
    '@keyframes evwd{from{opacity:0;transform:translateY(40px) scale(.9);filter:blur(10px)}to{opacity:1;transform:none;filter:none}}' +
    '#evi .flare{position:absolute;left:50%;top:50%;width:140vmax;height:3px;margin-left:-70vmax;background:linear-gradient(90deg,transparent,#9db4ff,#fff,#9db4ff,transparent);opacity:0;filter:blur(1px);box-shadow:0 0 60px 20px rgba(120,150,255,.5)}' +
    '#evi .sc.on .flare{animation:evfr 1.6s ease-out 1.6s both}@keyframes evfr{0%{opacity:0;transform:scaleX(0)}30%{opacity:1}100%{opacity:0;transform:scaleX(1)}}' +
    /* controles */
    '#evi .skip{position:absolute;top:18px;right:18px;z-index:5;background:rgba(255,255,255,.1);border:1px solid rgba(255,255,255,.22);color:#fff;border-radius:999px;padding:9px 18px;font:700 13px inherit;cursor:pointer}#evi .skip:hover{background:rgba(255,255,255,.2)}' +
    '#evi .pr{position:absolute;left:0;right:0;bottom:0;height:4px;background:rgba(255,255,255,.1)}#evi .pr i{display:block;height:100%;width:0;background:linear-gradient(90deg,#2f5bd8,#a98bff);box-shadow:0 0 14px #6a8cff}' +
    '#evi .cnt{position:absolute;bottom:16px;left:0;right:0;display:flex;justify-content:center;gap:7px;z-index:4}#evi .cnt i{width:7px;height:7px;border-radius:50%;background:rgba(255,255,255,.25);transition:.3s}#evi .cnt i.on{background:#fff;transform:scale(1.35)}' +
    '@media (max-width:640px){#evi .sc{gap:22px}#evi .vs{height:min(280px,38vh)}#evi .sd{display:none}}' +
    '@media (prefers-reduced-motion:reduce){#evi *{animation-duration:.01s!important}}';

  var P = ['#2358c3', '#7a4bdb', '#12a072', '#e0803a'];
  function av(l, c, d) { return '<div class="ap" style="background:' + c + ';color:' + c + ';animation-delay:' + d + 's"><span style="color:#fff;position:relative;z-index:1">' + l + '</span></div>'; }
  function cards(n, m) { var s = ''; for (var i = 0; i < n; i++) s += '<div class="cd' + (m && i === 0 ? ' m' : '') + '"></div>'; return s; }
  function conf() { var s = '', c = ['#ffd166', '#6ea0ff', '#ff7aa8', '#62e0b0']; for (var i = 0; i < 14; i++) s += '<i class="cf" style="left:' + (6 + i * 7) + '%;top:' + (-6 - (i % 3) * 8) + 'px;background:' + c[i % 4] + ';animation-delay:' + (i * .17) + 's"></i>'; return s; }
  function floorDots(n, seed) { var s = ''; for (var i = 0; i < n; i++) s += '<b style="left:' + (12 + ((i * 37 + seed * 11) % 70)) + '%;top:' + (14 + ((i * 53 + seed * 23) % 68)) + '%;' + (i % 3 ? 'background:#6ea0ff;box-shadow:0 0 10px #6ea0ff' : '') + '"></b>'; return s; }

  var SC = [
    { t: 'open', d: 2800, html: '<div class="logo">ewvon</div><div class="sub">Tudo que sua equipe precisa, em um só lugar.</div>' },
    { d: 2700, k: 'Chat por setores', h: 'Cada setor com a sua conversa', p: 'Canais por setor, conversas diretas e grupos, com arquivos, áudios e figurinhas.',
      v: '<div class="win"><div class="dots"><i></i><i></i><i></i></div><div class="chips"><span class="chip a"># Geral</span><span class="chip"># Vendas</span><span class="chip"># Suporte</span></div><div class="bub" style="--d:.6s">Bom dia, pessoal! A reunião é às 14h.</div><div class="bub r" style="--d:1.1s">Perfeito, já vou preparar o relatório.</div><div class="bub" style="--d:1.6s">Anexei a planilha no canal.</div><span class="typ"><i></i><i></i><i></i></span></div>' },
    { d: 2600, k: 'Chamadas de voz e vídeo', h: 'Fale com a equipe sem sair do ewvon', p: 'Chamadas dentro da plataforma, com histórico de perdidas e duração.',
      v: '<div class="win"><div class="call"><div class="av">' + av('A', P[0], 0) + av('C', P[1], .4) + av('M', P[2], .8) + '</div><div class="pill"><b></b>Chamada em andamento · 02:14</div></div></div>' },
    { d: 2700, k: 'Tarefas e quadros', h: 'Organize o trabalho em quadros Kanban', p: 'Responsáveis, prazos e prioridades. Todo mundo vê o andamento em tempo real.',
      v: '<div class="win"><div class="dots"><i></i><i></i><i></i></div><div class="kb"><div class="col"><h6>A fazer</h6>' + cards(3, 1) + '</div><div class="col"><h6>Em andamento</h6>' + cards(2) + '</div><div class="col"><h6>Concluído</h6>' + cards(1) + '</div></div></div>' },
    { d: 2600, k: 'Calendário e salas', h: 'Agenda e reuniões sem conflito', p: 'Reserve salas, veja horários livres e acompanhe os compromissos do time.',
      v: '<div class="win"><div class="dots"><i></i><i></i><i></i></div><div class="cal">' +
        ['Seg', 'Ter', 'Qua', 'Qui', 'Sex'].map(function (d, i) { return '<div class="dy"><h6>' + d + '</h6>' + (i % 2 ? '<div class="ev v" style="animation-delay:' + (.5 + i * .2) + 's">Alinhamento</div>' : '<div class="ev b t" style="animation-delay:' + (.5 + i * .2) + 's">Sala 1 · 14h</div>') + (i === 2 ? '<div class="ev g" style="animation-delay:1.4s">Entrevista</div>' : '') + '</div>'; }).join('') + '</div></div>' },
    { d: 2600, k: 'Avisos e aniversariantes', h: 'Ninguém perde o que importa', p: 'Avisos oficiais fixados para todos e os aniversariantes sempre em destaque.',
      v: '<div class="win">' + conf() + '<div class="nt"><div class="nc"><span class="ic" style="background:#2358c3">!</span><span><b>Aviso fixado</b><br>Novo horário de atendimento a partir de segunda.</span></div><div class="nc"><span class="ic" style="background:#7a4bdb">★</span><span><b>Aniversariantes de hoje</b><br>Ana (Financeiro) e Carlos (TI)</span></div><div class="nc"><span class="ic" style="background:#12a072">✓</span><span><b>Meta do mês batida</b><br>Parabéns, equipe!</span></div></div></div>' },
    { d: 2700, k: 'Avaliações', h: 'Avaliações de experiência e desempenho', p: 'Formulários de 45 e 90 dias em PDF, com avisos automáticos aos gestores.',
      v: '<div class="win"><div class="doc"><div class="pg"><span class="stp">45 DIAS</span><h6>AVALIAÇÃO DE EXPERIÊNCIA</h6><div class="br" style="--w:80%;--d:0.2s">Comunicação<i></i></div><div class="br" style="--w:68%;--d:0.45s">Responsabilidade<i></i></div><div class="br" style="--w:92%;--d:0.7s">Trabalho em equipe<i></i></div><div class="br" style="--w:54%;--d:0.95s">Iniciativa<i></i></div><span class="qr"></span></div><div class="sd"><div>Aviso 10 dias antes do fim</div><div>Documento validável por QR</div></div></div></div>' },
    { d: 2900, k: 'Dash 3D', h: 'O seu escritório em 3D, ao vivo', p: 'Veja cada andar, as pessoas, as salas de reunião e os indicadores no telão.',
      v: '<div class="iso"><div class="fl f1">' + floorDots(7, 1) + '</div><div class="fl f2">' + floorDots(6, 2) + '</div><div class="fl f3">' + floorDots(8, 3) + '</div><div class="fl f4">' + floorDots(5, 4) + '</div></div>' },
    { d: 2700, k: 'Assistente e integrações', h: 'Inteligência e conexões', p: 'Assistente de IA no chat e integrações com as ferramentas que você já usa.',
      v: '<div style="position:relative;width:300px;height:300px;display:grid;place-items:center"><div class="orb"></div><div class="orbit"><span style="left:50%;top:-4px;margin-left:-34px">Agenda</span><span style="right:-18px;top:46%">Arquivos</span><span style="left:50%;bottom:-4px;margin-left:-40px">Mensagens</span><span style="left:-22px;top:46%">RH</span></div></div>' },
    { d: 2700, k: 'Aplicativo e segurança', h: 'No celular e protegido', p: 'Aplicativo Android com notificações, dados criptografados e recursos de LGPD.',
      v: '<div style="display:flex;align-items:center"><div class="ph"><i></i><i></i><i class="n"></i><i></i><i></i></div><div class="sh">✓</div></div>' },
    { t: 'end', d: 4600, html: '<div class="flare"></div><div class="big"><span>Conversa.</span> <span>Tarefas.</span> <span>Reuniões.</span></div><div class="sub" style="animation-delay:2.2s">Conheça o ewvon.</div>' }
  ];

  var host = null;
  function build() {
    /* Shadow DOM: o estilo da apresentação não mistura com o da página (e vice-versa) */
    host = document.createElement('div'); host.id = 'evi-host'; host.style.cssText = 'position:fixed;inset:0;z-index:99999';
    var sr = host.attachShadow({ mode: 'open' });
    var st = document.createElement('style'); st.textContent = CSS + '#evi .vs{flex:none}'; sr.appendChild(st);
    var el = document.createElement('div'); el.id = 'evi'; el.setAttribute('role', 'region'); el.setAttribute('aria-label', 'Apresentação do ewvon');
    var h = '<div class="lt l1"></div><div class="lt l2"></div><div class="lt l3"></div><div class="grid"></div><div class="beam"></div><button class="skip" type="button">Pular apresentação</button>';
    SC.forEach(function (s) {
      if (s.html) h += '<div class="sc"><div style="text-align:center;position:relative">' + s.html + '</div></div>';
      else h += '<div class="sc"><div class="vs">' + s.v + '</div><div class="tx"><span class="kk">' + s.k + '</span><h2>' + s.h + '</h2><p>' + s.p + '</p></div></div>';
    });
    h += '<div class="cnt">' + SC.map(function () { return '<i></i>'; }).join('') + '</div><div class="pr"><i></i></div>';
    el.innerHTML = h; sr.appendChild(el); document.body.appendChild(host); return el;
  }

  function play(force) {
    if (running) return; running = true;
    var el = build(), sc = el.querySelectorAll('.sc'), dots = el.querySelectorAll('.cnt i'), bar = el.querySelector('.pr i');
    var total = SC.reduce(function (a, s) { return a + s.d; }, 0), t0 = Date.now(), timers = [], i = -1, done = false;
    document.documentElement.style.overflow = 'hidden';
    function show(n) {
      if (i >= 0) { sc[i].classList.remove('on'); sc[i].classList.add('gone'); (function (k) { setTimeout(function () { sc[k].classList.remove('gone'); }, 600); })(i); }
      i = n; sc[i].classList.add('on');
      dots.forEach(function (d, k) { d.classList.toggle('on', k === i); });
      if (i < SC.length - 1) timers.push(setTimeout(function () { show(i + 1); }, SC[i].d));
      else timers.push(setTimeout(finish, SC[i].d));
    }
    function tick() { if (done) return; bar.style.width = Math.min(100, (Date.now() - t0) / total * 100) + '%'; requestAnimationFrame(tick); }
    function finish() {
      if (done) return; done = true; timers.forEach(clearTimeout);
      try { sessionStorage.setItem(KEY, '1'); } catch (e) { }
      el.classList.add('out');
      setTimeout(function () { host.remove(); document.documentElement.style.overflow = ''; running = false; }, 1000);
    }
    el.querySelector('.skip').addEventListener('click', finish);
    document.addEventListener('keydown', function esc(e) { if (e.key === 'Escape' && !done) { finish(); document.removeEventListener('keydown', esc); } });
    show(0); tick();
  }

  window.ewvonIntro = function () { play(true); };

  function start() {
    var seen = false; try { seen = sessionStorage.getItem(KEY) === '1'; } catch (e) { }
    if (reduce || seen) return;
    var go = function () { play(false); };
    if (document.fonts && document.fonts.ready) Promise.race([document.fonts.ready, new Promise(function (r) { setTimeout(r, 800); })]).then(go); else go();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
