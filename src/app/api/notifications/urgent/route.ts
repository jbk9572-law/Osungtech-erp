import { NextResponse } from "next/server";
import { createClient, getUser } from "@/lib/supabase/server";
import { getUrgentNotices } from "@/lib/notifications";

// 거래처 포털 발주 같은 "놓치면 안 되는" 알림만 짧은 주기로 폴링하는
// 전용 엔드포인트 — 일반 알림 종(/api/notifications)과 분리해서, 이
// 엔드포인트만 훨씬 자주(NotificationToaster 참고) 불러도 서버 부담이
// 적다(notification_events 한 테이블, 적은 행수 조회뿐이라).
export async function GET() {
  const supabase = await createClient();
  const user = await getUser();

  if (!user) {
    return NextResponse.json({ notices: [] }, { status: 401 });
  }

  const notices = await getUrgentNotices(supabase, user.id, ["customer_order"]);
  return NextResponse.json({ notices });
}
