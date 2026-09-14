import { createClient } from "@/lib/supabase/server";
import { getNotificationSummary } from "@/lib/notifications";
import { NotificationBell } from "@/components/erp/notification-bell";

// 알림 종(공지/할일/안전재고) 조회를 (dashboard)/layout.tsx의 메인
// Promise.all에서 분리했다 — getNotificationSummary 하나가 공지/할일/
// 안전재고 조회 3개 + 안읽음 여부 조회 1개, 총 4번의 DB 왕복이다. 이게
// 페이지 이동마다(모달 열기 포함) 항상 같이 도는 구조라 요청당 CPU
// 시간에 그만큼 부담이 됐다 — usage-widget-panel.tsx와 같은 이유로
// <Suspense>로 분리해서 독립적으로 스트리밍되게 한다.
export async function NotificationBellPanel({ userId }: { userId: string }) {
  const supabase = await createClient();
  const notifications = await getNotificationSummary(supabase, userId);

  return (
    <NotificationBell
      announcements={notifications.announcements}
      todos={notifications.todos}
      lowStock={notifications.lowStock}
    />
  );
}
