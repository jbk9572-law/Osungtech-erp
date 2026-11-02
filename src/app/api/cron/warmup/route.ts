import { NextResponse } from "next/server";
import { getServerEnv } from "@/lib/server-env";

// 로그인/저장처럼 버튼 클릭마다 따로따로 요청이 뜨는 동작이 16-20초씩
// 걸린다는 제보가 있었다 — 같은 요청을 연달아 두 번 보내면 두 번째는
// 바로 뜨는 것으로 확인(Cloudflare Workers가 한동안 요청이 없으면
// Supabase로 가는 연결을 닫고, 다음 요청에서 처음부터 TCP/TLS를
// 다시 맺는 비용이 그대로 지연이 됐다). 게시판처럼 한 요청 안에서
// 여러 쿼리를 Promise.all로 같이 보내는 화면은 이 비용을 한 번만
// 내서 안 느꼈을 뿐이다.
//
// 처음엔 wrangler.jsonc에 Cloudflare Cron Trigger("* * * * *")를 걸고
// worker.ts의 scheduled()에서 직접 Supabase를 찔렀는데 전혀 효과가
// 없었다 — 알고 보니 이 배포 방식(OpenNext/Cloudflare)은 Cloudflare
// Cron Trigger가 실제 사용자 요청과 다른("유휴 장비") 위치에서 돌아서,
// 그쪽에서 데운 연결은 실제 트래픽이 지나가는 경로와 무관했다(이미
// mail-sync/messenger-alerts 크론이 같은 이유로 GitHub Actions 방식을
// 쓰고 있었다 — mail-sync.yml 주석 참고). 그래서 똑같이 바깥(GitHub
// Actions)에서 이 주소를 실제 HTTPS 요청으로 호출하는 방식으로 바꿨다
// — 이러면 진짜 사용자 요청과 똑같이 Cloudflare 엣지 라우팅(Smart
// Placement 포함)을 타고 들어와서, 실제 트래픽이 쓰는 그 경로 자체를
// 데워둔다.
//
// .github/workflows/supabase-keepalive.yml(3일 간격)과는 막는 문제가
// 다르다 — 그건 Supabase 프로젝트 자체가 일시정지되는 걸 막는 용도고,
// 이건 이 Worker가 Supabase로 가는 연결을 데워두는 용도다.
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
    const start = Date.now();
    await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/health`, {
      headers: { apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "" },
    });
    return NextResponse.json({ ok: true, durationMs: Date.now() - start });
  } catch (err) {
    console.error("Supabase warmup 핑 실패:", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
