import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { KeyboardShortcuts } from "@/components/erp/keyboard-shortcuts";
import { fetchAllRows } from "@/lib/fetch-all-rows";
import { computeBalanceAfterById } from "@/lib/inventory-balance";

type CountTxRow = {
  id: string;
  product_id: string;
  quantity: number;
  reference: string | null;
  created_at: string;
  products: { sku: string; name: string; unit: string } | null;
  profiles: { full_name: string | null } | null;
};

type Session = {
  reference: string;
  createdAt: string;
  authorName: string | null;
  items: { id: string; productId: string; sku: string; name: string; unit: string; delta: number }[];
};

export default async function InventoryCountHistoryPage({
  searchParams,
}: {
  searchParams: Promise<{ session?: string }>;
}) {
  const { session: sessionParam } = await searchParams;
  const supabase = await createClient();

  // 재고실사(submitStockCount)가 남긴 조정만 대상으로 한다 — reference에
  // "stock_count:" 접두어를 붙여두는 게 이 화면을 위한 표식이다(actions.ts
  // 참고). 단발성 수기 조정(재고조정 화면)은 reference가 없어 여기 안 잡힌다.
  const countTx = await fetchAllRows<CountTxRow>((from, to) =>
    supabase
      .from("inventory_transactions")
      .select(
        "id, product_id, quantity, reference, created_at, products(sku, name, unit), profiles!created_by(full_name)",
      )
      .like("reference", "stock_count:%")
      .order("created_at", { ascending: true })
      .range(from, to),
  );

  const sessionsByRef = new Map<string, Session>();
  for (const t of countTx) {
    const ref = t.reference ?? "";
    let session = sessionsByRef.get(ref);
    if (!session) {
      session = {
        reference: ref,
        createdAt: t.created_at,
        authorName: t.profiles?.full_name ?? null,
        items: [],
      };
      sessionsByRef.set(ref, session);
    }
    session.items.push({
      id: t.id,
      productId: t.product_id,
      sku: t.products?.sku ?? "-",
      name: t.products?.name ?? "(삭제된 품목)",
      unit: t.products?.unit ?? "",
      delta: t.quantity,
    });
  }

  const sessions = Array.from(sessionsByRef.values()).sort((a, b) =>
    b.createdAt.localeCompare(a.createdAt),
  );

  const selectedSession = sessionParam ? (sessionsByRef.get(sessionParam) ?? null) : null;

  // 선택한 회차에서 조정된 품목들의 "이전/이후" 수량은 그 회차의 조정분
  // (delta)만으로는 알 수 없다 — 그 사이 다른 매출/매입으로도 재고가
  // 바뀌었을 수 있어서, 해당 품목의 전체 이력을 처음부터 누적해야 그
  // 시점의 정확한 잔량이 나온다(/inventory/[productId]와 같은 계산).
  let detailRows: {
    productId: string;
    sku: string;
    name: string;
    unit: string;
    before: number;
    after: number;
    delta: number;
  }[] = [];

  if (selectedSession) {
    const productIds = Array.from(new Set(selectedSession.items.map((i) => i.productId)));
    const fullHistory = await fetchAllRows<{
      id: string;
      product_id: string;
      type: string;
      quantity: number;
    }>((from, to) =>
      supabase
        .from("inventory_transactions")
        .select("id, product_id, type, quantity, created_at")
        .in("product_id", productIds)
        .order("created_at", { ascending: true })
        .range(from, to),
    );

    const byProduct = new Map<string, typeof fullHistory>();
    for (const t of fullHistory) {
      const arr = byProduct.get(t.product_id) ?? [];
      arr.push(t);
      byProduct.set(t.product_id, arr);
    }

    detailRows = selectedSession.items.map((item) => {
      const history = byProduct.get(item.productId) ?? [];
      const balanceAfterById = computeBalanceAfterById(history);
      const after = balanceAfterById.get(item.id) ?? 0;
      return {
        productId: item.productId,
        sku: item.sku,
        name: item.name,
        unit: item.unit,
        before: after - item.delta,
        after,
        delta: item.delta,
      };
    });
  }

  return (
    <div>
      <KeyboardShortcuts shortcuts={{ Escape: { href: "/inventory" } }} />
      <div className="mb-1 flex items-center justify-between">
        <h1 className="text-lg font-bold text-[var(--erp-text)]">
          재고관리 &gt; 실사 이력
        </h1>
        <Link href="/inventory" className="erp-btn erp-btn-danger">
          ESC 닫기
        </Link>
      </div>
      <p className="mb-4 text-xs text-[var(--erp-text-muted)]">
        지금까지 진행한 재고 실사 회차 목록입니다. 회차를 클릭하면 그때 조정된 품목을 볼 수
        있습니다.
      </p>

      <div className="erp-grid-wrap">
        <table className="erp-grid">
          <thead>
            <tr>
              <th>실사 일시</th>
              <th>작성자</th>
              <th className="num" style={{ width: 110 }}>
                조정 품목 수
              </th>
              <th style={{ width: 90 }}></th>
            </tr>
          </thead>
          <tbody>
            {sessions.map((session) => {
              const isSelected = session.reference === sessionParam;
              return (
                <tr key={session.reference} className={isSelected ? "selected" : undefined}>
                  <td>{new Date(session.createdAt).toLocaleString("ko-KR")}</td>
                  <td style={{ color: "var(--erp-text-muted)" }}>
                    {session.authorName ?? "-"}
                  </td>
                  <td className="num">{session.items.length}건</td>
                  <td>
                    <Link
                      href={
                        isSelected
                          ? "/inventory/count-history"
                          : `/inventory/count-history?session=${encodeURIComponent(session.reference)}`
                      }
                      style={{ color: "var(--erp-primary)", fontWeight: 600 }}
                    >
                      {isSelected ? "닫기 ▴" : "상세보기 ▾"}
                    </Link>
                  </td>
                </tr>
              );
            })}
            {!sessions.length && (
              <tr>
                <td colSpan={4} className="erp-grid-empty">
                  진행한 재고 실사가 없습니다.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {selectedSession && (
        <div className="erp-grid-wrap" style={{ marginTop: 8, marginLeft: 24 }}>
          <table className="erp-grid">
            <thead>
              <tr>
                <th>SKU</th>
                <th>품목명</th>
                <th className="num" style={{ width: 110 }}>
                  이전 수량
                </th>
                <th className="num" style={{ width: 110 }}>
                  조정 후
                </th>
                <th className="num" style={{ width: 90 }}>
                  차이
                </th>
              </tr>
            </thead>
            <tbody>
              {detailRows.map((row) => (
                <tr key={row.productId}>
                  <td>{row.sku}</td>
                  <td>{row.name}</td>
                  <td className="num">
                    {row.before.toLocaleString()} {row.unit}
                  </td>
                  <td className="num">
                    {row.after.toLocaleString()} {row.unit}
                  </td>
                  <td
                    className="num"
                    style={{
                      fontWeight: 700,
                      color: row.delta > 0 ? "var(--erp-success)" : "var(--erp-danger)",
                    }}
                  >
                    {row.delta > 0 ? "+" : ""}
                    {row.delta.toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
