/// <reference types="@cloudflare/workers-types" />
// OpenNext가 만들어주는 기본 워커(.open-next/worker.js)는 fetch 핸들러만
// 내보낸다 — Cloudflare Cron Trigger가 부르는 scheduled() 핸들러는 직접
// 감싸서 추가해야 한다(OpenNext Cloudflare 공식 "Custom Worker" 패턴).
// wrangler.jsonc의 main이 .open-next/worker.js 대신 이 파일을 가리키게
// 바꿔서, 실제 앱 요청 처리는 그대로 위임하고 매일 자정 크론만 여기서
// 가로챈다.
//
// @ts-expect-error `.open-next/worker.js`는 빌드 시점에 생성된다
import openNextWorker from "./.open-next/worker.js";
import { runDevSeed } from "./src/lib/dev-seed/run";

interface Env {
  NEXT_PUBLIC_SUPABASE_URL: string;
  NEXT_PUBLIC_SUPABASE_ANON_KEY: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  DEV_SEED_TENANT_SLUG?: string;
}

// 로그인/저장처럼 단발성으로 뚝뚝 떨어지는 요청이 16-20초씩 걸린다는
// 제보가 있었다 — 같은 요청을 연달아 두 번 보내보니 두 번째는 바로
// 떴다(Cloudflare Workers가 한동안 요청이 없으면 Supabase로 가는 연결을
// 닫고, 다음 요청에서 처음부터 TCP/TLS를 다시 맺는 비용이 그대로
// 지연이 된 것으로 확인). 게시판처럼 한 요청 안에서 여러 쿼리를
// Promise.all로 같이 보내는 화면은 이 비용을 한 번만 내서 안 느꼈을
// 뿐이었다. 1분마다 Supabase Auth 헬스체크 엔드포인트를 찔러서 연결을
// 계속 데워둔다 — .github/workflows/supabase-keepalive.yml(3일 간격,
// GitHub Actions에서 핑)과는 별개다: 그건 Supabase 프로젝트 자체가
// 일시정지되는 걸 막는 용도고, 이건 이 Worker 자신이 들고 있는
// Supabase 연결을 데워두는 용도라 완전히 다른 문제를 막는다.
async function keepSupabaseWarm(env: Env) {
  try {
    await fetch(`${env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/health`, {
      headers: { apikey: env.NEXT_PUBLIC_SUPABASE_ANON_KEY },
    });
  } catch (err) {
    console.error("[keep-warm cron] Supabase 핑 실패:", err instanceof Error ? err.message : err);
  }
}

const worker = {
  ...openNextWorker,
  async scheduled(event: ScheduledController, env: Env, ctx: ExecutionContext) {
    ctx.waitUntil(keepSupabaseWarm(env));

    // "더미 직원/게시글 매일 자동 생성" 크론 — 운영에는 안 켜져 있고
    // dev는 하루 한 번(0 21 * * *)만 매칭된다. 위 keep-warm 핑은
    // 1분마다 매칭되는 별도 크론(* * * * *)이라, event.cron으로 어느
    // 크론이 지금 이 호출을 일으켰는지 구분해야 매분 더미데이터가
    // 돌아가는 사고를 막는다.
    if (event.cron !== "0 21 * * *") return;

    const tenantSlug = env.DEV_SEED_TENANT_SLUG;
    if (!tenantSlug) {
      console.log("[dev-seed cron] DEV_SEED_TENANT_SLUG 미설정 — 건너뜀");
      return;
    }
    ctx.waitUntil(
      runDevSeed({
        supabaseUrl: env.NEXT_PUBLIC_SUPABASE_URL,
        anonKey: env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
        serviceRoleKey: env.SUPABASE_SERVICE_ROLE_KEY,
        tenantSlug,
      })
        .then((result) => {
          console.log(
            `[dev-seed cron] 테넌트 ${result.tenant.slug} 완료 — 직원 ${result.employeeCount}명, 게시판 ${result.boards.length}개`,
          );
          for (const b of result.boards) {
            if (b.error) console.error(`[dev-seed cron] ${b.board} 오류: ${b.error}`);
          }
        })
        .catch((err) => {
          console.error("[dev-seed cron] 실행 실패:", err instanceof Error ? err.message : err);
        }),
    );
  },
};

export default worker;
