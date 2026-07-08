import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { CustomerPriceForm } from "@/components/customer-price-form";
import { PartnerForm } from "@/components/partner-form";
import { DeleteButton } from "@/components/delete-button";
import { updateCustomer, deleteCustomer } from "@/app/(dashboard)/customers/actions";
import { KeyboardShortcuts } from "@/components/erp/keyboard-shortcuts";

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
      <KeyboardShortcuts shortcuts={{ Escape: { href: "/customers" } }} />
      <div className="mb-1 flex items-center justify-between">
        <h1 className="text-lg font-bold text-[#1c1c1c]">{customer.name}</h1>
        <Link href="/customers" className="erp-btn">
          ESC 닫기
        </Link>
      </div>
      <p className="mb-4 text-xs text-[#6b7280]">
        {customer.business_number ?? "사업자번호 미등록"} · {customer.contact_name ?? "담당자 미등록"}
      </p>

      <div className="erp-detail" style={{ marginTop: 0 }}>
        <div className="erp-detail-tabs" style={{ justifyContent: "space-between" }}>
          <span className="erp-detail-tab active">거래처 정보 수정</span>
          <div style={{ margin: 4 }}>
            <DeleteButton
              action={deleteCustomer}
              id={customer.id}
              confirmMessage="이 거래처를 삭제하시겠습니까? 관련 매출 내역이 있으면 삭제되지 않습니다."
            />
          </div>
        </div>
        <div className="erp-detail-body">
          <PartnerForm
            action={updateCustomer}
            idFieldValue={customer.id}
            initial={customer}
            showDocumentType
            submitLabel="저장"
          />
        </div>
      </div>

      <div className="erp-detail">
        <div className="erp-detail-tabs">
          <span className="erp-detail-tab active">판매단가 등록/수정</span>
        </div>
        <div className="erp-detail-body">
          <p className="mb-3 text-xs" style={{ color: "var(--erp-text-muted)" }}>
            같은 상품에 새 단가를 등록하면 기존 단가는 최신 단가로 자동 갱신됩니다.
          </p>
          <CustomerPriceForm customerId={customer.id} products={products ?? []} />
        </div>
      </div>

      <div className="erp-grid-wrap">
        <table className="erp-grid">
          <thead>
            <tr>
              <th>SKU</th>
              <th>상품명</th>
              <th className="num">판매단가</th>
              <th>최근 수정</th>
            </tr>
          </thead>
          <tbody>
            {prices?.map((price) => (
              <tr key={price.id}>
                <td>{price.products?.sku}</td>
                <td>{price.products?.name}</td>
                <td className="num">{Number(price.unit_price).toLocaleString()}</td>
                <td style={{ color: "var(--erp-text-muted)" }}>
                  {new Date(price.updated_at).toLocaleDateString("ko-KR")}
                </td>
              </tr>
            ))}
            {!prices?.length && (
              <tr>
                <td colSpan={4} className="erp-grid-empty">
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
