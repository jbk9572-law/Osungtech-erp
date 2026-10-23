// 매출/매입 목록에서 검색/필터(q, from, to)를 걸어둔 채로 상세를 열었다가
// ESC/닫기로 돌아가면, 그 조건이 다 풀린 전체 목록으로 가버리는 문제가
// 있었다. 목록 → 상세로 넘어갈 때 지금 목록 화면의 쿼리스트링을 "back"
// 파라미터에 실어 보내고, 상세 화면은 그 값을 그대로 되돌려주는 링크를
// 만드는 데 쓴다.
export function buildListReturnParam(params: Record<string, string | undefined>): string {
  const usp = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value) usp.set(key, value);
  }
  const query = usp.toString();
  return query ? encodeURIComponent(query) : "";
}

export function resolveListHref(basePath: string, back: string | undefined): string {
  if (!back) return basePath;
  try {
    const query = decodeURIComponent(back);
    return query ? `${basePath}?${query}` : basePath;
  } catch {
    return basePath;
  }
}

// 위 두 함수는 "그 레코드의 전용 목록 화면"으로만 돌아간다고 가정하고
// basePath를 고정해둔 채 쿼리스트링(필터값)만 실어 보낸다. 그런데 상세
// 화면이 자기 전용 목록 바깥에서 열리는 경우도 많다 — 대시보드/게시판/
// 알림에서 공지사항·기안·공문을 열거나, 매출 그리드에서 거래처를,
// 매입 그리드에서 공급처를 열거나, 결재 상세에서 "원본 보기"로 구매
// 요청/공문을 여는 경우 등. 이럴 때 닫으면 열었던 화면이 아니라 그
// 레코드의 기본 목록으로 튕겨서 "상세보기 닫았더니 엉뚱한 메뉴로
// 이동해버린다"는 문제가 있었다(사용자 지적) — 쿼리스트링이 아니라
// "실제로 열었던 화면의 전체 경로"를 그대로 back에 실어 보내는 범용
// 버전이 필요하다.
export function buildBackHref(path: string): string {
  return path ? encodeURIComponent(path) : "";
}

export function resolveBackHref(fallback: string, back: string | undefined): string {
  if (!back) return fallback;
  try {
    const decoded = decodeURIComponent(back);
    // 완전한 경로가 아니면(예: back 파라미터가 손상됐거나 외부에서
    // 임의로 조작된 값이면) 기본 목적지로 안전하게 되돌아간다 — 절대
    // 경로가 아닌 값으로 이동을 시도하지 않는다(오픈 리다이렉트 방지).
    // "//evil.com"(프로토콜-상대 경로)뿐 아니라 "/\evil.com"도 막는다 —
    // WHATWG URL 파서는 http(s) 같은 "특수 스킴"에서 백슬래시를 슬래시와
    // 동등하게 취급해서, 브라우저가 이 href를 https://evil.com/로 해석할
    // 수 있다(헌법검사에서 발견된 잘 알려진 오픈 리다이렉트 우회 패턴 —
    // login/actions.ts의 같은 검사도 함께 고침).
    return /^\/[^/\\]/.test(decoded) ? decoded : fallback;
  } catch {
    return fallback;
  }
}
