import Link from "next/link";
import { KeyboardShortcuts } from "@/components/erp/keyboard-shortcuts";
import { PaperCalcClient } from "@/components/paper-calc/paper-calc-client";
import { createClient } from "@/lib/supabase/server";

export default async function PaperCalcPage({
  searchParams,
}: {
  searchParams: Promise<{ salesOrderId?: string }>;
}) {
  const { salesOrderId } = await searchParams;
  let salesOrderLabel: string | null = null;
  let savedCalculations: {
    id: string;
    total_paper: number;
    total_sheet: number;
    total_prod: number;
    over_prod: number;
    fulfilled: boolean;
    created_at: string;
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
        .select("id, total_paper, total_sheet, total_prod, over_prod, fulfilled, created_at")
        .eq("sales_order_id", salesOrderId)
        .order("created_at", { ascending: false }),
    ]);
    if (order) {
      salesOrderLabel = `#${order.doc_no} ${order.customers?.name ?? ""}`.trim();
    }
    savedCalculations = calcs ?? [];
  }

  const closeHref = salesOrderId ? `/sales/${salesOrderId}` : "/dashboard";

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
          savedCalculations={savedCalculations}
        />
      </div>
    </div>
  );
}
