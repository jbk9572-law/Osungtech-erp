import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getNotificationSummary } from "@/lib/notifications";

// 타이틀바 종/대시보드 배너와 같은 데이터를, 페이지 이동 없이도 주기적으로
// 다시 확인할 수 있도록 폴링용으로 제공한다 (알림 팝업이 사용).
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ announcements: [], todos: [], lowStock: [] }, { status: 401 });
  }

  const summary = await getNotificationSummary(supabase, user.id);
  return NextResponse.json(summary);
}
