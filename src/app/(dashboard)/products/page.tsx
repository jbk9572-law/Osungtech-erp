import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { CreateProductForm } from "@/components/create-product-form";
import { ClickableRow } from "@/components/clickable-row";
import { ExcelImportForm } from "@/components/excel-import-form";
import { importProductsExcel } from "@/app/(dashboard)/products/actions";
import { buildListReturnParam } from "@/lib/list-return";

// 판매가/매입가/안전재고를 0으로 등록해두는 경우는 실질적으로 없고("아직
// 안 정했다"는 뜻으로 쓰이므로), 목록에 "0"이 그대로 찍히면 진짜 0원/0개인
// 것과 구분이 안 된다. 0이면 "-"로 보여준다.
function formatNumOrDash(n: number | null | undefined) {
  return n ? Number(n).toLocaleString() : "-";
}

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
  const [{ data: allProducts }, { data: categories }, { data: suppliers }] = await Promise.all([
    supabase
      .from("products")
      .select("*, categories(name), suppliers(name)")
      .order("created_at", { ascending: false }),
    supabase.from("categories").select("id, name").order("name"),
    supabase.from("suppliers").select("id, name").order("name"),
  ]);

  const keyword = q?.trim().toLowerCase();
  const products = keyword
    ? (allProducts ?? []).filter(
        (p) =>
          p.name.toLowerCase().includes(keyword) ||
          p.sku.toLowerCase().includes(keyword) ||
          (p.spec ?? "").toLowerCase().includes(keyword)
      )
    : allProducts ?? [];

  const exportHref = q ? `/api/products/export?q=${encodeURIComponent(q)}` : "/api/products/export";

  return (
    <div>
      <h1 className="mb-3 text-lg font-bold text-[#1c1c1c]">품목관리</h1>

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
          <label>품목 / 규격 검색</label>
          <input
            type="text"
            name="q"
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

      <div className="erp-grid-wrap">
        <table className="erp-grid">
          <thead>
            <tr>
              <th>SKU</th>
              <th>상품명</th>
              <th>규격</th>
              <th>단위</th>
              <th>포장수량</th>
              <th>카테고리</th>
              <th>공급처</th>
              <th className="num">매입가</th>
              <th className="num">판매가</th>
              <th className="num">안전재고</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {products.map((product) => (
              <ClickableRow
                key={product.id}
                href={`/products/${product.id}${backParam ? `?back=${backParam}` : ""}`}
              >
                <td>{product.sku}</td>
                <td>{product.name}</td>
                <td style={{ color: "var(--erp-text-muted)" }}>{product.spec ?? "-"}</td>
                <td style={{ color: "var(--erp-text-muted)" }}>{product.unit}</td>
                <td style={{ color: "var(--erp-text-muted)" }}>
                  {product.base_package_qty
                    ? `1박스 = ${Number(product.base_package_qty).toLocaleString()}${product.unit}`
                    : "-"}
                </td>
                <td style={{ color: "var(--erp-text-muted)" }}>{product.categories?.name ?? "-"}</td>
                <td style={{ color: "var(--erp-text-muted)" }}>{product.suppliers?.name ?? "-"}</td>
                <td className="num" style={{ color: "var(--erp-text-muted)" }}>
                  {formatNumOrDash(product.cost)}
                </td>
                <td className="num" style={{ color: "var(--erp-text-muted)" }}>
                  {formatNumOrDash(product.price)}
                </td>
                <td className="num" style={{ color: "var(--erp-text-muted)" }}>
                  {formatNumOrDash(product.reorder_point)}
                </td>
                <td className="num" style={{ color: "var(--erp-text-muted)" }}>
                  수정 →
                </td>
              </ClickableRow>
            ))}
            {!products.length && (
              <tr>
                <td colSpan={11} className="erp-grid-empty">
                  {keyword ? "검색 결과가 없습니다." : "등록된 상품이 없습니다."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
