// Public legal pages: /termos, /privacidade, /cookies, /dpa (same text the acceptance gate links to).
import { Link } from 'react-router-dom';
import { LEGAL, LEGAL_DOCS, LEGAL_PATH, type LegalDocId } from '@/lib/legal';

const ORDER: LegalDocId[] = ['termos', 'privacidade', 'cookies', 'dpa'];

/** Renders "[campo a preencher]" placeholders highlighted so they are not missed before publishing. */
export function LegalText({ text }: { text: string }) {
  return <>{text.split(/(\[[^\]]+\])/g).map((part, i) => (/^\[[^\]]+\]$/.test(part) ? <mark key={i} className="rounded bg-yellow-200 px-1 text-yellow-900">{part}</mark> : <span key={i}>{part}</span>))}</>;
}

export function LegalDocView({ id }: { id: LegalDocId }) {
  const doc = LEGAL_DOCS[id];
  return (
    <article className="legal-doc">
      <h1>{doc.title}</h1>
      <p className="legal-meta">Versão {LEGAL.version} · atualizada em {LEGAL.updated}</p>
      <p><LegalText text={doc.intro} /></p>
      {doc.sections.map((s) => (
        <section key={s.h}>
          <h2>{s.h}</h2>
          {s.p.map((b, i) => Array.isArray(b)
            ? <ul key={i}>{b.map((li, j) => <li key={j}><LegalText text={li} /></li>)}</ul>
            : <p key={i}><LegalText text={b} /></p>)}
        </section>
      ))}
    </article>
  );
}

export default function Legal({ doc }: { doc: LegalDocId }) {
  return (
    <div className="legal-page">
      <header className="legal-top">
        <Link to="/" className="legal-brand">ewvon</Link>
        <nav>{ORDER.map((d) => <Link key={d} to={LEGAL_PATH[d]} className={d === doc ? 'on' : ''}>{LEGAL_DOCS[d].title.split(' (')[0]}</Link>)}</nav>
      </header>
      <main><LegalDocView id={doc} /></main>
      <footer className="legal-foot">© {new Date().getFullYear()} ewvon · Contato e Encarregado (DPO): {LEGAL.email}</footer>
    </div>
  );
}
