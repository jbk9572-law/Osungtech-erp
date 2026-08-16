import type { CSSProperties, ReactNode } from "react";

// erp-badge-* 색상 조합을 각 그리드가 삼항연산자로 직접 조립해서 쓰다보니
// 어떤 상태에 어떤 색을 쓰는지 파일마다 제각각이었다 — 톤 이름으로만
// 고르게 해서 색 매핑을 한 곳에서 관리한다.
export type BadgeTone = "ok" | "warn" | "danger" | "muted" | "info";

const TONE_CLASS: Record<BadgeTone, string> = {
  ok: "erp-badge-success",
  warn: "erp-badge-warning",
  danger: "erp-badge-danger",
  muted: "erp-badge-muted",
  info: "erp-badge-info",
};

export function GridBadge({
  tone,
  children,
  style,
}: {
  tone: BadgeTone;
  children: ReactNode;
  style?: CSSProperties;
}) {
  return (
    <span className={`erp-badge ${TONE_CLASS[tone]}`} style={style}>
      {children}
    </span>
  );
}
