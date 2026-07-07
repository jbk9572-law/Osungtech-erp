import { createClient } from "@/lib/supabase/server";
import { CreateProductForm } from "@/components/create-product-form";
import { ClickableRow } from "@/components/clickable-row";

export default async function ProductsPage() {
  const supabase = await createClient();
  const [{ data: products }, { data: categories }, { data: suppliers }] = await Promise.all([
    supabase
      .from("products")
      .select("*, categories(name), suppliers(name)")
      .order("created_at", { ascending: false }),
    supabase.from("categories").select("id, name").order("name"),
    supabase.from("suppliers").select("id, name").order("name"),
  ]);

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

      <div className="erp-grid-wrap">
        <table className="erp-grid">
          <thead>
            <tr>
              <th>SKU</th>
              <th>상품명</th>
              <th>규격</th>
              <th>단위</th>
              <th>카테고리</th>
              <th>공급업체</th>
              <th className="num">판매가</th>
              <th className="num">재주문 기준</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {products?.map((product) => (
              <ClickableRow key={product.id} href={`/products/${product.id}`}>
                <td>{product.sku}</td>
                <td>{product.name}</td>
                <td style={{ color: "var(--erp-text-muted)" }}>{product.spec ?? "-"}</td>
                <td style={{ color: "var(--erp-text-muted)" }}>{product.unit}</td>
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
            {!products?.length && (
              <tr>
                <td colSpan={9} className="erp-grid-empty">
                  등록된 상품이 없습니다.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
