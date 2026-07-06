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
      <h1 className="mb-6 text-2xl font-semibold text-gray-900">상품</h1>

      <div className="mb-6 rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
        <h2 className="mb-3 text-sm font-medium text-gray-700">상품 추가</h2>
        <CreateProductForm categories={categories ?? []} suppliers={suppliers ?? []} />
      </div>

      <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white shadow-sm">
        <table className="w-full text-left text-sm">
          <thead className="bg-gray-50 text-gray-500">
            <tr>
              <th className="px-4 py-3 font-medium">SKU</th>
              <th className="px-4 py-3 font-medium">상품명</th>
              <th className="px-4 py-3 font-medium">카테고리</th>
              <th className="px-4 py-3 font-medium">공급업체</th>
              <th className="px-4 py-3 font-medium">판매가</th>
              <th className="px-4 py-3 font-medium">재주문 기준</th>
              <th className="px-4 py-3 font-medium" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {products?.map((product) => (
              <ClickableRow key={product.id} href={`/products/${product.id}`}>
                <td className="px-4 py-3 text-gray-900">{product.sku}</td>
                <td className="px-4 py-3 text-gray-900">{product.name}</td>
                <td className="px-4 py-3 text-gray-500">{product.categories?.name ?? "-"}</td>
                <td className="px-4 py-3 text-gray-500">{product.suppliers?.name ?? "-"}</td>
                <td className="px-4 py-3 text-gray-500">{Number(product.price).toLocaleString()}</td>
                <td className="px-4 py-3 text-gray-500">{product.reorder_point}</td>
                <td className="px-4 py-3 text-right text-gray-400">수정 →</td>
              </ClickableRow>
            ))}
            {!products?.length && (
              <tr>
                <td colSpan={7} className="px-4 py-6 text-center text-gray-400">
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
