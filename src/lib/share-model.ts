import { parseShareItems } from "@/lib/share-items";
import { quantityLabelByUnit } from "@/lib/quantity-by-unit";
import { cellAtX, cellCenterX, cellText } from "@/lib/grid-range-select";

// "공유 이미지"의 재료 — 목록에서 끌어 고른 줄을 (날짜 → 전표 → 품목) 구조로 바꾼다.
//  · 날짜는 파란 띠, 출고처(거래처)는 전표 줄 — 드래그하지 않았어도 항상 넣는다. 품명도 항상 넣는다(품목을 구분하려면 이름이 있어야 한다).
//  · 그 밖의 품목 열(규격·관리번호·수량·공급가·공급가액·세액·비고)은 드래그한 것만 나온다.
//  · "외 N건" 전표는 줄(<tr>)에 실어 둔 품목 정보(share-items.ts)로 품목마다 펼친다.
export type ItemRole = "name" | "spec" | "lot" | "qty" | "price" | "amount" | "tax" | "remark";
export const ITEM_ROLES: readonly ItemRole[] = ["name", "spec", "lot", "qty", "price", "amount", "tax", "remark"];

export type ShareItem = Record<ItemRole, string> & { include: boolean };
export type ShareEntry = { date: string; party: string; docNo: string; extras: string[]; items: ShareItem[]; include: boolean };
export type ShareModel = {
  title: string;
  today: string;
  roles: ItemRole[];
  entries: ShareEntry[];
  /** 이 표에 날짜·거래처·품명 열이 하나라도 있는가 — 없으면(거래처·재고 목록 등) 전표 카드가 의미 없으니 표 그림으로 복사한다. */
  recognized: boolean;
};

const ROLE_PATTERNS: [ItemRole, RegExp][] = [
  ["name", /^(품목명|품명)/],
  ["spec", /^규격/],
  ["lot", /^관리번호/],
  ["qty", /^수량/],
  ["amount", /^(공급가액|금액|합계)/],
  ["price", /^(공급가|단가|매입가)/],
  ["tax", /^세액/],
  ["remark", /^비고/],
];
export function roleOfLabel(label: string): ItemRole | null {
  const l = label.trim();
  return ROLE_PATTERNS.find(([, re]) => re.test(l))?.[0] ?? null;
}
// 매출은 "거래일자", 매입은 "매입일자"; "거래처코드"·"공급처코드"는 이름 열이 아니므로 거래처로 보지 않는다.
const DATE_HEAD = /^(거래일자|매출일자|매입일자|입고일자|출고일자|일자|날짜|작성일|발행일|기준일)/;
const PARTY_HEAD = /^(출고처|공급처|거래처|고객|납품처)(?!코드|번호)/;
const DOC_HEAD = /^전표번호/;
export const isDateHead = (h: string) => DATE_HEAD.test(h.trim());
export const isPartyHead = (h: string) => PARTY_HEAD.test(h.trim());

export function parseAmount(v: string): number | null {
  const m = v.replace(/,/g, "").match(/^\s*([-+]?\d+(?:\.\d+)?)/);
  return m ? Number(m[1]) : null;
}

const WEEK = ["일", "월", "화", "수", "목", "금", "토"];
/** "2026. 11. 16." → "11월 16일 (일)". 읽을 수 없는 형식(예: "11.16 이월")은 그대로. */
export function dateBandLabel(raw: string): string {
  const m = raw.match(/(\d{4})\D+(\d{1,2})\D+(\d{1,2})/);
  if (!m) return raw;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  return `${mo}월 ${d}일 (${WEEK[new Date(y, mo - 1, d).getDay()]})`;
}

type Cells = HTMLTableCellElement[];
const textOf = cellText;
const blank = (v: string) => !v || v === "-";

/** 고른 줄들(줄마다 칸 묶음)로 공유 이미지 재료를 만든다. 칸 위치는 화면 좌표로 머리글과 맞춘다. */
export function buildShareModel(table: HTMLTableElement, picked: Cells[]): ShareModel {
  const headRow = table.tHead?.rows[table.tHead.rows.length - 1];
  const heads = Array.from(headRow?.cells ?? []);
  const label = (th: HTMLTableCellElement) => (th.textContent ?? "").trim();
  const findTh = (pred: (l: string) => boolean) => heads.find((th) => pred(label(th))) ?? null;
  const thByRole = new Map<ItemRole, HTMLTableCellElement>();
  for (const th of heads) {
    const r = roleOfLabel(label(th));
    if (r && !thByRole.has(r)) thByRole.set(r, th);
  }
  const dateTh = findTh(isDateHead);
  const partyTh = findTh(isPartyHead);
  const docTh = findTh((l) => DOC_HEAD.test(l));

  // 드래그한 열: 첫 줄의 칸 위치에 맞는 머리글로 이름을 알아낸다
  const draggedLabels = (picked[0] ?? []).map((td) => {
    const x = cellCenterX(td);
    const th = heads.find((h) => {
      const b = h.getBoundingClientRect();
      return x >= b.left && x <= b.right;
    });
    return th ? label(th) : "";
  });
  const dragged = new Set<ItemRole>(["name"]);
  const extraLabels: string[] = [];
  for (const l of draggedLabels) {
    const r = roleOfLabel(l);
    if (r) dragged.add(r);
    else if (l && !isDateHead(l) && !isPartyHead(l) && !DOC_HEAD.test(l)) extraLabels.push(l);
  }
  const roles = ITEM_ROLES.filter((r) => dragged.has(r));

  const entries: ShareEntry[] = picked.map((cells) => {
    const tr = cells[0].parentElement as HTMLTableRowElement;
    const at = (th: HTMLTableCellElement | null | undefined) => (th ? textOf(cellAtX(tr, cellCenterX(th))) : "");
    const attr = parseShareItems(tr.dataset.shareItems);
    const rowItem = (): ShareItem => {
      const v = {} as ShareItem;
      for (const r of ITEM_ROLES) v[r] = at(thByRole.get(r)).replace(/^-$/, "");
      v.include = true;
      return v;
    };
    const items: ShareItem[] = attr
      ? attr.map((it) => ({ name: it.p, spec: it.s, lot: it.l, qty: it.q, price: it.u, amount: it.a, tax: it.t, remark: it.r, include: true }))
      : [rowItem()];
    const extras = extraLabels.map((l) => at(findTh((h) => h === l))).filter((v) => !blank(v));
    return { date: at(dateTh), party: at(partyTh), docNo: at(docTh), extras, items, include: true };
  });

  const title = (document.querySelector(".erp-h1")?.textContent ?? document.title ?? "목록").trim() || "목록";
  const today = new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Seoul" }).format(new Date()).replace(/-/g, ".");
  return { title, today, roles, entries, recognized: !!(dateTh || partyTh || thByRole.get("name")) };
}

/** 포함된 전표·품목만 — 이미지와 합계가 이것을 쓴다. */
export function includedEntries(model: ShareModel): ShareEntry[] {
  return model.entries
    .filter((e) => e.include)
    .map((e) => ({ ...e, items: e.items.filter((i) => i.include) }))
    .filter((e) => e.items.length > 0);
}

export type ShareTotals = { count: number; amount: number | null; amountLabel: string; qtyLabel: string | null };
export function shareTotals(model: ShareModel): ShareTotals {
  const entries = includedEntries(model);
  const hasAmount = model.roles.includes("amount");
  const amount = hasAmount ? entries.reduce((s, e) => s + e.items.reduce((t, i) => t + (parseAmount(i.amount) ?? 0), 0), 0) : null;
  const qtyLabel = model.roles.includes("qty")
    ? quantityLabelByUnit(
        entries.flatMap((e) =>
          // 이월 줄처럼 한 칸에 "225 ROLL · 532 KG"가 들어 있어도 단위별로 나눠 읽는다
          e.items.flatMap((i) =>
            i.qty.split("·").map((part) => {
              const m = part.replace(/,/g, "").match(/^\s*([-+]?\d+(?:\.\d+)?)\s*(.*)$/);
              return m ? { quantity: Number(m[1]), unit: m[2].trim() } : { quantity: 0, unit: "" };
            }),
          ),
        ),
      )
    : null;
  return { count: entries.length, amount, amountLabel: "공급가액", qtyLabel };
}
