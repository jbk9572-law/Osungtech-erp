import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { KeyboardShortcuts } from "@/components/erp/keyboard-shortcuts";

type SuggestionRow = {
  productId: string;
  sku: string;
  name: string;
  spec: string | null;
  unit: string | null;
  quantity: number;
  reorderPoint: number;
  cost: number;
  supplierId: string | null;
  supplierName: string;
  suggestedQty: number;
};

type SupplierGroup = {
  supplierId: string | null;
  supplierName: string;
  rows: SuggestionRow[];
};

export default async function ReorderSuggestionsPage() {
  const supabase = await createClient();
  // 안전재고를 설정해둔(0보다 큰) 품목만 대상으로 한다 — 대시보드 알림과
  // 동일한 기준(lib/notifications.ts)이라 "재고위험"에 뜨는 품목과 여기
  // 목록이 항상 일치한다.
  const { data: products } = await supabase
    .from("products")
    .select("id, sku, name, spec, unit, reorder_point, cost, supplier_id, suppliers(id, name), inventory(quantity)")
    .gt("reorder_point", 0)
    .order("name");

  const lowStock: SuggestionRow[] = (products ?? [])
    .map((p) => {
      const quantity = p.inventory?.[0]?.quantity ?? 0;
      const reorderPoint = p.reorder_point;
      return {
        productId: p.id,
        sku: p.sku,
        name: p.name,
        spec: p.spec,
        unit: p.unit,
        quantity,
        reorderPoint,
        cost: Number(p.cost),
        // 안전재고의 2배를 목표재고로 두고, 그만큼 채우는 데 필요한 수량을
        // 제안한다 — 재주문점(reorder point) 방식에서 흔히 쓰는 단순한
        // 버퍼 기준이다. 이미 목표재고 이상이면 제안하지 않는다.
        supplierId: p.suppliers?.id ?? null,
        supplierName: p.suppliers?.name ?? "매입처 미지정",
      };
    })
    .filter((p) => p.quantity <= p.reorderPoint)
    .map((p) => ({
      ...p,
      suggestedQty: Math.max(p.reorderPoint * 2 - p.quantity, 1),
    }));

  const groupsMap = new Map<string, SupplierGroup>();
  for (const row of lowStock) {
    const key = row.supplierId ?? "__none__";
    if (!groupsMap.has(key)) {
      groupsMap.set(key, { supplierId: row.supplierId, supplierName: row.supplierName, rows: [] });
    }
    groupsMap.get(key)!.rows.push(row);
  }
  const groups = Array.from(groupsMap.values()).sort((a, b) => b.rows.length - a.rows.length);

  return (
    <div>
      <KeyboardShortcuts shortcuts={{ Escape: { href: "/inventory" } }} />
      <div className="mb-1 flex items-center justify-between">
        <h1 className="text-lg font-bold text-[var(--erp-text)]">
          재고관리 &gt; 재고 부족 자동 발주 제안
        </h1>
        <Link href="/inventory" className="erp-btn erp-btn-danger">
          ESC 닫기
        </Link>
      </div>
      <p className="mb-4 text-xs text-[var(--erp-text-muted)]">
        안전재고 이하로 떨어진 품목을 매입처별로 묶어 보여줍니다. 제안수량은 안전재고의 2배를
        목표로 부족분을 채우는 값이며, 실제 발주 수량은 매입 등록 화면에서 얼마든지 고칠 수
        있습니다.
      </p>

      {groups.length === 0 && (
        <p className="erp-grid-empty" style={{ marginTop: 24 }}>
          안전재고 이하로 떨어진 품목이 없습니다.
        </p>
      )}

      {groups.map((group) => {
        const totalEstimate = group.rows.reduce((sum, r) => sum + r.suggestedQty * r.cost, 0);
        const reorderItems = group.rows.map((r) => ({ productId: r.productId, quantity: r.suggestedQty }));
        const purchaseHref = group.supplierId
          ? `/purchases/new?supplier_id=${group.supplierId}&reorder_items=${encodeURIComponent(
              JSON.stringify(reorderItems),
            )}`
          : null;

        return (
          <div key={group.supplierId ?? "none"} className="erp-detail" style={{ marginTop: 0, marginBottom: 12 }}>
            <div className="erp-detail-tabs" style={{ justifyContent: "space-between" }}>
              <span className="erp-detail-tab active">
                {group.supplierName} · {group.rows.length}개 품목
              </span>
              {purchaseHref ? (
                <Link href={purchaseHref} className="erp-btn erp-btn-primary" style={{ margin: 4 }}>
                  이 매입처로 매입 등록
                </Link>
              ) : (
                <span
                  className="text-xs"
                  style={{ margin: 4, padding: "0 8px", color: "var(--erp-text-muted)" }}
                >
                  품목에 매입처가 지정되어 있지 않아 바로 등록할 수 없습니다.
                </span>
              )}
            </div>
            <div className="erp-grid-wrap" style={{ border: "none", borderRadius: 0 }}>
              <table className="erp-grid">
                <thead>
                  <tr>
                    <th>SKU</th>
                    <th>품목명</th>
                    <th style={{ width: 130 }}>규격</th>
                    <th className="num" style={{ width: 100 }}>
                      현재재고
                    </th>
                    <th className="num" style={{ width: 100 }}>
                      안전재고
                    </th>
                    <th className="num" style={{ width: 110 }}>
                      제안수량
                    </th>
                    <th className="num" style={{ width: 120 }}>
                      예상 매입금액
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {group.rows.map((row) => (
                    <tr key={row.productId}>
                      <td>{row.sku}</td>
                      <td>{row.name}</td>
                      <td style={{ color: "var(--erp-text-muted)" }}>{row.spec || "-"}</td>
                      <td className="num" style={{ color: "var(--erp-danger)", fontWeight: 700 }}>
                        {row.quantity.toLocaleString()} {row.unit ?? ""}
                      </td>
                      <td className="num" style={{ color: "var(--erp-text-muted)" }}>
                        {row.reorderPoint.toLocaleString()} {row.unit ?? ""}
                      </td>
                      <td className="num" style={{ fontWeight: 700 }}>
                        {row.suggestedQty.toLocaleString()} {row.unit ?? ""}
                      </td>
                      <td className="num">{Math.round(row.suggestedQty * row.cost).toLocaleString()}원</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr style={{ background: "var(--erp-bg)", fontWeight: 700 }}>
                    <td colSpan={6} className="erp-grid-sticky-label">
                      예상 매입금액 합계
                    </td>
                    <td className="num">{Math.round(totalEstimate).toLocaleString()}원</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        );
      })}
    </div>
  );
}
