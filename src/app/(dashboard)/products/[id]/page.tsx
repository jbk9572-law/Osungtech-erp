import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ProductForm } from "@/components/product-form";
import { DeleteButton } from "@/components/delete-button";
import { updateProduct, deleteProduct } from "@/app/(dashboard)/products/actions";

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
      <h1 className="mb-1 text-2xl font-semibold text-gray-900">{product.name}</h1>
      <p className="mb-6 text-sm text-gray-500">{product.sku}</p>

      <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-medium text-gray-700">상품 정보 수정</h2>
          <DeleteButton
            action={deleteProduct}
            id={product.id}
            confirmMessage="이 상품을 삭제하시겠습니까? 관련 매입/매출 내역이 있으면 삭제되지 않습니다."
          />
        </div>
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
  );
}
