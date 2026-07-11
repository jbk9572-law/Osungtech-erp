import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PaperCalcReport } from "@/components/paper-calc/paper-calc-report";
import type { Item, NestLayout, NestResult } from "@/lib/paper-nest-engine";

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

  const result: NestResult = {
    totalPaper: calc.total_paper,
    totalSheet: calc.total_sheet,
    totalProd: calc.total_prod,
    overProd: calc.over_prod,
    layouts: (calc.layouts as NestLayout[]) ?? [],
    fulfilled: calc.fulfilled,
    remaining: {},
  };

  const closeHref = calc.sales_order_id
    ? `/paper-calc?salesOrderId=${calc.sales_order_id}`
    : "/paper-calc";

  return <PaperCalcReport input={input} result={result} closeHref={closeHref} />;
}
