import { getUser } from "@/lib/supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";

// 비활성화는 되돌릴 수 있지만, 플랫폼 운영 회사나 내 소속 회사를 끄면 운영자 전원이 로그인하지 못한다.
export async function reasonTenantCannotBeDisabled(
  admin: SupabaseClient<Database>,
  tenantId: string,
): Promise<string | null> {
  const { data: target } = await admin.from("tenants").select("is_platform_operator").eq("id", tenantId).maybeSingle();
  if (target?.is_platform_operator) return "플랫폼 운영 회사는 비활성화할 수 없습니다.";
  const me = await getUser();
  if (!me) return "로그인이 필요합니다.";
  const { data: mine } = await admin.from("tenant_members").select("tenant_id").eq("user_id", me.id).maybeSingle();
  if (mine?.tenant_id === tenantId) return "내가 소속된 회사는 비활성화할 수 없습니다.";
  return null;
}
