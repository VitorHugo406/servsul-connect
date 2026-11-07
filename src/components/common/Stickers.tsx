// Stickers (WhatsApp-like), shared by the desktop chat and the mobile app:
// sticker bubble with "save to favorites", picker with favorites / emoji / packs,
// pack management (create, add, remove, share in chat, export/import file) and the
// card shown when someone shares a pack.
import { useEffect, useRef, useState } from 'react';
import { useCachedMedia } from '@/lib/mediaCache';
import { useAuth } from '@/contexts/AuthContext';
import * as S from '@/lib/stickers';
import type { Pack, Sticker } from '@/lib/stickers';
import './stickers.css';

export function StickerView({ sticker, size = 150 }: { sticker: Sticker; size?: number }) {
  const url = sticker.kind === 'img' ? S.stickerUrl(sticker.companyId, sticker.sha) : null;
  const { src, state } = useCachedMedia(url, !!url);
  if (sticker.kind === 'emoji') return <span className="stk-view stk-emoji" style={{ fontSize: size * 0.72, width: size, height: size }} role="img" aria-label={`Figurinha ${sticker.emoji}`}>{sticker.emoji}</span>;
  return (
    <span className="stk-view" style={{ width: size, height: size }}>
      {src ? <img src={src} alt="Figurinha" draggable={false} /> : state === 'expired' ? <span className="stk-gone">Figurinha indisponível</span> : <span className="stk-ld" />}
    </span>
  );
}

/** Sticker inside a chat message: tap a received sticker to save it to favorites. */
export function StickerMessage({ sticker, mine, size = 140 }: { sticker: Sticker; mine?: boolean; size?: number }) {
  const [open, setOpen] = useState(false);
  const [saved, setSaved] = useState(false);
  const canSave = !mine && sticker.kind === 'img';
  return (
    <span className="stk-msg">
      <span role={canSave ? 'button' : undefined} onClick={canSave ? (e) => { e.stopPropagation(); setOpen((o) => !o); } : undefined}><StickerView sticker={sticker} size={size} /></span>
      {canSave && open ? (
        <button type="button" className="stk-save" disabled={saved} onClick={(e) => { e.stopPropagation(); void S.addFavorite(sticker).then(() => setSaved(true)).catch(() => undefined); }}>
          {saved ? '✓ Salva nas favoritas' : '⭐ Salvar nas favoritas'}
        </button>
      ) : null}
    </span>
  );
}

/** Card shown in the chat when someone shares a sticker pack. */
export function PackCard({ id, mine }: { id: string; mine?: boolean }) {
  const { profile } = useAuth();
  const [pack, setPack] = useState<Pack | null | undefined>(undefined);
  const [st, setSt] = useState<'idle' | 'busy' | 'done'>('idle');
  useEffect(() => { void S.getPack(id).then(setPack).catch(() => setPack(null)); }, [id]);
  if (pack === undefined) return <span className="stk-pack-card"><span className="stk-ld" /></span>;
  if (!pack) return <span className="stk-pack-card"><small>Pacote de figurinhas indisponível</small></span>;
  const own = mine || pack.ownerId === profile?.id;
  return (
    <span className="stk-pack-card" onClick={(e) => e.stopPropagation()}>
      <span className="stk-pack-grid">{pack.items.slice(0, 4).map((s) => <StickerView key={S.stickerKey(s)} sticker={s} size={56} />)}</span>
      <b>{pack.name}</b>
      <small>{pack.items.length} {pack.items.length === 1 ? 'figurinha' : 'figurinhas'}</small>
      {own ? <small className="stk-pack-own">Seu pacote</small> : (
        <button type="button" className="stk-pack-add" disabled={st !== 'idle' || !profile} onClick={() => { if (!profile) return; setSt('busy'); void S.copyPack(pack, profile.id).then(() => setSt('done')).catch(() => setSt('idle')); }}>
          {st === 'done' ? '✓ Adicionado aos seus pacotes' : st === 'busy' ? 'Adicionando…' : 'Adicionar aos meus pacotes'}
        </button>
      )}
    </span>
  );
}

const TABS = ['Recentes', 'Favoritas', 'Emoji', 'Pacotes'] as const;
type Tab = (typeof TABS)[number];

export function StickerPicker({ onPick, onSendContent, notify }: { onPick: (s: Sticker) => void; onSendContent?: (content: string) => void; notify?: (t: string) => void }) {
  const { profile } = useAuth();
  const meId = profile?.id || '';
  const [tab, setTab] = useState<Tab>(() => (S.recentStickers().length ? 'Recentes' : 'Favoritas'));
  const [mine, setMine] = useState<Sticker[] | null>(null);
  const [packs, setPacks] = useState<Pack[] | null>(null);
  const [openPack, setOpenPack] = useState<string | null>(null);
  const [adding, setAdding] = useState<string[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [edit, setEdit] = useState(false);
  const file = useRef<HTMLInputElement>(null);
  const packFile = useRef<HTMLInputElement>(null);
  const recents = S.recentStickers();
  const pack = packs?.find((p) => p.id === openPack) || null;

  const reloadPacks = () => (meId ? S.listMyPacks(meId).then(setPacks).catch(() => setPacks([])) : Promise.resolve());
  useEffect(() => { void S.listFavorites().then(setMine); void reloadPacks(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [meId]);

  const run = async (fn: () => Promise<unknown>, ok?: string) => {
    setBusy(true);
    try { await fn(); if (ok) notify?.(ok); } catch (e) { notify?.((e as Error).message || 'Não foi possível concluir'); } finally { setBusy(false); }
  };
  const pick = (s: Sticker) => { if (edit) return; S.pushRecent(s); onPick(s); };
  const create = (f: File | undefined) => {
    if (!f) return;
    void run(async () => {
      const s = await S.createSticker(f);
      setMine((m) => [s, ...(m || []).filter((x) => S.stickerKey(x) !== S.stickerKey(s))]);
      if (pack) { await S.addToPack(pack.id, [s]); await reloadPacks(); } else setTab('Favoritas');
    }, 'Figurinha criada');
    if (file.current) file.current.value = '';
  };
  const newPack = () => {
    const name = window.prompt('Nome do pacote de figurinhas');
    if (!name?.trim()) return;
    void run(async () => { const p = await S.createPack(name, meId); await reloadPacks(); setOpenPack(p.id); }, 'Pacote criado');
  };
  const importFile = (f: File | undefined) => {
    if (!f) return;
    void run(async () => { const p = await S.importPack(f, meId); await reloadPacks(); setTab('Pacotes'); setOpenPack(p.id); void S.listFavorites().then(setMine); }, 'Pacote importado');
    if (packFile.current) packFile.current.value = '';
  };

  const grid = (list: Sticker[], onTap: (s: Sticker) => void, removable?: (s: Sticker) => void) => (
    <div className="stk-grid">
      {list.map((s) => (
        <button key={S.stickerKey(s)} type="button" className={'stk-b' + (edit && removable ? ' edit' : '')} onClick={() => (edit && removable ? removable(s) : onTap(s))} aria-label={edit && removable ? 'Remover figurinha' : 'Enviar figurinha'}>
          <StickerView sticker={s} size={68} />{edit && removable ? <i className="stk-x">×</i> : null}
        </button>
      ))}
    </div>
  );

  // Choosing favorites to add into the open pack
  if (adding && pack) {
    const pool = (mine || []).filter((s) => !pack.items.some((x) => S.stickerKey(x) === S.stickerKey(s)));
    return (
      <div className="stk" onClick={(e) => e.stopPropagation()}>
        <div className="stk-tabs"><button type="button" className="stk-t" onClick={() => setAdding(null)}>‹ Voltar</button><span className="stk-sp" /><b className="stk-title">Adicionar a “{pack.name}”</b></div>
        <div className="stk-grid">
          {pool.map((s) => { const k = S.stickerKey(s); const on = adding.includes(k); return (
            <button key={k} type="button" className={'stk-b' + (on ? ' sel' : '')} onClick={() => setAdding((a) => (a!.includes(k) ? a!.filter((x) => x !== k) : [...a!, k]))}><StickerView sticker={s} size={68} />{on ? <i className="stk-ok">✓</i> : null}</button>
          ); })}
          {!pool.length ? <p className="stk-empty">Todas as suas favoritas já estão neste pacote.</p> : null}
        </div>
        <button type="button" className="stk-main" disabled={busy || !adding.length} onClick={() => void run(async () => { await S.addToPack(pack.id, pool.filter((s) => adding.includes(S.stickerKey(s)))); await reloadPacks(); setAdding(null); }, 'Adicionadas ao pacote')}>
          Adicionar {adding.length || ''}
        </button>
      </div>
    );
  }

  return (
    <div className="stk" onClick={(e) => e.stopPropagation()}>
      <div className="stk-tabs">
        {pack ? <button type="button" className="stk-t" onClick={() => { setOpenPack(null); setEdit(false); }}>‹ Pacotes</button>
          : TABS.map((t) => <button key={t} type="button" className={'stk-t' + (t === tab ? ' on' : '')} onClick={() => { setTab(t); setEdit(false); }}>{t}</button>)}
        <span className="stk-sp" />
        {(tab === 'Favoritas' && (mine || []).length) || (pack && pack.items.length) ? <button type="button" className="stk-t" onClick={() => setEdit(!edit)}>{edit ? 'Concluir' : 'Editar'}</button> : null}
        {tab !== 'Pacotes' || pack ? <button type="button" className="stk-t stk-new" disabled={busy} onClick={() => file.current?.click()}>{busy ? '…' : '+ Criar'}</button> : null}
        <input ref={file} type="file" accept="image/*" hidden onChange={(e) => create(e.target.files?.[0])} />
        <input ref={packFile} type="file" accept=".ewvonpack,application/json" hidden onChange={(e) => importFile(e.target.files?.[0])} />
      </div>

      {pack ? (
        <>
          <div className="stk-pack-h">
            <b>{pack.name}</b><small>{pack.items.length} figurinhas</small>
            <span className="stk-sp" />
            <button type="button" className="stk-chip" onClick={() => setAdding([])}>+ Adicionar</button>
            {onSendContent ? <button type="button" className="stk-chip" disabled={!pack.items.length} onClick={() => onSendContent(S.packContent(pack.id))}>Compartilhar no chat</button> : null}
            <button type="button" className="stk-chip" disabled={busy || !pack.items.length} onClick={() => void run(async () => { const r = await S.shareOrDownload(await S.exportPack(pack)); notify?.(r === 'shared' ? 'Pacote compartilhado' : 'Pacote exportado'); })}>Exportar</button>
            <button type="button" className="stk-chip danger" disabled={busy} onClick={() => { if (window.confirm(`Excluir o pacote “${pack.name}”?`)) void run(async () => { await S.deletePack(pack.id); setOpenPack(null); await reloadPacks(); }, 'Pacote excluído'); }}>Excluir</button>
          </div>
          {grid(pack.items, pick, (s) => s.kind === 'img' && void run(async () => { await S.removeFromPack(pack.id, s.sha); await reloadPacks(); }))}
          {!pack.items.length ? <p className="stk-empty">Pacote vazio. Use “+ Adicionar” para trazer favoritas ou “+ Criar” para fazer uma figurinha nova aqui.</p> : null}
        </>
      ) : tab === 'Pacotes' ? (
        <>
          <div className="stk-pack-list">
            {(packs || []).map((p) => (
              <button key={p.id} type="button" className="stk-pack-row" onClick={() => setOpenPack(p.id)}>
                <span className="stk-pack-thumbs">{p.items.slice(0, 3).map((s) => <StickerView key={S.stickerKey(s)} sticker={s} size={36} />)}</span>
                <span className="stk-pack-tx"><b>{p.name}</b><small>{p.items.length} figurinhas</small></span>
                <span className="stk-chev">›</span>
              </button>
            ))}
            {packs && !packs.length ? <p className="stk-empty">Crie pacotes para organizar suas figurinhas, compartilhar no chat ou exportar.</p> : null}
          </div>
          <div className="stk-actions">
            <button type="button" className="stk-main" disabled={busy || !meId} onClick={newPack}>+ Novo pacote</button>
            <button type="button" className="stk-main sec" disabled={busy || !meId} onClick={() => packFile.current?.click()}>Importar pacote</button>
          </div>
        </>
      ) : (
        <>
          {tab === 'Recentes' ? grid(recents, pick) : tab === 'Emoji' ? grid(S.EMOJI_STICKERS.map((emoji) => ({ kind: 'emoji', emoji }) as Sticker), pick)
            : grid(mine || [], pick, (s) => { setMine((m) => (m || []).filter((x) => S.stickerKey(x) !== S.stickerKey(s))); void S.removeFavorite(s); })}
          {tab === 'Recentes' && !recents.length ? <p className="stk-empty">As figurinhas que você enviar aparecem aqui.</p> : null}
          {tab === 'Favoritas' && mine && !mine.length ? <p className="stk-empty">Toque em “+ Criar” para transformar uma foto em figurinha, ou toque numa figurinha recebida e escolha “Salvar nas favoritas”.</p> : null}
        </>
      )}
    </div>
  );
}
