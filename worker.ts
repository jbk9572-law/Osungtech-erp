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

const worker = {
  ...openNextWorker,
  async scheduled(_event: ScheduledController, env: Env, ctx: ExecutionContext) {
    // "더미 직원/게시글 매일 자동 생성" 크론 — DEV_SEED_TENANT_SLUG가
    // 설정된 테넌트에만 더미 데이터를 채운다(설정 안 돼 있으면 아무것도
    // 하지 않고 조용히 끝난다 — 이 크론을 켜지 않은 배포에서 실수로
    // 더미 데이터가 생기는 일을 막기 위함).
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
