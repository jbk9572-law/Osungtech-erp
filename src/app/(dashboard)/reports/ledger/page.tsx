import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { KeyboardShortcuts } from "@/components/erp/keyboard-shortcuts";
import { PageGuide } from "@/components/erp/page-guide";
import { currentMonth, getMonthRange, shiftMonth } from "@/lib/date-presets";
import { fetchAllRows } from "@/lib/fetch-all-rows";

const TYPE_LABEL: Record<string, string> = { in: "입고", out: "출고", adjustment: "조정" };

export default async function InventoryLedgerPage({
  searchParams,
}: {
  searchParams: Promise<{ product_id?: string; warehouse_id?: string; month?: string }>;
}) {
  const { product_id: productId, warehouse_id: warehouseId, month: monthParam } = await searchParams;
  const month = monthParam || currentMonth();
  const { from, to } = getMonthRange(month);
  const prevMonth = shiftMonth(month, -1);
  const nextMonth = shiftMonth(month, 1);
  const thisMonth = currentMonth();
  // inventory_transactions.created_at은 timestamptz라, 그냥 "YYYY-MM-DD"
  // 문자열로 비교하면 서버가 어느 시간대로 파싱하느냐에 따라 월 경계
  // 근처(자정 전후) 거래가 잘못된 달로 새어 들어갈 수 있다 — 한국시간
  // 기준 자정을 명시적으로 못박는다.
  const fromIso = `${from}T00:00:00+09:00`;
  const toIso = `${to}T23:59:59.999+09:00`;
  const suffix = `${warehouseId ? `&warehouse_id=${warehouseId}` : ""}`;

  const supabase = await createClient();
  const [products, warehouses] = await Promise.all([
    fetchAllRows<{ id: string; sku: string; name: string; unit: string }>((f, t) =>
      supabase.from("products").select("id, sku, name, unit").order("name").range(f, t),
    ),
    supabase.from("warehouses").select("id, name").order("name"),
  ]);

  const selectedProduct = productId ? products.find((p) => p.id === productId) : null;

  let openingBalance = 0;
  let rows: {
    id: string;
    type: string;
    quantity: number;
    reference: string | null;
    note: string | null;
    created_at: string;
  }[] = [];

  if (selectedProduct) {
    const [{ data: opening }, { data: periodRows }] = await Promise.all([
      supabase.rpc("get_ledger_opening_balance", {
        p_product_id: selectedProduct.id,
        p_warehouse_id: warehouseId || null,
        p_before: fromIso,
      }),
      (() => {
        let q = supabase
          .from("inventory_transactions")
          .select("id, type, quantity, reference, note, created_at")
          .eq("product_id", selectedProduct.id)
          .gte("created_at", fromIso)
          .lte("created_at", toIso)
          .order("created_at", { ascending: true });
        if (warehouseId) q = q.eq("warehouse_id", warehouseId);
        return q;
      })(),
    ]);
    openingBalance = Number(opening ?? 0);
    rows = periodRows ?? [];
  }

  const ledgerRows = rows.reduce<
    Array<{
      id: string;
      type: string;
      quantity: number;
      reference: string | null;
      note: string | null;
      created_at: string;
      delta: number;
      balance: number;
    }>
  >((acc, r) => {
    const delta = r.type === "out" ? -Math.abs(Number(r.quantity)) : Number(r.quantity);
    const prevBalance = acc.length > 0 ? acc[acc.length - 1].balance : openingBalance;
    acc.push({ ...r, delta, balance: prevBalance + delta });
    return acc;
  }, []);
  const inTotal = rows.filter((r) => r.type !== "out").reduce((sum, r) => sum + Number(r.quantity), 0);
  const outTotal = rows.filter((r) => r.type === "out").reduce((sum, r) => sum + Math.abs(Number(r.quantity)), 0);
  const closingBalance = openingBalance + inTotal - outTotal;

  return (
    <div>
      <KeyboardShortcuts shortcuts={{ Escape: { href: "/dashboard" } }} />
      <h1 className="mb-3 text-lg font-bold text-[var(--erp-text)]">회계·보고서 &gt; 수불부</h1>

      <PageGuide>
        품목을 고르면 그 달의 이월(전월 이전 누적재고)부터 입고/출고 내역,
        마감재고까지 한 번에 보여줍니다. 창고를 지정하지 않으면 전체 창고
        합산 기준입니다.
      </PageGuide>

      <form method="get" className="erp-search" style={{ marginBottom: 8 }}>
        <div className="erp-field" style={{ minWidth: 220 }}>
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
        <div className="erp-field" style={{ minWidth: 160 }}>
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

      <div className="erp-date-presets" style={{ marginBottom: 12 }}>
        <Link
          href={`/reports/ledger?month=${prevMonth}${productId ? `&product_id=${productId}` : ""}${suffix}`}
          className="erp-date-preset-btn"
        >
          ◀ 이전달
        </Link>
        <Link
          href={`/reports/ledger?month=${thisMonth}${productId ? `&product_id=${productId}` : ""}${suffix}`}
          className={`erp-date-preset-btn${month === thisMonth ? " active" : ""}`}
        >
          이번달
        </Link>
        <Link
          href={`/reports/ledger?month=${nextMonth}${productId ? `&product_id=${productId}` : ""}${suffix}`}
          className="erp-date-preset-btn"
        >
          다음달 ▶
        </Link>
      </div>

      {!selectedProduct ? (
        <p className="text-sm" style={{ color: "var(--erp-text-muted)" }}>
          품목을 선택하면 이 달의 수불 내역이 표시됩니다.
        </p>
      ) : (
        <>
          <div className="erp-kpi-row" style={{ marginBottom: 12 }}>
            <div className="erp-home-panel" style={{ padding: "10px 12px" }}>
              <div style={{ fontSize: 11, color: "var(--erp-text-muted)", fontWeight: 600, marginBottom: 6 }}>
                이월(전월 이전)
              </div>
              <div style={{ fontSize: 17, fontWeight: 700 }}>
                {openingBalance.toLocaleString()} {selectedProduct.unit}
              </div>
            </div>
            <div className="erp-home-panel" style={{ padding: "10px 12px" }}>
              <div style={{ fontSize: 11, color: "var(--erp-text-muted)", fontWeight: 600, marginBottom: 6 }}>
                이번달 입고
              </div>
              <div style={{ fontSize: 17, fontWeight: 700, color: "var(--erp-primary)" }}>
                {inTotal.toLocaleString()} {selectedProduct.unit}
              </div>
            </div>
            <div className="erp-home-panel" style={{ padding: "10px 12px" }}>
              <div style={{ fontSize: 11, color: "var(--erp-text-muted)", fontWeight: 600, marginBottom: 6 }}>
                이번달 출고
              </div>
              <div style={{ fontSize: 17, fontWeight: 700, color: "var(--erp-danger)" }}>
                {outTotal.toLocaleString()} {selectedProduct.unit}
              </div>
            </div>
            <div className="erp-home-panel" style={{ padding: "10px 12px" }}>
              <div style={{ fontSize: 11, color: "var(--erp-text-muted)", fontWeight: 600, marginBottom: 6 }}>
                마감재고
              </div>
              <div style={{ fontSize: 17, fontWeight: 700 }}>
                {closingBalance.toLocaleString()} {selectedProduct.unit}
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
                    <th style={{ width: 140 }}>일시</th>
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
                      <td>{new Date(r.created_at).toLocaleString("ko-KR")}</td>
                      <td>{TYPE_LABEL[r.type] ?? r.type}</td>
                      <td className="num" style={{ color: r.delta < 0 ? "var(--erp-danger)" : "var(--erp-primary)" }}>
                        {r.delta > 0 ? "+" : ""}
                        {r.delta.toLocaleString()}
                      </td>
                      <td className="num">{r.balance.toLocaleString()}</td>
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
