// Ícones dos setores desenhados exatamente como no design "Setores" (Tela_de_Avisos_6). Mesmos ids do SECTOR_ICONS.
export const SECTOR_SVG: Record<string, { label: string; svg: string }> = {
  'building': { label: "Prédio", svg: "<rect x=\"5\" y=\"3\" width=\"14\" height=\"18\" rx=\"1\"></rect><path d=\"M9 7h2M13 7h2M9 11h2M13 11h2M9 15h2M13 15h2\"></path>" },
  'briefcase': { label: "Negócios", svg: "<rect x=\"3\" y=\"7\" width=\"18\" height=\"13\" rx=\"2\"></rect><path d=\"M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2M3 13h18\"></path>" },
  'users': { label: "Pessoas", svg: "<circle cx=\"9\" cy=\"8\" r=\"3\"></circle><path d=\"M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6M16 5a3 3 0 0 1 0 6M18 14c2 .6 3 2.7 3 6\"></path>" },
  'trending-up': { label: "Crescimento", svg: "<path d=\"M3 17l6-6 4 4 8-8M15 7h6v6\"></path>" },
  'dollar-sign': { label: "Financeiro", svg: "<path d=\"M12 3v18M16 7.5C16 6 14.2 5 12 5s-4 1-4 2.6S9.6 10 12 11s4 1.9 4 3.5S14.2 18 12 18s-4-1-4-2.5\"></path>" },
  'monitor': { label: "TI", svg: "<rect x=\"3\" y=\"4\" width=\"18\" height=\"12\" rx=\"2\"></rect><path d=\"M8 20h8M12 16v4\"></path>" },
  'settings': { label: "Engenharia", svg: "<circle cx=\"12\" cy=\"12\" r=\"3\"></circle><path d=\"M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M19.1 4.9L17 7M7 17l-2.1 2.1\"></path>" },
  'shield-check': { label: "Segurança", svg: "<path d=\"M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z\"></path><path d=\"M9 12l2 2 4-4\"></path>" },
  'truck': { label: "Logística", svg: "<path d=\"M3 6h11v10H3zM14 9h4l3 3v4h-7\"></path><circle cx=\"7\" cy=\"18\" r=\"2\"></circle><circle cx=\"17\" cy=\"18\" r=\"2\"></circle>" },
  'wrench': { label: "Manutenção", svg: "<path d=\"M14.7 6.3a4 4 0 0 0-5 5L3 18l3 3 6.7-6.7a4 4 0 0 0 5-5L15 12l-3-3z\"></path>" },
  'headphones': { label: "Suporte", svg: "<path d=\"M4 14v-2a8 8 0 0 1 16 0v2\"></path><rect x=\"3\" y=\"14\" width=\"4\" height=\"6\" rx=\"1.5\"></rect><rect x=\"17\" y=\"14\" width=\"4\" height=\"6\" rx=\"1.5\"></rect>" },
  'bar-chart': { label: "Análise", svg: "<path d=\"M4 20V10M10 20V4M16 20v-7M22 20H2\"></path>" },
  'file-text': { label: "Documentação", svg: "<path d=\"M6 3h9l4 4v14H6z\"></path><path d=\"M14 3v5h5M9 13h6M9 17h6\"></path>" },
  'graduation-cap': { label: "Treinamento", svg: "<path d=\"M2 9l10-5 10 5-10 5z\"></path><path d=\"M6 11v5c0 1.5 3 3 6 3s6-1.5 6-3v-5\"></path>" },
  'heart': { label: "Saúde", svg: "<path d=\"M12 20s-8-5-8-11a4.5 4.5 0 0 1 8-2.5A4.5 4.5 0 0 1 20 9c0 6-8 11-8 11z\"></path>" },
  'landmark': { label: "Jurídico", svg: "<path d=\"M3 9l9-5 9 5M5 9v9M10 9v9M14 9v9M19 9v9M3 21h18\"></path>" },
  'package': { label: "Estoque", svg: "<path d=\"M12 3l9 5v8l-9 5-9-5V8zM3 8l9 5 9-5M12 13v8\"></path>" },
  'megaphone': { label: "Marketing", svg: "<path d=\"M3 11v3l12 5V6zM15 9a3 3 0 0 1 0 6M7 15l1 5h3l-1-4\"></path>" },
  'scale': { label: "Compliance", svg: "<path d=\"M12 4v16M6 20h12M5 7h14M5 7l-3 7a3 3 0 0 0 6 0zM19 7l-3 7a3 3 0 0 0 6 0z\"></path>" },
  'leaf': { label: "Sustentabil…", svg: "<path d=\"M5 19C5 10 11 5 20 4c0 9-5 15-14 15zM5 19c3-5 6-8 10-10\"></path>" },
};
export const SECTOR_SVG_ORDER = ["building", "briefcase", "users", "trending-up", "dollar-sign", "monitor", "settings", "shield-check", "truck", "wrench", "headphones", "bar-chart", "file-text", "graduation-cap", "heart", "landmark", "package", "megaphone", "scale", "leaf"];
