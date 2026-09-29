import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { TodoCheckbox } from "@/components/todo-checkbox";
import { TodoForm } from "@/components/todo-form";
import { TodoDetailPanel } from "@/components/todo-detail-panel";
import { KeyboardShortcuts } from "@/components/erp/keyboard-shortcuts";
import { todayKstStr } from "@/lib/kst-date";
import { GridBadge } from "@/components/grid/badge";
import { fetchAllRows, fetchLimitedRows } from "@/lib/fetch-all-rows";
import { matchesSearch } from "@/lib/search-match";
import { isUuid } from "@/lib/is-uuid";
import { isPaperCalcEnabled } from "@/lib/paper-calc-sync";
import { createTodo } from "@/app/(dashboard)/todos/actions";
import { formatNumber } from "@/lib/format-number";

const DEFAULT_LIST_LIMIT = 300;
const LIST_LIMIT_STEP = 300;

type TodoItemInput = {
  productId: string;
  spec?: string | null;
  quantity: number;
};

// 품목이 여러 개면 매입/매출 목록과 동일하게 "대표 품목 외 N건"으로 요약한다.
// items에는 productId만 있고 상품명이 없어서, 목록 화면에서 한 번만 상품
// 전체를 불러와 이름을 붙인다.
function summarizeItems(
  items: TodoItemInput[],
  productNameById: Map<string, string>,
): string {
  if (items.length === 0) return "-";
  const firstName = productNameById.get(items[0].productId) ?? "상품 미상";
  return items.length > 1 ? `${firstName} 외 ${items.length - 1}건` : firstName;
}

export default async function TodosPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; warning?: string; limit?: string; id?: string }>;
}) {
  const { q, warning, limit: limitParam, id } = await searchParams;
  const selectedId = id && isUuid(id) ? id : undefined;
  const parsedLimit = limitParam ? parseInt(limitParam, 10) : NaN;
  const limit =
    Number.isFinite(parsedLimit) && parsedLimit > 0 ? parsedLimit : DEFAULT_LIST_LIMIT;
  const supabase = await createClient();
  const [{ rows: allRows, hasMore }, products, summaryRows, suppliers, customers, paperCalcEnabled] =
    await Promise.all([
      fetchLimitedRows<{
        id: string;
        title: string;
        memo: string;
        items: unknown;
        todo_type: string;
        ship_date: string | null;
        purchase_done_at: string | null;
        sale_done_at: string | null;
        due_date: string | null;
        done: boolean;
        profiles: { full_name: string | null } | null;
        suppliers: { name: string } | null;
        customers: { name: string } | null;
      }>(
        (from, to) =>
          supabase
            .from("todos")
            .select(
              "id, title, memo, items, todo_type, ship_date, purchase_done_at, sale_done_at, due_date, done, profiles!created_by(full_name), suppliers(name), customers(name)",
            )
            .order("done", { ascending: true })
            .order("due_date", { ascending: true, nullsFirst: false })
            .range(from, to),
        limit,
      ),
      fetchAllRows<{
        id: string;
        sku: string;
        name: string;
        spec: string | null;
        unit: string;
        base_package_qty: number | null;
        cost: number;
        price: number;
      }>((from, to) =>
        supabase
          .from("products")
          .select("id, sku, name, spec, unit, base_package_qty, cost, price")
          .order("name")
          .range(from, to),
      ),
      // 요약카드(전체/진행중/기한초과/완료)는 화면에 보이는 목록이 limit으로
      // 잘려도 항상 실제 전체 건수를 반영해야 한다.
      fetchAllRows<{ done: boolean; due_date: string | null }>((from, to) =>
        supabase.from("todos").select("done, due_date").range(from, to),
      ),
      fetchAllRows<{ id: string; name: string }>((from, to) =>
        supabase.from("suppliers").select("id, name").order("name").range(from, to),
      ),
      fetchAllRows<{ id: string; name: string }>((from, to) =>
        supabase.from("customers").select("id, name").order("name").range(from, to),
      ),
      isPaperCalcEnabled(supabase),
    ]);

  const productNameById = new Map(products.map((p) => [p.id, p.name]));
  const todayStr = todayKstStr();

  const keyword = q?.trim().toLowerCase();
  const rows = keyword
    ? allRows.filter((r) => {
        const items = Array.isArray(r.items) ? (r.items as TodoItemInput[]) : [];
        const itemNames = items.map((item) => productNameById.get(item.productId));
        return matchesSearch(keyword, r.title, r.memo, r.suppliers?.name, r.customers?.name, ...itemNames);
      })
    : allRows;

  const totalCount = summaryRows.length;
  const doneCount = summaryRows.filter((r) => r.done).length;
  const overdueCount = summaryRows.filter(
    (r) => !r.done && !!r.due_date && r.due_date < todayStr,
  ).length;
  const inProgressCount = totalCount - doneCount;

  const listParams = new URLSearchParams();
  if (q) listParams.set("q", q);
  if (limitParam) listParams.set("limit", limitParam);
  const rowHref = (todoId: string) => {
    const p = new URLSearchParams(listParams);
    p.set("id", todoId);
    return `/todos?${p.toString()}`;
  };
  const moreParams = new URLSearchParams(listParams);
  moreParams.set("limit", String(limit + LIST_LIMIT_STEP));
  const moreHref = `/todos?${moreParams.toString()}`;
  const newHref = listParams.toString() ? `/todos?${listParams.toString()}` : "/todos";

  return (
    <div>
      <KeyboardShortcuts shortcuts={{ F2: { href: newHref }, Escape: { href: selectedId ? newHref : "/dashboard" } }} />
      <div className="erp-page-toolbar erp-detail-header-row">
        <h1 className="text-lg font-bold text-[var(--erp-text)]">할일관리</h1>
        <div className="erp-toolbar" style={{ marginBottom: 0 }}>
          <Link href={newHref} className="erp-btn erp-btn-primary">
            F2 글쓰기
          </Link>
          {selectedId && (
            <Link href={newHref} className="erp-btn">
              목록
            </Link>
          )}
        </div>
      </div>

      {warning && (
        <p
          className="mb-3 rounded-sm px-3 py-2 text-xs font-medium"
          style={{ background: "var(--erp-warning-bg)", color: "var(--erp-warning)" }}
        >
          ⚠ 할일은 정상 등록됐지만: {warning}
        </p>
      )}

      <div className="erp-kpi-row" style={{ marginBottom: 12 }}>
        <div className="erp-home-panel" style={{ padding: "10px 12px" }}>
          <div style={{ fontSize: 11, color: "var(--erp-text-muted)", fontWeight: 600, marginBottom: 6 }}>
            전체 할일
          </div>
          <div style={{ fontSize: 17, fontWeight: 700 }}>{formatNumber(totalCount)}건</div>
        </div>
        <div className="erp-home-panel" style={{ padding: "10px 12px" }}>
          <div style={{ fontSize: 11, color: "var(--erp-text-muted)", fontWeight: 600, marginBottom: 6 }}>
            진행중
          </div>
          <div style={{ fontSize: 17, fontWeight: 700, color: "var(--erp-primary)" }}>
            {formatNumber(inProgressCount)}건
          </div>
        </div>
        <div className="erp-home-panel" style={{ padding: "10px 12px" }}>
          <div style={{ fontSize: 11, color: "var(--erp-text-muted)", fontWeight: 600, marginBottom: 6 }}>
            기한초과
          </div>
          <div style={{ fontSize: 17, fontWeight: 700, color: overdueCount ? "var(--erp-danger)" : undefined }}>
            {formatNumber(overdueCount)}건
          </div>
        </div>
        <div className="erp-home-panel" style={{ padding: "10px 12px" }}>
          <div style={{ fontSize: 11, color: "var(--erp-text-muted)", fontWeight: 600, marginBottom: 6 }}>
            완료
          </div>
          <div style={{ fontSize: 17, fontWeight: 700, color: "var(--erp-text-muted)" }}>
            {formatNumber(doneCount)}건
          </div>
        </div>
      </div>

      <div className="erp-split-shell" data-mobile-view={selectedId ? "detail" : "list"}>
        <section className="erp-split-list">
          <div className="erp-split-list-head">
            <span>할 일 목록</span>
            <span style={{ color: "var(--erp-text-muted)", fontWeight: 400 }}>
              총 {formatNumber(rows.length)}건
            </span>
          </div>
          <form
            id="todos-search-form"
            method="get"
            className="erp-search"
            style={{ margin: 8, padding: 8, gap: 6 }}
          >
            <input
              type="text"
              name="q"
              autoComplete="off"
              defaultValue={q ?? ""}
              placeholder="제목, 메모, 품목명, 거래처 검색"
              className="erp-input"
              style={{ width: "100%" }}
            />
            <button type="submit" className="erp-btn erp-btn-primary" style={{ width: "100%" }}>
              조회
            </button>
          </form>
          <div className="erp-split-list-body">
            {rows.map((row) => {
              const overdue = !row.done && !!row.due_date && row.due_date < todayStr;
              const items = Array.isArray(row.items) ? (row.items as TodoItemInput[]) : [];
              const partner = row.suppliers?.name ?? row.customers?.name ?? null;
              return (
                <div
                  key={row.id}
                  className={`erp-split-list-row${row.id === selectedId ? " active" : ""}`}
                  style={{ display: "flex", alignItems: "flex-start", gap: 6 }}
                >
                  <TodoCheckbox id={row.id} done={row.done} label={row.title} />
                  <Link href={rowHref(row.id)} style={{ flex: 1, minWidth: 0, color: "inherit", textDecoration: "none" }}>
                    <span style={row.done ? { color: "var(--erp-text-muted)" } : { fontWeight: 600 }}>
                      {row.title}
                    </span>
                    {overdue && (
                      <span style={{ marginLeft: 6 }}>
                        <GridBadge tone="danger">기한초과</GridBadge>
                      </span>
                    )}
                    <div className="erp-split-list-row-sub">
                      {partner && <>{partner} · </>}
                      {summarizeItems(items, productNameById)}
                      {row.due_date ? ` · 마감 ${row.due_date}` : ""}
                    </div>
                  </Link>
                </div>
              );
            })}
            {!rows.length && (
              <p className="p-3 text-xs" style={{ color: "var(--erp-text-muted)" }}>
                {q ? "검색 결과가 없습니다." : "등록된 할 일이 없습니다."}
              </p>
            )}
          </div>
          {!keyword && hasMore && (
            <div style={{ padding: 8, borderTop: "1px solid var(--erp-border)" }}>
              <Link href={moreHref} className="erp-btn" style={{ width: "100%" }}>
                더보기 (다음 {formatNumber(LIST_LIMIT_STEP)}건)
              </Link>
            </div>
          )}
        </section>

        <div className="erp-split-detail">
          {selectedId ? (
            <TodoDetailPanel id={selectedId} />
          ) : (
            <div className="erp-detail" style={{ marginTop: 0 }}>
              <div className="erp-detail-tabs">
                <span className="erp-detail-tab active">할 일 등록</span>
              </div>
              <div className="erp-detail-body">
                <TodoForm
                  action={createTodo}
                  submitLabel="등록"
                  products={products}
                  suppliers={suppliers}
                  customers={customers}
                  paperCalcEnabled={paperCalcEnabled}
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
