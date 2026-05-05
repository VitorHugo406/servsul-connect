// Catálogo de cores e texturas para anotações
export const NOTE_COLORS = [
  { name: 'Amarelo', value: '#FFF9C4' },
  { name: 'Rosa', value: '#FFCDD2' },
  { name: 'Verde', value: '#C8E6C9' },
  { name: 'Azul', value: '#BBDEFB' },
  { name: 'Roxo', value: '#E1BEE7' },
  { name: 'Laranja', value: '#FFE0B2' },
  { name: 'Cinza', value: '#ECEFF1' },
  { name: 'Branco', value: '#FFFFFF' },
];

// Texturas via gradientes/patterns CSS (sem precisar de imagens externas)
export const NOTE_TEXTURES: { name: string; value: string; css: string }[] = [
  { name: 'Nenhuma', value: 'none', css: '' },
  {
    name: 'Linhas (Caderno)',
    value: 'lines',
    css: 'repeating-linear-gradient(transparent, transparent 27px, rgba(0,0,0,0.08) 28px)',
  },
  {
    name: 'Quadriculado',
    value: 'grid',
    css: 'linear-gradient(rgba(0,0,0,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(0,0,0,0.06) 1px, transparent 1px)',
  },
  {
    name: 'Pontilhado',
    value: 'dots',
    css: 'radial-gradient(circle, rgba(0,0,0,0.12) 1px, transparent 1px)',
  },
  {
    name: 'Papel Antigo',
    value: 'paper',
    css: 'radial-gradient(rgba(120,80,40,0.08) 15%, transparent 16%), radial-gradient(rgba(120,80,40,0.06) 15%, transparent 16%)',
  },
  {
    name: 'Cortiça',
    value: 'cork',
    css: 'radial-gradient(circle at 25% 25%, rgba(139,90,43,0.15) 2px, transparent 3px), radial-gradient(circle at 75% 75%, rgba(139,90,43,0.12) 2px, transparent 3px)',
  },
];

// Imagens decorativas pré-definidas (gradientes inline para evitar dependência de assets)
export const NOTE_BACKGROUND_IMAGES: { name: string; value: string; css: string }[] = [
  { name: 'Sem imagem', value: 'none', css: '' },
  {
    name: 'Aurora',
    value: 'aurora',
    css: 'linear-gradient(135deg, #a18cd1 0%, #fbc2eb 100%)',
  },
  {
    name: 'Oceano',
    value: 'ocean',
    css: 'linear-gradient(135deg, #2193b0 0%, #6dd5ed 100%)',
  },
  {
    name: 'Pôr do Sol',
    value: 'sunset',
    css: 'linear-gradient(135deg, #ff9966 0%, #ff5e62 100%)',
  },
  {
    name: 'Floresta',
    value: 'forest',
    css: 'linear-gradient(135deg, #134E5E 0%, #71B280 100%)',
  },
  {
    name: 'Lavanda',
    value: 'lavender',
    css: 'linear-gradient(135deg, #c471f5 0%, #fa71cd 100%)',
  },
  {
    name: 'Café',
    value: 'coffee',
    css: 'linear-gradient(135deg, #6F4E37 0%, #C4A484 100%)',
  },
];

export function getTextureCss(texture: string | null): string {
  if (!texture || texture === 'none') return '';
  return NOTE_TEXTURES.find((t) => t.value === texture)?.css || '';
}

export function getImageCss(image: string | null): string {
  if (!image || image === 'none') return '';
  return NOTE_BACKGROUND_IMAGES.find((i) => i.value === image)?.css || '';
}

export function getTextureSize(texture: string | null): string {
  switch (texture) {
    case 'grid':
      return '20px 20px';
    case 'dots':
      return '15px 15px';
    case 'paper':
      return '40px 40px';
    case 'cork':
      return '30px 30px';
    default:
      return 'auto';
  }
}
