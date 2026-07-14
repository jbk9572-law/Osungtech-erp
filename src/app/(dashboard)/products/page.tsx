import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { CreateProductForm } from "@/components/create-product-form";
import { ClickableRow } from "@/components/clickable-row";
import { ExcelImportForm } from "@/components/excel-import-form";
import { importProductsExcel } from "@/app/(dashboard)/products/actions";

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
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
          <ExcelImportForm action={importProductsExcel} templateHref="/templates/products-template.xlsx" />
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
              <th>공급업체</th>
              <th className="num">판매가</th>
              <th className="num">재주문 기준</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {products.map((product) => (
              <ClickableRow key={product.id} href={`/products/${product.id}`}>
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
                  {Number(product.price).toLocaleString()}
                </td>
                <td className="num" style={{ color: "var(--erp-text-muted)" }}>
                  {product.reorder_point.toLocaleString()}
                </td>
                <td className="num" style={{ color: "var(--erp-text-muted)" }}>
                  수정 →
                </td>
              </ClickableRow>
            ))}
            {!products.length && (
              <tr>
                <td colSpan={10} className="erp-grid-empty">
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
