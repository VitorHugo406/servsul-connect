// Public guide center (/guia and /guia/<slug>), help-center style: searchable home with categories, and articles with
// a left menu, breadcrumb, "Neste artigo", numbered steps with screenshots, tips and related articles. Content lives in
// src/lib/guideArticles.ts; screenshots in public/guia/*.jpg (test mode, fictional data).
import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ChevronRight, Lightbulb, Search, ThumbsDown, ThumbsUp, X } from 'lucide-react';
import { PUBLISHED as GUIDE, GUIDE_CATS, type GuideArticle } from '@/lib/guideArticles';
import '@/styles/guide.css';

const fold = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

function Top({ q, setQ }: { q: string; setQ: (v: string) => void }) {
  return (
    <header className="gd-top">
      <div className="gd-in">
        <Link to="/guia" className="gd-brand"><img src="/ewwon/img/receipt-logo.png" alt="ewvon" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} /><span>Guia</span></Link>
        <label className="gd-srch"><Search className="h-4 w-4" /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar no guia (ex.: formulário, prazo, campos)" aria-label="Buscar no guia" />{q ? <button type="button" onClick={() => setQ('')} aria-label="Limpar"><X className="h-4 w-4" /></button> : null}</label>
        <nav className="gd-nav"><Link to="/ajuda">Perguntas frequentes</Link><Link to="/desenvolvedores">Desenvolvedores</Link><Link to="/seguranca">Segurança</Link><a href="/" className="gd-cta">Entrar</a></nav>
      </div>
    </header>
  );
}

function Results({ q }: { q: string }) {
  const f = fold(q.trim());
  const list = GUIDE.filter((a) => fold(`${a.title} ${a.sum} ${a.steps.map((s) => `${s.t} ${s.d}`).join(' ')}`).includes(f));
  return (
    <div className="gd-res">
      <p className="gd-mut">{list.length} resultado(s) para “{q}”</p>
      {list.map((a) => <Link key={a.slug} to={`/guia/${a.slug}`} className="gd-ri"><b>{a.title}</b><span>{a.cat}</span><p>{a.sum}</p></Link>)}
      {!list.length ? <p>Nada encontrado. Tente outra palavra ou veja as <Link to="/ajuda" className="underline">perguntas frequentes</Link>.</p> : null}
    </div>
  );
}

function Home() {
  return (
    <>
      <section className="gd-hero"><div className="gd-in"><h1>Como podemos ajudar?</h1><p>Guias passo a passo, com imagens, para usar o ewvon no dia a dia da sua equipe.</p></div></section>
      <div className="gd-in gd-cats">
        {GUIDE_CATS.map((c) => { const list = GUIDE.filter((a) => a.cat === c); return (
          <section key={c} className="gd-cat"><h2>{c}</h2><ul>{list.map((a) => <li key={a.slug}><Link to={`/guia/${a.slug}`}>{a.title}</Link></li>)}</ul></section>); })}
      </div>
    </>
  );
}

function Article({ a }: { a: GuideArticle }) {
  const [vote, setVote] = useState<'' | 'y' | 'n'>('');
  const [zoom, setZoom] = useState<string | null>(null);
  useEffect(() => { window.scrollTo(0, 0); setVote(''); }, [a.slug]);
  const rel = (a.rel || []).map((s) => GUIDE.find((x) => x.slug === s)).filter(Boolean) as GuideArticle[];
  return (
    <div className="gd-in gd-art">
      <aside className="gd-side">
        {GUIDE_CATS.map((c) => <div key={c}><p className="gd-sc">{c}</p>{GUIDE.filter((x) => x.cat === c).map((x) => <Link key={x.slug} to={`/guia/${x.slug}`} className={x.slug === a.slug ? 'on' : ''}>{x.title}</Link>)}</div>)}
      </aside>
      <article className="gd-body">
        <nav className="gd-bc"><Link to="/guia">Guia</Link><ChevronRight className="h-3.5 w-3.5" /><span>{a.cat}</span></nav>
        <h1>{a.title}</h1>
        <p className="gd-sum">{a.sum}</p>
        <div className="gd-toc"><b>Neste artigo</b><ol>{a.steps.map((s, i) => <li key={i}><a href={`#passo-${i + 1}`}>{s.t}</a></li>)}</ol></div>
        {a.steps.map((s, i) => (
          <section key={i} id={`passo-${i + 1}`} className="gd-step">
            <h2><span>{i + 1}</span>{s.t}</h2>
            <p>{s.d}</p>
            {s.img ? <figure><button type="button" onClick={() => setZoom(s.img!)} aria-label="Ampliar imagem"><img src={`/guia/${s.img}.jpg`} alt={s.t} loading="lazy" /></button><figcaption>Clique para ampliar</figcaption></figure> : null}
          </section>))}
        {a.tips?.length ? <div className="gd-tip"><Lightbulb className="h-5 w-5" /><div><b>Dicas</b><ul>{a.tips.map((t, i) => <li key={i}>{t}</li>)}</ul></div></div> : null}
        <div className="gd-vote">{vote ? <span>Obrigado pelo retorno!</span> : <><span>Este artigo ajudou?</span><button type="button" onClick={() => setVote('y')}><ThumbsUp className="h-4 w-4" />Sim</button><button type="button" onClick={() => setVote('n')}><ThumbsDown className="h-4 w-4" />Não</button></>}</div>
        {rel.length ? <div className="gd-rel"><b>Artigos relacionados</b>{rel.map((r) => <Link key={r.slug} to={`/guia/${r.slug}`}>{r.title}<span>{r.sum}</span></Link>)}</div> : null}
      </article>
      {zoom ? <div className="gd-zoom" onClick={() => setZoom(null)} role="dialog" aria-label="Imagem ampliada"><img src={`/guia/${zoom}.jpg`} alt="" /></div> : null}
    </div>
  );
}

export default function GuideCenter() {
  const { slug } = useParams(); const nav = useNavigate();
  const [q, setQ] = useState('');
  const a = useMemo(() => GUIDE.find((x) => x.slug === slug) || null, [slug]);
  useEffect(() => { document.title = a ? `${a.title} | Guia ewvon` : 'Guia do ewvon — passo a passo'; }, [a]);
  useEffect(() => { if (slug && !a) nav('/guia', { replace: true }); }, [slug, a, nav]);
  return (
    <div className="gd">
      <Top q={q} setQ={setQ} />
      {q.trim() ? <div className="gd-in"><Results q={q} /></div> : a ? <Article a={a} /> : <Home />}
      <footer className="gd-foot"><div className="gd-in"><span>© ewvon</span><Link to="/ajuda">Ajuda</Link><Link to="/status">Status</Link><Link to="/termos">Termos</Link><Link to="/privacidade">Privacidade</Link></div></footer>
    </div>
  );
}
