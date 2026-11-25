// Mobile chat › "+" › Enquete: same poll as the PC (polls table, message "ewvon-poll:<id>" rendered by PollCard),
// created inside the global sheet, WhatsApp style (question, options, várias respostas, anônima, encerrar).
import { useState } from 'react';
import { createPoll, emptyPoll, pollContent, pollReady, type PollDraft } from '@/components/chat/extras/ChatPoll';
import { I } from './icons';
import { Seg, Tg } from './EwwonApp';

export function PollSheet({ convKey, post, close, toast }: { convKey: string; post: (content: string) => void; close: () => void; toast: (m: string) => void }) {
  const [poll, setPoll] = useState<PollDraft>(emptyPoll);
  const [busy, setBusy] = useState(false);
  const send = async () => {
    if (!pollReady(poll) || busy) return;
    setBusy(true);
    try { const id = await createPoll('chat', convKey, poll); post(pollContent(id)); close(); }
    catch { toast('Não foi possível criar a enquete.'); }
    finally { setBusy(false); }
  };
  return (
    <>
      <div className="gp" />
      <div className="shh"><div><b>Nova enquete</b><small>Todos da conversa votam e veem o resultado na hora</small></div></div>
      <div className="sl">Pergunta</div>
      <input className="fld" value={poll.question} maxLength={300} placeholder="Ex.: Qual o melhor dia para a reunião?" onChange={(e) => setPoll({ ...poll, question: e.target.value })} />
      <div className="sl">Opções</div>
      {poll.options.map((o, i) => (
        <div key={i} className="ewx-popt">
          <input className="fld" value={o} maxLength={120} placeholder={`Opção ${i + 1}`} onChange={(e) => { const opts = [...poll.options]; opts[i] = e.target.value; setPoll({ ...poll, options: opts }); }} />
          {poll.options.length > 2 ? <button className="btn sm sec" aria-label={`Remover opção ${i + 1}`} onClick={() => setPoll({ ...poll, options: poll.options.filter((_, j) => j !== i) })}><I n="trash" /></button> : null}
        </div>
      ))}
      {poll.options.length < 10 ? <button className="btn sm sec ewx-padd" onClick={() => setPoll({ ...poll, options: [...poll.options, ''] })}><I n="plus" />Adicionar opção</button> : null}
      <Tg t="Várias respostas" d="Cada pessoa pode marcar mais de uma" on={poll.multi} onChange={(v) => setPoll({ ...poll, multi: v })} />
      <Tg t="Votos anônimos" d="Ninguém vê quem votou em cada opção" on={poll.anonymous} onChange={(v) => setPoll({ ...poll, anonymous: v })} />
      <div className="sl">Encerrar votação</div>
      <Seg id="cpoll" items={['Sem prazo', '1 h', '24 h', '3 dias', '7 dias']} value={[0, 1, 24, 72, 168].indexOf(poll.hours)} onChange={(v) => setPoll({ ...poll, hours: [0, 1, 24, 72, 168][v] })} />
      <div className="ewx-sheetfoot"><button className="btn full" disabled={busy || !pollReady(poll)} onClick={() => void send()}>{busy ? 'Enviando…' : 'Enviar enquete'}</button></div>
    </>
  );
}
