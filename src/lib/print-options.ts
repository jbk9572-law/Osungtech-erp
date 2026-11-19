// 인쇄 화면의 옵션(공급받는자만/전지/미수금 표기 등)을 바꾸는 링크 주소 만들기.
// 예전엔 화면마다 `?copies=..&layout=..&balance=..`를 손으로 이어 붙여서, 그때 같이 들어 있던 back(목록 복귀 조건)·lot(관리번호 표기)이
// 옵션을 한 번 누르는 순간 사라졌다 — 지금 주소의 모든 값을 그대로 가져가고 바꾸는 옵션 하나만 덮어쓴다.
export type PrintOptionParams = Record<string, string | string[] | undefined>;

export function buildPrintOptionHref(
  basePath: string,
  current: PrintOptionParams,
  key: string,
  value: string,
): string {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(current)) {
    if (k === key) continue;
    const first = Array.isArray(v) ? v[0] : v;
    if (first !== undefined && first !== "") qs.set(k, first);
  }
  qs.set(key, value);
  return `${basePath}?${qs.toString()}`;
}
