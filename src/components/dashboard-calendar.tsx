"use client";

import {
  useActionState,
  useEffect,
  useRef,
  useState,
  useTransition,
} from "react";
import Link from "next/link";
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
} from "@/lib/paper-calc-summary";

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
  // 반품 건이면 amount가 이미 음수로 뒤집혀 들어온다(dashboard/page.tsx
  // 참고) — 여기서는 표시용 배지/부호만 추가로 붙인다.
  isReturn: boolean;
};

type PaperCalcPartnerEntry = {
  sizes: PaperCalcSizeRow[];
  totalSheet: number;
  amount: number;
};

type DayData = {
  salesCount: number;
  salesTotal: number;
  salesItems: ItemRow[];
  purchaseCount: number;
  purchaseTotal: number;
  purchaseItems: ItemRow[];
  salesPaperCalcByPartner: Record<string, PaperCalcPartnerEntry>;
  purchasePaperCalcByPartner: Record<string, PaperCalcPartnerEntry>;
  notes: {
    id: string;
    authorName: string;
    content: string;
    createdAt: string;
    createdBy: string | null;
  }[];
};

type Cell = { dateStr: string; day: number } | null;

type ProductGroup = { productName: string; items: ItemRow[] };
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
function groupItemsBySpec(items: ItemRow[]) {
  const order: string[] = [];
  const bySpec = new Map<string, ItemRow[]>();
  for (const item of items) {
    const key = item.spec || "규격 미지정";
    if (!bySpec.has(key)) {
      order.push(key);
      bySpec.set(key, []);
    }
    bySpec.get(key)!.push(item);
  }
  return order.map((spec) => ({ spec, items: bySpec.get(spec)! }));
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
// 대조해서 원래 어느 거래처 몫이었는지 되짚어 나눈다 — 일반 품목을
// 품목명+규격으로 매칭하는 matchDestinations와 같은 원리다. 어느 거래처
// 것으로도 안 잡히고 남는 사이즈는 "재고용 매입"으로 묶는다.
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
      label: STOCK_PURCHASE_LABEL,
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

// 매입 품목이 같은 날 어디로 나갔는지(당일 입고 즉시 출고) 한눈에 보이게,
// 같은 품목명+같은 규격의 매출 내역을 거래처별로 합산한다. 규격까지 정확히
// 맞아야만 매칭해서, 오늘 사지 않은 규격에서 나간 매출(재고에서 나간 것)이
// 엉뚱하게 엮이지 않게 한다.
function matchDestinations(
  productName: string,
  spec: string,
  salesItems: ItemRow[],
): { partnerName: string; quantity: number }[] {
  const key = spec || "규격 미지정";
  const byPartner = new Map<string, number>();
  for (const item of salesItems) {
    if (item.productName !== productName) continue;
    if ((item.spec || "규격 미지정") !== key) continue;
    // 반품은 그 거래처로 나간 게 아니라 되돌아온 것이므로 "출고처"
    // 합산에서 제외한다 — 안 그러면 반품이 마치 그날 그 거래처로
    // 출고된 것처럼 보인다.
    if (item.isReturn) continue;
    byPartner.set(item.partnerName, (byPartner.get(item.partnerName) ?? 0) + item.quantity);
  }
  return Array.from(byPartner.entries()).map(([partnerName, quantity]) => ({
    partnerName,
    quantity,
  }));
}

const STOCK_PURCHASE_LABEL = "재고용 매입";
const STOCK_SALE_LABEL = "재고분 출고";

// destinations 목록을 사람이 읽을 라벨로 만든다. 전량이 한 곳으로만
// 갔으면 그 이름만, 여러 곳/일부만 갔으면 목적지별 수량을 붙여 나열한다.
// 화면의 화살표 힌트와 카톡복사의 그룹 헤더가 이 라벨을 그대로 같이 쓴다.
function destinationGroupLabel(
  destinations: { partnerName: string; quantity: number }[],
  incomingQuantity: number,
  unit: string,
): string | null {
  if (!destinations.length) return null;
  if (destinations.length === 1 && destinations[0].quantity === incomingQuantity) {
    return destinations[0].partnerName;
  }
  return destinations
    .map((d) => `${d.partnerName} ${d.quantity.toLocaleString()}${unit}`)
    .join(" / ");
}

// 매입 품목이 당일 매출로 전부/일부 나가고 남는 수량이 있으면, 그 남는
// 만큼을 "재고용 매입"이라는 가상의 목적지로 채워 넣는다. 그러면
// destinationGroupLabel을 그대로 재사용해서 "전량 재고면 이름만, 일부만
// 재고면 다른 목적지들과 같이 수량을 붙여" 표시할 수 있다.
function destinationsIncludingStock(
  productName: string,
  spec: string,
  incomingQuantity: number,
  salesItems: ItemRow[],
): { partnerName: string; quantity: number }[] {
  const destinations = matchDestinations(productName, spec, salesItems);
  const shipped = destinations.reduce((sum, d) => sum + d.quantity, 0);
  const leftover = incomingQuantity - shipped;
  if (leftover <= 0) return destinations;
  return [...destinations, { partnerName: STOCK_PURCHASE_LABEL, quantity: leftover }];
}

// 매출 품목이 당일 매입과 완전히 일치하면 라벨 없음(당일 사입 그대로
// 나간 것이라 따로 표시할 필요 없음), 전량 재고면 "재고분 출고", 일부만
// 재고면 몇 개가 재고에서 나갔는지 붙인다.
function stockGroupLabel(
  productName: string,
  spec: string,
  soldQuantity: number,
  purchaseItems: ItemRow[],
  unit: string,
): string | null {
  const purchasedQuantity = matchDestinations(productName, spec, purchaseItems).reduce(
    (sum, d) => sum + d.quantity,
    0,
  );
  if (purchasedQuantity >= soldQuantity) return null;
  if (purchasedQuantity <= 0) return STOCK_SALE_LABEL;
  const stockQuantity = soldQuantity - purchasedQuantity;
  return `${stockQuantity.toLocaleString()}${unit}는 ${STOCK_SALE_LABEL}`;
}

type LineGroup = {
  label: string | null;
  lines: string[];
  specCount: number;
  totalQuantity: number;
  unit: string;
};

// 한 품목 안의 규격 줄들을, 목적지(또는 재고 여부) 라벨이 같은 것끼리
// 묶는다. 같은 품목이라도 규격별로 다른 곳(거래처 또는 재고)으로 갔으면
// "품목명 (라벨)" 헤더를 라벨마다 따로 만들어 그 아래 규격:수량만
// 나열한다 — 매 줄 끝에 화살표를 반복해 붙이는 대신, 어디로 갔는지가
// 같은 규격끼리 한 덩어리로 보이게 한다. 화면(productTotals)과 동일하게,
// 규격 줄이 2개 이상인 그룹에는 맨 아래에 합계를 붙인다 — 줄이 하나뿐이면
// 바로 위 줄과 같은 숫자가 또 나와 불필요하므로 생략한다.
function buildProductLineGroups(
  product: ProductGroup,
  matchAgainst: ItemRow[] | undefined,
  reverseMatchAgainst: ItemRow[] | undefined,
): LineGroup[] {
  const groups: LineGroup[] = [];
  const indexByLabel = new Map<string | null, number>();

  for (const group of groupItemsBySpec(product.items)) {
    const quantity = group.items.reduce((sum, it) => sum + it.quantity, 0);
    const unit = group.items[0]?.unit ?? "";
    const isReturn = group.items.some((it) => it.isReturn);
    const carryoverSuffix = group.items.some((it) => it.isCarryover) ? " (이월)" : "";
    const returnSuffix = isReturn ? " (반품)" : "";

    let label: string | null = null;
    if (matchAgainst) {
      const destinations = destinationsIncludingStock(
        product.productName,
        group.spec,
        quantity,
        matchAgainst,
      );
      label = destinationGroupLabel(destinations, quantity, unit);
    } else if (reverseMatchAgainst && !isReturn) {
      label = stockGroupLabel(product.productName, group.spec, quantity, reverseMatchAgainst, unit);
    }

    let idx = indexByLabel.get(label);
    if (idx === undefined) {
      idx = groups.length;
      indexByLabel.set(label, idx);
      groups.push({ label, lines: [], specCount: 0, totalQuantity: 0, unit });
    }
    groups[idx].lines.push(
      `    ${group.spec} : ${quantity.toLocaleString()}${unit}${carryoverSuffix}${returnSuffix}`,
    );
    groups[idx].specCount += 1;
    groups[idx].totalQuantity += quantity;
    groups[idx].unit = unit;
    for (const item of group.items) {
      if (item.remark) groups[idx].lines.push(`      (비고: ${item.remark})`);
    }
  }

  for (const group of groups) {
    if (group.specCount > 1) {
      group.lines.push(`    합계 - ${group.totalQuantity.toLocaleString()}${group.unit}`);
    }
  }

  return groups;
}

// 카카오톡 등에 그대로 붙여넣을 수 있게, 화면에 보이는 품목 내역을 사람이
// 읽기 편한 일반 텍스트로 옮긴다. 외부에 금액이 노출되지 않도록 수량까지만
// 담고, 단위(EA/KG 등)는 화면에만 보이고 복사 텍스트에는 숫자만 남긴다.
// matchAgainst를 넘기면(매입 복사에서만 사용) 품목이 어느 거래처로
// 나갔는지(또는 재고용 매입인지)를 품목명 옆 괄호로 묶어서 보여주고,
// reverseMatchAgainst를 넘기면(매출 복사에서만 사용) 반대로 당일 매입과
// 매칭 안 되는 만큼을 "재고분 출고"로 묶어서 보여준다.
function appendItemLines(
  items: ItemRow[],
  paperCalcByPartner: Record<string, PaperCalcPartnerEntry>,
  paperStockProductName: string,
  lines: string[],
  matchAgainst?: ItemRow[],
  reverseMatchAgainst?: ItemRow[],
  otherSidePaperCalcByPartner?: Record<string, PaperCalcPartnerEntry>,
) {
  const blocks = buildPartnerBlocks(items, paperCalcByPartner, otherSidePaperCalcByPartner);
  blocks.forEach((partner, i) => {
    if (i > 0) lines.push("");
    lines.push(`- ${partner.partnerName}`);

    let isFirstGroup = true;
    partner.products.forEach((product) => {
      const productGroups = buildProductLineGroups(product, matchAgainst, reverseMatchAgainst);
      for (const group of productGroups) {
        if (!isFirstGroup) lines.push("");
        isFirstGroup = false;
        lines.push(
          group.label
            ? `  · ${product.productName} (${group.label})`
            : `  · ${product.productName}`,
        );
        lines.push(...group.lines);
      }
    });

    for (const paperCalcBlock of partner.paperCalcBlocks) {
      if (!isFirstGroup) lines.push("");
      isFirstGroup = false;
      lines.push(
        paperCalcBlock.label
          ? `  · ${paperStockProductName} (${paperCalcBlock.label})`
          : `  · ${paperStockProductName}`,
      );
      for (const line of formatPaperCalcSizeLines(paperCalcBlock.sizes)) {
        lines.push(`    ${line}`);
      }
      lines.push(`    합계 - ${paperCalcBlock.totalSheet.toLocaleString()}연`);
    }
  });
}

function buildSalesCopyText(
  dateStr: string,
  data: DayData,
  paperStockProductName: string,
) {
  const lines: string[] = [`${dateStr} 매출`, "", `[매출] ${data.salesCount}건`, ""];
  appendItemLines(
    data.salesItems,
    data.salesPaperCalcByPartner,
    paperStockProductName,
    lines,
    undefined,
    data.purchaseItems,
  );
  return lines.join("\n");
}

function buildPurchaseCopyText(
  dateStr: string,
  data: DayData,
  paperStockProductName: string,
) {
  const lines: string[] = [`${dateStr} 매입`, "", `[매입] ${data.purchaseCount}건`, ""];
  appendItemLines(
    data.purchaseItems,
    data.purchasePaperCalcByPartner,
    paperStockProductName,
    lines,
    data.salesItems,
    undefined,
    data.salesPaperCalcByPartner,
  );
  return lines.join("\n");
}

// 메모 로그를 카톡 등에 붙여넣을 수 있는 텍스트로 옮긴다. 화면에는
// 작성자·시각이 같이 보이지만, 복사 텍스트에는 시각까지는 필요 없다는
// 피드백에 따라 "작성자: 내용"만 담는다.
function buildMemoCopyText(
  dateStr: string,
  notes: { authorName: string; content: string }[],
) {
  const lines: string[] = [`${dateStr} 메모`, ""];
  for (const note of notes) {
    lines.push(`${note.authorName}: ${note.content}`);
  }
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
      style={{
        background: "var(--erp-warning-bg)",
        color: "var(--erp-warning)",
      }}
    >
      이월
    </span>
  );
}

// 매입 화면(오늘의 업무 패널)에서만 쓴다 — destinationsIncludingStock을
// 카톡 복사 텍스트 생성과 그대로 같이 쓴다. 당일 매출 어디로도 안 나간
// 품목(=재고용 매입)은 배지로, 실제 거래처로 나간 경우는 화살표 텍스트로
// 구분해서 보여준다.
function DestinationHint({
  productName,
  spec,
  unit,
  quantity,
  salesItems,
}: {
  productName: string;
  spec: string;
  unit?: string;
  quantity: number;
  salesItems: ItemRow[];
}) {
  const destinations = destinationsIncludingStock(productName, spec, quantity, salesItems);
  if (!destinations.length) return null;
  // 전량이 한 곳으로만 갔으면 숫자는 생략한다 — 카톡복사 텍스트와 동일한
  // 규칙(destinationGroupLabel 참고), 화면과 복사 결과가 서로 다르게
  // 보이지 않게 맞춘다.
  const isFullSingleMatch = destinations.length === 1 && destinations[0].quantity === quantity;
  const isPureStock = isFullSingleMatch && destinations[0].partnerName === STOCK_PURCHASE_LABEL;

  if (isPureStock) {
    return (
      <span
        className="ml-1 inline-flex items-center rounded-full px-1.5 py-px text-[9px] font-bold"
        style={{ background: "var(--erp-bg-disabled)", color: "var(--erp-text-muted)" }}
      >
        {STOCK_PURCHASE_LABEL}
      </span>
    );
  }

  return (
    <span className="font-semibold text-[var(--erp-success)]">
      {" "}
      →{" "}
      {isFullSingleMatch
        ? destinations[0].partnerName
        : destinations
            .map((d) => `${d.partnerName} ${d.quantity.toLocaleString()}${unit ?? ""}`)
            .join(" / ")}
    </span>
  );
}

// 매출 화면(오늘의 업무 패널)에서만 쓴다 — DestinationHint와 대칭으로,
// 이 매출 품목이 당일 매입으로 들어온 게 아니라 기존 재고에서 나간
// 것이면 "재고분 출고"를 붙인다(stockGroupLabel은 위에서 카톡 복사
// 텍스트 생성에도 재사용).
function StockOriginHint({
  productName,
  spec,
  unit,
  quantity,
  purchaseItems,
}: {
  productName: string;
  spec: string;
  unit?: string;
  quantity: number;
  purchaseItems: ItemRow[];
}) {
  const purchasedQuantity = matchDestinations(productName, spec, purchaseItems).reduce(
    (sum, d) => sum + d.quantity,
    0,
  );
  if (purchasedQuantity >= quantity) return null;
  const stockQuantity = quantity - purchasedQuantity;
  return (
    <span className="font-semibold text-[var(--erp-text-muted)]">
      {" "}
      → {STOCK_SALE_LABEL}
      {purchasedQuantity > 0 &&
        ` (${stockQuantity.toLocaleString()}${unit ?? ""}만 출고)`}
    </span>
  );
}

function ReturnBadge() {
  return (
    <span
      className="ml-1 inline-flex items-center rounded-full px-1.5 py-px text-[9px] font-bold"
      style={{
        background: "var(--erp-danger-bg)",
        color: "var(--erp-danger)",
      }}
    >
      반품
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
  currentUserId,
  isAdmin,
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
  currentUserId: string | null;
  isAdmin: boolean;
}) {
  const router = useRouter();
  const defaultSelected =
    dataByDate[todayStr] !== undefined ||
    weeks.some((w) => w.some((c) => c?.dateStr === todayStr))
      ? todayStr
      : null;
  const [selected, setSelected] = useState<string | null>(defaultSelected);
  const [copiedType, setCopiedType] = useState<
    "sales" | "purchase" | "memo" | null
  >(null);

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

  const selectedData: DayData = (selected && dataByDate[selected]) || {
    salesCount: 0,
    salesTotal: 0,
    salesItems: [],
    purchaseCount: 0,
    purchaseTotal: 0,
    purchaseItems: [],
    salesPaperCalcByPartner: {},
    purchasePaperCalcByPartner: {},
    notes: [],
  };

  async function handleCopy(type: "sales" | "purchase" | "memo") {
    if (!selected) return;
    const text =
      type === "sales"
        ? buildSalesCopyText(selected, selectedData, paperStockProductName)
        : type === "purchase"
          ? buildPurchaseCopyText(selected, selectedData, paperStockProductName)
          : buildMemoCopyText(selected, selectedData.notes);
    await copyText(text);
    setCopiedType(type);
    setTimeout(() => setCopiedType(null), 1500);
  }

  return (
    <div className="grid grid-cols-1 gap-3 lg:grid-cols-[1fr_300px]">
      <div className="relative overflow-hidden rounded-sm border border-[var(--erp-border)] bg-white p-4">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={backgroundLogoUrl || "/branding/logo-mark.png"}
          alt=""
          aria-hidden
          className="pointer-events-none absolute top-1/2 left-1/2 h-64 w-64 -translate-x-1/2 -translate-y-1/2 opacity-[0.05]"
        />
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
                    className="aspect-square rounded-sm"
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
              const showLowStockDot = isToday && lowStockToday;
              const carryoverSalesCount =
                data?.salesItems.filter((i) => i.isCarryover).length ?? 0;
              const carryoverPurchaseCount =
                data?.purchaseItems.filter((i) => i.isCarryover).length ?? 0;
              const hasSalesDot = !!data?.salesCount || carryoverSalesCount > 0;
              const hasPurchaseDot =
                !!data?.purchaseCount || carryoverPurchaseCount > 0;
              const tooltipParts = [
                data?.salesCount ? `매출 ${data.salesCount}건` : null,
                data?.purchaseCount ? `매입 ${data.purchaseCount}건` : null,
                carryoverSalesCount
                  ? `이월 매출 ${carryoverSalesCount}건`
                  : null,
                carryoverPurchaseCount
                  ? `이월 매입 ${carryoverPurchaseCount}건`
                  : null,
                data?.notes.length ? "메모 있음" : null,
                showLowStockDot ? "안전재고 부족" : null,
              ].filter(Boolean);
              return (
                <button
                  key={cell.dateStr}
                  type="button"
                  title={
                    tooltipParts.length ? tooltipParts.join(" · ") : undefined
                  }
                  onClick={() => setSelected(cell.dateStr)}
                  onDoubleClick={() => {
                    startRouteProgress();
                    router.push(
                      `/sales?from=${cell.dateStr}&to=${cell.dateStr}`,
                    );
                  }}
                  className={`aspect-square rounded-sm border p-1 text-left text-xs transition-colors ${
                    isSelected
                      ? "border-[var(--erp-primary)] bg-[var(--erp-primary)] text-white"
                      : isToday
                        ? "border-[var(--erp-primary)] bg-[var(--erp-selected)]"
                        : "border-transparent hover:bg-[var(--erp-hover)]"
                  }`}
                >
                  <div className={dayColorClass}>{cell.day}</div>
                  {holidayName ? (
                    <div
                      className={`truncate text-[9px] leading-tight ${isSelected ? "text-white" : "text-[var(--erp-danger)]"}`}
                    >
                      {holidayName}
                    </div>
                  ) : null}
                  <div className="mt-0.5 flex gap-0.5">
                    {hasPurchaseDot ? (
                      <span
                        className={`h-1.5 w-1.5 rounded-full ${isSelected ? "bg-white" : "bg-[var(--erp-primary)]"}`}
                      />
                    ) : null}
                    {hasSalesDot ? (
                      <span
                        className={`h-1.5 w-1.5 rounded-full ${isSelected ? "bg-white" : "bg-[var(--erp-success)]"}`}
                      />
                    ) : null}
                    {data?.notes.length ? (
                      <span
                        className={`h-1.5 w-1.5 rounded-full ${isSelected ? "bg-white" : "bg-[var(--erp-warning)]"}`}
                      />
                    ) : null}
                    {showLowStockDot ? (
                      <span
                        className={`h-1.5 w-1.5 rounded-full ${isSelected ? "bg-white" : "bg-[var(--erp-danger)]"}`}
                      />
                    ) : null}
                  </div>
                </button>
              );
            }),
          )}
        </div>

        <div className="mt-3 flex flex-wrap gap-4 text-xs text-[var(--erp-text-muted)]">
          <span className="flex items-center gap-1">
            <span className="h-1.5 w-1.5 rounded-full bg-[var(--erp-primary)]" />{" "}
            매입
          </span>
          <span className="flex items-center gap-1">
            <span className="h-1.5 w-1.5 rounded-full bg-[var(--erp-success)]" />{" "}
            매출
          </span>
          <span className="flex items-center gap-1">
            <span className="h-1.5 w-1.5 rounded-full bg-[var(--erp-warning)]" />{" "}
            메모
          </span>
          <span className="flex items-center gap-1">
            <span className="h-1.5 w-1.5 rounded-full bg-[var(--erp-danger)]" />{" "}
            재고부족
          </span>
        </div>
      </div>

      <div className="rounded-sm border border-[var(--erp-border)] bg-white p-4">
        {selected ? (
          <>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-bold text-[var(--erp-text)]">
                {selected} 오늘의 업무
              </h3>
              <div className="flex shrink-0 gap-1">
                <button
                  type="button"
                  onClick={() => handleCopy("purchase")}
                  className="rounded-sm border border-[var(--erp-primary)] bg-[var(--erp-selected)] px-2 py-1 text-xs font-bold text-[var(--erp-primary)] hover:bg-[#d3e0ee]"
                >
                  {copiedType === "purchase" ? "복사됨" : "매입 복사"}
                </button>
                <button
                  type="button"
                  onClick={() => handleCopy("sales")}
                  className="rounded-sm border border-[var(--erp-success)] bg-[var(--erp-success-bg)] px-2 py-1 text-xs font-bold text-[var(--erp-success)] hover:bg-[var(--erp-success-border)]"
                >
                  {copiedType === "sales" ? "복사됨" : "매출 복사"}
                </button>
                <button
                  type="button"
                  onClick={() => handleCopy("memo")}
                  className="rounded-sm border border-[var(--erp-info-border)] bg-[var(--erp-info-bg)] px-2 py-1 text-xs font-bold text-[var(--erp-info-text)] hover:opacity-80"
                >
                  {copiedType === "memo" ? "복사됨" : "메모 복사"}
                </button>
              </div>
            </div>

            <div
              className="mb-3 border-l-[3px] border-l-[var(--erp-primary)] p-2"
              style={{
                background:
                  "linear-gradient(90deg, var(--erp-selected), transparent 60%)",
              }}
            >
              <p className="mb-1 text-xs font-bold text-[var(--erp-primary)]">
                매입 {selectedData.purchaseCount}건 ·{" "}
                {selectedData.purchaseTotal.toLocaleString()}원
              </p>
              {(selectedData.purchaseItems.length > 0 ||
                Object.keys(selectedData.purchasePaperCalcByPartner).length >
                  0) && (
                <div className="space-y-2 text-xs font-medium text-[var(--erp-primary)]">
                  {buildPartnerBlocks(
                    selectedData.purchaseItems,
                    selectedData.purchasePaperCalcByPartner,
                    selectedData.salesPaperCalcByPartner,
                  ).map((partner, pi) => (
                    <div key={pi}>
                      <p className="font-bold">- {partner.partnerName}</p>
                      <div className="space-y-1 pl-3">
                        {partner.products.map((product, di) => {
                          const anyCarryover = product.items.some(
                            (item) => item.isCarryover,
                          );
                          return (
                            <div key={di}>
                              <p className="font-semibold text-[var(--erp-text)]">
                                - {product.productName}
                              </p>
                              <ul className="space-y-1 pl-3 font-normal text-[var(--erp-text-muted)]">
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
                                            {item.spec || "규격 미지정"} :{" "}
                                            {item.quantity.toLocaleString()}
                                            {item.unit}
                                            {item.isCarryover && (
                                              <CarryoverBadge />
                                            )}
                                            <DestinationHint
                                              productName={product.productName}
                                              spec={item.spec}
                                              unit={item.unit}
                                              quantity={item.quantity}
                                              salesItems={selectedData.salesItems}
                                            />
                                            {item.remark && (
                                              <span className="block text-[10px] text-[var(--erp-text-muted)]/70">
                                                비고: {item.remark}
                                              </span>
                                            )}
                                          </span>
                                          <span className="shrink-0">
                                            {item.amount.toLocaleString()}원
                                          </span>
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
                                            {item.spec || "규격 미지정"} :{" "}
                                            {item.quantity.toLocaleString()}
                                            {item.unit}
                                            <DestinationHint
                                              productName={product.productName}
                                              spec={item.spec}
                                              unit={item.unit}
                                              quantity={item.quantity}
                                              salesItems={selectedData.salesItems}
                                            />
                                            {item.remark && (
                                              <span className="block text-[10px] text-[var(--erp-text-muted)]/70">
                                                비고: {item.remark}
                                              </span>
                                            )}
                                          </span>
                                          <span className="shrink-0">
                                            {item.amount.toLocaleString()}원
                                          </span>
                                        </Link>
                                      </li>
                                    ))}
                                    {(() => {
                                      const totals = productTotals(
                                        product.items,
                                      );
                                      return (
                                        <li className="flex items-start justify-between gap-2">
                                          <span className="min-w-0">
                                            합계 -{" "}
                                            {totals.quantity.toLocaleString()}
                                            {totals.unit}
                                            {anyCarryover && <CarryoverBadge />}
                                          </span>
                                          <span className="shrink-0">
                                            {totals.amount.toLocaleString()}원
                                          </span>
                                        </li>
                                      );
                                    })()}
                                  </>
                                )}
                              </ul>
                            </div>
                          );
                        })}
                        {partner.paperCalcBlocks.map((block, bi) => (
                          <div key={bi}>
                            <p className="font-semibold text-[var(--erp-text)]">
                              - {paperStockProductName}
                              {block.label && ` (${block.label})`}
                            </p>
                            <ul className="space-y-1 pl-3 font-normal text-[var(--erp-text-muted)]">
                              {formatPaperCalcSizeLines(block.sizes).map((line, i) => (
                                <li key={i}>{line}</li>
                              ))}
                              <li className="flex items-start justify-between gap-2 text-[var(--erp-primary)]">
                                <span className="min-w-0">
                                  합계 - {block.totalSheet.toLocaleString()}연
                                </span>
                                <span className="shrink-0">
                                  {block.amount.toLocaleString()}원
                                </span>
                              </li>
                            </ul>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div
              className="mb-4 border-l-[3px] border-l-[var(--erp-success)] p-2"
              style={{
                background:
                  "linear-gradient(90deg, var(--erp-success-bg), transparent 60%)",
              }}
            >
              <p className="mb-1 text-xs font-bold text-[var(--erp-success)]">
                매출 {selectedData.salesCount}건 ·{" "}
                {selectedData.salesTotal.toLocaleString()}원
              </p>
              {(selectedData.salesItems.length > 0 ||
                Object.keys(selectedData.salesPaperCalcByPartner).length >
                  0) && (
                <div className="space-y-2 text-xs font-medium text-[var(--erp-success)]">
                  {buildPartnerBlocks(
                    selectedData.salesItems,
                    selectedData.salesPaperCalcByPartner,
                  ).map((partner, pi) => (
                    <div key={pi}>
                      <p className="font-bold">- {partner.partnerName}</p>
                      <div className="space-y-1 pl-3">
                        {partner.products.map((product, di) => {
                          const anyCarryover = product.items.some(
                            (item) => item.isCarryover,
                          );
                          return (
                            <div key={di}>
                              <p className="font-semibold text-[var(--erp-text)]">
                                - {product.productName}
                              </p>
                              <ul className="space-y-1 pl-3 font-normal text-[var(--erp-text-muted)]">
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
                                            {item.spec || "규격 미지정"} :{" "}
                                            {item.quantity.toLocaleString()}
                                            {item.unit}
                                            {item.isCarryover && (
                                              <CarryoverBadge />
                                            )}
                                            {item.isReturn && <ReturnBadge />}
                                            {!item.isReturn && (
                                              <StockOriginHint
                                                productName={product.productName}
                                                spec={item.spec}
                                                unit={item.unit}
                                                quantity={item.quantity}
                                                purchaseItems={selectedData.purchaseItems}
                                              />
                                            )}
                                            {item.remark && (
                                              <span className="block text-[10px] text-[var(--erp-text-muted)]/70">
                                                비고: {item.remark}
                                              </span>
                                            )}
                                          </span>
                                          <span className="shrink-0">
                                            {item.amount.toLocaleString()}원
                                          </span>
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
                                            {item.spec || "규격 미지정"} :{" "}
                                            {item.quantity.toLocaleString()}
                                            {item.unit}
                                            {item.isReturn && <ReturnBadge />}
                                            {!item.isReturn && (
                                              <StockOriginHint
                                                productName={product.productName}
                                                spec={item.spec}
                                                unit={item.unit}
                                                quantity={item.quantity}
                                                purchaseItems={selectedData.purchaseItems}
                                              />
                                            )}
                                            {item.remark && (
                                              <span className="block text-[10px] text-[var(--erp-text-muted)]/70">
                                                비고: {item.remark}
                                              </span>
                                            )}
                                          </span>
                                          <span className="shrink-0">
                                            {item.amount.toLocaleString()}원
                                          </span>
                                        </Link>
                                      </li>
                                    ))}
                                    {(() => {
                                      const totals = productTotals(
                                        product.items,
                                      );
                                      return (
                                        <li className="flex items-start justify-between gap-2">
                                          <span className="min-w-0">
                                            합계 -{" "}
                                            {totals.quantity.toLocaleString()}
                                            {totals.unit}
                                            {anyCarryover && <CarryoverBadge />}
                                          </span>
                                          <span className="shrink-0">
                                            {totals.amount.toLocaleString()}원
                                          </span>
                                        </li>
                                      );
                                    })()}
                                  </>
                                )}
                              </ul>
                            </div>
                          );
                        })}
                        {partner.paperCalcBlocks.map((block, bi) => (
                          <div key={bi}>
                            <p className="font-semibold text-[var(--erp-text)]">
                              - {paperStockProductName}
                              {block.label && ` (${block.label})`}
                            </p>
                            <ul className="space-y-1 pl-3 font-normal text-[var(--erp-text-muted)]">
                              {formatPaperCalcSizeLines(block.sizes).map((line, i) => (
                                <li key={i}>{line}</li>
                              ))}
                              <li className="flex items-start justify-between gap-2 text-[var(--erp-success)]">
                                <span className="min-w-0">
                                  합계 - {block.totalSheet.toLocaleString()}연
                                </span>
                                <span className="shrink-0">
                                  {block.amount.toLocaleString()}원
                                </span>
                              </li>
                            </ul>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <NoteForm
              dateStr={selected}
              notes={selectedData.notes}
              currentUserId={currentUserId}
              isAdmin={isAdmin}
            />
          </>
        ) : (
          <p className="text-sm text-[var(--erp-text-muted)]">
            날짜를 선택해주세요.
          </p>
        )}
      </div>
    </div>
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
        className="block text-xs font-medium"
        style={{ color: "var(--erp-text-muted)" }}
      >
        메모
      </label>
      {notes.length > 0 && (
        <ul className="space-y-2">
          {notes.map((note) => (
            <li key={note.id} className="flex items-start gap-2">
              <span
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-extrabold"
                style={{
                  background: "var(--erp-selected)",
                  color: "var(--erp-primary)",
                }}
              >
                {note.authorName.slice(0, 1)}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline gap-1.5">
                  <span className="text-xs font-bold text-[var(--erp-text)]">
                    {note.authorName}
                  </span>
                  <span
                    className="text-[10.5px]"
                    style={{ color: "var(--erp-text-muted)" }}
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
          className="erp-btn erp-btn-primary"
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
