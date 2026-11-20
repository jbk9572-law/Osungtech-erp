"use client";

import type { ReactNode } from "react";
import { useThemeFeatures } from "@/lib/erp-theme-features";

// 요약(KPI 타일 + 분포 막대)을 담는 틀 — 테마 기능 kpiStrip이 켜지면 얇은 한 줄 띠(.erp-kpi-band), 아니면 기존처럼 위아래로 쌓는다(.erp-kpi-stack).
// 서버 컴포넌트(BalanceAgingSummary)가 테마를 몰라도 되게 이 얇은 클라이언트 틀이 대신 읽는다. 미수금/미지급금/외주비정산이 같이 쓴다.
export function KpiStripFrame({ children }: { children: ReactNode }) {
  const { kpiStrip } = useThemeFeatures();
  return <div className={kpiStrip ? "erp-kpi-band" : "erp-kpi-stack"}>{children}</div>;
}
