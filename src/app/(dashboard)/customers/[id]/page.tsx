import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { CustomerPriceForm } from "@/components/customer-price-form";
import { PriceScheduleForm } from "@/components/price-schedule-form";
import { PriceScheduleRow } from "@/components/price-schedule-row";
import { PartnerForm } from "@/components/partner-form";
import { PartyPaymentForm } from "@/components/party-payment-form";
import { PartyPaymentDeleteForm } from "@/components/party-payment-delete-form";
import { DeleteButton } from "@/components/delete-button";
import { ClickableRow } from "@/components/clickable-row";
import { updateCustomer, deleteCustomer, addCustomerPayment, deleteCustomerPayment } from "@/app/(dashboard)/customers/actions";
import { KeyboardShortcuts } from "@/components/erp/keyboard-shortcuts";
import { applyDuePriceSchedules } from "@/lib/price-schedule";
import { getCustomerBalance } from "@/lib/ar-ap";
import { todayKstStr } from "@/lib/kst-date";

export default async function CustomerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  // 이 거래처 화면을 열 때마다, 오늘 이미 도래한 단가 예약을 먼저 반영한다
  // (별도 크론 없이 "그 날짜가 된 뒤 누군가 화면을 열면 그때 적용"되는 방식).
  await applyDuePriceSchedules(supabase, id);

  const [{ data: customer }, { data: prices }, { data: products }, { data: schedules }, balance] =
    await Promise.all([
      supabase.from("customers").select("*").eq("id", id).maybeSingle(),
      supabase
        .from("customer_product_prices")
        .select("*, products(sku, name, unit, spec)")
        .eq("customer_id", id)
        .order("updated_at", { ascending: false }),
      supabase.from("products").select("id, sku, name, spec").order("name"),
      supabase
        .from("price_change_schedules")
        .select("id, product_id, new_unit_price, effective_date, products(sku, name, spec)")
        .eq("customer_id", id)
        .is("applied_at", null)
        .order("effective_date", { ascending: true }),
      getCustomerBalance(supabase, id),
    ]);

  if (!customer) {
    notFound();
  }

  // 단가 예약 목록에 "기존가 → 변경가 (차액)"을 보여주려면 상품별 현재
  // 판매단가가 필요하다. customer_product_prices는 거래처+상품당 최신
  // 단가 하나만 남기는 구조라 이 맵으로 바로 조회할 수 있다.
  const currentPriceByProduct: Record<string, number> = {};
  for (const price of prices ?? []) {
    if (price.product_id) currentPriceByProduct[price.product_id] = Number(price.unit_price);
  }

  return (
    <div>
      <KeyboardShortcuts shortcuts={{ Escape: { href: "/customers" } }} />
      <div className="mb-1 flex items-center justify-between">
        <h1 className="text-lg font-bold text-[#182338]">{customer.name}</h1>
        <Link href="/customers" className="erp-btn erp-btn-danger">
          ESC 닫기
        </Link>
      </div>
      <p className="mb-4 text-xs text-[#6b7280]">
        {customer.business_number ?? "사업자번호 미등록"} · {customer.contact_name ?? "담당자 미등록"}
      </p>

      <div className="erp-detail" style={{ marginTop: 0 }}>
        <div className="erp-detail-tabs" style={{ justifyContent: "space-between" }}>
          <span className="erp-detail-tab active">출고처 정보 수정</span>
          <div style={{ margin: 4 }}>
            <DeleteButton
              action={deleteCustomer}
              id={customer.id}
              confirmMessage="이 출고처를 삭제하시겠습니까? 관련 매출 내역이 있으면 삭제되지 않습니다."
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
          <span className="erp-detail-tab active">미수금 현황</span>
        </div>
        <div className="erp-detail-body">
          <div className="mb-4 flex flex-wrap gap-x-6 gap-y-1 text-sm" style={{ color: "var(--erp-text-muted)" }}>
            <span>매출 누계: {balance.totalSales.toLocaleString()}원</span>
            <span>수금 누계: {balance.totalPaid.toLocaleString()}원</span>
            <span style={{ color: balance.balance > 0 ? "var(--erp-danger)" : "var(--erp-text)", fontWeight: 700 }}>
              잔액: {balance.balance.toLocaleString()}원
            </span>
          </div>

          {balance.unpaidOrders.length > 0 && (
            <div className="erp-grid-wrap" style={{ marginBottom: 12 }}>
              <p className="mb-1 text-xs" style={{ color: "var(--erp-text-muted)" }}>
                미결제 전표 (오래된 순, 수금은 오래된 전표부터 상계 처리)
              </p>
              <table className="erp-grid">
                <thead>
                  <tr>
                    <th style={{ width: 90 }}>일자</th>
                    <th style={{ width: 90 }}>전표번호</th>
                    <th className="num" style={{ width: 130 }}>
                      전표 금액
                    </th>
                    <th className="num" style={{ width: 130 }}>
                      미수 잔액
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {balance.unpaidOrders.map((o) => (
                    <ClickableRow key={o.id} href={`/sales/${o.id}`}>
                      <td>{o.date.replaceAll("-", ".")}</td>
                      <td>{o.docNo}</td>
                      <td className="num">{o.total.toLocaleString()}</td>
                      <td className="num" style={{ color: "var(--erp-danger)", fontWeight: 700 }}>
                        {o.outstanding.toLocaleString()}
                      </td>
                    </ClickableRow>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <PartyPaymentForm
            action={addCustomerPayment}
            partyIdField="customer_id"
            partyId={customer.id}
            today={todayKstStr()}
            label="수금"
          />

          {balance.payments.length > 0 && (
            <div className="erp-grid-wrap" style={{ marginTop: 12 }}>
              <table className="erp-grid">
                <thead>
                  <tr>
                    <th style={{ width: 100 }}>일자</th>
                    <th className="num" style={{ width: 130 }}>
                      금액
                    </th>
                    <th style={{ width: 90 }}>방법</th>
                    <th>메모</th>
                    <th style={{ width: 60 }} />
                  </tr>
                </thead>
                <tbody>
                  {balance.payments.map((p) => (
                    <tr key={p.id}>
                      <td>{p.paid_at.replaceAll("-", ".")}</td>
                      <td className="num">{Number(p.amount).toLocaleString()}</td>
                      <td>{p.method ?? "-"}</td>
                      <td style={{ color: "var(--erp-text-muted)" }}>{p.memo ?? "-"}</td>
                      <td>
                        <PartyPaymentDeleteForm
                          action={deleteCustomerPayment}
                          id={p.id}
                          partyIdField="customer_id"
                          partyId={customer.id}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
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

      <div className="erp-detail">
        <div className="erp-detail-tabs">
          <span className="erp-detail-tab active">단가 예약 (미래 적용)</span>
        </div>
        <div className="erp-detail-body">
          <p className="mb-3 text-xs" style={{ color: "var(--erp-text-muted)" }}>
            지정한 날짜가 되면 자동으로 위 판매단가에 반영됩니다(그 전까지는 기존 단가 그대로 적용).
          </p>
          <PriceScheduleForm customerId={customer.id} products={products ?? []} />

          {schedules && schedules.length > 0 && (
            <div className="mt-3 flex flex-col gap-1.5">
              {schedules.map((s) => (
                <PriceScheduleRow
                  key={s.id}
                  id={s.id}
                  customerId={customer.id}
                  productId={s.product_id}
                  productLabel={`${s.products?.sku} · ${s.products?.name}${s.products?.spec ? ` (${s.products.spec})` : ""}`}
                  currentUnitPrice={currentPriceByProduct[s.product_id] ?? null}
                  newUnitPrice={Number(s.new_unit_price)}
                  effectiveDate={s.effective_date}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="erp-grid-wrap">
        <table className="erp-grid">
          <thead>
            <tr>
              <th>SKU</th>
              <th>상품명</th>
              <th>규격</th>
              <th className="num">판매단가</th>
              <th>최근 수정</th>
            </tr>
          </thead>
          <tbody>
            {prices?.map((price) => (
              <tr key={price.id}>
                <td>{price.products?.sku}</td>
                <td>{price.products?.name}</td>
                <td>{price.products?.spec}</td>
                <td className="num">{Number(price.unit_price).toLocaleString()}</td>
                <td style={{ color: "var(--erp-text-muted)" }}>
                  {new Date(price.updated_at).toLocaleDateString("ko-KR")}
                </td>
              </tr>
            ))}
            {!prices?.length && (
              <tr>
                <td colSpan={5} className="erp-grid-empty">
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
