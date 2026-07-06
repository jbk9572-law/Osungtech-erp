import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { CustomerPriceForm } from "@/components/customer-price-form";
import { PartnerForm } from "@/components/partner-form";
import { DeleteButton } from "@/components/delete-button";
import { updateCustomer, deleteCustomer } from "@/app/(dashboard)/customers/actions";

export default async function CustomerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const [{ data: customer }, { data: prices }, { data: products }] = await Promise.all([
    supabase.from("customers").select("*").eq("id", id).maybeSingle(),
    supabase
      .from("customer_product_prices")
      .select("*, products(sku, name, unit)")
      .eq("customer_id", id)
      .order("updated_at", { ascending: false }),
    supabase.from("products").select("id, sku, name").order("name"),
  ]);

  if (!customer) {
    notFound();
  }

  return (
    <div>
      <h1 className="mb-1 text-2xl font-semibold text-gray-900">{customer.name}</h1>
      <p className="mb-6 text-sm text-gray-500">
        {customer.business_number ?? "사업자번호 미등록"} · {customer.contact_name ?? "담당자 미등록"}
      </p>

      <div className="mb-6 rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-medium text-gray-700">거래처 정보 수정</h2>
          <DeleteButton
            action={deleteCustomer}
            id={customer.id}
            confirmMessage="이 거래처를 삭제하시겠습니까? 관련 매출 내역이 있으면 삭제되지 않습니다."
          />
        </div>
        <PartnerForm
          action={updateCustomer}
          idFieldValue={customer.id}
          initial={customer}
          showDocumentType
          submitLabel="저장"
        />
      </div>

      <div className="mb-6 rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
        <h2 className="mb-3 text-sm font-medium text-gray-700">판매단가 등록/수정</h2>
        <p className="mb-3 text-xs text-gray-400">
          같은 상품에 새 단가를 등록하면 기존 단가는 최신 단가로 자동 갱신됩니다.
        </p>
        <CustomerPriceForm customerId={customer.id} products={products ?? []} />
      </div>

      <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white shadow-sm">
        <table className="w-full text-left text-sm">
          <thead className="bg-gray-50 text-gray-500">
            <tr>
              <th className="px-4 py-3 font-medium">SKU</th>
              <th className="px-4 py-3 font-medium">상품명</th>
              <th className="px-4 py-3 font-medium">판매단가</th>
              <th className="px-4 py-3 font-medium">최근 수정</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {prices?.map((price) => (
              <tr key={price.id}>
                <td className="px-4 py-3 text-gray-900">{price.products?.sku}</td>
                <td className="px-4 py-3 text-gray-900">{price.products?.name}</td>
                <td className="px-4 py-3 text-gray-500">
                  {Number(price.unit_price).toLocaleString()}
                </td>
                <td className="px-4 py-3 text-gray-500">
                  {new Date(price.updated_at).toLocaleDateString("ko-KR")}
                </td>
              </tr>
            ))}
            {!prices?.length && (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-gray-400">
                  등록된 판매단가가 없습니다.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
