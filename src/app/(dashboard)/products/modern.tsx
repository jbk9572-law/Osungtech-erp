import { withPageTiming } from "@/lib/page-timing";
import { createClient } from "@/lib/supabase/server";
import { ListSearchForm } from "@/components/erp/list-search-form";
import { RecordPageA } from "@/components/grid/record-page-a";
import type { RecordRow } from "@/components/grid/record-list-a";
import { bulkDeleteProducts } from "@/app/(dashboard)/products/actions";
import { GridBadge } from "@/components/grid/badge";
import { fetchAllRows, fetchLimitedRows } from "@/lib/fetch-all-rows";
import { matchesSearch } from "@/lib/search-match";
import { formatNumber } from "@/lib/format-number";

const DEFAULT_LIST_LIMIT = 300;
const LIST_LIMIT_STEP = 300;

type ProductQueryRow = {
  id: string;
  sku: string;
  name: string;
  spec: string | null;
  unit: string | null;
  price: number | null;
  parent_product_id: string | null;
};

const PRODUCT_COLUMNS = "id, sku, name, spec, unit, price, parent_product_id";

// 모던 테마(grid-modern) 전용 A형 품목관리 — 표 + 오른쪽 상세 패널, 신규·수정은 C형 모달. 클래식은 classic.tsx(동결본).
async function ProductsPage({ searchParams }: { searchParams: Promise<{ q?: string; limit?: string }> }) {
  const { q, limit: limitParam } = await searchParams;
  const parsedLimit = limitParam ? parseInt(limitParam, 10) : NaN;
  const limit = Number.isFinite(parsedLimit) && parsedLimit > 0 ? parsedLimit : DEFAULT_LIST_LIMIT;
  const keyword = q?.trim().toLowerCase();
  const supabase = await createClient();

  // 검색이 없으면 최근 등록순 상한(limit)까지만(CPU 한도), 검색이 있으면 전체에서 찾는다 — 클래식과 같은 기준.
  let allProducts: ProductQueryRow[];
  let hasMore = false;
  if (keyword) {
    allProducts = await fetchAllRows<ProductQueryRow>((from, to) =>
      supabase.from("products").select(PRODUCT_COLUMNS).order("created_at", { ascending: false }).range(from, to),
    );
  } else {
    const result = await fetchLimitedRows<ProductQueryRow>(
      (from, to) => supabase.from("products").select(PRODUCT_COLUMNS).order("created_at", { ascending: false }).range(from, to),
      limit,
    );
    allProducts = result.rows;
    hasMore = result.hasMore;
  }
  const products = keyword ? allProducts.filter((p) => matchesSearch(keyword, p.name, p.sku, p.spec)) : allProducts;

  const moreParams = new URLSearchParams();
  if (q) moreParams.set("q", q);
  moreParams.set("limit", String(limit + LIST_LIMIT_STEP));

  const nameById = new Map<string, string>();
  const rows: RecordRow[] = products.map((p) => {
    nameById.set(p.id, p.name);
    const derived = !!p.parent_product_id;
    return {
      id: p.id,
      href: `/products/${p.id}`,
      cells: [p.sku, p.name, p.spec ?? "-", p.unit ?? "-", p.price == null ? "-" : formatNumber(p.price), derived ? <GridBadge key="d" tone="info">파생</GridBadge> : "-"],
      values: [p.sku, p.name, p.spec, p.unit, p.price, derived ? "파생" : ""],
      card: {
        title: <span className="erp-row-card-partner">{p.name}</span>,
        sub: [p.sku, p.spec].filter(Boolean).join(" · "),
        foot: <span className="erp-row-card-amount">{p.price == null ? "-" : `${formatNumber(p.price)}원`}</span>,
      },
      panel: {
        title: p.name,
        subtitle: p.sku,
        chips: derived ? [{ tone: "info", label: "파생 품목" }] : undefined,
        kv: [
          { label: "규격", value: p.spec ?? "-" },
          { label: "단위", value: p.unit ?? "-" },
        ],
        totals: [{ label: "판매가", value: p.price == null ? "-" : formatNumber(p.price), strong: true }],
        actions: [{ label: "수정·상세", href: `/products/${p.id}` }],
      },
    };
  });

  return (
    <RecordPageA
      title="품목관리"
      basePath="/products"
      newLabel="신규"
      searchFormId="products-search-form"
      filters={
        <ListSearchForm formId="products-search-form" q={q} placeholder="상품명, SKU, 규격 검색" ariaLabel="품목 검색" resetHref="/products" />
      }
      columns={[{ label: "SKU" }, { label: "품목명" }, { label: "규격" }, { label: "단위" }, { label: "판매가", num: true }, { label: "구분" }]}
      rows={rows}
      panelAriaLabel="선택한 품목 상세"
      hasMore={!keyword && hasMore}
      moreHref={`/products?${moreParams.toString()}`}
      moreStep={LIST_LIMIT_STEP}
      emptyMessage="조건에 맞는 품목이 없습니다."
      bulkDelete={{
        action: bulkDeleteProducts,
        warningText: "관련 매입/매출 내역이 있는 품목은 삭제되지 않습니다.",
        labelOf: (id) => nameById.get(id) ?? id,
      }}
    />
  );
}

export default withPageTiming("products", ProductsPage);
