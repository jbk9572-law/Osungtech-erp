import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";

export type AnnouncementNotice = { id: string; title: string; pinned: boolean };
export type TodoNotice = {
  id: string;
  title: string;
  due_date: string | null;
  itemCount: number;
  todoType: string;
  shipDate: string | null;
};
export type LowStockNotice = { id: string; name: string; quantity: number; reorderPoint: number };

// 타이틀바 알림 종/대시보드 배너/알림 팝업이 공유하는 "지금 확인해야 할 것" 조회 로직.
// 안 읽은 공지사항 + 마감 3일 이내(지난 것 포함)인 미완료 할일 + 안전재고(재주문
// 기준) 이하로 떨어진 품목을 가져온다. 마감이 지났다고 해서 할일을 자동으로
// 완료 처리하지는 않는다 — 실제로 하지 않은 일이 "완료"로 조용히 사라지면
// 할일 기능 자체의 존재 이유(잊어버리지 않기)가 무너지기 때문에, 사용자가
// 직접 체크할 때까지 계속 알림에 남는다.
export async function getNotificationSummary(
  supabase: SupabaseClient<Database>,
  userId: string
): Promise<{ announcements: AnnouncementNotice[]; todos: TodoNotice[]; lowStock: LowStockNotice[] }> {
  const soonDate = new Date();
  soonDate.setDate(soonDate.getDate() + 3);
  const soonStr = soonDate.toLocaleDateString("sv-SE");

  const [{ data: announcements }, { data: reads }, { data: dueTodos }, { data: stockedProducts }] =
    await Promise.all([
      supabase
        .from("announcements")
        .select("id, title, pinned, created_at")
        .order("pinned", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(30),
      supabase.from("announcement_reads").select("announcement_id").eq("user_id", userId),
      supabase
        .from("todos")
        .select("id, title, due_date, items, todo_type, ship_date")
        .eq("done", false)
        .lte("due_date", soonStr)
        .order("due_date", { ascending: true })
        .limit(20),
      // 안전재고를 실제로 설정해둔(0보다 큰) 품목만 대상으로 한다 — 미설정(0)
      // 품목까지 포함하면 재고가 조금만 있어도 항상 알림이 뜨게 된다.
      supabase.from("products").select("id, name, reorder_point, inventory(quantity)").gt("reorder_point", 0),
    ]);

  const readIds = new Set((reads ?? []).map((r) => r.announcement_id));
  const unreadAnnouncements = (announcements ?? [])
    .filter((a) => !readIds.has(a.id))
    .slice(0, 8)
    .map((a) => ({ id: a.id, title: a.title, pinned: a.pinned }));

  const lowStock = (stockedProducts ?? [])
    .map((p) => ({
      id: p.id,
      name: p.name,
      quantity: p.inventory?.[0]?.quantity ?? 0,
      reorderPoint: p.reorder_point,
    }))
    .filter((p) => p.quantity <= p.reorderPoint)
    .sort((a, b) => a.quantity - b.quantity)
    .slice(0, 20);

  const todos = (dueTodos ?? []).map((t) => ({
    id: t.id,
    title: t.title,
    due_date: t.due_date,
    itemCount: Array.isArray(t.items) ? t.items.length : 0,
    todoType: t.todo_type,
    shipDate: t.ship_date,
  }));

  return { announcements: unreadAnnouncements, todos, lowStock };
}
