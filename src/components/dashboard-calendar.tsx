"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { upsertCalendarNote } from "@/app/(dashboard)/dashboard/actions";
import { FormMessage } from "@/components/form-message";
import { getHolidayName } from "@/lib/kr-holidays";
import { useKeyShortcut } from "@/lib/use-key-shortcut";
import { formatPaperCalcSizeLines, type PaperCalcSizeRow } from "@/lib/paper-calc-summary";

export type ItemRow = {
  partnerName: string;
  productName: string;
  spec: string;
  unit: string;
  quantity: number;
  amount: number;
  orderId: string;
  remark: string | null;
  isCarryover: boolean;
};

type PaperCalcPartnerEntry = { sizes: PaperCalcSizeRow[]; totalSheet: number; amount: number };

type DayData = {
  salesCount: number;
  salesTotal: number;
  salesItems: ItemRow[];
  purchaseCount: number;
  purchaseTotal: number;
  purchaseItems: ItemRow[];
  salesPaperCalcByPartner: Record<string, PaperCalcPartnerEntry>;
  purchasePaperCalcByPartner: Record<string, PaperCalcPartnerEntry>;
  note: string;
};

type Cell = { dateStr: string; day: number } | null;

type ProductGroup = { productName: string; items: ItemRow[] };
type PartnerBlock = { partnerName: string; products: ProductGroup[]; paperCalc?: PaperCalcPartnerEntry };

// 같은 품목 아래 규격별 줄이 여러 개 나뉘어 있는 경우(예: 케이아이티솔루션
// 롤 제품처럼 관리번호별로 줄이 나뉜 경우), 모조지처럼 합계를 보여준다.
// 줄이 하나뿐이면 바로 위 줄과 똑같은 숫자가 또 나와 불필요하므로 생략한다.
function productTotals(items: ItemRow[]) {
  const quantity = items.reduce((sum, item) => sum + item.quantity, 0);
  const amount = items.reduce((sum, item) => sum + item.amount, 0);
  const unit = items[0]?.unit ?? "";
  return { quantity, amount, unit };
}

// 거래처 > 품목명 순으로 묶어서 트리 형태로 보여주기 위한 그룹핑. 목록 안에서
// 같은 거래처/품목이 여러 번 나와도 한 번만 묶어서 보여준다(처음 등장한 순서를
// 그대로 유지). 같은 품목이라도 규격이 다르면 그 아래에 규격별 줄로 나열된다.
// 모조지 계산은 거래처별로 이미 나뉘어 있으므로, 실제 품목이 없는 거래처라도
// 모조지만 있으면 그 거래처 블록을 만들어 같이 보여준다 — 어느 거래처로 나간
// 모조지인지 알 수 있어야 한다는 요구사항 때문.
function buildPartnerBlocks(
  items: ItemRow[],
  paperCalcByPartner: Record<string, PaperCalcPartnerEntry>
): PartnerBlock[] {
  const blocks: PartnerBlock[] = [];
  const partnerIndex = new Map<string, number>();
  const productIndex = new Map<string, number>();

  function ensurePartner(partnerName: string) {
    let pi = partnerIndex.get(partnerName);
    if (pi === undefined) {
      pi = blocks.length;
      partnerIndex.set(partnerName, pi);
      blocks.push({ partnerName, products: [] });
    }
    return blocks[pi];
  }

  for (const item of items) {
    const partner = ensurePartner(item.partnerName);
    const pi = partnerIndex.get(item.partnerName)!;
    const productKey = `${pi}:${item.productName}`;
    let di = productIndex.get(productKey);
    if (di === undefined) {
      di = partner.products.length;
      productIndex.set(productKey, di);
      partner.products.push({ productName: item.productName, items: [] });
    }
    partner.products[di].items.push(item);
  }

  for (const [partnerName, entry] of Object.entries(paperCalcByPartner)) {
    ensurePartner(partnerName).paperCalc = entry;
  }

  return blocks;
}

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

// 카카오톡 등에 그대로 붙여넣을 수 있게, 화면에 보이는 품목 내역을 사람이
// 읽기 편한 일반 텍스트로 옮긴다. 외부에 금액이 노출되지 않도록 수량까지만
// 담고, 단위(EA/KG 등)는 화면에만 보이고 복사 텍스트에는 숫자만 남긴다.
function appendItemLines(
  items: ItemRow[],
  paperCalcByPartner: Record<string, PaperCalcPartnerEntry>,
  paperStockProductName: string,
  lines: string[]
) {
  const blocks = buildPartnerBlocks(items, paperCalcByPartner);
  blocks.forEach((partner, i) => {
    if (i > 0) lines.push("");
    lines.push(`- ${partner.partnerName}`);
    partner.products.forEach((product, pi) => {
      if (pi > 0) lines.push("");
      lines.push(`  · ${product.productName}`);
      // 같은 품목 아래 규격/관리번호별로 줄이 여러 개 나뉜 경우(예: 롤 제품)는
      // 카톡에 줄줄이 붙여넣기엔 너무 장황하므로 합계 한 줄만 담는다. 줄이
      // 하나뿐이면 그 줄 자체가 합계이므로 그대로 보여준다.
      if (product.items.length > 1) {
        const { quantity } = productTotals(product.items);
        const anyCarryover = product.items.some((item) => item.isCarryover);
        lines.push(`    합계 - ${quantity.toLocaleString()}${anyCarryover ? " (이월)" : ""}`);
      } else {
        const item = product.items[0];
        const carryoverSuffix = item.isCarryover ? " (이월)" : "";
        lines.push(`    ${item.spec || "규격 미지정"} : ${item.quantity.toLocaleString()}${carryoverSuffix}`);
        if (item.remark) lines.push(`      (비고: ${item.remark})`);
      }
    });
    if (partner.paperCalc) {
      if (partner.products.length > 0) lines.push("");
      lines.push(`  · ${paperStockProductName}`);
      for (const line of formatPaperCalcSizeLines(partner.paperCalc.sizes)) {
        lines.push(`    ${line}`);
      }
      lines.push(`    합계 - ${partner.paperCalc.totalSheet.toLocaleString()}연`);
    }
  });
}

function buildSalesCopyText(dateStr: string, data: DayData, paperStockProductName: string) {
  const lines: string[] = [`${dateStr} 매출`, "", `[매출] ${data.salesCount}건`];
  appendItemLines(data.salesItems, data.salesPaperCalcByPartner, paperStockProductName, lines);
  return lines.join("\n");
}

function buildPurchaseCopyText(dateStr: string, data: DayData, paperStockProductName: string) {
  const lines: string[] = [`${dateStr} 매입`, "", `[매입] ${data.purchaseCount}건`];
  appendItemLines(data.purchaseItems, data.purchasePaperCalcByPartner, paperStockProductName, lines);
  return lines.join("\n");
}

async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand("copy");
    document.body.removeChild(textarea);
  }
}

function CarryoverBadge() {
  return (
    <span
      className="ml-1 inline-flex items-center rounded-full px-1.5 py-px text-[9px] font-bold"
      style={{ background: "#fff1dc", color: "#b26a00" }}
    >
      이월
    </span>
  );
}

export function DashboardCalendar({
  year,
  month,
  weeks,
  dataByDate,
  todayStr,
  prevMonthHref,
  nextMonthHref,
  backgroundLogoUrl,
  lowStockToday,
  paperStockProductName,
}: {
  year: number;
  month: number;
  weeks: Cell[][];
  dataByDate: Record<string, DayData>;
  todayStr: string;
  prevMonthHref: string;
  nextMonthHref: string;
  backgroundLogoUrl?: string | null;
  lowStockToday?: boolean;
  paperStockProductName: string;
}) {
  const router = useRouter();
  const defaultSelected = dataByDate[todayStr] !== undefined || weeks.some((w) => w.some((c) => c?.dateStr === todayStr))
    ? todayStr
    : null;
  const [selected, setSelected] = useState<string | null>(defaultSelected);
  const [copiedType, setCopiedType] = useState<"sales" | "purchase" | null>(null);

  // MidnightRefresh가 router.refresh()로 서버 데이터(todayStr 포함)를
  // 새로 받아와도, 이 상태는 처음 마운트될 때 한 번만 정해지므로 자정이
  // 지나도 그대로 남아있는다. "오늘"을 보고 있던 경우에 한해(다른 날짜를
  // 직접 선택해둔 상태라면 건드리지 않는다) 새 오늘 날짜로 따라가게 한다.
  const prevTodayStrRef = useRef(todayStr);
  useEffect(() => {
    if (prevTodayStrRef.current !== todayStr) {
      setSelected((prev) => (prev === prevTodayStrRef.current ? todayStr : prev));
      prevTodayStrRef.current = todayStr;
    }
  }, [todayStr]);

  const selectedData: DayData = (selected && dataByDate[selected]) || {
    salesCount: 0,
    salesTotal: 0,
    salesItems: [],
    purchaseCount: 0,
    purchaseTotal: 0,
    purchaseItems: [],
    salesPaperCalcByPartner: {},
    purchasePaperCalcByPartner: {},
    note: "",
  };

  async function handleCopy(type: "sales" | "purchase") {
    if (!selected) return;
    const text =
      type === "sales"
        ? buildSalesCopyText(selected, selectedData, paperStockProductName)
        : buildPurchaseCopyText(selected, selectedData, paperStockProductName);
    await copyText(text);
    setCopiedType(type);
    setTimeout(() => setCopiedType(null), 1500);
  }

  return (
    <div className="grid grid-cols-1 gap-3 lg:grid-cols-[1fr_300px]">
      <div className="relative overflow-hidden rounded-sm border border-[#d9d9d9] bg-white p-4">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={backgroundLogoUrl || "/branding/logo-mark.png"}
          alt=""
          aria-hidden
          className="pointer-events-none absolute top-1/2 left-1/2 h-64 w-64 -translate-x-1/2 -translate-y-1/2 opacity-[0.05]"
        />
        <div className="relative mb-3 flex items-center justify-between">
          <h2 className="text-sm font-bold text-[#1c1c1c]">
            {year}년 {month}월
          </h2>
          <div className="flex gap-1">
            <Link
              href={prevMonthHref}
              className="rounded-sm border border-[#d9d9d9] px-2 py-1 text-xs text-[#6b7280] hover:bg-[#f3f7fc]"
            >
              ← 이전달
            </Link>
            <Link
              href={nextMonthHref}
              className="rounded-sm border border-[#d9d9d9] px-2 py-1 text-xs text-[#6b7280] hover:bg-[#f3f7fc]"
            >
              다음달 →
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-7 gap-1 text-center text-xs">
          {WEEKDAYS.map((w, i) => (
            <div
              key={w}
              className={`py-1 ${i === 0 ? "text-[#dc3545]" : i === 6 ? "text-[#1f3b75]" : "text-[#9aa2ad]"}`}
            >
              {w}
            </div>
          ))}
        </div>

        <div className="relative grid grid-cols-7 gap-1">
          {weeks.map((week, wi) =>
            week.map((cell, di) => {
              if (!cell) {
                return <div key={`${wi}-${di}`} className="aspect-square rounded-sm" />;
              }
              const data = dataByDate[cell.dateStr];
              const isToday = cell.dateStr === todayStr;
              const isSelected = cell.dateStr === selected;
              const holidayName = getHolidayName(cell.dateStr);
              const isSunday = di === 0;
              const isSaturday = di === 6;
              const dayColorClass = isSelected
                ? "text-white"
                : holidayName
                  ? "text-[#dc3545] font-semibold"
                  : isSunday
                    ? "text-[#dc3545]"
                    : isSaturday
                      ? "text-[#1f3b75]"
                      : "text-[#1c1c1c]";
              const showLowStockDot = isToday && lowStockToday;
              const carryoverSalesCount = data?.salesItems.filter((i) => i.isCarryover).length ?? 0;
              const carryoverPurchaseCount = data?.purchaseItems.filter((i) => i.isCarryover).length ?? 0;
              const hasSalesDot = !!data?.salesCount || carryoverSalesCount > 0;
              const hasPurchaseDot = !!data?.purchaseCount || carryoverPurchaseCount > 0;
              const tooltipParts = [
                data?.salesCount ? `매출 ${data.salesCount}건` : null,
                data?.purchaseCount ? `매입 ${data.purchaseCount}건` : null,
                carryoverSalesCount ? `이월 매출 ${carryoverSalesCount}건` : null,
                carryoverPurchaseCount ? `이월 매입 ${carryoverPurchaseCount}건` : null,
                data?.note ? "메모 있음" : null,
                showLowStockDot ? "안전재고 부족" : null,
              ].filter(Boolean);
              return (
                <button
                  key={cell.dateStr}
                  type="button"
                  title={tooltipParts.length ? tooltipParts.join(" · ") : undefined}
                  onClick={() => setSelected(cell.dateStr)}
                  onDoubleClick={() => router.push(`/sales?from=${cell.dateStr}&to=${cell.dateStr}`)}
                  className={`aspect-square rounded-sm border p-1 text-left text-xs transition-colors ${
                    isSelected
                      ? "border-[#1f3b75] bg-[#1f3b75] text-white"
                      : isToday
                        ? "border-[#1f3b75] bg-[#ddebff]"
                        : "border-transparent hover:bg-[#f3f7fc]"
                  }`}
                >
                  <div className={dayColorClass}>{cell.day}</div>
                  {holidayName ? (
                    <div
                      className={`truncate text-[9px] leading-tight ${isSelected ? "text-white" : "text-[#dc3545]"}`}
                    >
                      {holidayName}
                    </div>
                  ) : null}
                  <div className="mt-0.5 flex gap-0.5">
                    {hasPurchaseDot ? (
                      <span
                        className={`h-1.5 w-1.5 rounded-full ${isSelected ? "bg-white" : "bg-[#0b57d0]"}`}
                      />
                    ) : null}
                    {hasSalesDot ? (
                      <span
                        className={`h-1.5 w-1.5 rounded-full ${isSelected ? "bg-white" : "bg-[#d31e3b]"}`}
                      />
                    ) : null}
                    {data?.note ? (
                      <span
                        className={`h-1.5 w-1.5 rounded-full ${isSelected ? "bg-white" : "bg-[#ff9800]"}`}
                      />
                    ) : null}
                    {showLowStockDot ? (
                      <span
                        className={`h-1.5 w-1.5 rounded-full ${isSelected ? "bg-white" : "bg-[#dc3545]"}`}
                      />
                    ) : null}
                  </div>
                </button>
              );
            })
          )}
        </div>

        <div className="mt-3 flex flex-wrap gap-4 text-xs text-[#6b7280]">
          <span className="flex items-center gap-1">
            <span className="h-1.5 w-1.5 rounded-full bg-[#0b57d0]" /> 매입
          </span>
          <span className="flex items-center gap-1">
            <span className="h-1.5 w-1.5 rounded-full bg-[#d31e3b]" /> 매출
          </span>
          <span className="flex items-center gap-1">
            <span className="h-1.5 w-1.5 rounded-full bg-[#ff9800]" /> 메모
          </span>
          <span className="flex items-center gap-1">
            <span className="h-1.5 w-1.5 rounded-full bg-[#dc3545]" /> 재고부족
          </span>
        </div>
      </div>

      <div className="rounded-sm border border-[#d9d9d9] bg-white p-4">
        {selected ? (
          <>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-bold text-[#1c1c1c]">{selected} 오늘의 업무</h3>
              <div className="flex shrink-0 gap-1">
                <button
                  type="button"
                  onClick={() => handleCopy("purchase")}
                  className="rounded-sm border border-[#0b57d0] bg-[#e8f0ff] px-2 py-1 text-xs font-bold text-[#0b57d0] hover:bg-[#d9e6ff]"
                >
                  {copiedType === "purchase" ? "복사됨" : "매입 복사"}
                </button>
                <button
                  type="button"
                  onClick={() => handleCopy("sales")}
                  className="rounded-sm border border-[#d31e3b] bg-[#fdeaec] px-2 py-1 text-xs font-bold text-[#d31e3b] hover:bg-[#fbd9dd]"
                >
                  {copiedType === "sales" ? "복사됨" : "매출 복사"}
                </button>
              </div>
            </div>

            <div
              className="mb-3 border-l-[3px] border-l-[#0b57d0] p-2"
              style={{ background: "linear-gradient(90deg, #e8f0ff, transparent 60%)" }}
            >
              <p className="mb-1 text-xs font-bold text-[#0b57d0]">
                매입 {selectedData.purchaseCount}건 · {selectedData.purchaseTotal.toLocaleString()}원
              </p>
              {(selectedData.purchaseItems.length > 0 ||
                Object.keys(selectedData.purchasePaperCalcByPartner).length > 0) && (
                <div className="space-y-2 text-xs font-medium text-[#0b57d0]">
                  {buildPartnerBlocks(selectedData.purchaseItems, selectedData.purchasePaperCalcByPartner).map(
                    (partner, pi) => (
                      <div key={pi}>
                        <p className="font-bold">- {partner.partnerName}</p>
                        <div className="space-y-1 pl-3">
                          {partner.products.map((product, di) => {
                            const anyCarryover = product.items.some((item) => item.isCarryover);
                            return (
                              <div key={di}>
                                <p className="font-semibold text-[#1c1c1c]">- {product.productName}</p>
                                <ul className="space-y-1 pl-3 font-normal text-[#6b7280]">
                                  {product.items.length === 1 ? (
                                    (() => {
                                      const item = product.items[0];
                                      return (
                                        <li>
                                          <Link
                                            href={`/purchases/${item.orderId}`}
                                            className="flex items-start justify-between gap-2 hover:underline"
                                          >
                                            <span className="min-w-0">
                                              {item.spec || "규격 미지정"} : {item.quantity.toLocaleString()}
                                              {item.unit}
                                              {item.isCarryover && <CarryoverBadge />}
                                              {item.remark && (
                                                <span className="block text-[10px] text-[#6b7280]/70">
                                                  비고: {item.remark}
                                                </span>
                                              )}
                                            </span>
                                            <span className="shrink-0">{item.amount.toLocaleString()}원</span>
                                          </Link>
                                        </li>
                                      );
                                    })()
                                  ) : (
                                    <>
                                      {product.items.map((item, i) => (
                                        <li key={i}>
                                          <Link
                                            href={`/purchases/${item.orderId}`}
                                            className="flex items-start justify-between gap-2 hover:underline"
                                          >
                                            <span className="min-w-0">
                                              {item.spec || "규격 미지정"} : {item.quantity.toLocaleString()}
                                              {item.unit}
                                              {item.remark && (
                                                <span className="block text-[10px] text-[#6b7280]/70">
                                                  비고: {item.remark}
                                                </span>
                                              )}
                                            </span>
                                            <span className="shrink-0">{item.amount.toLocaleString()}원</span>
                                          </Link>
                                        </li>
                                      ))}
                                      {(() => {
                                        const totals = productTotals(product.items);
                                        return (
                                          <li className="flex items-start justify-between gap-2">
                                            <span className="min-w-0">
                                              합계 - {totals.quantity.toLocaleString()}
                                              {totals.unit}
                                              {anyCarryover && <CarryoverBadge />}
                                            </span>
                                            <span className="shrink-0">{totals.amount.toLocaleString()}원</span>
                                          </li>
                                        );
                                      })()}
                                    </>
                                  )}
                                </ul>
                              </div>
                            );
                          })}
                          {partner.paperCalc && (
                            <div>
                              <p className="font-semibold text-[#1c1c1c]">- {paperStockProductName}</p>
                              <ul className="space-y-1 pl-3 font-normal text-[#6b7280]">
                                {formatPaperCalcSizeLines(partner.paperCalc.sizes).map((line, i) => (
                                  <li key={i}>{line}</li>
                                ))}
                                <li className="flex items-start justify-between gap-2 text-[#0b57d0]">
                                  <span className="min-w-0">
                                    합계 - {partner.paperCalc.totalSheet.toLocaleString()}연
                                  </span>
                                  <span className="shrink-0">
                                    {partner.paperCalc.amount.toLocaleString()}원
                                  </span>
                                </li>
                              </ul>
                            </div>
                          )}
                        </div>
                      </div>
                    )
                  )}
                </div>
              )}
            </div>

            <div
              className="mb-4 border-l-[3px] border-l-[#d31e3b] p-2"
              style={{ background: "linear-gradient(90deg, #fdeaec, transparent 60%)" }}
            >
              <p className="mb-1 text-xs font-bold text-[#d31e3b]">
                매출 {selectedData.salesCount}건 · {selectedData.salesTotal.toLocaleString()}원
              </p>
              {(selectedData.salesItems.length > 0 ||
                Object.keys(selectedData.salesPaperCalcByPartner).length > 0) && (
                <div className="space-y-2 text-xs font-medium text-[#d31e3b]">
                  {buildPartnerBlocks(selectedData.salesItems, selectedData.salesPaperCalcByPartner).map(
                    (partner, pi) => (
                      <div key={pi}>
                        <p className="font-bold">- {partner.partnerName}</p>
                        <div className="space-y-1 pl-3">
                          {partner.products.map((product, di) => {
                            const anyCarryover = product.items.some((item) => item.isCarryover);
                            return (
                              <div key={di}>
                                <p className="font-semibold text-[#1c1c1c]">- {product.productName}</p>
                                <ul className="space-y-1 pl-3 font-normal text-[#6b7280]">
                                  {product.items.length === 1 ? (
                                    (() => {
                                      const item = product.items[0];
                                      return (
                                        <li>
                                          <Link
                                            href={`/sales/${item.orderId}`}
                                            className="flex items-start justify-between gap-2 hover:underline"
                                          >
                                            <span className="min-w-0">
                                              {item.spec || "규격 미지정"} : {item.quantity.toLocaleString()}
                                              {item.unit}
                                              {item.isCarryover && <CarryoverBadge />}
                                              {item.remark && (
                                                <span className="block text-[10px] text-[#6b7280]/70">
                                                  비고: {item.remark}
                                                </span>
                                              )}
                                            </span>
                                            <span className="shrink-0">{item.amount.toLocaleString()}원</span>
                                          </Link>
                                        </li>
                                      );
                                    })()
                                  ) : (
                                    <>
                                      {product.items.map((item, i) => (
                                        <li key={i}>
                                          <Link
                                            href={`/sales/${item.orderId}`}
                                            className="flex items-start justify-between gap-2 hover:underline"
                                          >
                                            <span className="min-w-0">
                                              {item.spec || "규격 미지정"} : {item.quantity.toLocaleString()}
                                              {item.unit}
                                              {item.remark && (
                                                <span className="block text-[10px] text-[#6b7280]/70">
                                                  비고: {item.remark}
                                                </span>
                                              )}
                                            </span>
                                            <span className="shrink-0">{item.amount.toLocaleString()}원</span>
                                          </Link>
                                        </li>
                                      ))}
                                      {(() => {
                                        const totals = productTotals(product.items);
                                        return (
                                          <li className="flex items-start justify-between gap-2">
                                            <span className="min-w-0">
                                              합계 - {totals.quantity.toLocaleString()}
                                              {totals.unit}
                                              {anyCarryover && <CarryoverBadge />}
                                            </span>
                                            <span className="shrink-0">{totals.amount.toLocaleString()}원</span>
                                          </li>
                                        );
                                      })()}
                                    </>
                                  )}
                                </ul>
                              </div>
                            );
                          })}
                          {partner.paperCalc && (
                            <div>
                              <p className="font-semibold text-[#1c1c1c]">- {paperStockProductName}</p>
                              <ul className="space-y-1 pl-3 font-normal text-[#6b7280]">
                                {formatPaperCalcSizeLines(partner.paperCalc.sizes).map((line, i) => (
                                  <li key={i}>{line}</li>
                                ))}
                                <li className="flex items-start justify-between gap-2 text-[#d31e3b]">
                                  <span className="min-w-0">
                                    합계 - {partner.paperCalc.totalSheet.toLocaleString()}연
                                  </span>
                                  <span className="shrink-0">
                                    {partner.paperCalc.amount.toLocaleString()}원
                                  </span>
                                </li>
                              </ul>
                            </div>
                          )}
                        </div>
                      </div>
                    )
                  )}
                </div>
              )}
            </div>

            <NoteForm dateStr={selected} initialContent={selectedData.note} />
          </>
        ) : (
          <p className="text-sm text-[#9aa2ad]">날짜를 선택해주세요.</p>
        )}
      </div>
    </div>
  );
}

function NoteForm({ dateStr, initialContent }: { dateStr: string; initialContent: string }) {
  const [state, formAction, pending] = useActionState(upsertCalendarNote, undefined);
  const submitRef = useRef<HTMLButtonElement>(null);
  useKeyShortcut("F7", submitRef);

  return (
    <form action={formAction} key={dateStr} className="space-y-2">
      <input type="hidden" name="note_date" value={dateStr} />
      <label className="block text-xs font-medium" style={{ color: "var(--erp-text-muted)" }}>
        메모
      </label>
      <textarea
        name="content"
        defaultValue={initialContent}
        rows={4}
        placeholder="이 날짜에 대한 메모를 남겨보세요"
        className="erp-input w-full"
        style={{ height: "auto" }}
      />
      <button ref={submitRef} type="submit" disabled={pending} className="erp-btn erp-btn-primary">
        {pending ? (
          <>
            <span className="erp-spinner" aria-hidden /> 저장 중...
          </>
        ) : (
          "F7 메모 저장"
        )}
      </button>
      <FormMessage state={state} />
    </form>
  );
}
