export const PRIORITIES = [
  { id: 'low', label: 'Baixa', color: 'bg-gray-500' },
  { id: 'medium', label: 'Média', color: 'bg-blue-500' },
  { id: 'high', label: 'Alta', color: 'bg-orange-500' },
  { id: 'urgent', label: 'Urgente', color: 'bg-red-500' },
];

export const BACKGROUND_IMAGES = [
  { id: 'default', name: 'Padrão', preview: 'bg-muted/30' },
  { id: 'gradient-blue', name: 'Azul', preview: 'bg-gradient-to-br from-blue-500/20 to-cyan-500/20' },
  { id: 'gradient-purple', name: 'Roxo', preview: 'bg-gradient-to-br from-purple-500/20 to-pink-500/20' },
  { id: 'gradient-green', name: 'Verde', preview: 'bg-gradient-to-br from-green-500/20 to-emerald-500/20' },
  { id: 'gradient-orange', name: 'Laranja', preview: 'bg-gradient-to-br from-orange-500/20 to-yellow-500/20' },
  { id: 'gradient-dark', name: 'Escuro', preview: 'bg-gradient-to-br from-gray-800/30 to-gray-900/30' },
  { id: 'gradient-ocean', name: 'Oceano', preview: 'bg-gradient-to-br from-blue-600/20 to-teal-400/20' },
  { id: 'gradient-sunset', name: 'Pôr do Sol', preview: 'bg-gradient-to-br from-red-500/20 to-orange-400/20' },
];

export const CARD_COVERS = [
  { id: 'none', name: 'Nenhuma', color: '' },
  { id: 'blue', name: 'Azul', color: 'bg-blue-500' },
  { id: 'green', name: 'Verde', color: 'bg-green-500' },
  { id: 'yellow', name: 'Amarelo', color: 'bg-yellow-500' },
  { id: 'red', name: 'Vermelho', color: 'bg-red-500' },
  { id: 'purple', name: 'Roxo', color: 'bg-purple-500' },
  { id: 'pink', name: 'Rosa', color: 'bg-pink-500' },
  { id: 'orange', name: 'Laranja', color: 'bg-orange-500' },
];

export function getBoardBg(bg: string) {
  const found = BACKGROUND_IMAGES.find(b => b.id === bg);
  if (found) return found.preview;
  return '';
}

export function getBoardBgStyle(bg: string): React.CSSProperties {
  if (bg && bg.startsWith('http')) {
    return { backgroundImage: `url(${bg})`, backgroundSize: 'cover', backgroundPosition: 'center' };
  }
  return {};
}

export function getInitials(name: string) {
  return name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase();
}

export function isImageUrl(value: string | null): boolean {
  if (!value) return false;
  return value.startsWith('http') || value.startsWith('data:');
}

export function getCoverDisplay(cover: string | null): { type: 'none' | 'color' | 'image'; value: string } {
  if (!cover || cover === 'none') return { type: 'none', value: '' };
  if (isImageUrl(cover)) return { type: 'image', value: cover };
  const found = CARD_COVERS.find(c => c.id === cover);
  return found ? { type: 'color', value: found.color } : { type: 'none', value: '' };
}
