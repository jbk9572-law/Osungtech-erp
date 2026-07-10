import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { DeleteButton } from "@/components/delete-button";
import { TodoForm } from "@/components/todo-form";
import { KeyboardShortcuts } from "@/components/erp/keyboard-shortcuts";
import { deleteTodo, updateTodo } from "../actions";

export default async function TodoDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: row, error } = await supabase
    .from("todos")
    .select("id, title, memo, due_date, done, profiles!created_by(full_name)")
    .eq("id", id)
    .maybeSingle();

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
          <TodoForm
            action={updateTodo}
            submitLabel="수정"
            initial={{ id: row.id, title: row.title, memo: row.memo, dueDate: row.due_date }}
          />
        </div>
      </div>
    </div>
  );
}
