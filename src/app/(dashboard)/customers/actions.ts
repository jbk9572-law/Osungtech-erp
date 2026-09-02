"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { combinePhone } from "@/lib/phone";
import type { FormState } from "@/components/form-message";
import {
  readExcelRows,
  cell,
  summarize,
  fillBlankFieldsFromExisting,
  type ImportRowError,
} from "@/lib/excel-import";
import { todayKstStr } from "@/lib/kst-date";
import { fetchAllRows } from "@/lib/fetch-all-rows";
import { requireMutatedRow } from "@/lib/require-mutated-row";

const DELIVERY_NOTE_VARIANTS = ["sns_filtech", "zenith_tech", "ket_solution"] as const;

function customerFieldsFrom(formData: FormData) {
  const documentType = String(formData.get("document_type") ?? "명세표");
  const variant = String(formData.get("delivery_note_variant") ?? "");
  return {
    business_number: String(formData.get("business_number") ?? "") || null,
    representative_name: String(formData.get("representative_name") ?? "") || null,
    contact_name: String(formData.get("contact_name") ?? "") || null,
    email: String(formData.get("email") ?? "") || null,
    phone: combinePhone(formData),
    address: String(formData.get("address") ?? "") || null,
    notes: String(formData.get("notes") ?? "") || null,
    document_type: (documentType === "출고증" ? "출고증" : "명세표") as "출고증" | "명세표",
    delivery_note_variant: (DELIVERY_NOTE_VARIANTS as readonly string[]).includes(variant)
      ? (variant as (typeof DELIVERY_NOTE_VARIANTS)[number])
      : null,
  };
}

export async function createCustomer(_prevState: FormState, formData: FormData): Promise<FormState> {
  const name = String(formData.get("name") ?? "").trim();
  if (!name) {
    return { error: "출고처명을 입력해주세요." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("customers").insert({
    name,
    ...customerFieldsFrom(formData),
  });

  if (error) {
    return { error: `저장에 실패했습니다: ${error.message}` };
  }

  revalidatePath("/customers");
  return { success: "출고처가 등록되었습니다." };
}

export async function updateCustomer(_prevState: FormState, formData: FormData): Promise<FormState> {
  const id = String(formData.get("id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  if (!id || !name) {
    return { error: "출고처명을 입력해주세요." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("customers")
    .update({ name, ...customerFieldsFrom(formData) })
    .eq("id", id);

  if (error) {
    return { error: `저장에 실패했습니다: ${error.message}` };
  }

  revalidatePath("/customers");
  revalidatePath(`/customers/${id}`);
  return { success: "출고처 정보가 저장되었습니다." };
}

export async function deleteCustomer(_prevState: FormState, formData: FormData): Promise<FormState> {
  const id = String(formData.get("id") ?? "");
  if (!id) {
    return { error: "잘못된 요청입니다." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("customers").delete().eq("id", id);

  if (error) {
    return {
      error: error.message.includes("foreign key")
        ? "이 출고처와 연결된 매출/판매단가 내역이 있어 삭제할 수 없습니다."
        : `삭제에 실패했습니다: ${error.message}`,
    };
  }

  revalidatePath("/customers");
  redirect("/customers");
}

export async function bulkDeleteCustomers(_prevState: FormState, formData: FormData): Promise<FormState> {
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
  const results = await Promise.all(ids.map((id) => supabase.from("customers").delete().eq("id", id)));
  const failCount = results.filter((r) => r.error).length;

  revalidatePath("/customers");

  if (failCount > 0) {
    return {
      error: `${ids.length - failCount}건 삭제, ${failCount}건은 연결된 매출/판매단가 내역이 있어 삭제하지 못했습니다.`,
    };
  }
  return { success: `${ids.length}건 삭제했습니다.` };
}

export async function upsertCustomerPrice(
  _prevState: FormState,
  formData: FormData
): Promise<FormState> {
  const customerId = String(formData.get("customer_id") ?? "");
  const productId = String(formData.get("product_id") ?? "");
  const unitPrice = Number(formData.get("unit_price") ?? 0);
  if (!customerId || !productId) {
    return { error: "상품을 선택해주세요." };
  }
  if (unitPrice < 0) {
    return { error: "단가는 0 이상이어야 합니다." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("customer_product_prices")
    .upsert(
      { customer_id: customerId, product_id: productId, unit_price: unitPrice },
      { onConflict: "customer_id,product_id" }
    );

  if (error) {
    return { error: `저장에 실패했습니다: ${error.message}` };
  }

  revalidatePath(`/customers/${customerId}`);
  return { success: "판매단가가 저장되었습니다." };
}

// 이 거래처+상품 조합에만 해당하는 특이사항(예: "여유분 5매 추가해서
// 나감"). 거래처 전체 특이사항(customers.notes)과는 별도로, 매출 등록
// 화면에서 이 거래처와 이 상품을 함께 고르면 자동으로 보여준다.
export async function updateCustomerProductPriceNotes(
  _prevState: FormState,
  formData: FormData
): Promise<FormState> {
  const id = String(formData.get("id") ?? "");
  const customerId = String(formData.get("customer_id") ?? "");
  const notes = String(formData.get("notes") ?? "").trim();
  if (!id) return { error: "잘못된 요청입니다." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("customer_product_prices")
    .update({ notes: notes || null })
    .eq("id", id);

  if (error) {
    return { error: `저장에 실패했습니다: ${error.message}` };
  }

  if (customerId) revalidatePath(`/customers/${customerId}`);
  return { success: "특이사항을 저장했습니다." };
}

// 미래 특정 날짜부터 적용할 단가를 예약해둔다. customer_product_prices를
// 바로 바꾸지 않고 별도 테이블에 쌓아두는 이유는, 그 테이블이 "거래처+상품당
// 최신 단가 하나"만 남기는 구조라 지금 당장 바꾸면 그 사이 판매에도 새
// 단가가 잘못 적용되기 때문이다. 실제 반영은 그 날짜가 된 뒤 화면을 열 때
// applyDuePriceSchedules가 처리한다.
export async function schedulePriceChange(
  _prevState: FormState,
  formData: FormData
): Promise<FormState> {
  const customerId = String(formData.get("customer_id") ?? "");
  const productId = String(formData.get("product_id") ?? "");
  const newUnitPrice = Number(formData.get("new_unit_price") ?? 0);
  const effectiveDate = String(formData.get("effective_date") ?? "");

  if (!customerId || !productId || !effectiveDate) {
    return { error: "상품과 적용일을 모두 입력해주세요." };
  }
  if (newUnitPrice < 0) {
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

  const { error } = await supabase.from("price_change_schedules").insert({
    customer_id: customerId,
    product_id: productId,
    new_unit_price: newUnitPrice,
    effective_date: effectiveDate,
    created_by: user?.id ?? null,
  });

  if (error) {
    return { error: `예약에 실패했습니다: ${error.message}` };
  }

  revalidatePath(`/customers/${customerId}`);
  return { success: "단가 변경을 예약했습니다." };
}

// 아직 적용되지 않은 예약의 변경 단가/적용일을 고친다. 취소 후 다시
// 등록하는 대신 그 자리에서 바로 고칠 수 있게 한다.
export async function updatePriceSchedule(
  _prevState: FormState,
  formData: FormData
): Promise<FormState> {
  const id = String(formData.get("id") ?? "");
  const customerId = String(formData.get("customer_id") ?? "");
  const newUnitPrice = Number(formData.get("new_unit_price") ?? 0);
  const effectiveDate = String(formData.get("effective_date") ?? "");

  if (!id || !effectiveDate) {
    return { error: "적용일을 입력해주세요." };
  }
  if (newUnitPrice < 0) {
    return { error: "단가는 0 이상이어야 합니다." };
  }
  const today = todayKstStr();
  if (effectiveDate <= today) {
    return { error: "적용일은 내일 이후 날짜여야 합니다." };
  }

  const supabase = await createClient();
  const result = await supabase
    .from("price_change_schedules")
    .update({ new_unit_price: newUnitPrice, effective_date: effectiveDate })
    .eq("id", id)
    .is("applied_at", null)
    .select("id");

  const mutationError = requireMutatedRow(result, {
    onError: "수정에 실패했습니다",
    onForbidden: "본인이 등록한 예약만 수정할 수 있습니다.",
  });
  if (mutationError) return mutationError;

  if (customerId) revalidatePath(`/customers/${customerId}`);
  return { success: "단가 예약을 수정했습니다." };
}

export async function cancelPriceSchedule(_prevState: FormState, formData: FormData): Promise<FormState> {
  const id = String(formData.get("id") ?? "");
  const customerId = String(formData.get("customer_id") ?? "");
  if (!id) return { error: "잘못된 요청입니다." };

  const supabase = await createClient();
  const result = await supabase
    .from("price_change_schedules")
    .delete()
    .eq("id", id)
    .is("applied_at", null)
    .select("id");

  const mutationError = requireMutatedRow(result, {
    onError: "취소에 실패했습니다",
    onForbidden: "본인이 등록한 예약만 취소할 수 있습니다.",
  });
  if (mutationError) return mutationError;

  if (customerId) revalidatePath(`/customers/${customerId}`);
  return { success: "예약을 취소했습니다." };
}

// 이 거래처에서 받은 돈(수금) 한 건을 기록한다. 매출/매입 데이터는 건드리지
// 않고 별도 원장에 쌓아서, 잔액은 항상 (매출 누계 - 수금 누계)로 그때그때
// 계산한다.
export async function addCustomerPayment(_prevState: FormState, formData: FormData): Promise<FormState> {
  const customerId = String(formData.get("customer_id") ?? "");
  const paidAt = String(formData.get("paid_at") ?? "");
  const amount = Number(formData.get("amount") ?? 0);
  if (!customerId || !paidAt || !(amount > 0)) {
    return { error: "일자와 금액을 입력해주세요." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { error } = await supabase.from("customer_payments").insert({
    customer_id: customerId,
    paid_at: paidAt,
    amount,
    method: String(formData.get("method") ?? "") || null,
    memo: String(formData.get("memo") ?? "") || null,
    created_by: user?.id ?? null,
  });

  if (error) {
    return { error: `저장에 실패했습니다: ${error.message}` };
  }

  revalidatePath(`/customers/${customerId}`);
  revalidatePath("/receivables");
  revalidatePath("/sales");
  return { success: "수금 내역을 등록했습니다." };
}

export async function deleteCustomerPayment(_prevState: FormState, formData: FormData): Promise<FormState> {
  const id = String(formData.get("id") ?? "");
  const customerId = String(formData.get("customer_id") ?? "");
  if (!id) return { error: "잘못된 요청입니다." };

  const supabase = await createClient();
  const result = await supabase.from("customer_payments").delete().eq("id", id).select("id");
  const mutationError = requireMutatedRow(result, {
    onError: "삭제에 실패했습니다",
    onForbidden: "본인이 등록한 수금 내역만 삭제할 수 있습니다.",
  });
  if (mutationError) return mutationError;

  if (customerId) revalidatePath(`/customers/${customerId}`);
  revalidatePath("/receivables");
  revalidatePath("/sales");
  return { success: "삭제했습니다." };
}

export async function importCustomersExcel(_prevState: FormState, formData: FormData): Promise<FormState> {
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

  // 사업자등록번호가 있으면 그걸로, 없으면 상호명으로 기존 거래처를 찾아 갱신하고
  // 못 찾으면 새로 등록한다.
  const existing = await fetchAllRows<{
    id: string;
    name: string;
    business_number: string | null;
    representative_name: string | null;
    contact_name: string | null;
    email: string | null;
    phone: string | null;
    address: string | null;
    notes: string | null;
    document_type: string;
  }>((from, to) =>
    supabase
      .from("customers")
      .select(
        "id, name, business_number, representative_name, contact_name, email, phone, address, notes, document_type",
      )
      .range(from, to),
  );
  const byBusinessNumber = new Map(
    existing.filter((c) => c.business_number).map((c) => [c.business_number as string, c.id])
  );
  const byName = new Map(existing.map((c) => [c.name.trim(), c.id]));
  const existingById = new Map(existing.map((c) => [c.id, c]));

  type ImportPayload = {
    name: string;
    business_number: string | null;
    representative_name: string | null;
    contact_name: string | null;
    email: string | null;
    phone: string | null;
    address: string | null;
    notes: string | null;
    document_type: "출고증" | "명세표";
  };

  const errors: ImportRowError[] = [];
  const toInsert: { rowNum: number; payload: ImportPayload }[] = [];
  const toUpdate: { rowNum: number; payload: ImportPayload & { id: string } }[] = [];

  for (let i = 0; i < rows.length; i++) {
    const rowNum = i + 2;
    const row = rows[i];
    const name = cell(row, "상호명");
    if (!name) {
      errors.push({ row: rowNum, reason: "상호명은 필수입니다." });
      continue;
    }

    const businessNumber = cell(row, "사업자등록번호") || null;
    const documentTypeRaw = cell(row, "발행문서");
    const payload: ImportPayload = {
      name,
      business_number: businessNumber,
      representative_name: cell(row, "대표자명") || null,
      contact_name: cell(row, "담당자") || null,
      email: cell(row, "이메일") || null,
      phone: cell(row, "전화번호") || null,
      address: cell(row, "주소") || null,
      notes: cell(row, "비고") || null,
      document_type: (documentTypeRaw === "출고증" ? "출고증" : "명세표") as "출고증" | "명세표",
    };

    const existingId = (businessNumber && byBusinessNumber.get(businessNumber)) || byName.get(name.trim());
    if (existingId) {
      // 이미 있는 거래처를 갱신할 때, 이번 파일에서 비워둔 칸까지 그대로
      // 반영하면 기존 값이 null로 지워진다 — "공급처만 바꾸려고" 일부
      // 칸만 채운 축소된 시트를 올리는 경우 담당자/연락처가 통째로
      // 사라질 수 있다. 비어있는 칸은 기존 값을 그대로 유지한다.
      const prev = existingById.get(existingId);
      const merged = fillBlankFieldsFromExisting(payload, prev, [
        "representative_name",
        "contact_name",
        "email",
        "phone",
        "address",
        "notes",
      ]);
      toUpdate.push({
        rowNum,
        payload: {
          ...merged,
          document_type: documentTypeRaw
            ? payload.document_type
            : ((prev?.document_type as "출고증" | "명세표" | undefined) ?? payload.document_type),
          id: existingId,
        },
      });
    } else {
      toInsert.push({ rowNum, payload });
    }
  }

  // 행마다 update/insert를 따로 보내면 왕복이 행 수만큼 생긴다 — 신규 행은
  // 청크 단위로 한 번에 insert하고, 기존 행은 id 기준 upsert로 한 번에
  // 갱신한다(각 행이 서로 다른 id를 가지고 있어도 upsert는 행마다 정확히
  // 그 id를 갱신한다). 청크 안에서 실패하면 그 청크의 모든 행을 실패로
  // 표시한다.
  const CHUNK_SIZE = 500;
  let okCount = 0;

  for (let i = 0; i < toInsert.length; i += CHUNK_SIZE) {
    const chunk = toInsert.slice(i, i + CHUNK_SIZE);
    const { error } = await supabase.from("customers").insert(chunk.map((r) => r.payload));
    if (error) {
      for (const { rowNum } of chunk) errors.push({ row: rowNum, reason: "저장 실패" });
      continue;
    }
    okCount += chunk.length;
  }

  for (let i = 0; i < toUpdate.length; i += CHUNK_SIZE) {
    const chunk = toUpdate.slice(i, i + CHUNK_SIZE);
    const { error } = await supabase.from("customers").upsert(chunk.map((r) => r.payload), { onConflict: "id" });
    if (error) {
      for (const { rowNum } of chunk) errors.push({ row: rowNum, reason: "저장 실패" });
      continue;
    }
    okCount += chunk.length;
  }

  revalidatePath("/customers");
  return summarize(rows.length, okCount, errors);
}

export type PartyTransactionRow = {
  id: string;
  kind: "sale" | "collection";
  date: string;
  label: string;
  total: number;
  balance: number;
};

// 수금 등록 화면에서 "이 출고처 미결제 전표 조회"에 쓴다 — 실제 정산(어느
// 수금이 어느 전표를 갚았는지)은 여전히 lib/ar-ap.ts의 오래된 전표부터
// 상계 로직 그대로다. 여기서는 조회용으로 날짜순 누적잔액만 계산한다.
// getCustomerBalance와 동일하게, 결제방법을 등록한(그 자리에서 결제가
// 끝난) 매출은 잔액 계산에서 뺀다.
export async function getCustomerTransactionHistory(
  customerId: string,
  fromDate?: string
): Promise<PartyTransactionRow[]> {
  const supabase = await createClient();
  const [orders, payments] = await Promise.all([
    fetchAllRows<{
      id: string;
      order_date: string;
      payment_method: string | null;
      is_return: boolean;
      sales_order_items: { quantity: number; unit_price: string | number; products: { name: string } | null }[];
    }>((from, to) =>
      supabase
        .from("sales_orders")
        .select("id, order_date, payment_method, is_return, sales_order_items(quantity, unit_price, products(name))")
        .eq("customer_id", customerId)
        .order("order_date", { ascending: true })
        .range(from, to),
    ),
    fetchAllRows<{ id: string; paid_at: string; amount: string | number; memo: string | null }>((from, to) =>
      supabase
        .from("customer_payments")
        .select("id, paid_at, amount, memo")
        .eq("customer_id", customerId)
        .order("paid_at", { ascending: true })
        .range(from, to),
    ),
  ]);

  type Entry = { id: string; kind: "sale" | "collection"; date: string; label: string; total: number };
  const entries: Entry[] = [];

  for (const o of orders ?? []) {
    if (o.payment_method) continue;
    const items = o.sales_order_items ?? [];
    const sign = o.is_return ? -1 : 1;
    const total = items.reduce((sum, i) => sum + i.quantity * Number(i.unit_price), 0) * sign;
    const namePart = items.length
      ? `${items[0].products?.name ?? "-"}${items.length > 1 ? ` 외 ${items.length - 1}건` : ""}`
      : "매출";
    const label = o.is_return ? `[반품] ${namePart}` : namePart;
    entries.push({ id: o.id, kind: "sale", date: o.order_date, label, total });
  }
  for (const p of payments ?? []) {
    entries.push({ id: p.id, kind: "collection", date: p.paid_at, label: p.memo || "수금", total: Number(p.amount) });
  }
  entries.sort((a, b) => a.date.localeCompare(b.date) || (a.kind === "sale" ? -1 : 1));

  // total은 이미 매출/반품 부호가 반영된 값(반품은 음수)이라, 수금만
  // 반대 부호로 뒤집으면 된다.
  let running = 0;
  const withBalance: PartyTransactionRow[] = entries.map((e) => {
    running += e.kind === "sale" ? e.total : -e.total;
    return { ...e, balance: running };
  });

  const filtered = fromDate ? withBalance.filter((r) => r.date >= fromDate) : withBalance;
  return filtered.reverse();
}
