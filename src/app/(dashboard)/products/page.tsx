import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { CreateProductForm } from "@/components/create-product-form";
import { ExcelImportForm } from "@/components/excel-import-form";
import { importProductsExcel } from "@/app/(dashboard)/products/actions";
import { buildListReturnParam } from "@/lib/list-return";
import { ProductGridTable, type ProductGridRow } from "@/components/product-grid-table";
import { fetchAllRows } from "@/lib/fetch-all-rows";

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  // 목록에서 검색을 걸어둔 채로 상세를 열었다가 ESC/닫기로 돌아가면, 그
  // 조건 그대로(전체 목록이 아니라) 되돌아가게 한다.
  const backParam = buildListReturnParam({ q });
  const supabase = await createClient();
  const [allProducts, categories, suppliers] = await Promise.all([
    fetchAllRows<{
      id: string;
      sku: string;
      name: string;
      spec: string | null;
      unit: string;
      base_package_qty: number | null;
      cost: number;
      price: number;
      reorder_point: number | null;
      categories: { name: string } | null;
      suppliers: { name: string } | null;
    }>((from, to) =>
      supabase
        .from("products")
        .select("*, categories(name), suppliers(name)")
        .order("created_at", { ascending: false })
        .range(from, to),
    ),
    fetchAllRows<{ id: string; name: string }>((from, to) =>
      supabase.from("categories").select("id, name").order("name").range(from, to),
    ),
    fetchAllRows<{ id: string; name: string }>((from, to) =>
      supabase.from("suppliers").select("id, name").order("name").range(from, to),
    ),
  ]);

  const keyword = q?.trim().toLowerCase();
  const filteredProducts = keyword
    ? allProducts.filter(
        (p) =>
          p.name.toLowerCase().includes(keyword) ||
          p.sku.toLowerCase().includes(keyword) ||
          (p.spec ?? "").toLowerCase().includes(keyword)
      )
    : allProducts;

  const products: ProductGridRow[] = filteredProducts.map((p) => ({
    id: p.id,
    sku: p.sku,
    name: p.name,
    spec: p.spec,
    unit: p.unit,
    basePackageQty: p.base_package_qty,
    categoryName: p.categories?.name ?? null,
    supplierName: p.suppliers?.name ?? null,
    cost: p.cost,
    price: p.price,
    reorderPoint: p.reorder_point,
    quantity: 0,
  }));

  const exportHref = q ? `/api/products/export?q=${encodeURIComponent(q)}` : "/api/products/export";

  return (
    <div>
      <h1 className="mb-3 text-lg font-bold text-[var(--erp-text)]">품목관리</h1>

      <div className="erp-detail" style={{ marginTop: 0, marginBottom: 12 }}>
        <div className="erp-detail-tabs">
          <span className="erp-detail-tab active">품목 추가</span>
        </div>
        <div className="erp-detail-body">
          <CreateProductForm categories={categories ?? []} suppliers={suppliers ?? []} />
        </div>
      </div>

      <div className="erp-detail" style={{ marginTop: 0, marginBottom: 12 }}>
        <div className="erp-detail-tabs">
          <span className="erp-detail-tab active">엑셀 일괄등록</span>
        </div>
        <div className="erp-detail-body">
          <ExcelImportForm
            action={importProductsExcel}
            templateHref="/templates/products-template.xlsx"
            exportHref={exportHref}
          />
        </div>
      </div>

      <form method="get" className="erp-search">
        <div className="erp-field" style={{ minWidth: 220, flex: 1 }}>
          <label htmlFor="search-q">품목 / 규격 검색</label>
          <input
            id="search-q"
            type="text"
            name="q"
            autoComplete="off"
            defaultValue={q ?? ""}
            placeholder="상품명, SKU, 규격"
            className="erp-input"
            style={{ width: "100%" }}
          />
        </div>
        <button type="submit" className="erp-btn erp-btn-primary">
          조회
        </button>
        {q && (
          <Link href="/products" className="erp-btn">
            초기화
          </Link>
        )}
      </form>

      <ProductGridTable rows={products} mode="products" backParam={backParam ?? ""} keyword={keyword} />
    </div>
  );
}
