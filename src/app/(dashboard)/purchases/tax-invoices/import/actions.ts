"use server";

import { revalidatePath } from "next/cache";
import { createClient, getUser } from "@/lib/supabase/server";
import { fetchAllRows } from "@/lib/fetch-all-rows";
import { readExcelRows } from "@/lib/excel-import";
import { parseHometaxReceivedInvoiceRows, type ParsedReceivedInvoiceRow } from "@/lib/hometax-purchase-import";
import { calcVat } from "@/lib/tax";
import type { FormState } from "@/components/form-message";

type MatchCandidate = {
  id: string;
  purchase_date: string;
  suppliers: { business_number: string | null } | null;
  purchase_order_items: { quantity: number; unit_cost: number }[];
};

// 금액 비교는 반올림 오차를 감안해 100원까지는 같은 금액으로 본다.
const AMOUNT_TOLERANCE = 100;
const DATE_WINDOW_DAYS = 5;

function shiftDate(dateStr: string, days: number): string {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export type ImportResult =
  | (FormState & {
      imported?: number;
      duplicates?: number;
      matched?: number;
      unmatched?: number;
    })
  | undefined;

// 세금계산서 "발급" 쪽(hometax-bulk-export.ts)과 정반대 방향 — 홈택스
// 매입내역 다운로드 엑셀을 받아서 매입 건과 자동으로 짝지어준다. 같은
// 파일을 겹치는 기간으로 다시 올려도 승인번호 기준으로 중복 저장되지
// 않는다(테이블의 unique(tenant_id, hometax_approval_number) 제약 + 아래
// 사전 조회로 한 번 더 걸러냄).
export async function importHometaxReceivedInvoices(_prevState: ImportResult, formData: FormData): Promise<ImportResult> {
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { error: "엑셀 파일을 선택해주세요." };
  }

  let rows: Awaited<ReturnType<typeof readExcelRows>>;
  try {
    rows = await readExcelRows(file);
  } catch {
    return { error: "엑셀 파일을 읽을 수 없습니다. .xlsx 파일인지 확인해주세요." };
  }
  if (rows.length === 0) {
    return { error: "엑셀에 데이터 행이 없습니다." };
  }

  const { parsed, errors } = parseHometaxReceivedInvoiceRows(rows);
  if (parsed.length === 0) {
    return { error: errors[0]?.reason ?? "읽을 수 있는 데이터가 없습니다." };
  }

  const supabase = await createClient();
  const user = await getUser();

  const approvalNumbers = parsed.map((p) => p.approvalNumber);
  const existingRows = await fetchAllRows<{ hometax_approval_number: string }>((from, to) =>
    supabase
      .from("purchase_received_invoices")
      .select("hometax_approval_number")
      .in("hometax_approval_number", approvalNumbers)
      .range(from, to),
  );
  const existingApprovalNumbers = new Set(existingRows.map((r) => r.hometax_approval_number));

  const newRows: ParsedReceivedInvoiceRow[] = [];
  let duplicates = 0;
  for (const row of parsed) {
    if (existingApprovalNumbers.has(row.approvalNumber)) {
      duplicates++;
      continue;
    }
    newRows.push(row);
  }

  if (newRows.length === 0) {
    return {
      success: `새로 추가할 건이 없습니다 (전부 이미 가져온 승인번호 — 중복 ${duplicates}건).`,
      imported: 0,
      duplicates,
      matched: 0,
      unmatched: 0,
    };
  }

  const minDate = shiftDate(newRows.reduce((min, r) => (r.issueDate < min ? r.issueDate : min), newRows[0].issueDate), -DATE_WINDOW_DAYS);
  const maxDate = shiftDate(newRows.reduce((max, r) => (r.issueDate > max ? r.issueDate : max), newRows[0].issueDate), DATE_WINDOW_DAYS);

  const { data: candidates } = await supabase
    .from("purchase_orders")
    .select("id, purchase_date, suppliers(business_number), purchase_order_items(quantity, unit_cost)")
    .gte("purchase_date", minDate)
    .lte("purchase_date", maxDate)
    .returns<MatchCandidate[]>();

  // 이미 다른 수취 레코드에 매칭된 매입 건은 다시 매칭 대상에서 뺀다
  // (1건당 세금계산서 1장 원칙 — 같은 매입 건에 두 번째 수취 레코드를
  // 또 이어붙이지 않는다).
  const alreadyMatched = await fetchAllRows<{ purchase_order_id: string }>((from, to) =>
    supabase
      .from("purchase_received_invoices")
      .select("purchase_order_id")
      .not("purchase_order_id", "is", null)
      .range(from, to),
  );
  const matchedPurchaseOrderIds = new Set(alreadyMatched.map((r) => r.purchase_order_id));

  const toInsert: {
    hometax_approval_number: string;
    issue_date: string;
    supplier_business_number: string | null;
    supplier_name: string;
    supply_amount: number;
    tax_amount: number;
    total_amount: number;
    item_summary: string | null;
    purchase_order_id: string | null;
    matched_at: string | null;
    imported_by: string | null;
  }[] = [];

  let matched = 0;
  for (const row of newRows) {
    const orderTotal = (candidate: MatchCandidate) =>
      candidate.purchase_order_items.reduce((sum, item) => {
        const supply = item.quantity * item.unit_cost;
        return sum + supply + calcVat(supply);
      }, 0);

    const poCandidates = (candidates ?? []).filter(
      (c) =>
        !matchedPurchaseOrderIds.has(c.id) &&
        (!row.supplierBusinessNumber || c.suppliers?.business_number === row.supplierBusinessNumber) &&
        Math.abs(orderTotal(c) - row.totalAmount) <= AMOUNT_TOLERANCE,
    );

    let matchedId: string | null = null;
    if (poCandidates.length === 1) {
      matchedId = poCandidates[0].id;
      matchedPurchaseOrderIds.add(matchedId);
      matched++;
    }

    toInsert.push({
      hometax_approval_number: row.approvalNumber,
      issue_date: row.issueDate,
      supplier_business_number: row.supplierBusinessNumber,
      supplier_name: row.supplierName,
      supply_amount: row.supplyAmount,
      tax_amount: row.taxAmount,
      total_amount: row.totalAmount,
      item_summary: row.itemSummary,
      purchase_order_id: matchedId,
      matched_at: matchedId ? new Date().toISOString() : null,
      imported_by: user?.id ?? null,
    });
  }

  const { error: insertError } = await supabase.from("purchase_received_invoices").insert(toInsert);
  if (insertError) {
    return { error: `저장에 실패했습니다: ${insertError.message}` };
  }

  revalidatePath("/purchases/tax-invoices/import");
  revalidatePath("/purchases");

  const unmatched = newRows.length - matched;
  return {
    success: `${newRows.length}건 추가 (매칭 ${matched}건, 미매칭 ${unmatched}건)${duplicates > 0 ? ` · 중복 제외 ${duplicates}건` : ""}${errors.length > 0 ? ` · 읽기 실패 ${errors.length}건` : ""}`,
    imported: newRows.length,
    duplicates,
    matched,
    unmatched,
  };
}
