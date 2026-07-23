import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { ClickableRow } from "@/components/clickable-row";
import { TodoCheckbox } from "@/components/todo-checkbox";
import { KeyboardShortcuts } from "@/components/erp/keyboard-shortcuts";
import { todoTypeLabel } from "@/lib/todo-flow";

type TodoItemInput = { productId: string; spec?: string | null; quantity: number };

// 품목이 여러 개면 매입/매출 목록과 동일하게 "대표 품목 외 N건"으로 요약한다.
// items에는 productId만 있고 상품명이 없어서, 목록 화면에서 한 번만 상품
// 전체를 불러와 이름을 붙인다.
function summarizeItems(items: TodoItemInput[], productNameById: Map<string, string>): string {
  if (items.length === 0) return "-";
  const firstName = productNameById.get(items[0].productId) ?? "상품 미상";
  return items.length > 1 ? `${firstName} 외 ${items.length - 1}건` : firstName;
}

export default async function TodosPage() {
  const supabase = await createClient();
  const [{ data: rows, error }, { data: products }] = await Promise.all([
    supabase
      .from("todos")
      .select(
        "id, title, items, todo_type, ship_date, purchase_done_at, sale_done_at, due_date, done, profiles!created_by(full_name), suppliers(name), customers(name)"
      )
      .order("done", { ascending: true })
      .order("due_date", { ascending: true, nullsFirst: false })
      .limit(300),
    supabase.from("products").select("id, name"),
  ]);

  const productNameById = new Map((products ?? []).map((p) => [p.id, p.name]));
  const todayStr = new Date().toLocaleDateString("sv-SE");

  return (
    <div>
      <KeyboardShortcuts shortcuts={{ F2: { href: "/todos/new" }, Escape: { href: "/dashboard" } }} />
      <h1 className="mb-3 text-lg font-bold text-[#1c1c1c]">할일관리</h1>

      <div className="erp-toolbar">
        <Link href="/todos/new" className="erp-btn erp-btn-primary">
          F2 글쓰기
        </Link>
        <Link href="/dashboard" className="erp-btn erp-btn-danger">
          ESC 닫기
        </Link>
      </div>

      {error && (
        <p className="erp-grid-empty" style={{ marginBottom: 12 }}>
          목록을 불러오지 못했습니다: {error.message}
        </p>
      )}

      <div className="erp-grid-wrap">
        <table className="erp-grid">
          <thead>
            <tr>
              <th style={{ width: 40 }}>완료</th>
              <th style={{ width: 100 }}>유형</th>
              <th>할 일</th>
              <th style={{ width: 130 }}>매입처</th>
              <th style={{ width: 130 }}>납품처</th>
              <th style={{ width: 170 }}>품목</th>
              <th style={{ width: 110 }}>마감일</th>
              <th style={{ width: 110 }}>작성자</th>
            </tr>
          </thead>
          <tbody>
            {(rows ?? []).map((row) => {
              const overdue = !row.done && !!row.due_date && row.due_date < todayStr;
              const items = Array.isArray(row.items) ? (row.items as TodoItemInput[]) : [];
              return (
                <ClickableRow key={row.id} href={`/todos/${row.id}`}>
                  <td style={{ textAlign: "center" }}>
                    <TodoCheckbox id={row.id} done={row.done} />
                  </td>
                  <td>
                    <span className="erp-badge erp-badge-muted">
                      {todoTypeLabel(row.todo_type, row.ship_date, row.due_date)}
                    </span>
                    {!row.done && row.todo_type === "both" && row.purchase_done_at && (
                      <span className="erp-badge erp-badge-success" style={{ marginLeft: 4 }}>
                        매입완료
                      </span>
                    )}
                  </td>
                  <td style={row.done ? { color: "var(--erp-text-muted)" } : undefined}>{row.title}</td>
                  <td style={{ fontWeight: row.suppliers?.name ? 600 : 400, color: row.suppliers?.name ? "var(--erp-text)" : "var(--erp-text-muted)" }}>
                    {row.suppliers?.name ?? "-"}
                  </td>
                  <td style={{ fontWeight: row.customers?.name ? 600 : 400, color: row.customers?.name ? "var(--erp-text)" : "var(--erp-text-muted)" }}>
                    {row.customers?.name ?? "-"}
                  </td>
                  <td style={{ color: "var(--erp-text-muted)" }}>{summarizeItems(items, productNameById)}</td>
                  <td style={overdue ? { color: "var(--erp-danger)", fontWeight: 600 } : undefined}>
                    {row.due_date ?? "-"}
                  </td>
                  <td style={{ color: "var(--erp-text-muted)" }}>{row.profiles?.full_name ?? "-"}</td>
                </ClickableRow>
              );
            })}
            {!rows?.length && (
              <tr>
                <td colSpan={8} className="erp-grid-empty">
                  등록된 할 일이 없습니다.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
