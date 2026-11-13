"use client";

import {
  useActionState,
  useCallback,
  useEffect,
  useRef,
  useState,
  useTransition,
  type ReactNode,
} from "react";
import {
  DailyReportBox, defaultReportDate,
  type ReportLowStock, type ReportMonthTotals, type ReportMoney,
} from "@/components/daily-report-box";
import Link from "next/link";
import { DashboardWidgetGrid } from "@/components/dashboard-widget-grid";
import type { DashboardLayout, DashboardWidgetId } from "@/lib/dashboard-layout";
import type { SourceId } from "@/lib/dashboard-sources";
import { useRouter } from "next/navigation";
import {
  addCalendarNote,
  deleteCalendarNote,
} from "@/app/(dashboard)/dashboard/actions";
import { FormMessage } from "@/components/form-message";
import { getHolidayName } from "@/lib/kr-holidays";
import { useKeyShortcut } from "@/lib/use-key-shortcut";
import { useConfirmTwice } from "@/lib/use-confirm-twice";
import { canManage } from "@/lib/can-manage";
import { startRouteProgress } from "@/lib/route-progress";
import {
  formatPaperCalcSizeLines,
  type PaperCalcSizeRow,
} from "@/modules/paper-calc/public";
import { formatBoxCount, formatQuantityWithBoxes } from "@/lib/package-qty";
import type { CalendarItem } from "@/lib/calendar-data";
import { formatNumber } from "@/lib/format-number";
import { bandsTooltip, buildDayBands } from "@/lib/calendar-bands";

export type ItemRow = {
  partnerName: string;
  productName: string;
  categoryName: string | null;
  sku: string | null;
  spec: string;
  unit: string;
  quantity: number;
  basePackageQty: number | null;
  amount: number;
  orderId: string;
  itemId: string;
  remark: string | null;
  isCarryover: boolean;
  // 반품 건이면 amount가 이미 음수로 뒤집혀 들어온다(dashboard/page.tsx
  // 참고) — 여기서는 표시용 배지/부호만 추가로 붙인다.
  isReturn: boolean;
  // fifo_consumptions(실제 소진 이력) 기준으로 dashboard/page.tsx에서
  // 미리 계산해 채워주는 값 — 매입 품목이 오늘 실제로 어느 거래처로
  // 나갔는지(realDestinations), 매출 품목 중 재고(과거 매입분)에서 실제로
  // 나간 수량(stockConsumedQuantity). 품목+규격+수량만 보고 "아마 같은
  // 거래"로 짐작하던 예전 추정 매칭 대신 이 진짜 데이터로 라벨을 붙인다.
  realDestinations: { partnerName: string; quantity: number }[];
  stockConsumedQuantity: number;
};

type PaperCalcPartnerEntry = {
  sizes: PaperCalcSizeRow[];
  totalSheet: number;
  amount: number;
};

// 이월 건의 전표날짜 쪽 캘린더에 "다른 날 작업분이 여기로 이월되어
// 왔다"고 표시하기 위한 요약(page.tsx의 같은 이름 타입 참고).
type CarryoverInSummary = { fromDate: string; itemCount: number };

type DayData = {
  salesCount: number;
  salesTotal: number;
  salesItems: ItemRow[];
  purchaseCount: number;
  purchaseTotal: number;
  purchaseItems: ItemRow[];
  salesPaperCalcByPartner: Record<string, PaperCalcPartnerEntry>;
  purchasePaperCalcByPartner: Record<string, PaperCalcPartnerEntry>;
  carryoverInSales: CarryoverInSummary[];
  carryoverInPurchases: CarryoverInSummary[];
  notes: {
    id: string;
    authorName: string;
    content: string;
    createdAt: string;
    createdBy: string | null;
  }[];
  // 회사 캘린더(/calendar)의 회의·기타 일정 + 승인된 연차를 그대로
  // 재사용한다 — 대시보드 전용 데이터를 따로 만들면 캘린더 화면과
  // 어긋날 수 있어, src/lib/calendar-data.ts의 같은 타입/조회 함수를 쓴다.
  calendarItems: CalendarItem[];
  // 이 날 마감인 할 일(아직 안 끝난 것) — 달력 칸에 주황 띠로 보인다
  todoItems: { id: string; title: string }[];
};

// 달력 아래 범례 — 칸 안 띠·점의 색과 같은 종류 이름
const CAL_LEGEND: [string, string][] = [
  ["sales", "매출"],
  ["purchase", "매입"],
  ["todo", "할 일"],
  ["event", "일정·휴가"],
  ["stock", "재고 부족(오늘)"],
  ["note", "메모·이월"],
];

type Cell = { dateStr: string; day: number } | null;

export type ProductGroup = { productName: string; items: ItemRow[] };
type PaperCalcBlock = {
  label: string | null;
  sizes: PaperCalcSizeRow[];
  totalSheet: number;
  amount: number;
};
type PartnerBlock = {
  partnerName: string;
  products: ProductGroup[];
  paperCalcBlocks: PaperCalcBlock[];
};

// 같은 품목 아래 규격별 줄이 여러 개 나뉘어 있는 경우(예: 케이아이티솔루션
// 롤 제품처럼 관리번호별로 줄이 나뉜 경우), 모조지처럼 합계를 보여준다.
// 줄이 하나뿐이면 바로 위 줄과 똑같은 숫자가 또 나와 불필요하므로 생략한다.
function productTotals(items: ItemRow[]) {
  const quantity = items.reduce((sum, item) => sum + item.quantity, 0);
  const amount = items.reduce((sum, item) => sum + item.amount, 0);
  const unit = items[0]?.unit ?? "";
  return { quantity, amount, unit };
}

// 커버테이프처럼 관리번호(롯)별로 줄이 나뉘어 있어도 규격 자체는 전부
// 똑같은 경우, 카톡 복사 텍스트에서는 그 규격을 여러 번 반복해서 보여줄
// 필요가 없다 — 규격 하나에 합계 수량만 보여주면 충분하다. 규격이 실제로
// 다른 품목(사이즈가 여러 종류인 경우)은 그대로 규격별로 나눠서 보여준다.
// 반품은 수량이 정상 매출/매입과 반대 의미(나간 게 아니라 되돌아온
// 것)라, 같은 규격이라도 정상 건과 한 줄로 합치면 안 된다 — 합치면
// "정상 10개 + 반품 3개"가 합계 13개짜리 "전량 반품" 줄처럼 보이는
// 사고가 난다.
function groupItemsBySpec(items: ItemRow[]) {
  const order: string[] = [];
  const bySpec = new Map<string, ItemRow[]>();
  for (const item of items) {
    const spec = item.spec || "규격 미지정";
    const key = item.isReturn ? `${spec}|반품` : spec;
    if (!bySpec.has(key)) {
      order.push(key);
      bySpec.set(key, []);
    }
    bySpec.get(key)!.push(item);
  }
  return order.map((key) => {
    const groupItems = bySpec.get(key)!;
    return { spec: groupItems[0].spec || "규격 미지정", items: groupItems };
  });
}

// 거래처 > 품목명 순으로 묶어서 트리 형태로 보여주기 위한 그룹핑. 목록 안에서
// 같은 거래처/품목이 여러 번 나와도 한 번만 묶어서 보여준다(처음 등장한 순서를
// 그대로 유지). 같은 품목이라도 규격이 다르면 그 아래에 규격별 줄로 나열된다.
// 모조지 계산은 거래처별로 이미 나뉘어 있으므로, 실제 품목이 없는 거래처라도
// 모조지만 있으면 그 거래처 블록을 만들어 같이 보여준다 — 어느 거래처로 나간
// 모조지인지 알 수 있어야 한다는 요구사항 때문.
// 같은 공급처에서 오늘 산 모조지 원지라도, 실제로는 서로 다른 거래처
// 주문을 위해 각각 재단된 것일 수 있다(공급처 쪽엔 거래처 구분이 없지만,
// 매출 쪽 모조지 계산은 거래처별로 이미 나뉘어 있다). 사이즈(가로×세로)를
// 열쇠 삼아 매입 쪽 합산 사이즈를, 오늘 매출 쪽 거래처별 모조지 계산과
// 대조해서 원래 어느 거래처 몫이었는지 되짚어 나눈다. 모조지는 품목 단위로
// fifo_consumptions를 안 쌓아서(원지 투입량 계산이라 별도 집계) 일반 품목처럼
// 실제 소진 이력으로 맞춰볼 수 없어, 여기만 사이즈 매칭으로 추정한다. 어느
// 거래처 것으로도 안 잡히고 남는 사이즈는 "재고용 매입"으로 묶는다.
function splitPaperCalcByDestination(
  entry: PaperCalcPartnerEntry,
  otherSidePaperCalcByPartner: Record<string, PaperCalcPartnerEntry>,
): PaperCalcBlock[] {
  const remaining = new Map<string, number>();
  for (const size of entry.sizes) {
    const key = `${size.width}x${size.height}`;
    remaining.set(key, (remaining.get(key) ?? 0) + size.qty);
  }

  // sizes 안의 qty는 "몇 장을 잘라내는지"(생산 수량)이지 "원지를 몇 연
  // 썼는지"(totalSheet)가 아니다 — 배치 효율에 따라 둘이 다르므로, 조각
  // 수량 비율로 연수를 나누면 안 된다. 거래처 몫이 사이즈 그대로 전부
  // 확보되면(부분 매칭이 아니면) 그 거래처 자신의 모조지 계산이 이미
  // 정확한 totalSheet를 갖고 있으니 그 값을 그대로 쓴다. 일부만 확보되는
  // 드문 경우에만 조각 수량 비율로 근사한다.
  const blocks: PaperCalcBlock[] = [];
  let allocatedSheets = 0;
  for (const [partnerName, otherEntry] of Object.entries(otherSidePaperCalcByPartner)) {
    const matchedSizes: PaperCalcSizeRow[] = [];
    let matchedPieceQty = 0;
    let fullyMatched = true;
    for (const size of otherEntry.sizes) {
      const key = `${size.width}x${size.height}`;
      const available = remaining.get(key) ?? 0;
      const take = Math.min(available, size.qty);
      if (take < size.qty) fullyMatched = false;
      if (take <= 0) continue;
      matchedSizes.push({ width: size.width, height: size.height, qty: take });
      matchedPieceQty += take;
      remaining.set(key, available - take);
    }
    if (!matchedSizes.length) continue;
    const otherPieceQty = otherEntry.sizes.reduce((sum, s) => sum + s.qty, 0);
    const totalSheet = fullyMatched
      ? otherEntry.totalSheet
      : otherPieceQty > 0
        ? Math.round((otherEntry.totalSheet * matchedPieceQty) / otherPieceQty)
        : 0;
    allocatedSheets += totalSheet;
    blocks.push({
      label: partnerName,
      sizes: matchedSizes,
      totalSheet,
      amount: entry.totalSheet > 0 ? Math.round((entry.amount * totalSheet) / entry.totalSheet) : 0,
    });
  }

  // remaining에는 어느 거래처 몫으로도 안 잡히고 남은 사이즈별 수량이
  // 그대로 남아있다 — 사이즈(가로×세로) 하나당 한 번씩만 담는다.
  const seenKeys = new Set<string>();
  const leftoverSizes: PaperCalcSizeRow[] = [];
  for (const size of entry.sizes) {
    const key = `${size.width}x${size.height}`;
    if (seenKeys.has(key)) continue;
    seenKeys.add(key);
    const left = remaining.get(key) ?? 0;
    if (left > 0) leftoverSizes.push({ width: size.width, height: size.height, qty: left });
  }

  const leftoverSheets = Math.max(entry.totalSheet - allocatedSheets, 0);
  if (leftoverSizes.length || leftoverSheets > 0) {
    blocks.push({
      // 재고 몫도 라벨 없이 그대로 보여준다("재고용" 표기는 쓰지 않음).
      label: null,
      sizes: leftoverSizes,
      totalSheet: leftoverSheets,
      amount: entry.totalSheet > 0 ? Math.round((entry.amount * leftoverSheets) / entry.totalSheet) : 0,
    });
  }

  return blocks;
}

function buildPartnerBlocks(
  items: ItemRow[],
  paperCalcByPartner: Record<string, PaperCalcPartnerEntry>,
  otherSidePaperCalcByPartner?: Record<string, PaperCalcPartnerEntry>,
): PartnerBlock[] {
  const blocks: PartnerBlock[] = [];
  const partnerIndex = new Map<string, number>();
  const productIndex = new Map<string, number>();

  function ensurePartner(partnerName: string) {
    let pi = partnerIndex.get(partnerName);
    if (pi === undefined) {
      pi = blocks.length;
      partnerIndex.set(partnerName, pi);
      blocks.push({ partnerName, products: [], paperCalcBlocks: [] });
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
    ensurePartner(partnerName).paperCalcBlocks = otherSidePaperCalcByPartner
      ? splitPaperCalcByDestination(entry, otherSidePaperCalcByPartner)
      : [{ label: null, sizes: entry.sizes, totalSheet: entry.totalSheet, amount: entry.amount }];
  }

  return blocks;
}

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

const STOCK_PURCHASE_LABEL = "재고용 매입";

// 카테고리는 Paper/Material/Tray/Bobbin/Filter/Etc 여섯 가지이고, 이 중
// Filter만 매입-매출 매칭(입고처/출고처/재고분출고 추적) 대상에서 뺀다 —
// Filter는 개별 규격/거래처가 다양해서 같은 날 사고파는 매칭 정보가
// 실무에 큰 의미가 없다는 판단. 나머지 다섯 카테고리는 전부 추적한다.
// 카테고리가 아예 없는(null) 품목은 안전하게 미추적으로 둔다.
const UNTRACKED_CATEGORY_NAMES = new Set(["Filter"]);
function isTrackedCategory(categoryName: string | null): boolean {
  return categoryName !== null && !UNTRACKED_CATEGORY_NAMES.has(categoryName);
}

// 예전엔 대괄호로 목적지를 감쌌는데(회사명 자체에 이미 "(주)"처럼 괄호가
// 들어있는 경우가 많아 구분하려던 것), 콜론이 어떤 회사명과도 안 겹치면서
// 더 읽기 편하다는 피드백으로 "품목명 : 목적지" 형태로 바꿨다. 재고로
// 남는 몫과 실제 거래처로 나간 몫 모두 같은 형식을 쓴다 — 라벨 글자
// 자체("재고용 매입"/"재고분 출고" vs 실제 거래처명)로 이미 구분된다.
function formatDestinationLabel(label: string): string {
  return `: ${label}`;
}

// 매입 품목들(같은 품목+규격으로 묶인 specGroup)이 fifo_consumptions 기준으로
// 오늘 실제로 어느 거래처로 나갔는지를 합산한다. 거래처별로 안 잡힌 나머지는
// "재고용 매입"이라는 가상의 목적지로 채워 넣는다 — groupProductItemsByLabel이
// 실제 거래처 몫과 재고 몫을 구분해 나눌 수 있게 한다. 품목+규격+수량을 보고
// "아마 같은 거래"로 짐작하던 예전 추정 매칭과 달리, 각 item이 이미 자기 자신의
// 진짜 소진 이력(realDestinations)을 갖고 있어 다른 품목/날짜와 섞일 일이 없다.
function realDestinationsForItems(items: ItemRow[]): { partnerName: string; quantity: number }[] {
  const byPartner = new Map<string, number>();
  let matchedTotal = 0;
  for (const item of items) {
    for (const d of item.realDestinations) {
      byPartner.set(d.partnerName, (byPartner.get(d.partnerName) ?? 0) + d.quantity);
      matchedTotal += d.quantity;
    }
  }
  const destinations = Array.from(byPartner, ([partnerName, quantity]) => ({ partnerName, quantity }));
  const totalQuantity = items.reduce((sum, it) => sum + it.quantity, 0);
  const leftover = totalQuantity - matchedTotal;
  if (leftover > 0) destinations.push({ partnerName: STOCK_PURCHASE_LABEL, quantity: leftover });
  return destinations;
}

// 규격 하나의 원본 항목들에서 앞에서부터 quantity만큼만 잘라낸다. 경계에
// 걸친 항목은 두 조각으로 나뉘고, 금액은 수량 비율대로 쪼갠다 — 이 파일
// 안에서 이미 쓰고 있는 방식(splitPaperCalcByDestination)과 같은 원리다.
// 실제로 어느 물리적 항목이 어느 목적지로 갔는지는 알 방법이 없으니(예:
// 롯 번호별로 나뉜 줄), 목록 순서대로 우선 채운다는 표시상의 규칙이다.
function takeItems(items: ItemRow[], quantity: number): { taken: ItemRow[]; rest: ItemRow[] } {
  const taken: ItemRow[] = [];
  const rest: ItemRow[] = [];
  let remaining = quantity;
  for (const item of items) {
    if (remaining <= 0) {
      rest.push(item);
      continue;
    }
    if (item.quantity <= remaining) {
      taken.push(item);
      remaining -= item.quantity;
    } else {
      const takeQty = remaining;
      const takeAmount = Math.round((item.amount * takeQty) / item.quantity);
      taken.push({ ...item, quantity: takeQty, amount: takeAmount });
      rest.push({ ...item, quantity: item.quantity - takeQty, amount: item.amount - takeAmount });
      remaining = 0;
    }
  }
  return { taken, rest };
}

type LineGroup = {
  label: string | null;
  lines: string[];
  specCount: number;
  totalQuantity: number;
  unit: string;
};

export type LabeledItem = { item: ItemRow; note: string | null };
export type ItemLabelGroup = { label: string | null; items: LabeledItem[] };

// 한 품목 안의 규격들을, 목적지(또는 재고 여부)별로 묶는다. 규격 하나가
// 통째로 한 거래처(또는 재고)로만 갔으면 그 그룹 하나로, 일부는 거래처로
// 나머지는 재고로 나뉘면 실제로 나간 만큼만 그 거래처 그룹에 넣고(남는
// 몫은 그 줄에 "(NNN는 출고 후 남은재고)" 메모로만 붙인다 — 재고 그룹 자체의 합계에는
// 안 섞여서, "전량 재고로 남은 규격들끼리의 합"이라는 의미가 흐려지지
// 않는다). 카톡복사 텍스트(buildProductLineGroups)와 화면 표시(대시보드
// 오늘의 업무 패널)가 이 그룹핑을 그대로 같이 쓴다 — 문자열이 아니라
// 원본 ItemRow를 담아서, 화면 쪽은 항목별 링크·금액을 그대로 보여줄 수
// 있다.
export function groupProductItemsByLabel(
  product: ProductGroup,
  direction: "purchase" | "sale",
): ItemLabelGroup[] {
  const groups: ItemLabelGroup[] = [];
  const indexByKey = new Map<string, number>();

  function bucket(label: string | null): ItemLabelGroup {
    const key = label ?? "";
    let idx = indexByKey.get(key);
    if (idx === undefined) {
      idx = groups.length;
      indexByKey.set(key, idx);
      groups.push({ label, items: [] });
    }
    return groups[idx];
  }

  // 재고 몫(재고용 매입/재고분 출고로 분류되던 몫)은 "재고용"/"재고분"
  // 라벨만 없애고 항목 자체는 라벨 없는 일반 그룹으로 그대로 보여준다.
  // (예전엔 항목째 숨겨서 재고에서 나간 매출/매입이 통째로 안 뜨는
  // 문제가 있었다 — 사용자 요청은 "표기를 없애라"이지 "내역을 숨겨라"가
  // 아니다.)
  function push(label: string | null, items: ItemRow[]) {
    if (!items.length) return;
    bucket(label).items.push(...items.map((item) => ({ item, note: null })));
  }

  // Filter 카테고리(또는 카테고리 미지정)면 매입-매출 매칭 자체를 안 하고
  // 있는 그대로 한 그룹으로만 보여준다(isTrackedCategory 위 주석 참고).
  const isTracked = isTrackedCategory(product.items[0]?.categoryName ?? null);

  for (const specGroup of groupItemsBySpec(product.items)) {
    if (!isTracked) {
      push(null, specGroup.items);
      continue;
    }

    if (direction === "purchase") {
      const real = realDestinationsForItems(specGroup.items).filter(
        (d) => d.partnerName !== STOCK_PURCHASE_LABEL,
      );

      if (!real.length) {
        push(null, specGroup.items);
        continue;
      }

      let remaining = specGroup.items;
      for (const d of real) {
        const { taken, rest } = takeItems(remaining, d.quantity);
        remaining = rest;
        push(d.partnerName, taken);
      }
      // 거래처로 안 나간 나머지(재고로 남은 몫)도 라벨 없이 그대로 보여준다.
      push(null, remaining);
    } else {
      // 매출은 재고분/당일매입분 구분 없이 한 그룹으로 보여준다.
      push(null, specGroup.items);
    }
  }

  return groups;
}

// 라벨별로 묶인 항목들을, 카톡복사 텍스트로 쓸 수 있게 규격:수량 줄로
// 다시 펼친다. 화면(productTotals)과 동일하게, 규격 줄이 2개 이상인
// 그룹에는 맨 아래에 합계를 붙인다 — 줄이 하나뿐이면 바로 위 줄과 같은
// 숫자가 또 나와 불필요하므로 생략한다.

// 규격이 "1㎛ * 250mm"처럼 "A * B" 곱셈 형태면, 등록된 순서 그대로
// 나열했을 때 뒤쪽 숫자(예: 250/500/750mm)가 뒤섞여 나온다 — "250은
// 250끼리, 500은 500끼리" 묶어서 보고 싶다는 요청. "*" 뒤쪽 숫자를
// 기준으로 오름차순 정렬하고, 뒤쪽 숫자가 같으면 앞쪽 숫자로 다시
// 오름차순 정렬한다. 규격 중 하나라도 "숫자 * 숫자" 형태가 아니면
// 정렬 기준을 알 수 없으므로 원래 순서 그대로 둔다.
//
// "G1㎛ * 250mm"처럼 등급 표기(G)가 숫자 앞에 붙는 규격도 있어서, 맨 앞
// 비숫자 글자는 건너뛰고 첫 숫자부터 찾는다 — 안 그러면 이 규격 하나
// 때문에 매칭 자체가 실패해서 전체 그룹이 정렬 없이 원래 순서로
// 되돌아간다(실제로 100㎛이 1㎛보다 먼저 나오는 문제로 나타났다).
function parseSpecTrailingNumber(spec: string): { left: number; right: number } | null {
  const m = spec.match(/^[^\d]*?(\d+(?:\.\d+)?)[^\d*]*\*\s*(\d+(?:\.\d+)?)/);
  return m ? { left: Number(m[1]), right: Number(m[2]) } : null;
}

// 카톡 복사 텍스트뿐 아니라 화면(오늘의 업무 패널)에도 똑같이 써야 한다 —
// 예전에 "화면에 보이는 순서와 복사한 텍스트 순서가 다르다"는 문제를
// 한 번 고쳤는데(이 함수를 카톡 복사 쪽에만 적용하면서) 화면 렌더링
// 쪽은 못 맞춰서 다시 어긋났었다. items 자체를 정렬하려면 getSpec으로
// 규격 문자열을 꺼내는 함수를 넘긴다.
export function sortBySpecTrailingNumber<T>(items: T[], getSpec: (item: T) => string): T[] {
  const parsed = items.map((item) => {
    const n = parseSpecTrailingNumber(getSpec(item));
    return n ? { item, ...n } : null;
  });
  if (parsed.some((p) => p === null)) return items;
  return parsed
    .map((p) => p!)
    .sort((a, b) => a.right - b.right || a.left - b.left)
    .map((p) => p.item);
}

export function sortSpecsByTrailingNumber(specs: string[]): string[] {
  return sortBySpecTrailingNumber(specs, (spec) => spec);
}

// Filter 카테고리 품목은 카톡 복사 텍스트에서 단위 기호("㎛"/"mm")를 빼고
// 숫자만 남긴다("1㎛ * 250mm" -> "1 * 250") — 화면 표시는 그대로 두고
// 복사 텍스트에서만 적용한다.
export function stripFilterUnitsForCopy(spec: string, categoryName: string | null): string {
  if (categoryName !== "Filter") return spec;
  return spec.replace(/㎛/g, "").replace(/mm/g, "").replace(/\s+/g, " ").trim();
}

// 전체 품목에서 박스 수 표기를 빼는 거래처 — 품목/카테고리 조건 없이
// 무조건 뺀다.
const STRIP_BOX_COUNT_ALWAYS = new Set([
  "신일베스텍",
  "(주)에이티씨",
  "(주)타이거일렉",
  "WOTE",
  "이온하이텍",
  "태창",
]);

// 원지류(낱장/연 단위로 세는 종이)는 거래처와 무관하게 박스 수 표기 자체가
// 의미가 없어서 품목명 기준으로 뺀다.
const STRIP_BOX_COUNT_PRODUCT_KEYWORDS = ["크라프트지", "모조지", "아트지", "무진지", "내층간지"];

// 대시보드 "오늘의 업무" 패널은(카톡복사 텍스트와 달리) 원래 박스 수를 전혀
// 안 보여줬는데, 수량/단위 뒤에 포장수량("500 EA (10박스)")을 새로 붙여달라는
// 요청 — 단, 원지류(위 키워드)와 MATERIAL 카테고리 품목은 낱장/연/kg 단위로
// 세고 '박스'라는 포장단위 자체가 의미가 없어서 그대로 뺀다. 카톡복사 쪽
// shouldStripBoxCountForCopy의 거래처별/SKU별 예외(STRIP_BOX_COUNT_ALWAYS,
// 나영식테크)는 이 화면 표기 요구사항엔 포함되지 않아 여기선 쓰지 않는다.
export function shouldShowBoxCountOnDashboard(productName: string, categoryName: string | null): boolean {
  if (categoryName?.toLowerCase() === "material") return false;
  if (STRIP_BOX_COUNT_PRODUCT_KEYWORDS.some((kw) => productName.includes(kw))) return false;
  return true;
}

// 거래처별로 카톡복사 텍스트에서 박스 수 표기("(N박스)")를 빼달라는 요청 —
// 화면 표시는 그대로 두고 복사 텍스트에서만 적용한다(stripFilterUnitsForCopy와
// 동일한 방식). 거래처 이름은 오타 없이 정확히 일치해야 하고, SKU/카테고리
// 비교는 표기 차이(대소문자 등)에 안 걸리게 대소문자 구분 없이 비교한다.
export function shouldStripBoxCountForCopy(
  customerName: string,
  sku: string | null,
  categoryName: string | null,
  productName: string | null = null,
): boolean {
  if (STRIP_BOX_COUNT_ALWAYS.has(customerName)) return true;
  if (productName && STRIP_BOX_COUNT_PRODUCT_KEYWORDS.some((kw) => productName.includes(kw))) return true;
  if (customerName === "나영식테크") {
    const upperSku = sku?.toUpperCase() ?? "";
    if (upperSku === "ST1" || upperSku === "FM") return true;
    if (categoryName?.toLowerCase() === "bobbin") return true;
  }
  return false;
}

function buildProductLineGroups(product: ProductGroup, direction: "purchase" | "sale"): LineGroup[] {
  return groupProductItemsByLabel(product, direction).map(({ label, items }) => {
    const group: LineGroup = {
      label,
      lines: [],
      specCount: 0,
      totalQuantity: 0,
      unit: items[0]?.item.unit ?? "",
    };

    const order: string[] = [];
    const bySpec = new Map<string, LabeledItem[]>();
    for (const li of items) {
      const key = li.item.spec || "규격 미지정";
      if (!bySpec.has(key)) {
        order.push(key);
        bySpec.set(key, []);
      }
      bySpec.get(key)!.push(li);
    }

    const sortedOrder = sortSpecsByTrailingNumber(order);

    for (const spec of sortedOrder) {
      const lis = bySpec.get(spec)!;
      const quantity = lis.reduce((sum, li) => sum + li.item.quantity, 0);
      const unit = lis[0]?.item.unit ?? "";
      const categoryName = lis[0]?.item.categoryName ?? null;
      const sku = lis[0]?.item.sku ?? null;
      const customerName = lis[0]?.item.partnerName ?? "";
      const basePackageQty = shouldStripBoxCountForCopy(customerName, sku, categoryName, product.productName)
        ? null
        : (lis[0]?.item.basePackageQty ?? null);
      const isReturn = lis.some((li) => li.item.isReturn);
      const carryoverSuffix = lis.some((li) => li.item.isCarryover) ? " (이월)" : "";
      const returnSuffix = isReturn ? " (반품)" : "";
      const note = lis.map((li) => li.note).find((n) => n) ?? null;
      const noteSuffix = note ? ` (${note})` : "";
      const displaySpec = stripFilterUnitsForCopy(spec, categoryName);

      group.lines.push(
        `    ${displaySpec} : ${formatQuantityWithBoxes(quantity, basePackageQty, unit)}${carryoverSuffix}${returnSuffix}${noteSuffix}`,
      );
      group.specCount += 1;
      group.totalQuantity += quantity;
      group.unit = unit;
      for (const li of lis) {
        if (li.item.remark) group.lines.push(`      (비고: ${li.item.remark})`);
      }
    }

    if (group.specCount > 1) {
      group.lines.push(`    합계 - ${formatNumber(group.totalQuantity)}${group.unit}`);
    }

    return group;
  });
}

// 카카오톡 등에 그대로 붙여넣을 수 있게, 화면에 보이는 품목 내역을 사람이
// 읽기 편한 일반 텍스트로 옮긴다. 외부에 금액이 노출되지 않도록 수량까지만
// 담고, 단위(EA/KG 등)는 화면에만 보이고 복사 텍스트에는 숫자만 남긴다.
// direction이 "purchase"면 품목이 어느 거래처로 나갔는지(또는 재고용
// 매입인지)를 품목명 옆 괄호로 묶어서 보여주고, "sale"이면 반대로 당일
// 매입과 매칭 안 되는 만큼을 "재고분 출고"로 묶어서 보여준다 — 둘 다
// 각 품목이 이미 들고 있는 fifo_consumptions 기준 실제 데이터를 쓴다.
function appendItemLines(
  items: ItemRow[],
  paperCalcByPartner: Record<string, PaperCalcPartnerEntry>,
  paperStockProductName: string,
  lines: string[],
  direction: "purchase" | "sale",
  otherSidePaperCalcByPartner?: Record<string, PaperCalcPartnerEntry>,
) {
  const blocks = buildPartnerBlocks(items, paperCalcByPartner, otherSidePaperCalcByPartner);
  blocks.forEach((partner, i) => {
    if (i > 0) lines.push("");
    lines.push(`- ${partner.partnerName}`);

    // 매입 쪽은 오늘 들어온 걸 기준으로 "입고합계", 매출 쪽은 오늘 나간
    // 걸 기준으로 "출고합계" — 방향에 맞는 말로 부른다.
    const grandTotalLabel = direction === "purchase" ? "입고합계" : "출고합계";

    let isFirstGroup = true;
    partner.products.forEach((product) => {
      const productGroups = buildProductLineGroups(product, direction);
      for (const group of productGroups) {
        if (!isFirstGroup) lines.push("");
        isFirstGroup = false;
        lines.push(
          group.label
            ? `  · ${product.productName} ${formatDestinationLabel(group.label)}`
            : `  · ${product.productName}`,
        );
        lines.push(...group.lines);
      }
      // 한 품목이 목적지별로 여러 줄로 나뉘면, 전체를 합친 숫자를 한 번
      // 더 보여준다 — 그룹 하나뿐이면 그 그룹의 합계가 곧 전체이므로 생략.
      if (productGroups.length > 1) {
        const grandTotal = productTotals(product.items);
        lines.push("");
        lines.push(`  ${grandTotalLabel} - ${formatNumber(grandTotal.quantity)}${grandTotal.unit}`);
      }
    });

    for (const paperCalcBlock of partner.paperCalcBlocks) {
      if (!isFirstGroup) lines.push("");
      isFirstGroup = false;
      lines.push(
        paperCalcBlock.label
          ? `  · ${paperStockProductName} ${formatDestinationLabel(paperCalcBlock.label)}`
          : `  · ${paperStockProductName}`,
      );
      for (const line of formatPaperCalcSizeLines(paperCalcBlock.sizes)) {
        lines.push(`    ${line}`);
      }
      lines.push(`    합계 - ${formatNumber(paperCalcBlock.totalSheet)}연`);
    }
  });
}

// ── 메인 화면 "오늘 리포트" 박스용 가공 ───────────────────────────────
// 박스 UI(daily-report-box.tsx)는 이 파일을 import하지 않고, 여기서 만든 순수
// 데이터(ReportDay)만 받는다 — 순환 import 없이 같은 dataByDate를 재사용해서
// 서버→클라이언트 전달 데이터가 두 번 직렬화되지 않는다. 거래처 연결 표시
// (": 거래처")는 리포트에 쓰지 않는다(사용자 결정) — realDestinations를 비우고
// 모조지 계산도 상대편과 대조하지 않는다.
export type ReportRow = { spec: string; quantity: string; boxes: string | null; isReturn: boolean };
export type ReportProduct = { name: string; rows: ReportRow[]; total: string | null };
export type ReportPartner = { name: string; amount: number; products: ReportProduct[] };
export type ReportDay = {
  salesCount: number;
  salesTotal: number;
  purchaseCount: number;
  purchaseTotal: number;
  sales: ReportPartner[];
  purchases: ReportPartner[];
  salesKinds: number;
  purchaseKinds: number;
  salesLines: string[];
  purchaseLines: string[];
};

function buildReportPartners(
  items: ItemRow[],
  paperCalcByPartner: Record<string, PaperCalcPartnerEntry>,
  paperStockProductName: string,
): ReportPartner[] {
  return buildPartnerBlocks(items, paperCalcByPartner).map((partner) => {
    let amount = 0;
    const products: ReportProduct[] = partner.products.map((product) => {
      const rows: ReportRow[] = groupItemsBySpec(product.items).map((group) => {
        const first = group.items[0];
        const quantity = group.items.reduce((sum, item) => sum + item.quantity, 0);
        const boxes = shouldShowBoxCountOnDashboard(product.productName, first.categoryName)
          ? formatBoxCount(quantity, first.basePackageQty)
          : null;
        return { spec: group.spec, quantity: `${formatNumber(quantity)}${first.unit}`, boxes, isReturn: first.isReturn };
      });
      amount += product.items.reduce((sum, item) => sum + item.amount, 0);
      const totals = productTotals(product.items);
      return {
        name: product.productName,
        rows: sortBySpecTrailingNumber(rows, (row) => row.spec),
        total: rows.length > 1 ? `${formatNumber(totals.quantity)}${totals.unit}` : null,
      };
    });
    for (const block of partner.paperCalcBlocks) {
      amount += block.amount;
      products.push({
        name: paperStockProductName,
        rows: formatPaperCalcSizeLines(block.sizes).map((line) => ({
          spec: line,
          quantity: "",
          boxes: null,
          isReturn: false,
        })),
        total: `${formatNumber(block.totalSheet)}연`,
      });
    }
    return { name: partner.partnerName, amount, products };
  });
}

function countReportKinds(partners: ReportPartner[]): number {
  const names = new Set<string>();
  for (const partner of partners) for (const product of partner.products) names.add(product.name);
  return names.size;
}

function reportItemLines(
  items: ItemRow[],
  paperCalcByPartner: Record<string, PaperCalcPartnerEntry>,
  paperStockProductName: string,
  direction: "purchase" | "sale",
): string[] {
  const lines: string[] = [];
  appendItemLines(
    items.map((item) => ({ ...item, realDestinations: [] })),
    paperCalcByPartner,
    paperStockProductName,
    lines,
    direction,
  );
  return lines;
}

export const EMPTY_REPORT_DAY: ReportDay = {
  salesCount: 0,
  salesTotal: 0,
  purchaseCount: 0,
  purchaseTotal: 0,
  sales: [],
  purchases: [],
  salesKinds: 0,
  purchaseKinds: 0,
  salesLines: [],
  purchaseLines: [],
};

export function buildReportDay(data: DayData | undefined, paperStockProductName: string): ReportDay {
  if (!data) return EMPTY_REPORT_DAY;
  const sales = buildReportPartners(data.salesItems, data.salesPaperCalcByPartner, paperStockProductName);
  const purchases = buildReportPartners(data.purchaseItems, data.purchasePaperCalcByPartner, paperStockProductName);
  return {
    salesCount: data.salesCount,
    salesTotal: data.salesTotal,
    purchaseCount: data.purchaseCount,
    purchaseTotal: data.purchaseTotal,
    sales,
    purchases,
    salesKinds: countReportKinds(sales),
    purchaseKinds: countReportKinds(purchases),
    salesLines: reportItemLines(data.salesItems, data.salesPaperCalcByPartner, paperStockProductName, "sale"),
    purchaseLines: reportItemLines(data.purchaseItems, data.purchasePaperCalcByPartner, paperStockProductName, "purchase"),
  };
}

// "2026-09-30" -> "9/30" — 이월 유입 표시에서 짧게 보여줄 때 쓴다.
function formatMonthDay(dateStr: string): string {
  const [, m, d] = dateStr.split("-");
  return `${Number(m)}/${Number(d)}`;
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
  currentUserId,
  isAdmin,
  layout,
  sourceOptions,
  sidePanels,
  companyLayout,
  reportMoney,
  lowStock,
  monthTotals,
}: {
  monthTotals?: ReportMonthTotals;
  reportMoney?: ReportMoney | null;
  lowStock?: ReportLowStock[];
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
  currentUserId: string | null;
  isAdmin: boolean;
  // 위젯 배치(사용자가 저장한 위치·크기)와, 서버에서 그려 내려주는 나머지 위젯들(재고조회·재고위험·메모·빠른실행).
  layout: DashboardLayout;
  sourceOptions: { id: SourceId; title: string }[];
  sidePanels: Partial<Record<Exclude<DashboardWidgetId, "calendar" | "report">, ReactNode>>;
  companyLayout: DashboardLayout;
}) {
  const router = useRouter();
  const getReportDay = useCallback(
    (dateStr: string) => buildReportDay(dataByDate[dateStr], paperStockProductName),
    [dataByDate, paperStockProductName],
  );
  const defaultSelected =
    dataByDate[todayStr] !== undefined ||
    weeks.some((w) => w.some((c) => c?.dateStr === todayStr))
      ? todayStr
      : null;
  const [selected, setSelected] = useState<string | null>(defaultSelected);

  // MidnightRefresh가 router.refresh()로 서버 데이터(todayStr 포함)를
  // 새로 받아와도, 이 상태는 처음 마운트될 때 한 번만 정해지므로 자정이
  // 지나도 그대로 남아있는다. "오늘"을 보고 있던 경우에 한해(다른 날짜를
  // 직접 선택해둔 상태라면 건드리지 않는다) 새 오늘 날짜로 따라가게 한다.
  const prevTodayStrRef = useRef(todayStr);
  useEffect(() => {
    if (prevTodayStrRef.current !== todayStr) {
      setSelected((prev) =>
        prev === prevTodayStrRef.current ? todayStr : prev,
      );
      prevTodayStrRef.current = todayStr;
    }
  }, [todayStr]);

  // 달력에서 고른 날(없으면 기본 날짜) — 일일 리포트의 "일정·메모" 탭이 이 날의 이월·일정·메모를 보여준다.
  const reportDate = selected ?? defaultReportDate(year, month, todayStr);
  const selectedData: DayData = dataByDate[reportDate] || {
    salesCount: 0,
    salesTotal: 0,
    salesItems: [],
    purchaseCount: 0,
    purchaseTotal: 0,
    purchaseItems: [],
    salesPaperCalcByPartner: {},
    purchasePaperCalcByPartner: {},
    carryoverInSales: [],
    carryoverInPurchases: [],
    notes: [],
    calendarItems: [],
    todoItems: [],
  };
  const dayPanel = (
    <>
      {(selectedData.carryoverInSales.length > 0 ||
        selectedData.carryoverInPurchases.length > 0) && (
        <div
          className="mb-3 border-l-[3px] p-2 text-xs font-medium erp-u-bg-warning-bg erp-u-color-warning"
          style={{ borderLeftColor: "var(--erp-warning)" }}
        >
          {selectedData.carryoverInSales.map((e, i) => (
            <p key={`s-${i}`} className="m-0">
              {formatMonthDay(e.fromDate)} 작업분이 이월됨 — 매출 품목{" "}
              {e.itemCount}건
            </p>
          ))}
          {selectedData.carryoverInPurchases.map((e, i) => (
            <p key={`p-${i}`} className="m-0">
              {formatMonthDay(e.fromDate)} 작업분이 이월됨 — 매입 품목{" "}
              {e.itemCount}건
            </p>
          ))}
        </div>
      )}


      {selectedData.calendarItems.length > 0 && (
        <div className="mb-4">
          <div className="mb-1 flex items-center justify-between">
            <p className="text-xs font-bold text-[var(--erp-info-text)]">
              일정 {selectedData.calendarItems.length}건
            </p>
            <Link
              href="/calendar"
              className="text-[10.5px] text-[var(--erp-text-muted)] hover:underline"
            >
              캘린더에서 보기
            </Link>
          </div>
          <ul className="space-y-1">
            {selectedData.calendarItems.map((item) => (
              <li
                key={item.id}
                className="border-l-[3px] p-1.5 text-xs erp-u-bg-bg-subtle"
                style={{ borderLeftColor:
                    item.source === "meeting"
                      ? "var(--erp-info-text)"
                      : "var(--erp-warning)" }}
              >
                <span className="font-semibold text-[var(--erp-text)]">
                  {item.title}
                </span>
                {!item.allDay && (
                  <span className="ml-1.5 text-[var(--erp-text-muted)]">
                    {item.startAt.slice(11, 16)}~{item.endAt.slice(11, 16)}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      <NoteForm
        dateStr={reportDate}
        notes={selectedData.notes}
        currentUserId={currentUserId}
        isAdmin={isAdmin}
      />
    </>
  );
  const dayCount =
    selectedData.calendarItems.length +
    selectedData.notes.length +
    selectedData.carryoverInSales.length +
    selectedData.carryoverInPurchases.length;
  const calendarCard = (
      <div className="erp-cal-panel">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={backgroundLogoUrl || "/branding/logo-mark.png"}
          alt=""
          aria-hidden
          className="pointer-events-none absolute top-1/2 left-1/2 h-64 w-64 -translate-x-1/2 -translate-y-1/2 opacity-[0.05]"
        />
        <div className="erp-cal-main">
        <div className="relative mb-3 flex items-center justify-between">
          <h2 className="text-sm font-bold text-[var(--erp-text)]">
            {year}년 {month}월
          </h2>
          <div className="flex gap-1">
            <Link
              href={prevMonthHref}
              className="rounded-sm border border-[var(--erp-border)] px-2 py-1 text-xs text-[var(--erp-text-muted)] hover:bg-[var(--erp-hover)]"
            >
              ← 이전달
            </Link>
            <Link
              href={nextMonthHref}
              className="rounded-sm border border-[var(--erp-border)] px-2 py-1 text-xs text-[var(--erp-text-muted)] hover:bg-[var(--erp-hover)]"
            >
              다음달 →
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-7 gap-1 text-center text-xs">
          {WEEKDAYS.map((w, i) => (
            <div
              key={w}
              className={`py-1 ${i === 0 ? "text-[var(--erp-danger)]" : i === 6 ? "text-[var(--erp-primary)]" : "text-[var(--erp-text-muted)]"}`}
            >
              {w}
            </div>
          ))}
        </div>

        <div className="relative grid grid-cols-7 gap-1">
          {weeks.map((week, wi) =>
            week.map((cell, di) => {
              if (!cell) {
                return (
                  <div
                    key={`${wi}-${di}`}
                    className="erp-cal-cell is-empty"
                  />
                );
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
                  ? "text-[var(--erp-danger)] font-semibold"
                  : isSunday
                    ? "text-[var(--erp-danger)]"
                    : isSaturday
                      ? "text-[var(--erp-primary)]"
                      : "text-[var(--erp-text)]";
              // 칸 안의 띠(매출·매입·할 일·일정·재고 부족·메모·이월) — 넓으면 글자로, 좁은 칸·모바일은 점으로 보인다.
              const bands = buildDayBands(data, { lowStockCount: isToday && lowStockToday ? (lowStock?.length ?? 1) : 0 });
              const tooltip = [holidayName, bandsTooltip(bands.all)].filter(Boolean).join("\n") || undefined;
              return (
                <button
                  key={cell.dateStr}
                  type="button"
                  title={tooltip}
                  onClick={() => setSelected(cell.dateStr)}
                  onDoubleClick={() => {
                    startRouteProgress();
                    router.push(
                      `/sales?from=${cell.dateStr}&to=${cell.dateStr}`,
                    );
                  }}
                  className={`erp-cal-cell${isSelected ? " is-selected" : isToday ? " is-today" : ""}`}
                >
                  <div className={dayColorClass}>{cell.day}</div>
                  {holidayName ? <div className="erp-cal-holiday">{holidayName}</div> : null}
                  <div className="erp-cal-rich">
                    {bands.shown.map((b, i) => (
                      <div key={i} className={`erp-cal-chip is-${b.kind}`}>
                        {b.tag && <em>{b.tag}</em>}
                        {b.text}
                      </div>
                    ))}
                    {bands.more > 0 ? <div className="erp-cal-more">외 {bands.more}건</div> : null}
                  </div>
                  <div className="erp-cal-dots">
                    {bands.all.map((b, i) => (
                      <span key={i} className={`erp-cal-dot is-${b.kind}`} />
                    ))}
                  </div>
                </button>
              );
            }),
          )}
        </div>

        <div className="mt-3 flex flex-wrap gap-4 text-xs text-[var(--erp-text-muted)]">
          {CAL_LEGEND.map(([kind, label]) => (
            <span key={kind} className="flex items-center gap-1">
              <span className={`erp-cal-dot is-${kind}`} /> {label}
            </span>
          ))}
        </div>

        </div>

      </div>
  );

  // 오늘 리포트 — 매입/매출 품목은 상세보기 팝업, 카톡 복사는 "텍스트 복사"가 맡는다.
  const reportCard = (
    <DailyReportBox
      key={`${year}-${month}`}
      year={year}
      month={month}
      todayStr={todayStr}
      date={reportDate} onDateChange={setSelected}
      dayCount={dayCount}
      getDay={getReportDay}
      money={reportMoney ?? null}
      lowStock={lowStock ?? []}
      monthTotals={monthTotals ?? null}
    >
      {dayPanel}
    </DailyReportBox>
  );

  return (
    <DashboardWidgetGrid
      initialLayout={layout}
      companyLayout={companyLayout}
      canSetCompanyDefault={isAdmin}
      sourceOptions={sourceOptions}
      widgets={{ ...sidePanels, calendar: calendarCard, report: reportCard }}
    />
  );
}

function NoteForm({
  dateStr,
  notes,
  currentUserId,
  isAdmin,
}: {
  dateStr: string;
  notes: {
    id: string;
    authorName: string;
    content: string;
    createdAt: string;
    createdBy: string | null;
  }[];
  currentUserId: string | null;
  isAdmin: boolean;
}) {
  const [state, formAction, pending] = useActionState(
    addCalendarNote,
    undefined,
  );
  const submitRef = useRef<HTMLButtonElement>(null);
  useKeyShortcut("F7", submitRef);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const { isArmed, press } = useConfirmTwice<string>();

  return (
    <div className="space-y-2">
      <label
        className="block text-xs font-medium erp-u-muted"
      >
        메모
      </label>
      {notes.length > 0 && (
        <ul className="space-y-2">
          {notes.map((note) => (
            <li key={note.id} className="flex items-start gap-2">
              <span
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-extrabold erp-u-text erp-u-bg-selected"
              >
                {note.authorName.slice(0, 1)}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline gap-1.5">
                  <span className="text-xs font-bold text-[var(--erp-text)]">
                    {note.authorName}
                  </span>
                  <span
                    className="text-[10.5px] erp-u-muted"
                  >
                    {new Date(note.createdAt).toLocaleTimeString("ko-KR", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                  {canManage(note.createdBy, currentUserId, isAdmin) && (
                    <button
                      type="button"
                      disabled={isPending && deletingId === note.id}
                      onClick={() =>
                        press(note.id, () => {
                          setDeleteError(null);
                          setDeletingId(note.id);
                          startTransition(async () => {
                            const result = await deleteCalendarNote(note.id);
                            if (result?.error) setDeleteError(result.error);
                            setDeletingId(null);
                          });
                        })
                      }
                      className="ml-auto shrink-0 text-[10.5px] font-semibold"
                      style={{
                        color: isArmed(note.id)
                          ? "var(--erp-danger)"
                          : "var(--erp-text-muted)",
                      }}
                    >
                      {isPending && deletingId === note.id
                        ? "삭제 중..."
                        : isArmed(note.id)
                          ? "정말 삭제?"
                          : "삭제"}
                    </button>
                  )}
                </div>
                <p className="text-xs text-[var(--erp-text)]">
                  {note.content}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
      {deleteError && (
        <p className="text-xs font-medium text-[var(--erp-danger)]">
          {deleteError}
        </p>
      )}
      {/* notes.length가 바뀌면(추가 성공 시) 폼을 다시 마운트해서 입력칸을
          비운다 — 이 메모는 그날의 한 칸을 편집하는 게 아니라 매번 새
          로그 한 줄을 등록하는 것이라, 등록 후에는 항상 빈 칸이어야 한다. */}
      <form
        action={formAction}
        key={`${dateStr}-${notes.length}`}
        className="space-y-2"
      >
        <input type="hidden" name="note_date" value={dateStr} />
        <textarea
          name="content"
          rows={2}
          placeholder="새 메모를 입력하세요"
          className="erp-input w-full"
          style={{ height: "auto" }}
        />
        <button
          ref={submitRef}
          type="submit"
          disabled={pending}
          className="erp-btn erp-btn-primary erp-form-submit"
        >
          {pending ? (
            <>
              <span className="erp-spinner" aria-hidden /> 저장 중...
            </>
          ) : (
            "F7 메모 추가"
          )}
        </button>
        <FormMessage state={state} />
      </form>
    </div>
  );
}
