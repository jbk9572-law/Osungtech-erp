import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { KeyboardShortcuts } from "@/components/erp/keyboard-shortcuts";
import { ListPageHeader } from "@/components/erp/page-header";
import { ClickableRow } from "@/components/clickable-row";

export default async function StockTransfersPage() {
  const supabase = await createClient();

  const { data: transfers } = await supabase
    .from("stock_transfers")
    .select(
      "id, transfer_date, memo, from_warehouse:warehouses!from_warehouse_id(name), to_warehouse:warehouses!to_warehouse_id(name), stock_transfer_items(quantity)",
    )
    .order("transfer_date", { ascending: false })
    .limit(300);

  return (
    <div>
      <KeyboardShortcuts shortcuts={{ F2: { href: "/inventory/transfers/new" }, Escape: { href: "/inventory" } }} />
      <ListPageHeader
        title="재고관리 > 창고 이동"
        actions={
          <Link href="/inventory/transfers/new" className="erp-btn erp-btn-primary">
            F2 창고 이동 등록
          </Link>
        }
      />

      <div className="erp-grid-wrap">
        <table className="erp-grid">
          <thead>
            <tr>
              <th style={{ width: 90 }}>이동일</th>
              <th style={{ width: 160 }}>출발 창고</th>
              <th style={{ width: 160 }}>도착 창고</th>
              <th className="num" style={{ width: 100 }}>품목 수</th>
              <th>메모</th>
            </tr>
          </thead>
          <tbody>
            {(transfers ?? []).map((t) => (
              <ClickableRow key={t.id} href={`/inventory/transfers/${t.id}`}>
                <td>{t.transfer_date.replaceAll("-", ".")}</td>
                <td>{t.from_warehouse?.name ?? "-"}</td>
                <td>{t.to_warehouse?.name ?? "-"}</td>
                <td className="num">{(t.stock_transfer_items ?? []).length}</td>
                <td style={{ color: "var(--erp-text-muted)" }}>{t.memo ?? "-"}</td>
              </ClickableRow>
            ))}
            {(!transfers || transfers.length === 0) && (
              <tr>
                <td colSpan={5} className="erp-grid-empty">
                  등록된 창고 이동이 없습니다.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
