"use client";

import type { ReactNode } from "react";
import { useThemeFeatures } from "@/lib/erp-theme-features";

// 요약(KPI 타일 + 분포 막대)을 담는 틀 — 테마 기능 kpiStrip이 켜지면 얇은 한 줄 띠(.erp-kpi-band), 아니면 기존처럼 위아래로 쌓는다(.erp-kpi-stack).
// 서버 컴포넌트(BalanceAgingSummary)가 테마를 몰라도 되게 이 얇은 클라이언트 틀이 대신 읽는다. 미수금/미지급금/외주비정산이 같이 쓴다.
export function KpiStripFrame({ children, stackClassName }: { children: ReactNode; stackClassName?: string }) {
  const { kpiStrip } = useThemeFeatures();
  // stackClassName: 기존(쌓기) 모양에서만 붙는 바깥 여백 같은 클래스 — 띠 모양은 자기 여백을 가진다.
  return <div className={kpiStrip ? "erp-kpi-band" : `erp-kpi-stack${stackClassName ? ` ${stackClassName}` : ""}`}>{children}</div>;
}
