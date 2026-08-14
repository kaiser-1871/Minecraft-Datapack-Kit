// completion-map.ts — map Spyglass/LSP completion results to a plain DTO.
//
// Shared by the in-process engine and the LSP fallback; kept here (not in lsp-legacy) so the
// inproc engine doesn't reverse-depend on the legacy driver.
import type { CompletionItemDTO } from './types.js';

const KIND_NAMES: Record<number, string> = {
  1:'Text',2:'Method',3:'Function',4:'Constructor',5:'Field',6:'Variable',7:'Class',8:'Interface',9:'Module',10:'Property',11:'Unit',12:'Value',13:'Enum',14:'Keyword',15:'Snippet',16:'Color',17:'File',18:'Reference',19:'Folder',20:'EnumMember',21:'Constant',22:'Struct',23:'Event',24:'Operator',25:'TypeParameter',
};

/** Normalize a completion result (an array or { items }) into a flat DTO list. */
export function completionItemsOf(res: unknown): CompletionItemDTO[] {
  return (Array.isArray(res) ? res : ((res as { items?: unknown[] })?.items ?? [])).map(it => {
    const item = it as { label?: string; kind?: number; detail?: string | null; documentation?: unknown };
    let documentation: string | null = null;
    if (item.documentation != null) {
      if (typeof item.documentation === 'object') {
        const v = (item.documentation as { value?: unknown })?.value;
        documentation = v == null ? '' : String(v);
      } else {
        documentation = String(item.documentation);
      }
    }
    return { label: item.label ?? '', kind: KIND_NAMES[item.kind ?? 0] ?? null, detail: item.detail ?? null, documentation };
  });
}
