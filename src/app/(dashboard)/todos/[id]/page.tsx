import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { DeleteButton } from "@/components/delete-button";
import { TodoForm } from "@/components/todo-form";
import { KeyboardShortcuts } from "@/components/erp/keyboard-shortcuts";
import { parseTodoMemoLines } from "@/lib/todo-memo";
import { deleteTodo, updateTodo } from "../actions";

export default async function TodoDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const [{ data: row, error }, { data: products }] = await Promise.all([
    supabase
      .from("todos")
      .select("id, title, memo, due_date, done, profiles!created_by(full_name)")
      .eq("id", id)
      .maybeSingle(),
    supabase.from("products").select("id, sku, name, spec, unit, base_package_qty").order("name"),
  ]);

  if (error) {
    return (
      <div className="erp-grid-empty" style={{ padding: 24 }}>
        할 일을 불러오지 못했습니다: {error.message}
      </div>
    );
  }

  if (!row) {
    notFound();
  }

  const memoLines = parseTodoMemoLines(row.memo);
  const memoQtyTotal = memoLines.reduce((sum, line) => sum + Number(line.qty?.replace(/,/g, "") ?? 0), 0);

  return (
    <div>
      <KeyboardShortcuts shortcuts={{ Escape: { href: "/todos" } }} />
      <h1 className="mb-3 text-lg font-bold text-[#1c1c1c]">할일관리 &gt; 수정</h1>

      <div className="erp-toolbar">
        <Link href="/todos" className="erp-btn erp-btn-danger">
          ESC 목록으로
        </Link>
        <DeleteButton action={deleteTodo} id={row.id} confirmMessage="이 할 일을 삭제하시겠습니까?" />
      </div>

      <div className="erp-detail" style={{ marginTop: 0 }}>
        <div className="erp-detail-tabs">
          <span className="erp-detail-tab active">{row.title}</span>
        </div>
        <div className="erp-detail-body">
          <div className="mb-4 flex flex-wrap gap-x-6 gap-y-1 text-sm" style={{ color: "var(--erp-text-muted)" }}>
            <span>작성자: {row.profiles?.full_name ?? "-"}</span>
            <span>상태: {row.done ? "완료" : "진행중"}</span>
          </div>

          {memoLines.length > 0 && (
            <div className="erp-grid-wrap mb-4">
              <table className="erp-grid">
                <thead>
                  <tr>
                    <th>품목</th>
                    <th style={{ width: 140 }}>규격</th>
                    <th className="num" style={{ width: 100 }}>
                      수량
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {memoLines.map((line, i) => (
                    <tr key={i}>
                      <td>{line.name}</td>
                      <td style={{ color: "var(--erp-text-muted)" }}>{line.spec ?? "-"}</td>
                      <td className="num">{line.qty ?? "-"}</td>
                    </tr>
                  ))}
                </tbody>
                {memoQtyTotal > 0 && (
                  <tfoot>
                    <tr>
                      <td colSpan={2} style={{ fontWeight: 700 }}>
                        합계 ({memoLines.length}건)
                      </td>
                      <td className="num" style={{ fontWeight: 700 }}>
                        {memoQtyTotal.toLocaleString()}
                      </td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          )}

          <TodoForm
            action={updateTodo}
            submitLabel="수정"
            initial={{ id: row.id, title: row.title, memo: row.memo, dueDate: row.due_date }}
            products={products ?? []}
          />
        </div>
      </div>
    </div>
  );
}
