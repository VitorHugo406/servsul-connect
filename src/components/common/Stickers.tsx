// Sticker bubble + sticker picker, shared by the desktop chat and the mobile app.
import { useEffect, useRef, useState } from 'react';
import { useCachedMedia } from '@/lib/mediaCache';
import * as S from '@/lib/stickers';
import type { Sticker } from '@/lib/stickers';
import './stickers.css';

export function StickerView({ sticker, size = 150, onLongPress }: { sticker: Sticker; size?: number; onLongPress?: () => void }) {
  const url = sticker.kind === 'img' ? S.stickerUrl(sticker.companyId, sticker.sha) : null;
  const { src, state } = useCachedMedia(url, !!url);
  const timer = useRef<number | null>(null);
  const press = onLongPress ? {
    onContextMenu: (e: React.MouseEvent) => { e.preventDefault(); onLongPress(); },
    onTouchStart: () => { timer.current = window.setTimeout(onLongPress, 550); },
    onTouchEnd: () => { if (timer.current) window.clearTimeout(timer.current); },
    onTouchMove: () => { if (timer.current) window.clearTimeout(timer.current); },
  } : {};
  if (sticker.kind === 'emoji') return <span className="stk-view stk-emoji" style={{ fontSize: size * 0.72, width: size, height: size }} role="img" aria-label={`Figurinha ${sticker.emoji}`} {...press}>{sticker.emoji}</span>;
  return (
    <span className="stk-view" style={{ width: size, height: size }} {...press}>
      {src ? <img src={src} alt="Figurinha" draggable={false} /> : state === 'expired' ? <span className="stk-gone">Figurinha indisponível</span> : <span className="stk-ld" />}
    </span>
  );
}

function Thumb({ s }: { s: Sticker }) {
  return <StickerView sticker={s} size={68} />;
}

const TABS = ['Recentes', 'Emoji', 'Minhas'] as const;

export function StickerPicker({ onPick, notify }: { onPick: (s: Sticker) => void; notify?: (t: string) => void }) {
  const [tab, setTab] = useState<(typeof TABS)[number]>(() => (S.recentStickers().length ? 'Recentes' : 'Emoji'));
  const [mine, setMine] = useState<Sticker[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [edit, setEdit] = useState(false);
  const file = useRef<HTMLInputElement>(null);
  const recents = S.recentStickers();

  useEffect(() => { void S.listFavorites().then(setMine); }, []);

  const pick = (s: Sticker) => { if (edit) return; S.pushRecent(s); onPick(s); };
  const create = async (f: File | undefined) => {
    if (!f) return;
    setBusy(true);
    try {
      const s = await S.createSticker(f);
      setMine((m) => [s, ...(m || []).filter((x) => S.stickerKey(x) !== S.stickerKey(s))]);
      setTab('Minhas');
      notify?.('Figurinha criada');
    } catch (e) { notify?.((e as Error).message || 'Não foi possível criar a figurinha'); } finally { setBusy(false); if (file.current) file.current.value = ''; }
  };
  const remove = async (s: Sticker) => { setMine((m) => (m || []).filter((x) => S.stickerKey(x) !== S.stickerKey(s))); await S.removeFavorite(s); };

  const list = tab === 'Recentes' ? recents : tab === 'Emoji' ? S.EMOJI_STICKERS.map((emoji) => ({ kind: 'emoji', emoji }) as Sticker) : mine || [];
  return (
    <div className="stk" onClick={(e) => e.stopPropagation()}>
      <div className="stk-tabs">
        {TABS.map((t) => <button key={t} type="button" className={'stk-t' + (t === tab ? ' on' : '')} onClick={() => { setTab(t); setEdit(false); }}>{t}</button>)}
        <span className="stk-sp" />
        {tab === 'Minhas' && (mine || []).length ? <button type="button" className="stk-t" onClick={() => setEdit(!edit)}>{edit ? 'Concluir' : 'Editar'}</button> : null}
        <button type="button" className="stk-t stk-new" disabled={busy} onClick={() => file.current?.click()}>{busy ? 'Criando…' : '+ Criar'}</button>
        <input ref={file} type="file" accept="image/*" hidden onChange={(e) => void create(e.target.files?.[0])} />
      </div>
      <div className="stk-grid">
        {list.map((s) => (
          <button key={S.stickerKey(s)} type="button" className={'stk-b' + (edit ? ' edit' : '')} onClick={() => (edit ? void remove(s) : pick(s))} aria-label={edit ? 'Remover figurinha' : 'Enviar figurinha'}>
            <Thumb s={s} />{edit ? <i className="stk-x">×</i> : null}
          </button>
        ))}
        {!list.length ? <p className="stk-empty">{tab === 'Recentes' ? 'As figurinhas que você enviar aparecem aqui.' : mine === null ? 'Carregando…' : 'Toque em “+ Criar” para transformar uma foto em figurinha, ou segure uma figurinha recebida para salvar.'}</p> : null}
      </div>
    </div>
  );
}
