import { useEffect, useState } from 'react';
import { Palette, RotateCcw, Check, Moon, Sun } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';

type ThemePreset = {
  id: string;
  name: string;
  mode: 'light' | 'dark';
  background: string;
  foreground: string;
  card: string;
  cardForeground: string;
  popover: string;
  popoverForeground: string;
  muted: string;
  mutedForeground: string;
  accent: string;
  accentForeground: string;
  border: string;
  input: string;
  ring: string;
  sidebarBackground?: string;
  sidebarForeground?: string;
  texture: string;
};

const LIGHT_PRESETS: ThemePreset[] = [
  { id: 'default', name: 'Padrão', mode: 'light', background: '220 20% 97%', foreground: '220 30% 15%', card: '0 0% 100%', cardForeground: '220 30% 15%', popover: '0 0% 100%', popoverForeground: '220 30% 15%', muted: '220 15% 92%', mutedForeground: '220 15% 45%', accent: '210 100% 95%', accentForeground: '220 70% 35%', border: '220 15% 88%', input: '220 15% 88%', ring: '220 70% 45%', texture: 'none' },
  { id: 'slate', name: 'Ardósia suave', mode: 'light', background: '220 16% 94%', foreground: '220 30% 15%', card: '220 15% 98%', cardForeground: '220 30% 15%', popover: '220 15% 98%', popoverForeground: '220 30% 15%', muted: '220 12% 88%', mutedForeground: '220 15% 42%', accent: '220 30% 90%', accentForeground: '220 35% 30%', border: '220 12% 84%', input: '220 12% 84%', ring: '220 45% 45%', texture: 'none' },
  { id: 'sand', name: 'Areia discreta', mode: 'light', background: '35 22% 95%', foreground: '25 25% 18%', card: '35 25% 99%', cardForeground: '25 25% 18%', popover: '35 25% 99%', popoverForeground: '25 25% 18%', muted: '35 16% 90%', mutedForeground: '30 15% 45%', accent: '35 35% 91%', accentForeground: '30 45% 32%', border: '35 15% 86%', input: '35 15% 86%', ring: '30 50% 45%', texture: 'none' },
  { id: 'mist', name: 'Névoa', mode: 'light', background: '200 18% 95%', foreground: '205 25% 18%', card: '200 20% 99%', cardForeground: '205 25% 18%', popover: '200 20% 99%', popoverForeground: '205 25% 18%', muted: '200 12% 89%', mutedForeground: '200 14% 45%', accent: '200 30% 92%', accentForeground: '200 45% 30%', border: '200 14% 86%', input: '200 14% 86%', ring: '200 55% 45%', texture: 'radial-gradient(hsl(220 20% 50% / .08) 1px, transparent 1px)' },
  { id: 'grid', name: 'Textura leve', mode: 'light', background: '220 20% 97%', foreground: '220 30% 15%', card: '0 0% 100%', cardForeground: '220 30% 15%', popover: '0 0% 100%', popoverForeground: '220 30% 15%', muted: '220 15% 92%', mutedForeground: '220 15% 45%', accent: '210 100% 95%', accentForeground: '220 70% 35%', border: '220 15% 88%', input: '220 15% 88%', ring: '220 70% 45%', texture: 'linear-gradient(hsl(220 20% 50% / .045) 1px, transparent 1px), linear-gradient(90deg, hsl(220 20% 50% / .045) 1px, transparent 1px)' },
  { id: 'blue-strong', name: 'Azul intenso', mode: 'light', background: '215 45% 91%', foreground: '215 35% 18%', card: '214 50% 97%', cardForeground: '215 35% 18%', popover: '214 50% 97%', popoverForeground: '215 35% 18%', muted: '215 35% 83%', mutedForeground: '215 25% 40%', accent: '214 70% 86%', accentForeground: '215 60% 30%', border: '215 28% 78%', input: '215 28% 78%', ring: '215 70% 45%', texture: 'none' },
  { id: 'purple-strong', name: 'Roxo intenso', mode: 'light', background: '265 38% 92%', foreground: '265 30% 18%', card: '265 42% 98%', cardForeground: '265 30% 18%', popover: '265 42% 98%', popoverForeground: '265 30% 18%', muted: '265 30% 84%', mutedForeground: '265 22% 42%', accent: '265 58% 87%', accentForeground: '265 55% 30%', border: '265 24% 80%', input: '265 24% 80%', ring: '265 65% 48%', texture: 'none' },
  { id: 'green-strong', name: 'Verde intenso', mode: 'light', background: '150 34% 91%', foreground: '150 30% 17%', card: '150 38% 97%', cardForeground: '150 30% 17%', popover: '150 38% 97%', popoverForeground: '150 30% 17%', muted: '150 26% 82%', mutedForeground: '150 22% 40%', accent: '150 52% 85%', accentForeground: '150 50% 28%', border: '150 22% 77%', input: '150 22% 77%', ring: '150 60% 42%', texture: 'none' },
  { id: 'teal-strong', name: 'Azul petróleo', mode: 'light', background: '185 36% 91%', foreground: '185 30% 17%', card: '185 40% 97%', cardForeground: '185 30% 17%', popover: '185 40% 97%', popoverForeground: '185 30% 17%', muted: '185 28% 82%', mutedForeground: '185 22% 40%', accent: '185 55% 85%', accentForeground: '185 55% 28%', border: '185 23% 77%', input: '185 23% 77%', ring: '185 65% 42%', texture: 'none' },
  { id: 'rose-strong', name: 'Rosa queimado', mode: 'light', background: '345 34% 93%', foreground: '345 28% 18%', card: '345 38% 98%', cardForeground: '345 28% 18%', popover: '345 38% 98%', popoverForeground: '345 28% 18%', muted: '345 25% 84%', mutedForeground: '345 20% 42%', accent: '345 52% 88%', accentForeground: '345 52% 30%', border: '345 22% 81%', input: '345 22% 81%', ring: '345 62% 48%', texture: 'none' },
  { id: 'amber-strong', name: 'Âmbar', mode: 'light', background: '38 45% 92%', foreground: '35 32% 18%', card: '38 50% 98%', cardForeground: '35 32% 18%', popover: '38 50% 98%', popoverForeground: '35 32% 18%', muted: '38 32% 83%', mutedForeground: '35 25% 42%', accent: '38 62% 86%', accentForeground: '35 60% 28%', border: '38 28% 79%', input: '38 28% 79%', ring: '38 70% 45%', texture: 'none' },
  { id: 'graphite', name: 'Grafite', mode: 'light', background: '220 14% 88%', foreground: '220 25% 15%', card: '220 12% 96%', cardForeground: '220 25% 15%', popover: '220 12% 96%', popoverForeground: '220 25% 15%', muted: '220 12% 79%', mutedForeground: '220 12% 40%', accent: '220 18% 82%', accentForeground: '220 25% 28%', border: '220 12% 73%', input: '220 12% 73%', ring: '220 40% 45%', texture: 'none' },
  { id: 'red-strong', name: 'Vermelho intenso', mode: 'light', background: '0 38% 92%', foreground: '0 30% 18%', card: '0 42% 98%', cardForeground: '0 30% 18%', popover: '0 42% 98%', popoverForeground: '0 30% 18%', muted: '0 30% 83%', mutedForeground: '0 22% 42%', accent: '0 58% 87%', accentForeground: '0 58% 30%', border: '0 25% 79%', input: '0 25% 79%', ring: '0 68% 48%', texture: 'none' },
  { id: 'orange-strong', name: 'Laranja intenso', mode: 'light', background: '24 42% 91%', foreground: '24 32% 17%', card: '24 46% 98%', cardForeground: '24 32% 17%', popover: '24 46% 98%', popoverForeground: '24 32% 17%', muted: '24 32% 81%', mutedForeground: '24 24% 40%', accent: '24 62% 85%', accentForeground: '24 62% 28%', border: '24 28% 77%', input: '24 28% 77%', ring: '24 70% 45%', texture: 'none' },
  { id: 'yellow-strong', name: 'Amarelo dourado', mode: 'light', background: '48 48% 91%', foreground: '45 35% 17%', card: '48 52% 98%', cardForeground: '45 35% 17%', popover: '48 52% 98%', popoverForeground: '45 35% 17%', muted: '48 35% 81%', mutedForeground: '45 28% 40%', accent: '48 65% 85%', accentForeground: '45 62% 28%', border: '48 30% 77%', input: '48 30% 77%', ring: '48 72% 43%', texture: 'none' },
  { id: 'cyan-strong', name: 'Ciano intenso', mode: 'light', background: '190 44% 90%', foreground: '190 32% 17%', card: '190 48% 97%', cardForeground: '190 32% 17%', popover: '190 48% 97%', popoverForeground: '190 32% 17%', muted: '190 34% 80%', mutedForeground: '190 25% 40%', accent: '190 64% 84%', accentForeground: '190 62% 28%', border: '190 30% 76%', input: '190 30% 76%', ring: '190 72% 42%', texture: 'none' },
  { id: 'indigo-strong', name: 'Índigo intenso', mode: 'light', background: '235 40% 91%', foreground: '235 30% 18%', card: '235 45% 98%', cardForeground: '235 30% 18%', popover: '235 45% 98%', popoverForeground: '235 30% 18%', muted: '235 30% 81%', mutedForeground: '235 23% 42%', accent: '235 62% 86%', accentForeground: '235 58% 30%', border: '235 25% 78%', input: '235 25% 78%', ring: '235 68% 48%', texture: 'none' },
  { id: 'violet-strong', name: 'Violeta intenso', mode: 'light', background: '285 38% 92%', foreground: '285 30% 18%', card: '285 43% 98%', cardForeground: '285 30% 18%', popover: '285 43% 98%', popoverForeground: '285 30% 18%', muted: '285 30% 83%', mutedForeground: '285 22% 42%', accent: '285 60% 87%', accentForeground: '285 56% 30%', border: '285 24% 80%', input: '285 24% 80%', ring: '285 68% 48%', texture: 'none' },
  { id: 'magenta-strong', name: 'Magenta intenso', mode: 'light', background: '315 38% 92%', foreground: '315 30% 18%', card: '315 43% 98%', cardForeground: '315 30% 18%', popover: '315 43% 98%', popoverForeground: '315 30% 18%', muted: '315 30% 83%', mutedForeground: '315 22% 42%', accent: '315 58% 87%', accentForeground: '315 56% 30%', border: '315 24% 80%', input: '315 24% 80%', ring: '315 68% 48%', texture: 'none' },
  { id: 'olive', name: 'Oliva', mode: 'light', background: '78 28% 90%', foreground: '78 28% 18%', card: '78 34% 97%', cardForeground: '78 28% 18%', popover: '78 34% 97%', popoverForeground: '78 28% 18%', muted: '78 22% 79%', mutedForeground: '78 18% 40%', accent: '78 42% 83%', accentForeground: '78 42% 28%', border: '78 20% 75%', input: '78 20% 75%', ring: '78 50% 40%', texture: 'none' },
  { id: 'navy', name: 'Azul marinho', mode: 'light', background: '220 32% 86%', foreground: '220 30% 16%', card: '220 35% 96%', cardForeground: '220 30% 16%', popover: '220 35% 96%', popoverForeground: '220 30% 16%', muted: '220 25% 76%', mutedForeground: '220 20% 40%', accent: '220 48% 81%', accentForeground: '220 48% 27%', border: '220 22% 70%', input: '220 22% 70%', ring: '220 58% 42%', texture: 'none' },
  { id: 'brown', name: 'Cacau', mode: 'light', background: '25 28% 88%', foreground: '25 28% 17%', card: '25 32% 96%', cardForeground: '25 28% 17%', popover: '25 32% 96%', popoverForeground: '25 28% 17%', muted: '25 22% 77%', mutedForeground: '25 18% 40%', accent: '25 42% 81%', accentForeground: '25 42% 27%', border: '25 20% 72%', input: '25 20% 72%', ring: '25 55% 42%', texture: 'none' },
];

const DARK_PRESETS: ThemePreset[] = [
  { id: 'night', name: 'Noturno', mode: 'dark', background: '220 35% 10%', foreground: '220 10% 95%', card: '220 30% 14%', cardForeground: '220 10% 95%', popover: '220 30% 14%', popoverForeground: '220 10% 95%', muted: '220 25% 20%', mutedForeground: '220 10% 65%', accent: '220 30% 22%', accentForeground: '220 10% 95%', border: '220 25% 22%', input: '220 25% 22%', ring: '220 70% 55%', sidebarBackground: '220 40% 8%', sidebarForeground: '220 10% 90%', texture: 'none' },
  { id: 'midnight-blue', name: 'Meia-noite azul', mode: 'dark', background: '222 47% 7%', foreground: '215 30% 96%', card: '222 42% 11%', cardForeground: '215 30% 96%', popover: '222 42% 11%', popoverForeground: '215 30% 96%', muted: '222 30% 17%', mutedForeground: '215 18% 66%', accent: '215 45% 21%', accentForeground: '215 30% 96%', border: '220 30% 20%', input: '220 30% 20%', ring: '215 85% 60%', sidebarBackground: '222 52% 5%', sidebarForeground: '215 30% 92%', texture: 'none' },
  { id: 'deep-graphite', name: 'Grafite profundo', mode: 'dark', background: '220 12% 8%', foreground: '220 12% 94%', card: '220 10% 12%', cardForeground: '220 12% 94%', popover: '220 10% 12%', popoverForeground: '220 12% 94%', muted: '220 9% 18%', mutedForeground: '220 8% 65%', accent: '220 12% 24%', accentForeground: '220 12% 94%', border: '220 10% 22%', input: '220 10% 22%', ring: '220 15% 70%', sidebarBackground: '220 14% 5%', sidebarForeground: '220 12% 90%', texture: 'none' },
  { id: 'deep-purple', name: 'Ametista noturna', mode: 'dark', background: '265 32% 9%', foreground: '265 20% 95%', card: '265 28% 13%', cardForeground: '265 20% 95%', popover: '265 28% 13%', popoverForeground: '265 20% 95%', muted: '265 22% 20%', mutedForeground: '265 16% 67%', accent: '265 32% 25%', accentForeground: '265 20% 95%', border: '265 22% 24%', input: '265 22% 24%', ring: '265 75% 65%', sidebarBackground: '265 38% 6%', sidebarForeground: '265 20% 92%', texture: 'none' },
  { id: 'deep-green', name: 'Verde floresta', mode: 'dark', background: '155 28% 8%', foreground: '150 20% 95%', card: '155 24% 12%', cardForeground: '150 20% 95%', popover: '155 24% 12%', popoverForeground: '150 20% 95%', muted: '155 20% 19%', mutedForeground: '150 14% 66%', accent: '155 28% 23%', accentForeground: '150 20% 95%', border: '155 20% 23%', input: '155 20% 23%', ring: '155 65% 55%', sidebarBackground: '155 34% 5%', sidebarForeground: '150 20% 90%', texture: 'none' },
  { id: 'blackout', name: 'Blackout — totalmente preto', mode: 'dark', background: '0 0% 0%', foreground: '0 0% 100%', card: '0 0% 0%', cardForeground: '0 0% 100%', popover: '0 0% 0%', popoverForeground: '0 0% 100%', muted: '0 0% 8%', mutedForeground: '0 0% 70%', accent: '0 0% 12%', accentForeground: '0 0% 100%', border: '0 0% 18%', input: '0 0% 18%', ring: '0 0% 82%', sidebarBackground: '0 0% 0%', sidebarForeground: '0 0% 92%', texture: 'none' },
];

const ALL_PRESETS = [...LIGHT_PRESETS, ...DARK_PRESETS];
const KEY = 'nuvexa:ui-personalization';

const getInitialThemeId = () => {
  const saved = localStorage.getItem(KEY);
  if (saved && ALL_PRESETS.some(p => p.id === saved)) return saved;
  return localStorage.getItem('theme') === 'dark' ? 'night' : 'default';
};

const applyPresetToDocument = (preset: ThemePreset) => {
  const root = document.documentElement;
  const values: Record<string, string> = {
    '--background': preset.background,
    '--foreground': preset.foreground,
    '--card': preset.card,
    '--card-foreground': preset.cardForeground,
    '--popover': preset.popover,
    '--popover-foreground': preset.popoverForeground,
    '--muted': preset.muted,
    '--muted-foreground': preset.mutedForeground,
    '--accent': preset.accent,
    '--accent-foreground': preset.accentForeground,
    '--border': preset.border,
    '--input': preset.input,
    '--ring': preset.ring,
    '--nuvexa-personalization-accent': preset.accent,
  };
  Object.entries(values).forEach(([key, value]) => root.style.setProperty(key, value));
  if (preset.sidebarBackground) root.style.setProperty('--sidebar-background', preset.sidebarBackground);
  if (preset.sidebarForeground) root.style.setProperty('--sidebar-foreground', preset.sidebarForeground);
  root.classList.toggle('dark', preset.mode === 'dark');
  document.body.style.backgroundImage = preset.texture;
  document.body.style.backgroundAttachment = preset.texture === 'none' ? '' : 'fixed';

  let style = document.getElementById('nuvexa-ui-personalization') as HTMLStyleElement | null;
  if (!style) {
    style = document.createElement('style');
    style.id = 'nuvexa-ui-personalization';
    document.head.appendChild(style);
  }
  style.textContent = `.nuvexa-ui-personalized [class*="border-b-2"][class*="border-primary"]{background-color:hsl(var(--nuvexa-personalization-accent))!important;background-image:${preset.texture === 'none' ? 'none' : preset.texture}!important;background-size:14px 14px;border-radius:10px 10px 0 0}`;
  root.classList.add('nuvexa-ui-personalized');
};

const clearPresetFromDocument = () => {
  const root = document.documentElement;
  ['--background','--foreground','--card','--card-foreground','--popover','--popover-foreground','--muted','--muted-foreground','--accent','--accent-foreground','--border','--input','--ring','--sidebar-background','--sidebar-foreground','--nuvexa-personalization-accent'].forEach(v => root.style.removeProperty(v));
  root.classList.remove('dark');
  document.body.style.backgroundImage = '';
  document.body.style.backgroundAttachment = '';
  document.getElementById('nuvexa-ui-personalization')?.remove();
  root.classList.remove('nuvexa-ui-personalized');
};

export function AppearancePersonalizationDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const [selected, setSelected] = useState(getInitialThemeId);

  useEffect(() => {
    const preset = ALL_PRESETS.find(p => p.id === selected) || LIGHT_PRESETS[0];
    applyPresetToDocument(preset);
    localStorage.setItem(KEY, preset.id);
    localStorage.removeItem('theme');
  }, []);

  useEffect(() => {
    if (open) setSelected(getInitialThemeId());
  }, [open]);

  const applyPreset = (preset: ThemePreset) => {
    applyPresetToDocument(preset);
    localStorage.setItem(KEY, preset.id);
    localStorage.removeItem('theme');
    setSelected(preset.id);
    window.dispatchEvent(new CustomEvent('nuvexa:ui-personalization-changed'));
    toast.success(`Tema ${preset.name.toLowerCase()} aplicado.`);
  };

  const reset = () => {
    clearPresetFromDocument();
    localStorage.removeItem(KEY);
    localStorage.removeItem('theme');
    setSelected('default');
    window.dispatchEvent(new CustomEvent('nuvexa:ui-personalization-changed'));
    toast.success('Visual padrão restaurado.');
  };

  const renderPresets = (presets: ThemePreset[]) => (
    <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
      {presets.map(p => (
        <button key={p.id} type="button" onClick={() => applyPreset(p)} className="group relative overflow-hidden rounded-xl border border-border p-2 text-left transition-all hover:border-primary/50 hover:shadow-sm">
          <div className="h-16 rounded-lg border border-border/60" style={{ backgroundColor: `hsl(${p.background})`, backgroundImage: p.texture, backgroundSize: p.id === 'grid' ? '14px 14px' : p.id === 'mist' ? '10px 10px' : undefined }}>
            <div className="mx-2 mt-3 h-8 rounded-lg border border-border/50" style={{ backgroundColor: `hsl(${p.card})` }} />
          </div>
          <span className="mt-2 block text-xs font-medium leading-tight">{p.name}</span>
          {selected === p.id && <span className="absolute right-2 top-2 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground"><Check className="h-3 w-3" /></span>}
        </button>
      ))}
    </div>
  );

  const isDarkSelected = DARK_PRESETS.some(p => p.id === selected);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto rounded-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Palette className="h-5 w-5 text-primary" /> Personalização do sistema</DialogTitle>
          <DialogDescription>Escolha o modo de exibição e personalize o visual. A identidade visual e as cores oficiais da empresa continuam preservadas.</DialogDescription>
        </DialogHeader>
        <Tabs defaultValue={isDarkSelected ? 'dark' : 'light'} className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="light" className="gap-2"><Sun className="h-4 w-4" /> Modo claro</TabsTrigger>
            <TabsTrigger value="dark" className="gap-2"><Moon className="h-4 w-4" /> Modo noturno</TabsTrigger>
          </TabsList>
          <TabsContent value="light" className="mt-4">
            <Label className="text-sm font-medium">Temas claros</Label>
            {renderPresets(LIGHT_PRESETS)}
          </TabsContent>
          <TabsContent value="dark" className="mt-4">
            <Label className="text-sm font-medium">Temas noturnos</Label>
            <p className="mt-1 text-xs text-muted-foreground">Inclui opções de baixa luminosidade e um modo Blackout totalmente preto.</p>
            {renderPresets(DARK_PRESETS)}
          </TabsContent>
        </Tabs>
        <Button type="button" variant="outline" className="w-full gap-2" onClick={reset}><RotateCcw className="h-4 w-4" /> Restaurar visual padrão da empresa</Button>
      </DialogContent>
    </Dialog>
  );
}
