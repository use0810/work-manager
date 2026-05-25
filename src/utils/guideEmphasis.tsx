import type { ReactNode } from 'react';

/** ガイド本文で赤字にしたい範囲を囲む（guideTermsContent の文字列内で使用） */
export const GUIDE_RED_OPEN = '《赤》';
export const GUIDE_RED_CLOSE = '《/赤》';

/** 《赤》…《/赤》を span に展開（未閉じはそのまま表示） */
export function renderGuideParagraphWithEmphasis(text: string): ReactNode {
  const open = GUIDE_RED_OPEN;
  const close = GUIDE_RED_CLOSE;
  const out: ReactNode[] = [];
  let rest = text;
  let n = 0;
  while (rest.length > 0) {
    const i = rest.indexOf(open);
    if (i === -1) {
      out.push(rest);
      break;
    }
    if (i > 0) out.push(rest.slice(0, i));
    rest = rest.slice(i + open.length);
    const j = rest.indexOf(close);
    if (j === -1) {
      out.push(open + rest);
      break;
    }
    const inner = rest.slice(0, j);
    out.push(
      <span key={`e${n++}`} className="guide-wizard-emphasis">
        {inner}
      </span>
    );
    rest = rest.slice(j + close.length);
  }
  return <>{out}</>;
}
