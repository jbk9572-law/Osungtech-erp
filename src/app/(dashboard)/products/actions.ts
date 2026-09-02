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

    const { data: created, error } = await supabase
      .from("categories")
      .insert({ name: newCategoryName })
      .select("id")
      .single();
    if (created) return created.id;
    // 이 조회~삽입 사이에 다른 사람이 같은 이름으로 먼저 만들었으면(동시
    // 등록) name의 unique 제약에 걸려 삽입이 실패한다 — 실패로 끝내지
    // 말고 그 사이 생긴 카테고리를 다시 조회해서 그걸 쓴다.
    if (error) {
      const { data: retry } = await supabase
        .from("categories")
        .select("id")
        .ilike("name", newCategoryName)
        .maybeSingle();
      if (retry) return retry.id;
    }
    return null;
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
  revalidatePath("/inventory");
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
  revalidatePath("/inventory");
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
  revalidatePath("/inventory");
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
      unit: string | null;
      base_package_qty: number | null;
      cost: number | null;
      price: number | null;
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

    // 규격/단위/공급처/매입단가/판매가/기초(포장수량) 칸은 여기서 바로
    // 확정하지 않는다 — 아래에서 기존 품목 값과 합쳐서, 이미 등록된
    // SKU인데 이번 파일엔 그 칸이 비어있으면 기존 값을 그대로
    // 유지한다(신규 SKU만 진짜 기본값을 쓴다).
    const cost = cellNumber(row, "매입단가");
    const price = cellNumber(row, "판매가");
    const basePackageQty = cellNumber(row, "기초");
    // 수기 입력 폼(validateProductFields)과 동일하게, 음수 값은 여기서
    // 바로 걸러낸다 — 안 그러면 엑셀로는 폼의 검증을 그냥 건너뛰고
    // 매입단가/판매가가 음수인 상품이 등록될 수 있다.
    if ((cost != null && cost < 0) || (price != null && price < 0) || (basePackageQty != null && basePackageQty < 0)) {
      errors.push({ row: rowNum, reason: "매입단가·판매가·기초수량은 0 이상이어야 합니다." });
      continue;
    }

    parsedRows.push({
      rowNum,
      supplierName: cell(row, "공급처") || null,
      payload: {
        sku,
        name,
        spec: cell(row, "규격") || null,
        unit: cell(row, "단위") || null,
        base_package_qty: basePackageQty,
        cost,
        price,
      },
    });
  }

  // 내보내기 파일을 그대로 재업로드하면 모든 칸이 채워져 있어 문제가
  // 없지만, "공급처만 일괄로 바꾸려고" SKU+공급처만 채운 축소된 시트를
  // 올리는 경우가 있다 — 이때 매입단가/판매가 칸이 비어있다고 그냥 0으로
  // upsert하면 기존 상품의 가격이 통째로 0원이 돼버린다. 이미 존재하는
  // SKU는 빈 칸을 기존 값으로 채워서, "적어낸 칸만 바뀌고 나머지는 그대로
  // 유지"되게 한다.
  const skusInFile = parsedRows.map((r) => r.payload.sku);
  const existingProducts = skusInFile.length
    ? await fetchAllRows<{
        sku: string;
        spec: string | null;
        unit: string;
        cost: number | null;
        price: number | null;
        base_package_qty: number | null;
        supplier_id: string | null;
      }>((from, to) =>
        supabase
          .from("products")
          .select("sku, spec, unit, cost, price, base_package_qty, supplier_id")
          .in("sku", skusInFile)
          .range(from, to),
      )
    : [];
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const existingBySku = new Map(existingProducts.map((p) => [p.sku, p]));

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

  const productRows = parsedRows.map((r) => {
    const existing = existingBySku.get(r.payload.sku);
    return {
      rowNum: r.rowNum,
      payload: {
        ...r.payload,
        spec: r.payload.spec ?? existing?.spec ?? null,
        unit: r.payload.unit ?? existing?.unit ?? "ea",
        cost: r.payload.cost ?? existing?.cost ?? 0,
        price: r.payload.price ?? existing?.price ?? 0,
        base_package_qty: r.payload.base_package_qty ?? existing?.base_package_qty ?? null,
        supplier_id: r.supplierName
          ? (supplierByName.get(r.supplierName) ?? null)
          : (existing?.supplier_id ?? null),
      },
    };
  });

  // 한 번에 하나씩 upsert하면 왕복이 행 수만큼 생긴다 — 청크 단위로 묶어서
  // 보낸다. 청크 안에서 실패하면(공유 원인일 가능성이 높음) 그 청크의
  // 모든 행을 실패로 표시한다 — 행 단위 원인 구분은 못 하지만, 실제로
  // 실패하는 경우는 드물고(온컨플릭트라 SKU 중복은 갱신으로 처리됨) 왕복
  // 횟수를 극적으로 줄이는 이득이 더 크다.
  const CHUNK_SIZE = 500;
  let okCount = 0;
  for (let i = 0; i < productRows.length; i += CHUNK_SIZE) {
    const chunk = productRows.slice(i, i + CHUNK_SIZE);
    const { data: upserted, error } = await supabase
      .from("products")
      .upsert(
        chunk.map((r) => r.payload),
        { onConflict: "sku" }
      )
      .select("id, sku");
    if (error) {
      for (const { rowNum } of chunk) {
        errors.push({ row: rowNum, reason: error.message.includes("duplicate") ? "SKU 중복" : "저장 실패" });
      }
      continue;
    }
    okCount += chunk.length;

    // 수기 등록/수정과 동일하게, 이 일괄등록으로 base_package_qty가
    // 실제로 바뀐 행은 이력에 남긴다 — 행마다 따로 기록하면 500행 청크에
    // 왕복이 그만큼 늘어나니 청크당 한 번에 모아 넣는다.
    const idBySku = new Map((upserted ?? []).map((p) => [p.sku, p.id]));
    const historyRows = chunk
      .map((r) => {
        const productId = idBySku.get(r.payload.sku);
        const previousQty = existingBySku.get(r.payload.sku)?.base_package_qty ?? null;
        const newQty = r.payload.base_package_qty;
        if (!productId || newQty == null || newQty === previousQty) return null;
        return { product_id: productId, base_package_qty: newQty, changed_by: user?.id ?? null };
      })
      .filter((row): row is NonNullable<typeof row> => row !== null);
    if (historyRows.length > 0) {
      const { error: historyError } = await supabase
        .from("product_package_qty_history")
        .insert(historyRows);
      if (historyError) {
        console.error("박스입수 변경 이력 저장 실패:", historyError.message);
      }
    }
  }

  revalidatePath("/products");
  revalidatePath("/inventory");
  return summarize(rows.length, okCount, errors);
}
