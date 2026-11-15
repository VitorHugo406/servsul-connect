// Real brand marks for the integrations screens (Claude, WhatsApp, Slack, SAP…). Unknown services get a coloured initial.
import { BRANDS } from './brandPaths';

const ALIAS: Record<string, string> = { protheus: 'totvs', totvs: 'totvs', claude: 'claude', whatsapp: 'whatsapp', slack: 'slack', sap: 'sap', oracle: 'oracle', adp: 'adp', gusto: 'gusto', hibob: 'hibob', personio: 'personio' };
const PALETTE = ['#0F4C81', '#2F6F5E', '#7A4B8C', '#B5532B', '#3E5C76', '#8A6D1F', '#5B5F97', '#9C3D54'];
const colorOf = (s: string) => PALETTE[[...s].reduce((a, c) => a + c.charCodeAt(0), 0) % PALETTE.length];

/** Brand glyph on a rounded coloured tile. `size` is the tile edge in px. */
export function BrandTile({ id, name, size = 44, color, letter }: { id: string; name?: string; size?: number; color?: string; letter?: string }) {
  const b = BRANDS[ALIAS[id] ?? id];
  const bg = color || b?.hex || colorOf(id);
  const L = (letter || name || id).trim().charAt(0).toUpperCase();
  return (
    <span aria-hidden="true" className="dk-tile" style={{ width: size, height: size, background: bg, borderRadius: Math.round(size * 0.3), flex: 'none' }}>
      {b ? <svg viewBox="0 0 24 24" width={size * 0.55} height={size * 0.55} fill="#fff"><path d={b.path} /></svg> : <span style={{ fontSize: size * 0.42, fontWeight: 600 }}>{L}</span>}
    </span>
  );
}

/** Small inline mark (brand colour, no tile) for lists and chips. */
export function BrandDot({ id, name, size = 18 }: { id: string; name?: string; size?: number }) {
  const b = BRANDS[ALIAS[id] ?? id];
  if (b) return <svg aria-hidden="true" viewBox="0 0 24 24" width={size} height={size} fill={b.hex} style={{ flex: 'none' }}><path d={b.path} /></svg>;
  return <span aria-hidden="true" style={{ width: size, height: size, borderRadius: size * 0.3, background: colorOf(id), color: '#fff', fontSize: size * 0.6, fontWeight: 600, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}>{(name || id).trim().charAt(0).toUpperCase()}</span>;
}
