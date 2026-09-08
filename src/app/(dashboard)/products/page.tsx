import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { CreateProductForm } from "@/components/create-product-form";
import { ExcelImportForm } from "@/components/excel-import-form";
import { importProductsExcel } from "@/app/(dashboard)/products/actions";
import { buildListReturnParam } from "@/lib/list-return";
import { ProductGridTable, type ProductGridRow } from "@/components/product-grid-table";
import { fetchAllRows } from "@/lib/fetch-all-rows";
import { matchesSearch } from "@/lib/search-match";

const DEFAULT_LIST_LIMIT = 300;
const LIST_LIMIT_STEP = 300;

type ProductQueryRow = {
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
};

const PRODUCT_COLUMNS =
  "id, sku, name, spec, unit, base_package_qty, cost, price, reorder_point, categories(name), suppliers(name)";

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; limit?: string }>;
}) {
  const { q, limit: limitParam } = await searchParams;
  const parsedLimit = limitParam ? parseInt(limitParam, 10) : NaN;
  const limit = Number.isFinite(parsedLimit) && parsedLimit > 0 ? parsedLimit : DEFAULT_LIST_LIMIT;
  const keyword = q?.trim().toLowerCase();

  // 목록에서 검색을 걸어둔 채로 상세를 열었다가 ESC/닫기로 돌아가면, 그
  // 조건 그대로(전체 목록이 아니라) 되돌아가게 한다.
  const backParam = buildListReturnParam({ q, limit: limitParam });
  const supabase = await createClient();

  // 검색 중이 아닐 때는(=그냥 목록을 훑어보는, 압도적으로 흔한 경우) 최근
  // 등록순 상한(limit)까지만 가져온다 — 전체 품목을 매번 다 내려받아 필터링
  // 없이 그대로 그리드에 그리면, 품목이 늘어날수록 한 요청 안에서 처리할
  // 행 수가 그대로 늘어나 클라우드플레어 CPU 한도(Error 1102)를 넘기게
  // 된다(재고현황 화면도 같은 문제가 있었다). 검색어가 있을 때는 최근
  // limit개 안에서만 찾으면 오래된 품목을 못 찾을 수 있으므로, 그때만
  // 전체를 훑는다(매출/매입 목록과 달리 품목은 "최근 것만 봐도 충분한"
  // 화면이 아니라서 검색만큼은 정확도를 포기하지 않는다).
  let allProducts: ProductQueryRow[];
  let hasMore = false;
  if (keyword) {
    allProducts = await fetchAllRows<ProductQueryRow>((from, to) =>
      supabase
        .from("products")
        .select(PRODUCT_COLUMNS)
        .order("created_at", { ascending: false })
        .range(from, to),
    );
  } else {
    const { data } = await supabase
      .from("products")
      .select(PRODUCT_COLUMNS)
      .order("created_at", { ascending: false })
      .limit(limit);
    allProducts = data ?? [];
    hasMore = allProducts.length >= limit;
  }

  const [categories, suppliers] = await Promise.all([
    fetchAllRows<{ id: string; name: string }>((from, to) =>
      supabase.from("categories").select("id, name").order("name").range(from, to),
    ),
    fetchAllRows<{ id: string; name: string }>((from, to) =>
      supabase.from("suppliers").select("id, name").order("name").range(from, to),
    ),
  ]);

  const filteredProducts = keyword
    ? allProducts.filter((p) =>
        matchesSearch(keyword, p.name, p.sku, p.spec, p.categories?.name, p.suppliers?.name),
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
  const moreParams = new URLSearchParams();
  if (q) moreParams.set("q", q);
  moreParams.set("limit", String(limit + LIST_LIMIT_STEP));
  const moreHref = `/products?${moreParams.toString()}`;

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
            placeholder="상품명, SKU, 규격, 카테고리, 공급처"
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

      {!keyword && (
        <p className="mb-2 text-xs" style={{ color: "var(--erp-text-muted)" }}>
          최근 등록순 {limit.toLocaleString()}개까지 표시 중{hasMore ? " — 더 있을 수 있습니다." : "."}
        </p>
      )}

      <ProductGridTable rows={products} mode="products" backParam={backParam ?? ""} keyword={keyword} />

      {hasMore && (
        <div style={{ display: "flex", justifyContent: "center", marginTop: 12 }}>
          <Link href={moreHref} className="erp-btn">
            더보기 (다음 {LIST_LIMIT_STEP.toLocaleString()}개)
          </Link>
        </div>
      )}
    </div>
  );
}
