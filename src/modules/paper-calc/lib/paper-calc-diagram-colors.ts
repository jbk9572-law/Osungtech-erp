// 모조지 배치도 SVG(paper-calc-client.tsx의 BatchCard, manual-layout-client.tsx의
// 배치 캔버스)는 도면처럼 보여야 해서 앱 UI 색상 토큰(--erp-*)과는 별개의
// 회색조 팔레트를 쓴다 — 두 화면이 같은 도면 렌더링을 각자 복제해서 만들며
// 색상값도 따로 하드코딩돼 있었다. 하나로 모아서, 도면 색을 바꿀 일이
// 생기면 여기 한 곳만 고치면 되게 한다.
export const DIAGRAM_COLORS = {
  canvasBg: "#F2F2F2",
  cardBg: "#F7F8FA",
  paperFill: "#fff",
  paperStroke: "#333333",
  gridMajor: "#d8d8d8",
  gridMinor: "#ebebeb",
  ruler: "#999999",
  itemStroke: "#555555",
  itemStrokeSelected: "var(--erp-primary)",
  labelPrimary: "#222222",
  labelSecondary: "#444444",
  leftoverLabel: "#888888",
  // 아이템 팔레트(PALETTE, paper-nest-engine.ts)를 다 써버렸을 때 배정하는
  // 색 — 팔레트 색과 겹치지 않는 무채색으로, "색이 없다"는 걸 스스로
  // 드러내는 게 목적이라 팔레트에는 포함하지 않는다.
  itemFallback: "#CCCCCC",
} as const;
