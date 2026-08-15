import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { PartnerForm } from "@/components/partner-form";
import { SupplierPriceForm } from "@/components/supplier-price-form";
import { PurchasePriceScheduleForm } from "@/components/purchase-price-schedule-form";
import { PurchasePriceScheduleRow } from "@/components/purchase-price-schedule-row";
import { PartyPaymentForm } from "@/components/party-payment-form";
import { PartyPaymentDeleteForm } from "@/components/party-payment-delete-form";
import { DeleteButton } from "@/components/delete-button";
import { ClickableRow } from "@/components/clickable-row";
import { AgingBadge } from "@/components/aging-badge";
import { updateSupplier, deleteSupplier, addSupplierPayment, deleteSupplierPayment } from "@/app/(dashboard)/suppliers/actions";
import { KeyboardShortcuts } from "@/components/erp/keyboard-shortcuts";
import { applyDuePurchasePriceSchedules } from "@/lib/price-schedule";
import { getSupplierBalance } from "@/lib/ar-ap";
import { todayKstStr } from "@/lib/kst-date";

export default async function SupplierDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  // 이 공급업체 화면을 열 때마다, 오늘 이미 도래한 매입단가 예약을 먼저
  // 반영한다 (거래처 상세 화면의 applyDuePriceSchedules와 동일한 방식).
  await applyDuePurchasePriceSchedules(supabase, id);

  const [{ data: supplier }, { data: prices }, { data: products }, { data: schedules }, balance] =
    await Promise.all([
      supabase.from("suppliers").select("*").eq("id", id).maybeSingle(),
      supabase
        .from("supplier_product_prices")
        .select("*, products(sku, name, unit, spec)")
        .eq("supplier_id", id)
        .order("updated_at", { ascending: false }),
      supabase.from("products").select("id, sku, name, spec").order("name"),
      supabase
        .from("purchase_price_change_schedules")
        .select("id, product_id, new_unit_cost, effective_date, products(sku, name, spec)")
        .eq("supplier_id", id)
        .is("applied_at", null)
        .order("effective_date", { ascending: true }),
      getSupplierBalance(supabase, id),
    ]);

  if (!supplier) {
    notFound();
  }

  // 단가 예약 목록에 "기존가 → 변경가 (차액)"을 보여주려면 상품별 현재
  // 매입단가가 필요하다. supplier_product_prices는 공급처+상품당 최신 단가
  // 하나만 남기는 구조라 이 맵으로 바로 조회할 수 있다.
  const currentPriceByProduct: Record<string, number> = {};
  for (const price of prices ?? []) {
    if (price.product_id) currentPriceByProduct[price.product_id] = Number(price.unit_cost);
  }

  return (
    <div>
      <KeyboardShortcuts shortcuts={{ Escape: { href: "/suppliers" } }} />
      <div className="mb-1 flex items-center justify-between">
        <h1 className="text-lg font-bold text-[var(--erp-text)]">{supplier.name}</h1>
        <div className="erp-toolbar" style={{ marginBottom: 0 }}>
          <DeleteButton
            action={deleteSupplier}
            id={supplier.id}
            confirmMessage="이 공급처를 삭제하시겠습니까? 관련 매입/상품 내역이 있으면 삭제되지 않습니다."
          />
          <Link href="/suppliers" className="erp-btn erp-btn-danger">
            ESC 닫기
          </Link>
        </div>
      </div>
      <p className="mb-4 text-xs text-[var(--erp-text-muted)]">
        {supplier.business_number ?? "사업자번호 미등록"} · {supplier.contact_name ?? "담당자 미등록"}
      </p>

      <div className="erp-detail" style={{ marginTop: 0 }}>
        <div className="erp-detail-tabs">
          <span className="erp-detail-tab active">공급처 정보 수정</span>
        </div>
        <div className="erp-detail-body">
          <PartnerForm
            action={updateSupplier}
            idFieldValue={supplier.id}
            initial={supplier}
            submitLabel="저장"
          />
        </div>
      </div>

      <div className="erp-detail">
        <div className="erp-detail-tabs">
          <span className="erp-detail-tab active">미지급금 현황</span>
        </div>
        <div className="erp-detail-body">
          <div className="mb-4 flex flex-wrap gap-x-6 gap-y-1 text-sm" style={{ color: "var(--erp-text-muted)" }}>
            <span>매입 누계: {balance.totalPurchases.toLocaleString()}원</span>
            <span>지급 누계: {balance.totalPaid.toLocaleString()}원</span>
            <span style={{ color: balance.balance > 0 ? "var(--erp-danger)" : "var(--erp-text)", fontWeight: 700 }}>
              잔액: {balance.balance.toLocaleString()}원
            </span>
          </div>

          {balance.unpaidOrders.length > 0 && (
            <div style={{ marginBottom: 12 }}>
              <p className="mb-1.5 text-xs" style={{ color: "var(--erp-text-muted)" }}>
                미결제 전표 (오래된 순, 지급은 오래된 전표부터 상계 처리)
              </p>
              <div className="erp-grid-wrap">
              <table className="erp-grid">
                <thead>
                  <tr>
                    <th style={{ width: 90 }}>일자</th>
                    <th style={{ width: 90 }}>전표번호</th>
                    <th className="num" style={{ width: 130 }}>
                      전표 금액
                    </th>
                    <th className="num" style={{ width: 130 }}>
                      미지급 잔액
                    </th>
                    <th style={{ width: 110 }}>경과</th>
                  </tr>
                </thead>
                <tbody>
                  {balance.unpaidOrders.map((o) => (
                    <ClickableRow key={o.id} href={`/purchases/${o.id}`}>
                      <td>{o.date.replaceAll("-", ".")}</td>
                      <td>{o.docNo}</td>
                      <td className="num">{o.total.toLocaleString()}</td>
                      <td className="num" style={{ color: "var(--erp-danger)", fontWeight: 700 }}>
                        {o.outstanding.toLocaleString()}
                      </td>
                      <td>
                        <AgingBadge days={o.daysOverdue} />
                      </td>
                    </ClickableRow>
                  ))}
                </tbody>
              </table>
              </div>
            </div>
          )}

          <PartyPaymentForm
            action={addSupplierPayment}
            partyIdField="supplier_id"
            partyId={supplier.id}
            today={todayKstStr()}
            label="지급"
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
                          action={deleteSupplierPayment}
                          id={p.id}
                          partyIdField="supplier_id"
                          partyId={supplier.id}
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
          <span className="erp-detail-tab active">매입단가 등록/수정</span>
        </div>
        <div className="erp-detail-body">
          <p className="mb-3 text-xs" style={{ color: "var(--erp-text-muted)" }}>
            같은 상품에 새 단가를 등록하면 기존 단가는 최신 단가로 자동 갱신됩니다.
          </p>
          <SupplierPriceForm supplierId={supplier.id} products={products ?? []} />
        </div>
      </div>

      <div className="erp-detail">
        <div className="erp-detail-tabs">
          <span className="erp-detail-tab active">단가 예약 (미래 적용)</span>
        </div>
        <div className="erp-detail-body">
          <p className="mb-3 text-xs" style={{ color: "var(--erp-text-muted)" }}>
            지정한 날짜가 되면 자동으로 위 매입단가에 반영됩니다(그 전까지는 기존 단가 그대로 적용).
          </p>
          <PurchasePriceScheduleForm supplierId={supplier.id} products={products ?? []} />

          {schedules && schedules.length > 0 && (
            <div className="mt-3 flex flex-col gap-1.5">
              {schedules.map((s) => (
                <PurchasePriceScheduleRow
                  key={s.id}
                  id={s.id}
                  supplierId={supplier.id}
                  productId={s.product_id}
                  productLabel={`${s.products?.sku} · ${s.products?.name}${s.products?.spec ? ` (${s.products.spec})` : ""}`}
                  currentUnitCost={currentPriceByProduct[s.product_id] ?? null}
                  newUnitCost={Number(s.new_unit_cost)}
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
              <th className="num">매입단가</th>
              <th>최근 수정</th>
            </tr>
          </thead>
          <tbody>
            {prices?.map((price) => (
              <tr key={price.id}>
                <td>{price.products?.sku}</td>
                <td>{price.products?.name}</td>
                <td>{price.products?.spec}</td>
                <td className="num">{Number(price.unit_cost).toLocaleString()}</td>
                <td style={{ color: "var(--erp-text-muted)" }}>
                  {new Date(price.updated_at).toLocaleDateString("ko-KR")}
                </td>
              </tr>
            ))}
            {!prices?.length && (
              <tr>
                <td colSpan={5} className="erp-grid-empty">
                  등록된 매입단가가 없습니다.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
