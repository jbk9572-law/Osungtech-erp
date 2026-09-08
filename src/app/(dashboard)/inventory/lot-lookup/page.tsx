import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { KeyboardShortcuts } from "@/components/erp/keyboard-shortcuts";
import { PageGuide } from "@/components/erp/page-guide";
import { fetchAllRows } from "@/lib/fetch-all-rows";
import { normalizeLotNumber } from "@/lib/lot-number";

type PurchaseHit = {
  id: string;
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
  quantity: number;
  products: { sku: string; name: string } | null;
  sales_orders: {
    id: string;
    order_date: string;
    customers: { name: string | null } | null;
  } | null;
};

export default async function LotLookupPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const lotNumber = q ? normalizeLotNumber(q) : "";
  const supabase = await createClient();

  let purchaseHits: PurchaseHit[] = [];
  let saleHits: SaleHit[] = [];

  if (lotNumber) {
    [purchaseHits, saleHits] = await Promise.all([
      fetchAllRows<PurchaseHit>((from, to) =>
        supabase
          .from("purchase_order_items")
          .select(
            "id, quantity, products(sku, name), purchase_orders(id, purchase_date, suppliers(name))",
          )
          .eq("lot_number", lotNumber)
          .range(from, to),
      ),
      fetchAllRows<SaleHit>((from, to) =>
        supabase
          .from("sales_order_items")
          .select(
            "id, quantity, products(sku, name), sales_orders(id, order_date, customers(name))",
          )
          .eq("lot_number", lotNumber)
          .range(from, to),
      ),
    ]);
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

  return (
    <div>
      <KeyboardShortcuts shortcuts={{ Escape: { href: "/inventory" } }} />
      <h1 className="mb-1 text-lg font-bold text-[var(--erp-text)]">
        재고관리 &gt; 관리번호 조회
      </h1>
      <PageGuide>
        불량/리콜 발생 시 특정 관리번호(로트)가 어디서 들어와서 어디로 나갔는지 품목·거래처 상관없이 전부 추적합니다.
      </PageGuide>

      <div className="erp-toolbar">
        <Link href="/inventory" className="erp-btn erp-btn-danger">
          ESC 목록으로
        </Link>
      </div>

      <form method="get" className="erp-search">
        <div className="erp-field" style={{ minWidth: 240 }}>
          <label htmlFor="lot-q">관리번호</label>
          <input
            id="lot-q"
            type="text"
            name="q"
            autoComplete="off"
            defaultValue={q ?? ""}
            placeholder="예: LOT-A"
            className="erp-input"
            style={{ width: "100%", textTransform: "uppercase" }}
          />
        </div>
        <button type="submit" className="erp-btn erp-btn-primary">
          F5 조회
        </button>
      </form>

      {!lotNumber && (
        <p className="erp-grid-empty" style={{ marginTop: 12 }}>
          관리번호를 입력해서 조회해주세요.
        </p>
      )}

      {lotNumber && purchaseHits.length === 0 && saleHits.length === 0 && (
        <p className="erp-grid-empty" style={{ marginTop: 12 }}>
          &quot;{lotNumber}&quot;로 등록된 매입/매출 내역이 없습니다.
        </p>
      )}

      {lotNumber && (purchaseHits.length > 0 || saleHits.length > 0) && (
        <>
          <div
            className="rounded p-2 text-xs"
            style={{
              marginTop: 8,
              marginBottom: 14,
              background: "var(--erp-warning-bg)",
              color: "var(--erp-warning)",
              border: "1px solid var(--erp-warning-border)",
            }}
          >
            &quot;{lotNumber}&quot;로 등록된 거래 {purchaseHits.length + saleHits.length}건 · 관련 품목{" "}
            {productNames.size}개 · 관련 거래처 {partnerNames.size}곳 · 입고 합계{" "}
            {totalIn.toLocaleString()} · 출고 합계 {totalOut.toLocaleString()} · 추정 잔량{" "}
            {(totalIn - totalOut).toLocaleString()}
          </div>

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
                          {Number(h.quantity).toLocaleString()}
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
                          {totalIn.toLocaleString()}
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
                          {Number(h.quantity).toLocaleString()}
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
                          {totalOut.toLocaleString()}
                        </td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
