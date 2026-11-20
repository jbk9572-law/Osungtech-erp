"use client";

import { DetailSideShell, type SideContent } from "@/components/grid/detail-side-shell";
import { loadInventoryItemDetail } from "@/lib/inventory-detail-actions";
import { formatNumber } from "@/lib/format-number";
import { formatNumOrDash } from "@/lib/format-num-or-dash";
import { useRowDetail } from "@/lib/use-row-detail";
import { STOCK_STATUS_BADGE, type StockStatus } from "@/lib/stock-status";
import type { ProductGridRow } from "@/components/product-grid-table";

const TX_LABEL = { in: "입고", out: "출고", adjustment: "조정" } as const;

// 입고는 +, 출고는 -(기록된 수량 부호와 무관하게), 조정은 기록된 부호 그대로.
function signedQty(type: keyof typeof TX_LABEL, quantity: number): string {
  if (type === "in") return `+${formatNumber(Math.abs(quantity))}`;
  if (type === "out") return `-${formatNumber(Math.abs(quantity))}`;
  return `${quantity > 0 ? "+" : ""}${formatNumber(quantity)}`;
}

// 재고현황 오른쪽 상세 패널 — 목록이 가진 값(분류·공급처·재고·안전재고·원가)은 바로 보이고, 창고별 재고와 최근 입출고는 그 품목 한 곳만 서버에서 불러온다.
export function InventorySidePanel({ row, status }: { row: ProductGridRow | null; status: StockStatus }) {
  const { data, loading } = useRowDetail(row?.id ?? null, loadInventoryItemDetail);

  let content: SideContent | null = null;
  if (row) {
    const unit = row.unit ?? "";
    const value = row.cost == null ? null : Math.max(0, row.quantity) * row.cost;
    const level = row.reorderPoint && row.reorderPoint > 0 ? Math.round((row.quantity / row.reorderPoint) * 100) : null;
    content = {
      title: row.name,
      subtitle: row.spec ?? undefined,
      badge: STOCK_STATUS_BADGE[status],
      kv: [
        { label: "분류", value: row.categoryName ?? "-" },
        { label: "공급처", value: row.supplierName ?? "-" },
        { label: "안전재고", value: formatNumOrDash(row.reorderPoint) },
        { label: "매입가", value: formatNumOrDash(row.cost) },
      ],
      totals: [
        { label: "현재 재고", value: `${formatNumber(row.quantity)} ${unit}` },
        { label: "재고금액", value: formatNumOrDash(value) },
        ...(level == null ? [] : [{ label: "안전재고 대비", value: `${level}%`, tone: level >= 100 ? ("success" as const) : ("danger" as const), strong: true }]),
      ],
      sections: [
        {
          heading: "창고별 재고",
          rows: (data?.warehouses ?? []).map((w) => ({ left: w.name, right: `${formatNumber(w.quantity)} ${unit}` })),
          emptyText: data ? "창고에 재고가 없습니다." : "내역을 불러오지 못했습니다.",
        },
        {
          heading: "최근 입출고",
          rows: (data?.recent ?? []).map((t) => ({
            left: `${TX_LABEL[t.type]} · ${t.createdAt.slice(5, 10)}`,
            mid: t.warehouseName ?? "",
            right: signedQty(t.type, t.quantity),
          })),
          emptyText: data ? "입출고 내역이 없습니다." : "내역을 불러오지 못했습니다.",
        },
      ],
      links: [
        { label: "품목·관리번호 통합조회", href: "/inventory/lot-lookup" },
        { label: "재고 부족 자동 발주 제안", href: "/inventory/reorder-suggestions" },
        { label: "재고 실사", href: "/inventory/count" },
      ],
      actions: [{ label: "상세·입출고내역", href: `/inventory/item/${row.id}` }],
    };
  }

  return <DetailSideShell ariaLabel="선택한 품목 상세" emptyText="행을 선택하면 상세가 여기에 보입니다." content={content} loading={loading} />;
}
