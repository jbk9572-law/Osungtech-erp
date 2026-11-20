"use client";

import { createContext, useContext, useSyncExternalStore, type ReactNode } from "react";
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

// 오른쪽 상세 패널이 실제로 보이는 폭(erp-theme.css의 .erp-detail-side가 ≤1100px에서 숨는 기준과 같다).
const SIDE_SPLIT_QUERY = "(min-width: 1101px)";
function subscribeSideSplit(onChange: () => void) {
  const mq = window.matchMedia(SIDE_SPLIT_QUERY);
  mq.addEventListener("change", onChange);
  return () => mq.removeEventListener("change", onChange);
}

/** 목록에서 행을 누르면 "이동" 대신 "오른쪽 패널에 선택"으로 동작할지 — 테마 기능이 켜졌고 패널이 보이는 폭일 때만 true(서버 렌더·좁은 화면은 false = 기존처럼 이동). */
export function useSideSplit(): boolean {
  const { listSidePanel } = useThemeFeatures();
  const wide = useSyncExternalStore(subscribeSideSplit, () => window.matchMedia(SIDE_SPLIT_QUERY).matches, () => false);
  return listSidePanel && wide;
}
