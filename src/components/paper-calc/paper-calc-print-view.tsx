"use client";

import { useState } from "react";
import Link from "next/link";
import { PrintButton } from "@/components/print-button";
import { NestEngine, type Item, type NestResult } from "@/lib/paper-nest-engine";
import { BatchCard, ProductionSummaryTable } from "@/components/paper-calc/paper-calc-client";

type PrintInput = { paperW: number; paperH: number; items: Item[] };

// 이 컴포넌트는 항상 클라이언트에서만 렌더링된다(부모 page.tsx가
// next/dynamic({ ssr: false })로 불러온다). localStorage는 브라우저에만
// 있어서 서버 렌더링 중에는 접근할 수 없기 때문. sessionStorage가 아니라
// localStorage를 쓰는 이유: 인쇄 화면은 noopener로 새 창을 열어서 띄우는데,
// sessionStorage는 오프너와의 연결이 끊긴 새 창에는 복제되지 않아 빈
// 화면으로 뜬다. localStorage는 오프너 관계와 무관하게 같은 출처에서 항상
// 공유된다.
function loadPrintData(): { input: PrintInput; result: NestResult } | null {
  const raw = localStorage.getItem("paper-calc-print-input");
  if (!raw) return null;
  try {
    const input = JSON.parse(raw) as PrintInput;
    const engine = new NestEngine();
    engine.sheetWidth = input.paperW;
    engine.sheetHeight = input.paperH;
    const result = engine.calculate(input.items);
    return { input, result };
  } catch {
    return null;
  }
}

export function PaperCalcPrintView() {
  const [data] = useState(loadPrintData);

  if (!data) {
    return (
      <div className="mx-auto max-w-md p-10 text-center text-sm text-gray-600">
        <p>계산 결과가 없습니다. 모조지 계산 화면에서 먼저 계산해주세요.</p>
        <Link href="/paper-calc" className="erp-btn mt-4 inline-flex">
          모조지 계산으로 이동
        </Link>
      </div>
    );
  }

  const { input, result } = data;

  const producedTotals: Record<string, number> = {};
  for (const layout of result.layouts) {
    for (const it of layout.items) producedTotals[it.name] = (producedTotals[it.name] ?? 0) + it.prod;
  }

  const usageValues = result.layouts.filter((l) => l.margin.usage != null);
  const totalW = usageValues.reduce((sum, l) => sum + l.sheetCount, 0);
  const usageAvg = totalW > 0 ? usageValues.reduce((sum, l) => sum + l.margin.usage * l.sheetCount, 0) / totalW : null;
  const exactReams = result.totalPaper / 500;

  return (
    <div className="mx-auto max-w-4xl p-8 print:p-0">
      <div className="mb-4 flex items-center justify-between print:hidden">
        <Link href="/paper-calc" className="erp-btn">
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
            sub: `${result.totalSheet}연 구매 (실사용 ${exactReams.toFixed(2)}연)`,
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
