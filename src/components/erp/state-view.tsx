import type { ReactNode } from "react";

// 상태 화면(오류·없는 페이지·접근 제한·빈 결과)의 공용 카드 — design/COMPONENTS.md "상태" 부품.
// error.tsx·not-found.tsx·AccessWall·모달 오류가 같은 카드를 인라인 style로 각자 조립하던 것을 한 곳으로 모은다.
// 서버·클라이언트 어디서든 쓰도록 훅이 없다. 모양은 erp-theme.css의 .erp-state-*(토큰만 사용).
export type StateTone = "neutral" | "danger";

export function StateView({
  title,
  children,
  tone = "neutral",
  detail,
  actions,
  flat,
}: {
  title: string;
  children?: ReactNode;
  /** danger = 오류(제목이 위험색). */
  tone?: StateTone;
  /** 오류 메시지·digest처럼 운영자에게 알릴 기술 정보(고정폭 상자). */
  detail?: ReactNode;
  /** 버튼 줄(다시 시도·메인 화면으로 등). */
  actions?: ReactNode;
  /** 테두리·배경 없이 그린다 — 모달 본문 안처럼 이미 카드 안에 있을 때. */
  flat?: boolean;
}) {
  return (
    <div className={`erp-state${tone === "danger" ? " is-danger" : ""}${flat ? " is-flat" : ""}`} role={tone === "danger" ? "alert" : undefined}>
      <p className="erp-state-title">{title}</p>
      {children && <p className="erp-state-body">{children}</p>}
      {detail && <p className="erp-state-detail">{detail}</p>}
      {actions && <div className="erp-state-actions">{actions}</div>}
    </div>
  );
}
