export const PRIORITIES = [
  { id: 'low', label: 'Baixa', color: 'bg-gray-500' },
  { id: 'medium', label: 'Média', color: 'bg-blue-500' },
  { id: 'high', label: 'Alta', color: 'bg-orange-500' },
  { id: 'urgent', label: 'Urgente', color: 'bg-red-500' },
];

// Background categories
export interface BackgroundGroup {
  id: string;
  name: string;
  items: { id: string; name: string; preview: string }[];
}

export const BACKGROUND_GROUPS: BackgroundGroup[] = [
  {
    id: 'color',
    name: 'Cores',
    items: [
      { id: 'default', name: 'Padrão', preview: 'bg-muted/30' },
      { id: 'gradient-blue', name: 'Azul', preview: 'bg-gradient-to-br from-blue-500/20 to-cyan-500/20' },
      { id: 'gradient-purple', name: 'Roxo', preview: 'bg-gradient-to-br from-purple-500/20 to-pink-500/20' },
      { id: 'gradient-green', name: 'Verde', preview: 'bg-gradient-to-br from-green-500/20 to-emerald-500/20' },
      { id: 'gradient-orange', name: 'Laranja', preview: 'bg-gradient-to-br from-orange-500/20 to-yellow-500/20' },
      { id: 'gradient-dark', name: 'Escuro', preview: 'bg-gradient-to-br from-gray-800/30 to-gray-900/30' },
      { id: 'gradient-ocean', name: 'Oceano', preview: 'bg-gradient-to-br from-blue-600/20 to-teal-400/20' },
      { id: 'gradient-sunset', name: 'Pôr do Sol', preview: 'bg-gradient-to-br from-red-500/20 to-orange-400/20' },
    ],
  },
  {
    id: 'landscape',
    name: 'Paisagens',
    items: [
      { id: 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=1200&q=80', name: 'Montanhas', preview: '' },
      { id: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=1200&q=80', name: 'Praia', preview: '' },
      { id: 'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=1200&q=80', name: 'Floresta', preview: '' },
      { id: 'https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?w=1200&q=80', name: 'Natureza', preview: '' },
      { id: 'https://images.unsplash.com/photo-1500534314263-0869cceaee0f?w=1200&q=80', name: 'Lago', preview: '' },
      { id: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=1200&q=80', name: 'Pico', preview: '' },
    ],
  },
  {
    id: 'corporate',
    name: 'Corporativo',
    items: [
      { id: 'https://images.unsplash.com/photo-1497366216548-37526070297c?w=1200&q=80', name: 'Escritório', preview: '' },
      { id: 'https://images.unsplash.com/photo-1497215842964-222b430dc094?w=1200&q=80', name: 'Workspace', preview: '' },
      { id: 'https://images.unsplash.com/photo-1521737711867-e3b97375f902?w=1200&q=80', name: 'Equipe', preview: '' },
      { id: 'https://images.unsplash.com/photo-1504384308090-c894fdcc538d?w=1200&q=80', name: 'Tecnologia', preview: '' },
      { id: 'https://images.unsplash.com/photo-1531973576160-7125cd663d86?w=1200&q=80', name: 'Moderno', preview: '' },
      { id: 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=1200&q=80', name: 'Arranha-céu', preview: '' },
    ],
  },
];

// Flatten for backward compat
export const BACKGROUND_IMAGES = BACKGROUND_GROUPS.flatMap(g => g.items);

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
