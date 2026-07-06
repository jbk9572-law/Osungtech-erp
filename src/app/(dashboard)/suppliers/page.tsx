import { createClient } from "@/lib/supabase/server";
import { createSupplier } from "./actions";

export default async function SuppliersPage() {
  const supabase = await createClient();
  const { data: suppliers } = await supabase
    .from("suppliers")
    .select("*")
    .order("created_at", { ascending: false });

  return (
    <div>
      <h1 className="mb-6 text-2xl font-semibold text-gray-900">공급업체</h1>

      <div className="mb-6 rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
        <h2 className="mb-3 text-sm font-medium text-gray-700">공급업체 추가</h2>
        <form action={createSupplier} className="grid grid-cols-1 gap-3 sm:grid-cols-4">
          <input
            name="name"
            placeholder="업체명"
            required
            className="rounded-md border border-gray-300 px-3 py-2 text-sm"
          />
          <input
            name="contact_name"
            placeholder="담당자"
            className="rounded-md border border-gray-300 px-3 py-2 text-sm"
          />
          <input
            name="email"
            placeholder="이메일"
            type="email"
            className="rounded-md border border-gray-300 px-3 py-2 text-sm"
          />
          <input
            name="phone"
            placeholder="연락처"
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
              <th className="px-4 py-3 font-medium">업체명</th>
              <th className="px-4 py-3 font-medium">담당자</th>
              <th className="px-4 py-3 font-medium">이메일</th>
              <th className="px-4 py-3 font-medium">연락처</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {suppliers?.map((supplier) => (
              <tr key={supplier.id}>
                <td className="px-4 py-3 text-gray-900">{supplier.name}</td>
                <td className="px-4 py-3 text-gray-500">{supplier.contact_name ?? "-"}</td>
                <td className="px-4 py-3 text-gray-500">{supplier.email ?? "-"}</td>
                <td className="px-4 py-3 text-gray-500">{supplier.phone ?? "-"}</td>
              </tr>
            ))}
            {!suppliers?.length && (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-gray-400">
                  등록된 공급업체가 없습니다.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
