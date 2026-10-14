export type PageGuideTone = "info" | "warning" | "danger" | "success";

const TONE_STYLE: Record<PageGuideTone, { background: string; color: string; border: string }> = {
  info: {
    background: "var(--erp-info-bg)",
    color: "var(--erp-info-text)",
    border: "1px solid var(--erp-info-border)",
  },
  warning: {
    background: "var(--erp-warning-bg)",
    color: "var(--erp-warning)",
    border: "1px solid var(--erp-warning-border)",
  },
  danger: {
    background: "var(--erp-danger-bg)",
    color: "var(--erp-danger)",
    border: "1px solid var(--erp-danger-border)",
  },
  success: {
    background: "var(--erp-success-bg)",
    color: "var(--erp-success)",
    border: "1px solid var(--erp-success-border)",
  },
};

// 화면 상단/본문에 "이 화면을 어떻게 쓰는지" 또는 상태를 알려주는 안내문을,
// 그냥 흐린 텍스트가 아니라 눈에 띄는 박스로 통일해서 보여준다. 단순 부제목
// (날짜, SKU, 사업자번호 같은 데이터 표시)에는 쓰지 않는다 — 진짜 안내에만.
// tone은 기본 info고, 경고/위험/완료 안내는 warning/danger/success로 쓴다 —
// 색만 다른 똑같은 박스를 화면마다 인라인 style로 다시 조립하지 않는다.
export function PageGuide({
  children,
  tone = "info",
  className = "",
}: {
  children: React.ReactNode;
  tone?: PageGuideTone;
  className?: string;
}) {
  // className이 자기 마진(mb-0, mb-2 등)을 지정하면 기본 mb-4와 충돌해 둘 다
  // 적용되는 걸(유틸리티 클래스라 순서로는 승자가 안 정해짐) 피하려고, 그럴
  // 땐 기본 마진을 아예 빼고 className 쪽만 적용한다.
  const hasMarginOverride = /\bm[bty]?-\d/.test(className);
  return (
    <div
      className={`${hasMarginOverride ? "" : "mb-4"} rounded p-2 text-xs ${className}`}
      style={TONE_STYLE[tone]}
    >
      {children}
    </div>
  );
}
