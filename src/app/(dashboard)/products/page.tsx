import { createClient } from "@/lib/supabase/server";
import { createProduct } from "./actions";

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
        <form action={createProduct} className="grid grid-cols-1 gap-3 sm:grid-cols-4">
          <input
            name="sku"
            placeholder="SKU"
            required
            className="rounded-md border border-gray-300 px-3 py-2 text-sm"
          />
          <input
            name="name"
            placeholder="상품명"
            required
            className="rounded-md border border-gray-300 px-3 py-2 text-sm"
          />
          <select
            name="category_id"
            defaultValue=""
            className="rounded-md border border-gray-300 px-3 py-2 text-sm"
          >
            <option value="">카테고리 선택</option>
            {categories?.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
          <select
            name="supplier_id"
            defaultValue=""
            className="rounded-md border border-gray-300 px-3 py-2 text-sm"
          >
            <option value="">공급업체 선택</option>
            {suppliers?.map((supplier) => (
              <option key={supplier.id} value={supplier.id}>
                {supplier.name}
              </option>
            ))}
          </select>
          <input
            name="unit"
            placeholder="단위 (ea)"
            className="rounded-md border border-gray-300 px-3 py-2 text-sm"
          />
          <input
            name="price"
            placeholder="판매가"
            type="number"
            step="0.01"
            className="rounded-md border border-gray-300 px-3 py-2 text-sm"
          />
          <input
            name="cost"
            placeholder="원가"
            type="number"
            step="0.01"
            className="rounded-md border border-gray-300 px-3 py-2 text-sm"
          />
          <input
            name="reorder_point"
            placeholder="재주문 기준 수량"
            type="number"
            className="rounded-md border border-gray-300 px-3 py-2 text-sm"
          />
          <button
            type="submit"
            className="rounded-md bg-gray-900 px-3 py-2 text-sm font-medium text-white hover:bg-gray-700 sm:col-span-4 sm:w-32"
          >
            추가
          </button>
        </form>
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
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {products?.map((product) => (
              <tr key={product.id}>
                <td className="px-4 py-3 text-gray-900">{product.sku}</td>
                <td className="px-4 py-3 text-gray-900">{product.name}</td>
                <td className="px-4 py-3 text-gray-500">{product.categories?.name ?? "-"}</td>
                <td className="px-4 py-3 text-gray-500">{product.suppliers?.name ?? "-"}</td>
                <td className="px-4 py-3 text-gray-500">{Number(product.price).toLocaleString()}</td>
                <td className="px-4 py-3 text-gray-500">{product.reorder_point}</td>
              </tr>
            ))}
            {!products?.length && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-gray-400">
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
