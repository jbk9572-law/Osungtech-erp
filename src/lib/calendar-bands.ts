// 메인 달력 칸에 띠로 보여줄 내용을 날짜별로 만든다 — 매출·매입(업체명·품목 약식), 할 일, 일정, 재고 부족, 메모, 이월.
// 화면(칸 모양)과 분리한 순수 함수라서 어떤 날이든 같은 규칙(순서·개수·글귀)으로 나온다.

export type BandKind = "sales" | "purchase" | "todo" | "event" | "stock" | "note" | "carry";
export type Band = { kind: BandKind; tag: string; text: string };

export const MAX_BANDS = 4;

type ItemLike = { partnerName: string; productName: string; isCarryover?: boolean; isReturn?: boolean };
export type BandSource = {
  salesItems: ItemLike[];
  purchaseItems: ItemLike[];
  calendarItems: { title: string; allDay: boolean; startAt: string }[];
  todoItems: { title: string }[];
  notes: { content: string }[];
};

// 거래처별로 묶어 "에이티씨 · 크라프트지 외1" — 품목이 여러 개면 첫 품목 + 나머지 종류 수.
function partnerBands(items: ItemLike[], kind: "sales" | "purchase"): Band[] {
  const byPartner = new Map<string, ItemLike[]>();
  for (const it of items) {
    const list = byPartner.get(it.partnerName) ?? [];
    list.push(it);
    byPartner.set(it.partnerName, list);
  }
  const base = kind === "sales" ? "매출" : "매입";
  return [...byPartner.entries()].map(([partner, list]) => {
    const products = [...new Set(list.map((i) => i.productName))];
    const rest = products.length - 1;
    const allReturn = list.every((i) => i.isReturn);
    return { kind, tag: allReturn ? `${base}반품` : base, text: `${partner} · ${products[0]}${rest > 0 ? ` 외${rest}` : ""}` };
  });
}

export function buildDayBands(day: BandSource | undefined, opts: { lowStockCount: number }): { all: Band[]; shown: Band[]; more: number } {
  const all: Band[] = [];
  if (day) {
    all.push(...partnerBands(day.salesItems, "sales"), ...partnerBands(day.purchaseItems, "purchase"));
    for (const t of day.todoItems) all.push({ kind: "todo", tag: "할일", text: t.title });
    for (const e of day.calendarItems) all.push({ kind: "event", tag: e.allDay ? "" : e.startAt.slice(11, 16), text: e.title });
  }
  if (opts.lowStockCount > 0) all.push({ kind: "stock", tag: "재고", text: `부족 ${opts.lowStockCount}건` });
  if (day) {
    if (day.notes.length) all.push({ kind: "note", tag: "메모", text: day.notes[0].content + (day.notes.length > 1 ? ` 외${day.notes.length - 1}` : "") });
    const carry = [...day.salesItems, ...day.purchaseItems].filter((i) => i.isCarryover).length;
    if (carry > 0) all.push({ kind: "carry", tag: "이월", text: `${carry}건` });
  }
  return { all, shown: all.slice(0, MAX_BANDS), more: Math.max(0, all.length - MAX_BANDS) };
}

// 칸에 마우스를 올렸을 때 뜨는 전체 내용(줄바꿈으로 구분).
export function bandsTooltip(all: Band[]): string | undefined {
  return all.length ? all.map((b) => `${b.tag ? `${b.tag} ` : ""}${b.text}`).join("\n") : undefined;
}
