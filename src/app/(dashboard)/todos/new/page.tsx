import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { TodoForm } from "@/components/todo-form";
import { createTodo } from "@/app/(dashboard)/todos/actions";
import { fetchAllRows } from "@/lib/fetch-all-rows";

export default async function NewTodoPage() {
  const supabase = await createClient();
  const [products, suppliers, customers] = await Promise.all([
    fetchAllRows<{
      id: string;
      sku: string;
      name: string;
      spec: string | null;
      unit: string;
      base_package_qty: number | null;
    }>((from, to) =>
      supabase.from("products").select("id, sku, name, spec, unit, base_package_qty").order("name").range(from, to),
    ),
    fetchAllRows<{ id: string; name: string }>((from, to) =>
      supabase.from("suppliers").select("id, name").order("name").range(from, to),
    ),
    fetchAllRows<{ id: string; name: string }>((from, to) =>
      supabase.from("customers").select("id, name").order("name").range(from, to),
    ),
  ]);

  return (
    <div>
      <h1 className="mb-3 text-lg font-bold text-[var(--erp-text)]">할일관리 &gt; 글쓰기</h1>

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
          <TodoForm
            action={createTodo}
            submitLabel="등록"
            products={products}
            suppliers={suppliers}
            customers={customers}
          />
        </div>
      </div>
    </div>
  );
}
