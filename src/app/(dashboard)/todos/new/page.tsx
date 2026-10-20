import { createClient } from "@/lib/supabase/server";
import { TodoForm } from "@/components/todo-form";
import { createTodo } from "@/app/(dashboard)/todos/actions";
import { fetchAllRows } from "@/lib/fetch-all-rows";
import { KeyboardShortcuts } from "@/components/erp/keyboard-shortcuts";
import { CloseButton } from "@/components/erp/close-button";
import { ListPageHeader, FormSection } from "@/components/erp/page-header";
import { isPaperCalcEnabled } from "@/lib/paper-calc-sync";

export default async function NewTodoPage() {
  const supabase = await createClient();
  const [products, suppliers, customers, paperCalcEnabled] = await Promise.all([
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
    fetchAllRows<{ id: string; name: string }>((from, to) =>
      supabase.from("suppliers").select("id, name").order("name").range(from, to),
    ),
    fetchAllRows<{ id: string; name: string }>((from, to) =>
      supabase.from("customers").select("id, name").order("name").range(from, to),
    ),
    isPaperCalcEnabled(supabase),
  ]);

  return (
    <div className="erp-comm-shell">
      <KeyboardShortcuts shortcuts={{ Escape: { href: "/todos" } }} />
      <ListPageHeader
        title="할일관리 > 글쓰기"
        actions={<CloseButton href="/todos">ESC 목록으로</CloseButton>}
      />

      <div>
        <FormSection tabLabel="할 일 등록">
          <TodoForm
            action={createTodo}
            submitLabel="등록"
            products={products}
            suppliers={suppliers}
            customers={customers}
            paperCalcEnabled={paperCalcEnabled}
          />
        </FormSection>
      </div>
    </div>
  );
}
