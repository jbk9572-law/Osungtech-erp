import { createClient } from "@/lib/supabase/server";
import { KeyboardShortcuts } from "@/components/erp/keyboard-shortcuts";
import { ListPageHeader } from "@/components/erp/page-header";
import { PageGuide } from "@/components/erp/page-guide";
import { MonthNavigator } from "@/components/erp/month-navigator";
import { currentMonth, getMonthRange } from "@/lib/date-presets";
import { fetchAllRows } from "@/lib/fetch-all-rows";
import { formatNumber } from "@/lib/format-number";
import { ExcelDownloadLink } from "@/components/erp/excel-download-link";

const TYPE_LABEL: Record<string, string> = { in: "입고", out: "출고", adjustment: "조정" };

export default async function InventoryLedgerPage({
  searchParams,
}: {
  searchParams: Promise<{ product_id?: string; warehouse_id?: string; month?: string }>;
}) {
  const { product_id: productId, warehouse_id: warehouseId, month: monthParam } = await searchParams;
  const month = monthParam || currentMonth();
  const { from, to } = getMonthRange(month);
  const suffix = `${warehouseId ? `&warehouse_id=${warehouseId}` : ""}`;
  const monthNavSuffix = `${productId ? `&product_id=${productId}` : ""}${suffix}`;

  const supabase = await createClient();
  const [products, warehouses] = await Promise.all([
    fetchAllRows<{ id: string; sku: string; name: string; unit: string }>((f, t) =>
      supabase.from("products").select("id, sku, name, unit").order("name").range(f, t),
    ),
    supabase.from("warehouses").select("id, name").order("name"),
  ]);

  const selectedProduct = productId ? products.find((p) => p.id === productId) : null;

  // get_product_ledger_rows가 거래일자(transaction_date) 오름차순 +
  // 창고별 재고실사 리셋을 반영해 각 행의 "그 시점 잔량"(balance_after)까지
  // DB 안에서 계산해 돌려준다 — 그대로 쓴다(JS에서 다시 누적하지 않는다).
  // created_at(시스템 입력시각) 기준으로 계산하면 전표를 늦게/일찍
  // 입력했을 때 중간 잔량이 틀어지는 버그가 있었다.
  const rawLedgerRows = selectedProduct
    ? (
        await supabase.rpc("get_product_ledger_rows", {
          p_product_id: selectedProduct.id,
          p_warehouse_id: warehouseId || null,
          p_from: from,
          p_to: to,
        })
      ).data ?? []
    : [];

  const ledgerRows = rawLedgerRows.map((r) => {
    const delta = r.type === "out" ? -Math.abs(Number(r.quantity)) : Number(r.quantity);
    return {
      id: r.id,
      type: r.type,
      quantity: r.quantity,
      reference: r.reference,
      note: r.note,
      date: r.transaction_date,
      delta,
      balance: r.balance_after,
    };
  });
  const openingBalance = ledgerRows.length > 0 ? ledgerRows[0].balance - ledgerRows[0].delta : 0;
  const inTotal = rawLedgerRows.filter((r) => r.type !== "out").reduce((sum, r) => sum + Number(r.quantity), 0);
  const outTotal = rawLedgerRows.filter((r) => r.type === "out").reduce((sum, r) => sum + Math.abs(Number(r.quantity)), 0);
  const closingBalance = ledgerRows.length > 0 ? ledgerRows[ledgerRows.length - 1].balance : openingBalance;

  return (
    <div>
      <KeyboardShortcuts shortcuts={{ Escape: { href: "/dashboard" } }} />
      <ListPageHeader title="회계·보고서 > 수불부" />

      <PageGuide>
        품목을 고르면 그 달의 이월(전월 이전 누적재고)부터 입고/출고 내역,
        마감재고까지 한 번에 보여줍니다. 창고를 지정하지 않으면 전체 창고
        합산 기준입니다.
      </PageGuide>

      <form method="get" className="erp-field-grid">
        <div className="erp-field erp-span-4">
          <label htmlFor="ledger-product">품목</label>
          <select id="ledger-product" name="product_id" className="erp-input w-full" defaultValue={productId ?? ""} required>
            <option value="" disabled>
              선택
            </option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.sku} · {p.name}
              </option>
            ))}
          </select>
        </div>
        <div className="erp-field erp-span-3">
          <label htmlFor="ledger-warehouse">창고</label>
          <select id="ledger-warehouse" name="warehouse_id" className="erp-input w-full" defaultValue={warehouseId ?? ""}>
            <option value="">전체 창고</option>
            {(warehouses.data ?? []).map((w) => (
              <option key={w.id} value={w.id}>
                {w.name}
              </option>
            ))}
          </select>
        </div>
        <input type="hidden" name="month" value={month} />
        <button type="submit" className="erp-btn erp-btn-primary">
          조회
        </button>
      </form>

      <MonthNavigator baseHref="/reports/ledger" month={month} suffix={monthNavSuffix} />
      {selectedProduct && (
        <div className="erp-toolbar" style={{ marginBottom: 12 }}>
          <ExcelDownloadLink
            href={`/api/reports/ledger/export?product_id=${selectedProduct.id}&month=${month}${warehouseId ? `&warehouse_id=${warehouseId}` : ""}`}
            pushRight
          />
        </div>
      )}

      {!selectedProduct ? (
        <p className="text-sm" style={{ color: "var(--erp-text-muted)" }}>
          품목을 선택하면 이 달의 수불 내역이 표시됩니다.
        </p>
      ) : (
        <>
          <div className="erp-kpi-row" style={{ marginBottom: 12 }}>
            <div className="erp-home-panel erp-kpi-card">
              <div className="erp-kpi-label">이월(전월 이전)</div>
              <div className="erp-kpi-value">
                {formatNumber(openingBalance)} {selectedProduct.unit}
              </div>
            </div>
            <div className="erp-home-panel erp-kpi-card">
              <div className="erp-kpi-label">이번달 입고</div>
              <div className="erp-kpi-value" style={{ color: "var(--erp-primary)" }}>
                {formatNumber(inTotal)} {selectedProduct.unit}
              </div>
            </div>
            <div className="erp-home-panel erp-kpi-card">
              <div className="erp-kpi-label">이번달 출고</div>
              <div className="erp-kpi-value" style={{ color: "var(--erp-danger)" }}>
                {formatNumber(outTotal)} {selectedProduct.unit}
              </div>
            </div>
            <div className="erp-home-panel erp-kpi-card">
              <div className="erp-kpi-label">마감재고</div>
              <div className="erp-kpi-value">
                {formatNumber(closingBalance)} {selectedProduct.unit}
              </div>
            </div>
          </div>

          {ledgerRows.length === 0 ? (
            <p className="text-sm" style={{ color: "var(--erp-text-muted)" }}>
              이 달에는 입출고 내역이 없습니다.
            </p>
          ) : (
            <div className="erp-grid-wrap">
              <table className="erp-grid">
                <thead>
                  <tr>
                    <th style={{ width: 140 }}>거래일자</th>
                    <th style={{ width: 70 }}>구분</th>
                    <th className="num" style={{ width: 110 }}>
                      수량
                    </th>
                    <th className="num" style={{ width: 110 }}>
                      잔량
                    </th>
                    <th>참조</th>
                    <th>비고</th>
                  </tr>
                </thead>
                <tbody>
                  {ledgerRows.map((r) => (
                    <tr key={r.id}>
                      <td>{new Date(r.date).toLocaleDateString("ko-KR")}</td>
                      <td>{TYPE_LABEL[r.type] ?? r.type}</td>
                      <td className="num" style={{ color: r.delta < 0 ? "var(--erp-danger)" : "var(--erp-primary)" }}>
                        {r.delta > 0 ? "+" : ""}
                        {formatNumber(r.delta)}
                      </td>
                      <td className="num">{formatNumber(r.balance)}</td>
                      <td style={{ color: "var(--erp-text-muted)" }}>{r.reference ?? "-"}</td>
                      <td style={{ color: "var(--erp-text-muted)" }}>{r.note ?? "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
