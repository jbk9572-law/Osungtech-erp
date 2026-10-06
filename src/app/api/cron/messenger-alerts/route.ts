import { NextResponse } from "next/server";
import { getServerEnv } from "@/lib/server-env";
import { syncMessengerSystemAlerts } from "@/lib/messenger-system-alerts";

// GitHub Actions 스케줄(.github/workflows/messenger-alerts.yml)이 주기적으로
// 호출하는 크론 엔드포인트 — mail-sync와 같은 이유(Cloudflare Cron Trigger를
// 이 배포 방식에서 못 씀)로 GitHub Actions를 쓴다. 안전재고부족/할일
// 마감임박·지연을 감지해 그룹웨어 메신저 "전체" 채널에 시스템봇으로 올린다
// (타이틀바 종/토스트 팝업에서는 이 두 가지를 뺐다 — 종과 메신저가 같은
// "확인해야 할 것" 역할을 중복해서 하고 있다는 지적으로 메신저 하나로
// 모았다).
export async function POST(request: Request) {
  const secret = getServerEnv("CRON_SECRET");
  if (!secret) {
    return NextResponse.json({ error: "CRON_SECRET이 설정되지 않았습니다." }, { status: 500 });
  }
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const result = await syncMessengerSystemAlerts();
    return NextResponse.json(result);
  } catch (err) {
    console.error("메신저 시스템 알림 크론 실패:", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
