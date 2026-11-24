import { NewButton } from "@/components/erp/list-toolbar";
import { InventorySubTabs } from "@/components/erp/inventory-sub-tabs";
import Link from "next/link";
import { GuardedLink } from "@/components/erp/guarded-link";
import { createClient } from "@/lib/supabase/server";
import { KeyboardShortcuts } from "@/components/erp/keyboard-shortcuts";
import { ListPageHeader, FormSection } from "@/components/erp/page-header";
import { ToolbarKey } from "@/components/erp/list-toolbar";
import { PageGuide } from "@/components/erp/page-guide";
import { InlineConfirmDelete } from "@/components/inline-confirm-delete";
import { WarehouseForm } from "@/components/warehouse-form";
import { ClickableRow } from "@/components/clickable-row";
import { createWarehouse, deleteWarehouse } from "@/app/(dashboard)/inventory/warehouses/actions";
import { fetchAllRows } from "@/lib/fetch-all-rows";
import { formatNumber } from "@/lib/format-number";
import { getQuickDatePresets, getYearMonthButtons, defaultListRange } from "@/lib/date-presets";
import { DateRangeQuickFilters } from "@/components/erp/date-range-quick-filters";
import { getThemeFeatures } from "@/lib/erp-theme-config";
import { getTenantTheme } from "@/lib/tenant-theme";
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
  const listFrameV2 = getThemeFeatures(await getTenantTheme(supabase)).listFrameV2;
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
      <ListPageHeader
        title="재고관리 > 창고"
        actions={
          listFrameV2 ? (
            <>
              <NewButton href="/inventory/warehouses/new">새 창고</NewButton>
              {/* check-new-button:ignore 보조 등록 버튼(새 창고가 기본) */}
              <GuardedLink href="/inventory/transfers/new" className="erp-btn">
                창고 이동 등록<ToolbarKey>F2</ToolbarKey>
              </GuardedLink>
            </>
          ) : undefined
        }
      />
      <InventorySubTabs />

      <PageGuide>
        창고를 2개 이상 등록해야 창고 간 이동을 등록할 수 있습니다. 창고를
        지우면 그 창고를 쓰는 재고/전표가 남아있는 한 삭제가 거부됩니다.
      </PageGuide>

      {!listFrameV2 && (
        <WarehouseForm action={createWarehouse} />
      )}

      <div className="erp-u-mt-14">
        <FormSection tabLabel={`창고 목록 (${warehouses.length})`}>
          <div className="erp-grid-wrap has-card-view">
            <table className="erp-grid">
              <thead>
                <tr>
                  <th>창고명</th>
                  <th>위치</th>
                  <th className="erp-col-m">관리</th>
                </tr>
              </thead>
              <tbody>
                {warehouses.map((w) => (
                  <tr key={w.id}>
                    <td>{w.name}</td>
                    <td className="erp-u-muted">{w.location || "-"}</td>
                    <td>
                      <InlineConfirmDelete
                        action={deleteWarehouse}
                        hiddenFields={{ id: w.id }}
                        warningText="이 창고를 삭제하시겠습니까? 재고/전표에서 쓰이고 있으면 삭제가 거부됩니다."
                        triggerClassName="erp-btn erp-btn-danger erp-btn-xs"
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
          <div className="erp-row-card-list">
            {warehouses.map((w) => (
              <div className="erp-row-card" key={w.id}>
                <div className="erp-row-card-head">
                  <span className="erp-row-card-partner">{w.name}</span>
                  <InlineConfirmDelete
                    action={deleteWarehouse}
                    hiddenFields={{ id: w.id }}
                    warningText="이 창고를 삭제하시겠습니까? 재고/전표에서 쓰이고 있으면 삭제가 거부됩니다."
                    triggerClassName="erp-btn erp-btn-danger erp-btn-xs"
                  />
                </div>
                <p className="erp-u-muted erp-u-text-sm erp-u-m-0">
                  {w.location || "-"}
                </p>
              </div>
            ))}
            {warehouses.length === 0 && <p className="erp-grid-empty">등록된 창고가 없습니다.</p>}
          </div>
        </FormSection>
      </div>

      <div className="erp-u-mt-14">
        <FormSection tabLabel={`창고 이동 이력 (${transfers.length})`}>
          {!listFrameV2 && (
            <div className="erp-u-flex erp-u-mb-10 erp-u-justify-end">
              <NewButton href="/inventory/transfers/new">창고 이동 등록</NewButton>
            </div>
          )}

          <DateRangeQuickFilters
            basePath="/inventory/warehouses"
            presets={getQuickDatePresets()}
            monthButtons={getYearMonthButtons()}
            from={effectiveFrom}
            to={effectiveTo}
          />

          <form method="get" className="erp-field-grid erp-u-mb-10">
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

          <div className="erp-grid-wrap has-card-view">
            <table className="erp-grid">
              <thead>
                <tr>
                  <th className="erp-col-m">이동일</th>
                  <th className="erp-col-xxl">출발 창고</th>
                  <th className="erp-col-xxl">도착 창고</th>
                  <th className="num erp-col-s">품목 수</th>
                  <th className="num erp-col-m">총 이동수량</th>
                  <th className="erp-col-m">처리자</th>
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
                      <td className="erp-u-muted">{t.memo ?? "-"}</td>
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
          <div className="erp-row-card-list">
            {transfers.map((t) => {
              const items = t.stock_transfer_items ?? [];
              const totalQty = items.reduce((sum, i) => sum + Number(i.quantity), 0);
              return (
                <Link key={t.id} href={`/inventory/transfers/${t.id}?back=${selfBack}`} className="erp-row-card">
                  <div className="erp-row-card-head">
                    <span className="erp-row-card-partner">
                      {t.from_warehouse?.name ?? "-"} → {t.to_warehouse?.name ?? "-"}
                    </span>
                    <span className="erp-row-card-date">{t.transfer_date.replaceAll("-", ".")}</span>
                  </div>
                  <dl className="erp-order-item-fields">
                    <div>
                      <dt>품목 수</dt>
                      <dd>{items.length}</dd>
                    </div>
                    <div>
                      <dt>총 이동수량</dt>
                      <dd>{formatNumber(totalQty)}</dd>
                    </div>
                    <div>
                      <dt>처리자</dt>
                      <dd>{t.profiles?.full_name ?? "-"}</dd>
                    </div>
                    {t.memo && (
                      <div className="erp-u-col-all">
                        <dt>메모</dt>
                        <dd>{t.memo}</dd>
                      </div>
                    )}
                  </dl>
                </Link>
              );
            })}
            {transfers.length === 0 && <p className="erp-grid-empty">이 기간에 등록된 창고 이동이 없습니다.</p>}
          </div>
        </FormSection>
      </div>
    </div>
  );
}
