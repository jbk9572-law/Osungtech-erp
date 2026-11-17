import type { CSSProperties, ReactNode } from "react";

// erp-badge-* 색상 조합을 각 그리드가 삼항연산자로 직접 조립해서 쓰다보니
// 어떤 상태에 어떤 색을 쓰는지 파일마다 제각각이었다 — 톤 이름으로만
// 고르게 해서 색 매핑을 한 곳에서 관리한다.
export type BadgeTone = "ok" | "warn" | "danger" | "muted" | "info" | "carry" | "carryPrev";

const TONE_CLASS: Record<BadgeTone, string> = {
  ok: "erp-badge-success",
  warn: "erp-badge-warning",
  danger: "erp-badge-danger",
  muted: "erp-badge-muted",
  info: "erp-badge-info",
  carry: "erp-badge-carry", // 익월이월(이번 달 등록, 다음 달 실적) — 연보라
  carryPrev: "erp-badge-carry-prev", // 전월이월(전월에서 넘어와 이번 달 실적) — 호박색. 두 뱃지는 같은 모양(흰 바탕+테두리)이다
};

export function GridBadge({
  tone,
  children,
  style,
  title,
  className,
}: {
  tone: BadgeTone;
  children: ReactNode;
  style?: CSSProperties;
  title?: string;
  className?: string;
}) {
  return (
    <span className={`erp-badge ${TONE_CLASS[tone]}${className ? ` ${className}` : ""}`} style={style} title={title}>
      {children}
    </span>
  );
}
