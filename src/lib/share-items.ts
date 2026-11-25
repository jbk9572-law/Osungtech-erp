import { formatNumber } from "@/lib/format-number";

// 목록 한 줄이 품목 여러 개("외 N건")일 때, 공유 이미지로 복사하면 품목까지 펼쳐서 보낼 수 있도록 줄(<tr>)에 품목 정보를 실어 둔다.
// 드래그로 고른 열만 펼친다 — 단가를 고르지 않았다면 품목 줄에도 단가가 나오지 않는다(lib/grid-range-copy.ts의 readShareData).
export type ShareItemInput = {
  productLabel: string;
  spec: string;
  lotNumber?: string | null;
  remark?: string | null;
  quantity: number;
  unit?: string | null;
  unitPrice?: number | null;
  unitCost?: number | null;
  supplyAmount: number;
  taxAmount: number;
};

export type ShareItem = { p: string; s: string; l: string; r: string; q: string; u: string; a: string; t: string };

/** 품목이 2건 이상일 때만 값을 돌려준다(한 건이면 펼칠 게 없다). */
export function buildShareItemsAttr(items: readonly ShareItemInput[] | undefined): string | undefined {
  if (!items || items.length < 2) return undefined;
  const out: ShareItem[] = items.map((i) => {
    const price = i.unitPrice ?? i.unitCost;
    return {
      p: i.productLabel,
      s: i.spec && i.spec !== "-" ? i.spec : "",
      l: i.lotNumber ?? "",
      r: i.remark ?? "",
      q: `${formatNumber(i.quantity)}${i.unit ? ` ${i.unit}` : ""}`,
      u: price == null ? "" : formatNumber(price),
      a: formatNumber(i.supplyAmount),
      t: formatNumber(i.taxAmount),
    };
  });
  return JSON.stringify(out);
}

/** 목록 열 이름 → 품목 값. 품목 단위로 펼칠 수 있는 열이면 값, 전표 단위 열(거래일자·전표번호 등)이면 null. */
export function shareItemValue(label: string, item: ShareItem): string | null {
  const l = label.trim();
  if (/^(품목명|품명)/.test(l)) return item.p;
  if (/^규격/.test(l)) return item.s;
  if (/^관리번호/.test(l)) return item.l;
  if (/^수량/.test(l)) return item.q;
  if (/^공급가액/.test(l)) return item.a;
  if (/^(공급가|단가|매입가)/.test(l)) return item.u;
  if (/^세액/.test(l)) return item.t;
  if (/^비고/.test(l)) return item.r;
  return null;
}

export function parseShareItems(raw: string | undefined): ShareItem[] | null {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw) as unknown;
    return Array.isArray(v) && v.length >= 2 ? (v as ShareItem[]) : null;
  } catch {
    return null;
  }
}
