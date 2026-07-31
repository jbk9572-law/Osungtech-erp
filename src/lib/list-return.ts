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
