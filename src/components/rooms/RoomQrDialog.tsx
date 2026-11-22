// QR code of a meeting room (admins): printed at the door, it opens /sala/checkin/<token> where people confirm they
// are in the meeting. The token lives in meeting_rooms.checkin_token (migration 20261121010000) and can be renewed.
import { useEffect, useState } from 'react';
import { Loader2, Printer, RefreshCw } from 'lucide-react';
import QRCode from 'qrcode';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { appConfirm } from '@/lib/appDialog';

const db = supabase as any;
const hex = (n: number) => Array.from(crypto.getRandomValues(new Uint8Array(n)), (b) => b.toString(16).padStart(2, '0')).join('');
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));

export function RoomQrDialog({ room, open, onOpenChange }: { room: { id: string; name: string } | null; open: boolean; onOpenChange: (o: boolean) => void }) {
  const [token, setToken] = useState<string | null>(null);
  const [img, setImg] = useState('');
  useEffect(() => {
    if (!open || !room) return;
    setToken(null); setImg('');
    void db.from('meeting_rooms').select('checkin_token').eq('id', room.id).maybeSingle().then(({ data }: { data: { checkin_token: string | null } | null }) => setToken(data?.checkin_token || ''));
  }, [open, room]);
  const url = token ? `${window.location.origin}/sala/checkin/${token}` : '';
  useEffect(() => { if (url) void QRCode.toDataURL(url, { width: 560, margin: 1 }).then(setImg).catch(() => setImg('')); }, [url]);
  const renew = async () => {
    if (!room || !(await appConfirm({ title: 'Trocar o QR Code?', message: 'O QR impresso hoje deixa de funcionar. Imprima o novo para a porta da sala.', confirmText: 'Trocar' }))) return;
    const t = hex(10);
    const { error } = await db.from('meeting_rooms').update({ checkin_token: t }).eq('id', room.id);
    if (error) toast.error('Não foi possível trocar o QR Code.'); else { setToken(t); toast.success('QR Code novo gerado'); }
  };
  const print = () => {
    if (!img || !room) return;
    const w = window.open('', '_blank', 'width=640,height=800'); if (!w) return;
    w.document.write(`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Check-in · ${esc(room.name)}</title><style>body{font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;text-align:center;padding:48px;color:#111}h1{font-size:34px;margin:0 0 6px}p{color:#555;font-size:16px;margin:0 0 28px}img{width:360px;height:360px}small{display:block;margin-top:18px;color:#888}</style></head><body><h1>${esc(room.name)}</h1><p>Leia o QR Code para fazer check-in na reunião</p><img src="${img}" alt=""><small>ewvon · salas de reunião</small><script>window.onload=()=>{window.print()}</script></body></html>`);
    w.document.close();
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>QR Code de check-in</DialogTitle><DialogDescription>{room?.name} · imprima e cole na porta. Quem entra lê o código e confirma a presença.</DialogDescription></DialogHeader>
        <div className="flex justify-center py-2">{img ? <img src={img} alt={`QR Code da sala ${room?.name}`} className="h-56 w-56 rounded-[12px] border border-border bg-white p-2" /> : <Loader2 className="my-16 h-6 w-6 animate-spin text-muted-foreground" />}</div>
        <DialogFooter>
          <Button variant="outline" onClick={() => void renew()} disabled={!token}><RefreshCw className="mr-2 h-4 w-4" />Trocar código</Button>
          <Button onClick={print} disabled={!img}><Printer className="mr-2 h-4 w-4" />Imprimir</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
