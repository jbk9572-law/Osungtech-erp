"use client";

import { useThemeFeatures } from "@/lib/erp-theme-features";
import { SalesGridTable as ModernSalesGridTable } from "@/components/sales-grid/modern";
import { SalesGridTable as ClassicSalesGridTable } from "@/components/sales-grid/classic";

export type { SalesRow, SalesRowItem } from "@/components/sales-grid/modern";

// 테마별로 표 코드를 완전히 나눈다 — 모던(grid-modern)은 sales-grid/modern.tsx(오른쪽 패널·좁은 폭은 상세 이동), 클래식은 동결본 sales-grid/classic.tsx(행 아래 아코디언).
export function SalesGridTable(props: React.ComponentProps<typeof ClassicSalesGridTable> & { totalQuantityLabel?: string; carryoverQuantityLabel?: string }) {
  const { listSidePanel } = useThemeFeatures();
  return listSidePanel ? <ModernSalesGridTable {...props} /> : <ClassicSalesGridTable {...props} />;
}
