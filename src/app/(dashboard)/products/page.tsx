import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { CreateProductForm } from "@/components/create-product-form";
import { ExcelImportForm } from "@/components/excel-import-form";
import { ProductDetailPanel } from "@/components/product-detail-panel";
import { KeyboardShortcuts } from "@/components/erp/keyboard-shortcuts";
import { DeleteButton } from "@/components/delete-button";
import { importProductsExcel, deleteProduct } from "@/app/(dashboard)/products/actions";
import { fetchAllRows } from "@/lib/fetch-all-rows";
import { matchesSearch } from "@/lib/search-match";
import { isUuid } from "@/lib/is-uuid";
import { formatNumber } from "@/lib/format-number";

const DEFAULT_LIST_LIMIT = 300;
const LIST_LIMIT_STEP = 300;

type ProductQueryRow = {
  id: string;
  sku: string;
  name: string;
  spec: string | null;
};

const PRODUCT_COLUMNS = "id, sku, name, spec";

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; limit?: string; id?: string }>;
}) {
  const { q, limit: limitParam, id } = await searchParams;
  const selectedId = id && isUuid(id) ? id : undefined;
  const parsedLimit = limitParam ? parseInt(limitParam, 10) : NaN;
  const limit = Number.isFinite(parsedLimit) && parsedLimit > 0 ? parsedLimit : DEFAULT_LIST_LIMIT;
  const keyword = q?.trim().toLowerCase();
  const supabase = await createClient();

  // 검색 중이 아닐 때는(=그냥 목록을 훑어보는, 압도적으로 흔한 경우) 최근
  // 등록순 상한(limit)까지만 가져온다 — 전체 품목을 매번 다 내려받아 필터링
  // 없이 그대로 그리드에 그리면, 품목이 늘어날수록 한 요청 안에서 처리할
  // 행 수가 그대로 늘어나 클라우드플레어 CPU 한도(Error 1102)를 넘기게
  // 된다. 검색어가 있을 때는 최근 limit개 안에서만 찾으면 오래된 품목을
  // 못 찾을 수 있으므로, 그때만 전체를 훑는다.
  let allProducts: ProductQueryRow[];
  let hasMore = false;
  if (keyword) {
    allProducts = await fetchAllRows<ProductQueryRow>((from, to) =>
      supabase.from("products").select(PRODUCT_COLUMNS).order("created_at", { ascending: false }).range(from, to),
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

  const products = keyword
    ? allProducts.filter((p) => matchesSearch(keyword, p.name, p.sku, p.spec))
    : allProducts;

  const exportHref = q ? `/api/products/export?q=${encodeURIComponent(q)}` : "/api/products/export";
  const listParams = new URLSearchParams();
  if (q) listParams.set("q", q);
  if (limitParam) listParams.set("limit", limitParam);
  const rowHref = (productId: string) => {
    const p = new URLSearchParams(listParams);
    p.set("id", productId);
    return `/products?${p.toString()}`;
  };
  const moreParams = new URLSearchParams(listParams);
  moreParams.set("limit", String(limit + LIST_LIMIT_STEP));
  const moreHref = `/products?${moreParams.toString()}`;
  const newHref = listParams.toString() ? `/products?${listParams.toString()}` : "/products";
  const currentHref = selectedId
    ? `/products?${new URLSearchParams({ ...(q ? { q } : {}), ...(limitParam ? { limit: limitParam } : {}), id: selectedId }).toString()}`
    : newHref;

  return (
    <div>
      <KeyboardShortcuts
        shortcuts={{
          F2: { href: newHref },
          F5: { submitFormSelector: "#products-search-form" },
          Escape: { href: selectedId ? newHref : "/dashboard" },
        }}
      />
      <div className="erp-page-toolbar erp-detail-header-row">
        <h1 className="text-lg font-bold text-[var(--erp-text)]">품목관리</h1>
        <div className="erp-toolbar" style={{ marginBottom: 0 }}>
          <Link href={newHref} className="erp-btn erp-btn-primary">
            F2 신규
          </Link>
          <Link href={currentHref} className="erp-btn">
            새로고침
          </Link>
          {selectedId && (
            <>
              <Link href={newHref} className="erp-btn">
                목록
              </Link>
              <DeleteButton
                action={deleteProduct}
                id={selectedId}
                confirmMessage="이 상품을 삭제하시겠습니까? 관련 매입/매출 내역이 있으면 삭제되지 않습니다."
              />
            </>
          )}
        </div>
      </div>

      <div className="erp-split-shell" data-mobile-view={selectedId ? "detail" : "list"}>
        <section className="erp-split-list">
          <div className="erp-split-list-head">
            <span>품목 목록</span>
            <span style={{ color: "var(--erp-text-muted)", fontWeight: 400 }}>
              총 {formatNumber(products.length)}건
            </span>
          </div>
          <form
            id="products-search-form"
            method="get"
            className="erp-search"
            style={{ margin: 8, padding: 8, gap: 6 }}
          >
            <input
              type="text"
              name="q"
              autoComplete="off"
              defaultValue={q ?? ""}
              placeholder="상품명, SKU, 규격 검색"
              className="erp-input"
              style={{ width: "100%" }}
            />
            <button type="submit" className="erp-btn erp-btn-primary" style={{ width: "100%" }}>
              F5 조회
            </button>
          </form>
          <div className="erp-split-list-body">
            {products.map((p) => (
              <Link
                key={p.id}
                href={rowHref(p.id)}
                className={`erp-split-list-row${p.id === selectedId ? " active" : ""}`}
              >
                {p.name}
                <div className="erp-split-list-row-sub">
                  {p.sku}
                  {p.spec ? ` · ${p.spec}` : ""}
                </div>
              </Link>
            ))}
            {products.length === 0 && (
              <p className="p-3 text-xs" style={{ color: "var(--erp-text-muted)" }}>
                조건에 맞는 품목이 없습니다.
              </p>
            )}
          </div>
          {!keyword && hasMore && (
            <div style={{ padding: 8, borderTop: "1px solid var(--erp-border)" }}>
              <Link href={moreHref} className="erp-btn" style={{ width: "100%" }}>
                더보기 (다음 {formatNumber(LIST_LIMIT_STEP)}개)
              </Link>
            </div>
          )}
        </section>

        <div className="erp-split-detail">
          {selectedId ? (
            <ProductDetailPanel id={selectedId} />
          ) : (
            <>
              <div className="erp-detail" style={{ marginTop: 0, marginBottom: 12 }}>
                <div className="erp-detail-tabs">
                  <span className="erp-detail-tab active">품목 추가</span>
                </div>
                <div className="erp-detail-body">
                  <CreateProductForm categories={categories ?? []} suppliers={suppliers ?? []} />
                </div>
              </div>

              <div className="erp-detail">
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
            </>
          )}
        </div>
      </div>
    </div>
  );
}
