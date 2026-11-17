// 계정을 서버(service role)에서 만들 때 "어느 회사에 합류시킬지"를 trigger(handle_new_user)에 알리는 메타데이터.
//
// 왜 app_metadata 인가: Supabase 의 공개 가입 API(/auth/v1/signup)는 누구나 user_metadata 를 마음대로 적어 보낼 수 있다 →
// trigger 가 user_metadata 의 tenant_id 를 믿으면 남의 회사에 직원으로 합류할 수 있었다(보안 점검 결과).
// app_metadata 는 service role 만 쓸 수 있으므로 회사 합류·신규 회사·포털 계정 같은 "권한을 정하는 값"은 여기에만 둔다(마이그레이션 257).
// 호환을 위해 user_metadata 에도 같은 값을 그대로 둔다(표시용 full_name/username 도 거기 있다).
const PRIVILEGED_KEYS = ["tenant_id", "new_tenant_name", "new_tenant_slug", "portal_customer_id", "portal_subcontractor_id"] as const;

export function provisionMetadata<T extends Record<string, string | null | undefined>>(userMetadata: T) {
  const appMetadata: Record<string, string> = {};
  for (const key of PRIVILEGED_KEYS) {
    const value = userMetadata[key];
    if (typeof value === "string" && value) appMetadata[key] = value;
  }
  return { user_metadata: userMetadata, app_metadata: appMetadata };
}
