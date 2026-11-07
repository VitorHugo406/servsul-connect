// "Avaliações" in the mobile Meu perfil: in-progress and finished evaluations the
// user received (scores, criteria, feedback) and the detail page where they give
// ciência or ask for a review. Same rules/data as the desktop tab (src/lib/evaluations.ts).
import { useCallback, useEffect, useState } from 'react';
import type { EwApi } from './EwwonApp';
import { Seg } from './EwwonApp';
import { I, Chev } from './icons';
import * as E from '@/lib/evaluations';
import type { EvalItem, EvalRow } from '@/lib/evaluations';
import { openReport } from '@/lib/reports';

const TONE: Record<string, string> = { good: '#46d37b', info: '#7cc6ff', warn: '#ffc36b', bad: '#ff7a7a', neutral: '#9a9aa6' };
const toneOf = (v: number | null) => TONE[E.scoreTone(v)];

function Ring({ v, size = 46 }: { v: number | null; size?: number }) {
  const r = (size - 6) / 2; const c = 2 * Math.PI * r; const pct = v == null ? 0 : Math.max(0, Math.min(1, v / 5));
  return (
    <span className="ewx-ev-ring" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--c2)" strokeWidth="5" />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={toneOf(v)} strokeWidth="5" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - pct)} transform={`rotate(-90 ${size / 2} ${size / 2})`} />
      </svg>
      <b style={{ fontSize: size > 60 ? 22 : 13 }}>{E.fmtScore(v)}</b>
    </span>
  );
}

/** Box shown inside the user's own profile page. */
export function MyEvaluationsBox({ api }: { api: EwApi }) {
  const [list, setList] = useState<EvalRow[] | null>(null);
  const [tab, setTab] = useState(0);
  const load = useCallback(() => {
    E.listEvaluations({ evaluatedId: api.me.id }).then((l) => setList(l.filter((e) => e.status !== 'draft'))).catch(() => setList([]));
  }, [api.me.id]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { const f = () => load(); window.addEventListener('ew:evals', f); return () => window.removeEventListener('ew:evals', f); }, [load]);

  const open = (list || []).filter((e) => e.status !== 'finalized');
  const done = (list || []).filter((e) => e.status === 'finalized');
  const shown = tab === 0 ? open : done;
  const scored = done.filter((e) => e.score != null);
  const avg = scored.length ? scored.reduce((s, e) => s + (e.score || 0), 0) / scored.length : null;

  return (
    <div className="box ewx-ev-box">
      <h4>Minhas avaliações</h4>
      {list === null ? <div className="hint" style={{ padding: 16 }}>Carregando…</div> : !list.length ? (
        <p className="ewx-ev-empty">Você ainda não recebeu avaliações. Quando seu gestor enviar uma, ela aparece aqui.</p>
      ) : (
        <>
          <div className="ewx-ev-sum">
            <Ring v={avg} size={58} />
            <div><b>{avg == null ? 'Sem nota ainda' : E.scaleLabel(avg)}</b><small>média de {scored.length} {scored.length === 1 ? 'avaliação concluída' : 'avaliações concluídas'}</small></div>
            {open.some((e) => e.status === 'sent') ? <span className="ewx-ev-dot">{open.filter((e) => e.status === 'sent').length}</span> : null}
          </div>
          <Seg id="evt" items={[`Em andamento (${open.length})`, `Finalizadas (${done.length})`]} value={tab} onChange={setTab} />
          {!shown.length ? <p className="ewx-ev-empty">{tab === 0 ? 'Nenhuma avaliação em andamento' : 'Nenhuma avaliação finalizada'}</p> : (
            <div className="ewx-ev-list">
              {shown.map((e) => (
                <button key={e.id} className="ewx-ev-row" onClick={() => api.pgShow({ kind: 'eval', id: e.id })}>
                  <Ring v={e.score} />
                  <span className="ewx-ev-tx"><b>{e.period}</b><small>Por {e.evaluatorName}</small></span>
                  <span className={'ewx-ev-st ' + e.status}>{e.status === 'sent' ? 'Dar ciência' : E.STATUS_LABEL[e.status]}</span>
                  <Chev />
                </button>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

/** Full page with one evaluation. */
export function EvaluationPage({ id, api }: { id: string; api: EwApi }) {
  const [ev, setEv] = useState<EvalRow | null | undefined>(undefined);
  const [items, setItems] = useState<EvalItem[]>([]);
  const [reply, setReply] = useState('');
  const [review, setReview] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const l = await E.listEvaluations({ evaluatedId: api.me.id });
      const found = l.find((x) => x.id === id) || null;
      setEv(found);
      if (found) setItems(await E.getItems(id));
    } catch { setEv(null); }
  }, [api.me.id, id]);
  useEffect(() => { void load(); }, [load]);

  if (ev === undefined) return <div className="hint" style={{ padding: 40 }}>Carregando…</div>;
  if (!ev) return <div className="hint" style={{ padding: 40 }}>Avaliação indisponível</div>;

  const respond = async (accept: boolean) => {
    if (!accept && !reply.trim()) { api.toast('Explique o que precisa ser revisado'); return; }
    setBusy(true);
    try {
      await E.respondEvaluation(ev.id, accept, reply);
      api.toast(accept ? 'Ciência registrada' : 'Pedido de revisão enviado');
      setReply(''); setReview(false);
      window.dispatchEvent(new Event('ew:evals'));
      await load();
    } catch (e) { api.toast((e as Error).message); } finally { setBusy(false); }
  };

  return (
    <div className="pbody ewx-ev-page">
      <div className="ewx-ev-hero">
        <Ring v={ev.score} size={92} />
        <div>
          <small>{ev.period}</small>
          <b>{E.scaleLabel(ev.score) || 'Sem nota'}</b>
          <span>Avaliado por {ev.evaluatorName}</span>
          <span className={'ewx-ev-st ' + ev.status}>{E.STATUS_LABEL[ev.status]}</span>
        </div>
      </div>

      {ev.status === 'sent' ? <div className="ewx-ev-alert"><I n="bell" />Leia com calma e dê ciência no final da página.</div> : null}
      {ev.status === 'contested' ? <div className="ewx-ev-alert bad"><I n="clock" />Você pediu revisão. Aguarde o retorno do avaliador.{ev.evaluatedComment ? <em>“{ev.evaluatedComment}”</em> : null}</div> : null}

      <div className="box"><h4>Notas por critério</h4>
        {items.map((it) => (
          <div className="ewx-ev-it" key={it.id}>
            <div className="ewx-ev-ith"><b>{it.name}</b><span style={{ color: toneOf(it.score) }}>{it.score ?? '—'}<small> · {E.scaleLabel(it.score)}</small></span></div>
            <div className="ewx-ev-bar"><i style={{ width: `${((it.score || 0) / 5) * 100}%`, background: toneOf(it.score) }} /></div>
            {it.comment ? <p>{it.comment}</p> : null}
          </div>
        ))}
      </div>

      {ev.strengths ? <div className="box"><h4>Pontos fortes</h4><p className="ewx-ev-txt">{ev.strengths}</p></div> : null}
      {ev.improvements ? <div className="box"><h4>Pontos a desenvolver</h4><p className="ewx-ev-txt">{ev.improvements}</p></div> : null}
      {ev.feedback ? <div className="box"><h4>Feedback</h4><p className="ewx-ev-txt">{ev.feedback}</p></div> : null}
      {ev.status === 'finalized' && ev.evaluatedComment ? <div className="box"><h4>Seu comentário</h4><p className="ewx-ev-txt">{ev.evaluatedComment}</p></div> : null}
      {ev.status === 'finalized' && ev.finishedAt ? <p className="ewx-ev-foot"><I n="check" />Ciência dada em {new Date(ev.finishedAt).toLocaleDateString('pt-BR')}</p> : null}

      {ev.status === 'sent' ? (
        <div className="box"><h4>{review ? 'O que precisa ser revisado?' : 'Sua resposta (opcional)'}</h4>
          <textarea rows={3} value={reply} onChange={(e) => setReply(e.target.value)} placeholder={review ? 'Explique o que você não concorda' : 'Deixe um comentário para o avaliador'} />
          <div className="ewx-ev-acts">
            {review ? <>
              <button className="btn sec" onClick={() => setReview(false)}>Voltar</button>
              <button className="btn" disabled={busy || !reply.trim()} onClick={() => void respond(false)}>Enviar pedido</button>
            </> : <>
              <button className="btn sec" onClick={() => setReview(true)}>Pedir revisão</button>
              <button className="btn" disabled={busy} onClick={() => void respond(true)}><I n="check" />Dar ciência</button>
            </>}
          </div>
        </div>
      ) : null}

      <button className="btn sec full" onClick={() => { if (!openReport(E.evaluationReport(ev, items))) api.toast('Não foi possível abrir o relatório'); }}><I n="upload" />Baixar relatório</button>
    </div>
  );
}
