// R2에 남아있는데 Supabase DB 쪽 참조 행이 없는 "고아 파일"을 찾아
// 지우는 정기 점검 스크립트.
//   npm run sweep:orphan-r2           (실제로 삭제)
//   npm run sweep:orphan-r2 -- --dry-run  (뭘 지울지만 출력, 삭제 안 함)
// .env.local에 있는 NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY /
// R2_ACCOUNT_ID / R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY / R2_BUCKET_NAME을
// 그대로 쓴다(scripts/dev-seed.ts와 같은 방식). GitHub Actions에서는
// .github/workflows/orphan-sweep.yml이 레포 Secrets로 같은 값을 주입해
// 매일 자동으로 돌린다.
import { config as loadEnv } from "dotenv";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "../src/types/database.types";
import { sweepOrphanR2Files } from "../src/lib/r2/sweep-orphans";

const envPath = resolve(process.cwd(), ".env.local");
if (existsSync(envPath)) loadEnv({ path: envPath });

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    console.error(".env.local에 NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY가 모두 필요합니다.");
    process.exit(1);
  }

  const supabase = createClient<Database>(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  console.log(`[orphan-sweep] 시작 (dryRun=${dryRun})`);
  const result = await sweepOrphanR2Files({ supabase, dryRun });

  console.log(
    `[orphan-sweep] R2 전체 객체 ${result.scanned}개 — DB에 참조 있음 ${result.referenced}개, ` +
      `업로드 직후 유예 기간이라 보류 ${result.skippedRecent}개, ` +
      `${dryRun ? "삭제 대상(실제로는 삭제 안 함)" : "삭제함"} ${result.deleted.length}개`,
  );
  for (const key of result.deleted) console.log(`  - ${key}`);
}

main().catch((err) => {
  console.error("[orphan-sweep] 실행 중 오류:", err instanceof Error ? err.message : err);
  process.exit(1);
});
