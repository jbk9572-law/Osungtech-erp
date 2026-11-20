import { createClient } from "@/lib/supabase/server";
import { CreateProductForm } from "@/components/create-product-form";
import { PartyNewSheet } from "@/components/erp/party-new-sheet";
import { importProductsExcel } from "@/app/(dashboard)/products/actions";
import { fetchAllRows } from "@/lib/fetch-all-rows";
import { isFeatureEnabled } from "@/lib/require-feature-enabled";

// 품목 신규 등록(C형 모달 내용) — 등록 폼 + 엑셀 일괄등록. 폼에 필요한 목록은 이 화면에서만 불러온다(목록 화면은 가볍게 유지).
export default async function NewProductPage() {
  const supabase = await createClient();
  const derivedSkuEnabled = await isFeatureEnabled(supabase, "derived_sku");
  const [categories, suppliers, parentCandidates] = await Promise.all([
    fetchAllRows<{ id: string; name: string }>((from, to) => supabase.from("categories").select("id, name").order("name").range(from, to)),
    fetchAllRows<{ id: string; name: string }>((from, to) => supabase.from("suppliers").select("id, name").order("name").range(from, to)),
    !derivedSkuEnabled
      ? Promise.resolve([])
      : fetchAllRows<{ id: string; sku: string; name: string; spec: string | null; unit: string | null; category_id: string | null }>((from, to) =>
          supabase.from("products").select("id, sku, name, spec, unit, category_id").is("parent_product_id", null).order("name").range(from, to),
        ),
  ]);
  return (
    <PartyNewSheet
      title="품목관리 &gt; 품목 추가"
      listHref="/products"
      tabLabel="품목 추가"
      form={<CreateProductForm categories={categories ?? []} suppliers={suppliers ?? []} parentCandidates={parentCandidates} />}
      importAction={importProductsExcel}
      templateHref="/templates/products-template.xlsx"
      exportHref="/api/products/export"
    />
  );
}
