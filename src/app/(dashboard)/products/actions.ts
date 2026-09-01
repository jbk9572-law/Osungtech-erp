"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { FormState } from "@/components/form-message";
import { readExcelRows, cell, cellNumber, summarize, type ImportRowError } from "@/lib/excel-import";
import { numberOrDefault, numberOrNull } from "@/lib/form-number";
import { fetchAllRows } from "@/lib/fetch-all-rows";

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
    price: numberOrDefault(formData.get("price"), 0),
    cost: numberOrDefault(formData.get("cost"), 0),
    reorder_point: numberOrDefault(formData.get("reorder_point"), 0),
    base_package_qty: numberOrNull(formData.get("base_package_qty")),
  };
}

function validateProductFields(fields: Awaited<ReturnType<typeof productFieldsFrom>>): string | null {
  if (fields.price < 0 || fields.cost < 0 || fields.reorder_point < 0) {
    return "판매가·매입가·재주문점은 0 이상이어야 합니다.";
  }
  if (fields.base_package_qty != null && fields.base_package_qty < 0) {
    return "기초수량은 0 이상이어야 합니다.";
  }
  return null;
}

// KG처럼 실제로 담기는 양에 따라 박스당 수량이 매번 달라지는 품목이
// 있어서, base_package_qty가 바뀔 때마다 이력을 남긴다(단가 이력과
// 같은 개념). 실패해도 상품 저장 자체는 이미 끝난 뒤라 조용히 넘어간다
// — 이력은 참고용 부가 정보다.
async function recordPackageQtyChange(
  supabase: Awaited<ReturnType<typeof createClient>>,
  productId: string,
  newQty: number | null,
  previousQty: number | null
) {
  if (newQty == null || newQty === previousQty) return;
  const {
    data: { user },
  } = await supabase.auth.getUser();
  await supabase
    .from("product_package_qty_history")
    .insert({ product_id: productId, base_package_qty: newQty, changed_by: user?.id ?? null });
}

export async function createProduct(_prevState: FormState, formData: FormData): Promise<FormState> {
  const sku = String(formData.get("sku") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  if (!sku || !name) {
    return { error: "SKU와 상품명을 입력해주세요." };
  }

  const supabase = await createClient();
  const fields = await productFieldsFrom(supabase, formData);
  const fieldError = validateProductFields(fields);
  if (fieldError) return { error: fieldError };
  const { data: created, error } = await supabase
    .from("products")
    .insert({ sku, name, ...fields })
    .select("id")
    .single();

  if (error || !created) {
    return {
      error: error?.message.includes("duplicate")
        ? "이미 존재하는 SKU입니다."
        : `저장에 실패했습니다${error ? `: ${error.message}` : ""}`,
    };
  }

  await recordPackageQtyChange(supabase, created.id, fields.base_package_qty, null);

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
  const { data: existing } = await supabase
    .from("products")
    .select("base_package_qty")
    .eq("id", id)
    .maybeSingle();
  const fields = await productFieldsFrom(supabase, formData);
  const fieldError = validateProductFields(fields);
  if (fieldError) return { error: fieldError };
  const { error } = await supabase
    .from("products")
    .update({ sku, name, ...fields })
    .eq("id", id);

  if (error) {
    return {
      error: error.message.includes("duplicate") ? "이미 존재하는 SKU입니다." : `저장에 실패했습니다: ${error.message}`,
    };
  }

  await recordPackageQtyChange(
    supabase,
    id,
    fields.base_package_qty,
    existing?.base_package_qty != null ? Number(existing.base_package_qty) : null
  );

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
        : `삭제에 실패했습니다: ${error.message}`,
    };
  }

  revalidatePath("/products");
  redirect("/products");
}

// 상품 삭제는 재고/거래처/과거 매입·매출 기록과 다 얽혀 있어 되돌릴 수 없다.
// 목록 화면(mode="products")에서만 호출되고, 실제 삭제 가능 여부는 결국
// FK 제약이 각 건마다 개별 판정한다(매입/매출 이력이 있으면 무조건 실패).
export async function bulkDeleteProducts(_prevState: FormState, formData: FormData): Promise<FormState> {
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
  const results = await Promise.all(ids.map((id) => supabase.from("products").delete().eq("id", id)));
  const failCount = results.filter((r) => r.error).length;

  revalidatePath("/products");
  revalidatePath("/inventory");

  if (failCount > 0) {
    return {
      error:
        failCount === ids.length
          ? "선택한 항목 전부 매입/매출 내역이 있어 삭제하지 못했습니다."
          : `${ids.length - failCount}건 삭제, ${failCount}건은 매입/매출 내역이 있어 삭제하지 못했습니다.`,
    };
  }
  return { success: `${ids.length}건 삭제했습니다.` };
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

  const existingSuppliers = await fetchAllRows<{ id: string; name: string }>((from, to) =>
    supabase.from("suppliers").select("id, name").range(from, to),
  );
  const supplierByName = new Map(existingSuppliers.map((s) => [s.name.trim(), s.id]));

  const errors: ImportRowError[] = [];
  const parsedRows: {
    rowNum: number;
    supplierName: string | null;
    payload: {
      sku: string;
      name: string;
      spec: string | null;
      unit: string;
      base_package_qty: number | null;
      cost: number;
      price: number;
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

    parsedRows.push({
      rowNum,
      supplierName: cell(row, "공급처") || null,
      payload: {
        sku,
        name,
        spec: cell(row, "규격") || null,
        unit: cell(row, "단위") || "ea",
        base_package_qty: cellNumber(row, "기초"),
        cost: cellNumber(row, "매입단가") ?? 0,
        price: cellNumber(row, "판매가") ?? 0,
      },
    });
  }

  // 행마다 공급처를 하나씩 조회/생성하면 수백 행짜리 파일은 그만큼 DB
  // 왕복이 생긴다 — 아직 없는 공급처 이름을 모아 한 번에 만든다.
  const newSupplierNames = [
    ...new Set(
      parsedRows
        .map((r) => r.supplierName)
        .filter((name): name is string => Boolean(name) && !supplierByName.has(name!))
    ),
  ];
  if (newSupplierNames.length > 0) {
    const { data: createdSuppliers, error: supplierError } = await supabase
      .from("suppliers")
      .insert(newSupplierNames.map((name) => ({ name })))
      .select("id, name");
    if (supplierError) {
      return { error: `공급처 일괄 생성에 실패했습니다: ${supplierError.message}` };
    }
    for (const s of createdSuppliers ?? []) supplierByName.set(s.name.trim(), s.id);
  }

  const productRows = parsedRows.map((r) => ({
    rowNum: r.rowNum,
    payload: { ...r.payload, supplier_id: r.supplierName ? (supplierByName.get(r.supplierName) ?? null) : null },
  }));

  // 한 번에 하나씩 upsert하면 왕복이 행 수만큼 생긴다 — 청크 단위로 묶어서
  // 보낸다. 청크 안에서 실패하면(공유 원인일 가능성이 높음) 그 청크의
  // 모든 행을 실패로 표시한다 — 행 단위 원인 구분은 못 하지만, 실제로
  // 실패하는 경우는 드물고(온컨플릭트라 SKU 중복은 갱신으로 처리됨) 왕복
  // 횟수를 극적으로 줄이는 이득이 더 크다.
  const CHUNK_SIZE = 500;
  let okCount = 0;
  for (let i = 0; i < productRows.length; i += CHUNK_SIZE) {
    const chunk = productRows.slice(i, i + CHUNK_SIZE);
    const { error } = await supabase
      .from("products")
      .upsert(
        chunk.map((r) => r.payload),
        { onConflict: "sku" }
      );
    if (error) {
      for (const { rowNum } of chunk) {
        errors.push({ row: rowNum, reason: error.message.includes("duplicate") ? "SKU 중복" : "저장 실패" });
      }
      continue;
    }
    okCount += chunk.length;
  }

  revalidatePath("/products");
  return summarize(rows.length, okCount, errors);
}
