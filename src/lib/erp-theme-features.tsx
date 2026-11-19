"use client";

import { createContext, useContext, type ReactNode } from "react";
import { GRID_CHECKBOX_WIDTH } from "@/lib/grid-sticky";
import { getThemeFeatures, CLASSIC_FEATURES, type ThemeFeatures } from "@/lib/erp-theme-config";

export type { ThemeFeatures };

const ThemeFeaturesContext = createContext<ThemeFeatures>(CLASSIC_FEATURES);

export function ThemeFeaturesProvider({ theme, children }: { theme?: string | null; children: ReactNode }) {
  const features = getThemeFeatures(theme);
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
