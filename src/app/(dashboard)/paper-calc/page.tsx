import Link from "next/link";
import { KeyboardShortcuts } from "@/components/erp/keyboard-shortcuts";
import { PaperCalcClient } from "@/components/paper-calc/paper-calc-client";
import { createClient } from "@/lib/supabase/server";
import type { NestLayout } from "@/lib/paper-nest-engine";

export default async function PaperCalcPage({
  searchParams,
}: {
  searchParams: Promise<{ salesOrderId?: string; purchaseOrderId?: string; for?: string }>;
}) {
  const { salesOrderId, purchaseOrderId, for: pendingFor } = await searchParams;
  let salesOrderLabel: string | null = null;
  let purchaseOrderLabel: string | null = null;
  let savedCalculations: {
    id: string;
    total_paper: number;
    total_sheet: number;
    total_prod: number;
    over_prod: number;
    fulfilled: boolean;
    created_at: string;
    layouts: NestLayout[];
  }[] = [];

  if (salesOrderId) {
    const supabase = await createClient();
    const [{ data: order }, { data: calcs }] = await Promise.all([
      supabase
        .from("sales_orders")
        .select("doc_no, customers(name)")
        .eq("id", salesOrderId)
        .maybeSingle(),
      supabase
        .from("paper_calculations")
        .select("id, total_paper, total_sheet, total_prod, over_prod, fulfilled, created_at, layouts")
        .eq("sales_order_id", salesOrderId)
        .order("created_at", { ascending: false }),
    ]);
    if (order) {
      salesOrderLabel = `#${order.doc_no} ${order.customers?.name ?? ""}`.trim();
    }
    savedCalculations = (calcs ?? []).map((c) => ({ ...c, layouts: (c.layouts as NestLayout[]) ?? [] }));
  } else if (purchaseOrderId) {
    const supabase = await createClient();
    const [{ data: order }, { data: calcs }] = await Promise.all([
      supabase
        .from("purchase_orders")
        .select("purchase_date, suppliers(name)")
        .eq("id", purchaseOrderId)
        .maybeSingle(),
      supabase
        .from("paper_calculations")
        .select("id, total_paper, total_sheet, total_prod, over_prod, fulfilled, created_at, layouts")
        .eq("purchase_order_id", purchaseOrderId)
        .order("created_at", { ascending: false }),
    ]);
    if (order) {
      purchaseOrderLabel = `${order.suppliers?.name ?? ""} (${order.purchase_date})`.trim();
    }
    savedCalculations = (calcs ?? []).map((c) => ({ ...c, layouts: (c.layouts as NestLayout[]) ?? [] }));
  }

  const closeHref = salesOrderId
    ? `/sales/${salesOrderId}`
    : purchaseOrderId
      ? `/purchases/${purchaseOrderId}`
      : "/dashboard";

  return (
    <div>
      <KeyboardShortcuts shortcuts={{ Escape: { href: closeHref } }} />
      <div className="mb-1 flex items-center justify-between">
        <h1 className="text-lg font-bold text-[#1c1c1c]">확장모듈 &gt; 모조지 계산</h1>
        <Link href={closeHref} className="erp-btn erp-btn-danger">
          ESC 닫기
        </Link>
      </div>
      <div style={{ marginTop: 12 }}>
        <PaperCalcClient
          salesOrderId={salesOrderId ?? null}
          salesOrderLabel={salesOrderLabel}
          purchaseOrderId={purchaseOrderId ?? null}
          purchaseOrderLabel={purchaseOrderLabel}
          pendingFor={pendingFor === "purchase" ? "purchase" : "sales"}
          savedCalculations={savedCalculations}
        />
      </div>
    </div>
  );
}
