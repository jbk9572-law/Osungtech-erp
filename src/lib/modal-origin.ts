// 등록/상세 모달(인터셉트 라우트)을 "어느 화면에서 열었는지" 기억한다. 메인 화면의 "새 판매"처럼 목록이 아닌 곳에서 모달을 열어도
// 닫을 때는 고정 목적지(/sales)가 아니라 열었던 화면으로 돌아가야 한다 — 안 그러면 메인 화면에서 열고 닫았는데 매출관리 목록이
// 새로 열려 오래 걸린다. 화면 주소가 바뀔 때마다 TabBar가 recordPageUrl로 알려 준다(모달 주소도 포함되어 직전 주소가 곧 연 곳이다).
let current: string | null = null;
let previous: string | null = null;

export function recordPageUrl(url: string) {
  if (url === current) return;
  previous = current;
  current = url;
}

export function getModalOrigin(): string | null {
  return previous;
}

export function pathOf(url: string): string {
  return url.split("?")[0].split("#")[0];
}
