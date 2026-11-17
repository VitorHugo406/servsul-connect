// Three-way merge for note HTML so two people editing the same note never overwrite each other.
// The HTML is split into blocks (paragraph/line level); diff3 keeps both sides' edits and, when the
// same block was changed differently on both sides, keeps both versions (mine first) instead of losing one.
import { diff3Merge } from 'node-diff3';

export function splitBlocks(html: string): string[] {
  if (!html) return [];
  return html.split(/(?<=<\/(?:p|div|li|h[1-6]|ul|ol|blockquote|pre)>|<br\s*\/?>)/i).filter((s) => s !== '');
}

export function mergeNoteHtml(base: string, mine: string, theirs: string): string {
  if (mine === theirs) return mine;
  if (base === mine) return theirs;
  if (base === theirs) return mine;
  const out: string[] = [];
  for (const chunk of diff3Merge(splitBlocks(mine), splitBlocks(base), splitBlocks(theirs))) {
    if ('ok' in chunk && chunk.ok) out.push(...chunk.ok);
    else if ('conflict' in chunk && chunk.conflict) {
      const { a, b, o } = chunk.conflict;
      if (a.length === o.length && b.length === o.length) {
        // Same shape on both sides (e.g. neighbouring paragraphs edited): merge block by block.
        o.forEach((ob, i) => {
          if (a[i] === ob) out.push(b[i]);
          else if (b[i] === ob || b[i] === a[i]) out.push(a[i]);
          else out.push(a[i], b[i]);
        });
      } else {
        // Mine first, then only what they really added (not original blocks I changed/removed).
        out.push(...a);
        for (const blk of b) if (!a.includes(blk) && !o.includes(blk)) out.push(blk);
      }
    }
  }
  return out.join('');
}
