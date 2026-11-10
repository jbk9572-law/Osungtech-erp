"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

// ErpShell의 "이 회사를 대신 보는 중" 배너(migration 225)에 있는 나가기
// 버튼이 호출한다. 플랫폼 운영자가 아닌 사람이 눌러도(배너 자체가 안
// 뜨므로 정상적으론 일어나지 않지만) stop_tenant_impersonation() RPC는
// "들어가 있는 게 없으면 조용히 아무 일도 안 함"이라 안전하다.
export async function stopTenantImpersonation() {
  const supabase = await createClient();
  const { error } = await supabase.rpc("stop_tenant_impersonation");
  // 배너엔 에러 메시지를 보여줄 자리가 없다 — 실패해도 일단 플랫폼
  // 관리자 화면으로는 보내고(멈춰 있지 않게), 원인은 서버 로그로 남긴다.
  if (error) console.error("stop_tenant_impersonation 실패:", error.message);
  redirect("/platform-admin");
}
