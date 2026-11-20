// 테마별 "구조" 설정의 단일 목록(순수 데이터) — 서버·클라이언트 어디서든 읽을 수 있게 "use client" 없이 둔다.
// 화면은 React 훅(useThemeFeatures, erp-theme-features.tsx)으로, 서버 코드는 getThemeFeatures(theme)로 읽는다.
// 테마가 "값(색·크기)"이 아니라 "구조"까지 다르게 쓰는 기능의 단일 목록.
// 색/치수는 erp-theme.css의 [data-theme] 토큰이 맡고, 마크업이 달라져야 하는 것만 여기서 켠다 —
// 화면 코드가 테마 이름을 직접 비교(if theme === ...)하지 않고 이 플래그만 읽게 하려는 것이다.
// 새 테마를 추가하면 여기에 한 줄 추가한다(없으면 클래식과 같은 기본값).
export type ThemeFeatures = {
  /** 명세표 인쇄의 기본 서식 — 주소에 ?form=이 없을 때 쓴다(N = 우리가 설계한 새 공용 서식, B형 = 엔택스 0707 원본 복제, A형 = 엔택스 A형 복제). */
  defaultInvoiceForm: "A" | "B" | "N";
  /** 목록 표 첫 칸에 행 번호(No)를 같이 보여준다. */
  rowNumbers: boolean;
  /** 표 머리글 위에 묶음 머리글 줄(예: "금액(원)")을 얹는다. */
  groupedHeader: boolean;
  /** 재고 상태에 "근접"(안전재고 직전) 단계를 추가로 보여준다. */
  stockNear: boolean;
  /** 거래처/공급처 폼에 결제조건 입력칸을 보여준다. */
  partnerPaymentTerms: boolean;
  /** 표에서 드래그로 고른 칸의 합계/평균을 하단 상태바에 보여준다. */
  gridSelectionStats: boolean;
  /** 매출/매입 목록에 수금/지급 상태 칸을 보여준다. */
  paymentStatusColumn: boolean;
  /** 매출/매입 전표 등록 모달을 밀집 시트 구조(상태 칩 제목줄 + 하단 합계·저장 바)로 그린다. */
  voucherLayout: boolean;
  /** 미수금/미지급금 현황의 요약(KPI 타일 + 연체 분포 막대)을 얇은 한 줄 띠로 그린다. */
  kpiStrip: boolean;
  /** 재고현황에 재고 수준 막대·부족 줄 띠·재고금액 칸·묶음 머리글을 보여준다. */
  stockInsights: boolean;
  /** 재고현황·미수금/미지급금현황에서 행을 누르면 이동하지 않고 오른쪽 상세 패널에 보여준다(넓은 화면만). */
  listSidePanel: boolean;
};

export const CLASSIC_FEATURES: ThemeFeatures = { defaultInvoiceForm: "B", rowNumbers: false, groupedHeader: false, stockNear: false, partnerPaymentTerms: false, gridSelectionStats: false, paymentStatusColumn: false, voucherLayout: false, kpiStrip: false, stockInsights: false, listSidePanel: false };

export const THEME_FEATURES: Record<string, ThemeFeatures> = {
  "classic-light": CLASSIC_FEATURES,
  "grid-modern": { defaultInvoiceForm: "N", rowNumbers: true, groupedHeader: true, stockNear: true, partnerPaymentTerms: true, gridSelectionStats: true, paymentStatusColumn: true, voucherLayout: true, kpiStrip: true, stockInsights: true, listSidePanel: true },
};

export function getThemeFeatures(theme: string | null | undefined): ThemeFeatures {
  return (theme && THEME_FEATURES[theme]) || CLASSIC_FEATURES;
}
