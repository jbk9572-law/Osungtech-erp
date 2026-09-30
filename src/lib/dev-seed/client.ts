import { createClient } from "@supabase/supabase-js";
import type { Database } from "../../types/database.types";
import { fetchAllRows } from "../fetch-all-rows";
import type { Db } from "./types";

// 이 파일은 src/lib/supabase/admin.ts와 같은 역할(관리자 클라이언트
// 생성)을 하지만, Next.js 요청 컨텍스트 밖(로컬 CLI 스크립트, Cloudflare
// scheduled() 핸들러)에서도 돌아가야 해서 getCloudflareContext()/
// process.env에 의존하는 그쪽 헬퍼 대신 인자로 직접 URL/키를 받는다.
export function createAdminClient(url: string, serviceRoleKey: string): Db {
  return createClient<Database>(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

// 더미 직원으로 실제 로그인해서(anon 키 + 비밀번호) 그 직원 권한으로
// 게시글을 만든다 — auth.uid()가 정상적으로 채워져야 tenant_id 컬럼
// 기본값(current_tenant_id())과 각 화면의 RLS 정책이 실제 사용자가
// 쓸 때와 똑같이 동작한다(서비스 롤 우회 insert는 tenant_id가 비어
// 들어갈 위험이 있어 일부러 쓰지 않는다).
export async function signInAsEmployee(url: string, anonKey: string, email: string, password: string): Promise<Db> {
  const client = createClient<Database>(url, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { error } = await client.auth.signInWithPassword({ email, password });
  if (error) {
    throw new Error(`더미 직원(${email}) 로그인 실패: ${error.message}`);
  }
  return client;
}

export async function resolveTenant(admin: Db, slugOrName: string): Promise<{ id: string; slug: string; name: string }> {
  const needle = slugOrName.trim().toLowerCase();
  const tenants = await fetchAllRows<{ id: string; slug: string; name: string }>((from, to) =>
    admin.from("tenants").select("id, slug, name").range(from, to),
  );

  const matches = tenants.filter(
    (t) => t.slug.toLowerCase() === needle || t.name.toLowerCase() === needle,
  );
  if (matches.length === 0) {
    const available = (tenants ?? []).map((t) => `${t.name}(${t.slug})`).join(", ") || "(없음)";
    throw new Error(`"${slugOrName}"에 해당하는 테넌트를 찾을 수 없습니다. 사용 가능한 테넌트: ${available}`);
  }
  if (matches.length > 1) {
    throw new Error(`"${slugOrName}"에 해당하는 테넌트가 여러 개입니다 — 정확한 slug를 입력해주세요.`);
  }
  return matches[0];
}
