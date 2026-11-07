// Message content for the Ewwon chat: text, photos, files and task cards.
// Uses the same text format as the desktop chat:
//   📷 [name](url)   image attachment
//   📎 [name](url)   file attachment
//   📋 Card #N — title (+ 📝 ⚡ 📅 📌 lines)   task card
import { useState } from 'react';
import { openMedia, saveMedia, useCachedMedia } from '@/lib/mediaCache';

export interface ParsedMsg {
  text: string;
  images: { name: string; url: string }[];
  files: { name: string; url: string }[];
  cards: { number: string; title: string; description?: string; priority?: string; due?: string; board?: string }[];
}

export function parseMsg(content: string): ParsedMsg {
  const out: ParsedMsg = { text: '', images: [], files: [], cards: [] };
  const text: string[] = [];
  let card: ParsedMsg['cards'][number] | null = null;
  for (const raw of String(content || '').split('\n')) {
    const line = raw.trimEnd();
    const img = line.match(/^📷 \[(.+?)\]\((.+?)\)$/);
    const file = line.match(/^📎 \[(.+?)\]\((.+?)\)$/);
    const head = line.match(/^📋 Card #(\d+) — (.+)$/);
    if (img) { out.images.push({ name: img[1], url: img[2] }); card = null; continue; }
    if (file) { out.files.push({ name: file[1], url: file[2] }); card = null; continue; }
    if (head) { card = { number: head[1], title: head[2] }; out.cards.push(card); continue; }
    if (card && /^(📝|🏷️|⚡|📅|📌) /.test(line)) {
      if (line.startsWith('📝 ')) card.description = line.slice(3);
      else if (line.startsWith('⚡ Prioridade: ')) card.priority = line.replace('⚡ Prioridade: ', '');
      else if (line.startsWith('📅 Prazo: ')) card.due = line.replace('📅 Prazo: ', '');
      else if (line.startsWith('📌 Mural: ')) card.board = line.replace('📌 Mural: ', '');
      continue;
    }
    card = null;
    text.push(raw);
  }
  out.text = text.join('\n').trim();
  return out;
}

/** One-line preview for the conversation list. */
export function previewText(content: string): string {
  const p = parseMsg(content);
  if (p.text) return p.text.split('\n')[0];
  if (p.images.length) return p.images.length > 1 ? `📷 ${p.images.length} fotos` : '📷 Foto';
  if (p.files.length) return `📎 ${p.files[0].name}`;
  if (p.cards.length) return `📋 ${p.cards[0].title}`;
  return '';
}

const ext = (name: string) => (name.split('.').pop() || 'arq').slice(0, 4).toUpperCase();
const EXT_COLOR: Record<string, string> = { PDF: '#ff5d5d', DOC: '#4f8cff', DOCX: '#4f8cff', XLS: '#2fbf71', XLSX: '#2fbf71', CSV: '#2fbf71', PPT: '#ff9f43', PPTX: '#ff9f43', ZIP: '#8b5cf6', TXT: '#8b8b94' };

function Photo({ url, name, onOpen, single }: { url: string; name: string; onOpen: (u: string, url: string, name: string) => void; single: boolean }) {
  // Photos are downloaded once and kept on this device (WhatsApp-like).
  const { src, state } = useCachedMedia(url);
  return (
    <button className={'ewx-ph' + (single ? ' one' : '') + (state === 'expired' ? ' gone' : '')} onClick={(e) => { e.stopPropagation(); if (src) onOpen(src, url, name); }} aria-label={`Abrir ${name}`}>
      {src ? <img src={src} alt={name} loading="lazy" /> : state === 'expired' ? <span className="ewx-gone">📷<small>Foto expirada no servidor</small></span> : <span className="ewx-ph-ld" />}
    </button>
  );
}

function FileCard({ url, name }: { url: string; name: string }) {
  const e = ext(name);
  const [st, setSt] = useState<'idle' | 'busy' | 'gone'>('idle');
  return (
    <button type="button" className={'ewx-file' + (st === 'gone' ? ' gone' : '')} onClick={async (ev) => {
      ev.stopPropagation();
      if (st === 'busy') return;
      setSt('busy');
      const ok = await openMedia(url, name);
      setSt(ok ? 'idle' : 'gone');
    }}>
      <span className="ewx-file-ic" style={{ background: EXT_COLOR[e] || '#6b7280' }}>{e}</span>
      <span className="ewx-file-tx"><b>{name}</b><small>{st === 'busy' ? 'Abrindo…' : st === 'gone' ? 'Expirado no servidor' : 'Toque para abrir'}</small></span>
    </button>
  );
}

export function MsgBody({ content, onOpenImage }: { content: string; onOpenImage: (u: string, url: string, name: string) => void }) {
  const p = parseMsg(content);
  return (
    <>
      {p.images.length ? (
        <div className={'ewx-phs n' + Math.min(p.images.length, 4)}>
          {p.images.slice(0, 4).map((im, i) => <Photo key={i} url={im.url} name={im.name} onOpen={onOpenImage} single={p.images.length === 1} />)}
        </div>
      ) : null}
      {p.files.map((f, i) => <FileCard key={i} url={f.url} name={f.name} />)}
      {p.cards.map((c, i) => (
        <div className="ewx-card" key={i}>
          <div className="ewx-card-h"><span>#{c.number}</span>{c.priority ? <em>{c.priority}</em> : null}</div>
          <b>{c.title}</b>
          {c.description ? <small>{c.description}</small> : null}
          <div className="ewx-card-f">{c.board ? <span>📌 {c.board}</span> : null}{c.due ? <span>📅 {c.due}</span> : null}</div>
        </div>
      ))}
      {p.text ? <span className="ewx-tx">{p.text}</span> : null}
    </>
  );
}

export function ImageViewer({ media, onClose }: { media: { src: string; url: string; name: string } | null; onClose: () => void }) {
  const [zoom, setZoom] = useState(false);
  if (!media) return null;
  const { src } = media;
  return (
    <div className="ewx-viewer" onClick={onClose}>
      <img src={src} alt="" className={zoom ? 'z' : ''} onClick={(e) => { e.stopPropagation(); setZoom(!zoom); }} />
      <div className="ewx-viewer-bar">
        <button onClick={(e) => { e.stopPropagation(); void saveMedia(media.url, media.name); }}>Salvar no aparelho</button>
        <button onClick={onClose}>Fechar</button>
      </div>
    </div>
  );
}
