// 로컬에서 직접 실행하는 더미(테스트용) 직원/게시글 시드 스크립트.
//   npm run dev:seed -- --tenant=<slug>
// .env.local에 있는 NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY /
// SUPABASE_SERVICE_ROLE_KEY를 그대로 쓴다 — 배포 환경(Cloudflare
// 대시보드의 Secret)과 같은 값이면 그대로 되고, 로컬 개발용 Supabase
// 프로젝트가 따로 있다면 그 값을 넣으면 된다.
import { config as loadEnv } from "dotenv";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { runDevSeed } from "../src/lib/dev-seed/run";

const envPath = resolve(process.cwd(), ".env.local");
if (existsSync(envPath)) loadEnv({ path: envPath });

function readArg(name: string): string | undefined {
  const prefix = `--${name}=`;
  const found = process.argv.find((a) => a.startsWith(prefix));
  return found?.slice(prefix.length);
}

async function main() {
  const tenantSlug = readArg("tenant") ?? process.env.DEV_SEED_TENANT_SLUG;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!tenantSlug) {
    console.error("사용법: npm run dev:seed -- --tenant=<테넌트 slug>  (또는 .env.local에 DEV_SEED_TENANT_SLUG 지정)");
    process.exit(1);
  }
  if (!url || !anonKey || !serviceRoleKey) {
    console.error(
      ".env.local에 NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY가 모두 필요합니다.",
    );
    process.exit(1);
  }

  console.log(`[dev-seed] 테넌트 "${tenantSlug}"에 더미 데이터를 생성합니다...`);
  const result = await runDevSeed({ supabaseUrl: url, anonKey, serviceRoleKey, tenantSlug });

  console.log(`\n[dev-seed] 테넌트: ${result.tenant.name} (${result.tenant.slug})`);
  console.log(`[dev-seed] 더미 직원: 총 ${result.employeeCount}명 (아이디: dummy01 ~ , 비밀번호는 employees.ts의 DUMMY_EMPLOYEE_PASSWORD 참고)`);
  console.log("[dev-seed] 게시판별 생성 결과:");
  for (const b of result.boards) {
    const status = b.error ? `⚠ ${b.created}건 성공, 오류: ${b.error}` : `${b.created}건`;
    console.log(`  - ${b.board}: ${status}`);
  }
}

main().catch((err) => {
  console.error("[dev-seed] 실행 중 오류:", err instanceof Error ? err.message : err);
  process.exit(1);
});
