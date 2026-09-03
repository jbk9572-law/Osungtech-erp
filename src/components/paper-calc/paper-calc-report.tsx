"use client";

import Link from "next/link";
import { PrintButton } from "@/components/print-button";
import type { Item, NestResult } from "@/lib/paper-nest-engine";
import { BatchCard, ProductionSummaryTable } from "@/components/paper-calc/paper-calc-client";
import { DIAGRAM_COLORS } from "@/lib/paper-calc-diagram-colors";

// 인쇄 미리보기(계산 직후, localStorage 기반)와 저장된 계산 다시 보기(DB
// 기반) 두 화면이 같은 보고서 레이아웃을 쓰기 때문에 공통 컴포넌트로 뺐다.
export function PaperCalcReport({
  input,
  result,
  closeHref = "/paper-calc",
  autoPrint = true,
}: {
  input: { paperW: number; paperH: number; items: Item[] };
  result: NestResult;
  closeHref?: string;
  // 방금 계산을 마치고 인쇄용 새 탭으로 연 경우(paper-calc-print-view)에는
  // 곧장 인쇄 대화상자를 띄우는 게 맞지만, 계산이력에서 "도면 보기"로
  // 지난 계산을 다시 열어볼 때(paper-calc/view/[id])는 그냥 조회하러 온
  // 것뿐이라 인쇄 대화상자가 멋대로 뜨면 안 된다 — 이 컴포넌트를 두
  // 화면에서 그대로 공유하는 대신 호출부가 의도를 명시하게 한다.
  autoPrint?: boolean;
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
        <PrintButton autoPrint={autoPrint} />
      </div>

      <h1 className="mb-4 text-lg font-bold">재단 결과 보고서</h1>

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-5">
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
          <div
            key={card.label}
            className="rounded p-3"
            style={{ background: DIAGRAM_COLORS.cardBg, border: "1px solid var(--erp-border)" }}
          >
            <div className="text-xs" style={{ color: "var(--erp-text-muted)" }}>
              {card.label}
            </div>
            <div className="text-lg font-bold" style={{ color: "var(--erp-text)" }}>
              {card.value}
            </div>
            {card.sub && (
              <div className="text-[11px]" style={{ color: "var(--erp-text-muted)" }}>
                {card.sub}
              </div>
            )}
          </div>
        ))}
      </div>

      <h2 className="mb-2 text-sm font-bold">발주 품목 / 생산 현황</h2>
      <div className="mb-6">
        <ProductionSummaryTable orderItems={input.items} producedTotals={producedTotals} />
      </div>

      <h2 className="mb-2 text-sm font-bold">배치 도면</h2>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {result.layouts.map((layout, i) => (
          <div key={i} className="break-inside-avoid">
            <BatchCard layout={layout} index={i} />
          </div>
        ))}
      </div>
    </div>
  );
}
