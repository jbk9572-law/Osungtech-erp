import type { CSSProperties } from "react";
import { sanitizeRichText } from "@/lib/sanitize-rich-text";

// RichTextEditor(TipTap)로 작성된 HTML을 그릴 때 공용으로 쓰는 컴포넌트 —
// sanitize-rich-text.ts를 통해 항상 한 번 걸러서 그린다. 공지사항/전자결재/
// 공문/문서양식/고객지원 등 어디서 쓰든 이 컴포넌트를 거치면 다시 손으로
// dangerouslySetInnerHTML을 조립할 필요가 없고, 허용 태그를 바꿀 일이
// 생기면 sanitize-rich-text.ts 한 곳만 고치면 전체에 반영된다.
export function RichTextView({
  html,
  className,
  style,
}: {
  html: string | null | undefined;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <div
      className={className}
      style={style}
      dangerouslySetInnerHTML={{ __html: sanitizeRichText(html) }}
    />
  );
}
