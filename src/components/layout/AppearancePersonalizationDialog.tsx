import { useEffect, useState } from 'react';
import { Palette, RotateCcw, Check } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';

type ThemePreset = { id: string; name: string; background: string; card: string; muted: string; accent: string; texture: string };
const PRESETS: ThemePreset[] = [
  { id: 'default', name: 'Padrão', background: '220 20% 97%', card: '0 0% 100%', muted: '220 15% 92%', accent: '210 100% 95%', texture: 'none' },
  { id: 'slate', name: 'Ardósia suave', background: '220 16% 94%', card: '220 15% 98%', muted: '220 12% 88%', accent: '220 30% 90%', texture: 'none' },
  { id: 'sand', name: 'Areia discreta', background: '35 22% 95%', card: '35 25% 99%', muted: '35 16% 90%', accent: '35 35% 91%', texture: 'none' },
  { id: 'mist', name: 'Névoa', background: '200 18% 95%', card: '200 20% 99%', muted: '200 12% 89%', accent: '200 30% 92%', texture: 'radial-gradient(hsl(220 20% 50% / .08) 1px, transparent 1px)' },
  { id: 'grid', name: 'Textura leve', background: '220 20% 97%', card: '0 0% 100%', muted: '220 15% 92%', accent: '210 100% 95%', texture: 'linear-gradient(hsl(220 20% 50% / .045) 1px, transparent 1px), linear-gradient(90deg, hsl(220 20% 50% / .045) 1px, transparent 1px)' },
];
const KEY = 'nuvexa:ui-personalization';

const applyPresetToDocument = (preset: ThemePreset) => {
  const root = document.documentElement;
  root.style.setProperty('--background', preset.background);
  root.style.setProperty('--card', preset.card);
  root.style.setProperty('--popover', preset.card);
  root.style.setProperty('--muted', preset.muted);
  root.style.setProperty('--accent', preset.accent);
  document.body.style.backgroundImage = preset.texture;
  document.body.style.backgroundAttachment = preset.texture === 'none' ? '' : 'fixed';
  let style = document.getElementById('nuvexa-ui-personalization') as HTMLStyleElement | null;
  if (!style) { style = document.createElement('style'); style.id = 'nuvexa-ui-personalization'; document.head.appendChild(style); }
  style.textContent = `.nuvexa-ui-personalized [class*="border-b-2"][class*="border-primary"]{background-color:hsl(${preset.accent})!important;background-image:${preset.texture === 'none' ? 'none' : preset.texture}!important;background-size:14px 14px;border-radius:10px 10px 0 0}`;
  root.classList.add('nuvexa-ui-personalized');
};

const clearPresetFromDocument = () => {
  const root = document.documentElement;
  ['--background','--card','--popover','--muted','--accent'].forEach(v => root.style.removeProperty(v));
  document.body.style.backgroundImage = '';
  document.body.style.backgroundAttachment = '';
  document.getElementById('nuvexa-ui-personalization')?.remove();
  root.classList.remove('nuvexa-ui-personalized');
};

export function AppearancePersonalizationDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const [selected, setSelected] = useState('default');

  useEffect(() => {
    const saved = localStorage.getItem(KEY) || 'default';
    const preset = PRESETS.find(p => p.id === saved) || PRESETS[0];
    setSelected(preset.id);
    if (preset.id !== 'default') applyPresetToDocument(preset);
  }, []);
  useEffect(() => { if (open) setSelected(localStorage.getItem(KEY) || 'default'); }, [open]);

  const applyPreset = (preset: ThemePreset) => { applyPresetToDocument(preset); localStorage.setItem(KEY, preset.id); setSelected(preset.id); window.dispatchEvent(new CustomEvent('nuvexa:ui-personalization-changed')); toast.success(`Visual ${preset.name.toLowerCase()} aplicado.`); };
  const reset = () => { clearPresetFromDocument(); localStorage.removeItem(KEY); setSelected('default'); window.dispatchEvent(new CustomEvent('nuvexa:ui-personalization-changed')); toast.success('Visual padrão restaurado.'); };

  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="max-w-lg rounded-2xl"><DialogHeader><DialogTitle className="flex items-center gap-2"><Palette className="h-5 w-5 text-primary" /> Personalização do sistema</DialogTitle><DialogDescription>Escolha um fundo discreto para as áreas de visualização, painéis e abas selecionadas. A escolha fica salva somente neste navegador.</DialogDescription></DialogHeader><div className="space-y-5"><div><Label className="text-sm font-medium">Estilo visual</Label><div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">{PRESETS.map(p => <button key={p.id} type="button" onClick={() => applyPreset(p)} className="group relative overflow-hidden rounded-xl border border-border p-2 text-left transition-all hover:border-primary/50"><div className="h-16 rounded-lg border border-border/60" style={{ backgroundColor: `hsl(${p.background})`, backgroundImage: p.texture, backgroundSize: p.id === 'grid' ? '14px 14px' : p.id === 'mist' ? '10px 10px' : undefined }}><div className="mx-2 mt-3 h-8 rounded-lg border border-border/50" style={{ backgroundColor: `hsl(${p.card})` }} /></div><span className="mt-2 block text-xs font-medium">{p.name}</span>{selected === p.id && <span className="absolute right-2 top-2 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground"><Check className="h-3 w-3" /></span>}</button>)}</div></div><Button type="button" variant="outline" className="w-full gap-2" onClick={reset}><RotateCcw className="h-4 w-4" /> Restaurar visual padrão</Button></div></DialogContent></Dialog>;
}
