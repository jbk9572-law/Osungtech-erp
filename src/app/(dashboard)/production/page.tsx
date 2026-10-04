import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getQuickDatePresets, getYearMonthButtons, todayStr } from "@/lib/date-presets";
import { DateRangeQuickFilters } from "@/components/erp/date-range-quick-filters";
import { KeyboardShortcuts } from "@/components/erp/keyboard-shortcuts";
import { PageGuide } from "@/components/erp/page-guide";
import { InlineConfirmDelete } from "@/components/inline-confirm-delete";
import { WorkOrderStatusActions } from "@/components/work-order-status-actions";
import { deleteWorkOrder } from "@/app/(dashboard)/production/actions";
import { matchesSearch } from "@/lib/search-match";
import { requireFeatureEnabled } from "@/lib/require-feature-enabled";
import { formatNumber } from "@/lib/format-number";

export default async function ProductionPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string; q?: string }>;
}) {
  const { from, to, q } = await searchParams;
  // 매출/매입 목록과 같은 기본값(오늘) — 그 이전 내역은 프리셋/날짜
  // 필터로 직접 조회한다.
  const effectiveFrom = from || todayStr();
  const effectiveTo = to || todayStr();
  const supabase = await createClient();
  // 메뉴에서는 이미 가려지지만, URL을 직접 쳐서 들어오는 경우까지 막으려면
  // 화면 진입 자체를 여기서 한 번 더 확인해야 한다(paper-calc/page.tsx와
  // 동일한 방식 — 전체 감사에서 이 화면엔 이 검사가 빠져 있던 걸 발견).
  await requireFeatureEnabled(supabase, "production");

  const { data: rawRows } = await supabase
    .from("work_orders")
    .select(
      "id, doc_no, order_date, quantity, status, memo, products(sku, name, unit), warehouses(name), profiles!created_by(full_name)",
    )
    .gte("order_date", effectiveFrom)
    .lte("order_date", effectiveTo)
    .order("order_date", { ascending: false })
    .order("doc_no", { ascending: false });

  const keyword = q?.trim().toLowerCase();
  const rows = keyword
    ? rawRows?.filter((row) =>
        matchesSearch(keyword, row.products?.sku, row.products?.name, row.memo, row.warehouses?.name),
      )
    : rawRows;

  // 공정 체크리스트가 있는 생산지시만 "N/M 공정" 진행률을 같이 보여준다
  // (라우팅을 아직 안 쓰는 제품이 더 많아서, 전부에 0/0으로 표시하면
  // 오히려 잡음이다).
  const workOrderIds = (rows ?? []).map((r) => r.id);
  const { data: stepRows } = workOrderIds.length
    ? await supabase.from("work_order_process_steps").select("work_order_id, status").in("work_order_id", workOrderIds)
    : { data: [] as { work_order_id: string; status: string }[] };
  const stepProgressByOrder = new Map<string, { done: number; total: number }>();
  for (const s of stepRows ?? []) {
    const cur = stepProgressByOrder.get(s.work_order_id) ?? { done: 0, total: 0 };
    cur.total += 1;
    if (s.status === "done") cur.done += 1;
    stepProgressByOrder.set(s.work_order_id, cur);
  }

  return (
    <div>
      <KeyboardShortcuts shortcuts={{ F2: { href: "/production/new" }, Escape: { href: "/dashboard" } }} />
      <h1 className="mb-3 text-lg font-bold text-[var(--erp-text)]">생산관리 &gt; 생산지시 내역</h1>

      <div className="erp-toolbar">
        <Link href="/production/new" className="erp-btn erp-btn-primary">
          F2 생산지시 등록
        </Link>
      </div>

      <PageGuide>
        완제품 BOM을 기준으로 등록한 생산지시 내역입니다. 등록(대기) →
        자재투입(구성품 출고) → 생산완료(완제품 입고) 세 단계로 진행되며,
        각 단계는 담당자가 직접 눌러 처리합니다.
      </PageGuide>

      <DateRangeQuickFilters
        basePath="/production"
        presets={getQuickDatePresets()}
        monthButtons={getYearMonthButtons()}
        from={effectiveFrom}
        to={effectiveTo}
      />

      <form method="get" className="erp-search" style={{ marginBottom: 12 }}>
        {from && <input type="hidden" name="from" value={from} />}
        {to && <input type="hidden" name="to" value={to} />}
        <div className="erp-field" style={{ minWidth: 220, flex: 1 }}>
          <label htmlFor="production-search-q">완제품 / 창고 / 메모 검색</label>
          <input
            id="production-search-q"
            type="text"
            name="q"
            autoComplete="off"
            defaultValue={q ?? ""}
            placeholder="상품명, SKU, 창고, 메모"
            className="erp-input"
            style={{ width: "100%" }}
          />
        </div>
        <button type="submit" className="erp-btn erp-btn-primary">
          조회
        </button>
        {q && (
          <Link href="/production" className="erp-btn">
            초기화
          </Link>
        )}
      </form>

      <div className="erp-grid-wrap">
        <table className="erp-grid">
          <thead>
              <tr>
                <th style={{ width: 90 }}>일자</th>
                <th style={{ width: 90 }}>지시번호</th>
                <th>완제품</th>
                <th className="num" style={{ width: 110 }}>
                  수량
                </th>
                <th style={{ width: 110 }}>창고</th>
                <th style={{ width: 70 }}>공정</th>
                <th style={{ width: 150 }}>상태</th>
                <th>메모</th>
                <th style={{ width: 90 }}>등록자</th>
                <th style={{ width: 70 }} />
              </tr>
            </thead>
            <tbody>
              {(rows ?? []).map((row) => {
                const progress = stepProgressByOrder.get(row.id);
                return (
                  <tr key={row.id}>
                    <td>{row.order_date.replaceAll("-", ".")}</td>
                    <td>{row.doc_no}</td>
                    <td>
                      {row.products?.sku} · {row.products?.name}
                    </td>
                    <td className="num">
                      {formatNumber(Number(row.quantity))} {row.products?.unit}
                    </td>
                    <td>{row.warehouses?.name ?? "-"}</td>
                    <td className="num" style={{ color: "var(--erp-text-muted)" }}>
                      {progress ? `${progress.done}/${progress.total}` : "-"}
                    </td>
                    <td>
                      <WorkOrderStatusActions id={row.id} status={row.status} />
                    </td>
                    <td style={{ color: "var(--erp-text-muted)" }}>{row.memo ?? "-"}</td>
                    <td>{row.profiles?.full_name ?? "-"}</td>
                    <td>
                      <InlineConfirmDelete
                        action={deleteWorkOrder}
                        hiddenFields={{ id: row.id }}
                        warningText="이 생산지시를 삭제하시겠습니까? 지금까지 진행된 만큼 구성품/완제품 재고가 되돌려집니다."
                        triggerStyle={{ minWidth: 0, height: 24, padding: "1px 8px", fontSize: 11 }}
                      />
                    </td>
                  </tr>
                );
              })}
              {!rows?.length && (
                <tr>
                  <td colSpan={10} className="erp-grid-empty">
                    조건에 맞는 생산지시가 없습니다.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
    </div>
  );
}
