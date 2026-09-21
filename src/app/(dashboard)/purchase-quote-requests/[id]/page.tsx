import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { KeyboardShortcuts } from "@/components/erp/keyboard-shortcuts";
import { DetailPageHeader } from "@/components/erp/page-header";
import { DeleteButton } from "@/components/delete-button";
import { CloseButton } from "@/components/erp/close-button";
import { PageGuide } from "@/components/erp/page-guide";
import { GridBadge } from "@/components/grid/badge";
import { PurchaseQuotePriceForm } from "@/components/purchase-quote-price-form";
import { ConvertPurchaseQuoteRequestForm } from "@/components/convert-purchase-quote-request-form";
import { deletePurchaseQuoteRequest } from "@/app/(dashboard)/purchase-quote-requests/actions";

export default async function PurchaseQuoteRequestDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const [{ data: request }, { data: items }, { data: prices }, { data: allSuppliers }] = await Promise.all([
    supabase
      .from("purchase_quote_requests")
      .select(
        "id, request_date, memo, status, target_supplier_ids, selected_supplier_id, converted_purchase_request_id, profiles!created_by(full_name)",
      )
      .eq("id", id)
      .maybeSingle(),
    supabase
      .from("purchase_quote_request_items")
      .select("id, spec, quantity, remark, products(sku, name)")
      .eq("purchase_quote_request_id", id),
    supabase.from("purchase_quote_prices").select("purchase_quote_request_item_id, supplier_id, unit_price").eq("purchase_quote_request_id", id),
    supabase.from("suppliers").select("id, name").limit(1000),
  ]);

  if (!request) notFound();

  const supplierNameById = new Map((allSuppliers ?? []).map((s) => [s.id, s.name]));
  const targetSuppliers = request.target_supplier_ids.map((sid) => ({ id: sid, name: supplierNameById.get(sid) ?? "알 수 없음" }));

  const priceByItemAndSupplier = new Map<string, number>();
  for (const p of prices ?? []) {
    priceByItemAndSupplier.set(`${p.purchase_quote_request_item_id}:${p.supplier_id}`, Number(p.unit_price));
  }

  const priceFormItems = (items ?? []).map((item) => ({
    id: item.id,
    label: item.products?.name ?? "-",
    spec: item.spec,
    quantity: Number(item.quantity),
  }));

  return (
    <div>
      <KeyboardShortcuts shortcuts={{ Escape: { href: "/purchase-quote-requests" } }} />
      <DetailPageHeader
        title="구매 견적요청"
        meta={
          <>
            요청일 {request.request_date.replaceAll("-", ".")} · 작성자 {request.profiles?.full_name ?? "-"} ·{" "}
            <GridBadge tone={request.status === "closed" ? "ok" : "warn"}>
              {request.status === "closed" ? "확정완료" : "비교중"}
            </GridBadge>
          </>
        }
        actions={
          <>
            {request.status === "open" && (
              <DeleteButton action={deletePurchaseQuoteRequest} id={request.id} confirmMessage="이 견적요청을 삭제하시겠습니까?" />
            )}
            <CloseButton href="/purchase-quote-requests">ESC 목록으로</CloseButton>
          </>
        }
      />

      {request.memo && (
        <p className="mb-3 text-sm" style={{ color: "var(--erp-text-muted)" }}>
          메모: {request.memo}
        </p>
      )}

      <div className="erp-grid-wrap" style={{ marginBottom: 16 }}>
        <table className="erp-grid">
          <thead>
            <tr>
              <th>품목</th>
              <th style={{ width: 140 }}>규격</th>
              <th className="num" style={{ width: 90 }}>수량</th>
              <th>비고</th>
              {targetSuppliers.map((s) => (
                <th key={s.id} className="num" style={{ width: 110 }}>
                  {s.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {(items ?? []).map((item) => (
              <tr key={item.id}>
                <td>{item.products?.name ?? "-"}</td>
                <td>{item.spec ?? "-"}</td>
                <td className="num">{Number(item.quantity).toLocaleString()}</td>
                <td style={{ color: "var(--erp-text-muted)" }}>{item.remark ?? "-"}</td>
                {targetSuppliers.map((s) => {
                  const price = priceByItemAndSupplier.get(`${item.id}:${s.id}`);
                  return (
                    <td key={s.id} className="num">
                      {price !== undefined ? price.toLocaleString() : "-"}
                    </td>
                  );
                })}
              </tr>
            ))}
            {!items?.length && (
              <tr>
                <td colSpan={4 + targetSuppliers.length} className="erp-grid-empty">
                  견적 요청 품목이 없습니다.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {request.status === "closed" ? (
        <p
          className="mb-4 rounded p-2 text-xs"
          style={{ background: "var(--erp-success-bg)", color: "var(--erp-success)", border: "1px solid var(--erp-success-border)" }}
        >
          {supplierNameById.get(request.selected_supplier_id ?? "") ?? "-"}(으)로 확정되어 구매요청으로 전환되었습니다.{" "}
          {request.converted_purchase_request_id && (
            <Link href={`/purchase-requests/${request.converted_purchase_request_id}`} style={{ textDecoration: "underline" }}>
              구매요청 보기
            </Link>
          )}
        </p>
      ) : (
        <>
          {targetSuppliers.map((s) => (
            <div className="erp-detail" key={s.id} style={{ marginBottom: 12 }}>
              <div className="erp-detail-tabs">
                <span className="erp-detail-tab active">{s.name} 견적 입력</span>
              </div>
              <div className="erp-detail-body">
                <PurchaseQuotePriceForm
                  purchaseQuoteRequestId={request.id}
                  supplierId={s.id}
                  items={priceFormItems}
                  initialPrices={Object.fromEntries(
                    priceFormItems.map((item) => [item.id, priceByItemAndSupplier.get(`${item.id}:${s.id}`) ?? 0]),
                  )}
                />
              </div>
            </div>
          ))}

          <div className="erp-detail" style={{ marginTop: 0 }}>
            <div className="erp-detail-tabs">
              <span className="erp-detail-tab active">공급처 확정</span>
            </div>
            <div className="erp-detail-body">
              <PageGuide>
                견적가를 비교한 뒤 공급처를 확정하면, 그 공급처가 매긴 단가 그대로 구매요청으로
                전환되어 승인 절차를 이어서 진행할 수 있습니다.
              </PageGuide>
              <ConvertPurchaseQuoteRequestForm purchaseQuoteRequestId={request.id} suppliers={targetSuppliers} />
            </div>
          </div>
        </>
      )}
    </div>
  );
}
