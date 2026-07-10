import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { ProductForm } from "@/components/product-form";
import { DeleteButton } from "@/components/delete-button";
import { updateProduct, deleteProduct } from "@/app/(dashboard)/products/actions";
import { KeyboardShortcuts } from "@/components/erp/keyboard-shortcuts";

export default async function ProductDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const [{ data: product }, { data: categories }, { data: suppliers }] = await Promise.all([
    supabase.from("products").select("*").eq("id", id).maybeSingle(),
    supabase.from("categories").select("id, name").order("name"),
    supabase.from("suppliers").select("id, name").order("name"),
  ]);

  if (!product) {
    notFound();
  }

  return (
    <div>
      <KeyboardShortcuts shortcuts={{ Escape: { href: "/products" } }} />
      <div className="mb-1 flex items-center justify-between">
        <h1 className="text-lg font-bold text-[#1c1c1c]">{product.name}</h1>
        <Link href="/products" className="erp-btn erp-btn-danger">
          ESC 닫기
        </Link>
      </div>
      <p className="mb-4 text-xs text-[#6b7280]">{product.sku}</p>

      <div className="erp-detail" style={{ marginTop: 0 }}>
        <div className="erp-detail-tabs" style={{ justifyContent: "space-between" }}>
          <span className="erp-detail-tab active">상품 정보 수정</span>
          <div style={{ margin: 4 }}>
            <DeleteButton
              action={deleteProduct}
              id={product.id}
              confirmMessage="이 상품을 삭제하시겠습니까? 관련 매입/매출 내역이 있으면 삭제되지 않습니다."
            />
          </div>
        </div>
        <div className="erp-detail-body">
          <ProductForm
            action={updateProduct}
            idFieldValue={product.id}
            initial={product}
            categories={categories ?? []}
            suppliers={suppliers ?? []}
            submitLabel="저장"
          />
        </div>
      </div>
    </div>
  );
}
