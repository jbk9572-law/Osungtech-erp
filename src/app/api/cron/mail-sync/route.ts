import { NextResponse } from "next/server";
import { getServerEnv } from "@/lib/server-env";

// GitHub Actions 스케줄(.github/workflows/mail-sync.yml)이 5분마다 호출하는
// 크론 엔드포인트 — 이 배포 방식(OpenNext/Cloudflare)은 Cloudflare Cron
// Trigger를 못 써서(어댑터가 scheduled() 훅을 지원하지 않음) GitHub Actions
// 스케줄로 대신한다. 전체 테넌트의 모든 메일 계정을 순회해서, 탭을 안 열어둔
// 사이에도 최소한 5분 안에는 새 메일이 반영되게 하는 안전망 역할이다(실제
// 탭이 열려 있는 동안은 훨씬 짧은 주기로 pollMyMail이 따로 돈다).
// CRON_SECRET을 모르는 요청은 누구든 이 엔드포인트를 눌러 남의 메일함을
// 동기화시키거나 IMAP 서버에 부담을 줄 수 있어 반드시 막아야 한다.
//
// syncAllMailAccounts는 IMAP 클라이언트(cloudflare:sockets 기반)를 결국
// 불러오는데, 이 파일 맨 위에서 정적으로 import하면 next build의 "Collect
// page data" 단계가 Node로 그 모듈을 그대로 불러오려다 cloudflare:sockets를
// 못 찾아 빌드 자체가 깨진다(라우트 핸들러는 "use client" 경계로 이 문제를
// 피해갈 수 있는 클라이언트 컴포넌트가 아니라서, mail/poll-action.ts처럼
// 파일을 분리하는 것만으로는 해결되지 않는다). 빌드 시점 정적 분석에는
// 안 걸리고 실제 요청이 올 때만 평가되는 동적 import로 미룬다.
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
    const { syncAllMailAccounts } = await import("@/lib/mail/sync-all");
    const result = await syncAllMailAccounts();
    return NextResponse.json(result);
  } catch (err) {
    console.error("메일 동기화 크론 실패:", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
