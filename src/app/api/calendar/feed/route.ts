import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCalendarItems } from "@/lib/calendar-data";
import { buildIcsFeed } from "@/lib/ics";

// 구글/아웃룩/애플 캘린더 등이 로그인 세션 없이 주기적으로 이 URL을 다시
// 요청해 최신 일정을 받아가는 ICS 구독 피드. 인증은 쿠키가 아니라 URL의
// ?token= 값(calendar_feed_tokens, 사용자 본인만 조회 가능)으로 한다 —
// src/lib/supabase/proxy.ts의 PUBLIC_PATHS에 이 경로를 등록해 로그인 리다이렉트를
// 건너뛰게 해뒀다. 토큰 자체가 비밀번호 역할이라, 유출되면 regenerate_calendar_feed_token으로
// 재발급해 기존 URL을 무효화할 수 있다.
export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token");
  if (!token || !/^[0-9a-f-]{36}$/i.test(token)) {
    return NextResponse.json({ error: "잘못된 구독 링크입니다." }, { status: 400 });
  }

  const admin = createAdminClient();

  const { data: tokenRow } = await admin
    .from("calendar_feed_tokens")
    .select("tenant_id, is_demo")
    .eq("token", token)
    .maybeSingle();
  if (!tokenRow) {
    return NextResponse.json({ error: "존재하지 않는 구독 링크입니다." }, { status: 404 });
  }

  const { data: tenant } = await admin
    .from("tenants")
    .select("name")
    .eq("id", tokenRow.tenant_id)
    .maybeSingle();

  // 과거 3개월 ~ 앞으로 1년 범위만 담는다 — 캘린더 앱은 이 URL을 스스로
  // 주기적으로 다시 불러오므로(REFRESH-INTERVAL/X-PUBLISHED-TTL 힌트), 굳이
  // 전체 기간을 매번 담을 필요가 없다.
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth() - 3, 1).toISOString();
  const to = new Date(now.getFullYear(), now.getMonth() + 13, 0).toISOString();

  const items = await getCalendarItems(admin, {
    from,
    to,
    tenantId: tokenRow.tenant_id,
    isDemo: tokenRow.is_demo,
  });

  const ics = buildIcsFeed(items, `${tenant?.name ?? "ELVONIX"} 캘린더`);

  return new NextResponse(ics, {
    status: 200,
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'inline; filename="calendar.ics"',
      "Cache-Control": "no-store",
    },
  });
}
