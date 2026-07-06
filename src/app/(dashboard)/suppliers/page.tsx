import { createClient } from "@/lib/supabase/server";
import { CreateSupplierForm } from "@/components/create-supplier-form";
import { ClickableRow } from "@/components/clickable-row";

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
        <CreateSupplierForm />
      </div>

      <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white shadow-sm">
        <table className="w-full text-left text-sm">
          <thead className="bg-gray-50 text-gray-500">
            <tr>
              <th className="px-4 py-3 font-medium">업체명</th>
              <th className="px-4 py-3 font-medium">담당자</th>
              <th className="px-4 py-3 font-medium">이메일</th>
              <th className="px-4 py-3 font-medium">연락처</th>
              <th className="px-4 py-3 font-medium" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {suppliers?.map((supplier) => (
              <ClickableRow key={supplier.id} href={`/suppliers/${supplier.id}`}>
                <td className="px-4 py-3 text-gray-900">{supplier.name}</td>
                <td className="px-4 py-3 text-gray-500">{supplier.contact_name ?? "-"}</td>
                <td className="px-4 py-3 text-gray-500">{supplier.email ?? "-"}</td>
                <td className="px-4 py-3 text-gray-500">{supplier.phone ?? "-"}</td>
                <td className="px-4 py-3 text-right text-gray-400">수정 →</td>
              </ClickableRow>
            ))}
            {!suppliers?.length && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-gray-400">
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
