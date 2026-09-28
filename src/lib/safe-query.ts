// supabase-js의 단일 조회(.select()/.rpc()/.maybeSingle() 등 — 페이지네이션이
// 있는 목록 조회는 fetchAllRows가 이미 같은 이유로 재시도까지 감싸준다)는
// 응답이 정상적으로 와서 그 안에 { error }가 담긴 경우만 대비하는 게
// 보통이었다. 그런데 Cloudflare Workers 런타임에서 Supabase REST로 나가는
// fetch 자체가 reject되는 경우(네트워크 순단 등)는 그대로 예외로 전파된다.
//
// (dashboard)/layout.tsx가 회사정보/프로필/테넌트/플랫폼관리자여부/공지/
// 점검모드 6개 조회를 Promise.all로 묶어서 매 화면 렌더링 진입점마다
// 부르는데, 이미 주석에 "실패해도 안전한 기본값으로 넘어간다"고 설계
// 의도가 적혀 있었지만 실제로 그렇게 구현되어 있지 않았다 — 이 중 하나만
// 순단에 걸려도 그 요청이 렌더링하려던 화면이 뭐든 상관없이 레이아웃
// 자체가 죽었다. 실제로 재고실사/QR라벨인쇄처럼 서로 무관한 화면에서
// 반복 재현된 크래시가 Cloudflare Workers Logs로 확인해보니 이 Promise.all
// 안에서 나고 있었다. 이 헬퍼로 감싸서 그 설계 의도를 실제로 구현한다.
export async function safeQuery<T>(
  query: PromiseLike<{ data: T | null; error: { message: string } | null }>
): Promise<{ data: T | null }> {
  try {
    const { data } = await query;
    return { data };
  } catch {
    return { data: null };
  }
}
