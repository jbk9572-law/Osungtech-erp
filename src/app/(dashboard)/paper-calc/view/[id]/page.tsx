import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PaperCalcReport } from "@/components/paper-calc/paper-calc-report";
import { computeEffectiveReams, type Item, type NestLayout, type NestResult } from "@/lib/paper-nest-engine";

export default async function PaperCalcViewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: calc } = await supabase
    .from("paper_calculations")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (!calc) {
    notFound();
  }

  const input = {
    paperW: Number(calc.paper_w),
    paperH: Number(calc.paper_h),
    items: (calc.input_items as Item[]) ?? [],
  };

  const layouts = (calc.layouts as NestLayout[]) ?? [];

  const result: NestResult = {
    totalPaper: calc.total_paper,
    totalSheet: calc.total_sheet,
    totalProd: calc.total_prod,
    overProd: calc.over_prod,
    layouts,
    fulfilled: calc.fulfilled,
    remaining: {},
    effectiveReams: computeEffectiveReams(layouts),
  };

  // 할일(todos)에서 "도면 보기"로 들어온 계산은 매입/매출 전표가 아직
  // 없으니 sales_order_id/purchase_order_id가 둘 다 비어있다 — 이 경우를
  // 놓치면 "닫기"가 그 할일이 아니라 아무 맥락 없는 계산기 화면으로
  // 떨어지는 막다른 길이 됐었다.
  const closeHref = calc.sales_order_id
    ? `/paper-calc?salesOrderId=${calc.sales_order_id}`
    : calc.purchase_order_id
      ? `/paper-calc?purchaseOrderId=${calc.purchase_order_id}`
      : calc.todo_id
        ? `/todos/${calc.todo_id}`
        : "/paper-calc";

  return <PaperCalcReport input={input} result={result} closeHref={closeHref} autoPrint={false} />;
}
