import { createClient } from "@/lib/supabase/server";
import { CreateCustomerForm } from "@/components/create-customer-form";
import { ClickableRow } from "@/components/clickable-row";

export default async function CustomersPage() {
  const supabase = await createClient();
  const { data: customers } = await supabase
    .from("customers")
    .select("*")
    .order("created_at", { ascending: false });

  return (
    <div>
      <h1 className="mb-6 text-2xl font-semibold text-gray-900">거래처 (판매처)</h1>

      <div className="mb-6 rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
        <h2 className="mb-3 text-sm font-medium text-gray-700">거래처 추가</h2>
        <CreateCustomerForm />
      </div>

      <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white shadow-sm">
        <table className="w-full text-left text-sm">
          <thead className="bg-gray-50 text-gray-500">
            <tr>
              <th className="px-4 py-3 font-medium">거래처명</th>
              <th className="px-4 py-3 font-medium">사업자번호</th>
              <th className="px-4 py-3 font-medium">담당자</th>
              <th className="px-4 py-3 font-medium">연락처</th>
              <th className="px-4 py-3 font-medium">발행 문서</th>
              <th className="px-4 py-3 font-medium" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {customers?.map((customer) => (
              <ClickableRow key={customer.id} href={`/customers/${customer.id}`}>
                <td className="px-4 py-3 text-gray-900">{customer.name}</td>
                <td className="px-4 py-3 text-gray-500">{customer.business_number ?? "-"}</td>
                <td className="px-4 py-3 text-gray-500">{customer.contact_name ?? "-"}</td>
                <td className="px-4 py-3 text-gray-500">{customer.phone ?? "-"}</td>
                <td className="px-4 py-3">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      customer.document_type === "출고증"
                        ? "bg-amber-100 text-amber-700"
                        : "bg-blue-100 text-blue-700"
                    }`}
                  >
                    {customer.document_type}
                  </span>
                </td>
                <td className="px-4 py-3 text-right text-gray-400">수정 →</td>
              </ClickableRow>
            ))}
            {!customers?.length && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-gray-400">
                  등록된 거래처가 없습니다.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
