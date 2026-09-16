import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ProductForm } from "@/components/product-form";
import { DeleteButton } from "@/components/delete-button";
import { BomItemForm } from "@/components/bom-item-form";
import { InlineConfirmDelete } from "@/components/inline-confirm-delete";
import { updateProduct, deleteProduct, addBomItem, deleteBomItem } from "@/app/(dashboard)/products/actions";
import { KeyboardShortcuts } from "@/components/erp/keyboard-shortcuts";
import { CloseButton } from "@/components/erp/close-button";
import { PageGuide } from "@/components/erp/page-guide";
import { resolveListHref } from "@/lib/list-return";
import { fetchAllRows } from "@/lib/fetch-all-rows";

export default async function ProductDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ back?: string }>;
}) {
  const { id } = await params;
  const { back } = await searchParams;
  const closeHref = resolveListHref("/products", back);
  const supabase = await createClient();

  const [
    { data: product },
    categories,
    suppliers,
    { data: packageQtyHistory },
    { data: bomItems },
    allProducts,
  ] = await Promise.all([
    supabase.from("products").select("*").eq("id", id).maybeSingle(),
    fetchAllRows<{ id: string; name: string }>((from, to) =>
      supabase.from("categories").select("id, name").order("name").range(from, to),
    ),
    fetchAllRows<{ id: string; name: string }>((from, to) =>
      supabase.from("suppliers").select("id, name").order("name").range(from, to),
    ),
    supabase
      .from("product_package_qty_history")
      .select("base_package_qty, changed_at")
      .eq("product_id", id)
      .order("changed_at", { ascending: false })
      .limit(10),
    supabase
      .from("bom_items")
      .select("id, component_product_id, quantity_per_unit")
      .eq("parent_product_id", id)
      .order("created_at"),
    fetchAllRows<{ id: string; sku: string; name: string; unit: string }>((from, to) =>
      supabase.from("products").select("id, sku, name, unit").order("name").range(from, to),
    ),
  ]);

  if (!product) {
    notFound();
  }

  // bom_items는 component_product_id만 갖고 있어 sku/name을 직접 embed하지
  // 않는다 — products에 parent_product_id/component_product_id 두 개의
  // FK가 걸려 있어 PostgREST가 자동으로는 어느 쪽 관계인지 특정할 수
  // 없으므로(둘 다 후보), 이미 화면에 불러온 allProducts로 직접 매핑한다.
  const productById = new Map(allProducts.map((p) => [p.id, p]));
  const bomRows = (bomItems ?? []).map((row) => ({
    id: row.id,
    quantityPerUnit: Number(row.quantity_per_unit),
    component: productById.get(row.component_product_id),
  }));
  const bomCandidates = allProducts.filter((p) => p.id !== id);

  return (
    <div>
      <KeyboardShortcuts shortcuts={{ Escape: { href: closeHref } }} />
      <div className="mb-1 flex items-center justify-between">
        <h1 className="text-lg font-bold text-[var(--erp-text)]">{product.name}</h1>
        <div className="erp-toolbar" style={{ marginBottom: 0 }}>
          <DeleteButton
            action={deleteProduct}
            id={product.id}
            confirmMessage="이 상품을 삭제하시겠습니까? 관련 매입/매출 내역이 있으면 삭제되지 않습니다."
          />
          <CloseButton href={closeHref} />
        </div>
      </div>
      <p className="mb-4 text-xs text-[var(--erp-text-muted)]">{product.sku}</p>

      <div className="erp-detail" style={{ marginTop: 0 }}>
        <div className="erp-detail-tabs">
          <span className="erp-detail-tab active">상품 정보 수정</span>
        </div>
        <div className="erp-detail-body">
          <ProductForm
            action={updateProduct}
            idFieldValue={product.id}
            initial={product}
            categories={categories ?? []}
            suppliers={suppliers ?? []}
            submitLabel="저장"
            packageQtyHistory={(packageQtyHistory ?? []).map((h) => ({
              basePackageQty: Number(h.base_package_qty),
              changedAt: new Date(h.changed_at).toLocaleDateString("ko-KR"),
            }))}
          />
        </div>
      </div>

      <div className="erp-detail">
        <div className="erp-detail-tabs">
          <span className="erp-detail-tab active">BOM(구성품) 등록</span>
        </div>
        <div className="erp-detail-body">
          <PageGuide>
            이 상품을 완제품으로 생산할 때 필요한 구성품과 단위당 소요량입니다.
            생산관리 &gt; 생산지시 등록에서 이 목록을 기준으로 구성품 출고/완제품
            입고가 자동으로 처리됩니다.
          </PageGuide>

          {bomRows.length > 0 && (
            <div className="erp-grid-wrap" style={{ marginBottom: 12 }}>
              <table className="erp-grid">
                <thead>
                  <tr>
                    <th>SKU</th>
                    <th>구성품명</th>
                    <th className="num" style={{ width: 140 }}>
                      1{product.unit}당 소요량
                    </th>
                    <th style={{ width: 70 }} />
                  </tr>
                </thead>
                <tbody>
                  {bomRows.map((row) => (
                    <tr key={row.id}>
                      <td>{row.component?.sku ?? "(삭제된 품목)"}</td>
                      <td>{row.component?.name ?? "-"}</td>
                      <td className="num">
                        {row.quantityPerUnit.toLocaleString()} {row.component?.unit ?? ""}
                      </td>
                      <td>
                        <InlineConfirmDelete
                          action={deleteBomItem}
                          hiddenFields={{ id: row.id, parent_product_id: product.id }}
                          warningText="이 구성품을 BOM에서 삭제하시겠습니까?"
                          triggerStyle={{ minWidth: 0, height: 24, padding: "1px 8px", fontSize: 11 }}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <BomItemForm
            action={addBomItem}
            parentProductId={product.id}
            parentUnit={product.unit}
            candidates={bomCandidates}
          />
        </div>
      </div>
    </div>
  );
}
