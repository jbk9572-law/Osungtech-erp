import { createClient } from "@/lib/supabase/server";
import { createWarehouse } from "./actions";

export default async function WarehousesPage() {
  const supabase = await createClient();
  const { data: warehouses } = await supabase
    .from("warehouses")
    .select("*")
    .order("created_at", { ascending: false });

  return (
    <div>
      <h1 className="mb-6 text-2xl font-semibold text-gray-900">창고</h1>

      <div className="mb-6 rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
        <h2 className="mb-3 text-sm font-medium text-gray-700">창고 추가</h2>
        <form action={createWarehouse} className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <input
            name="name"
            placeholder="창고명"
            required
            className="rounded-md border border-gray-300 px-3 py-2 text-sm"
          />
          <input
            name="location"
            placeholder="위치"
            className="rounded-md border border-gray-300 px-3 py-2 text-sm"
          />
          <button
            type="submit"
            className="rounded-md bg-gray-900 px-3 py-2 text-sm font-medium text-white hover:bg-gray-700 sm:w-32"
          >
            추가
          </button>
        </form>
      </div>

      <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white shadow-sm">
        <table className="w-full text-left text-sm">
          <thead className="bg-gray-50 text-gray-500">
            <tr>
              <th className="px-4 py-3 font-medium">창고명</th>
              <th className="px-4 py-3 font-medium">위치</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {warehouses?.map((warehouse) => (
              <tr key={warehouse.id}>
                <td className="px-4 py-3 text-gray-900">{warehouse.name}</td>
                <td className="px-4 py-3 text-gray-500">{warehouse.location ?? "-"}</td>
              </tr>
            ))}
            {!warehouses?.length && (
              <tr>
                <td colSpan={2} className="px-4 py-6 text-center text-gray-400">
                  등록된 창고가 없습니다.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
