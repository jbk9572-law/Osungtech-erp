"use client";

import { createContext, useContext, type ReactNode } from "react";
import { GRID_CHECKBOX_WIDTH } from "@/lib/grid-sticky";

// 테마가 "값(색·크기)"이 아니라 "구조"까지 다르게 쓰는 기능의 단일 목록.
// 색/치수는 erp-theme.css의 [data-theme] 토큰이 맡고, 마크업이 달라져야 하는 것만 여기서 켠다 —
// 화면 코드가 테마 이름을 직접 비교(if theme === ...)하지 않고 이 플래그만 읽게 하려는 것이다.
// 새 테마를 추가하면 여기에 한 줄 추가한다(없으면 클래식과 같은 기본값).
export type ThemeFeatures = {
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
};

const CLASSIC_FEATURES: ThemeFeatures = { rowNumbers: false, groupedHeader: false, stockNear: false, partnerPaymentTerms: false, gridSelectionStats: false, paymentStatusColumn: false, voucherLayout: false };

const THEME_FEATURES: Record<string, ThemeFeatures> = {
  "classic-light": CLASSIC_FEATURES,
  "grid-modern": { rowNumbers: true, groupedHeader: true, stockNear: true, partnerPaymentTerms: true, gridSelectionStats: true, paymentStatusColumn: true, voucherLayout: true },
};

const ThemeFeaturesContext = createContext<ThemeFeatures>(CLASSIC_FEATURES);

export function ThemeFeaturesProvider({ theme, children }: { theme?: string | null; children: ReactNode }) {
  const features = (theme && THEME_FEATURES[theme]) || CLASSIC_FEATURES;
  return <ThemeFeaturesContext.Provider value={features}>{children}</ThemeFeaturesContext.Provider>;
}

export function useThemeFeatures(): ThemeFeatures {
  return useContext(ThemeFeaturesContext);
}

/** 행 번호를 체크박스 칸에 같이 넣을 때 그 칸의 추가 폭(px). */
export const ROW_NO_WIDTH = 36;

/** 목록 표 맨 앞 고정 칸(체크박스[+번호])의 폭 — 뒤따르는 고정 칸의 left 오프셋 계산에 쓴다. */
export function useGridCheckboxWidth(): number {
  return GRID_CHECKBOX_WIDTH + (useThemeFeatures().rowNumbers ? ROW_NO_WIDTH : 0);
}
