import Link from "next/link";
import { TodoForm } from "@/components/todo-form";
import { createTodo } from "@/app/(dashboard)/todos/actions";

export default function NewTodoPage() {
  return (
    <div>
      <h1 className="mb-3 text-lg font-bold text-[#1c1c1c]">할일관리 &gt; 글쓰기</h1>

      <div className="erp-toolbar">
        <Link href="/todos" className="erp-btn erp-btn-danger">
          ESC 목록으로
        </Link>
      </div>

      <div className="erp-detail" style={{ marginTop: 0 }}>
        <div className="erp-detail-tabs">
          <span className="erp-detail-tab active">할 일 등록</span>
        </div>
        <div className="erp-detail-body">
          <TodoForm action={createTodo} submitLabel="등록" />
        </div>
      </div>
    </div>
  );
}
