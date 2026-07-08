import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { ClickableRow } from "@/components/clickable-row";
import { TodoCheckbox } from "@/components/todo-checkbox";
import { KeyboardShortcuts } from "@/components/erp/keyboard-shortcuts";

export default async function TodosPage() {
  const supabase = await createClient();
  const { data: rows, error } = await supabase
    .from("todos")
    .select("id, title, memo, due_date, done, profiles!created_by(full_name)")
    .order("done", { ascending: true })
    .order("due_date", { ascending: true, nullsFirst: false })
    .limit(300);

  const todayStr = new Date().toLocaleDateString("sv-SE");

  return (
    <div>
      <KeyboardShortcuts shortcuts={{ F2: { href: "/todos/new" }, Escape: { href: "/dashboard" } }} />
      <h1 className="mb-3 text-lg font-bold text-[#1c1c1c]">할일관리</h1>

      <div className="erp-toolbar">
        <Link href="/todos/new" className="erp-btn erp-btn-primary">
          F2 글쓰기
        </Link>
        <Link href="/dashboard" className="erp-btn">
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
              <th>할 일</th>
              <th style={{ width: 140 }}>작성자</th>
              <th style={{ width: 120 }}>마감일</th>
            </tr>
          </thead>
          <tbody>
            {(rows ?? []).map((row) => {
              const overdue = !row.done && !!row.due_date && row.due_date < todayStr;
              return (
                <ClickableRow key={row.id} href={`/todos/${row.id}`}>
                  <td style={{ textAlign: "center" }}>
                    <TodoCheckbox id={row.id} done={row.done} />
                  </td>
                  <td style={row.done ? { textDecoration: "line-through", color: "var(--erp-text-muted)" } : undefined}>
                    {row.title}
                  </td>
                  <td>{row.profiles?.full_name ?? "-"}</td>
                  <td style={overdue ? { color: "var(--erp-danger)", fontWeight: 600 } : undefined}>
                    {row.due_date ?? "-"}
                  </td>
                </ClickableRow>
              );
            })}
            {!rows?.length && (
              <tr>
                <td colSpan={4} className="erp-grid-empty">
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
