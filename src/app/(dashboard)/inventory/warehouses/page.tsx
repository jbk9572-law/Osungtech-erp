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
import { formatNumber } from "@/lib/format-number";
import { getQuickDatePresets, getYearMonthButtons, defaultListRange } from "@/lib/date-presets";
import { DateRangeQuickFilters } from "@/components/erp/date-range-quick-filters";
import { buildBackHref } from "@/lib/list-return";

// 창고 관리(마스터: 창고 목록)와 창고 이동(거래 이력)을 탭으로 나눠뒀었는데,
// "탭으로 나누지 말고 하나로 합쳐달라"는 요청으로 한 페이지에 세로로
// 같이 보여주는 방식으로 바꿨다. 데이터/서버 액션/RLS는 그대로 완전히
// 분리돼 있다 — 합친 건 이 화면(진입점) 하나뿐이고, 창고 이동 등록/상세는
// 지금처럼 /inventory/transfers/new, /inventory/transfers/[id]를 그대로 쓴다.
export default async function WarehousesPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const { from, to } = await searchParams;
  // 매출/매입/생산지시 목록과 같은 기본값(이번달) — 예전엔 조회기간
  // 필터가 없어 최근 300건으로 고정돼 있었는데, 그보다 오래된 이동
  // 이력은 아예 조회할 수 없었다(헌법검사에서 발견).
  const { from: effectiveFrom, to: effectiveTo } = defaultListRange(from, to);
  // 창고 이동 상세를 눌렀다가 닫으면 지금 이 조회기간 그대로 돌아와야
  // 한다(사용자 지적).
  const selfBack = buildBackHref(`/inventory/warehouses?from=${effectiveFrom}&to=${effectiveTo}`);
  const supabase = await createClient();
  const [warehouses, transfers] = await Promise.all([
    fetchAllRows<{ id: string; name: string; location: string | null; created_at: string }>((f, t) =>
      supabase.from("warehouses").select("id, name, location, created_at").order("created_at").range(f, t),
    ),
    fetchAllRows<{
      id: string;
      transfer_date: string;
      memo: string | null;
      from_warehouse: { name: string };
      to_warehouse: { name: string };
      profiles: { full_name: string | null } | null;
      stock_transfer_items: { quantity: number }[];
    }>((f, t) =>
      supabase
        .from("stock_transfers")
        .select(
          "id, transfer_date, memo, from_warehouse:warehouses!from_warehouse_id(name), to_warehouse:warehouses!to_warehouse_id(name), profiles!created_by(full_name), stock_transfer_items(quantity)",
        )
        .gte("transfer_date", effectiveFrom)
        .lte("transfer_date", effectiveTo)
        .order("transfer_date", { ascending: false })
        .range(f, t),
    ),
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
        <FormSection tabLabel={`창고 이동 이력 (${transfers.length})`}>
          <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 10 }}>
            <Link href="/inventory/transfers/new" className="erp-btn erp-btn-primary">
              F2 창고 이동 등록
            </Link>
          </div>

          <DateRangeQuickFilters
            basePath="/inventory/warehouses"
            presets={getQuickDatePresets()}
            monthButtons={getYearMonthButtons()}
            from={effectiveFrom}
            to={effectiveTo}
          />

          <form method="get" className="erp-field-grid" style={{ marginBottom: 10 }}>
            <div className="erp-field erp-span-2">
              <label htmlFor="transfer-from">시작일</label>
              <input id="transfer-from" type="date" name="from" defaultValue={from ?? effectiveFrom} className="erp-input" />
            </div>
            <div className="erp-field erp-span-2">
              <label htmlFor="transfer-to">종료일</label>
              <input id="transfer-to" type="date" name="to" defaultValue={to ?? effectiveTo} className="erp-input" />
            </div>
            <button type="submit" className="erp-btn erp-btn-primary">
              조회
            </button>
          </form>

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
                {transfers.map((t) => {
                  const items = t.stock_transfer_items ?? [];
                  const totalQty = items.reduce((sum, i) => sum + Number(i.quantity), 0);
                  return (
                    <ClickableRow key={t.id} href={`/inventory/transfers/${t.id}?back=${selfBack}`}>
                      <td>{t.transfer_date.replaceAll("-", ".")}</td>
                      <td>{t.from_warehouse?.name ?? "-"}</td>
                      <td>{t.to_warehouse?.name ?? "-"}</td>
                      <td className="num">{items.length}</td>
                      <td className="num">{formatNumber(totalQty)}</td>
                      <td>{t.profiles?.full_name ?? "-"}</td>
                      <td style={{ color: "var(--erp-text-muted)" }}>{t.memo ?? "-"}</td>
                    </ClickableRow>
                  );
                })}
                {transfers.length === 0 && (
                  <tr>
                    <td colSpan={7} className="erp-grid-empty">
                      이 기간에 등록된 창고 이동이 없습니다.
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
