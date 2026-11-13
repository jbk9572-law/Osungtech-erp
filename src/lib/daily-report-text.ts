// 메인 화면 "오늘 리포트" 박스의 텍스트 복사(카톡 등에 붙여넣기)용 글을 만든다.
// 화면(daily-report-box.tsx)과 분리한 순수 함수라 형식을 테스트로 고정할 수 있다.
// 품목·규격·수량 줄(salesLines/purchaseLines)은 기존 "매출 복사/매입 복사"가 쓰는
// 같은 형식의 줄이고, 금액·수금/지급은 선택 항목이다(기본은 끔 — 외부 단톡방에
// 붙여넣을 때 금액이 실수로 나가지 않게). 품목별 단가/금액은 어떤 경우에도 넣지 않는다.

import { formatNumber } from "@/lib/format-number";

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

// "2026-11-12" -> "2026-11-12 (목)". 날짜 문자열을 UTC 자정으로 해석해 요일만 뽑으므로
// 서버/브라우저 타임존과 무관하게 항상 같은 요일이 나온다.
export function formatReportDateLabel(dateStr: string): string {
  const d = new Date(`${dateStr}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return dateStr;
  return `${dateStr} (${WEEKDAYS[d.getUTCDay()]})`;
}

export type DailyReportTextOptions = {
  includeAmounts: boolean;
  includePayments: boolean;
  includeStock: boolean;
};

export type DailyReportTextInput = {
  dateStr: string;
  salesCount: number;
  salesTotal: number;
  purchaseCount: number;
  purchaseTotal: number;
  salesLines: string[];
  purchaseLines: string[];
  // null이면 권한이 없거나 데이터가 없어 글에 넣지 않는다.
  collected: number | null;
  paid: number | null;
  lowStock: { name: string; quantity: number; reorderPoint: number }[];
  options: DailyReportTextOptions;
};

function section(title: string, count: number, lines: string[]): string[] {
  if (count === 0 && lines.length === 0) return [`[${title}] 없음`];
  return [`[${title}] ${count}건`, ...lines];
}

export function buildDailyReportText(input: DailyReportTextInput): string {
  const { options } = input;
  const out: string[] = [`${formatReportDateLabel(input.dateStr)} 오늘 리포트`, ""];

  if (options.includeAmounts) {
    out.push("[금액 합계]");
    out.push(`매입 ${formatNumber(input.purchaseTotal)}원 · 매출 ${formatNumber(input.salesTotal)}원`);
    out.push("");
  }

  // 순서는 매입 → 매출(들어온 물건을 먼저, 나간 물건을 나중에) — 카톡으로 공유할 때 읽는 순서다.
  out.push(...section("매입", input.purchaseCount, input.purchaseLines));
  out.push("");
  out.push(...section("매출", input.salesCount, input.salesLines));

  if (options.includePayments && (input.collected !== null || input.paid !== null)) {
    out.push("");
    out.push("[수금·지급]");
    const parts: string[] = [];
    if (input.collected !== null) parts.push(`수금 ${formatNumber(input.collected)}원`);
    if (input.paid !== null) parts.push(`지급 ${formatNumber(input.paid)}원`);
    out.push(parts.join(" · "));
  }

  if (options.includeStock && input.lowStock.length > 0) {
    out.push("");
    out.push(`[재고 부족] ${input.lowStock.length}건`);
    for (const p of input.lowStock) {
      out.push(`- ${p.name} : 현재 ${formatNumber(p.quantity)} / 기준 ${formatNumber(p.reorderPoint)}`);
    }
  }

  return out.join("\n");
}
