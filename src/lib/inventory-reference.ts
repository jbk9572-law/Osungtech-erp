import type { SupabaseClient } from "@supabase/supabase-js";
import { selectInChunks } from "@/lib/fetch-all-rows";
import type { Database } from "@/types/database.types";

// 재고 입출고 기록의 reference("sales_order:<uuid>" 같은 시스템 문자열)를
// 사람이 읽는 이름("매출 #123 · 거래처명")으로 바꾼다. 수불부 화면과 엑셀이
// 같은 함수를 쓴다 — 화면마다 따로 풀어 쓰면 표기가 어긋난다.

type RefKind = "sales_order" | "purchase_order" | "work_order";

// 전표번호까지 풀 수 있는 종류. 나머지는 종류 이름만 보여 준다.
const LOOKUP_RE = /^(sales_order|purchase_order|work_order)(_reversal|_delete)?:(.+)$/;
const SUFFIX_LABEL: Record<string, string> = { _reversal: "취소", _delete: "삭제" };

const PLAIN_LABEL: Array<[string, string]> = [
  ["stock_transfer_reversal:", "창고 이동 (취소)"],
  ["stock_transfer:", "창고 이동"],
  ["stock_loan_return:", "일시반출 반납"],
  ["stock_loan_cancel:", "일시반출 (취소)"],
  ["stock_loan:", "일시반출"],
  ["stock_count:", "재고실사"],
  ["process_step_return:", "공정 반납"],
  ["work_order_process_step:", "작업지시 공정"],
];

const KIND_NAME: Record<RefKind, string> = { sales_order: "매출", purchase_order: "매입", work_order: "작업지시" };
const KIND_PATH: Partial<Record<RefKind, string>> = { sales_order: "sales", purchase_order: "purchases" };

export type ReferenceInfo = { label: string; href: string | null };

type Parsed = { kind: RefKind; id: string; suffix: string };

function parse(reference: string): Parsed | null {
  const m = reference.match(LOOKUP_RE);
  if (!m) return null;
  return { kind: m[1] as RefKind, suffix: m[2] ?? "", id: m[3] };
}

function plainLabel(reference: string): string {
  const hit = PLAIN_LABEL.find(([prefix]) => reference.startsWith(prefix));
  return hit ? hit[1] : reference;
}

/** 참조 문자열 목록 → { 원문: {label, href} } (전표번호·거래처는 DB에서 한 번에 조회) */
export async function resolveInventoryReferences(
  supabase: SupabaseClient<Database>,
  references: Array<string | null | undefined>,
): Promise<Map<string, ReferenceInfo>> {
  const out = new Map<string, ReferenceInfo>();
  const parsed = new Map<string, Parsed>();
  for (const ref of new Set(references.filter((r): r is string => !!r))) {
    const p = parse(ref);
    if (p) parsed.set(ref, p);
    else out.set(ref, { label: plainLabel(ref), href: null });
  }
  const idsOf = (kind: RefKind) => [...new Set([...parsed.values()].filter((p) => p.kind === kind).map((p) => p.id))];

  const [sales, purchases, works] = await Promise.all([
    selectInChunks(idsOf("sales_order"), (idChunk) => supabase.from("sales_orders").select("id, doc_no, customers(name)").in("id", idChunk)),
    selectInChunks(idsOf("purchase_order"), (idChunk) =>
      supabase.from("purchase_orders").select("id, doc_no, suppliers(name)").in("id", idChunk),
    ),
    selectInChunks(idsOf("work_order"), (idChunk) => supabase.from("work_orders").select("id, doc_no").in("id", idChunk)),
  ]);

  const info = new Map<string, { docNo: number; party: string | null }>();
  for (const r of sales.data ?? []) info.set(`sales_order:${r.id}`, { docNo: r.doc_no, party: r.customers?.name ?? null });
  for (const r of purchases.data ?? [])
    info.set(`purchase_order:${r.id}`, { docNo: r.doc_no, party: r.suppliers?.name ?? null });
  for (const r of works.data ?? []) info.set(`work_order:${r.id}`, { docNo: r.doc_no, party: null });

  for (const [ref, p] of parsed) {
    const found = info.get(`${p.kind}:${p.id}`);
    const suffix = SUFFIX_LABEL[p.suffix] ? ` (${SUFFIX_LABEL[p.suffix]})` : "";
    // 전표가 지워졌으면 번호를 모른다 — 종류만 보여 준다(시스템 문자열은 노출하지 않는다)
    const base = found
      ? `${KIND_NAME[p.kind]} #${found.docNo}${found.party ? ` · ${found.party}` : ""}`
      : `${KIND_NAME[p.kind]} (삭제된 전표)`;
    const path = KIND_PATH[p.kind];
    out.set(ref, { label: `${base}${suffix}`, href: found && path ? `/${path}/${p.id}` : null });
  }
  return out;
}
