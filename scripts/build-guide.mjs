// Builds the public, crawlable guide center into dist/ after `vite build`:
//   /guia/                 → topics (cards) + every article listed by topic + client-side search
//   /guia/t/<topic>/       → one page per topic with its articles
//   /guia/<slug>/          → one page per article (steps with screenshots, tips, related, prev/next)
// Plain static HTML (no React), so Google reads everything without running JavaScript. Each page has title,
// description, canonical, Open Graph and JSON-LD (HowTo + BreadcrumbList; CollectionPage/ItemList on lists).
// Content comes from src/lib/guideArticles.ts (only PUBLISHED articles). Also appends every guide URL to
// dist/sitemap.xml. Screenshots live in public/guia/*.jpg (1440×900).
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { transformSync } from 'esbuild';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(root, 'dist');
const SITE = 'https://ewvon.com';
const src = readFileSync(join(root, 'src/lib/guideArticles.ts'), 'utf8');
const js = transformSync(src, { loader: 'ts', format: 'esm' }).code;
const mod = await import('data:text/javascript;base64,' + Buffer.from(js).toString('base64'));
const { PUBLISHED: ARTS, GUIDE_CATS, GUIDE_CAT_DESC } = mod;

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const slug = (s) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const cats = GUIDE_CATS.filter((c) => ARTS.some((a) => a.cat === c));
const byCat = (c) => ARTS.filter((a) => a.cat === c);
const today = new Date().toISOString().slice(0, 10);
const year = new Date().getFullYear();

const CSS = `*{box-sizing:border-box}:root{--bg:#fff;--ink:#0a0a0b;--mute:#5f6673;--line:#e8e8ee;--c1:#f6f7f9;--acc:#2358c3}
@media(prefers-color-scheme:dark){:root{--bg:#09090b;--ink:#f5f5f7;--mute:#a0a0ab;--line:#26262c;--c1:#131316;--acc:#7aa2ff}}
body{margin:0;font-family:'Plus Jakarta Sans',system-ui,-apple-system,'Segoe UI',sans-serif;color:var(--ink);background:var(--bg);line-height:1.65;-webkit-font-smoothing:antialiased}
a{color:inherit}.wrap{max-width:1120px;margin:0 auto;padding:0 20px}
.top{border-bottom:1px solid var(--line)}.top .wrap{display:flex;flex-wrap:wrap;gap:12px;align-items:center;justify-content:space-between;min-height:64px}
.logo{font-weight:800;font-size:22px;text-decoration:none}.logo small{font-weight:600;font-size:14px;color:var(--mute);margin-left:8px}
.top nav{display:flex;flex-wrap:wrap;gap:4px}.top nav a{color:var(--mute);text-decoration:none;font-size:14px;font-weight:600;padding:6px 12px;border-radius:999px}.top nav a:hover{background:var(--c1);color:var(--ink)}
.top nav a.cta{background:var(--ink);color:var(--bg)}
.hero{padding:44px 0 28px;border-bottom:1px solid var(--line);background:var(--c1)}.hero h1{font-size:clamp(28px,5vw,42px);line-height:1.15;margin:0 0 8px;letter-spacing:-.02em}.hero p{margin:0;color:var(--mute);font-size:17px;max-width:720px}
.search{position:relative;max-width:620px;margin-top:22px}.search input{width:100%;height:50px;border:1px solid var(--line);border-radius:12px;padding:0 16px 0 44px;font:inherit;font-size:16px;background:var(--bg);color:var(--ink)}
.search svg{position:absolute;left:15px;top:16px;width:18px;height:18px;color:var(--mute)}
#res{margin-top:8px;max-width:620px;border:1px solid var(--line);border-radius:12px;background:var(--bg);display:none}#res a{display:block;padding:10px 14px;text-decoration:none;border-top:1px solid var(--line)}#res a:first-child{border-top:0}#res a:hover{background:var(--c1)}#res small{display:block;color:var(--mute);font-size:13px}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:14px;margin:28px 0}
.tc{display:block;border:1px solid var(--line);border-radius:14px;padding:18px;text-decoration:none;background:var(--bg)}.tc:hover{border-color:var(--mute)}
.tc b{display:block;font-size:16px}.tc span{display:block;color:var(--mute);font-size:14px;margin-top:4px}.tc em{display:block;font-style:normal;font-size:12.5px;color:var(--mute);margin-top:10px}
.all h2{font-size:20px;margin:34px 0 8px}.all ul{list-style:none;margin:0;padding:0;columns:2;column-gap:28px}@media(max-width:700px){.all ul{columns:1}}
.all li{break-inside:avoid;padding:5px 0}.all li a{text-decoration:none;font-weight:600}.all li a:hover{text-decoration:underline}.all li small{display:block;color:var(--mute);font-size:13px;font-weight:400}
.crumb{font-size:13px;color:var(--mute);margin:22px 0 4px}.crumb a{color:var(--mute);text-decoration:none}.crumb a:hover{text-decoration:underline}
.layout{display:grid;grid-template-columns:250px 1fr;gap:40px;padding-bottom:40px}@media(max-width:860px){.layout{grid-template-columns:1fr}.side{order:2}}
.side{position:sticky;top:16px;align-self:start;font-size:14px;max-height:calc(100vh - 32px);overflow:auto;padding:24px 0}
.side p{font-size:11.5px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--mute);margin:16px 0 4px}.side a{display:block;text-decoration:none;color:var(--mute);padding:4px 10px;border-radius:8px}
.side a:hover{background:var(--c1);color:var(--ink)}.side a[aria-current]{background:var(--c1);color:var(--ink);font-weight:700}
article h1{font-size:clamp(26px,4vw,36px);line-height:1.2;margin:6px 0 10px;letter-spacing:-.015em}.sum{font-size:18px;color:var(--mute);margin:0 0 22px}
.steps{list-style:none;counter-reset:s;margin:0;padding:0}.steps>li{counter-increment:s;position:relative;padding:0 0 26px 46px}
.steps>li::before{content:counter(s);position:absolute;left:0;top:0;width:30px;height:30px;border-radius:50%;background:var(--ink);color:var(--bg);display:grid;place-items:center;font-weight:700;font-size:14px}
.steps h2{font-size:18px;margin:2px 0 4px}.steps p{margin:0;color:var(--mute)}
.steps figure{margin:14px 0 0}.steps img{width:100%;height:auto;border:1px solid var(--line);border-radius:12px;display:block}
.tips{border:1px solid var(--line);border-radius:12px;padding:14px 18px;background:var(--c1);margin:8px 0 24px}.tips h2{font-size:15px;margin:0 0 6px}.tips ul{margin:0;padding-left:18px;color:var(--mute)}
.rel h2{font-size:16px;margin:10px 0 8px}.rel a{display:inline-block;margin:0 8px 8px 0;padding:8px 14px;border:1px solid var(--line);border-radius:10px;text-decoration:none;font-weight:600;font-size:14px}
.pn{display:flex;justify-content:space-between;gap:12px;border-top:1px solid var(--line);padding-top:18px;margin-top:26px}.pn a{text-decoration:none;font-size:14px;max-width:48%}.pn small{display:block;color:var(--mute)}
.help{border-top:1px solid var(--line);margin-top:30px;padding-top:18px;color:var(--mute);font-size:14px}
.btn{display:inline-block;background:var(--ink);color:var(--bg);text-decoration:none;font-weight:700;padding:11px 20px;border-radius:999px;margin-top:10px}
footer{border-top:1px solid var(--line);color:var(--mute);font-size:13px;padding:26px 0 40px}footer a{color:var(--mute)}`;

const ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>';
const head = ({ title, desc, path, ld, img }) => `<!doctype html>
<html lang="pt-BR"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<meta name="robots" content="index, follow, max-image-preview:large">
<link rel="canonical" href="${SITE}${path}">
<link rel="icon" href="/favicon.ico" sizes="48x48"><link rel="icon" type="image/png" sizes="96x96" href="/favicon-96.png">
<meta property="og:type" content="article"><meta property="og:locale" content="pt_BR"><meta property="og:site_name" content="Ewvon Gestão de Tarefas">
<meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(desc)}"><meta property="og:url" content="${SITE}${path}">
<meta property="og:image" content="${SITE}${img || '/icons/logo-512.png'}"><meta name="twitter:card" content="${img ? 'summary_large_image' : 'summary'}">
<link rel="preconnect" href="https://fonts.googleapis.com"><link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;600;700;800&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/guia/guia.css">
<script type="application/ld+json">${JSON.stringify(ld).replace(/</g, '\\u003c')}</script>
</head><body>`;
const top = `<header class="top"><div class="wrap"><a class="logo" href="/guia/">ewvon<small>Guia de funcionalidades</small></a>
<nav aria-label="Navegação"><a href="/guia/">Todos os tópicos</a><a href="/ajuda">Perguntas frequentes</a><a href="/desenvolvedores">Desenvolvedores</a><a href="/seguranca">Segurança</a><a href="/">Site</a><a class="cta" href="/teste-gratuito.html">Testar grátis</a></nav></div></header>`;
const foot = `<footer><div class="wrap">© ${year} ewvon · Responsável: Vitor Hugo Almeida Santos (pessoa física), São Paulo/SP · <a href="mailto:ewvonsuporte@gmail.com">ewvonsuporte@gmail.com</a><br>
<a href="/termos">Termos de Uso</a> · <a href="/privacidade">Privacidade</a> · <a href="/cookies">Cookies</a> · <a href="/reembolso">Cancelamento e reembolso</a> · <a href="/acessibilidade">Acessibilidade</a> · <a href="/status">Status</a><br>
As telas mostradas no guia usam dados fictícios.</div></footer></body></html>`;
const crumbLd = (items) => ({ '@type': 'BreadcrumbList', itemListElement: items.map(([name, path], i) => ({ '@type': 'ListItem', position: i + 1, name, item: SITE + path })) });
const out = (path, html) => { const f = join(dist, path, 'index.html'); mkdirSync(dirname(f), { recursive: true }); writeFileSync(f, html); };
const sideNav = (current) => `<nav class="side" aria-label="Artigos do guia">${cats.map((c) => `<p><a href="/guia/t/${slug(c)}/" style="padding:0;color:inherit">${esc(c)}</a></p>${byCat(c).map((x) => `<a href="/guia/${x.slug}/"${x.slug === current ? ' aria-current="page"' : ''}>${esc(x.title)}</a>`).join('')}`).join('')}</nav>`;

// ── home
const index = ARTS.map((a) => ({ s: a.slug, t: a.title, c: a.cat, d: a.sum, k: a.steps.map((x) => x.t + ' ' + x.d).join(' ') }));
out('guia', head({
  title: 'Guia de funcionalidades do ewvon: passo a passo de todas as telas',
  desc: `Como usar o ewvon: ${ARTS.length} artigos com passo a passo e imagens sobre chat, murais e cards, agenda, War Room, pessoas, avaliações, integrações e administração.`,
  path: '/guia/',
  ld: { '@context': 'https://schema.org', '@graph': [
    { '@type': 'CollectionPage', name: 'Guia de funcionalidades do ewvon', url: SITE + '/guia/', inLanguage: 'pt-BR', isPartOf: { '@type': 'WebSite', name: 'Ewvon Gestão de Tarefas', url: SITE + '/' } },
    { '@type': 'ItemList', name: 'Tópicos do guia', itemListElement: cats.map((c, i) => ({ '@type': 'ListItem', position: i + 1, name: c, url: `${SITE}/guia/t/${slug(c)}/` })) },
    crumbLd([['ewvon', '/'], ['Guia', '/guia/']]),
  ] },
}) + top + `<main>
<section class="hero"><div class="wrap"><h1>Guia de funcionalidades</h1><p>Tudo o que dá para fazer no ewvon, explicado passo a passo e separado por tópico: ${ARTS.length} artigos em ${cats.length} tópicos.</p>
<div class="search">${ICON}<input id="q" type="search" placeholder="Buscar: mural, áudio, aprovação, War Room, avaliação…" aria-label="Buscar no guia" autocomplete="off"></div><div id="res" role="listbox"></div></div></section>
<div class="wrap"><div class="grid">${cats.map((c) => `<a class="tc" href="/guia/t/${slug(c)}/"><b>${esc(c)}</b><span>${esc(GUIDE_CAT_DESC[c] || '')}</span><em>${byCat(c).length} artigo(s)</em></a>`).join('')}</div>
<div class="all">${cats.map((c) => `<h2 id="${slug(c)}"><a href="/guia/t/${slug(c)}/" style="text-decoration:none">${esc(c)}</a></h2><ul>${byCat(c).map((a) => `<li><a href="/guia/${a.slug}/">${esc(a.title)}</a><small>${esc(a.sum)}</small></li>`).join('')}</ul>`).join('')}</div>
<p class="help">Não encontrou? Veja as <a href="/ajuda">perguntas frequentes</a> ou escreva para <a href="mailto:ewvonsuporte@gmail.com">ewvonsuporte@gmail.com</a>.</p></div></main>
<script>(function(){var A=${JSON.stringify(index).replace(/</g, '\\u003c')};var q=document.getElementById('q'),r=document.getElementById('res');
function f(s){return (s||'').normalize('NFD').replace(/[\\u0300-\\u036f]/g,'').toLowerCase()}
q.addEventListener('input',function(){var v=f(q.value.trim());if(v.length<2){r.style.display='none';r.innerHTML='';return}
var w=v.split(/\\s+/),h=A.map(function(a){var t=f(a.t),all=f(a.t+' '+a.c+' '+a.d+' '+a.k),ok=w.every(function(x){return all.indexOf(x)>=0});return ok?{a:a,s:(t.indexOf(v)>=0?2:0)+(f(a.d).indexOf(v)>=0?1:0)}:null}).filter(Boolean).sort(function(x,y){return y.s-x.s}).slice(0,10);
r.innerHTML=h.length?h.map(function(x){return '<a href="/guia/'+x.a.s+'/">'+x.a.t.replace(/</g,'&lt;')+'<small>'+x.a.c+' · '+x.a.d.replace(/</g,'&lt;')+'</small></a>'}).join(''):'<a href="/ajuda">Nada encontrado. Ver perguntas frequentes<small>ou escreva para ewvonsuporte@gmail.com</small></a>';r.style.display='block'})})();</script>` + foot);

// ── topics
for (const c of cats) {
  const list = byCat(c); const path = `/guia/t/${slug(c)}/`;
  out(`guia/t/${slug(c)}`, head({
    title: `${c} — guia do ewvon`, desc: `${GUIDE_CAT_DESC[c] || c} ${list.length} artigos com passo a passo.`, path,
    ld: { '@context': 'https://schema.org', '@graph': [
      { '@type': 'CollectionPage', name: `${c} — guia do ewvon`, url: SITE + path, inLanguage: 'pt-BR' },
      { '@type': 'ItemList', itemListElement: list.map((a, i) => ({ '@type': 'ListItem', position: i + 1, name: a.title, url: `${SITE}/guia/${a.slug}/` })) },
      crumbLd([['ewvon', '/'], ['Guia', '/guia/'], [c, path]]),
    ] },
  }) + top + `<div class="wrap"><div class="layout">${sideNav('')}<main><p class="crumb"><a href="/guia/">Guia</a> › ${esc(c)}</p>
<article><h1>${esc(c)}</h1><p class="sum">${esc(GUIDE_CAT_DESC[c] || '')}</p><div class="all"><ul style="columns:1">${list.map((a) => `<li><a href="/guia/${a.slug}/">${esc(a.title)}</a><small>${esc(a.sum)}</small></li>`).join('')}</ul></div></article></main></div></div>` + foot);
}

// ── articles
ARTS.forEach((a, i) => {
  const path = `/guia/${a.slug}/`; const cpath = `/guia/t/${slug(a.cat)}/`;
  const firstImg = a.steps.find((s) => s.img)?.img; const imgUrl = (n) => `/guia/${n}.jpg`;
  const rel = (a.rel || []).map((s) => ARTS.find((x) => x.slug === s)).filter(Boolean);
  const prev = ARTS[i - 1]; const next = ARTS[i + 1];
  const ld = { '@context': 'https://schema.org', '@graph': [
    { '@type': 'HowTo', name: a.title, description: a.sum, inLanguage: 'pt-BR', url: SITE + path, ...(firstImg ? { image: SITE + imgUrl(firstImg) } : {}),
      step: a.steps.map((s, k) => ({ '@type': 'HowToStep', position: k + 1, name: s.t, text: s.d, url: `${SITE}${path}#passo-${k + 1}`, ...(s.img ? { image: SITE + imgUrl(s.img) } : {}) })) },
    crumbLd([['ewvon', '/'], ['Guia', '/guia/'], [a.cat, cpath], [a.title, path]]),
  ] };
  out(`guia/${a.slug}`, head({ title: `${a.title} — guia do ewvon`, desc: a.sum, path, ld, img: firstImg ? imgUrl(firstImg) : undefined }) + top +
`<div class="wrap"><div class="layout">${sideNav(a.slug)}<main><p class="crumb"><a href="/guia/">Guia</a> › <a href="${cpath}">${esc(a.cat)}</a></p>
<article><h1>${esc(a.title)}</h1><p class="sum">${esc(a.sum)}</p>
<ol class="steps">${a.steps.map((s, k) => `<li id="passo-${k + 1}"><h2>${esc(s.t)}</h2><p>${esc(s.d)}</p>${s.img ? `<figure><img src="${imgUrl(s.img)}" width="1440" height="900" loading="${k ? 'lazy' : 'eager'}" alt="${esc(s.t)} — tela do ewvon"></figure>` : ''}</li>`).join('')}</ol>
${a.tips?.length ? `<aside class="tips"><h2>Dicas</h2><ul>${a.tips.map((t) => `<li>${esc(t)}</li>`).join('')}</ul></aside>` : ''}
${rel.length ? `<div class="rel"><h2>Artigos relacionados</h2>${rel.map((x) => `<a href="/guia/${x.slug}/">${esc(x.title)}</a>`).join('')}</div>` : ''}
<div class="pn">${prev ? `<a href="/guia/${prev.slug}/"><small>← Anterior</small>${esc(prev.title)}</a>` : '<span></span>'}${next ? `<a href="/guia/${next.slug}/" style="text-align:right"><small>Próximo →</small>${esc(next.title)}</a>` : ''}</div>
<p class="help">Ainda com dúvida? Veja as <a href="/ajuda">perguntas frequentes</a> ou escreva para <a href="mailto:ewvonsuporte@gmail.com">ewvonsuporte@gmail.com</a>.<br><a class="btn" href="/teste-gratuito.html">Testar o ewvon grátis</a></p>
</article></main></div></div>` + foot);
});

mkdirSync(join(dist, 'guia'), { recursive: true });
writeFileSync(join(dist, 'guia/guia.css'), CSS);

// ── sitemap
const sm = join(dist, 'sitemap.xml');
if (existsSync(sm)) {
  let x = readFileSync(sm, 'utf8').replace(/\s*<url><loc>https:\/\/ewvon\.com\/guia[^<]*<\/loc>.*?<\/url>/g, '');
  const urls = ['/guia/', ...cats.map((c) => `/guia/t/${slug(c)}/`), ...ARTS.map((a) => `/guia/${a.slug}/`)];
  x = x.replace('</urlset>', urls.map((u) => `  <url><loc>${SITE}${u}</loc><lastmod>${today}</lastmod><changefreq>monthly</changefreq><priority>${u === '/guia/' ? '0.8' : '0.6'}</priority></url>`).join('\n') + '\n</urlset>');
  writeFileSync(sm, x);
}
console.log(`guia: ${ARTS.length} artigos, ${cats.length} tópicos`);
