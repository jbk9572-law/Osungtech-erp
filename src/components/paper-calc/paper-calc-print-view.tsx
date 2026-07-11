"use client";

import { useState } from "react";
import Link from "next/link";
import { NestEngine, type Item, type NestResult } from "@/lib/paper-nest-engine";
import { PaperCalcReport } from "@/components/paper-calc/paper-calc-report";

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

  return <PaperCalcReport input={data.input} result={data.result} />;
}
