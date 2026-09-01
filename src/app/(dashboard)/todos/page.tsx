import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { TodoCheckbox } from "@/components/todo-checkbox";
import { KeyboardShortcuts } from "@/components/erp/keyboard-shortcuts";
import { todoTypeLabel } from "@/lib/todo-flow";
import { todayKstStr } from "@/lib/kst-date";
import { GridBadge } from "@/components/grid/badge";
import { fetchAllRows } from "@/lib/fetch-all-rows";

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
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const supabase = await createClient();
  const [{ data: allRows, error }, products] = await Promise.all([
    supabase
      .from("todos")
      .select(
        "id, title, items, todo_type, ship_date, purchase_done_at, sale_done_at, due_date, done, profiles!created_by(full_name), suppliers(name), customers(name)",
      )
      .order("done", { ascending: true })
      .order("due_date", { ascending: true, nullsFirst: false })
      .limit(300),
    fetchAllRows<{ id: string; name: string }>((from, to) =>
      supabase.from("products").select("id, name").range(from, to),
    ),
  ]);

  const productNameById = new Map(products.map((p) => [p.id, p.name]));
  const todayStr = todayKstStr();

  const keyword = q?.trim().toLowerCase();
  const rows = keyword
    ? (allRows ?? []).filter(
        (r) =>
          r.title.toLowerCase().includes(keyword) ||
          (r.suppliers?.name ?? "").toLowerCase().includes(keyword) ||
          (r.customers?.name ?? "").toLowerCase().includes(keyword),
      )
    : (allRows ?? []);

  // 요약카드는 검색어와 무관하게 전체 할일 기준으로 보여준다("검색해봤더니
  // 전체 건수가 줄어보인다" 같은 혼란을 피하기 위함).
  const totalCount = (allRows ?? []).length;
  const doneCount = (allRows ?? []).filter((r) => r.done).length;
  const overdueCount = (allRows ?? []).filter(
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

      <div className="erp-toolbar">
        <Link href="/todos/new" className="erp-btn erp-btn-primary">
          F2 글쓰기
        </Link>
        <Link href="/dashboard" className="erp-btn erp-btn-danger">
          ESC 닫기
        </Link>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gap: 10,
          marginBottom: 12,
        }}
      >
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
            기한임박
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
            defaultValue={q ?? ""}
            placeholder="제목, 공급처, 납품처"
            className="erp-input"
            style={{ width: "100%" }}
          />
        </div>
        <button type="submit" className="erp-btn erp-btn-primary">
          조회
        </button>
        {q && (
          <Link href="/todos" className="erp-btn">
            초기화
          </Link>
        )}
      </form>

      {error && (
        <p className="erp-grid-empty" style={{ marginBottom: 12 }}>
          목록을 불러오지 못했습니다: {error.message}
        </p>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {rows.map((row) => {
          const overdue = !row.done && !!row.due_date && row.due_date < todayStr;
          const items = Array.isArray(row.items) ? (row.items as TodoItemInput[]) : [];
          const partner = row.suppliers?.name ?? row.customers?.name ?? null;
          return (
            <Link key={row.id} href={`/todos/${row.id}`} className="erp-item-card">
              <TodoCheckbox id={row.id} done={row.done} />
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
    </div>
  );
}
