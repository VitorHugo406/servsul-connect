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
    name: 'Papel Leitura (Sepia)',
    value: 'reading',
    css: 'radial-gradient(ellipse at top, rgba(120,72,30,0.08), transparent 60%), radial-gradient(ellipse at bottom, rgba(120,72,30,0.10), transparent 60%), repeating-radial-gradient(circle at 30% 40%, rgba(160,110,60,0.04) 0px, rgba(160,110,60,0.04) 1px, transparent 1px, transparent 4px)',
  },
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
  {
    name: 'Céu Estrelado',
    value: 'starry',
    css: 'radial-gradient(circle at 20% 30%, white 1px, transparent 2px), radial-gradient(circle at 70% 60%, white 1px, transparent 2px), radial-gradient(circle at 40% 80%, white 1px, transparent 2px), linear-gradient(135deg, #0f2027 0%, #203a43 50%, #2c5364 100%)',
  },
  {
    name: 'Menta',
    value: 'mint',
    css: 'linear-gradient(135deg, #a8edea 0%, #fed6e3 100%)',
  },
  {
    name: 'Cereja',
    value: 'cherry',
    css: 'linear-gradient(135deg, #eb3349 0%, #f45c43 100%)',
  },
  {
    name: 'Neon',
    value: 'neon',
    css: 'linear-gradient(135deg, #12c2e9 0%, #c471ed 50%, #f64f59 100%)',
  },
  {
    name: 'Outono',
    value: 'autumn',
    css: 'linear-gradient(135deg, #d38312 0%, #a83279 100%)',
  },
  {
    name: 'Nebulosa',
    value: 'nebula',
    css: 'radial-gradient(ellipse at 30% 30%, rgba(255,100,200,0.5), transparent 60%), radial-gradient(ellipse at 70% 70%, rgba(100,150,255,0.5), transparent 60%), linear-gradient(135deg, #1a1a3e 0%, #0f0c29 100%)',
  },
  {
    name: 'Pastel',
    value: 'pastel',
    css: 'linear-gradient(135deg, #ffecd2 0%, #fcb69f 100%)',
  },
  {
    name: 'Esmeralda',
    value: 'emerald',
    css: 'linear-gradient(135deg, #11998e 0%, #38ef7d 100%)',
  },
  {
    name: 'Crepúsculo',
    value: 'twilight',
    css: 'linear-gradient(135deg, #4b6cb7 0%, #182848 100%)',
  },
  {
    name: 'Sakura',
    value: 'sakura',
    css: 'radial-gradient(circle at 20% 30%, rgba(255,182,193,0.6) 4px, transparent 5px), radial-gradient(circle at 60% 70%, rgba(255,192,203,0.5) 5px, transparent 6px), linear-gradient(135deg, #ffe4e1 0%, #ffc0cb 100%)',
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
