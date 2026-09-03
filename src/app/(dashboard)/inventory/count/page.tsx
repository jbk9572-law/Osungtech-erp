import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { InventoryCountForm, type CountRow } from "@/components/inventory-count-form";
import { KeyboardShortcuts } from "@/components/erp/keyboard-shortcuts";
import { fetchAllRows } from "@/lib/fetch-all-rows";
import { computeBalanceAfterById } from "@/lib/inventory-balance";

type CountTxRow = {
  id: string;
  product_id: string;
  quantity: number;
  reference: string | null;
  note: string | null;
  created_at: string;
  products: { sku: string; name: string; unit: string } | null;
  profiles: { full_name: string | null } | null;
};

type Session = {
  reference: string;
  createdAt: string;
  authorName: string | null;
  note: string | null;
  items: { id: string; productId: string; sku: string; name: string; unit: string; delta: number }[];
};

// actions.ts의 submitStockCount가 사용자가 입력한 사유를 "재고실사: <사유>"
// 형태로 note에 남긴다 — 앞의 고정 문구를 떼고 사유만 보여준다.
function extractCountNote(note: string | null): string | null {
  if (!note) return null;
  const prefix = "재고실사: ";
  return note.startsWith(prefix) ? note.slice(prefix.length) : null;
}

export default async function InventoryCountPage({
  searchParams,
}: {
  searchParams: Promise<{ session?: string }>;
}) {
  const { session: sessionParam } = await searchParams;
  const supabase = await createClient();

  const [products, { data: warehouse }, countTx, allTx] = await Promise.all([
    fetchAllRows<{
      id: string;
      sku: string;
      name: string;
      spec: string | null;
      unit: string;
      reorder_point: number | null;
      base_package_qty: number | null;
      inventory: { quantity: number }[];
    }>((from, to) =>
      supabase
        .from("products")
        .select("id, sku, name, spec, unit, reorder_point, base_package_qty, inventory(quantity)")
        .order("name")
        .range(from, to),
    ),
    supabase
      .from("warehouses")
      .select("id")
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle(),
    // 재고실사(submitStockCount)가 남긴 조정만 대상으로 한다 — reference에
    // "stock_count:" 접두어를 붙여두는 게 이 화면을 위한 표식이다(actions.ts
    // 참고). 단발성 수기 조정(재고조정 화면)은 reference가 없어 여기 안 잡힌다.
    fetchAllRows<CountTxRow>((from, to) =>
      supabase
        .from("inventory_transactions")
        .select(
          "id, product_id, quantity, reference, note, created_at, products(sku, name, unit), profiles!created_by(full_name)",
        )
        .like("reference", "stock_count:%")
        .order("created_at", { ascending: true })
        .range(from, to),
    ),
    // "실사가 말도 안 되게 벌어진다"는 지적에 대한 실측 검증용 — products.
    // inventory(캐시된 값, apply_inventory_transaction 트리거가 매번 갱신)와
    // 전체 거래이력을 직접 다시 더한 값이 실제로 일치하는지 전수 비교한다.
    // 둘이 다르면 캐시 자체가 잘못 갱신된 소프트웨어 버그이고, 둘이 같다면
    // 실사에서 보이는 큰 차이는 코드 문제가 아니라 실제 현실(파손/누락 등)의
    // 반영이라는 뜻이다 — DB에 직접 접근하지 않고도 화면에서 바로 확인된다.
    fetchAllRows<{ product_id: string; type: string; quantity: number }>((from, to) =>
      supabase.from("inventory_transactions").select("product_id, type, quantity").range(from, to),
    ),
  ]);

  const rows: CountRow[] = products.map((p) => ({
    productId: p.id,
    sku: p.sku,
    name: p.name,
    spec: p.spec,
    unit: p.unit,
    systemQuantity: p.inventory?.[0]?.quantity ?? 0,
    basePackageQty: p.base_package_qty,
  }));

  // 안전재고를 실제로 설정해둔(0보다 큰) 품목만 대상으로 한다 — 알림종/대시보드
  // 배너(src/lib/notifications.ts)와 같은 기준이다. 이 화면은 어차피 전체
  // 품목을 이미 불러와 놓은 상태라 별도 조회 없이 그대로 필터링한다.
  const lowStockProducts = products
    .map((p) => ({ name: p.name, quantity: p.inventory?.[0]?.quantity ?? 0, reorderPoint: p.reorder_point ?? 0 }))
    .filter((p) => p.reorderPoint > 0 && p.quantity <= p.reorderPoint);

  // apply_inventory_transaction 트리거와 완전히 같은 부호 규칙으로
  // 전체 이력을 직접 다시 더해, 캐시된 products.inventory.quantity와
  // 실제로 일치하는지 전 품목 전수 비교한다.
  const computedByProduct = new Map<string, number>();
  for (const t of allTx) {
    const signed = t.type === "out" ? -Math.abs(t.quantity) : t.quantity;
    computedByProduct.set(t.product_id, (computedByProduct.get(t.product_id) ?? 0) + signed);
  }
  // 매입/매출 수량은 소수점 입력이 가능한데(decimal_quantity 마이그레이션),
  // Postgres 쪽 캐시(inventory.quantity)는 numeric으로 정확히 누적되는 반면
  // 여기 computedByProduct는 자바스크립트 부동소수점으로 다시 더한 값이라
  // 0.1+0.2 같은 미세한 오차가 생길 수 있다. 오차 없는 실제 불일치만
  // 잡히도록 아주 작은 허용오차(0.001) 이내 차이는 일치로 본다.
  const EPSILON = 0.001;
  const cacheMismatches = products
    .map((p) => ({
      sku: p.sku,
      name: p.name,
      cached: p.inventory?.[0]?.quantity ?? 0,
      computed: computedByProduct.get(p.id) ?? 0,
    }))
    .filter((p) => Math.abs(p.cached - p.computed) > EPSILON);

  const sessionsByRef = new Map<string, Session>();
  for (const t of countTx) {
    const ref = t.reference ?? "";
    let session = sessionsByRef.get(ref);
    if (!session) {
      session = {
        reference: ref,
        createdAt: t.created_at,
        authorName: t.profiles?.full_name ?? null,
        note: extractCountNote(t.note),
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

  // "전산-실사 최대 오차" — 지금까지의 모든 실사 조정 중 절댓값이 가장 큰
  // 단일 품목 하나를 요약 카드에 보여준다. 회차별 합계가 아니라 개별 품목의
  // 오차라, 어느 품목이 특히 자주/크게 틀리는지 한눈에 보인다.
  const largestMiss = countTx.reduce<CountTxRow | null>(
    (best, t) => (!best || Math.abs(t.quantity) > Math.abs(best.quantity) ? t : best),
    null,
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
        <h1 className="text-lg font-bold text-[var(--erp-text)]">재고관리 &gt; 재고 실사</h1>
        <Link href="/inventory" className="erp-btn erp-btn-danger">
          ESC 닫기
        </Link>
      </div>
      <p className="mb-4 text-xs text-[var(--erp-text-muted)]">
        전산 재고와 실제 수량을 비교해 맞추고, 지금까지의 실사 이력을 함께 확인합니다.
      </p>

      <div className="erp-hero-row">
        <div className="erp-hero-card">
          <div className="erp-hero-label">총 실사 횟수</div>
          <div className="erp-hero-value">{sessions.length}회</div>
          {sessions.length > 0 && (
            <div className="erp-hero-sub">누적 조정 {countTx.length}건</div>
          )}
        </div>
        <div className="erp-hero-card">
          <div className="erp-hero-label">최근 실사일</div>
          {sessions.length > 0 ? (
            <>
              <div className="erp-hero-value" style={{ fontSize: 17 }}>
                {new Date(sessions[0].createdAt).toLocaleDateString("ko-KR")}
              </div>
              <div className="erp-hero-sub">
                {sessions[0].authorName ?? "-"} · {sessions[0].items.length}건 조정
              </div>
            </>
          ) : (
            <div className="erp-hero-value" style={{ fontSize: 17, color: "var(--erp-text-muted)" }}>
              -
            </div>
          )}
        </div>
        <div className="erp-hero-card">
          <div className="erp-hero-label">전산-실사 최대 오차</div>
          {largestMiss ? (
            <>
              <div className="erp-hero-value">
                {largestMiss.quantity > 0 ? "+" : ""}
                {largestMiss.quantity.toLocaleString()}
              </div>
              <div className="erp-hero-sub">
                {largestMiss.products?.name ?? "-"} ({largestMiss.products?.sku ?? "-"})
              </div>
            </>
          ) : (
            <div className="erp-hero-value" style={{ color: "var(--erp-text-muted)" }}>
              -
            </div>
          )}
        </div>
        <div className="erp-hero-card" style={lowStockProducts.length > 0 ? { borderLeftColor: "var(--erp-warning)" } : undefined}>
          <div className="erp-hero-label">안전재고 이하 품목</div>
          <div
            className="erp-hero-value"
            style={lowStockProducts.length > 0 ? { color: "var(--erp-warning)" } : undefined}
          >
            {lowStockProducts.length}건
          </div>
          <div className="erp-hero-sub">
            {lowStockProducts.length > 0
              ? lowStockProducts.slice(0, 2).map((p) => p.name).join(" · ")
              : "없음"}
          </div>
        </div>
      </div>

      {/* "실사가 말도 안 되게 벌어진다"는 지적에 대한 실측 답변 — 화면에
          보이는 전산 재고(products.inventory 캐시)가 전체 거래이력을 직접
          다시 더한 값과 실제로 일치하는지 전 품목 전수 비교한다. 여기가
          비어 있으면(정상) 실사에서 보이는 차이는 소프트웨어 버그가 아니라
          실제 현실(파손/누락 등)이 그대로 반영된 것이라는 뜻이다. */}
      <div
        className="erp-detail"
        style={{ marginTop: 0, marginBottom: 16, borderColor: cacheMismatches.length > 0 ? "var(--erp-danger)" : "var(--erp-success)" }}
      >
        <div className="erp-detail-tabs" style={{ justifyContent: "space-between", paddingRight: 12 }}>
          <span className="erp-detail-tab active" style={{ borderRight: "none", cursor: "default" }}>
            재고 캐시 정합성 검증
          </span>
          <span
            className={cacheMismatches.length > 0 ? "erp-badge erp-badge-danger" : "erp-badge erp-badge-success"}
          >
            {cacheMismatches.length > 0
              ? `불일치 ${cacheMismatches.length}건 발견`
              : `전체 ${products.length}개 품목 정상`}
          </span>
        </div>
        <div className="erp-detail-body">
          {cacheMismatches.length === 0 ? (
            <p className="text-xs" style={{ color: "var(--erp-text-muted)" }}>
              화면에 보이는 전산 재고(캐시)와 입출고/조정 이력을 처음부터 전부 다시 더한 값을 전
              품목 비교한 결과, 차이가 있는 품목이 없습니다. 즉 이 화면의 계산 로직 자체에는 문제가
              없고, 실사에서 나오는 큰 차이는 실제 재고 유실·파손·누락 등 현실이 그대로 반영된
              것입니다.
            </p>
          ) : (
            <>
              <p className="mb-2 text-xs" style={{ color: "var(--erp-danger)" }}>
                ⚠ 아래 품목은 화면의 전산 재고와 실제 거래이력 합계가 다릅니다 — 소프트웨어
                계산/캐시 문제일 가능성이 있으니 실사보다 먼저 이 목록부터 확인하세요.
              </p>
              <div className="erp-grid-wrap">
                <table className="erp-grid">
                  <thead>
                    <tr>
                      <th>SKU</th>
                      <th>품목명</th>
                      <th className="num" style={{ width: 130 }}>
                        화면 전산 재고
                      </th>
                      <th className="num" style={{ width: 130 }}>
                        이력 합계(정답)
                      </th>
                      <th className="num" style={{ width: 100 }}>
                        차이
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {cacheMismatches.map((m) => (
                      <tr key={m.sku}>
                        <td>{m.sku}</td>
                        <td>{m.name}</td>
                        <td className="num">{m.cached.toLocaleString()}</td>
                        <td className="num">{m.computed.toLocaleString()}</td>
                        <td className="num" style={{ fontWeight: 700, color: "var(--erp-danger)" }}>
                          {(m.cached - m.computed > 0 ? "+" : "") + (m.cached - m.computed).toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </div>

      <div className="mb-2 mt-6 flex items-baseline justify-between">
        <h2 className="text-sm font-bold text-[var(--erp-text)]">실사 이력</h2>
        {sessions.length > 0 && (
          <span className="text-[11.5px]" style={{ color: "var(--erp-text-muted)" }}>
            회차를 클릭하면 그때 조정된 품목이 펼쳐집니다
          </span>
        )}
      </div>

      <div className="flex flex-col gap-2">
        {sessions.map((session) => {
          const isSelected = session.reference === sessionParam;
          return (
            <Link
              key={session.reference}
              href={
                isSelected
                  ? "/inventory/count"
                  : `/inventory/count?session=${encodeURIComponent(session.reference)}`
              }
              className="erp-item-card"
              style={isSelected ? { borderColor: "var(--erp-primary)", boxShadow: "var(--erp-shadow-md)" } : undefined}
            >
              <div className="erp-avatar">{(session.authorName ?? "-").slice(0, 1)}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-bold" style={{ fontSize: 13 }}>
                    {new Date(session.createdAt).toLocaleString("ko-KR")}
                  </span>
                  <span className="erp-badge erp-badge-info">{session.items.length}건 조정</span>
                </div>
                <div className="mt-0.5 text-[11.5px]" style={{ color: "var(--erp-text-muted)" }}>
                  작성자 {session.authorName ?? "-"}
                  {session.note ? ` · 사유: ${session.note}` : " · 사유 기록 없음"}
                </div>

                {isSelected && (
                  <div className="erp-grid-wrap" style={{ marginTop: 10 }}>
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
              <div className="text-[11px]" style={{ color: "var(--erp-text-muted)", flexShrink: 0 }}>
                {isSelected ? "▲ 접기" : "▾ 펼치기"}
              </div>
            </Link>
          );
        })}
        {!sessions.length && (
          <p className="text-sm" style={{ color: "var(--erp-text-muted)" }}>
            진행한 재고 실사가 없습니다.
          </p>
        )}
      </div>

      <h2 className="mb-2 mt-6 text-sm font-bold text-[var(--erp-text)]">새 실사 진행</h2>
      <InventoryCountForm rows={rows} warehouseId={warehouse?.id ?? ""} />
    </div>
  );
}
