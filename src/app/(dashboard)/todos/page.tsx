import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { TodoCheckbox } from "@/components/todo-checkbox";
import { KeyboardShortcuts } from "@/components/erp/keyboard-shortcuts";
import { todoTypeLabel } from "@/lib/todo-flow";
import { todayKstStr } from "@/lib/kst-date";
import { GridBadge } from "@/components/grid/badge";
import { fetchAllRows, fetchLimitedRows } from "@/lib/fetch-all-rows";

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
  searchParams: Promise<{ q?: string; warning?: string; limit?: string }>;
}) {
  const { q, warning, limit: limitParam } = await searchParams;
  const parsedLimit = limitParam ? parseInt(limitParam, 10) : NaN;
  const limit =
    Number.isFinite(parsedLimit) && parsedLimit > 0 ? parsedLimit : DEFAULT_LIST_LIMIT;
  const supabase = await createClient();
  const [{ rows: allRows, hasMore }, products, summaryRows] = await Promise.all([
    fetchLimitedRows<{
      id: string;
      title: string;
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
            "id, title, items, todo_type, ship_date, purchase_done_at, sale_done_at, due_date, done, profiles!created_by(full_name), suppliers(name), customers(name)",
          )
          .order("done", { ascending: true })
          .order("due_date", { ascending: true, nullsFirst: false })
          .range(from, to),
      limit,
    ),
    fetchAllRows<{ id: string; name: string }>((from, to) =>
      supabase.from("products").select("id, name").range(from, to),
    ),
    // 요약카드(전체/진행중/기한초과/완료)는 화면에 보이는 목록이 limit으로
    // 잘려도 항상 실제 전체 건수를 반영해야 한다 — 목록이 300건에서 잘린
    // 상태로 요약카드까지 같이 줄어들면 "완료했는데 왜 전체 건수가 그대로냐"
    // 같은 혼란이 생긴다(sales/purchases 리스트의 합계를 별도 쿼리로 다시
    // 구하는 것과 같은 이유).
    fetchAllRows<{ done: boolean; due_date: string | null }>((from, to) =>
      supabase.from("todos").select("done, due_date").range(from, to),
    ),
  ]);

  const productNameById = new Map(products.map((p) => [p.id, p.name]));
  const todayStr = todayKstStr();

  const keyword = q?.trim().toLowerCase();
  const rows = keyword
    ? allRows.filter(
        (r) =>
          r.title.toLowerCase().includes(keyword) ||
          (r.suppliers?.name ?? "").toLowerCase().includes(keyword) ||
          (r.customers?.name ?? "").toLowerCase().includes(keyword),
      )
    : allRows;

  // 요약카드는 검색어와도, 목록 표시 limit과도 무관하게 전체 할일 기준으로
  // 보여준다("검색해봤더니/최근 N건만 보이는데 전체 건수가 줄어보인다" 같은
  // 혼란을 피하기 위함).
  const totalCount = summaryRows.length;
  const doneCount = summaryRows.filter((r) => r.done).length;
  const overdueCount = summaryRows.filter(
    (r) => !r.done && !!r.due_date && r.due_date < todayStr,
  ).length;
  const inProgressCount = totalCount - doneCount;

  return (
    <div>
      <KeyboardShortcuts
        shortcuts={{
          F2: { href: "/todos/new" },
          Escape: { href: "/dashboard" },
        }}
      />
      <h1 className="mb-3 text-lg font-bold text-[var(--erp-text)]">
        할일관리
      </h1>

      {warning && (
        <p
          className="mb-3 rounded-sm px-3 py-2 text-xs font-medium"
          style={{
            background: "var(--erp-warning-bg)",
            color: "var(--erp-warning)",
          }}
        >
          ⚠ 할일은 정상 등록됐지만: {warning}
        </p>
      )}

      <div className="erp-toolbar">
        <Link href="/todos/new" className="erp-btn erp-btn-primary">
          F2 글쓰기
        </Link>
        <Link href="/dashboard" className="erp-btn erp-btn-danger">
          ESC 닫기
        </Link>
      </div>

      <div className="erp-kpi-row">
        <div className="erp-home-panel" style={{ padding: "10px 12px" }}>
          <div style={{ fontSize: 11, color: "var(--erp-text-muted)", fontWeight: 600, marginBottom: 6 }}>
            전체 할일
          </div>
          <div style={{ fontSize: 17, fontWeight: 700 }}>{totalCount.toLocaleString()}건</div>
        </div>
        <div className="erp-home-panel" style={{ padding: "10px 12px" }}>
          <div style={{ fontSize: 11, color: "var(--erp-text-muted)", fontWeight: 600, marginBottom: 6 }}>
            진행중
          </div>
          <div style={{ fontSize: 17, fontWeight: 700, color: "var(--erp-primary)" }}>
            {inProgressCount.toLocaleString()}건
          </div>
        </div>
        <div className="erp-home-panel" style={{ padding: "10px 12px" }}>
          <div style={{ fontSize: 11, color: "var(--erp-text-muted)", fontWeight: 600, marginBottom: 6 }}>
            기한초과
          </div>
          <div style={{ fontSize: 17, fontWeight: 700, color: overdueCount ? "var(--erp-danger)" : undefined }}>
            {overdueCount.toLocaleString()}건
          </div>
        </div>
        <div className="erp-home-panel" style={{ padding: "10px 12px" }}>
          <div style={{ fontSize: 11, color: "var(--erp-text-muted)", fontWeight: 600, marginBottom: 6 }}>
            완료
          </div>
          <div style={{ fontSize: 17, fontWeight: 700, color: "var(--erp-text-muted)" }}>
            {doneCount.toLocaleString()}건
          </div>
        </div>
      </div>

      <form method="get" className="erp-search">
        <div className="erp-field" style={{ minWidth: 220, flex: 1 }}>
          <label htmlFor="search-q">할 일 검색</label>
          <input
            id="search-q"
            type="text"
            name="q"
            autoComplete="off"
            defaultValue={q ?? ""}
            placeholder="제목, 공급처, 납품처"
            className="erp-input"
            style={{ width: "100%" }}
          />
        </div>
        <button type="submit" className="erp-btn erp-btn-primary">
          조회
        </button>
        {limitParam && <input type="hidden" name="limit" value={limitParam} />}
        {q && (
          <Link href="/todos" className="erp-btn">
            초기화
          </Link>
        )}
      </form>

      <div
        className="rounded p-2 text-xs"
        style={{
          marginBottom: 8,
          background: "var(--erp-info-bg)",
          color: "var(--erp-info-text)",
          border: "1px solid var(--erp-info-border)",
        }}
      >
        최근 {limit.toLocaleString()}건까지 표시 중{hasMore ? " — 더 있을 수 있습니다." : "."}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {rows.map((row) => {
          const overdue = !row.done && !!row.due_date && row.due_date < todayStr;
          const items = Array.isArray(row.items) ? (row.items as TodoItemInput[]) : [];
          const partner = row.suppliers?.name ?? row.customers?.name ?? null;
          return (
            <Link key={row.id} href={`/todos/${row.id}`} className="erp-item-card">
              <TodoCheckbox id={row.id} done={row.done} label={row.title} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3, flexWrap: "wrap" }}>
                  <span
                    style={
                      row.done
                        ? { fontSize: 13.5, fontWeight: 500, color: "var(--erp-text-muted)" }
                        : { fontSize: 13.5, fontWeight: 700, color: "var(--erp-text)" }
                    }
                  >
                    {row.title}
                  </span>
                  <GridBadge tone="muted">
                    {todoTypeLabel(row.todo_type, row.ship_date, row.due_date)}
                  </GridBadge>
                  {!row.done && row.todo_type === "both" && row.purchase_done_at && (
                    <GridBadge tone="ok">매입완료</GridBadge>
                  )}
                  {overdue && <GridBadge tone="danger">기한초과</GridBadge>}
                </div>
                <div style={{ fontSize: 12, color: "var(--erp-text-muted)" }}>
                  {partner && <>{partner} · </>}
                  {summarizeItems(items, productNameById)}
                </div>
              </div>
              <div style={{ textAlign: "right", fontSize: 11, color: "var(--erp-text-muted)", flexShrink: 0 }}>
                <div>{row.profiles?.full_name ?? "-"}</div>
                <div style={overdue ? { color: "var(--erp-danger)", fontWeight: 700 } : undefined}>
                  {row.due_date ? `마감 ${row.due_date}` : "-"}
                </div>
              </div>
            </Link>
          );
        })}
        {!rows.length && (
          <p className="erp-grid-empty">
            {q ? "검색 결과가 없습니다." : "등록된 할 일이 없습니다."}
          </p>
        )}
      </div>

      {hasMore && (
        <div style={{ display: "flex", justifyContent: "center", marginTop: 12 }}>
          <Link
            href={`/todos?${new URLSearchParams({
              ...(q ? { q } : {}),
              limit: String(limit + LIST_LIMIT_STEP),
            }).toString()}`}
            className="erp-btn"
          >
            더보기 (다음 {LIST_LIMIT_STEP.toLocaleString()}건)
          </Link>
        </div>
      )}
    </div>
  );
}
