import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { KeyboardShortcuts } from "@/components/erp/keyboard-shortcuts";
import { ListPageHeader, FormSection } from "@/components/erp/page-header";
import { PageGuide } from "@/components/erp/page-guide";
import { InlineConfirmDelete } from "@/components/inline-confirm-delete";
import { WarehouseForm } from "@/components/warehouse-form";
import { ClickableRow } from "@/components/clickable-row";
import { createWarehouse, deleteWarehouse } from "@/app/(dashboard)/inventory/warehouses/actions";
import { fetchAllRows } from "@/lib/fetch-all-rows";

// 창고 관리(마스터: 창고 목록)와 창고 이동(거래 이력)을 탭으로 나눠뒀었는데,
// "탭으로 나누지 말고 하나로 합쳐달라"는 요청으로 한 페이지에 세로로
// 같이 보여주는 방식으로 바꿨다. 데이터/서버 액션/RLS는 그대로 완전히
// 분리돼 있다 — 합친 건 이 화면(진입점) 하나뿐이고, 창고 이동 등록/상세는
// 지금처럼 /inventory/transfers/new, /inventory/transfers/[id]를 그대로 쓴다.
export default async function WarehousesPage() {
  const supabase = await createClient();
  const [warehouses, { data: transfers }] = await Promise.all([
    fetchAllRows<{ id: string; name: string; location: string | null; created_at: string }>((from, to) =>
      supabase.from("warehouses").select("id, name, location, created_at").order("created_at").range(from, to),
    ),
    supabase
      .from("stock_transfers")
      .select(
        "id, transfer_date, memo, from_warehouse:warehouses!from_warehouse_id(name), to_warehouse:warehouses!to_warehouse_id(name), profiles!created_by(full_name), stock_transfer_items(quantity)",
      )
      .order("transfer_date", { ascending: false })
      .limit(300),
  ]);

  return (
    <div>
      <KeyboardShortcuts shortcuts={{ F2: { href: "/inventory/transfers/new" }, Escape: { href: "/inventory" } }} />
      <ListPageHeader title="재고관리 > 창고" />

      <PageGuide>
        창고를 2개 이상 등록해야 창고 간 이동을 등록할 수 있습니다. 창고를
        지우면 그 창고를 쓰는 재고/전표가 남아있는 한 삭제가 거부됩니다.
      </PageGuide>

      <FormSection tabLabel="창고 등록">
        <WarehouseForm action={createWarehouse} />
      </FormSection>

      <div style={{ marginTop: 14 }}>
        <FormSection tabLabel={`창고 목록 (${warehouses.length})`}>
          <div className="erp-grid-wrap">
            <table className="erp-grid">
              <thead>
                <tr>
                  <th>창고명</th>
                  <th>위치</th>
                  <th style={{ width: 90 }}>관리</th>
                </tr>
              </thead>
              <tbody>
                {warehouses.map((w) => (
                  <tr key={w.id}>
                    <td>{w.name}</td>
                    <td style={{ color: "var(--erp-text-muted)" }}>{w.location || "-"}</td>
                    <td>
                      <InlineConfirmDelete
                        action={deleteWarehouse}
                        hiddenFields={{ id: w.id }}
                        warningText="이 창고를 삭제하시겠습니까? 재고/전표에서 쓰이고 있으면 삭제가 거부됩니다."
                        triggerStyle={{ minWidth: 0, height: 22, padding: "0 8px", fontSize: 11 }}
                      />
                    </td>
                  </tr>
                ))}
                {warehouses.length === 0 && (
                  <tr>
                    <td colSpan={3} className="erp-grid-empty">
                      등록된 창고가 없습니다.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </FormSection>
      </div>

      <div style={{ marginTop: 14 }}>
        <FormSection tabLabel={`창고 이동 이력 (${transfers?.length ?? 0})`}>
          <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 10 }}>
            <Link href="/inventory/transfers/new" className="erp-btn erp-btn-primary">
              F2 창고 이동 등록
            </Link>
          </div>
          <div className="erp-grid-wrap">
            <table className="erp-grid">
              <thead>
                <tr>
                  <th style={{ width: 90 }}>이동일</th>
                  <th style={{ width: 160 }}>출발 창고</th>
                  <th style={{ width: 160 }}>도착 창고</th>
                  <th className="num" style={{ width: 80 }}>품목 수</th>
                  <th className="num" style={{ width: 90 }}>총 이동수량</th>
                  <th style={{ width: 90 }}>처리자</th>
                  <th>메모</th>
                </tr>
              </thead>
              <tbody>
                {(transfers ?? []).map((t) => {
                  const items = t.stock_transfer_items ?? [];
                  const totalQty = items.reduce((sum, i) => sum + Number(i.quantity), 0);
                  return (
                    <ClickableRow key={t.id} href={`/inventory/transfers/${t.id}`}>
                      <td>{t.transfer_date.replaceAll("-", ".")}</td>
                      <td>{t.from_warehouse?.name ?? "-"}</td>
                      <td>{t.to_warehouse?.name ?? "-"}</td>
                      <td className="num">{items.length}</td>
                      <td className="num">{totalQty.toLocaleString()}</td>
                      <td>{t.profiles?.full_name ?? "-"}</td>
                      <td style={{ color: "var(--erp-text-muted)" }}>{t.memo ?? "-"}</td>
                    </ClickableRow>
                  );
                })}
                {(!transfers || transfers.length === 0) && (
                  <tr>
                    <td colSpan={7} className="erp-grid-empty">
                      등록된 창고 이동이 없습니다.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </FormSection>
      </div>
    </div>
  );
}
