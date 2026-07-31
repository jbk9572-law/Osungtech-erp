"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { combinePhone } from "@/lib/phone";
import type { FormState } from "@/components/form-message";
import { readExcelRows, cell, summarize, type ImportRowError } from "@/lib/excel-import";

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
    return { error: "저장에 실패했습니다." };
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
    return { error: "저장에 실패했습니다." };
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
        : "삭제에 실패했습니다.",
    };
  }

  revalidatePath("/suppliers");
  redirect("/suppliers");
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

  const supabase = await createClient();
  const { error } = await supabase
    .from("supplier_product_prices")
    .upsert(
      { supplier_id: supplierId, product_id: productId, unit_cost: unitCost },
      { onConflict: "supplier_id,product_id" }
    );

  if (error) {
    return { error: "저장에 실패했습니다." };
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
  const today = new Date().toLocaleDateString("sv-SE");
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
    return { error: "예약에 실패했습니다." };
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
  const today = new Date().toLocaleDateString("sv-SE");
  if (effectiveDate <= today) {
    return { error: "적용일은 내일 이후 날짜여야 합니다." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("purchase_price_change_schedules")
    .update({ new_unit_cost: newUnitCost, effective_date: effectiveDate })
    .eq("id", id)
    .is("applied_at", null);

  if (error) {
    return { error: "수정에 실패했습니다." };
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
  const { error } = await supabase
    .from("purchase_price_change_schedules")
    .delete()
    .eq("id", id)
    .is("applied_at", null);

  if (error) {
    return { error: "취소에 실패했습니다." };
  }

  if (supplierId) revalidatePath(`/suppliers/${supplierId}`);
  return { success: "예약을 취소했습니다." };
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
  const { data: existing } = await supabase.from("suppliers").select("id, name, business_number");
  const byBusinessNumber = new Map(
    (existing ?? []).filter((s) => s.business_number).map((s) => [s.business_number as string, s.id])
  );
  const byName = new Map((existing ?? []).map((s) => [s.name.trim(), s.id]));

  const errors: ImportRowError[] = [];
  let okCount = 0;

  for (let i = 0; i < rows.length; i++) {
    const rowNum = i + 2;
    const row = rows[i];
    const name = cell(row, "업체명");
    if (!name) {
      errors.push({ row: rowNum, reason: "업체명은 필수입니다." });
      continue;
    }

    const businessNumber = cell(row, "사업자등록번호") || null;
    const payload = {
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

    const { error } = existingId
      ? await supabase.from("suppliers").update(payload).eq("id", existingId)
      : await supabase.from("suppliers").insert(payload);

    if (error) {
      errors.push({ row: rowNum, reason: "저장 실패" });
      continue;
    }
    okCount++;
  }

  revalidatePath("/suppliers");
  return summarize(rows.length, okCount, errors);
}
