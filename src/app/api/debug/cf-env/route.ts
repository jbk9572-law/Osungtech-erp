import { NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";

// 클라우드플레어 배포에서 SUPABASE_SERVICE_ROLE_KEY가 어디서 안 읽히는지
// 진단하기 위한 임시 라우트. 실제 키 값은 절대 내려주지 않고 존재 여부/
// 에러 메시지만 보여준다. 진단 끝나면 지운다.
export async function GET() {
  const processEnvHasServiceRole = !!process.env.SUPABASE_SERVICE_ROLE_KEY;
  const processEnvHasUrl = !!process.env.NEXT_PUBLIC_SUPABASE_URL;

  let cfContextOk = false;
  let cfContextError: string | null = null;
  let cfEnvHasServiceRole = false;
  let cfEnvKeys: string[] = [];

  try {
    const { env } = getCloudflareContext();
    cfContextOk = true;
    cfEnvHasServiceRole = !!(env as Record<string, unknown>).SUPABASE_SERVICE_ROLE_KEY;
    cfEnvKeys = Object.keys(env as Record<string, unknown>);
  } catch (e) {
    cfContextError = e instanceof Error ? e.message : String(e);
  }

  return NextResponse.json({
    processEnvHasServiceRole,
    processEnvHasUrl,
    cfContextOk,
    cfContextError,
    cfEnvHasServiceRole,
    cfEnvKeys,
  });
}
