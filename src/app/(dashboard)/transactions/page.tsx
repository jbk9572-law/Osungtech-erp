import { createClient } from "@/lib/supabase/server";
import { createTransaction } from "./actions";

const TYPE_LABEL: Record<string, string> = {
  in: "입고",
  out: "출고",
  adjustment: "조정",
};

export default async function TransactionsPage() {
  const supabase = await createClient();
  const [{ data: transactions }, { data: products }, { data: warehouses }] = await Promise.all([
    supabase
      .from("inventory_transactions")
      .select("*, products(sku, name), warehouses(name)")
      .order("created_at", { ascending: false })
      .limit(50),
    supabase.from("products").select("id, sku, name").order("name"),
    supabase.from("warehouses").select("id, name").order("name"),
  ]);

  return (
    <div>
      <h1 className="mb-6 text-2xl font-semibold text-gray-900">입출고</h1>

      <div className="mb-6 rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
        <h2 className="mb-3 text-sm font-medium text-gray-700">입출고 등록</h2>
        <form action={createTransaction} className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <select
            name="product_id"
            required
            defaultValue=""
            className="rounded-md border border-gray-300 px-3 py-2 text-sm"
          >
            <option value="" disabled>
              상품 선택
            </option>
            {products?.map((product) => (
              <option key={product.id} value={product.id}>
                {product.sku} · {product.name}
              </option>
            ))}
          </select>
          <select
            name="warehouse_id"
            required
            defaultValue=""
            className="rounded-md border border-gray-300 px-3 py-2 text-sm"
          >
            <option value="" disabled>
              창고 선택
            </option>
            {warehouses?.map((warehouse) => (
              <option key={warehouse.id} value={warehouse.id}>
                {warehouse.name}
              </option>
            ))}
          </select>
          <select
            name="type"
            defaultValue="in"
            className="rounded-md border border-gray-300 px-3 py-2 text-sm"
          >
            <option value="in">입고</option>
            <option value="out">출고</option>
            <option value="adjustment">조정</option>
          </select>
          <input
            name="quantity"
            type="number"
            placeholder="수량"
            required
            className="rounded-md border border-gray-300 px-3 py-2 text-sm"
          />
          <input
            name="reference"
            placeholder="참조 번호 (선택)"
            className="rounded-md border border-gray-300 px-3 py-2 text-sm"
          />
          <input
            name="note"
            placeholder="메모 (선택)"
            className="rounded-md border border-gray-300 px-3 py-2 text-sm"
          />
          <button
            type="submit"
            className="rounded-md bg-gray-900 px-3 py-2 text-sm font-medium text-white hover:bg-gray-700 sm:col-span-3 sm:w-32"
          >
            등록
          </button>
        </form>
      </div>

      <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white shadow-sm">
        <table className="w-full text-left text-sm">
          <thead className="bg-gray-50 text-gray-500">
            <tr>
              <th className="px-4 py-3 font-medium">일시</th>
              <th className="px-4 py-3 font-medium">상품</th>
              <th className="px-4 py-3 font-medium">창고</th>
              <th className="px-4 py-3 font-medium">유형</th>
              <th className="px-4 py-3 font-medium">수량</th>
              <th className="px-4 py-3 font-medium">메모</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {transactions?.map((tx) => (
              <tr key={tx.id}>
                <td className="px-4 py-3 text-gray-500">
                  {new Date(tx.created_at).toLocaleString("ko-KR")}
                </td>
                <td className="px-4 py-3 text-gray-900">
                  {tx.products?.sku} · {tx.products?.name}
                </td>
                <td className="px-4 py-3 text-gray-500">{tx.warehouses?.name}</td>
                <td className="px-4 py-3 text-gray-500">{TYPE_LABEL[tx.type]}</td>
                <td className="px-4 py-3 text-gray-900">{tx.quantity}</td>
                <td className="px-4 py-3 text-gray-500">{tx.note ?? "-"}</td>
              </tr>
            ))}
            {!transactions?.length && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-gray-400">
                  입출고 이력이 없습니다.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
