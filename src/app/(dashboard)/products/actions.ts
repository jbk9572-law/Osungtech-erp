"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { FormState } from "@/components/form-message";
import { readExcelRows, cell, cellNumber, summarize, type ImportRowError } from "@/lib/excel-import";

async function resolveCategoryId(
  supabase: Awaited<ReturnType<typeof createClient>>,
  formData: FormData
): Promise<string | null> {
  const newCategoryName = String(formData.get("new_category") ?? "").trim();
  if (newCategoryName) {
    const { data: existing } = await supabase
      .from("categories")
      .select("id")
      .ilike("name", newCategoryName)
      .maybeSingle();
    if (existing) return existing.id;

    const { data: created } = await supabase
      .from("categories")
      .insert({ name: newCategoryName })
      .select("id")
      .single();
    return created?.id ?? null;
  }
  return String(formData.get("category_id") ?? "") || null;
}

async function productFieldsFrom(supabase: Awaited<ReturnType<typeof createClient>>, formData: FormData) {
  return {
    category_id: await resolveCategoryId(supabase, formData),
    supplier_id: String(formData.get("supplier_id") ?? "") || null,
    spec: String(formData.get("spec") ?? "").trim() || null,
    unit: String(formData.get("unit") ?? "ea") || "ea",
    price: Number(formData.get("price") ?? 0),
    cost: Number(formData.get("cost") ?? 0),
    reorder_point: Number(formData.get("reorder_point") ?? 0),
    base_package_qty: formData.get("base_package_qty")
      ? Number(formData.get("base_package_qty"))
      : null,
  };
}

export async function createProduct(_prevState: FormState, formData: FormData): Promise<FormState> {
  const sku = String(formData.get("sku") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  if (!sku || !name) {
    return { error: "SKU와 상품명을 입력해주세요." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("products").insert({
    sku,
    name,
    ...(await productFieldsFrom(supabase, formData)),
  });

  if (error) {
    return { error: error.message.includes("duplicate") ? "이미 존재하는 SKU입니다." : "저장에 실패했습니다." };
  }

  revalidatePath("/products");
  return { success: "상품이 등록되었습니다." };
}

export async function updateProduct(_prevState: FormState, formData: FormData): Promise<FormState> {
  const id = String(formData.get("id") ?? "");
  const sku = String(formData.get("sku") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  if (!id || !sku || !name) {
    return { error: "SKU와 상품명을 입력해주세요." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("products")
    .update({ sku, name, ...(await productFieldsFrom(supabase, formData)) })
    .eq("id", id);

  if (error) {
    return { error: error.message.includes("duplicate") ? "이미 존재하는 SKU입니다." : "저장에 실패했습니다." };
  }

  revalidatePath("/products");
  revalidatePath(`/products/${id}`);
  return { success: "상품 정보가 저장되었습니다." };
}

export async function deleteProduct(_prevState: FormState, formData: FormData): Promise<FormState> {
  const id = String(formData.get("id") ?? "");
  if (!id) {
    return { error: "잘못된 요청입니다." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("products").delete().eq("id", id);

  if (error) {
    return {
      error: error.message.includes("foreign key")
        ? "이 상품과 연결된 매입/매출 내역이 있어 삭제할 수 없습니다."
        : "삭제에 실패했습니다.",
    };
  }

  revalidatePath("/products");
  redirect("/products");
}

export async function importProductsExcel(_prevState: FormState, formData: FormData): Promise<FormState> {
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

  const { data: existingSuppliers } = await supabase.from("suppliers").select("id, name");
  const supplierByName = new Map((existingSuppliers ?? []).map((s) => [s.name.trim(), s.id]));

  const errors: ImportRowError[] = [];
  const productRows: {
    rowNum: number;
    payload: {
      sku: string;
      name: string;
      spec: string | null;
      unit: string;
      base_package_qty: number | null;
      cost: number;
      price: number;
      supplier_id: string | null;
    };
  }[] = [];

  for (let i = 0; i < rows.length; i++) {
    const rowNum = i + 2; // 헤더가 1행이므로 데이터는 2행부터
    const row = rows[i];
    const sku = cell(row, "sku");
    const name = cell(row, "품목명");
    if (!sku || !name) {
      errors.push({ row: rowNum, reason: "sku/품목명은 필수입니다." });
      continue;
    }

    const supplierName = cell(row, "매입처");
    let supplierId: string | null = null;
    if (supplierName) {
      supplierId = supplierByName.get(supplierName) ?? null;
      if (!supplierId) {
        const { data: created, error: supplierError } = await supabase
          .from("suppliers")
          .insert({ name: supplierName })
          .select("id")
          .single();
        if (supplierError || !created) {
          errors.push({ row: rowNum, reason: `매입처 "${supplierName}" 생성 실패` });
          continue;
        }
        supplierId = created.id;
        supplierByName.set(supplierName, supplierId);
      }
    }

    productRows.push({
      rowNum,
      payload: {
        sku,
        name,
        spec: cell(row, "규격") || null,
        unit: cell(row, "단위") || "ea",
        base_package_qty: cellNumber(row, "기초"),
        cost: cellNumber(row, "매입단가") ?? 0,
        price: cellNumber(row, "판매가") ?? 0,
        supplier_id: supplierId,
      },
    });
  }

  let okCount = 0;
  for (const { rowNum, payload } of productRows) {
    const { error } = await supabase.from("products").upsert(payload, { onConflict: "sku" });
    if (error) {
      errors.push({ row: rowNum, reason: error.message.includes("duplicate") ? "SKU 중복" : "저장 실패" });
      continue;
    }
    okCount++;
  }

  revalidatePath("/products");
  return summarize(rows.length, okCount, errors);
}
