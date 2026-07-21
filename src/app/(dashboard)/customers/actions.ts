"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { combinePhone } from "@/lib/phone";
import type { FormState } from "@/components/form-message";
import { readExcelRows, cell, summarize, type ImportRowError } from "@/lib/excel-import";

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
    return { error: "거래처명을 입력해주세요." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("customers").insert({
    name,
    ...customerFieldsFrom(formData),
  });

  if (error) {
    return { error: "저장에 실패했습니다." };
  }

  revalidatePath("/customers");
  return { success: "거래처가 등록되었습니다." };
}

export async function updateCustomer(_prevState: FormState, formData: FormData): Promise<FormState> {
  const id = String(formData.get("id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  if (!id || !name) {
    return { error: "거래처명을 입력해주세요." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("customers")
    .update({ name, ...customerFieldsFrom(formData) })
    .eq("id", id);

  if (error) {
    return { error: "저장에 실패했습니다." };
  }

  revalidatePath("/customers");
  revalidatePath(`/customers/${id}`);
  return { success: "거래처 정보가 저장되었습니다." };
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
        ? "이 거래처와 연결된 매출/판매단가 내역이 있어 삭제할 수 없습니다."
        : "삭제에 실패했습니다.",
    };
  }

  revalidatePath("/customers");
  redirect("/customers");
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

  const supabase = await createClient();
  const { error } = await supabase
    .from("customer_product_prices")
    .upsert(
      { customer_id: customerId, product_id: productId, unit_price: unitPrice },
      { onConflict: "customer_id,product_id" }
    );

  if (error) {
    return { error: "저장에 실패했습니다." };
  }

  revalidatePath(`/customers/${customerId}`);
  return { success: "판매단가가 저장되었습니다." };
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
  const today = new Date().toLocaleDateString("sv-SE");
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
    return { error: "예약에 실패했습니다." };
  }

  revalidatePath(`/customers/${customerId}`);
  return { success: "단가 변경을 예약했습니다." };
}

export async function cancelPriceSchedule(_prevState: FormState, formData: FormData): Promise<FormState> {
  const id = String(formData.get("id") ?? "");
  const customerId = String(formData.get("customer_id") ?? "");
  if (!id) return { error: "잘못된 요청입니다." };

  const supabase = await createClient();
  const { error } = await supabase.from("price_change_schedules").delete().eq("id", id).is("applied_at", null);

  if (error) {
    return { error: "취소에 실패했습니다." };
  }

  if (customerId) revalidatePath(`/customers/${customerId}`);
  return { success: "예약을 취소했습니다." };
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
  const { data: existing } = await supabase.from("customers").select("id, name, business_number");
  const byBusinessNumber = new Map(
    (existing ?? []).filter((c) => c.business_number).map((c) => [c.business_number as string, c.id])
  );
  const byName = new Map((existing ?? []).map((c) => [c.name.trim(), c.id]));

  const errors: ImportRowError[] = [];
  let okCount = 0;

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
    const payload = {
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

    const { error } = existingId
      ? await supabase.from("customers").update(payload).eq("id", existingId)
      : await supabase.from("customers").insert(payload);

    if (error) {
      errors.push({ row: rowNum, reason: "저장 실패" });
      continue;
    }
    okCount++;
  }

  revalidatePath("/customers");
  return summarize(rows.length, okCount, errors);
}
