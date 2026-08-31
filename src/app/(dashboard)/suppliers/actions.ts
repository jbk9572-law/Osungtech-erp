"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { combinePhone } from "@/lib/phone";
import type { FormState } from "@/components/form-message";
import { readExcelRows, cell, summarize, type ImportRowError } from "@/lib/excel-import";
import { todayKstStr } from "@/lib/kst-date";
import { fetchAllRows } from "@/lib/fetch-all-rows";

function supplierFieldsFrom(formData: FormData) {
  return {
    business_number: String(formData.get("business_number") ?? "") || null,
    representative_name: String(formData.get("representative_name") ?? "") || null,
    contact_name: String(formData.get("contact_name") ?? "") || null,
    email: String(formData.get("email") ?? "") || null,
    phone: combinePhone(formData),
    address: String(formData.get("address") ?? "") || null,
    notes: String(formData.get("notes") ?? "") || null,
  };
}

export async function createSupplier(_prevState: FormState, formData: FormData): Promise<FormState> {
  const name = String(formData.get("name") ?? "").trim();
  if (!name) {
    return { error: "업체명을 입력해주세요." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("suppliers").insert({
    name,
    ...supplierFieldsFrom(formData),
  });

  if (error) {
    return { error: `저장에 실패했습니다: ${error.message}` };
  }

  revalidatePath("/suppliers");
  return { success: "공급처가 등록되었습니다." };
}

export async function updateSupplier(_prevState: FormState, formData: FormData): Promise<FormState> {
  const id = String(formData.get("id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  if (!id || !name) {
    return { error: "업체명을 입력해주세요." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("suppliers")
    .update({ name, ...supplierFieldsFrom(formData) })
    .eq("id", id);

  if (error) {
    return { error: `저장에 실패했습니다: ${error.message}` };
  }

  revalidatePath("/suppliers");
  revalidatePath(`/suppliers/${id}`);
  return { success: "공급처 정보가 저장되었습니다." };
}

export async function deleteSupplier(_prevState: FormState, formData: FormData): Promise<FormState> {
  const id = String(formData.get("id") ?? "");
  if (!id) {
    return { error: "잘못된 요청입니다." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("suppliers").delete().eq("id", id);

  if (error) {
    return {
      error: error.message.includes("foreign key")
        ? "이 공급처와 연결된 매입/상품 내역이 있어 삭제할 수 없습니다."
        : `삭제에 실패했습니다: ${error.message}`,
    };
  }

  revalidatePath("/suppliers");
  redirect("/suppliers");
}

export async function bulkDeleteSuppliers(_prevState: FormState, formData: FormData): Promise<FormState> {
  let ids: string[];
  try {
    ids = JSON.parse(String(formData.get("ids") ?? "[]"));
  } catch {
    return { error: "잘못된 요청입니다." };
  }
  if (!Array.isArray(ids) || ids.length === 0) {
    return { error: "삭제할 항목을 선택해주세요." };
  }

  const supabase = await createClient();
  const results = await Promise.all(ids.map((id) => supabase.from("suppliers").delete().eq("id", id)));
  const failCount = results.filter((r) => r.error).length;

  revalidatePath("/suppliers");

  if (failCount > 0) {
    return {
      error: `${ids.length - failCount}건 삭제, ${failCount}건은 연결된 매입/상품 내역이 있어 삭제하지 못했습니다.`,
    };
  }
  return { success: `${ids.length}건 삭제했습니다.` };
}

export async function upsertSupplierPrice(
  _prevState: FormState,
  formData: FormData
): Promise<FormState> {
  const supplierId = String(formData.get("supplier_id") ?? "");
  const productId = String(formData.get("product_id") ?? "");
  const unitCost = Number(formData.get("unit_cost") ?? 0);
  if (!supplierId || !productId) {
    return { error: "상품을 선택해주세요." };
  }
  if (unitCost < 0) {
    return { error: "단가는 0 이상이어야 합니다." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("supplier_product_prices")
    .upsert(
      { supplier_id: supplierId, product_id: productId, unit_cost: unitCost },
      { onConflict: "supplier_id,product_id" }
    );

  if (error) {
    return { error: `저장에 실패했습니다: ${error.message}` };
  }

  revalidatePath(`/suppliers/${supplierId}`);
  return { success: "매입단가가 저장되었습니다." };
}

// 미래 특정 날짜부터 적용할 매입단가를 예약해둔다. customers/actions.ts의
// schedulePriceChange와 동일한 이유로(supplier_product_prices가 "공급처+상품당
// 최신 단가 하나"만 남기는 구조라서) 별도 테이블에 쌓아두고, 그 날짜가 된 뒤
// 화면을 열 때 applyDuePurchasePriceSchedules가 반영한다.
export async function schedulePurchasePriceChange(
  _prevState: FormState,
  formData: FormData
): Promise<FormState> {
  const supplierId = String(formData.get("supplier_id") ?? "");
  const productId = String(formData.get("product_id") ?? "");
  const newUnitCost = Number(formData.get("new_unit_cost") ?? 0);
  const effectiveDate = String(formData.get("effective_date") ?? "");

  if (!supplierId || !productId || !effectiveDate) {
    return { error: "상품과 적용일을 모두 입력해주세요." };
  }
  if (newUnitCost < 0) {
    return { error: "단가는 0 이상이어야 합니다." };
  }
  const today = todayKstStr();
  if (effectiveDate <= today) {
    return { error: "적용일은 내일 이후 날짜여야 합니다." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { error } = await supabase.from("purchase_price_change_schedules").insert({
    supplier_id: supplierId,
    product_id: productId,
    new_unit_cost: newUnitCost,
    effective_date: effectiveDate,
    created_by: user?.id ?? null,
  });

  if (error) {
    return { error: `예약에 실패했습니다: ${error.message}` };
  }

  revalidatePath(`/suppliers/${supplierId}`);
  return { success: "단가 변경을 예약했습니다." };
}

export async function updatePurchasePriceSchedule(
  _prevState: FormState,
  formData: FormData
): Promise<FormState> {
  const id = String(formData.get("id") ?? "");
  const supplierId = String(formData.get("supplier_id") ?? "");
  const newUnitCost = Number(formData.get("new_unit_cost") ?? 0);
  const effectiveDate = String(formData.get("effective_date") ?? "");

  if (!id || !effectiveDate) {
    return { error: "적용일을 입력해주세요." };
  }
  if (newUnitCost < 0) {
    return { error: "단가는 0 이상이어야 합니다." };
  }
  const today = todayKstStr();
  if (effectiveDate <= today) {
    return { error: "적용일은 내일 이후 날짜여야 합니다." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("purchase_price_change_schedules")
    .update({ new_unit_cost: newUnitCost, effective_date: effectiveDate })
    .eq("id", id)
    .is("applied_at", null)
    .select("id");

  if (error) {
    return { error: `수정에 실패했습니다: ${error.message}` };
  }
  if (!data || data.length === 0) {
    return { error: "본인이 등록한 예약만 수정할 수 있습니다." };
  }

  if (supplierId) revalidatePath(`/suppliers/${supplierId}`);
  return { success: "단가 예약을 수정했습니다." };
}

export async function cancelPurchasePriceSchedule(
  _prevState: FormState,
  formData: FormData
): Promise<FormState> {
  const id = String(formData.get("id") ?? "");
  const supplierId = String(formData.get("supplier_id") ?? "");
  if (!id) return { error: "잘못된 요청입니다." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("purchase_price_change_schedules")
    .delete()
    .eq("id", id)
    .is("applied_at", null)
    .select("id");

  if (error) {
    return { error: `취소에 실패했습니다: ${error.message}` };
  }
  if (!data || data.length === 0) {
    return { error: "본인이 등록한 예약만 취소할 수 있습니다." };
  }

  if (supplierId) revalidatePath(`/suppliers/${supplierId}`);
  return { success: "예약을 취소했습니다." };
}

// 이 공급처에 준 돈(지급) 한 건을 기록한다. customer_payments/수금과 대칭
// 구조 — 잔액은 (매입 누계 - 지급 누계)로 그때그때 계산한다.
export async function addSupplierPayment(_prevState: FormState, formData: FormData): Promise<FormState> {
  const supplierId = String(formData.get("supplier_id") ?? "");
  const paidAt = String(formData.get("paid_at") ?? "");
  const amount = Number(formData.get("amount") ?? 0);
  if (!supplierId || !paidAt || !(amount > 0)) {
    return { error: "일자와 금액을 입력해주세요." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { error } = await supabase.from("supplier_payments").insert({
    supplier_id: supplierId,
    paid_at: paidAt,
    amount,
    method: String(formData.get("method") ?? "") || null,
    memo: String(formData.get("memo") ?? "") || null,
    created_by: user?.id ?? null,
  });

  if (error) {
    return { error: `저장에 실패했습니다: ${error.message}` };
  }

  revalidatePath(`/suppliers/${supplierId}`);
  revalidatePath("/payables");
  revalidatePath("/purchases");
  return { success: "지급 내역을 등록했습니다." };
}

export async function deleteSupplierPayment(_prevState: FormState, formData: FormData): Promise<FormState> {
  const id = String(formData.get("id") ?? "");
  const supplierId = String(formData.get("supplier_id") ?? "");
  if (!id) return { error: "잘못된 요청입니다." };

  const supabase = await createClient();
  const { data, error } = await supabase.from("supplier_payments").delete().eq("id", id).select("id");
  if (error) return { error: `삭제에 실패했습니다: ${error.message}` };
  if (!data || data.length === 0) return { error: "본인이 등록한 지급 내역만 삭제할 수 있습니다." };

  if (supplierId) revalidatePath(`/suppliers/${supplierId}`);
  revalidatePath("/payables");
  revalidatePath("/purchases");
  return { success: "삭제했습니다." };
}

export async function importSuppliersExcel(_prevState: FormState, formData: FormData): Promise<FormState> {
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

  const supabase = await createClient();

  // 사업자등록번호가 있으면 그걸로, 없으면 업체명으로 기존 공급처를 찾아 갱신하고
  // 못 찾으면 새로 등록한다.
  const existing = await fetchAllRows<{ id: string; name: string; business_number: string | null }>((from, to) =>
    supabase.from("suppliers").select("id, name, business_number").range(from, to),
  );
  const byBusinessNumber = new Map(
    existing.filter((s) => s.business_number).map((s) => [s.business_number as string, s.id])
  );
  const byName = new Map(existing.map((s) => [s.name.trim(), s.id]));

  type ImportPayload = {
    name: string;
    business_number: string | null;
    representative_name: string | null;
    contact_name: string | null;
    email: string | null;
    phone: string | null;
    address: string | null;
    notes: string | null;
  };

  const errors: ImportRowError[] = [];
  const toInsert: { rowNum: number; payload: ImportPayload }[] = [];
  const toUpdate: { rowNum: number; payload: ImportPayload & { id: string } }[] = [];

  for (let i = 0; i < rows.length; i++) {
    const rowNum = i + 2;
    const row = rows[i];
    const name = cell(row, "업체명");
    if (!name) {
      errors.push({ row: rowNum, reason: "업체명은 필수입니다." });
      continue;
    }

    const businessNumber = cell(row, "사업자등록번호") || null;
    const payload: ImportPayload = {
      name,
      business_number: businessNumber,
      representative_name: cell(row, "대표자명") || null,
      contact_name: cell(row, "담당자") || null,
      email: cell(row, "이메일") || null,
      phone: cell(row, "전화번호") || null,
      address: cell(row, "주소") || null,
      notes: cell(row, "비고") || null,
    };

    const existingId = (businessNumber && byBusinessNumber.get(businessNumber)) || byName.get(name.trim());
    if (existingId) {
      toUpdate.push({ rowNum, payload: { ...payload, id: existingId } });
    } else {
      toInsert.push({ rowNum, payload });
    }
  }

  // customers/actions.ts의 importCustomersExcel과 동일한 이유로 청크 단위
  // 배치 처리한다 — 신규는 insert, 기존은 id 기준 upsert로 갱신한다.
  const CHUNK_SIZE = 500;
  let okCount = 0;

  for (let i = 0; i < toInsert.length; i += CHUNK_SIZE) {
    const chunk = toInsert.slice(i, i + CHUNK_SIZE);
    const { error } = await supabase.from("suppliers").insert(chunk.map((r) => r.payload));
    if (error) {
      for (const { rowNum } of chunk) errors.push({ row: rowNum, reason: "저장 실패" });
      continue;
    }
    okCount += chunk.length;
  }

  for (let i = 0; i < toUpdate.length; i += CHUNK_SIZE) {
    const chunk = toUpdate.slice(i, i + CHUNK_SIZE);
    const { error } = await supabase.from("suppliers").upsert(chunk.map((r) => r.payload), { onConflict: "id" });
    if (error) {
      for (const { rowNum } of chunk) errors.push({ row: rowNum, reason: "저장 실패" });
      continue;
    }
    okCount += chunk.length;
  }

  revalidatePath("/suppliers");
  return summarize(rows.length, okCount, errors);
}

export type PartyTransactionRow = {
  id: string;
  kind: "purchase" | "payment";
  date: string;
  label: string;
  total: number;
  balance: number;
};

// 지급 등록 화면에서 "이 공급처 미결제 전표 조회"에 쓴다 — customers/actions.ts의
// getCustomerTransactionHistory와 동일한 방식(조회 전용, 실제 정산은
// lib/ar-ap.ts 그대로).
export async function getSupplierTransactionHistory(
  supplierId: string,
  fromDate?: string
): Promise<PartyTransactionRow[]> {
  const supabase = await createClient();
  const [orders, payments] = await Promise.all([
    fetchAllRows<{
      id: string;
      purchase_date: string;
      payment_method: string | null;
      purchase_order_items: { quantity: number; unit_cost: string | number; products: { name: string } | null }[];
    }>((from, to) =>
      supabase
        .from("purchase_orders")
        .select("id, purchase_date, payment_method, purchase_order_items(quantity, unit_cost, products(name))")
        .eq("supplier_id", supplierId)
        .order("purchase_date", { ascending: true })
        .range(from, to),
    ),
    fetchAllRows<{ id: string; paid_at: string; amount: string | number; memo: string | null }>((from, to) =>
      supabase
        .from("supplier_payments")
        .select("id, paid_at, amount, memo")
        .eq("supplier_id", supplierId)
        .order("paid_at", { ascending: true })
        .range(from, to),
    ),
  ]);

  type Entry = { id: string; kind: "purchase" | "payment"; date: string; label: string; total: number };
  const entries: Entry[] = [];

  for (const o of orders ?? []) {
    if (o.payment_method) continue;
    const items = o.purchase_order_items ?? [];
    const total = items.reduce((sum, i) => sum + i.quantity * Number(i.unit_cost), 0);
    const label = items.length
      ? `${items[0].products?.name ?? "-"}${items.length > 1 ? ` 외 ${items.length - 1}건` : ""}`
      : "매입";
    entries.push({ id: o.id, kind: "purchase", date: o.purchase_date, label, total });
  }
  for (const p of payments ?? []) {
    entries.push({ id: p.id, kind: "payment", date: p.paid_at, label: p.memo || "지급", total: Number(p.amount) });
  }
  entries.sort((a, b) => a.date.localeCompare(b.date) || (a.kind === "purchase" ? -1 : 1));

  let running = 0;
  const withBalance: PartyTransactionRow[] = entries.map((e) => {
    running += e.kind === "purchase" ? e.total : -e.total;
    return { ...e, balance: running };
  });

  const filtered = fromDate ? withBalance.filter((r) => r.date >= fromDate) : withBalance;
  return filtered.reverse();
}
