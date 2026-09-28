// 숫자에 천단위 구분(,)을 넣을 때 지금까지 site 전역에서 맨 `.toLocaleString()`
// (로케일 인자 없이)를 그대로 써왔다 — 날짜 포맷(`new Date(x).toLocaleString("ko-KR")`)은
// 이미 로케일을 명시하는 관례가 있었는데 숫자만 빠져 있었다. 인자 없는
// `.toLocaleString()`은 실행 환경의 기본 로케일을 따르는데, 서버(클라우드플레어
// Workers)와 브라우저의 기본 로케일 판정이 다를 수 있어 SSR 결과와 클라이언트
// 하이드레이션 결과의 문자열이 어긋나는 하이드레이션 에러의 원인이 될 수 있다.
// 로케일을 "ko-KR"로 고정해서 서버/클라이언트가 항상 같은 문자열을 만들게 한다.
export function formatNumber(value: number | string): string {
  return Number(value).toLocaleString("ko-KR");
}
