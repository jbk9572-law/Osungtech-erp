import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";
import { toKstDateStr } from "@/lib/kst-date";
import { fetchAllRows } from "@/lib/fetch-all-rows";
import { safeQuery } from "@/lib/safe-query";

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
export type UrgentNotice = { id: string; title: string; body: string | null; url: string | null; createdAt: string };

// 거래처 포털 발주처럼 "놓치면 사업상 손실"인 이벤트만 담는, 알림 종과는
// 별도의 긴급 알림 목록 — notification_events(notify()가 쌓는 공용 테이블)
// 중 아직 안 읽은 것만, 지정한 type만 가져온다. 일반 알림 종 요약
// (getNotificationSummary)과 분리한 이유: 저건 10분 주기로 느긋하게
// 확인해도 되지만, 이건 훨씬 짧은 주기로 폴링해서 토스트+소리로 바로
// 알려야 하기 때문이다.
export async function getUrgentNotices(
  supabase: SupabaseClient<Database>,
  userId: string,
  types: string[],
): Promise<UrgentNotice[]> {
  const { data } = await safeQuery<
    { id: string; title: string; body: string | null; url: string | null; created_at: string }[]
  >(
    supabase
      .from("notification_events")
      .select("id, title, body, url, created_at")
      .eq("user_id", userId)
      .eq("is_read", false)
      .in("type", types)
      .order("created_at", { ascending: false })
      .limit(10),
  );
  return (data ?? []).map((n) => ({ id: n.id, title: n.title, body: n.body, url: n.url, createdAt: n.created_at }));
}

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
  const soonStr = toKstDateStr(soonDate);

  const [{ data: announcements }, { data: dueTodos }, stockedProducts] = await Promise.all([
    safeQuery<{ id: string; title: string; pinned: boolean; created_at: string }[]>(
      supabase
        .from("announcements")
        .select("id, title, pinned, created_at")
        .order("pinned", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(30),
    ),
    safeQuery<
      { id: string; title: string; due_date: string | null; items: unknown; todo_type: string; ship_date: string | null }[]
    >(
      supabase
        .from("todos")
        .select("id, title, due_date, items, todo_type, ship_date")
        .eq("done", false)
        .lte("due_date", soonStr)
        .order("due_date", { ascending: true })
        .limit(20),
    ),
    // 안전재고를 실제로 설정해둔(0보다 큰) 품목만 대상으로 한다 — 미설정(0)
    // 품목까지 포함하면 재고가 조금만 있어도 항상 알림이 뜨게 된다.
    fetchAllRows<{ id: string; name: string; reorder_point: number; inventory: { quantity: number }[] }>(
      (from, to) =>
        supabase
          .from("products")
          .select("id, name, reorder_point, inventory(quantity)")
          .gt("reorder_point", 0)
          .range(from, to),
    ),
  ]);

  // 안 읽음 여부는 지금 보여줄 최근 30건에 대해서만 필요하므로, 그 30건의
  // id로만 좁혀서 조회한다 — 이 사용자가 지금까지 읽은 공지 전체를 가져오면
  // 오래 쓸수록(1000건 초과 시) 조용히 잘려서 최근 글의 읽음 여부가 틀릴 수
  // 있다.
  const announcementIds = (announcements ?? []).map((a) => a.id);
  const { data: reads } = announcementIds.length
    ? await safeQuery<{ announcement_id: string }[]>(
        supabase
          .from("announcement_reads")
          .select("announcement_id")
          .eq("user_id", userId)
          .in("announcement_id", announcementIds),
      )
    : { data: [] as { announcement_id: string }[] };

  const readIds = new Set((reads ?? []).map((r) => r.announcement_id));
  const unreadAnnouncements = (announcements ?? [])
    .filter((a) => !readIds.has(a.id))
    .slice(0, 8)
    .map((a) => ({ id: a.id, title: a.title, pinned: a.pinned }));

  const lowStock = (stockedProducts ?? [])
    .map((p) => ({
      id: p.id,
      name: p.name,
      // 창고가 여러 개면 [0]은 임의의 창고 하나만 가리킨다 — 전체(모든
      // 창고 합계) 재고 기준으로 안전재고 이하인지 판단해야 한다.
      quantity: (p.inventory ?? []).reduce((sum, inv) => sum + Number(inv.quantity), 0),
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
