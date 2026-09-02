import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { ProductForm } from "@/components/product-form";
import { DeleteButton } from "@/components/delete-button";
import { updateProduct, deleteProduct } from "@/app/(dashboard)/products/actions";
import { KeyboardShortcuts } from "@/components/erp/keyboard-shortcuts";
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

  const [{ data: product }, categories, suppliers, { data: packageQtyHistory }] =
    await Promise.all([
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
    ]);

  if (!product) {
    notFound();
  }

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
          <Link href={closeHref} className="erp-btn erp-btn-danger">
            ESC 닫기
          </Link>
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
    </div>
  );
}
