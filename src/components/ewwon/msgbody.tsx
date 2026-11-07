// Message content for the Ewwon chat: text, photos, files and task cards.
// Uses the same text format as the desktop chat:
//   📷 [name](url)   image attachment
//   📎 [name](url)   file attachment
//   📋 Card #N — title (+ 📝 ⚡ 📅 📌 lines)   task card
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { openMedia, useCachedMedia } from '@/lib/mediaCache';
import { isSticker } from '@/lib/stickers';
import { parseVoice } from '@/lib/e2e';
import { VoicePlayer } from '@/components/common/Voice';

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
  if (isSticker(content)) return '✨ Figurinha';
  const v = parseVoice(content); if (v) return `🎤 Áudio (${v.duration})`;
  const p = parseMsg(content);
  if (p.text) return p.text.split('\n')[0];
  if (p.images.length) return p.images.length > 1 ? `📷 ${p.images.length} fotos` : '📷 Foto';
  if (p.files.length) return `📎 ${p.files[0].name}`;
  if (p.cards.length) return `📋 ${p.cards[0].title}`;
  return '';
}

const ext = (name: string) => (name.split('.').pop() || 'arq').slice(0, 4).toUpperCase();
const EXT_COLOR: Record<string, string> = { PDF: '#ff5d5d', DOC: '#4f8cff', DOCX: '#4f8cff', XLS: '#2fbf71', XLSX: '#2fbf71', CSV: '#2fbf71', PPT: '#ff9f43', PPTX: '#ff9f43', ZIP: '#8b5cf6', TXT: '#8b8b94' };

function Photo({ url, name, onOpen, single }: { url: string; name: string; onOpen: (u: string, url: string, name: string, caption?: string) => void; single: boolean }) {
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

export function MsgBody({ content, onOpenImage }: { content: string; onOpenImage: (u: string, url: string, name: string, caption?: string) => void }) {
  const voice = parseVoice(content);
  if (voice) return <VoicePlayer voice={voice} />;
  const p = parseMsg(content);
  const openWithCaption = (u: string, url: string, name: string) => onOpenImage(u, url, name, p.text || undefined);
  return (
    <>
      {p.images.length ? (
        <div className={'ewx-phs n' + Math.min(p.images.length, 4)}>
          {p.images.slice(0, 4).map((im, i) => <Photo key={i} url={im.url} name={im.name} onOpen={openWithCaption} single={p.images.length === 1} />)}
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
      {p.text ? <RichText text={p.text} /> : null}
    </>
  );
}

export function ImageViewer({ media, onClose }: { media: { src: string; url: string; name: string; caption?: string } | null; onClose: () => void }) {
  const [zoom, setZoom] = useState(false);
  if (!media) return null;
  return (
    <div className="ewx-viewer" onClick={onClose}>
      <img src={media.src} alt="" className={zoom ? 'z' : ''} onClick={(e) => { e.stopPropagation(); setZoom(!zoom); }} />
      <div className="ewx-viewer-bar" onClick={(e) => e.stopPropagation()}>
        {media.caption ? <p className="ewx-viewer-cap">{media.caption}</p> : null}
        <button onClick={onClose}>Fechar</button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- links (WhatsApp-like)
const URL_RE = /\b((?:https?:\/\/|www\.)[^\s<>"']+[^\s<>"'.,;:!?)\]])/gi;
const shortUrl = (u: string) => {
  try {
    const x = new URL(u.startsWith('http') ? u : 'https://' + u);
    const rest = (x.pathname + x.search).replace(/\/$/, '');
    const s = x.hostname.replace(/^www\./, '') + rest;
    return s.length > 42 ? s.slice(0, 41) + '…' : s;
  } catch { return u.length > 42 ? u.slice(0, 41) + '…' : u; }
};

interface Preview { url: string; title?: string; description?: string; image?: string; site?: string }
const PKEY = 'ewvon:linkprev';
const readCache = (): Record<string, Preview & { at: number }> => { try { return JSON.parse(localStorage.getItem(PKEY) || '{}'); } catch { return {}; } };
const inflight = new Map<string, Promise<Preview | null>>();
function getPreview(url: string): Promise<Preview | null> {
  const c = readCache()[url];
  if (c && Date.now() - c.at < 7 * 864e5) return Promise.resolve(c.title || c.image ? c : null);
  const run = inflight.get(url);
  if (run) return run;
  const job = (async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data } = await (supabase as any).functions.invoke('link-preview', { body: { url } });
    const pv = data && !data.error ? (data as Preview) : null;
    try {
      const all = readCache();
      all[url] = { ...(pv || { url }), at: Date.now() };
      const keys = Object.keys(all);
      if (keys.length > 150) keys.sort((a, b) => all[a].at - all[b].at).slice(0, keys.length - 150).forEach((k) => delete all[k]);
      localStorage.setItem(PKEY, JSON.stringify(all));
    } catch { /* storage full */ }
    return pv && (pv.title || pv.image) ? pv : null;
  })().catch(() => null).finally(() => inflight.delete(url));
  inflight.set(url, job);
  return job;
}

function LinkCard({ url }: { url: string }) {
  const [pv, setPv] = useState<Preview | null>(null);
  useEffect(() => { let alive = true; void getPreview(url).then((p) => { if (alive) setPv(p); }); return () => { alive = false; }; }, [url]);
  if (!pv) return null;
  return (
    <a className="ewx-lnk" href={pv.url || url} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}>
      {pv.image ? <img src={pv.image} alt="" loading="lazy" referrerPolicy="no-referrer" onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} /> : null}
      <span className="ewx-lnk-tx">
        {pv.title ? <b>{pv.title}</b> : null}
        {pv.description ? <small>{pv.description}</small> : null}
        <em>{pv.site || shortUrl(url)}</em>
      </span>
    </a>
  );
}

export function RichText({ text }: { text: string }) {
  const parts: (string | { url: string })[] = [];
  let last = 0;
  for (const m of text.matchAll(URL_RE)) {
    if (m.index! > last) parts.push(text.slice(last, m.index));
    parts.push({ url: m[0] });
    last = m.index! + m[0].length;
  }
  if (last < text.length) parts.push(text.slice(last));
  const first = parts.find((p): p is { url: string } => typeof p !== 'string');
  const href = (u: string) => (u.startsWith('http') ? u : 'https://' + u);
  return (
    <>
      {first ? <LinkCard url={href(first.url)} /> : null}
      <span className="ewx-tx">
        {parts.map((p, i) => typeof p === 'string' ? p
          : <a key={i} className="ewx-url" href={href(p.url)} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}>{shortUrl(p.url)}</a>)}
      </span>
    </>
  );
}
