import type { createClient } from "@/lib/supabase/server";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

export type TodoType = "purchase" | "sale" | "both";

export function parseTodoType(raw: unknown): TodoType {
  return raw === "sale" || raw === "both" ? raw : "purchase";
}

// 목록/대시보드/가져오기 팝업에서 공통으로 쓰는 유형 라벨. both는 출고예정일이
// 마감일과 같거나 비어있으면 당일출고, 다르면 그 날짜로 출고 예정임을 보여준다.
export function todoTypeLabel(
  todoType: string,
  shipDate: string | null,
  dueDate: string | null
): string {
  if (todoType === "sale") return "매출";
  if (todoType === "both") {
    if (shipDate && shipDate !== dueDate) return `${shipDate.slice(5)} 출고`;
    return "당일출고";
  }
  return "매입";
}

// 매입/매출 등록에서 "할일 가져오기"로 가져온 뒤 실제 등록까지 성공했을 때
// 호출된다. 해당 방향의 완료 시각을 남기고, 유형별 필요한 방향이 모두
// 끝났으면 할일 자체를 완료 처리한다:
//   purchase → 매입 등록 한 번이면 완료
//   sale     → 매출 등록 한 번이면 완료
//   both     → 매입/매출 둘 다 등록돼야 완료 (하나만 하면 "매입완료" 같은
//              진행 상태로 목록에 계속 남는다)
export async function markTodoSideDone(
  supabase: SupabaseServerClient,
  todoId: string,
  side: "purchase" | "sale"
) {
  const { data: todo } = await supabase
    .from("todos")
    .select("todo_type, purchase_done_at, sale_done_at, done")
    .eq("id", todoId)
    .maybeSingle();
  if (!todo || todo.done) return;

  const now = new Date().toISOString();
  const purchaseDoneAt = side === "purchase" ? now : todo.purchase_done_at;
  const saleDoneAt = side === "sale" ? now : todo.sale_done_at;

  const type = parseTodoType(todo.todo_type);
  const complete =
    type === "purchase"
      ? Boolean(purchaseDoneAt)
      : type === "sale"
        ? Boolean(saleDoneAt)
        : Boolean(purchaseDoneAt && saleDoneAt);

  await supabase
    .from("todos")
    .update({
      purchase_done_at: purchaseDoneAt,
      sale_done_at: saleDoneAt,
      ...(complete ? { done: true, done_at: now } : {}),
    })
    .eq("id", todoId);
}
