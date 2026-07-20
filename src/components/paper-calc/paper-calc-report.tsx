"use client";

import Link from "next/link";
import { PrintButton } from "@/components/print-button";
import type { Item, NestResult } from "@/lib/paper-nest-engine";
import { BatchCard, ProductionSummaryTable } from "@/components/paper-calc/paper-calc-client";

// 인쇄 미리보기(계산 직후, localStorage 기반)와 저장된 계산 다시 보기(DB
// 기반) 두 화면이 같은 보고서 레이아웃을 쓰기 때문에 공통 컴포넌트로 뺐다.
export function PaperCalcReport({
  input,
  result,
  closeHref = "/paper-calc",
}: {
  input: { paperW: number; paperH: number; items: Item[] };
  result: NestResult;
  closeHref?: string;
}) {
  const producedTotals: Record<string, number> = {};
  for (const layout of result.layouts) {
    for (const it of layout.items) producedTotals[it.name] = (producedTotals[it.name] ?? 0) + it.prod;
  }

  const usageValues = result.layouts.filter((l) => l.margin.usage != null);
  const totalW = usageValues.reduce((sum, l) => sum + l.sheetCount, 0);
  const usageAvg = totalW > 0 ? usageValues.reduce((sum, l) => sum + l.margin.usage * l.sheetCount, 0) / totalW : null;

  return (
    <div className="mx-auto max-w-4xl p-8 print:p-0">
      <div className="mb-4 flex items-center justify-between print:hidden">
        <Link href={closeHref} className="erp-btn erp-btn-danger">
          닫기
        </Link>
        <PrintButton />
      </div>

      <h1 className="mb-4 text-lg font-bold">재단 결과 보고서</h1>

      <div className="mb-6 grid grid-cols-5 gap-3">
        {[
          {
            label: "총 원지",
            value: `${result.totalPaper.toLocaleString()}장`,
            sub: `${result.totalSheet}연 구매 (실사용 ${result.effectiveReams.toFixed(2)}연)`,
          },
          { label: "총 생산", value: `${result.totalProd.toLocaleString()}매`, sub: "" },
          { label: "초과 생산", value: `${result.overProd.toLocaleString()}매`, sub: "" },
          { label: "평균 사용률", value: usageAvg != null ? `${usageAvg.toFixed(1)}%` : "-", sub: "" },
          { label: "배치 수", value: `${result.layouts.length}개`, sub: "" },
        ].map((card) => (
          <div key={card.label} className="rounded border border-gray-300 bg-gray-50 p-3">
            <div className="text-xs text-gray-500">{card.label}</div>
            <div className="text-lg font-bold">{card.value}</div>
            {card.sub && <div className="text-[11px] text-gray-600">{card.sub}</div>}
          </div>
        ))}
      </div>

      <h2 className="mb-2 text-sm font-bold">발주 품목 / 생산 현황</h2>
      <div className="mb-6">
        <ProductionSummaryTable orderItems={input.items} producedTotals={producedTotals} />
      </div>

      <h2 className="mb-2 text-sm font-bold">배치 도면</h2>
      <div className="grid grid-cols-2 gap-4">
        {result.layouts.map((layout, i) => (
          <div key={i} className="break-inside-avoid">
            <BatchCard layout={layout} index={i} />
          </div>
        ))}
      </div>
    </div>
  );
}
