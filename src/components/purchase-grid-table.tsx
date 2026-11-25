"use client";

import { useThemeFeatures } from "@/lib/erp-theme-features";
import { PurchaseGridTable as ModernPurchaseGridTable } from "@/components/purchase-grid/modern";
import { PurchaseGridTable as ClassicPurchaseGridTable } from "@/components/purchase-grid/classic";

export type { PurchaseRow, PurchaseRowItem } from "@/components/purchase-grid/modern";

// 테마별로 표 코드를 완전히 나눈다 — 모던(grid-modern)은 purchase-grid/modern.tsx(오른쪽 패널·좁은 폭은 상세 이동), 클래식은 동결본 purchase-grid/classic.tsx(행 아래 아코디언).
export function PurchaseGridTable(props: React.ComponentProps<typeof ClassicPurchaseGridTable> & { totalQuantityLabel?: string; carryoverQuantityLabel?: string }) {
  const { listSidePanel } = useThemeFeatures();
  return listSidePanel ? <ModernPurchaseGridTable {...props} /> : <ClassicPurchaseGridTable {...props} />;
}
