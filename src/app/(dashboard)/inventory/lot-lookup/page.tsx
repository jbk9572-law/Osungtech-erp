import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { KeyboardShortcuts } from "@/components/erp/keyboard-shortcuts";
import { ListPageHeader } from "@/components/erp/page-header";
import { PageGuide } from "@/components/erp/page-guide";
import { GridBadge } from "@/components/grid/badge";
import { LotLookupSearchForm } from "@/components/lot-lookup-search-form";
import { fetchAllRows } from "@/lib/fetch-all-rows";
import { normalizeLotNumber } from "@/lib/lot-number";
import { formatNumber } from "@/lib/format-number";

type PurchaseHit = {
  id: string;
  product_id: string | null;
  quantity: number;
  products: { sku: string; name: string } | null;
  purchase_orders: {
    id: string;
    purchase_date: string;
    suppliers: { name: string | null } | null;
  } | null;
};

type SaleHit = {
  id: string;
  product_id: string | null;
  quantity: number;
  products: { sku: string; name: string } | null;
  sales_orders: {
    id: string;
    order_date: string;
    customers: { name: string | null } | null;
  } | null;
};

type WorkOrderHit = {
  id: string;
  doc_no: number;
  order_date: string;
  quantity: number;
  status: "pending" | "material_issued" | "completed" | "cancelled";
  products: { sku: string; name: string; unit: string | null } | null;
};

const WORK_ORDER_STATUS_LABEL: Record<WorkOrderHit["status"], { label: string; tone: "muted" | "warn" | "ok" | "danger" }> = {
  pending: { label: "대기", tone: "muted" },
  material_issued: { label: "생산중", tone: "warn" },
  completed: { label: "완료", tone: "ok" },
  cancelled: { label: "취소", tone: "danger" },
};

export default async function LotLookupPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; productId?: string }>;
}) {
  const { q, productId: productIdParam } = await searchParams;
  const lotNumber = q ? normalizeLotNumber(q) : "";
  const productId = productIdParam ?? "";
  const supabase = await createClient();

  const products = await fetchAllRows<{ id: string; sku: string; name: string; spec: string | null }>((from, to) =>
    supabase.from("products").select("id, sku, name, spec").order("name").range(from, to),
  );

  let purchaseHits: PurchaseHit[] = [];
  let saleHits: SaleHit[] = [];
  let workOrderHits: WorkOrderHit[] = [];
  // "doc_no": 생산관리 상세 화면이 생산지시를 "LOT {doc_no}"로 표시하는
  // 바로 그 관례를 그대로 이용해, 관리번호 텍스트가 이 형식과 정확히
  // 일치하면 해당 생산지시 1건을 정확히 찾아낸다. "product": 로트가 그
  // 형식이 아니거나 품목으로만 검색한 경우, 같은 품목의 생산지시 이력을
  // 참고용으로 같이 보여준다(생산관리는 매입/매출과 달리 아직 건별
  // 관리번호를 저장하지 않는다 — product_id까지만 매칭 가능).
  let workOrderMatchMode: "doc_no" | "product" | null = null;

  const hasQuery = !!lotNumber || !!productId;

  if (hasQuery) {
    [purchaseHits, saleHits] = await Promise.all([
      fetchAllRows<PurchaseHit>((from, to) => {
        let query = supabase
          .from("purchase_order_items")
          .select("id, product_id, quantity, products(sku, name), purchase_orders(id, purchase_date, suppliers(name))")
          .range(from, to);
        if (lotNumber) query = query.eq("lot_number", lotNumber);
        if (productId) query = query.eq("product_id", productId);
        return query;
      }),
      fetchAllRows<SaleHit>((from, to) => {
        let query = supabase
          .from("sales_order_items")
          .select("id, product_id, quantity, products(sku, name), sales_orders(id, order_date, customers(name))")
          .range(from, to);
        if (lotNumber) query = query.eq("lot_number", lotNumber);
        if (productId) query = query.eq("product_id", productId);
        return query;
      }),
    ]);

    const lotDocNoMatch = lotNumber.match(/^LOT(\d+)$/);
    if (lotDocNoMatch) {
      const { data } = await supabase
        .from("work_orders")
        .select("id, doc_no, order_date, quantity, status, products(sku, name, unit)")
        .eq("doc_no", Number(lotDocNoMatch[1]))
        .limit(1);
      workOrderHits = data ?? [];
      workOrderMatchMode = "doc_no";
    } else {
      const targetProductIds = productId
        ? [productId]
        : [...new Set([...purchaseHits, ...saleHits].map((h) => h.product_id).filter((id): id is string => !!id))];
      if (targetProductIds.length > 0) {
        workOrderHits = await fetchAllRows<WorkOrderHit>((from, to) =>
          supabase
            .from("work_orders")
            .select("id, doc_no, order_date, quantity, status, products(sku, name, unit)")
            .in("product_id", targetProductIds)
            .order("order_date", { ascending: false })
            .range(from, to),
        );
        workOrderMatchMode = "product";
      }
    }
  }

  const totalIn = purchaseHits.reduce((sum, h) => sum + Number(h.quantity), 0);
  const totalOut = saleHits.reduce((sum, h) => sum + Number(h.quantity), 0);
  const productNames = new Set(
    [...purchaseHits, ...saleHits].map((h) => h.products?.name).filter(Boolean),
  );
  const partnerNames = new Set([
    ...purchaseHits.map((h) => h.purchase_orders?.suppliers?.name).filter(Boolean),
    ...saleHits.map((h) => h.sales_orders?.customers?.name).filter(Boolean),
  ]);
  const noHits = purchaseHits.length === 0 && saleHits.length === 0 && workOrderHits.length === 0;

  return (
    <div>
      <KeyboardShortcuts shortcuts={{ Escape: { href: "/inventory" } }} />
      <ListPageHeader
        title="재고관리 > 품목·관리번호 통합조회"
        actions={
          <Link href="/inventory" className="erp-btn erp-btn-dark">
            ESC 목록으로
          </Link>
        }
      />
      <PageGuide>
        불량/리콜 발생 시 관리번호(로트)나 품목으로 매입·매출·생산지시 내역을 한 화면에서 함께 추적합니다.
      </PageGuide>

      <LotLookupSearchForm products={products} q={q ?? ""} productId={productId} />

      {!hasQuery && (
        <p className="erp-grid-empty" style={{ marginTop: 12 }}>
          관리번호(로트) 또는 품목을 입력해서 조회해주세요.
        </p>
      )}

      {hasQuery && noHits && (
        <p className="erp-grid-empty" style={{ marginTop: 12 }}>
          조건에 맞는 매입/매출/생산지시 내역이 없습니다.
        </p>
      )}

      {hasQuery && !noHits && (
        <>
          <PageGuide tone="warning" className="mt-2">
            매입/매출 {purchaseHits.length + saleHits.length}건 · 생산지시 {workOrderHits.length}건 ·
            관련 품목 {productNames.size}개 · 관련 거래처 {partnerNames.size}곳 · 입고 합계{" "}
            {formatNumber(totalIn)} · 출고 합계 {formatNumber(totalOut)} · 추정 잔량{" "}
            {formatNumber(totalIn - totalOut)}
          </PageGuide>

          <div className="erp-detail" style={{ marginTop: 0 }}>
            <div className="erp-detail-tabs">
              <span className="erp-detail-tab active" style={{ cursor: "default" }}>
                매입 이력 (입고) {purchaseHits.length}건
              </span>
            </div>
            <div className="erp-detail-body">
              <div className="erp-grid-wrap">
                <table className="erp-grid">
                  <thead>
                    <tr>
                      <th>날짜</th>
                      <th>공급처</th>
                      <th>품목</th>
                      <th className="num">수량</th>
                    </tr>
                  </thead>
                  <tbody>
                    {purchaseHits.map((h) => (
                      <tr key={h.id}>
                        <td>
                          {h.purchase_orders ? (
                            <Link href={`/purchases/${h.purchase_orders.id}`} style={{ color: "inherit" }}>
                              {new Date(h.purchase_orders.purchase_date).toLocaleDateString("ko-KR")}
                            </Link>
                          ) : (
                            "-"
                          )}
                        </td>
                        <td>{h.purchase_orders?.suppliers?.name ?? "-"}</td>
                        <td>{h.products ? `${h.products.sku} · ${h.products.name}` : "-"}</td>
                        <td className="num" style={{ color: "var(--erp-success)", fontWeight: 700 }}>
                          {formatNumber(Number(h.quantity))}
                        </td>
                      </tr>
                    ))}
                    {purchaseHits.length === 0 && (
                      <tr>
                        <td colSpan={4} className="erp-grid-empty">
                          매입 이력 없음
                        </td>
                      </tr>
                    )}
                  </tbody>
                  {purchaseHits.length > 0 && (
                    <tfoot>
                      <tr>
                        <td colSpan={3} style={{ fontWeight: 700 }}>
                          합계 입고
                        </td>
                        <td className="num" style={{ fontWeight: 700 }}>
                          {formatNumber(totalIn)}
                        </td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            </div>
          </div>

          <div className="erp-detail" style={{ marginTop: 14 }}>
            <div className="erp-detail-tabs">
              <span className="erp-detail-tab active" style={{ cursor: "default" }}>
                매출 이력 (출고) {saleHits.length}건
              </span>
            </div>
            <div className="erp-detail-body">
              <div className="erp-grid-wrap">
                <table className="erp-grid">
                  <thead>
                    <tr>
                      <th>날짜</th>
                      <th>거래처</th>
                      <th>품목</th>
                      <th className="num">수량</th>
                    </tr>
                  </thead>
                  <tbody>
                    {saleHits.map((h) => (
                      <tr key={h.id}>
                        <td>
                          {h.sales_orders ? (
                            <Link href={`/sales/${h.sales_orders.id}`} style={{ color: "inherit" }}>
                              {new Date(h.sales_orders.order_date).toLocaleDateString("ko-KR")}
                            </Link>
                          ) : (
                            "-"
                          )}
                        </td>
                        <td>{h.sales_orders?.customers?.name ?? "-"}</td>
                        <td>{h.products ? `${h.products.sku} · ${h.products.name}` : "-"}</td>
                        <td className="num" style={{ color: "var(--erp-danger)", fontWeight: 700 }}>
                          {formatNumber(Number(h.quantity))}
                        </td>
                      </tr>
                    ))}
                    {saleHits.length === 0 && (
                      <tr>
                        <td colSpan={4} className="erp-grid-empty">
                          매출 이력 없음
                        </td>
                      </tr>
                    )}
                  </tbody>
                  {saleHits.length > 0 && (
                    <tfoot>
                      <tr>
                        <td colSpan={3} style={{ fontWeight: 700 }}>
                          합계 출고
                        </td>
                        <td className="num" style={{ fontWeight: 700 }}>
                          {formatNumber(totalOut)}
                        </td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            </div>
          </div>

          <div className="erp-detail" style={{ marginTop: 14 }}>
            <div className="erp-detail-tabs">
              <span className="erp-detail-tab active" style={{ cursor: "default" }}>
                생산지시 이력 {workOrderHits.length}건
                {workOrderMatchMode === "doc_no" && " · LOT 정확 일치"}
                {workOrderMatchMode === "product" && " · 품목 기준(로트 단위 아님)"}
              </span>
            </div>
            <div className="erp-detail-body">
              <div className="erp-grid-wrap">
                <table className="erp-grid">
                  <thead>
                    <tr>
                      <th>날짜</th>
                      <th>지시번호</th>
                      <th>완제품</th>
                      <th className="num">수량</th>
                      <th>상태</th>
                    </tr>
                  </thead>
                  <tbody>
                    {workOrderHits.map((w) => (
                      <tr key={w.id}>
                        <td>
                          <Link href={`/production/${w.id}`} style={{ color: "inherit" }}>
                            {new Date(w.order_date).toLocaleDateString("ko-KR")}
                          </Link>
                        </td>
                        <td>LOT {w.doc_no}</td>
                        <td>{w.products ? `${w.products.sku} · ${w.products.name}` : "-"}</td>
                        <td className="num">
                          {formatNumber(Number(w.quantity))} {w.products?.unit ?? ""}
                        </td>
                        <td>
                          <GridBadge tone={WORK_ORDER_STATUS_LABEL[w.status].tone}>
                            {WORK_ORDER_STATUS_LABEL[w.status].label}
                          </GridBadge>
                        </td>
                      </tr>
                    ))}
                    {workOrderHits.length === 0 && (
                      <tr>
                        <td colSpan={5} className="erp-grid-empty">
                          생산지시 내역 없음
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
